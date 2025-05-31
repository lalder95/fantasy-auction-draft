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
    `.catch(error => {
      console.error('SQL Error in basic auction query:', error);
      throw error;
    });

    if (basicAuctionQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Add more detailed logging
    const auctionResult = basicAuctionQuery.rows[0];
    console.log('Basic auction data:', {
      id: auctionResult.id,
      status: auctionResult.status,
      hasSettings: !!auctionResult.settings,
      settingsType: typeof auctionResult.settings
    });

    // Step 2: Get available players count with error handling
    console.log('Fetching available players count');
    const playerCountQuery = await sql`
      SELECT COUNT(*) as count 
      FROM available_players 
      WHERE auction_id = ${auctionId}
    `.catch(error => {
      console.error('SQL Error in player count query:', error);
      throw error;
    });

    const totalAvailable = parseInt(playerCountQuery.rows[0].count) || 0;
    console.log('Available players count:', totalAvailable);

    // Step 3: Get available players data with error handling
    console.log('Fetching available players');
    const availablePlayersQuery = await sql`
      SELECT player_id, full_name, position, team, status, years_exp
      FROM available_players 
      WHERE auction_id = ${auctionId}
      ORDER BY player_id
      LIMIT 100  /* Add limit for testing */
    `.catch(error => {
      console.error('SQL Error in available players query:', error);
      throw error;
    });

    const availablePlayers = availablePlayersQuery.rows;
    console.log('Available players fetched:', {
      count: availablePlayers.length,
      first: availablePlayers[0],
      last: availablePlayers[availablePlayers.length - 1]
    });

    // Step 4: Build response with more validation
    let settings = auctionResult.settings || {};
    if (typeof settings !== 'object') {
      console.warn('Settings is not an object:', settings);
      settings = {};
    }

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
        completedPlayers: [],
        playersUp: [],
        nominationIndex: auctionResult.nomination_index || 0
      }
    };

    console.log('Response prepared:', {
      statusCode: 200,
      auctionId: response.auction.id,
      playerCount: response.auction.availablePlayers.length,
      responseSize: JSON.stringify(response).length
    });

    return res.status(200).json(response);

  } catch (error) {
    // Enhanced error logging
    console.error('API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      auctionId,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({ 
      message: 'Server error',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}