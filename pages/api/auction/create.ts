// pages/api/auction/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuction } from '../../../lib/auction';
import { getLeagueInfo } from '../../../lib/sleeper';
import { saveAuction } from '../../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { leagueId, commissionerId } = req.body;
  
  if (!leagueId || !commissionerId) {
    return res.status(400).json({ message: 'League ID and commissioner ID are required' });
  }
  
  try {
    // Get league info for league name
    const leagueInfo = await getLeagueInfo(leagueId);
    
    // Create auction
    const auction = createAuction(leagueId, leagueInfo.name, commissionerId);
    
    // Save auction
    await saveAuction(auction);
    
    return res.status(200).json({ 
      success: true,
      auctionId: auction.id,
    });
  } catch (error) {
    console.error('Error creating auction:', error);
    return res.status(500).json({ message: 'Failed to create auction' });
  }
}