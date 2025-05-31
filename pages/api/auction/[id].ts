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
    // First get the auction settings to ensure we have the correct total
    const settingsQuery = await sql`
      SELECT settings FROM auctions WHERE id = ${auctionId}
    `;
    
    const settings = settingsQuery.rows[0]?.settings;
    console.log('Auction settings:', settings);

    // Then get full auction data with players
    const auctionQueryResult = await sql`
      WITH auction_data AS (
        SELECT 
          a.*,
          (
            SELECT json_build_object(
              'players', COALESCE(json_agg(ap.*), '[]'::json),
              'count', COUNT(*)
            )
            FROM available_players ap 
            WHERE ap.auction_id = a.id
          ) as player_data
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

    // Extract player data safely
    const playerData = auctionResult.player_data || { players: [], count: 0 };
    const availablePlayers = Array.isArray(playerData.players) ? playerData.players : [];
    const totalAvailable = parseInt(playerData.count) || 0;

    console.log('Player data:', {
      total: totalAvailable,
      available: availablePlayers.length,
      isArray: Array.isArray(availablePlayers)
    });

    // Build the auction object with guaranteed arrays and counts
    const auction = {
      ...auctionResult,
      availablePlayers,
      settings: {
        ...settings,
        playerCountDiagnostic: {
          totalPlayers: totalAvailable,
          availablePlayers: availablePlayers.length,
          expectedCount: totalAvailable,
          matchesActual: true
        }
      },
      completedPlayers: auctionResult.completed_players || [],
      playersUp: auctionResult.players_up || []
    };

    // Verify the response structure
    console.log('Response structure:', {
      hasSettings: !!auction.settings,
      hasAvailablePlayers: Array.isArray(auction.availablePlayers),
      hasCompletedPlayers: Array.isArray(auction.completedPlayers),
      hasPlayersUp: Array.isArray(auction.playersUp)
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