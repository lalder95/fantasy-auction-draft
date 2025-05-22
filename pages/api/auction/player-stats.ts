// pages/api/auction/player-stats.ts - Enhanced with verification and correction
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { auctionId } = req.query;
  
  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Auction ID is required' });
  }
  
  try {
    // Get database connection
    const sql = neon(process.env.DATABASE_URL || '');
    
    // First verify the auction exists and get settings
    const auctionCheck = await sql`
      SELECT id, settings FROM auctions WHERE id = ${auctionId}
    `;
    
    if (auctionCheck.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Check if we have an expected player count stored
    const settings = auctionCheck[0].settings;
    const expectedPlayerCount = settings.expectedPlayerCount || null;
    
    console.log(`Auction ${auctionId} - Expected player count from settings: ${expectedPlayerCount !== null ? expectedPlayerCount : 'Not set'}`);
    
    // First, clean up any duplicate records
    const duplicatesRemoved = await sql`
      WITH duplicates AS (
        SELECT player_id, 
               ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY player_id) as rn
        FROM available_players
        WHERE auction_id = ${auctionId}
      )
      DELETE FROM available_players
      WHERE auction_id = ${auctionId}
        AND player_id IN (
          SELECT player_id FROM duplicates WHERE rn > 1
        )
      RETURNING player_id
    `;
    
    if (duplicatesRemoved.length > 0) {
      console.log(`Removed ${duplicatesRemoved.length} duplicate player records from auction ${auctionId}`);
    }
    
    // SINGLE QUERY to get ALL player counts in one atomic operation
    const playerCounts = await sql`
      SELECT
        (SELECT COUNT(DISTINCT player_id) FROM available_players WHERE auction_id = ${auctionId}) AS available_count,
        (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) AS players_up_count,
        (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}) AS completed_count,
        (
          (SELECT COUNT(DISTINCT player_id) FROM available_players WHERE auction_id = ${auctionId}) +
          (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) +
          (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId})
        ) AS total_count
    `;
    
    if (!playerCounts || playerCounts.length === 0) {
      return res.status(404).json({ message: 'Failed to retrieve player counts' });
    }
    
    const counts = playerCounts[0];
    
    // Convert to numbers consistently
    const availableCount = Number(counts.available_count);
    const playersUpCount = Number(counts.players_up_count);
    const completedCount = Number(counts.completed_count);
    const totalCount = Number(counts.total_count);
    
    // Check if there's a mismatch with expected count and fix it if necessary
    let corrected = false;
    let finalAvailableCount = availableCount;
    let finalTotalCount = totalCount;
    
    if (expectedPlayerCount !== null && availableCount !== Number(expectedPlayerCount)) {
      console.log(`MISMATCH DETECTED: Expected ${expectedPlayerCount} available players, found ${availableCount}`);
      
      // Check if the difference is significant (more than 10% or more than 10 players)
      const difference = Math.abs(availableCount - Number(expectedPlayerCount));
      const percentDifference = (difference / Number(expectedPlayerCount)) * 100;
      
      if (percentDifference > 10 || difference > 10) {
        console.log(`Significant mismatch (${percentDifference.toFixed(1)}% / ${difference} players difference)`);
        console.log(`Using actual count from database instead of expected count`);
        
        // Update the expected count to match reality
        await sql`
          UPDATE auctions
          SET settings = jsonb_set(
            settings,
            '{expectedPlayerCount}',
            to_jsonb(${availableCount}::int)
          )
          WHERE id = ${auctionId}
        `;
      } else {
        console.log(`Minor mismatch (${percentDifference.toFixed(1)}% / ${difference} players difference)`);
        console.log(`Using expected player count from auction settings`);
        
        // Use the expected count from settings
        finalAvailableCount = Number(expectedPlayerCount);
        finalTotalCount = finalAvailableCount + playersUpCount + completedCount;
        corrected = true;
      }
    }
    
    // Update the auction settings with the counts
    await sql`
      UPDATE auctions
      SET settings = jsonb_set(
        jsonb_set(
          jsonb_set(
            settings, 
            '{totalPlayers}', 
            to_jsonb(${finalTotalCount}::int)
          ),
          '{availablePlayersCount}', 
          to_jsonb(${finalAvailableCount}::int)
        ),
        '{lastPlayerCountVerification}',
        to_jsonb(NOW()::text)
      )
      WHERE id = ${auctionId}
    `;
    
    console.log(`Player count results for auction ${auctionId}:`, {
      available: finalAvailableCount,
      playersUp: playersUpCount,
      completed: completedCount,
      total: finalTotalCount,
      corrected,
      duplicatesRemoved: duplicatesRemoved.length
    });
    
    return res.status(200).json({
      success: true,
      availablePlayers: finalAvailableCount,
      playersUp: playersUpCount,
      completedPlayers: completedCount,
      totalPlayers: finalTotalCount,
      corrected,
      duplicatesRemoved: duplicatesRemoved.length
    });
  } catch (error) {
    console.error('Error getting player stats:', error);
    return res.status(500).json({
      message: 'Failed to get player statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}