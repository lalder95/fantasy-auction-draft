// pages/api/auction/players.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, availablePlayers } = req.body;
  
  if (!auctionId || !availablePlayers) {
    return res.status(400).json({ message: 'Auction ID and available players are required' });
  }
  
  try {
    // Get auction
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Update available players
    const updatedAuction = {
      ...auction,
      availablePlayers,
    };
    
    // Save auction
    await saveAuction(updatedAuction);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating available players:', error);
    return res.status(500).json({ message: 'Failed to update available players' });
  }
}