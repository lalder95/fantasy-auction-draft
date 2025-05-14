// lib/database.ts (Corrected exports)
import { Redis } from '@upstash/redis';
import { Auction } from './auction';

// Create a single global Redis client
const redis = new Redis({
  url: 'https://crisp-lacewing-27676.upstash.io',
  token: 'AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA'
});

// Prefix for keys
const AUCTION_PREFIX = 'auction:';
const SESSION_PREFIX = 'session:';

// Log the initialization
console.log('Upstash Redis client initialized directly with hardcoded credentials');

/**
 * Save auction to database
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  try {
    const key = `${AUCTION_PREFIX}${auction.id}`;
    console.log(`Saving auction with key: ${key}`);
    
    // Convert to string
    const auctionData = JSON.stringify(auction);
    
    // Save to Redis
    await redis.set(key, auctionData);
    
    console.log(`Successfully saved auction: ${auction.id}`);
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
    const key = `${AUCTION_PREFIX}${auctionId}`;
    console.log(`Fetching auction with key: ${key}`);
    
    // Get from Redis
    const auctionData = await redis.get<string>(key);
    
    if (!auctionData) {
      console.log(`No auction found with key: ${key}`);
      return null;
    }
    
    console.log(`Successfully retrieved auction: ${auctionId}`);
    return JSON.parse(auctionData) as Auction;
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
    console.log(`Fetching auctions for commissioner: ${commissionerId}`);
    
    // Get all auction keys
    const keys = await redis.keys(`${AUCTION_PREFIX}*`);
    
    if (keys.length === 0) {
      console.log(`No auctions found for commissioner: ${commissionerId}`);
      return [];
    }
    
    // Get all auctions
    const auctionDataArray = await Promise.all(
      keys.map(key => redis.get<string>(key))
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
    const sessionId = `${SESSION_PREFIX}${auctionId}:${managerId}`;
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
    
    const managerId = await redis.get<string>(sessionId);
    
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
    return managerId;
  } catch (error) {
    console.error(`Failed to validate manager session ${sessionId} for auction ${auctionId}:`, error);
    return null;
  }
}

/**
 * Simple test function
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    // Use a simple ping command
    const testKey = 'connection-test';
    const testValue = `test-${Date.now()}`;
    
    await redis.set(testKey, testValue);
    const result = await redis.get<string>(testKey);
    await redis.del(testKey);
    
    const success = result === testValue;
    console.log('Redis connection test:', success ? 'PASSED' : 'FAILED');
    
    return success;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}