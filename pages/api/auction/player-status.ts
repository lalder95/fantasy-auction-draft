// pages/api/auction/player-stats.ts
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
    
    // Count available players
    const availablePlayersResult = await sql`
      SELECT COUNT(*) as count FROM available_players WHERE auction_id = ${auctionId}
    `;
    const availablePlayersCount = availablePlayersResult[0]?.count || 0;
    
    // Count players up for auction
    const playersUpResult = await sql`
      SELECT COUNT(*) as count FROM players_up WHERE auction_id = ${auctionId}
    `;
    const playersUpCount = playersUpResult[0]?.count || 0;
    
    // Count completed players
    const completedPlayersResult = await sql`
      SELECT COUNT(*) as count FROM completed_players WHERE auction_id = ${auctionId}
    `;
    const completedPlayersCount = completedPlayersResult[0]?.count || 0;
    
    // Get total players ever added to this auction
    const totalPlayersResult = await sql`
      SELECT 
        COALESCE(
          (SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}),
          0
        ) +
        COALESCE(
          (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}),
          0
        ) +
        COALESCE(
          (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}),
          0
        ) AS total
    `;
    const totalPlayers = totalPlayersResult[0]?.total || 0;
    
    // Update the auction settings with the correct player counts
    await sql`
      UPDATE auctions
      SET settings = jsonb_set(
        jsonb_set(
          settings, 
          '{totalPlayers}', 
          to_jsonb(${totalPlayers}::int)
        ),
        '{availablePlayersCount}', 
        to_jsonb(${availablePlayersCount}::int)
      )
      WHERE id = ${auctionId}
    `;
    
    return res.status(200).json({
      success: true,
      availablePlayers: availablePlayersCount,
      playersUp: playersUpCount,
      completedPlayers: completedPlayersCount,
      totalPlayers: totalPlayers
    });
  } catch (error) {
    console.error('Error getting player stats:', error);
    return res.status(500).json({
      message: 'Failed to get player statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}