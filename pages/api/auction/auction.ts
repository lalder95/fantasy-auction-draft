// pages/api/auction/action.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';
import { getPusherServer } from '../../../lib/pusher-server';
import {
  placeBid,
  passOnPlayer,
  nominatePlayer,
  adjustAuctionTime,
  pauseAuction,
  resumeAuction,
  endAuction,
  removePlayerFromAuction,
  cancelBid,
  updateManagerBudget,
} from '../../../lib/auction';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, action, playerId, managerId, bidAmount, secondsToAdjust, newBudget } = req.body;
  
  if (!auctionId || !action) {
    return res.status(400).json({ message: 'Auction ID and action are required' });
  }
  
  try {
    // Get auction
    const auction = await getAuction(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Process the action
    let updatedAuction = auction;
    
    switch (action) {
      case 'BID':
        if (!playerId || !managerId || bidAmount === undefined) {
          return res.status(400).json({ message: 'Player ID, manager ID, and bid amount are required for BID action' });
        }
        try {
          updatedAuction = placeBid(auction, managerId, playerId, bidAmount);
        } catch (error) {
          // Send the error via Pusher but don't fail the request
          const pusher = getPusherServer();
          await pusher.trigger(`auction-${auctionId}`, 'auction-error', {
            message: error instanceof Error ? error.message : String(error),
            action,
            timestamp: new Date().toISOString()
          });
          
          return res.status(400).json({ 
            message: 'Bid failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'PASS':
        if (!playerId || !managerId) {
          return res.status(400).json({ message: 'Player ID and manager ID are required for PASS action' });
        }
        try {
          updatedAuction = passOnPlayer(auction, managerId, playerId);
        } catch (error) {
          const pusher = getPusherServer();
          await pusher.trigger(`auction-${auctionId}`, 'auction-error', {
            message: error instanceof Error ? error.message : String(error),
            action,
            timestamp: new Date().toISOString()
          });
          
          return res.status(400).json({ 
            message: 'Pass failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'NOMINATE':
        if (!playerId || !managerId) {
          return res.status(400).json({ message: 'Player ID and manager ID are required for NOMINATE action' });
        }
        try {
          updatedAuction = nominatePlayer(auction, managerId, playerId, bidAmount || 1);
        } catch (error) {
          const pusher = getPusherServer();
          await pusher.trigger(`auction-${auctionId}`, 'auction-error', {
            message: error instanceof Error ? error.message : String(error),
            action,
            timestamp: new Date().toISOString()
          });
          
          return res.status(400).json({ 
            message: 'Nomination failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
      
      case 'ADJUST_TIME':
        if (!playerId || secondsToAdjust === undefined) {
          return res.status(400).json({ message: 'Player ID and seconds to adjust are required for ADJUST_TIME action' });
        }
        try {
          // Use commissioner ID for commissioner actions
          const commissionerId = auction.commissionerId;
          updatedAuction = adjustAuctionTime(auction, playerId, commissionerId, secondsToAdjust);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Time adjustment failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'PAUSE_AUCTION':
        try {
          const commissionerId = auction.commissionerId;
          updatedAuction = pauseAuction(auction, commissionerId);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to pause auction',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'RESUME_AUCTION':
        try {
          const commissionerId = auction.commissionerId;
          updatedAuction = resumeAuction(auction, commissionerId);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to resume auction',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'END_AUCTION':
        try {
          const commissionerId = auction.commissionerId;
          updatedAuction = endAuction(auction, commissionerId);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to end auction',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'REMOVE_PLAYER':
        if (!playerId) {
          return res.status(400).json({ message: 'Player ID is required for REMOVE_PLAYER action' });
        }
        try {
          const commissionerId = auction.commissionerId;
          updatedAuction = removePlayerFromAuction(auction, playerId, commissionerId);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to remove player',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'CANCEL_BID':
        if (!playerId) {
          return res.status(400).json({ message: 'Player ID is required for CANCEL_BID action' });
        }
        try {
          const commissionerId = auction.commissionerId;
          updatedAuction = cancelBid(auction, playerId, commissionerId);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to cancel bid',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'UPDATE_BUDGET':
        if (!managerId || newBudget === undefined) {
          return res.status(400).json({ message: 'Manager ID and new budget are required for UPDATE_BUDGET action' });
        }
        try {
          updatedAuction = updateManagerBudget(auction, managerId, newBudget);
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to update budget',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }
    
    // Save the updated auction
    await saveAuction(updatedAuction);
    
    // Send update via Pusher
    const pusher = getPusherServer();
    await pusher.trigger(`auction-${auctionId}`, 'auction-update', {
      auction: updatedAuction,
      action,
      timestamp: new Date().toISOString()
    });
    
    return res.status(200).json({
      success: true,
      message: `Action ${action} completed successfully`
    });
  } catch (error) {
    console.error('Error processing auction action:', error);
    return res.status(500).json({ 
      message: 'Failed to process auction action',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}