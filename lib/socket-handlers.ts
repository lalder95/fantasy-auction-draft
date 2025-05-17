// lib/socket-handlers.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { getAuction, saveAuction, validateManagerSession } from './database-neon';
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
} from './auction';

// Mapping of auctionId to timer interval ID
const auctionIntervals: Record<string, NodeJS.Timeout> = {};

// Types of messages
export enum SocketMessageType {
  JOIN_AUCTION = 'JOIN_AUCTION',
  AUCTION_UPDATE = 'AUCTION_UPDATE',
  PLACE_BID = 'PLACE_BID',
  PASS_ON_PLAYER = 'PASS_ON_PLAYER',
  NOMINATE_PLAYER = 'NOMINATE_PLAYER',
  ADJUST_TIME = 'ADJUST_TIME',
  PAUSE_AUCTION = 'PAUSE_AUCTION',
  RESUME_AUCTION = 'RESUME_AUCTION',
  END_AUCTION = 'END_AUCTION',
  REMOVE_PLAYER = 'REMOVE_PLAYER',
  CANCEL_BID = 'CANCEL_BID',
  UPDATE_BUDGET = 'UPDATE_BUDGET',
  ERROR = 'ERROR',
}

/**
 * Initialize socket handlers for an IO server instance
 */
export function initSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log('New client connected', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
    
    // Join auction room
    socket.on(SocketMessageType.JOIN_AUCTION, async (data: {
      auctionId: string;
      sessionId?: string;
      role: 'commissioner' | 'manager' | 'viewer';
    }) => {
      try {
        console.log(`Join auction request:`, { 
          socketId: socket.id,
          auctionId: data.auctionId,
          role: data.role,
          sessionId: data.sessionId ? `${data.sessionId.substring(0, 8)}...` : undefined
        });
        
        // Fetch the auction
        const auction = await getAuction(data.auctionId);
        if (!auction) {
          console.error(`Auction not found: ${data.auctionId}`);
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Join the auction room
        socket.join(data.auctionId);
        console.log(`Socket ${socket.id} joined room ${data.auctionId}`);
        
        // Validate session for managers
        let managerId: string | null = null;
        if (data.role === 'manager' && data.sessionId) {
          managerId = await validateManagerSession(data.sessionId, data.auctionId);
          if (!managerId) {
            console.error(`Invalid session for manager`, { sessionId: data.sessionId });
            socket.emit(SocketMessageType.ERROR, { message: 'Invalid session' });
            return;
          }
        }
        
        // Set socket data
        socket.data.auctionId = data.auctionId;
        socket.data.role = data.role;
        socket.data.managerId = managerId;
        
        // Start auction timer if it's not already running
        startAuctionTimer(data.auctionId, io);
        
        // Send auction data to client
        const auctionForClient = prepareAuctionForClient(auction, data.role, managerId);
        console.log(`Emitting auction update to client ${socket.id}`);
        socket.emit(SocketMessageType.AUCTION_UPDATE, auctionForClient);
        
      } catch (error) {
        console.error('Error joining auction:', error);
        socket.emit(SocketMessageType.ERROR, { 
          message: 'Failed to join auction',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Place bid
    socket.on(SocketMessageType.PLACE_BID, async (data: {
      playerId: string;
      bidAmount: number;
      managerId?: string; // Optional for commissioner bids on behalf of manager
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'manager' && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Not authorized to bid' });
          return;
        }
        
        if (!managerId && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'No manager ID' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // If commissioner is bidding on behalf of a manager
        const bidManagerId = data.managerId || managerId;
        
        // Place the bid
        const updatedAuction = placeBid(auction, bidManagerId, data.playerId, data.bidAmount);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error placing bid:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to place bid' });
      }
    });
    
    // Pass on player
    socket.on(SocketMessageType.PASS_ON_PLAYER, async (data: {
      playerId: string;
      managerId?: string; // Optional for commissioner to pass on behalf of a manager
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'manager' && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Not authorized to pass' });
          return;
        }
        
        if (!managerId && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'No manager ID' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // If commissioner is passing on behalf of a manager
        const passManagerId = data.managerId || managerId;
        
        // Pass on the player
        const updatedAuction = passOnPlayer(auction, passManagerId, data.playerId);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error passing on player:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to pass on player' });
      }
    });
    
    // Nominate player
    socket.on(SocketMessageType.NOMINATE_PLAYER, async (data: {
      playerId: string;
      startingBid?: number;
      managerId?: string; // Optional for commissioner to nominate on behalf of a manager
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'manager' && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Not authorized to nominate' });
          return;
        }
        
        if (!managerId && role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'No manager ID' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // If commissioner is nominating on behalf of a manager
        const nominateManagerId = data.managerId || managerId;
        
        // Nominate the player
        const updatedAuction = nominatePlayer(
          auction,
          nominateManagerId,
          data.playerId,
          data.startingBid || 1
        );
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error nominating player:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to nominate player' });
      }
    });
    
    // Commissioner actions
    
    // Adjust auction time
    socket.on(SocketMessageType.ADJUST_TIME, async (data: {
      playerId: string;
      secondsToAdjust: number;
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can adjust time' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Adjust the time
        const updatedAuction = adjustAuctionTime(
          auction,
          data.playerId,
          managerId!,
          data.secondsToAdjust
        );
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error adjusting time:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to adjust time' });
      }
    });
    
    // Pause auction
    socket.on(SocketMessageType.PAUSE_AUCTION, async () => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can pause the auction' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Pause the auction
        const updatedAuction = pauseAuction(auction, managerId!);
        
        // Stop the timer
        stopAuctionTimer(auctionId);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error pausing auction:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to pause auction' });
      }
    });
    
    // Resume auction
    socket.on(SocketMessageType.RESUME_AUCTION, async () => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can resume the auction' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Resume the auction
        const updatedAuction = resumeAuction(auction, managerId!);
        
        // Start the timer
        startAuctionTimer(auctionId, io);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error resuming auction:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to resume auction' });
      }
    });
    
    // End auction
    socket.on(SocketMessageType.END_AUCTION, async () => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can end the auction' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // End the auction
        const updatedAuction = endAuction(auction, managerId!);
        
        // Stop the timer
        stopAuctionTimer(auctionId);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error ending auction:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to end auction' });
      }
    });
    
    // Remove player from auction
    socket.on(SocketMessageType.REMOVE_PLAYER, async (data: {
      playerId: string;
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can remove players' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Remove the player
        const updatedAuction = removePlayerFromAuction(auction, data.playerId, managerId!);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error removing player:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to remove player' });
      }
    });
    
    // Cancel bid
    socket.on(SocketMessageType.CANCEL_BID, async (data: {
      playerId: string;
    }) => {
      try {
        const { auctionId, role, managerId } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can cancel bids' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Cancel the bid
        const updatedAuction = cancelBid(auction, data.playerId, managerId!);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error cancelling bid:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to cancel bid' });
      }
    });
    
    // Update manager budget
    socket.on(SocketMessageType.UPDATE_BUDGET, async (data: {
      managerId: string;
      newBudget: number;
    }) => {
      try {
        const { auctionId, role } = socket.data;
        
        if (!auctionId) {
          socket.emit(SocketMessageType.ERROR, { message: 'Not in an auction' });
          return;
        }
        
        if (role !== 'commissioner') {
          socket.emit(SocketMessageType.ERROR, { message: 'Only the commissioner can update budgets' });
          return;
        }
        
        // Fetch the auction
        const auction = await getAuction(auctionId);
        if (!auction) {
          socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
          return;
        }
        
        // Update the budget
        const updatedAuction = updateManagerBudget(auction, data.managerId, data.newBudget);
        
        // Save and broadcast update
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
        
      } catch (error: any) {
        console.error('Error updating budget:', error);
        socket.emit(SocketMessageType.ERROR, { message: error.message || 'Failed to update budget' });
      }
    });
  });
}

