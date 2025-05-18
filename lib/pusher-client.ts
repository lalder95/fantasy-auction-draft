// lib/pusher-client.ts
import Pusher from 'pusher-js';

// This instance will be used in browser environments
let pusherClient: Pusher | undefined;

export const getPusherClient = () => {
  if (!pusherClient) {
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });
  }
  return pusherClient;
};