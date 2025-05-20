// pages/api/auction/player-stats-diagnostic.ts - Enhanced diagnostic endpoint
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { auctionId } = req.query;
  
  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Auction ID is required' });
  }
  
  try {
    // Get database connection
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Log start of diagnostic process
    console.log(`Starting player count diagnostic for auction ${auctionId}`);
    
    // First verify the auction exists
    const auctionCheck = await sql`
      SELECT id, settings FROM auctions WHERE id = ${auctionId}
    `;
    
    if (auctionCheck.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    const settings = auctionCheck[0].settings;
    const expectedPlayerCount = settings.expectedPlayerCount || settings.totalPlayers || null;
    
    console.log(`Auction settings has expectedPlayerCount: ${expectedPlayerCount !== null ? 'Yes' : 'No'}`);
    
    // DIAGNOSTIC: Check for duplicate player records
    const duplicateCheck = await sql`
      SELECT player_id, COUNT(*) as count 
      FROM available_players 
      WHERE auction_id = ${auctionId}
      GROUP BY player_id
      HAVING COUNT(*) > 1
    `;
    
    const hasDuplicates = duplicateCheck.length > 0;
    console.log(`Duplicate check: ${hasDuplicates ? `Found ${duplicateCheck.length} duplicated player IDs` : 'No duplicates found'}`);
    
    // DIAGNOSTIC: Random sample of available players
    const randomSample = await sql`
      SELECT player_id, full_name, position 
      FROM available_players 
      WHERE auction_id = ${auctionId}
      ORDER BY RANDOM()
      LIMIT 5
    `;
    
    console.log(`Random sample check: Found ${randomSample.length} sample players`);
    
    // DIAGNOSTIC: Compare direct count vs. select all rows and count in code
    const directCount = await sql`
      SELECT COUNT(*) as count FROM available_players WHERE auction_id = ${auctionId}
    `;
    
    // For very large auctions, limit this query
    const allPlayerIds = await sql`
      SELECT player_id FROM available_players WHERE auction_id = ${auctionId}
    `;
    
    const codeCount = allPlayerIds.length;
    
    console.log(`Count comparison: Direct SQL count=${directCount[0].count}, Code count=${codeCount}`);
    
    // DIAGNOSTIC: Check if any transactions are currently active on this auction
    const activeTx = await sql`
      SELECT txid_current() as current_txid,
             pg_blocking_pids(pid) as blocked_by
      FROM pg_stat_activity
      WHERE application_name = 'neon' AND state = 'active'
    `;
    
    console.log(`Active transactions check: ${activeTx.length} active transactions found`);
    
    // Run the standard player stats query
    const playerCounts = await sql`
      SELECT
        (SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}) AS available_count,
        (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) AS players_up_count,
        (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId}) AS completed_count,
        (
          (SELECT COUNT(*) FROM available_players WHERE auction_id = ${auctionId}) +
          (SELECT COUNT(*) FROM players_up WHERE auction_id = ${auctionId}) +
          (SELECT COUNT(*) FROM completed_players WHERE auction_id = ${auctionId})
        ) AS total_count
    `;
    
    if (!playerCounts || playerCounts.length === 0) {
      return res.status(404).json({ message: 'Failed to retrieve player counts' });
    }
    
    const counts = playerCounts[0];
    console.log(`Player counts from query: Available=${counts.available_count}, Up=${counts.players_up_count}, Completed=${counts.completed_count}, Total=${counts.total_count}`);
    
    // Check if there's a mismatch with expected count
    if (expectedPlayerCount !== null && Number(counts.available_count) !== Number(expectedPlayerCount)) {
      console.log(`MISMATCH DETECTED: Expected ${expectedPlayerCount} available players, found ${counts.available_count}`);
    }
    
    // Return the diagnostic results
    return res.status(200).json({
      success: true,
      auctionId,
      expectedPlayerCount,
      availablePlayers: Number(counts.available_count),
      playersUp: Number(counts.players_up_count),
      completedPlayers: Number(counts.completed_count),
      totalPlayers: Number(counts.total_count),
      diagnostics: {
        hasDuplicates,
        duplicateCount: hasDuplicates ? duplicateCheck.length : 0,
        sampleDuplicates: hasDuplicates ? duplicateCheck.slice(0, 3) : [],
        directCount: Number(directCount[0].count),
        codeCount,
        countMatch: Number(directCount[0].count) === codeCount,
        activeTransactions: activeTx.length,
        randomSample
      }
    });
  } catch (error) {
    console.error('Error in player stats diagnostic:', error);
    return res.status(500).json({
      message: 'Failed to get player statistics diagnostic',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}