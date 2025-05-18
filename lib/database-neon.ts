// lib/database-neon.ts - Improved Error Handling
import { neon } from '@neondatabase/serverless';
import { Auction, Manager, PlayerUp } from './auction';
import { v4 as uuidv4 } from 'uuid';
import { SleeperPlayer } from './sleeper';

// Create a SQL client - handle missing DATABASE_URL gracefully
let sql: any;
try {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('WARNING: DATABASE_URL is not set. Using in-memory fallback storage.');
    // Will use in-memory storage fallback below
  } else {
    sql = neon(dbUrl);
    console.log('Database client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize database client:', error);
  // Will use in-memory storage fallback below
}

// In-memory fallback storage for development/testing when DB connection fails
const inMemoryStorage: Record<string, any> = {};

/**
 * Save auction to database with fallback
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  try {
    // If SQL client is available, try to save to database
    if (sql) {
      console.log(`Saving auction with ID: ${auction.id} to database`);
      
      try {
        // Attempt to use database first
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
        
        console.log(`Successfully saved auction ${auction.id} to database`);
        return;
      } catch (dbError) {
        console.error(`Database save failed for auction ${auction.id}, using in-memory fallback:`, dbError);
        // Continue to fallback below
      }
    }
    
    // Fallback to in-memory storage if database failed or not available
    console.log(`Saving auction with ID: ${auction.id} to in-memory storage`);
    inMemoryStorage[`auction:${auction.id}`] = JSON.stringify(auction);
    console.log(`Successfully saved auction ${auction.id} to in-memory storage`);
    
  } catch (error) {
    console.error(`Failed to save auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from database with fallback
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    // If SQL client is available, try to get from database
    if (sql) {
      console.log(`Fetching auction with ID: ${auctionId} from database`);
      
      try {
        // Try database first
        const auctionResult = await sql`SELECT * FROM auctions WHERE id = ${auctionId}`;
        
        if (auctionResult && auctionResult.length > 0) {
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
          
          console.log(`Successfully retrieved auction: ${auctionId} from database`);
          return auction;
        }
      } catch (dbError) {
        console.error(`Database fetch failed for auction ${auctionId}, using in-memory fallback:`, dbError);
        // Continue to fallback below
      }
    }
    
    // Fallback to in-memory storage if database failed or not available
    console.log(`Fetching auction with ID: ${auctionId} from in-memory storage`);
    const auctionStr = inMemoryStorage[`auction:${auctionId}`];
    
    if (auctionStr) {
      const auction = JSON.parse(auctionStr) as Auction;
      console.log(`Successfully retrieved auction: ${auctionId} from in-memory storage`);
      return auction;
    }
    
    console.log(`No auction found with ID: ${auctionId} in either database or in-memory storage`);
    return null;
  } catch (error) {
    console.error(`Failed to get auction ${auctionId}:`, error);
    throw new Error(`Failed to retrieve auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a session for a manager with fallback
 */
export async function createManagerSession(
  auctionId: string,
  managerId: string
): Promise<string> {
  if (!auctionId || !managerId) {
    throw new Error('Invalid parameters: auctionId and managerId are required');
  }
  
  try {
    const sessionId = uuidv4();
    console.log(`Creating manager session for auction ${auctionId}, manager ${managerId}`);
    
    if (sql) {
      try {
        // Create a session that expires in 24 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        await sql`
          INSERT INTO manager_sessions (id, manager_id, auction_id, expires_at)
          VALUES (${sessionId}, ${managerId}, ${auctionId}, ${expiresAt})
        `;
        
        console.log(`Successfully created manager session in database: ${sessionId}`);
        return sessionId;
      } catch (dbError) {
        console.error('Database session creation failed, using in-memory fallback:', dbError);
        // Continue to fallback below
      }
    }
    
    // Fallback to in-memory storage
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    inMemoryStorage[`session:${sessionId}`] = JSON.stringify({
      managerId,
      auctionId,
      expiresAt
    });
    
    console.log(`Successfully created manager session in memory: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error(`Failed to create manager session:`, error);
    throw new Error(`Failed to create manager session: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate manager session with fallback
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
    
    if (sql) {
      try {
        const sessions = await sql`
          SELECT * FROM manager_sessions 
          WHERE id = ${sessionId} AND auction_id = ${auctionId} AND expires_at > NOW()
        `;
        
        if (sessions && sessions.length > 0) {
          console.log(`Successfully validated session for manager: ${sessions[0].manager_id} from database`);
          return sessions[0].manager_id;
        }
      } catch (dbError) {
        console.error('Database session validation failed, using in-memory fallback:', dbError);
        // Continue to fallback below
      }
    }
    
    // Fallback to in-memory storage
    const sessionStr = inMemoryStorage[`session:${sessionId}`];
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      
      if (session.auctionId === auctionId && session.expiresAt > Date.now()) {
        console.log(`Successfully validated session for manager: ${session.managerId} from memory`);
        return session.managerId;
      }
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
  if (!sql) {
    console.warn('Database client not initialized, using in-memory fallback');
    return false;
  }
  
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