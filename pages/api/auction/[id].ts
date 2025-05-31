// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

const log = (msg: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const logData = data ? `: ${JSON.stringify(data, null, 2)}` : '';
    console.log(`[${timestamp}] ${msg}${logData}`);
  } catch (e) {
    console.error('Logging failed:', e);
  }
};

interface AuctionResponse {
  auction: {
    id: string;
    status: string;
    settings: Record<string, any>;
    nominationIndex: number;
    availablePlayers: any[];
    completedPlayers: any[];
    playersUp: any[];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuctionResponse | { error: string; message?: string }>
) {
  try {
    const auctionId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

    if (!auctionId) {
      log('Missing auction ID', req.query);
      return res.status(400).json({ error: 'Missing auction ID' });
    }

    log('Processing request', { auctionId });

    const result = await sql`
      SELECT 
        a.id,
        a.status,
        a.current_nomination_manager_index,
        COALESCE(a.settings, '{}'::jsonb) as settings,
        COALESCE(
          (
            SELECT json_agg(ap.*)
            FROM available_players ap
            WHERE ap.auction_id = a.id
          ),
          '[]'::jsonb
        ) as available_players,
        COALESCE(
          (
            SELECT json_agg(cp.*)
            FROM completed_players cp
            WHERE cp.auction_id = a.id
          ),
          '[]'::jsonb
        ) as completed_players,
        COALESCE(
          (
            SELECT json_agg(pu.*)
            FROM players_up pu
            WHERE pu.auction_id = a.id
          ),
          '[]'::jsonb
        ) as players_up
      FROM auctions a
      WHERE a.id = ${auctionId}
    `;

    log('Auction query result', result);

    if (!result?.rows?.length) {
      log('Auction not found', { auctionId });
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = result.rows[0];
    log('Query successful', { 
      id: auction.id, 
      status: auction.status,
      playerCounts: {
        available: auction.available_players?.length ?? 0,
        completed: auction.completed_players?.length ?? 0,
        up: auction.players_up?.length ?? 0
      }
    });

    const response: AuctionResponse = {
      auction: {
        id: auction.id,
        status: auction.status || 'setup',
        settings: auction.settings || {},
        nominationIndex: auction.current_nomination_manager_index || 0,
        availablePlayers: Array.isArray(auction.available_players) ? auction.available_players : [],
        completedPlayers: Array.isArray(auction.completed_players) ? auction.completed_players : [],
        playersUp: Array.isArray(auction.players_up) ? auction.players_up : []
      }
    };

    log('Sending response', {
      id: response.auction.id,
      playerCounts: {
        available: response.auction.availablePlayers.length,
        completed: response.auction.completedPlayers.length,
        up: response.auction.playersUp.length
      }
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.stack : String(error))
        : 'An unexpected error occurred'
    });
  }
}