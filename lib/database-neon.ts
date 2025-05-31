// lib/database-neon.ts - Cleaned version without any Redis/in-memory fallback
import { neon } from '@neondatabase/serverless';
import { Auction, Manager, PlayerUp } from './auction';
import { v4 as uuidv4 } from 'uuid';
import { SleeperPlayer } from './sleeper';
import { sql } from '@vercel/postgres';

// Create a SQL client - fail fast if not configured
const client = neon(process.env.DATABASE_URL!);
export { sql };  // Export sql for use in other files

/**
 * Save auction to database
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  console.log(`Saving auction with ID: ${auction.id} to database`);
  
  try {
    // Start transaction
    await sql`BEGIN`;
    
    // 1. Save the main auction record
    await sql`
      INSERT INTO auctions (
        id, created_at, status, commissioner_id, 
        current_nomination_manager_index, settings
      )
      VALUES (
        ${auction.id}, 
        to_timestamp(${auction.createdAt/1000}), 
        ${auction.status}, 
        ${auction.commissionerId}, 
        ${auction.currentNominationManagerIndex}, 
        ${JSON.stringify(auction.settings)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = ${auction.status},
        commissioner_id = ${auction.commissionerId},
        current_nomination_manager_index = ${auction.currentNominationManagerIndex},
        settings = ${JSON.stringify(auction.settings)}
    `;
    
    // 2. Save managers - Use upsert pattern
    if (auction.managers && auction.managers.length > 0) {
      for (const manager of auction.managers) {
        await sql`
          INSERT INTO managers (
            id, auction_id, name, roster_id, budget, initial_budget, nomination_order
          )
          VALUES (
            ${manager.id},
            ${auction.id},
            ${manager.name},
            ${manager.rosterId},
            ${manager.budget},
            ${manager.initialBudget},
            ${manager.nominationOrder}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = ${manager.name},
            roster_id = ${manager.rosterId},
            budget = ${manager.budget},
            initial_budget = ${manager.initialBudget},
            nomination_order = ${manager.nominationOrder}
        `;
        
        // First delete existing won players for this manager to avoid duplicates
        await sql`
          DELETE FROM manager_won_players WHERE manager_id = ${manager.id}
        `;
        
        // Save won players for this manager
        if (manager.wonPlayers && manager.wonPlayers.length > 0) {
          for (const playerId of manager.wonPlayers) {
            await sql`
              INSERT INTO manager_won_players (manager_id, player_id)
              VALUES (${manager.id}, ${playerId})
              ON CONFLICT (manager_id, player_id) DO NOTHING
            `;
          }
        }
      }
    }
    
    // 3. Save available players - IMPORTANT: Get ALL players, no pagination!
    await sql`BEGIN`;
    try {
      await sql`DELETE FROM available_players WHERE auction_id = ${auction.id}`;
      
      if (auction.availablePlayers && auction.availablePlayers.length > 0) {
        // Log the count we're about to insert
        console.log(`Inserting ${auction.availablePlayers.length} available players for auction ${auction.id}`);
        
        // Insert players in smaller batches to avoid parameter limits
        const batchSize = 50;
        for (let i = 0; i < auction.availablePlayers.length; i += batchSize) {
          const batch = auction.availablePlayers.slice(i, i + batchSize);
          
          // Use the safe tagged template literal syntax
          for (const player of batch) {
            await sql`
              INSERT INTO available_players (
                player_id, auction_id, full_name, position, team, status, years_exp
              ) VALUES (
                ${player.player_id},
                ${auction.id},
                ${player.full_name},
                ${player.position},
                ${player.team || null},
                ${player.status || 'Active'},
                ${player.years_exp || 0}
              )
            `;
          }
        }
        
        // Verify the count after insertion
        const countResult = await sql`
          SELECT COUNT(*) as count FROM available_players WHERE auction_id = ${auction.id}
        `;
        console.log(`Verified ${countResult[0].count} players saved for auction ${auction.id}`);
        
        if (countResult[0].count !== auction.availablePlayers.length) {
          throw new Error(`Player count mismatch after save: expected ${auction.availablePlayers.length}, got ${countResult[0].count}`);
        }
      }
      await sql`COMMIT`;
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
    
    // 4. Save players up for auction
    await sql`DELETE FROM players_up WHERE auction_id = ${auction.id}`;
    
    if (auction.playersUp && auction.playersUp.length > 0) {
      for (const playerUp of auction.playersUp) {
        await sql`
          INSERT INTO players_up (
            player_id, auction_id, name, position, team,
            nominated_by, current_bid, current_bidder,
            start_time, end_time, status, nomination_index
          )
          VALUES (
            ${playerUp.playerId},
            ${auction.id},
            ${playerUp.name},
            ${playerUp.position},
            ${playerUp.team},
            ${playerUp.nominatedBy},
            ${playerUp.currentBid},
            ${playerUp.currentBidder || null},
            to_timestamp(${playerUp.startTime/1000}),
            to_timestamp(${playerUp.endTime/1000}),
            ${playerUp.status},
            ${playerUp.nominationIndex}
          )
        `;
        
        // Save passes for this player
        if (playerUp.passes && playerUp.passes.length > 0) {
          for (const managerId of playerUp.passes) {
            await sql`
              INSERT INTO player_passes (player_id, manager_id)
              VALUES (${playerUp.playerId}, ${managerId})
              ON CONFLICT (player_id, manager_id) DO NOTHING
            `;
          }
        }
      }
    }
    
    // 5. Save completed players
    await sql`DELETE FROM completed_players WHERE auction_id = ${auction.id}`;
    
    if (auction.completedPlayers && auction.completedPlayers.length > 0) {
      for (const player of auction.completedPlayers) {
        await sql`
          INSERT INTO completed_players (
            player_id, auction_id, name, position, team,
            nominated_by, final_bid, winner,
            start_time, end_time, status, nomination_index
          )
          VALUES (
            ${player.playerId},
            ${auction.id},
            ${player.name},
            ${player.position},
            ${player.team},
            ${player.nominatedBy},
            ${player.finalBid},
            ${player.winner},
            to_timestamp(${player.startTime/1000}),
            to_timestamp(${player.endTime/1000}),
            ${player.status},
            ${player.nominationIndex}
          )
        `;
      }
    }
    
    // Commit transaction
    await sql`COMMIT`;
    
    console.log(`Successfully saved auction ${auction.id} and all related data to database`);
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`;
    console.error(`Database save failed for auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from database - fetches ALL data, no pagination
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  console.log(`Fetching auction with ID: ${auctionId} from database`);
  
  try {
    // 1. Get main auction record
    const auctionResults = await sql`SELECT * FROM auctions WHERE id = ${auctionId}`;
    
    if (!auctionResults || auctionResults.length === 0) {
      console.log(`No auction found with ID: ${auctionId} in database`);
      return null;
    }
    
    const auctionData = auctionResults[0];
    
    // 2. Get ALL managers - no limit
    const managersResults = await sql`
      SELECT * FROM managers 
      WHERE auction_id = ${auctionId} 
      ORDER BY nomination_order
    `;
    
    const managers: Manager[] = [];
    
    for (const managerRow of managersResults) {
      // Get won players for this manager
      const wonPlayersResults = await sql`
        SELECT player_id FROM manager_won_players WHERE manager_id = ${managerRow.id}
      `;
      
      const wonPlayers = wonPlayersResults.map((row: any) => row.player_id);
      
      managers.push({
        id: managerRow.id,
        name: managerRow.name,
        rosterId: managerRow.roster_id,
        budget: managerRow.budget,
        initialBudget: managerRow.initial_budget,
        wonPlayers,
        nominationOrder: managerRow.nomination_order,
        avatar: managerRow.avatar
      });
    }
    
    // 3. Get ALL available players - this is the critical part!
    console.log(`Fetching ALL available players for auction ${auctionId}`);
    const availablePlayersResults = await sql`
      SELECT player_id, full_name, position, team, status, years_exp
      FROM available_players 
      WHERE auction_id = ${auctionId}
      ORDER BY full_name
    `;
    
    console.log(`Found ${availablePlayersResults.length} available players in database`);
    
    const availablePlayers: SleeperPlayer[] = availablePlayersResults.map((row: any) => ({
      player_id: row.player_id,
      full_name: row.full_name,
      position: row.position,
      team: row.team,
      status: row.status || 'Active', // Default to 'Active' if not stored
      years_exp: row.years_exp
    }));
    
    // 4. Get players up for auction
    const playersUpResults = await sql`
      SELECT * FROM players_up 
      WHERE auction_id = ${auctionId}
      ORDER BY nomination_index
    `;
    
    const playersUp: PlayerUp[] = [];
    
    for (const playerRow of playersUpResults) {
      // Get passes for this player
      const passesResults = await sql`
        SELECT manager_id FROM player_passes WHERE player_id = ${playerRow.player_id}
      `;
      
      const passes = passesResults.map((row: any) => row.manager_id);
      
      playersUp.push({
        playerId: playerRow.player_id,
        name: playerRow.name,
        position: playerRow.position,
        team: playerRow.team,
        nominatedBy: playerRow.nominated_by,
        currentBid: playerRow.current_bid,
        currentBidder: playerRow.current_bidder,
        passes,
        startTime: new Date(playerRow.start_time).getTime(),
        endTime: new Date(playerRow.end_time).getTime(),
        status: playerRow.status,
        nominationIndex: playerRow.nomination_index
      });
    }
    
    // 5. Get ALL completed players
    const completedPlayersResults = await sql`
      SELECT * FROM completed_players 
      WHERE auction_id = ${auctionId}
      ORDER BY nomination_index
    `;
    
    const completedPlayers = completedPlayersResults.map((row: any) => ({
      playerId: row.player_id,
      name: row.name,
      position: row.position,
      team: row.team,
      nominatedBy: row.nominated_by,
      currentBid: row.final_bid,
      currentBidder: row.winner,
      finalBid: row.final_bid,
      winner: row.winner,
      passes: [],
      startTime: new Date(row.start_time).getTime(),
      endTime: new Date(row.end_time).getTime(),
      status: row.status,
      nominationIndex: row.nomination_index
    }));
    
    // Construct complete auction object
    const auction: Auction = {
      id: auctionData.id,
      createdAt: new Date(auctionData.created_at).getTime(),
      status: auctionData.status,
      commissionerId: auctionData.commissioner_id,
      currentNominationManagerIndex: auctionData.current_nomination_manager_index,
      settings: typeof auctionData.settings === 'string' 
        ? JSON.parse(auctionData.settings) 
        : auctionData.settings,
      managers,
      availablePlayers,
      playersUp,
      completedPlayers
    };
    
    console.log(`Successfully fetched auction ${auctionId} with ${availablePlayers.length} available players`);
    return auction;
    
  } catch (error) {
    console.error(`Failed to get auction ${auctionId}:`, error);
    throw new Error(`Failed to retrieve auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get just the available players count without fetching all data
 */
