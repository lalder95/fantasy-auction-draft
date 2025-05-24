// lib/socket-handlers.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { getAuction, saveAuction, validateManagerSession } from './database-neon';

enum SocketMessageType {
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  AUCTION_UPDATE = 'AUCTION_UPDATE',
  JOIN_SUCCESS = 'JOIN_SUCCESS',
  BID_PLACED = 'BID_PLACED',
}

interface JoinAuctionPayload {
  auctionId: string;
  role: 'manager' | 'commissioner';
  sessionId?: string;
}

interface BidPayload {
  auctionId: string;
  managerId: string;
  bidAmount: number;
  playerId: string;
}

export function registerSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log('New client connected:', socket.id);
    socket.emit(SocketMessageType.CONNECTED, { message: 'Connected to auction server' });

    socket.on('joinAuction', async (data: JoinAuctionPayload) => {
      const { auctionId, role, sessionId } = data;
      let managerId: string | null = null;

      if (role === 'manager' && sessionId) {
        managerId = await validateManagerSession(sessionId, auctionId);

        if (!managerId) {
          console.error(`Invalid session for manager`, { sessionId });
          socket.emit(SocketMessageType.ERROR, { message: 'Invalid session' });
          return;
        }
      }

      const auction = await getAuction(auctionId);
      if (!auction) {
        socket.emit(SocketMessageType.ERROR, { message: 'Auction not found' });
        return;
      }

      socket.join(`auction-${auctionId}`);
      socket.emit(SocketMessageType.JOIN_SUCCESS, {
        auctionId,
        role,
        managerId,
      });

      console.log(`Socket ${socket.id} joined auction ${auctionId} as ${role}`);
    });

    socket.on('placeBid', async (data: BidPayload) => {
      const { auctionId, managerId, bidAmount, playerId } = data;

      // TODO: Implement logic to validate bidAmount, update auction state, etc.
      console.log(`Manager ${managerId} placed bid of ${bidAmount} on player ${playerId}`);

      // Broadcast to all clients in the auction room
      io.to(`auction-${auctionId}`).emit(SocketMessageType.BID_PLACED, {
        managerId,
        bidAmount,
        playerId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
