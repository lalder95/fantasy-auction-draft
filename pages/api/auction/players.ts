// pages/api/auction/players.ts - Complete rewrite with better batch processing
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Configure for larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
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
    },
    max: 20, // Increase connection pool for better concurrency
    idleTimeoutMillis: 30000, // Keep connections open longer
    connectionTimeoutMillis: 10000 // Wait longer for connections
  });
  
  let client;
  
  try {
    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    // Verify auction exists
    const auctionResult = await client.query(
      'SELECT id FROM auctions WHERE id = $1', 
      [auctionId]
    );
    
    if (!auctionResult.rows || auctionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      await client.release();
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log(`Processing ${availablePlayers.length} players for auction ${auctionId}`);
    
    // Clear existing players for this auction - but only if this is a full replacement
    // and we have players to add
    if (availablePlayers.length > 0) {
      await client.query(
        'DELETE FROM available_players WHERE auction_id = $1', 
        [auctionId]
      );
    }
    
    // Process in larger batches
    const BATCH_SIZE = 100; // Larger batch size for better performance
    let successCount = 0;
    let errorCount = 0;
    let lastError = null;
    
    // Prepare single parameterized query - much more efficient
    const insertQuery = `
      INSERT INTO available_players (
        player_id, auction_id, full_name, position, team, years_exp
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (player_id, auction_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        position = EXCLUDED.position,
        team = EXCLUDED.team,
        years_exp = EXCLUDED.years_exp
    `;
    
    for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
      const batch = availablePlayers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(availablePlayers.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} players)`);
      
      // Create a batch insert
      try {
        // For each player in the batch
        for (const player of batch) {
          try {
            // Skip invalid players
            if (!player || typeof player !== 'object' || !player.player_id) {
              console.warn(`Skipping invalid player`);
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
            
            await client.query(insertQuery, [
              playerId,
              auctionId,
              fullName,
              position,
              team, 
              yearsExp
            ]);
            
            successCount++;
          } catch (playerError) {
            console.error(`Error inserting player:`, playerError);
            errorCount++;
            lastError = playerError;
          }
        }
      } catch (batchError) {
        console.error(`Error processing batch ${batchNum}:`, batchError);
        errorCount += batch.length;
        lastError = batchError;
      }
      
      // Commit after each batch to avoid transaction timeout
      try {
        await client.query('COMMIT');
        await client.query('BEGIN'); // Start a new transaction for the next batch
      } catch (txError) {
        console.error(`Transaction error on batch ${batchNum}:`, txError);
        // Try to continue anyway
      }
      
      console.log(`Completed batch ${batchNum}/${totalBatches}: ${successCount} successful, ${errorCount} errors`);
    }
    
    // Final commit
    await client.query('COMMIT');
    
    // Update auction with player count even if some failed
    if (successCount > 0) {
      try {
        // Store both the total count and available count
        await client.query(
          `UPDATE auctions 
           SET settings = settings || 
             jsonb_build_object(
               'availablePlayersCount', $1::int,
               'totalPlayers', $1::int
             )
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
    // Try to rollback if possible
    try {
      if (client) {
        await client.query('ROLLBACK');
      }
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
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