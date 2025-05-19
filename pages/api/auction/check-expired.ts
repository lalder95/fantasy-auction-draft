// pages/api/auction/check-expired.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';
import { expireAuctions } from '../../../lib/auction';
import { getPusherServer } from '../../../lib/pusher-server';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Secure this endpoint with a secret key
  const { auctionId, secretKey } = req.query;
  
  // Check if the secret key matches (you should set this in your environment variables)
  if (secretKey !== process.env.AUCTION_WORKER_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Auction ID is required' });
  }
  
  try {
    // Get auction
    const auction = await getAuction(auctionId);
    
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Skip if auction is not active
    if (auction.status !== 'active') {
      return res.status(200).json({ 
        message: `Auction ${auctionId} is not active (current status: ${auction.status})`,
        checkPerformed: false
      });
    }
    
    // Check for expired auctions
    const updatedAuction = expireAuctions(auction);
    
    // If auction was updated (some players expired)
    if (updatedAuction !== auction) {
      // Save changes
      await saveAuction(updatedAuction);
      
      // Create a minimal update object for Pusher to avoid size limits
      const minimalUpdate = {
        id: updatedAuction.id,
        status: updatedAuction.status,
        playersUp: updatedAuction.playersUp.map(p => ({
          playerId: p.playerId,
          status: p.status,
          currentBid: p.currentBid,
          currentBidder: p.currentBidder,
          endTime: p.endTime
        })),
        completedPlayers: updatedAuction.completedPlayers.map(p => ({
          playerId: p.playerId,
          name: p.name,
          position: p.position,
          team: p.team,
          finalBid: p.finalBid,
          winner: p.winner
        })),
        updateType: 'expiration'
      };
      
      // Notify clients via Pusher
      const pusher = getPusherServer();
      await pusher.trigger(`auction-${auctionId}`, 'auction-update', {
        updateInfo: minimalUpdate,
        action: 'EXPIRE_AUCTIONS',
        timestamp: new Date().toISOString(),
        fullUpdateNeeded: true // Flag to tell client to fetch the full auction data
      });
      
      return res.status(200).json({ 
        message: 'Expired auctions processed',
        checkPerformed: true,
        changesApplied: true
      });
    }
    
    return res.status(200).json({ 
      message: 'No expired auctions found',
      checkPerformed: true,
      changesApplied: false
    });
  } catch (error) {
    console.error('Error checking expired auctions:', error);
    return res.status(500).json({ 
      message: 'Failed to check expired auctions',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}