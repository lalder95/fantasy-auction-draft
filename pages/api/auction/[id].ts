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
    console.log('Fetching auction data for:', auctionId);
    
    // Get auction data including ALL available players
    const auctionQueryResult = await sql`
      WITH auction_data AS (
        SELECT 
          a.*,
          COALESCE(
            (SELECT json_agg(ap.*)
             FROM available_players ap 
             WHERE ap.auction_id = a.id), 
            '[]'::json
          ) as available_players,
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
      console.log('No auction found for ID:', auctionId);
      return res.status(404).json({ message: 'Auction not found' });
    }

    console.log('Raw auction data:', {
      hasSettings: !!auctionResult.settings,
      totalAvailable: auctionResult.total_available,
      availablePlayersType: typeof auctionResult.available_players,
      isArray: Array.isArray(auctionResult.available_players)
    });

    // Ensure available_players is always an array with proper initialization
    const availablePlayers = auctionResult.available_players 
      ? (Array.isArray(auctionResult.available_players) 
          ? auctionResult.available_players 
          : JSON.parse(auctionResult.available_players)) 
      : [];

    // Force the type to be an array if it's not
    const safeAvailablePlayers = Array.isArray(availablePlayers) ? availablePlayers : [];
    
    const totalPlayers = parseInt(auctionResult.total_available) || 0;

    // Build the auction object with guaranteed array for availablePlayers
    const auction = {
      ...auctionResult,
      availablePlayers: safeAvailablePlayers,
      settings: {
        ...auctionResult.settings,
        playerCountDiagnostic: {
          totalPlayers,
          availablePlayers: safeAvailablePlayers.length,
          expectedCount: totalPlayers,
          matchesActual: safeAvailablePlayers.length === totalPlayers
        }
      }
    };

    console.log('Processed auction data:', {
      totalPlayers,
      availablePlayersLength: safeAvailablePlayers.length,
      hasSettings: !!auction.settings
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