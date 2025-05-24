// pages/api/auction/action.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction, Auction } from '../../../lib/database-neon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'POST':
      try {
        const auction: Auction = req.body;
        await saveAuction(auction);
        res.status(200).json({ message: 'Auction saved successfully' });
      } catch (error) {
        console.error('Error saving auction:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
      break;

    case 'GET':
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
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
