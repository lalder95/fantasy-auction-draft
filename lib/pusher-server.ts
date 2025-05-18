// lib/pusher-server.ts
import Pusher from 'pusher';

// This instance will be used in server environments (API routes)
let pusherServer: Pusher | undefined;

export const getPusherServer = () => {
  if (!pusherServer) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherServer;
};