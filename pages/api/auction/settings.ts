// pages/api/auction/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, settings } = req.body;
  
  if (!auctionId || !settings) {
    return res.status(400).json({ message: 'Auction ID and settings are required' });
  }
  
  try {
    // Get existing auction
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Update settings
    const updatedAuction = {
      ...auction,
      settings: {
        ...auction.settings,
        ...settings
      }
    };
    
    // Save auction
    await saveAuction(updatedAuction);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating auction settings:', error);
    return res.status(500).json({ message: 'Failed to update auction settings' });
  }
}