// pages/api/auction/start.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database';
import { startAuction } from '../../../lib/auction';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, commissionerId } = req.body;
  
  if (!auctionId || !commissionerId) {
    return res.status(400).json({ message: 'Auction ID and commissioner ID are required' });
  }
  
  try {
    // Get auction
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Verify commissioner
    if (auction.commissionerId !== commissionerId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Start auction
    const updatedAuction = startAuction(auction);
    
    // Save auction
    await saveAuction(updatedAuction);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error starting auction:', error);
    return res.status(500).json({ message: 'Failed to start auction' });
  }
}