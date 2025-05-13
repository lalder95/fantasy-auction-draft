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
    });
    res.socket.server.io = io;
    
    // Add event handlers
    io.on('connection', (socket) => {
      console.log('Socket connected:', socket.id);
      
      // Add socket event handlers here - similar to lib/socket.ts
      // but simplified for API route context
    });
  }
  
  res.end();
}