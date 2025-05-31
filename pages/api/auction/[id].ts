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
    const settingsQuery = await sql`
      SELECT settings FROM auctions WHERE id = ${auctionId}
    `;
    
    const settings = settingsQuery.rows[0]?.settings || {};
    console.log('Auction settings:', settings);

    // Then get full auction data with players
    const auctionQueryResult = await sql`
      WITH auction_data AS (
        SELECT 
          a.*,
          COALESCE(
            (
              SELECT json_build_object(
                'players', COALESCE(json_agg(ap.*), '[]'::json),
                'count', COUNT(*)
              )
              FROM available_players ap 
              WHERE ap.auction_id = a.id
            ),
            '{"players": [], "count": 0}'::json
          ) as player_data,
          COALESCE(
            (SELECT json_agg(cp.*) FROM completed_players cp WHERE cp.auction_id = a.id),
            '[]'::json
          ) as completed_players,
          COALESCE(
            (SELECT json_agg(pu.*) FROM players_up pu WHERE pu.auction_id = a.id),
            '[]'::json
          ) as players_up
        FROM auctions a
        WHERE a.id = ${auctionId}
      )
      SELECT * FROM auction_data
    `;

    const auctionResult = auctionQueryResult.rows[0];

    if (!auctionResult) {
      console.log('No auction found for ID:', auctionId);
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Extract and validate all arrays
    const playerData = auctionResult.player_data || { players: [], count: 0 };
    const availablePlayers = Array.isArray(playerData.players) ? playerData.players : [];
    const completedPlayers = Array.isArray(auctionResult.completed_players) ? auctionResult.completed_players : [];
    const playersUp = Array.isArray(auctionResult.players_up) ? auctionResult.players_up : [];
    const totalAvailable = parseInt(playerData.count) || 0;

    // Build the auction object with guaranteed arrays
    const auction = {
      ...auctionResult,
      availablePlayers,
      completedPlayers,
      playersUp,
      settings: {
        ...settings,
        totalPlayers: settings.totalPlayers || totalAvailable,
        playerCountDiagnostic: {
          totalPlayers: totalAvailable,
          availablePlayers: availablePlayers.length,
          expectedCount: settings.totalPlayers || totalAvailable,
          matchesActual: true
        }
      }
    };

    // Debug logging
    console.log('Arrays in response:', {
      availablePlayers: availablePlayers.length,
      completedPlayers: completedPlayers.length,
      playersUp: playersUp.length,
      totalPlayers: auction.settings.totalPlayers
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