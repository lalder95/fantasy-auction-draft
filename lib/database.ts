// lib/database.ts (Direct implementation using fetch)
import { Auction } from './auction';

// Upstash Redis credentials
const UPSTASH_URL = 'https://crisp-lacewing-27676.upstash.io';
const UPSTASH_TOKEN = 'AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA';

// Prefix for keys
const AUCTION_PREFIX = 'auction:';
const SESSION_PREFIX = 'session:';

// Helper to make Upstash REST API calls
async function upstashFetch(command: string, ...args: any[]): Promise<any> {
  // URL encode all arguments
  const encodedArgs = args.map(arg => encodeURIComponent(String(arg)));
  
  // Build the URL with command and args
  const url = `${UPSTASH_URL}/${command}/${encodedArgs.join('/')}`;
  
  // Make the fetch request with the authorization header
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`
    }
  });
  
  // Parse the response
  const data = await response.json();
  
  // Check for errors
  if (data.error) {
    throw new Error(`Upstash error: ${data.error}`);
  }
  
  // Return the result
  return data.result;
}

/**
 * Save auction to database using fetch
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
    
    // Save using POST to handle JSON data properly
    const url = `${UPSTASH_URL}/set/${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: auctionData
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Failed to save auction: ${data.error}`);
    }
    
    console.log(`Successfully saved auction: ${auction.id}`);
  } catch (error) {
    console.error(`Failed to save auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from database using fetch
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    const key = `${AUCTION_PREFIX}${auctionId}`;
    console.log(`Fetching auction with key: ${key}`);
    
    // Get using upstashFetch helper
    const result = await upstashFetch('get', key);
    
    if (!result) {
      console.log(`No auction found with key: ${key}`);
      return null;
    }
    
    console.log(`Successfully retrieved auction: ${auctionId}`);
    return JSON.parse(result) as Auction;
  } catch (error) {
    console.error(`Failed to get auction ${auctionId}:`, error);
    throw new Error(`Failed to retrieve auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete auction from database using fetch
 */
export async function deleteAuction(auctionId: string): Promise<void> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    const key = `${AUCTION_PREFIX}${auctionId}`;
    console.log(`Deleting auction with key: ${key}`);
    
    // Delete using upstashFetch helper
    await upstashFetch('del', key);
    
    console.log(`Successfully deleted auction: ${auctionId}`);
  } catch (error) {
    console.error(`Failed to delete auction ${auctionId}:`, error);
    throw new Error(`Failed to delete auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all auctions for a commissioner using fetch
 */
export async function getCommissionerAuctions(commissionerId: string): Promise<Auction[]> {
  if (!commissionerId) {
    throw new Error('Invalid commissioner ID: Missing or empty');
  }
  
  try {
    console.log(`Fetching auctions for commissioner: ${commissionerId}`);
    
    // Get all keys with the auction prefix
    const keys = await upstashFetch('keys', `${AUCTION_PREFIX}*`);
    
    if (!keys || keys.length === 0) {
      console.log(`No auctions found for commissioner: ${commissionerId}`);
      return [];
    }
    
    // Get all auction data
    const auctions: Auction[] = [];
    
    for (const key of keys) {
      try {
        const auctionData = await upstashFetch('get', key);
        if (auctionData) {
          const auction = JSON.parse(auctionData) as Auction;
          if (auction.commissionerId === commissionerId) {
            auctions.push(auction);
          }
        }
      } catch (parseError) {
        console.error(`Failed to parse auction data for key ${key}:`, parseError);
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
 * Create a session for a manager using fetch
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
    
    // Set with EX parameter for expiry (24 hours = 86400 seconds)
    await upstashFetch('setex', sessionId, 86400, managerId);
    
    console.log(`Successfully created manager session: ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error(`Failed to create manager session for auction ${auctionId}, manager ${managerId}:`, error);
    throw new Error(`Failed to create manager session: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate manager session using fetch
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
    
    // Get session data
    const managerId = await upstashFetch('get', sessionId);
    
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
 * Simple test function using fetch
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    // Use a simple ping command
    const testKey = 'connection-test';
    const testValue = `test-${Date.now()}`;
    
    // Set a test value
    await upstashFetch('set', testKey, testValue);
    
    // Get the test value
    const result = await upstashFetch('get', testKey);
    
    // Clean up
    await upstashFetch('del', testKey);
    
    // Check if the result matches
    const success = result === testValue;
    console.log('Redis connection test:', success ? 'PASSED' : 'FAILED');
    
    return success;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}