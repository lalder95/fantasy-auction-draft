// pages/api/auction/fix-player-count.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId } = req.body;
  
  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Auction ID is required' });
  }
  
  try {
    const sql = neon(process.env.DATABASE_URL || '');
    
    console.log(`Starting player count fix for auction ${auctionId}`);
    
    // Start transaction
    await sql`BEGIN`;
    
    try {
      // 1. Remove any duplicate player records
      console.log('Checking for duplicate players...');
      const duplicates = await sql`
        WITH duplicates AS (
          SELECT player_id, 
                 ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY player_id) as rn
          FROM available_players
          WHERE auction_id = ${auctionId}
        )
        DELETE FROM available_players
        WHERE auction_id = ${auctionId}
          AND player_id IN (
            SELECT player_id FROM duplicates WHERE rn > 1
          )
        RETURNING player_id
      `;
      
      if (duplicates.length > 0) {
        console.log(`Removed ${duplicates.length} duplicate player records`);
      }
      
      // 2. Get the actual counts
      const playerCounts = await sql`
        SELECT
          (SELECT COUNT(DISTINCT player_id) FROM available_players WHERE auction_id = ${auctionId}) AS available_count,
          (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) AS players_up_count,
          (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}) AS completed_count
      `;
      
      const counts = playerCounts[0];
      const availableCount = Number(counts.available_count);
      const playersUpCount = Number(counts.players_up_count);
      const completedCount = Number(counts.completed_count);
      const totalCount = availableCount + playersUpCount + completedCount;
      
      console.log(`Current counts - Available: ${availableCount}, Up: ${playersUpCount}, Completed: ${completedCount}, Total: ${totalCount}`);
      
      // 3. Update the auction settings with the correct counts
      await sql`
        UPDATE auctions
        SET settings = jsonb_set(
          jsonb_set(
            jsonb_set(
              settings,
              '{totalPlayers}',
              to_jsonb(${totalCount}::int)
            ),
            '{availablePlayersCount}',
            to_jsonb(${availableCount}::int)
          ),
          '{playerCountLastVerified}',
          to_jsonb(NOW()::text)
        )
        WHERE id = ${auctionId}
      `;
      
      console.log('Updated auction settings with correct player counts');
      
      // 4. If there's an expectedPlayerCount, log the difference
      const auctionData = await sql`
        SELECT settings FROM auctions WHERE id = ${auctionId}
      `;
      
      if (auctionData[0]?.settings?.expectedPlayerCount) {
        const expected = Number(auctionData[0].settings.expectedPlayerCount);
        if (expected !== availableCount) {
          console.log(`WARNING: Expected ${expected} available players but found ${availableCount}`);
          
          // Update expected count to match reality
          await sql`
            UPDATE auctions
            SET settings = jsonb_set(
              settings,
              '{expectedPlayerCount}',
              to_jsonb(${availableCount}::int)
            )
            WHERE id = ${auctionId}
          `;
        }
      }
      
      // Commit transaction
      await sql`COMMIT`;
      
      console.log(`Successfully fixed player counts for auction ${auctionId}`);
      
      return res.status(200).json({
        success: true,
        message: 'Player counts fixed successfully',
        counts: {
          available: availableCount,
          playersUp: playersUpCount,
          completed: completedCount,
          total: totalCount
        },
        duplicatesRemoved: duplicates.length
      });
      
    } catch (error) {
      // Rollback on error
      await sql`ROLLBACK`;
      throw error;
    }
    
  } catch (error) {
    console.error('Error fixing player counts:', error);
    return res.status(500).json({
      message: 'Failed to fix player counts',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}