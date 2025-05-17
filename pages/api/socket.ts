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

  try {
    if (!res.socket.server.io) {
      console.log('New Socket.io server initializing...');
      // Initialize socket server
      const httpServer: NetServer = res.socket.server as any;
      
      // Create IO server with more detailed error logging
      // Critical change for Vercel: use only polling transport in production
      const io = new ServerIO(httpServer, {
        path: '/api/socket',
        addTrailingSlash: false,
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: false
        },
        // Force polling transport on Vercel environment
        transports: ['polling'],
        connectTimeout: 20000, // Increase timeout
        pingTimeout: 20000,
        pingInterval: 10000,
        maxHttpBufferSize: 1e8 // 100 MB for larger payloads
      });
      
      // Store IO server instance on the HTTP server object
      res.socket.server.io = io;
      
      // Basic connection setup first
      io.on('connection', (socket) => {
        console.log('Client connected to socket server:', socket.id);
        console.log('Transport used:', socket.conn.transport.name);
        
        socket.on('disconnect', (reason) => {
          console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        });
        
        // Simple ping-pong test event
        socket.on('ping', (callback) => {
          console.log(`Received ping from ${socket.id}`);
          if (typeof callback === 'function') {
            callback({ status: 'ok', timestamp: Date.now() });
          } else {
            socket.emit('pong', { status: 'ok', timestamp: Date.now() });
          }
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