// pages/api/auction/results.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction } from '../../../lib/database-neon';
import { getAuctionResults } from '../../../lib/auction';
import { sendAuctionResults } from '../../../lib/email';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, commissionerId, commissionerEmail } = req.body;
  
  if (!auctionId || !commissionerId || !commissionerEmail) {
    return res.status(400).json({ 
      message: 'Auction ID, commissioner ID, and commissioner email are required' 
    });
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
    
    // Get results
    const results = getAuctionResults(auction);
    
    // Send email
    const emailSent = await sendAuctionResults(
      auction,
      commissionerEmail
    );
    
    return res.status(200).json({ results, emailSent });
  } catch (error) {
    console.error('Error sending auction results:', error);
    return res.status(500).json({ message: 'Failed to send auction results' });
  }
}