/**
 * Broadcast auction update to all clients in the auction room
 */
function broadcastAuctionUpdate(auction: any, io: SocketIOServer) {
  // Broadcast to commissioner view
  io.to(auction.id).emit(SocketMessageType.AUCTION_UPDATE, {
    ...auction,
    forCommissioner: true,
  });
  
  // Broadcast to manager views
  auction.managers.forEach((manager: any) => {
    // Prepare a version of the auction specific to this manager
    const managerAuction = prepareAuctionForClient(auction, 'manager', manager.id);
    
    // Emit to sockets in the room that are this specific manager
    io.to(auction.id).emit(`${SocketMessageType.AUCTION_UPDATE}:${manager.id}`, managerAuction);
  });
  
  // Broadcast to viewer view
  const viewerAuction = prepareAuctionForClient(auction, 'viewer', null);
  io.to(auction.id).emit(`${SocketMessageType.AUCTION_UPDATE}:viewer`, viewerAuction);
}

/**
 * Prepare auction data for client based on role
 */
function prepareAuctionForClient(auction: any, role: string, managerId: string | null) {
  if (role === 'commissioner') {
    // Commissioner sees everything
    return {
      ...auction,
      forCommissioner: true,
    };
  } else if (role === 'manager' && managerId) {
    // Manager sees limited info
    const manager = auction.managers.find((m: any) => m.id === managerId);
    
    // If blind auction format, hide current bidder from non-commissioner
    const playersUp = auction.settings.showHighBidder
      ? auction.playersUp
      : auction.playersUp.map((player: any) => ({
          ...player,
          currentBidder: player.currentBidder === managerId ? managerId : '***',
        }));
    
    return {
      ...auction,
      playersUp,
      forManager: true,
      currentManager: manager,
    };
  } else {
    // Viewer sees limited info
    // If blind auction format, hide current bidder from viewers
    const playersUp = auction.settings.showHighBidder
      ? auction.playersUp
      : auction.playersUp.map((player: any) => ({
          ...player,
          currentBidder: '***',
        }));
    
    return {
      ...auction,
      playersUp,
      forViewer: true,
    };
  }
}

