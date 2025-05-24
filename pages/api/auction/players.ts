// pages/api/auction/players.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { auctionId, players } = req.body;

  if (!auctionId || !Array.isArray(players)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Remove duplicate player IDs
  const uniquePlayers: Player[] = Array.from(new Map(players.map((p: Player) => [p.id, p])).values());

  try {
    // Delete existing players for the auction
    await sql`DELETE FROM available_players WHERE auction_id = ${auctionId}`;

    // Insert new players
    const insertPromises = uniquePlayers.map((player) =>
      sql`INSERT INTO available_players (auction_id, player_id, name, position, team) VALUES (${auctionId}, ${player.id}, ${player.name}, ${player.position}, ${player.team})`
    );

    await Promise.all(insertPromises);

    // Verify insertion count
    const result = await sql`SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}`;
    const count = parseInt(result[0].count, 10);

    if (count !== uniquePlayers.length) {
      throw new Error('Mismatch in inserted player count');
    }

    res.status(200).json({ message: 'Players inserted successfully' });
  } catch (error) {
    console.error('Error inserting players:', error);
    res.status(500).json({ error: 'Failed to insert players' });
  }
}
