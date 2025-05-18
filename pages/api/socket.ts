// pages/api/socket.ts - Simplified version
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';
import { Server as NetServer } from 'http';
import { NextApiResponseServerIO } from '../../types/next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // For GET requests - return a simple status message
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'Socket API endpoint is available',
      timestamp: new Date().toISOString()
    });
  }

  try {
    if (!res.socket.server.io) {
      console.log('Setting up Socket.IO server...');
      const httpServer: NetServer = res.socket.server as any;
      
      const io = new ServerIO(httpServer, {
        path: '/api/socket',
        addTrailingSlash: false,
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });

      // Add a basic connection handler
      io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
        
        socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id);
        });
        
        // Basic handlers
        socket.on('ping', (callback) => {
          if (typeof callback === 'function') {
            callback({ status: 'ok', time: Date.now() });
          } else {
            socket.emit('pong', { status: 'ok', time: Date.now() });
          }
        });
        
        socket.on('JOIN_AUCTION', (data) => {
          console.log(`Client ${socket.id} joining auction: ${data.auctionId}`);
          socket.join(data.auctionId);
          
          // Send dummy auction data for testing connection
          socket.emit('AUCTION_UPDATE', {
            id: data.auctionId,
            settings: {
              leagueName: 'Test League',
              showHighBidder: true,
            },
            managers: [],
            playersUp: [],
            completedPlayers: [],
            status: 'setup',
            currentNominationManagerIndex: 0
          });
        });
      });

      res.socket.server.io = io;
    }
    
    res.status(200).end();
  } catch (error) {
    console.error('Socket server error:', error);
    res.status(500).json({ error: 'Failed to initialize socket server' });
  }
}