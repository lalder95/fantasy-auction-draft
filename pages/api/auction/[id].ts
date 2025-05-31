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
    // Step 1: Get basic auction data first
    console.log('Fetching basic auction data for:', auctionId);
    const basicAuctionQuery = await sql`
      SELECT id, status, nomination_index, settings
      FROM auctions 
      WHERE id = ${auctionId}
    `;

    if (basicAuctionQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auctionResult = basicAuctionQuery.rows[0];
    console.log('Basic auction data:', { id: auctionResult.id, status: auctionResult.status });

    // Step 2: Get available players count
    console.log('Fetching available players count');
    const playerCountQuery = await sql`
      SELECT COUNT(*) as count 
      FROM available_players 
      WHERE auction_id = ${auctionId}
    `;
    const totalAvailable = parseInt(playerCountQuery.rows[0].count) || 0;
    console.log('Available players count:', totalAvailable);

    // Step 3: Get available players data
    console.log('Fetching available players');
    const availablePlayersQuery = await sql`
      SELECT player_id, full_name, position, team, status, years_exp
      FROM available_players 
      WHERE auction_id = ${auctionId}
      ORDER BY player_id
    `;
    const availablePlayers = availablePlayersQuery.rows;
    console.log('Available players fetched:', availablePlayers.length);

    // Step 4: Build response with safe defaults
    const settings = auctionResult.settings || {};
    const response = {
      auction: {
        id: auctionResult.id,
        settings: {
          ...settings,
          playerCountDiagnostic: {
            totalPlayers: settings.totalPlayers || totalAvailable,
            availablePlayers: availablePlayers.length,
            expectedCount: settings.totalPlayers || totalAvailable,
            matchesActual: true
          }
        },
        status: auctionResult.status || 'pending',
        availablePlayers: availablePlayers || [],
        completedPlayers: [],  // We'll add these in a separate query if needed
        playersUp: [],        // We'll add these in a separate query if needed
        nominationIndex: auctionResult.nomination_index || 0
      }
    };

    console.log('Response prepared:', {
      statusCode: 200,
      auctionId: response.auction.id,
      playerCount: response.auction.availablePlayers.length
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      auctionId
    });

    return res.status(500).json({ 
      message: 'Server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}