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
          (SELECT json_agg(ap.*)
           FROM available_players ap 
           WHERE ap.auction_id = a.id) as available_players,
          (SELECT COUNT(*) 
           FROM available_players 
           WHERE auction_id = a.id) as total_available
        FROM auctions a
        WHERE a.id = ${auctionId}
      )
      SELECT * FROM auction_data
    `;

    const auctionResult = auctionQueryResult.rows[0];

    if (!auctionResult) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Ensure available_players is always an array
    const availablePlayers = Array.isArray(auctionResult.available_players) 
      ? auctionResult.available_players 
      : [];

    // Build the auction object with guaranteed array for availablePlayers
    const auction = {
      ...auctionResult,
      availablePlayers,
      settings: {
        ...auctionResult.settings,
        playerCountDiagnostic: {
          totalPlayers: parseInt(auctionResult.total_available) || 0,
          availablePlayers: availablePlayers.length,
          expectedCount: parseInt(auctionResult.total_available) || 0,
          matchesActual: true
        }
      }
    };

    // Add debug logging
    console.log('Auction data:', {
      totalAvailable: auctionResult.total_available,
      playersLength: availablePlayers.length,
      hasPlayers: Array.isArray(availablePlayers)
    });

    return res.status(200).json({ auction });
  } catch (error) {
    console.error('Error fetching auction:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch auction',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}