export async function getAvailablePlayersCount(auctionId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM available_players 
      WHERE auction_id = ${auctionId}
    `;
    
    return Number(result[0].count);
  } catch (error) {
    console.error(`Failed to get player count for auction ${auctionId}:`, error);
    throw error;
  }
}

/**
 * Create a session for a manager
 */
export async function createManagerSession(
  auctionId: string,
  managerId: string
): Promise<string> {
  if (!auctionId || !managerId) {
    throw new Error('Invalid parameters: auctionId and managerId are required');
  }
  
  const sessionId = uuidv4();
  console.log(`Creating manager session for auction ${auctionId}, manager ${managerId}`);
  
  try {
    // Create a session that expires in 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await sql`
      INSERT INTO manager_sessions (id, manager_id, auction_id, expires_at)
      VALUES (${sessionId}, ${managerId}, ${auctionId}, ${expiresAt})
    `;
    
    console.log(`Successfully created manager session: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error(`Failed to create manager session:`, error);
    throw new Error(`Failed to create manager session: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate manager session
 */
export async function validateManagerSession(
  sessionId: string,
  auctionId: string
): Promise<string | null> {
  if (!sessionId || !auctionId) {
    console.log('Invalid parameters: sessionId and auctionId are required');
    return null;
  }
  
  try {
    console.log(`Validating manager session: ${sessionId} for auction: ${auctionId}`);
    
    const sessions = await sql`
      SELECT * FROM manager_sessions 
      WHERE id = ${sessionId} AND auction_id = ${auctionId} AND expires_at > NOW()
    `;
    
    if (sessions && sessions.length > 0) {
      console.log(`Successfully validated session for manager: ${sessions[0].manager_id}`);
      return sessions[0].manager_id;
    }
    
    console.log(`No valid session found with ID: ${sessionId}`);
    return null;
  } catch (error) {
    console.error(`Failed to validate manager session:`, error);
    return null;
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Simple connection test
    const result = await sql`SELECT 1 as test`;
    console.log('Database connection test: PASSED', result);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
