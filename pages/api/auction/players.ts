// pages/api/auction/players.ts - Simple approach with string cleaning
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
    const auctionExists = await sql`SELECT EXISTS(SELECT 1 FROM auctions WHERE id = ${auctionId})`;
    
    if (!auctionExists || !auctionExists[0] || !auctionExists[0].exists) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log(`Processing ${availablePlayers.length} players for auction ${auctionId}`);
    
    // Try to save a sample player first to test DB connection
    try {
      const testPlayer = {
        player_id: 'test-player',
        full_name: 'Test Player',
        position: 'QB',
        team: 'TEST',
        years_exp: 0
      };
      
      await sql`
        INSERT INTO available_players (player_id, auction_id, full_name, position, team, years_exp)
        VALUES (${testPlayer.player_id}, ${auctionId}, ${testPlayer.full_name}, ${testPlayer.position}, ${testPlayer.team}, ${testPlayer.years_exp})
        ON CONFLICT DO NOTHING
      `;
      
      console.log('Test player insertion successful');
    } catch (testError) {
      console.error('Test player insertion failed:', testError);
      // Continue anyway to try the batch process
    }
    
    // Clear existing players
    await sql`DELETE FROM available_players WHERE auction_id = ${auctionId}`;
    
    // Process in very small batches
    const BATCH_SIZE = 10; 
    let successCount = 0;
    let errorCount = 0;
    let lastError = null;
    
    for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
      const batch = availablePlayers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(availablePlayers.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} players)`);
      
      // Process each player individually
      for (const player of batch) {
        try {
          // Skip invalid players
          if (!player || !player.player_id) {
            errorCount++;
            continue;
          }
          
          // Clean up data to ensure correct types
          const playerId = String(player.player_id);
          const fullName = String(player.full_name || 'Unknown Player');
          const position = String(player.position || 'UNKNOWN');
          const team = player.team ? String(player.team) : null;
          const yearsExp = Number(player.years_exp || 0);
          
          // Insert with simple values
          await sql`
            INSERT INTO available_players (player_id, auction_id, full_name, position, team, years_exp)
            VALUES (${playerId}, ${auctionId}, ${fullName}, ${position}, ${team}, ${yearsExp})
            ON CONFLICT (player_id, auction_id) DO UPDATE SET
              full_name = ${fullName},
              position = ${position},
              team = ${team},
              years_exp = ${yearsExp}
          `;
          
          successCount++;
        } catch (playerError) {
          console.error('Error inserting player:', playerError);
          console.error('Problem player:', JSON.stringify(player));
          errorCount++;
          lastError = playerError;
        }
      }
      
      // Log progress
      console.log(`Completed batch ${batchNum}/${totalBatches}: ${successCount} successful, ${errorCount} errors`);
    }
    
    console.log(`Player insertion complete. Total: ${successCount} successful, ${errorCount} errors`);
    
    return res.status(200).json({
      success: true,
      message: `Processed ${availablePlayers.length} players: ${successCount} successful, ${errorCount} errors`,
      successCount,
      errorCount,
      lastError: lastError ? String(lastError) : null
    });
  } catch (error) {
    console.error('Error updating available players:', error);
    return res.status(500).json({ 
      message: 'Failed to update available players',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}