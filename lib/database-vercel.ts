// lib/database-vercel.ts
// Simplified database implementation for Vercel
import { Auction } from './auction';

// We'll use in-memory storage for development and testing
// This won't persist across serverless function invocations in production!
const auctionStore: Record<string, Auction> = {};
const sessionStore: Record<string, { managerId: string, auctionId: string, expires: Date }> = {};

/**
 * Save auction to "database" (in-memory for now)
 */
export async function saveAuction(auction: Auction): Promise<void> {
  if (!auction || !auction.id) {
    throw new Error('Invalid auction data: Missing auction or auction ID');
  }
  
  try {
    console.log(`Saving auction with ID: ${auction.id}`);
    
    // Store the auction
    auctionStore[auction.id] = JSON.parse(JSON.stringify(auction));
    
    console.log(`Successfully saved auction: ${auction.id}`);
  } catch (error) {
    console.error(`Failed to save auction ${auction.id}:`, error);
    throw new Error(`Failed to save auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get auction from "database" (in-memory for now)
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    console.log(`Fetching auction with ID: ${auctionId}`);
    
    // Get auction 
    const auction = auctionStore[auctionId];
    
    if (!auction) {
      console.log(`No auction found with ID: ${auctionId}`);
      return null;
    }
    
    console.log(`Successfully retrieved auction: ${auctionId}`);
    return auction;
  } catch (error) {
    console.error(`Failed to get auction ${auctionId}:`, error);
    throw new Error(`Failed to retrieve auction data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete auction from "database" (in-memory for now)
 */
export async function deleteAuction(auctionId: string): Promise<void> {
  if (!auctionId) {
    throw new Error('Invalid auction ID: Missing or empty');
  }
  
  try {
    console.log(`Deleting auction with ID: ${auctionId}`);
    
    // Delete the auction
    delete auctionStore[auctionId];
    
    // Delete any sessions associated with this auction
    Object.keys(sessionStore).forEach(sessionId => {
      if (sessionStore[sessionId].auctionId === auctionId) {
        delete sessionStore[sessionId];
      }
    });
    
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
    
    // Create a simple session ID
    const sessionId = `session_${auctionId}_${managerId}_${Date.now()}`;
    
    // Set expiration date (24 hours from now)
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    
    // Store the session
    sessionStore[sessionId] = {
      managerId,
      auctionId,
      expires
    };
    
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
    
    // Get session
    const session = sessionStore[sessionId];
    
    // Check if session exists, matches auction ID, and is not expired
    if (!session || session.auctionId !== auctionId || new Date() > session.expires) {
      console.log(`No valid session found with ID: ${sessionId}`);
      return null;
    }
    
    console.log(`Successfully validated session for manager: ${session.managerId}`);
    return session.managerId;
  } catch (error) {
    console.error(`Failed to validate manager session:`, error);
    return null;
  }
}

/**
 * Get all auctions for a commissioner (in-memory for now)
 */
export async function getCommissionerAuctions(commissionerId: string): Promise<Auction[]> {
  if (!commissionerId) {
    throw new Error('Invalid commissioner ID: Missing or empty');
  }
  
  try {
    console.log(`Fetching auctions for commissioner: ${commissionerId}`);
    
    // Filter auctions by commissioner ID
    const auctions = Object.values(auctionStore).filter(
      auction => auction.commissionerId === commissionerId
    );
    
    console.log(`Found ${auctions.length} auctions for commissioner: ${commissionerId}`);
    return auctions;
  } catch (error) {
    console.error(`Failed to get commissioner auctions for ${commissionerId}:`, error);
    throw new Error(`Failed to retrieve commissioner auctions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple test function
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Simple in-memory test
    const testId = `test_${Date.now()}`;
    auctionStore[testId] = { id: testId } as any;
    const exists = !!auctionStore[testId];
    delete auctionStore[testId];
    console.log('In-memory database test: PASSED');
    return exists;
  } catch (error) {
    console.error('In-memory database test failed:', error);
    return false;
  }
}