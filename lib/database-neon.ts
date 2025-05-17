// lib/database-neon.ts - Simplified version for troubleshooting
import { neon } from '@neondatabase/serverless';
import { Auction, Manager, PlayerUp } from './auction';
import { v4 as uuidv4 } from 'uuid';
import { SleeperPlayer } from './sleeper';

// Create a SQL client
const sql = neon(process.env.DATABASE_URL || '');

/**
 * Save auction to database - Simplified for troubleshooting
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  try {
    console.log(`Saving auction with ID: ${auction.id} - SIMPLIFIED VERSION`);
    
    // Just insert/update the auction without related data for testing
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
    
    console.log(`Successfully saved basic auction: ${auction.id}`);
    return;
  } catch (error) {
    console.error(`Failed to save auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from database
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    console.log(`Fetching auction with ID: ${auctionId}`);
    
    // Get auction
    const auctionResult = await sql`SELECT * FROM auctions WHERE id = ${auctionId}`;
    
    if (auctionResult.length === 0) {
      console.log(`No auction found with ID: ${auctionId}`);
      return null;
    }
    
    const auctionData = auctionResult[0];
    
    // For troubleshooting, return a minimal auction object
    const auction: Auction = {
      id: auctionData.id,
      createdAt: new Date(auctionData.created_at).getTime(),
      status: auctionData.status as 'setup' | 'active' | 'paused' | 'completed',
      commissionerId: auctionData.commissioner_id,
      currentNominationManagerIndex: auctionData.current_nomination_manager_index,
      settings: typeof auctionData.settings === 'string' 
        ? JSON.parse(auctionData.settings) 
        : auctionData.settings,
      managers: [],
      playersUp: [],
      completedPlayers: [],
      availablePlayers: [],
    };
    
    console.log(`Successfully retrieved basic auction: ${auctionId}`);
    return auction;
  } catch (error) {
    console.error(`Failed to get auction ${auctionId}:`, error);
    throw new Error(`Failed to retrieve auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete auction from database
 */
export async function deleteAuction(auctionId: string): Promise<void> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    console.log(`Deleting auction with ID: ${auctionId}`);
    
    // Due to cascade delete, this will remove all related data
    await sql`DELETE FROM auctions WHERE id = ${auctionId}`;
    
    console.log(`Successfully deleted auction: ${auctionId}`);
  } catch (error) {
    console.error(`Failed to delete auction ${auctionId}:`, error);
    throw new Error(`Failed to delete auction data: ${error instanceof Error ? error.message : String(error)}`);
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
  
  try {
    console.log(`Creating manager session for auction ${auctionId}, manager ${managerId}`);
    
    // Create a session that expires in 24 hours
    const sessionId = uuidv4();
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
    
    if (sessions.length === 0) {
      console.log(`No valid session found with ID: ${sessionId}`);
      return null;
    }
    
    console.log(`Successfully validated session for manager: ${sessions[0].manager_id}`);
    return sessions[0].manager_id;
  } catch (error) {
    console.error(`Failed to validate manager session:`, error);
    return null;
  }
}

/**
 * Get all auctions for a commissioner
 */
export async function getCommissionerAuctions(commissionerId: string): Promise<Auction[]> {
  if (!commissionerId) {
    throw new Error('Invalid commissioner ID: Missing or empty');
  }
  
  try {
    console.log(`Fetching auctions for commissioner: ${commissionerId}`);
    
    const auctionResults = await sql`
      SELECT id FROM auctions WHERE commissioner_id = ${commissionerId}
    `;
    
    if (auctionResults.length === 0) {
      console.log(`No auctions found for commissioner: ${commissionerId}`);
      return [];
    }
    
    // Get full auction data for each auction
    const auctions: Auction[] = [];
    for (const result of auctionResults) {
      const auction = await getAuction(result.id);
      if (auction) {
        auctions.push(auction);
      }
    }
    
    console.log(`Found ${auctions.length} auctions for commissioner: ${commissionerId}`);
    return auctions;
  } catch (error) {
    console.error(`Failed to get commissioner auctions for ${commissionerId}:`, error);
    throw new Error(`Failed to retrieve commissioner auctions: ${error instanceof Error ? error.message : String(error)}`);
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