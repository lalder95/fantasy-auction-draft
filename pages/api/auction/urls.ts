// pages/api/auction/urls.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction } from '../../../lib/database-neon';
import { generateAuctionUrls } from '../../../lib/auction';
import { sendAuctionUrls } from '../../../lib/email';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, commissionerId, commissionerEmail, baseUrl } = req.body;
  
  if (!auctionId || !commissionerId || !commissionerEmail || !baseUrl) {
    return res.status(400).json({ 
      message: 'Auction ID, commissioner ID, commissioner email, and base URL are required' 
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
    
    // Generate URLs
    const urls = generateAuctionUrls(auction, baseUrl);
    
    // Send email
    const emailSent = await sendAuctionUrls(
      auction,
      commissionerEmail,
      baseUrl
    );
    
    return res.status(200).json({ urls, emailSent });
  } catch (error) {
    console.error('Error generating auction URLs:', error);
    return res.status(500).json({ message: 'Failed to generate auction URLs' });
  }
}