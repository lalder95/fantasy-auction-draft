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
    let auctionsInfo;
    if (tableExists) {
      console.log('Getting auction information...');
      auctionsInfo = await sql`
        SELECT 
          id, 
          status, 
          created_at,
          updated_at
        FROM auctions 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      // Also get total count
      const countResult = await sql`SELECT COUNT(*) as count FROM auctions`;
      const totalCount = parseInt(countResult.rows[0].count) || 0;
      
      console.log(`Found ${totalCount} total auctions`);
    }

    // Build the response with proper type checking
    return res.status(200).json({
      status: 'ok',
      connectionTest: { 
        test: Number(connectionTest.rows[0]?.test) || 0 
      },
      tableInfo: tableExists && auctionsInfo ? {
        exists: true,
        auctionCount: parseInt(String(countResult?.rows[0]?.count)) || 0,
        recentAuctions: auctionsInfo.rows.map(row => ({
          id: String(row.id),
          status: String(row.status),
          created_at: String(row.created_at)
        }))
      } : {
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