/**
 * Start auction timer to check for expired auctions
 */
function startAuctionTimer(auctionId: string, io: SocketIOServer) {
  // If timer already running, don't start another
  if (auctionIntervals[auctionId]) return;
  
  console.log(`Starting auction timer for auction ${auctionId}`);
  
  // Check every second for expired auctions
  auctionIntervals[auctionId] = setInterval(async () => {
    try {
      // Fetch the auction
      const auction = await getAuction(auctionId);
      if (!auction) {
        console.log(`Auction ${auctionId} not found, stopping timer`);
        stopAuctionTimer(auctionId);
        return;
      }
      
      // If auction is paused or completed, don't expire auctions
      if (auction.status !== 'active') return;
      
      // Check for expired auctions
      const updatedAuction = expireAuctions(auction);
      
      // Only save and broadcast if there were changes
      if (updatedAuction !== auction) {
        console.log(`Auction ${auctionId} - expiring auctions and updating`);
        await saveAuction(updatedAuction);
        broadcastAuctionUpdate(updatedAuction, io);
      }
    } catch (error) {
      console.error(`Error in auction timer for ${auctionId}:`, error);
    }
  }, 1000);
}

/**
 * Stop auction timer
 */
function stopAuctionTimer(auctionId: string) {
  if (auctionIntervals[auctionId]) {
    console.log(`Stopping auction timer for auction ${auctionId}`);
    clearInterval(auctionIntervals[auctionId]);
    delete auctionIntervals[auctionId];
  }
}