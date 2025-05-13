// lib/database.ts
import { kv } from '@vercel/kv';
import { Auction } from './auction';

/**
 * Prefix for auction keys in KV store
 */
const AUCTION_PREFIX = 'auction:';

/**
 * Save auction to database
 */
export async function saveAuction(auction: Auction): Promise<void> {
  try {
    await kv.set(`${AUCTION_PREFIX}${auction.id}`, JSON.stringify(auction));
  } catch (error) {
    console.error('Failed to save auction:', error);
    throw new Error('Failed to save auction data');
  }
}

/**
 * Get auction from database
 */
export async function getAuction(auctionId: string): Promise<Auction | null> {
  try {
    const auctionData = await kv.get(`${AUCTION_PREFIX}${auctionId}`);
    
    if (!auctionData) {
      return null;
    }
    
    return JSON.parse(auctionData as string) as Auction;
  } catch (error) {
    console.error('Failed to get auction:', error);
    throw new Error('Failed to retrieve auction data');
  }
}

/**
 * Delete auction from database
 */
export async function deleteAuction(auctionId: string): Promise<void> {
  try {
    await kv.del(`${AUCTION_PREFIX}${auctionId}`);
  } catch (error) {
    console.error('Failed to delete auction:', error);
    throw new Error('Failed to delete auction data');
  }
}

/**
 * Get all auctions for a commissioner
 */
export async function getCommissionerAuctions(commissionerId: string): Promise<Auction[]> {
  try {
    // Get all auction keys
    const keys = await kv.keys(`${AUCTION_PREFIX}*`);
    
    // No auctions found
    if (keys.length === 0) {
      return [];
    }
    
    // Get all auctions
    const auctionDataArray = await Promise.all(
      keys.map(key => kv.get(key))
    );
    
    // Filter for commissioner's auctions
    const commissionerAuctions = auctionDataArray
      .filter(data => data !== null)
      .map(data => JSON.parse(data as string) as Auction)
      .filter(auction => auction.commissionerId === commissionerId);
    
    return commissionerAuctions;
  } catch (error) {
    console.error('Failed to get commissioner auctions:', error);
    throw new Error('Failed to retrieve commissioner auctions');
  }
}

/**
 * Create a session for a manager
 */
export async function createManagerSession(
  auctionId: string,
  managerId: string
): Promise<string> {
  try {
    const sessionId = `session:${auctionId}:${managerId}`;
    await kv.set(sessionId, managerId, { ex: 86400 }); // Expire in 24 hours
    return sessionId;
  } catch (error) {
    console.error('Failed to create manager session:', error);
    throw new Error('Failed to create manager session');
  }
}

/**
 * Validate manager session
 */
export async function validateManagerSession(
  sessionId: string,
  auctionId: string
): Promise<string | null> {
  try {
    const managerId = await kv.get(sessionId);
    
    if (!managerId) {
      return null;
    }
    
    // Verify this session is for the correct auction
    if (!sessionId.includes(auctionId)) {
      return null;
    }
    
    return managerId as string;
  } catch (error) {
    console.error('Failed to validate manager session:', error);
    return null;
  }
}