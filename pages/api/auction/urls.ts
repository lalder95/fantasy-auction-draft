// pages/api/auction/urls.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuction } from '../../../lib/database-neon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid auction ID' });
  }

  try {
    const auction = await getAuction(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Assuming auction has a urls field; adjust as necessary
    const urls = []; // Replace with actual logic to retrieve URLs

    res.status(200).json({ urls });
  } catch (error) {
    console.error('Error fetching auction URLs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
