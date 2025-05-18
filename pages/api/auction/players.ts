// pages/api/auction/players.ts - Complete rewrite with raw queries
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

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
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ message: 'DATABASE_URL environment variable is not set' });
  }
  
  // Create a standard pg pool instead of neon
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  let client;
  
  try {
    client = await pool.connect();
    
    // Verify auction exists
    const auctionResult = await client.query(
      'SELECT id FROM auctions WHERE id = $1', 
      [auctionId]
    );
    
    if (!auctionResult.rows || auctionResult.rows.length === 0) {
      await client.release();
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log(`Processing ${availablePlayers.length} players for auction ${auctionId}`);
    
    // Clear existing players for this auction
    await client.query(
      'DELETE FROM available_players WHERE auction_id = $1', 
      [auctionId]
    );
    
    // Process in smaller batches
    const BATCH_SIZE = 20; // Even smaller batch size
    let successCount = 0;
    let errorCount = 0;
    let lastError = null;
    
    for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
      const batch = availablePlayers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(availablePlayers.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} players)`);
      
      // For each player in the batch, do individual inserts
      for (let j = 0; j < batch.length; j++) {
        try {
          const player = batch[j];
          
          // Skip invalid players
          if (!player || typeof player !== 'object' || !player.player_id) {
            console.warn(`Skipping invalid player at index ${i + j}`);
            errorCount++;
            continue;
          }
          
          // Clean and sanitize player data
          const playerId = String(player.player_id || '').slice(0, 100);
          const fullName = String(player.full_name || 'Unknown Player').slice(0, 200);
          const position = String(player.position || 'UNKNOWN').slice(0, 10);
          const team = player.team ? String(player.team).slice(0, 10) : null;
          const yearsExp = typeof player.years_exp === 'number' ? 
            player.years_exp : 
            (parseInt(String(player.years_exp || '0')) || 0);
          
          // Use a simple INSERT query with positional parameters
          const query = `
            INSERT INTO available_players (
              player_id, 
              auction_id, 
              full_name, 
              position, 
              team, 
              years_exp
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (player_id, auction_id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              position = EXCLUDED.position,
              team = EXCLUDED.team,
              years_exp = EXCLUDED.years_exp
          `;
          
          await client.query(query, [
            playerId,
            auctionId,
            fullName,
            position,
            team, 
            yearsExp
          ]);
          
          successCount++;
        } catch (playerError) {
          // Log the error but continue with other players
          console.error(`Error inserting player at index ${i + j}:`, playerError);
          try {
            console.error('Problematic player data:', JSON.stringify(batch[j]));
          } catch (e) {
            console.error('Could not stringify player data');
          }
          lastError = playerError;
          errorCount++;
        }
      }
      
      console.log(`Completed batch ${batchNum}/${totalBatches}: ${successCount} successful, ${errorCount} errors`);
    }
    
    // Update auction with player count even if some failed
    if (successCount > 0) {
      try {
        await client.query(
          `UPDATE auctions 
           SET settings = settings || jsonb_build_object('availablePlayersCount', $1)
           WHERE id = $2`,
          [successCount, auctionId]
        );
      } catch (e) {
        console.error('Error updating player count in auction settings:', e);
      }
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
  } finally {
    // Make sure to release the client
    if (client) {
      client.release();
    }
    
    // Close the pool
    try {
      await pool.end();
    } catch (e) {
      console.error('Error closing database pool:', e);
    }
  }
}