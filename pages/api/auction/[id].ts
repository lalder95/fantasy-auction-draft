// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

// Simplified debug logger
const log = (msg: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logData = data ? `: ${JSON.stringify(data, null, 2)}` : '';
  console.log(`[${timestamp}] ${msg}${logData}`);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auctionId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  
  if (!auctionId) {
    log('Missing auction ID', req.query);
    return res.status(400).json({ error: 'Missing auction ID' });
  }

  log('Processing request', { auctionId });

  try {
    // Test database connection first
    await sql`SELECT 1`.timeout(2000);
    log('Database connection OK');

    // Simple query to get auction
    const result = await sql`
      SELECT id, status, nomination_index, settings 
      FROM auctions 
      WHERE id = ${auctionId}
    `.timeout(2000);

    log('Query result', { 
      rowCount: result?.rows?.length,
      firstRow: result?.rows?.[0] 
    });

    if (!result?.rows?.length) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Return minimal data first
    const auction = result.rows[0];
    const response = {
      id: auction.id,
      status: auction.status,
      nominationIndex: auction.nomination_index,
      settings: auction.settings || {}
    };

    log('Sending response', response);
    return res.status(200).json(response);

  } catch (error) {
    log('Error in handler', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message
    });
  }
}