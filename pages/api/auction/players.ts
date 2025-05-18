// pages/api/auction/players.ts - Robust version with better error handling
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

// Configure for larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use PUT or POST.' });
  }
  
  const { auctionId, availablePlayers } = req.body;
  
  if (!auctionId || !availablePlayers) {
    return res.status(400).json({ message: 'Auction ID and available players are required' });
  }
  
  try {
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Verify auction exists
    const auctionResult = await sql`SELECT id FROM auctions WHERE id = ${auctionId}`;
    
    if (!auctionResult || auctionResult.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log(`Processing ${availablePlayers.length} players for auction ${auctionId}`);
    
    // Clear existing players for this auction
    await sql`DELETE FROM available_players WHERE auction_id = ${auctionId}`;
    
    // Process in smaller batches
    const BATCH_SIZE = 25; // Smaller batch size for safety
    let successCount = 0;
    let errorCount = 0;
    let lastError = null;
    
    for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
      const batch = availablePlayers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(availablePlayers.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} players)`);
      
      // For each player in the batch, do individual inserts with explicit type casting
      for (let j = 0; j < batch.length; j++) {
        try {
          const player = batch[j];
          
          // Validate player has required fields
          if (!player || !player.player_id) {
            console.warn(`Skipping invalid player at index ${i + j}`);
            errorCount++;
            continue;
          }
          
          // Use parameterized SQL with explicit type casting
          await sql`
            INSERT INTO available_players (
              player_id, 
              auction_id, 
              full_name, 
              position, 
              team, 
              years_exp
            )
            VALUES (
              ${player.player_id}::text, 
              ${auctionId}::text, 
              ${player.full_name || 'Unknown Player'}::text, 
              ${player.position || 'UNKNOWN'}::text, 
              ${player.team || null}::text, 
              ${typeof player.years_exp === 'number' ? player.years_exp : 0}::integer
            )
            ON CONFLICT (player_id, auction_id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              position = EXCLUDED.position,
              team = EXCLUDED.team,
              years_exp = EXCLUDED.years_exp
          `;
          
          successCount++;
        } catch (playerError) {
          // Log the error but continue with other players
          console.error(`Error inserting player at index ${i + j}:`, playerError);
          console.error('Problematic player data:', JSON.stringify(batch[j]));
          lastError = playerError;
          errorCount++;
        }
      }
      
      console.log(`Completed batch ${batchNum}/${totalBatches}: ${successCount} successful, ${errorCount} errors`);
    }
    
    // Update auction with player count even if some failed
    if (successCount > 0) {
      await sql`
        UPDATE auctions 
        SET settings = settings || jsonb_build_object('availablePlayersCount', ${successCount})
        WHERE id = ${auctionId}
      `;
    }
    
    // Return success with detailed counts
    return res.status(200).json({
      success: true,
      message: `Processed ${successCount + errorCount} players: ${successCount} successful, ${errorCount} errors`,
      successCount,
      errorCount,
      lastError: lastError ? (lastError instanceof Error ? lastError.message : String(lastError)) : null
    });
  } catch (error) {
    console.error('Error updating available players:', error);
    return res.status(500).json({ 
      message: 'Failed to update available players',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}