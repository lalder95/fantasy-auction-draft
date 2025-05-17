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
  if (!res.socket.server.io) {
    console.log('New Socket.io server...');
    // Initialize socket server
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    res.socket.server.io = io;
    
    // Add event handlers - Load dynamically to ensure latest version
    const { initSocketHandlers } = await import('../../lib/socket-handlers');
    initSocketHandlers(io);

    console.log('Socket.IO server initialized and handlers attached');
  } else {
    console.log('Socket.IO server already running');
  }
  
  res.end();
}