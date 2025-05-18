// pages/api/test-players.ts - Test endpoint to add sample players directly
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
    // Get database client
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Check if the auction exists
    const auctionResult = await sql`SELECT id FROM auctions WHERE id = ${auctionId}`;
    
    if (!auctionResult || auctionResult.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Create sample players for testing
    const samplePlayers = [
      { player_id: 'test1', full_name: 'Patrick Mahomes', position: 'QB', team: 'KC', years_exp: 5 },
      { player_id: 'test2', full_name: 'Travis Kelce', position: 'TE', team: 'KC', years_exp: 10 },
      { player_id: 'test3', full_name: 'Christian McCaffrey', position: 'RB', team: 'SF', years_exp: 6 },
      { player_id: 'test4', full_name: 'Justin Jefferson', position: 'WR', team: 'MIN', years_exp: 3 },
      { player_id: 'test5', full_name: 'Tyreek Hill', position: 'WR', team: 'MIA', years_exp: 7 },
    ];
    
    // Start transaction
    await sql`BEGIN`;
    
    // Clear existing test players
    await sql`DELETE FROM available_players WHERE auction_id = ${auctionId} AND player_id LIKE 'test%'`;
    
    // Insert sample players
    for (const player of samplePlayers) {
      await sql`
        INSERT INTO available_players (
          player_id, auction_id, full_name, position, team, years_exp
        )
        VALUES (
          ${player.player_id},
          ${auctionId},
          ${player.full_name},
          ${player.position},
          ${player.team},
          ${player.years_exp}
        )
      `;
    }
    
    // Commit transaction
    await sql`COMMIT`;
    
    return res.status(200).json({
      success: true,
      message: `Added ${samplePlayers.length} sample players to auction ${auctionId}`,
      players: samplePlayers
    });
  } catch (error) {
    console.error('Error adding sample players:', error);
    return res.status(500).json({
      message: 'Failed to add sample players',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}