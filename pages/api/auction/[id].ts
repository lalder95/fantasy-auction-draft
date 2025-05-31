// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, sql } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  
  try {
    // Get auction data including ALL available players
    const [auctionResult] = await sql`
      WITH auction_data AS (
        SELECT 
          a.*,
          ap.players as available_players,
          (SELECT COUNT(*) FROM available_players WHERE auction_id = a.id) as total_available
        FROM auctions a
        LEFT JOIN LATERAL (
          SELECT json_agg(ap.*) as players
          FROM available_players ap
          WHERE ap.auction_id = a.id
        ) ap ON true
        WHERE a.id = ${id}
      )
      SELECT * FROM auction_data
    `;

    if (!auctionResult) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Ensure we preserve the total player count from settings
    const auction = {
      ...auctionResult,
      settings: {
        ...auctionResult.settings,
        playerCountDiagnostic: {
          totalPlayers: auctionResult.settings.totalPlayers || auctionResult.total_available,
          availablePlayers: auctionResult.total_available,
          expectedCount: auctionResult.settings.totalPlayers,
          matchesActual: auctionResult.total_available === auctionResult.settings.totalPlayers
        }
      },
      availablePlayers: auctionResult.available_players || []
    };

    return res.status(200).json({ auction });
  } catch (error) {
    console.error('Error fetching auction:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch auction',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}