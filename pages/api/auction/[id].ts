// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Auction ID is required' });
  }
  
  try {
    const auction = await getAuction(id);
    
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Return full auction data
    return res.status(200).json({
      auction,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching auction:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch auction',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}