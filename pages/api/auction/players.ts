// pages/api/auction/players.ts - Improved with batch processing
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction } from '../../../lib/database-neon';
import { neon } from '@neondatabase/serverless';

// Configure API route to handle larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase from default ~1mb to 10mb
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use PUT or POST.' });
  }
  
  // Log request size for debugging
  const requestSize = JSON.stringify(req.body).length / 1024 / 1024;
  console.log(`Received players update request. Approximate size: ${requestSize.toFixed(2)}MB`);
  
  const { auctionId, availablePlayers } = req.body;
  
  if (!auctionId || !availablePlayers) {
    return res.status(400).json({ message: 'Auction ID and available players are required' });
  }
  
  try {
    // Get database client
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Get auction to verify it exists
    const auctionResult = await sql`SELECT id FROM auctions WHERE id = ${auctionId}`;
    
    if (!auctionResult || auctionResult.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log(`Saving ${availablePlayers.length} players for auction ${auctionId}`);
    
    // Delete existing players first
    await sql`DELETE FROM available_players WHERE auction_id = ${auctionId}`;
    
    // Process players in batches to avoid query size limits
    const BATCH_SIZE = 100;
    let successCount = 0;
    
    for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
      const batch = availablePlayers.slice(i, i + BATCH_SIZE);
      try {
        // Start a transaction for this batch
        await sql`BEGIN`;
        
        for (const player of batch) {
          // Insert each player individually
          await sql`
            INSERT INTO available_players (
              player_id, auction_id, full_name, position, team, years_exp
            )
            VALUES (
              ${player.player_id},
              ${auctionId},
              ${player.full_name || 'Unknown Player'},
              ${player.position || 'UNKNOWN'},
              ${player.team || null},
              ${player.years_exp || 0}
            )
            ON CONFLICT (player_id, auction_id) 
            DO UPDATE SET
              full_name = ${player.full_name || 'Unknown Player'},
              position = ${player.position || 'UNKNOWN'},
              team = ${player.team || null},
              years_exp = ${player.years_exp || 0}
          `;
          successCount++;
        }
        
        // Commit this batch
        await sql`COMMIT`;
        console.log(`Successfully saved batch ${i/BATCH_SIZE + 1}/${Math.ceil(availablePlayers.length/BATCH_SIZE)}`);
      } catch (batchError) {
        // Rollback on batch error
        await sql`ROLLBACK`;
        console.error(`Error saving player batch ${i/BATCH_SIZE + 1}:`, batchError);
      }
    }
    
    // Also update the auction to store the number of available players
    await sql`
      UPDATE auctions 
      SET settings = settings || jsonb_build_object('availablePlayersCount', ${successCount})
      WHERE id = ${auctionId}
    `;
    
    return res.status(200).json({ 
      success: true,
      message: `Saved ${successCount} of ${availablePlayers.length} players`
    });
  } catch (error) {
    console.error('Error updating available players:', error);
    return res.status(500).json({ 
      message: 'Failed to update available players',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}