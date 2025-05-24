// pages/api/auction/fix-player-count.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { auctionId, forceFix } = req.body;

  if (!auctionId) {
    return res.status(400).json({ error: 'Auction ID is required' });
  }

  try {
    const availableResult = await sql`SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}`;
    const upResult = await sql`SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}`;
    const completedResult = await sql`SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}`;

    const availableCount = parseInt(availableResult[0].count, 10);
    const upCount = parseInt(upResult[0].count, 10);
    const completedCount = parseInt(completedResult[0].count, 10);

    const totalCount = availableCount + upCount + completedCount;

    const expectedResult = await sql`SELECT expected_total FROM auctions WHERE id = ${auctionId}`;
    const expectedTotal = parseInt(expectedResult[0].expected_total, 10);

    if (forceFix || totalCount !== expectedTotal) {
      await sql`
        UPDATE auctions
        SET expected_total = ${totalCount},
            available_count = ${availableCount},
            up_count = ${upCount},
            completed_count = ${completedCount}
        WHERE id = ${auctionId}
      `;
    }

    res.status(200).json({ message: 'Player counts verified and updated if necessary' });
  } catch (error) {
    console.error('Error fixing player counts:', error);
    res.status(500).json({ error: 'Failed to fix player counts' });
  }
}
