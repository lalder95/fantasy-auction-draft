// pages/api/socket.ts
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
  // Add CORS headers for debugging
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle test GET request
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "ok", 
      message: "Socket.io API endpoint is running",
      timestamp: new Date().toISOString()
    });
  }

  try {
    if (!res.socket.server.io) {
      console.log('New Socket.io server initializing...');
      // Initialize socket server
      const httpServer: NetServer = res.socket.server as any;
      
      // Create IO server with more detailed error logging
      const io = new ServerIO(httpServer, {
        path: '/api/socket',
        addTrailingSlash: false,
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: false
        },
        connectTimeout: 20000, // Increase timeout to 20 seconds
        pingTimeout: 20000,
        pingInterval: 5000
      });
      
      // Store IO server instance on the HTTP server object
      res.socket.server.io = io;
      
      // Basic connection setup first
      io.on('connection', (socket) => {
        console.log('Client connected to socket server:', socket.id);
        
        socket.on('disconnect', (reason) => {
          console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        });
        
        // Simple ping-pong test event
        socket.on('ping', (callback) => {
          if (typeof callback === 'function') {
            callback({ status: 'ok', timestamp: Date.now() });
          } else {
            socket.emit('pong', { status: 'ok', timestamp: Date.now() });
          }
        });

        // Handle JOIN_AUCTION message
        socket.on('JOIN_AUCTION', (data) => {
          console.log(`Socket ${socket.id} joining auction room: ${data.auctionId}`);
          socket.join(data.auctionId);
          
          // Acknowledge join
          socket.emit('JOIN_CONFIRMATION', { 
            status: 'ok', 
            auctionId: data.auctionId 
          });
        });
      });
      
      // Import handlers separately to avoid initialization errors blocking connection
      try {
        // Load handlers with basic error handling
        const handlers = require('../../lib/socket-handlers');
        handlers.initSocketHandlers(io);
        console.log('Socket.IO event handlers attached successfully');
      } catch (handlersError) {
        console.error('Failed to initialize socket handlers:', handlersError);
        // Don't block the connection - we'll use the basic handlers above
      }
      
      console.log('Socket.IO server initialized successfully');
    } else {
      console.log('Socket.IO server already running');
    }
    
    // Return success
    res.status(200).end();
  } catch (error) {
    console.error('Error in socket API:', error);
    
    // Still end the response to prevent hanging
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error initializing socket server'
    });
  }
}