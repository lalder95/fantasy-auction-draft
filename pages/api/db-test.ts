// pages/api/db-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../lib/database-neon';

interface DbTestResponse {
  status: 'ok' | 'error';
  connectionTest?: { test: number };
  tableInfo?: {
    exists: boolean;
    auctionCount: number;
    recentAuctions: Array<{
      id: string;
      status: string;
      created_at: string;
    }>;
    details?: {
      availablePlayers: number;
      completedPlayers: number;
      playersUp: number;
      managers: number;
      settings: Record<string, any>;
    };
  };
  error?: string;
  location?: string;
}

// Database table interfaces
interface AuctionRow {
  id: string;
  created_at: Date;
  status: 'setup' | string;
  commissioner_id: string;
  current_nomination_manager_index: number;
  settings: Record<string, any>;
}

interface AvailablePlayer {
  player_id: string;
  auction_id: string;
  full_name: string;
  position: string;
  team: string | null;
  years_exp: number;
  status: string;
}

interface CompletedPlayer {
  player_id: string;
  auction_id: string;
  name: string;
  position: string;
  team: string | null;
  nominated_by: string;
  final_bid: number;
  winner: string;
  start_time: Date;
  end_time: Date;
  status: 'completed';
  nomination_index: number;
}

interface Manager {
  id: string;
  auction_id: string;
  name: string;
  roster_id: number;
  budget: number;
  initial_budget: number;
  nomination_order: number;
  avatar: string | null;
}

interface PlayerUp {
  player_id: string;
  auction_id: string;
  name: string;
  position: string;
  team: string | null;
  nominated_by: string;
  current_bid: number;
  current_bidder: string | null;
  start_time: Date;
  end_time: Date;
  status: 'active' | string;
  nomination_index: number;
}

interface AuctionInfo {
  rows: Array<{
    id: string;
    created_at: string;
    status: string;
    commissioner_id: string;
    current_nomination_manager_index: number;
    settings: Record<string, any>;
  }>;
}

interface CountResult {
  rows: Array<{
    count: string;
  }>;
}

// Update the query to only select fields we need
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DbTestResponse>
) {
  try {
    // Step 1: Test basic connection
    console.log('Testing basic connection...');
    const connectionTest = await sql`SELECT 1 as test`;
    console.log('Basic connection successful');

    // Step 2: Get detailed info for most recent auction
    console.log('Getting detailed auction information...');
    const detailedAuctionInfo = await sql`
      WITH recent_auction AS (
        SELECT id FROM auctions ORDER BY created_at DESC LIMIT 1
      )
      SELECT 
        a.id,
        a.created_at,
        a.status,
        a.commissioner_id,
        a.current_nomination_manager_index,
        a.settings,
        (SELECT COUNT(*) FROM available_players ap WHERE ap.auction_id = a.id) as available_player_count,
        (SELECT COUNT(*) FROM completed_players cp WHERE cp.auction_id = a.id) as completed_player_count,
        (SELECT COUNT(*) FROM players_up pu WHERE pu.auction_id = a.id) as players_up_count,
        (SELECT COUNT(*) FROM managers m WHERE m.auction_id = a.id) as manager_count
      FROM auctions a
      WHERE a.id IN (SELECT id FROM recent_auction)
    `;

    // Format response
    const auctionDetails = detailedAuctionInfo.rows[0];
    const response = {
      status: 'ok' as const,
      connectionTest: { test: 1 },
      tableInfo: {
        exists: true,
        auctionCount: 1,
        recentAuctions: [{
          id: auctionDetails.id,
          status: auctionDetails.status,
          created_at: auctionDetails.created_at
        }],
        details: {
          availablePlayers: Number(auctionDetails.available_player_count),
          completedPlayers: Number(auctionDetails.completed_player_count),
          playersUp: Number(auctionDetails.players_up_count),
          managers: Number(auctionDetails.manager_count),
          settings: auctionDetails.settings
        }
      }
    };

    console.log('Detailed auction info:', JSON.stringify(response, null, 2));
    return res.status(200).json(response);

  } catch (error) {
    console.error('Database test failed:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      location: 'detailed query'
    });
  }
}