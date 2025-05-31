// pages/api/auction/action.ts - Enhanced with clear event types for player pool updates
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database-neon';
import { getPusherServer } from '../../../lib/pusher-server';
import { sql } from '@vercel/postgres'; // or from 'neon' if you use neon
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
  expireAuctions,
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
            affectedManager: updatedManager ? {
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
          updatedAuction = nominatePlayer(auction, managerId, playerId, bidAmount || 1);
          
          // Remove from available players in DB
          await sql`
            DELETE FROM available_players 
            WHERE auction_id = ${auctionId} 
            AND player_id = ${playerId}
          `;
          
          updateInfo = {
            updateType: 'NOMINATE',
            nominatedPlayerId: playerId,
            currentNominationManagerIndex: updatedAuction.currentNominationManagerIndex,
            // Include the new player up information
            newPlayerUp: updatedAuction.playersUp.find(p => p.playerId === playerId)
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
          const commissionerId = auction.commissionerId;
          updatedAuction = endAuction(auction, commissionerId);
          
          updateInfo = {
            updateType: 'END_AUCTION',
            status: updatedAuction.status,
            // Include completed players info for any players that were up for auction
            completedPlayers: updatedAuction.completedPlayers
              .filter(p => auction.playersUp.some(up => up.playerId === p.playerId))
              .map(p => ({
                playerId: p.playerId,
                finalBid: p.finalBid,
                winner: p.winner
              }))
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
          const playerDetails = auction.playersUp.find(p => p.playerId === playerId);
          updatedAuction = removePlayerFromAuction(auction, playerId, commissionerId);
          
          // Re-add to available players in DB if needed
          if (playerDetails) {
            await sql`
              INSERT INTO available_players (
                player_id, auction_id, full_name, position, team, status, years_exp
              ) VALUES (
                ${playerDetails.playerId},
                ${auctionId},
                ${playerDetails.name},
                ${playerDetails.position},
                ${playerDetails.team},
                'Active',
                0
              )
              ON CONFLICT DO NOTHING
            `;
          }
          
          updateInfo = {
            updateType: 'REMOVE_PLAYER',
            removedPlayerId: playerId,
            playerDetails
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
        
      case 'EXPIRE_AUCTIONS':
        try {
          // Add debug info about who/what triggered this check
          console.log(`DEBUG: EXPIRE_AUCTIONS triggered by:`, {
            requestBody: req.body,
            headers: {
              'user-agent': req.headers['user-agent'],
              'x-forwarded-for': req.headers['x-forwarded-for']
            },
            timestamp: new Date().toISOString()
          });

          // Check for expired auctions
          const auctionBefore = JSON.parse(JSON.stringify(auction));
          const { updatedAuction: expiredAuction, expiredCount } = expireAuctions(auction);
          
          // Log the check results
          console.log(`DEBUG: Expiration check results:`, {
            auctionId,
            expiredCount,
            playersUp: auction.playersUp.map(p => ({
              id: p.playerId,
              endTime: p.endTime,
              timeRemaining: p.endTime ? new Date(p.endTime).getTime() - Date.now() : null
            }))
          });

          // Only proceed if there were actual changes
          if (expiredCount > 0) {
            updatedAuction = expiredAuction;
            
            const newlyCompletedPlayerIds = updatedAuction.completedPlayers
              .filter(p => !auctionBefore.completedPlayers.some((cp: {playerId: string}) => cp.playerId === p.playerId))
              .map(p => p.playerId);
            
            const completedPlayerDetails = newlyCompletedPlayerIds.map(id => {
              const player = updatedAuction.completedPlayers.find(p => p.playerId === id);
              return player ? {
                playerId: player.playerId,
                winningManagerId: player.winner,
                finalBid: player.finalBid
              } : null;
            }).filter(Boolean);
            
            updateInfo = {
              updateType: 'EXPIRE_AUCTIONS',
              completedPlayers: completedPlayerDetails
            };
            
            // Only save to database if there were changes
            await saveAuction(updatedAuction);
          } else {
            console.log(`DEBUG: No expirations found for auction ${auctionId}`);
            return res.status(200).json({
              success: true,
              message: 'No auctions expired'
            });
          }
        } catch (error) {
          return res.status(400).json({ 
            message: 'Failed to check expired auctions',
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