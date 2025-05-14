// lib/database.ts (Updated with better error handling)
import { Redis } from '@upstash/redis';
import { Auction } from './auction';

// More robust Redis initialization with error handling
let redis: Redis;

try {
  // First try to initialize from environment variables
  redis = Redis.fromEnv();
  console.log('Redis initialized successfully from environment variables');
} catch (error) {
  console.error('Failed to initialize Redis from environment variables:', error);
  
  // Fallback to direct initialization if environment variables aren't available
  // You'll need to replace these placeholders with your actual Redis URL and token
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://your-redis-url.upstash.io';
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'your-redis-token';
  
  redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  });
  
  console.log('Redis initialized with fallback configuration');
}

// Prefix for auction keys in Redis store
const AUCTION_PREFIX = 'auction:';

/**
 * Save auction to database with better error handling
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  try {
    const key = `${AUCTION_PREFIX}${auction.id}`;
    console.log(`Saving auction with key: ${key}`);
    
    // Convert to string for storage
    const auctionData = JSON.stringify(auction);
    
    await redis.set(key, auctionData);
    console.log(`Successfully saved auction: ${auction.id}`);
  } catch (error) {
    console.error(`Failed to save auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from database with better error handling
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    const key = `${AUCTION_PREFIX}${auctionId}`;
    console.log(`Fetching auction with key: ${key}`);
    
    const auctionData = await redis.get(key);
    
    if (!auctionData) {
      console.log(`No auction found with key: ${key}`);
      return null;
    }
    
    console.log(`Successfully retrieved auction: ${auctionId}`);
    return JSON.parse(auctionData as string) as Auction;
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
    const key = `${AUCTION_PREFIX}${auctionId}`;
    console.log(`Deleting auction with key: ${key}`);
    
    await redis.del(key);
    console.log(`Successfully deleted auction: ${auctionId}`);
  } catch (error) {
    console.error(`Failed to delete auction ${auctionId}:`, error);
    throw new Error(`Failed to delete auction data: ${error instanceof Error ? error.message : String(error)}`);
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
    // Get all auction keys
    console.log(`Fetching auctions for commissioner: ${commissionerId}`);
    const keys = await redis.keys(`${AUCTION_PREFIX}*`);
    
    // No auctions found
    if (keys.length === 0) {
      console.log(`No auctions found for commissioner: ${commissionerId}`);
      return [];
    }
    
    // Get all auctions
    const auctionDataArray = await Promise.all(
      keys.map(key => redis.get(key))
    );
    
    // Filter for commissioner's auctions
    const commissionerAuctions = auctionDataArray
      .filter(data => data !== null)
      .map(data => JSON.parse(data as string) as Auction)
      .filter(auction => auction.commissionerId === commissionerId);
    
    console.log(`Found ${commissionerAuctions.length} auctions for commissioner: ${commissionerId}`);
    return commissionerAuctions;
  } catch (error) {
    console.error(`Failed to get commissioner auctions for ${commissionerId}:`, error);
    throw new Error(`Failed to retrieve commissioner auctions: ${error instanceof Error ? error.message : String(error)}`);
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
    const sessionId = `session:${auctionId}:${managerId}`;
    console.log(`Creating manager session: ${sessionId}`);
    
    await redis.set(sessionId, managerId, { ex: 86400 }); // Expire in 24 hours
    console.log(`Successfully created manager session: ${sessionId}`);
    
    return sessionId;
  } catch (error) {
    console.error(`Failed to create manager session for auction ${auctionId}, manager ${managerId}:`, error);
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
    
    const managerId = await redis.get(sessionId);
    
    if (!managerId) {
      console.log(`No manager ID found for session: ${sessionId}`);
      return null;
    }
    
    // Verify this session is for the correct auction
    if (!sessionId.includes(auctionId)) {
      console.log(`Session ${sessionId} does not match auction ${auctionId}`);
      return null;
    }
    
    console.log(`Successfully validated session for manager: ${managerId}`);
    return managerId as string;
  } catch (error) {
    console.error(`Failed to validate manager session ${sessionId} for auction ${auctionId}:`, error);
    return null;
  }
}