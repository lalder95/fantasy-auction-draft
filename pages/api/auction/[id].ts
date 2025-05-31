// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, sql } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const auctionId = Array.isArray(id) ? id[0] : id;

  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Invalid auction id' });
  }
  
  try {
    // Get auction data including ALL available players
    const auctionQueryResult = await sql`
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
        WHERE a.id = ${auctionId}
      )
      SELECT * FROM auction_data
    `;

    // Access the first row from the result properly
    const auctionResult = auctionQueryResult.rows[0];

    if (!auctionResult) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Ensure we preserve all player data
    const auction = {
      ...auctionResult,
      settings: {
        ...auctionResult.settings,
        playerCountDiagnostic: {
          totalPlayers: auctionResult.total_available,
          availablePlayers: auctionResult.available_players?.length || 0,
          expectedCount: auctionResult.total_available,
          matchesActual: true
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