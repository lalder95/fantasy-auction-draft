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

    // Step 2: Check if auctions table exists
    console.log('Checking auctions table...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'auctions'
      ) as exists
    `;
    
    const tableExists = tableCheck.rows[0]?.exists;
    console.log('Auctions table exists:', tableExists);

    // Step 3: If table exists, get auction info
    if (tableExists) {
      console.log('Getting auction information...');
      const auctionsInfo = await sql`
        SELECT 
          id,
          created_at,
          status,
          commissioner_id,
          current_nomination_manager_index,
          settings
        FROM auctions 
        ORDER BY created_at DESC 
        LIMIT 5
      ` as AuctionInfo;
      
      // Get total count
      const countResult = await sql`
        SELECT COUNT(*) as count FROM auctions
      ` as CountResult;
      
      const totalCount = parseInt(countResult.rows[0]?.count) || 0;
      console.log(`Found ${totalCount} total auctions`);

      // Return successful response with data
      return res.status(200).json({
        status: 'ok',
        connectionTest: { 
          test: Number(connectionTest.rows[0]?.test) || 0 
        },
        tableInfo: {
          exists: true,
          auctionCount: totalCount,
          recentAuctions: auctionsInfo.rows.map(row => ({
            id: String(row.id),
            status: String(row.status),
            created_at: String(row.created_at)
          }))
        }
      });
    }

    // Return successful response without auction data
    return res.status(200).json({
      status: 'ok',
      connectionTest: { 
        test: Number(connectionTest.rows[0]?.test) || 0 
      },
      tableInfo: {
        exists: false,
        auctionCount: 0,
        recentAuctions: []
      }
    });

  } catch (error) {
    console.error('Database test failed:', error);
    
    const errorResponse: DbTestResponse = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      location: error instanceof Error && error.message.includes('auctions') 
        ? 'auctions query' 
        : 'connection test'
    };

    return res.status(500).json(errorResponse);
  }
}