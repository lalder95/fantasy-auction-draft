// pages/api/auction/settings.ts (Simplified for Direct Database)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  console.log('Received settings update request');
  const { auctionId, settings } = req.body;
  
  if (!auctionId || !settings) {
    return res.status(400).json({ 
      message: 'Auction ID and settings are required'
    });
  }
  
  try {
    // Get existing auction
    console.log('Attempting to fetch auction with ID:', auctionId);
    const auction = await getAuction(auctionId);
    
    if (!auction) {
      console.log('Auction not found with ID:', auctionId);
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log('Successfully retrieved auction. Updating settings');
    
    // Create updated auction with new settings
    const updatedAuction = {
      ...auction,
      settings: {
        ...auction.settings,
        ...settings
      }
    };
    
    // Save updated auction
    console.log('Saving updated auction');
    await saveAuction(updatedAuction);
    console.log('Successfully saved updated auction');
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating auction settings:', error);
    return res.status(500).json({ 
      message: 'Failed to update auction settings',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}