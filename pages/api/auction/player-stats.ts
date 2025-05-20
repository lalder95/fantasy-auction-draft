// pages/api/auction/player-stats.ts - Updated with verification
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
    
    // SINGLE QUERY to get ALL player counts in one atomic operation
    const playerCounts = await sql`
      SELECT
        (SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}) AS available_count,
        (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) AS players_up_count,
        (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}) AS completed_count,
        (
          (SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}) +
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
    
    if (expectedPlayerCount !== null && availableCount !== Number(expectedPlayerCount)) {
      console.log(`MISMATCH DETECTED: Expected ${expectedPlayerCount} available players, found ${availableCount}`);
      console.log(`Using expected player count from auction settings instead`);
      
      // Use the expected count from settings
      const correctedTotal = Number(expectedPlayerCount) + playersUpCount + completedCount;
      
      // Update the auction settings with the corrected player counts
      await sql`
        UPDATE auctions
        SET settings = jsonb_set(
          jsonb_set(
            settings, 
            '{totalPlayers}', 
            to_jsonb(${correctedTotal}::int)
          ),
          '{availablePlayersCount}', 
          to_jsonb(${expectedPlayerCount}::int)
        )
        WHERE id = ${auctionId}
      `;
      
      console.log(`Corrected counts: Available=${expectedPlayerCount}, Total=${correctedTotal}`);
      
      // Return the corrected counts
      return res.status(200).json({
        success: true,
        availablePlayers: Number(expectedPlayerCount),
        playersUp: playersUpCount,
        completedPlayers: completedCount,
        totalPlayers: correctedTotal,
        corrected: true
      });
    } else {
      // Update the auction settings with the counts from the query
      await sql`
        UPDATE auctions
        SET settings = jsonb_set(
          jsonb_set(
            settings, 
            '{totalPlayers}', 
            to_jsonb(${totalCount}::int)
          ),
          '{availablePlayersCount}', 
          to_jsonb(${availableCount}::int)
        )
        WHERE id = ${auctionId}
      `;
      
      console.log(`Player count results for auction ${auctionId}:`, {
        available: availableCount,
        playersUp: playersUpCount,
        completed: completedCount,
        total: totalCount
      });
      
      return res.status(200).json({
        success: true,
        availablePlayers: availableCount,
        playersUp: playersUpCount,
        completedPlayers: completedCount,
        totalPlayers: totalCount,
        corrected: false
      });
    }
  } catch (error) {
    console.error('Error getting player stats:', error);
    return res.status(500).json({
      message: 'Failed to get player statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}