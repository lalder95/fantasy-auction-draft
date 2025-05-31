// pages/api/auction/check-expired.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';
import { expireAuctions } from '../../../lib/auction';
import { getPusherServer } from '../../../lib/pusher-server';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { auctionId, secretKey } = req.query;
    
    // Log request (without exposing full secret)
    console.log(`Processing expired check for auction: ${auctionId}, secretKey length: ${secretKey?.length || 0}`);
    
    // Validate required parameters
    if (!auctionId || typeof auctionId !== 'string') {
      return res.status(400).json({ message: 'Auction ID is required' });
    }

    if (!secretKey || typeof secretKey !== 'string') {
      return res.status(400).json({ message: 'Secret key is required' });
    }

    // Verify secret key with constant-time comparison
    const expectedSecret = process.env.AUCTION_WORKER_SECRET;
    if (!expectedSecret) {
      console.error('AUCTION_WORKER_SECRET not configured');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    if (secretKey !== expectedSecret) {
      console.warn(`Invalid secret key attempt for auction ${auctionId}`);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get auction with error handling
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Skip if auction is not active
    if (auction.status !== 'active') {
      return res.status(200).json({ 
        message: `Auction ${auctionId} is not active (status: ${auction.status})`,
        checkPerformed: false
      });
    }

    // Check for expired auctions
    const { updatedAuction, expiredCount } = expireAuctions(auction);

    // Only update if something actually expired
    if (expiredCount > 0) {
      // Save changes
      await saveAuction(updatedAuction);
      
      // Create minimal update for Pusher
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
        completedPlayers: updatedAuction.completedPlayers
          .slice(-expiredCount) // Only send newly completed players
          .map(p => ({
            playerId: p.playerId,
            finalBid: p.finalBid,
            winner: p.winner
          }))
      };
      
      // Notify clients via Pusher without forcing full update
      const pusher = getPusherServer();
      await pusher.trigger(`auction-${auctionId}`, 'auction-update', {
        updateInfo: minimalUpdate,
        action: 'EXPIRE_AUCTIONS',
        timestamp: new Date().toISOString(),
        fullUpdateNeeded: false // Only force full update if really needed
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
    // Log the full error for debugging
    console.error('Error in check-expired endpoint:', error);
    
    // Return a safe error response
    return res.status(500).json({ 
      message: 'Failed to check expired auctions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}