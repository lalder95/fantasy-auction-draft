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
    // Step 1: Get settings
    console.log('Fetching settings for auction:', auctionId);
    const settingsQuery = await sql`
      SELECT settings FROM auctions WHERE id = ${auctionId}
    `;
    
    const settings = settingsQuery.rows[0]?.settings || {};
    console.log('Auction settings:', settings);

    // Step 2: Get auction data
    console.log('Fetching auction data');
    const auctionQueryResult = await sql`
      WITH auction_data AS (
        SELECT 
          a.id,
          a.status,
          a.nomination_index,
          a.settings,
          COALESCE(
            (
              SELECT jsonb_build_object(
                'players', COALESCE(jsonb_agg(
                  jsonb_build_object(
                    'player_id', ap.player_id,
                    'full_name', ap.full_name,
                    'position', ap.position,
                    'team', ap.team,
                    'status', ap.status,
                    'years_exp', ap.years_exp
                  )
                  ORDER BY ap.player_id
                ), '[]'::jsonb),
                'count', COUNT(*)
              )
              FROM available_players ap 
              WHERE ap.auction_id = a.id
            ),
            '{"players": [], "count": 0}'::jsonb
          ) as player_data,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'player_id', cp.player_id,
                  'full_name', cp.full_name,
                  'position', cp.position,
                  'team', cp.team,
                  'status', cp.status
                )
              )
              FROM completed_players cp 
              WHERE cp.auction_id = a.id
            ),
            '[]'::jsonb
          ) as completed_players,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'player_id', pu.player_id,
                  'full_name', pu.full_name,
                  'position', pu.position,
                  'team', pu.team,
                  'status', pu.status
                )
              )
              FROM players_up pu 
              WHERE pu.auction_id = a.id
            ),
            '[]'::jsonb
          ) as players_up
        FROM auctions a
        WHERE a.id = ${auctionId}
      )
      SELECT * FROM auction_data
    `;

    console.log('Query completed, processing results');
    const auctionResult = auctionQueryResult.rows[0];

    if (!auctionResult) {
      console.log('No auction found');
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Step 3: Process the data
    try {
      const playerData = auctionResult.player_data || { players: [], count: 0 };
      console.log('Player data count:', playerData.count);

      const availablePlayers = Array.isArray(playerData.players) ? playerData.players : [];
      const completedPlayers = Array.isArray(auctionResult.completed_players) ? auctionResult.completed_players : [];
      const playersUp = Array.isArray(auctionResult.players_up) ? auctionResult.players_up : [];

      console.log('Arrays processed:', {
        available: availablePlayers.length,
        completed: completedPlayers.length,
        up: playersUp.length
      });

      // Step 4: Build response
      const response = {
        auction: {
          id: auctionResult.id,
          settings: {
            ...settings,
            playerCountDiagnostic: {
              totalPlayers: settings.totalPlayers || playerData.count,
              availablePlayers: availablePlayers.length,
              expectedCount: settings.totalPlayers || playerData.count,
              matchesActual: true
            }
          },
          status: auctionResult.status || 'pending',
          availablePlayers,
          completedPlayers,
          playersUp,
          nominationIndex: auctionResult.nomination_index || 0
        }
      };

      return res.status(200).json(response);
    } catch (processingError) {
      console.error('Error processing auction data:', processingError);
      return res.status(500).json({
        message: 'Error processing auction data',
        error: processingError instanceof Error ? processingError.message : String(processingError)
      });
    }

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ 
      message: 'Database error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}