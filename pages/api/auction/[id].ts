// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

// Add error handling to the logger itself
const log = (msg: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const logData = data ? `: ${JSON.stringify(data, null, 2)}` : '';
    console.log(`[${timestamp}] ${msg}${logData}`);
  } catch (e) {
    console.error('Logging failed:', e);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Wrap everything in a try-catch to catch initialization errors
  try {
    // Get and validate auction ID
    const auctionId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    
    if (!auctionId) {
      log('Missing auction ID', req.query);
      return res.status(400).json({ error: 'Missing auction ID' });
    }

    log('Processing request', { auctionId });

    // Get auction data with all related information in a single query
    const result = await sql`
      SELECT 
        a.id,
        a.status,
        a.current_nomination_manager_index,
        a.settings,
        (
          SELECT json_agg(ap.*)
          FROM available_players ap
          WHERE ap.auction_id = a.id
        ) as available_players,
        (
          SELECT json_agg(cp.*)
          FROM completed_players cp
          WHERE cp.auction_id = a.id
        ) as completed_players,
        (
          SELECT json_agg(pu.*)
          FROM players_up pu
          WHERE pu.auction_id = a.id
        ) as players_up
      FROM auctions a
      WHERE a.id = ${auctionId}
    `;

    if (!result?.rows?.length) {
      log('Auction not found', { auctionId });
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = result.rows[0];
    log('Query successful', { 
      id: auction.id, 
      status: auction.status,
      playerCounts: {
        available: auction.available_players?.length || 0,
        completed: auction.completed_players?.length || 0,
        up: auction.players_up?.length || 0
      }
    });

    // Format response
    const response = {
      auction: {
        id: auction.id,
        status: auction.status,
        settings: auction.settings || {},
        nominationIndex: auction.current_nomination_manager_index,
        availablePlayers: auction.available_players || [],
        completedPlayers: auction.completed_players || [],
        playersUp: auction.players_up || []
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    log('Error in handler', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : String(error)
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' 
        ? error instanceof Error ? error.message : String(error)
        : 'An unexpected error occurred'
    });
  }
}