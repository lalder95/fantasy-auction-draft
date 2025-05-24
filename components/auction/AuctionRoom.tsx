// components/AuctionRoom.tsx

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import axios from 'axios';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
}

interface AuctionData {
  availablePlayers: Player[];
  playersUp: Player[];
  completedPlayers: Player[];
  expectedTotal: number;
}

export default function AuctionRoom({ auctionId }: { auctionId: string }) {
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      try {
        const { data } = await axios.get(`/api/auction/${auctionId}`);
        setAuctionData(data);
      } catch (error) {
        console.error('Error fetching auction data:', error);
      }
    };

    fetchData();

    // Setup Pusher for real-time updates
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`auction-${auctionId}`);

    channel.bind('player-updated', (updatedPlayer: Player) => {
      setAuctionData((prev) => {
        if (!prev) return prev;

        // Update player lists based on the event
        const updatedAvailable = prev.availablePlayers.filter((p) => p.id !== updatedPlayer.id);
        const updatedUp = [...prev.playersUp, updatedPlayer];

        return {
          ...prev,
          availablePlayers: updatedAvailable,
          playersUp: updatedUp,
        };
      });
    });

    return () => {
      pusher.unsubscribe(`auction-${auctionId}`);
    };
  }, [auctionId]);

  if (!auctionData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Auction Room</h1>
      <p>Available Players: {auctionData.availablePlayers.length}</p>
      <p>Players Up: {auctionData.playersUp.length}</p>
      <p>Completed Players: {auctionData.completedPlayers.length}</p>
      {/* Render player lists as needed */}
    </div>
  );
}
