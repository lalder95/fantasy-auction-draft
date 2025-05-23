// pages/api/auction/players.ts - Complete updated version with status field
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
  
  // Create a connection pool for better concurrency handling
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
    
    // Verify auction exists before proceeding
    const auctionResult = await client.query(
      'SELECT id, settings FROM auctions WHERE id = $1', 
      [auctionId]
    );
    
    if (!auctionResult.rows || auctionResult.rows.length === 0) {
      await client.release();
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Record the expected player count for future verification
    const expectedPlayerCount = availablePlayers.length;
    
    // Log the total players we're about to process
    console.log(`Processing ${expectedPlayerCount} players for auction ${auctionId}`);
    
    if (availablePlayers.length > 0) {
      // Start a SINGLE transaction for the entire operation
      await client.query('BEGIN');
      
      try {
        // Clear existing players for this auction if we have players to add
        await client.query(
          'DELETE FROM available_players WHERE auction_id = $1', 
          [auctionId]
        );
        
        // Process in batches for better performance
        const BATCH_SIZE = 200; // Larger batch for better throughput
        let successCount = 0;
        let errorCount = 0;
        
        // Prepare parameterized query - now includes status field
        const insertQuery = `
          INSERT INTO available_players (
            player_id, auction_id, full_name, position, team, status, years_exp
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (player_id, auction_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            position = EXCLUDED.position,
            team = EXCLUDED.team,
            status = EXCLUDED.status,
            years_exp = EXCLUDED.years_exp
        `;
        
        // Process all players in batches but in a single transaction
        for (let i = 0; i < availablePlayers.length; i += BATCH_SIZE) {
          const batch = availablePlayers.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(availablePlayers.length / BATCH_SIZE);
          
          console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} players)`);
          
          // Process each player in the batch
          for (const player of batch) {
            try {
              // Skip invalid players
              if (!player || typeof player !== 'object' || !player.player_id) {
                console.warn(`Skipping invalid player in batch ${batchNum}`);
                errorCount++;
                continue;
              }
              
              // Clean and sanitize player data
              const playerId = String(player.player_id || '').slice(0, 100);
              const fullName = String(player.full_name || 'Unknown Player').slice(0, 200);
              const position = String(player.position || 'UNKNOWN').slice(0, 10);
              const team = player.team ? String(player.team).slice(0, 10) : null;
              const status = String(player.status || 'Active').slice(0, 50); // Include status field
              const yearsExp = typeof player.years_exp === 'number' ? 
                player.years_exp : 
                (parseInt(String(player.years_exp || '0')) || 0);
              
              await client.query(insertQuery, [
                playerId,
                auctionId,
                fullName,
                position,
                team,
                status, // Include status in parameters
                yearsExp
              ]);
              
              successCount++;
            } catch (playerError) {
              console.error(`Error inserting player in batch ${batchNum}:`, playerError);
              errorCount++;
              // Continue processing other players instead of failing the whole batch
            }
          }
          
          // Log batch completion but DO NOT commit yet
          console.log(`Completed batch ${batchNum}/${totalBatches}: ${successCount} successful, ${errorCount} errors so far`);
        }
        
        // After all players are processed, verify the counts before committing
        const verificationResult = await client.query(
          'SELECT COUNT(*) as count FROM available_players WHERE auction_id = $1',
          [auctionId]
        );
        
        const actualCount = parseInt(verificationResult.rows[0].count);
        
        if (actualCount !== successCount) {
          console.error(`Count verification failed: Expected ${successCount}, got ${actualCount}`);
          // Still proceed with commit since the database count is what matters
        }
        
        // Store the EXPECTED player count in auction settings
        // This is the key change - we record how many players were supposed to be added
        await client.query(
          `UPDATE auctions 
           SET settings = jsonb_set(
             jsonb_set(
               jsonb_set(
                 settings, 
                 '{availablePlayersCount}', 
                 $1::text::jsonb
               ),
               '{totalPlayers}', 
               $2::text::jsonb
             ),
             '{expectedPlayerCount}', 
             $3::text::jsonb
           )
           WHERE id = $4`,
          [
            actualCount.toString(),
            actualCount.toString(),
            expectedPlayerCount.toString(),
            auctionId
          ]
        );
        
        // Now commit the entire transaction
        await client.query('COMMIT');
        
        console.log(`Successfully imported ${actualCount} players for auction ${auctionId}`);
        console.log(`Stored expected player count (${expectedPlayerCount}) in auction settings`);
        
        // Success response with detailed counts
        return res.status(200).json({
          success: true,
          message: `Processed ${successCount + errorCount} players: ${successCount} successful, ${errorCount} errors`,
          successCount,
          errorCount,
          actualCount,
          expectedPlayerCount
        });
      } catch (error) {
        // Roll back the entire transaction if any part fails
        console.error('Error in player import transaction:', error);
        await client.query('ROLLBACK');
        
        return res.status(500).json({ 
          message: 'Failed to import players - transaction rolled back',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      // No players to add - just return success
      return res.status(200).json({
        success: true,
        message: 'No players to process',
        successCount: 0,
        errorCount: 0,
        expectedPlayerCount: 0
      });
    }
  } catch (error) {
    console.error('Unexpected error updating available players:', error);
    
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
    // Always release the client
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