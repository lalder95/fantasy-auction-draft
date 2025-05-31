// pages/api/db-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // First test basic connection
    console.log('Testing basic connection...');
    const connectionTest = await sql`SELECT 1 as test`;
    console.log('Basic connection successful');

    // Then test auctions table
    console.log('Testing auctions table...');
    const auctionsTest = await sql`
      SELECT id, status, created_at 
      FROM auctions 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    return res.status(200).json({ 
      status: 'ok',
      connectionTest: connectionTest.rows[0],
      auctions: {
        count: auctionsTest.rows.length,
        recent: auctionsTest.rows
      }
    });

  } catch (error) {
    console.error('Database test failed:', error);
    return res.status(500).json({ 
      error: String(error),
      location: error.message.includes('auctions') ? 'auctions query' : 'connection test'
    });
  }
}