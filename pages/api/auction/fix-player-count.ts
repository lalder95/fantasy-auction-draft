// pages/api/auction/fix-player-count.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { auctionId } = req.body;

  try {
    // Get all players without LIMIT
    const availablePlayers = await sql`
      SELECT * FROM available_players 
      WHERE auction_id = ${auctionId}
      ORDER BY player_id`;
    
    // Get the current auction to ensure we update settings
    const auctionResultQuery = await sql`
      SELECT settings FROM auctions 
      WHERE id = ${auctionId}`;
    const auctionResult = auctionResultQuery.rows[0];
    
    if (!auctionResult) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const settings = auctionResult.settings;
    const counts = {
      available: availablePlayers.rowCount,
      total: availablePlayers.rowCount
    };

    // Update the auction settings with the correct count
    await sql`
      UPDATE auctions 
      SET settings = jsonb_set(
        settings::jsonb, 
        '{playerCountDiagnostic}',
        ${JSON.stringify({
          totalPlayers: counts.total,
          availablePlayers: counts.available,
          expectedCount: counts.total,
          matchesActual: true
        })}::jsonb
      )
      WHERE id = ${auctionId}`;

    return res.status(200).json({ 
      success: true, 
      counts,
      message: 'Player counts verified',
      players: availablePlayers.rows
    });
  } catch (error) {
    console.error('Error fixing player count:', error);
    return res.status(500).json({ 
      message: 'Failed to fix player count',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}