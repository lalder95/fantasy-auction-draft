// pages/api/auction/managers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method not allowed. Use PUT or POST.',
      method: req.method
    });
  }
  
  console.log('Received manager update request with body:', JSON.stringify(req.body).substring(0, 500));
  const { auctionId, managers } = req.body;
  
  if (!auctionId || !managers) {
    return res.status(400).json({ message: 'Auction ID and managers are required' });
  }
  
  try {
    // Get auction
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Update managers
    const updatedAuction = {
      ...auction,
      managers: managers,
    };
    
    // Save auction
    await saveAuction(updatedAuction);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating managers:', error);
    return res.status(500).json({ 
      message: 'Failed to update managers',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}