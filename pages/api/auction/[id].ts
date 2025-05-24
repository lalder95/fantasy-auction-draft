// pages/api/auction/[id].ts

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
    res.status(200).json(auction);
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
