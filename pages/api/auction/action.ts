// pages/api/auction/action.ts - Modified to send optimized Pusher updates
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

// Define a type for Pusher errors
interface PusherError {
  status?: number;
  message?: string;
}

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
    let updateInfo = {}; // Used for optimized Pusher updates
    
    switch (action) {
      case 'BID':
        if (!playerId || !managerId || bidAmount === undefined) {
          return res.status(400).json({ message: 'Player ID, manager ID, and bid amount are required for BID action' });
        }
        try {
          // Store pre-update state for comparison
          const playerBeforeUpdate = auction.playersUp.find(p => p.playerId === playerId);
          const managerBeforeUpdate = auction.managers.find(m => m.id === managerId);
          
          // Apply the bid
          updatedAuction = placeBid(auction, managerId, playerId, bidAmount);
          
          // Find updated player and manager
          const updatedPlayer = updatedAuction.playersUp.find(p => p.playerId === playerId);
          const updatedManager = updatedAuction.managers.find(m => m.id === managerId);
          
          // Create minimal update info
          updateInfo = {
            updateType: 'BID',
            affectedPlayer: updatedPlayer ? {
              playerId: updatedPlayer.playerId,
              currentBid: updatedPlayer.currentBid,
              currentBidder: updatedPlayer.currentBidder,
              passes: [], // Reset passes after a bid
              endTime: updatedPlayer.endTime // In case end time was adjusted
            } : null,
            affectedManager: updatedManager && managerBeforeUpdate && 
                             updatedManager.budget !== managerBeforeUpdate.budget ? {
              id: updatedManager.id,
              budget: updatedManager.budget
            } : null
          };
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
          // Store pre-update state
          const playerBeforePass = auction.playersUp.find(p => p.playerId === playerId);
          
          // Apply the pass
          updatedAuction = passOnPlayer(auction, managerId, playerId);
          
          // Find updated player
          const updatedPlayer = updatedAuction.playersUp.find(p => p.playerId === playerId);
          
          // Create minimal update info
          updateInfo = {
            updateType: 'PASS',
            affectedPlayer: updatedPlayer ? {
              playerId: updatedPlayer.playerId,
              passes: updatedPlayer.passes,
              endTime: updatedPlayer.endTime // May have changed if all but high bidder passed
            } : null
          };
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
          // This will cause substantial changes - indicate that full refresh is needed
          updatedAuction = nominatePlayer(auction, managerId, playerId, bidAmount || 1);
          
          // For nomination, send only basic info - client will fetch full data
          updateInfo = {
            updateType: 'NOMINATE',
            fullUpdateNeeded: true, // Signal client to fetch complete data
            currentNominationManagerIndex: updatedAuction.currentNominationManagerIndex
          };
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
          
          // Store pre-update state
          const playerBeforeTimeAdjust = auction.playersUp.find(p => p.playerId === playerId);
          
          // Apply the time adjustment
          updatedAuction = adjustAuctionTime(auction, playerId, commissionerId, secondsToAdjust);
          
          // Find updated player
          const updatedPlayer = updatedAuction.playersUp.find(p => p.playerId === playerId);
          
          // Create minimal update info
          updateInfo = {
            updateType: 'ADJUST_TIME',
            affectedPlayer: updatedPlayer ? {
              playerId: updatedPlayer.playerId,
              endTime: updatedPlayer.endTime
            } : null
          };
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
          
          // Simple status update
          updateInfo = {
            updateType: 'PAUSE_AUCTION',
            status: updatedAuction.status
          };
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
          
          // Simple status update
          updateInfo = {
            updateType: 'RESUME_AUCTION',
            status: updatedAuction.status
          };
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to resume auction',
            error: error instanceof Error ? error.message : String(error)
          });
        }
        break;
        
      case 'END_AUCTION':
        try {
          // For end auction, signal clients to get a full update
          const commissionerId = auction.commissionerId;
          updatedAuction = endAuction(auction, commissionerId);
          
          updateInfo = {
            updateType: 'END_AUCTION',
            status: updatedAuction.status,
            fullUpdateNeeded: true
          };
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
          
          // Signal for full update since this changes available players
          updateInfo = {
            updateType: 'REMOVE_PLAYER',
            fullUpdateNeeded: true
          };
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
          
          // Store pre-update state
          const playerBeforeCancel = auction.playersUp.find(p => p.playerId === playerId);
          
          // Apply the bid cancellation
          updatedAuction = cancelBid(auction, playerId, commissionerId);
          
          // Find updated player
          const updatedPlayer = updatedAuction.playersUp.find(p => p.playerId === playerId);
          
          // Create minimal update info
          updateInfo = {
            updateType: 'CANCEL_BID',
            affectedPlayer: updatedPlayer ? {
              playerId: updatedPlayer.playerId,
              currentBid: updatedPlayer.currentBid,
              currentBidder: updatedPlayer.currentBidder,
              passes: []
            } : null
          };
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
          
          // Find updated manager
          const updatedManager = updatedAuction.managers.find(m => m.id === managerId);
          
          // Create minimal update info
          updateInfo = {
            updateType: 'UPDATE_BUDGET',
            affectedManager: updatedManager ? {
              id: updatedManager.id,
              budget: updatedManager.budget
            } : null
          };
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
    
    try {
      // Send optimized update info instead of the full auction
      await pusher.trigger(`auction-${auctionId}`, 'auction-update', {
        updateInfo,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      console.error('Error sending Pusher update:', error);
      
      // Check if this is a Pusher error with a status code
      const pusherError = error as PusherError;
      
      // If the update is too large, try a minimal update
      if (pusherError && pusherError.status === 413) {
        try {
          // Send a minimal update that tells clients to fetch the full data
          await pusher.trigger(`auction-${auctionId}`, 'auction-update', {
            updateInfo: {
              updateType: action,
              fullUpdateNeeded: true
            },
            timestamp: new Date().toISOString()
          });
        } catch (retryError) {
          console.error('Failed to send minimal Pusher update:', retryError);
        }
      }
    }
    
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