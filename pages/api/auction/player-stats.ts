// pages/api/auction/player-stats.ts - Simplified direct approach
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
    
    // First verify the auction exists
    const auctionCheck = await sql`
      SELECT id FROM auctions WHERE id = ${auctionId}
    `;
    
    if (auctionCheck.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // SINGLE QUERY to get ALL player counts in one atomic operation
    // This prevents inconsistencies between separate count queries
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
    
    // Update the auction settings with the correct player counts from this single atomic operation
    await sql`
      UPDATE auctions
      SET settings = jsonb_set(
        jsonb_set(
          settings, 
          '{totalPlayers}', 
          to_jsonb(${counts.total_count}::int)
        ),
        '{availablePlayersCount}', 
        to_jsonb(${counts.available_count}::int)
      )
      WHERE id = ${auctionId}
    `;
    
    // Log the counts we're returning to help with debugging
    console.log(`Player count results for auction ${auctionId}:`, {
      available: counts.available_count,
      playersUp: counts.players_up_count,
      completed: counts.completed_count,
      total: counts.total_count
    });
    
    return res.status(200).json({
      success: true,
      availablePlayers: Number(counts.available_count),
      playersUp: Number(counts.players_up_count),
      completedPlayers: Number(counts.completed_count),
      totalPlayers: Number(counts.total_count)
    });
  } catch (error) {
    console.error('Error getting player stats:', error);
    return res.status(500).json({
      message: 'Failed to get player statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}