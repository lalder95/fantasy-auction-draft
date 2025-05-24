// lib/database-neon.ts

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Define the Auction interface
export interface Auction {
  id: string;
  name: string;
  expected_total: number;
  available_count: number;
  up_count: number;
  completed_count: number;
  // Add other fields as necessary
}

// Function to retrieve an auction by ID
export async function getAuction(id: string): Promise<Auction | null> {
  const result = await sql`SELECT * FROM auctions WHERE id = ${id}`;
  if (!result[0]) return null;

  const raw = result[0];
  const auction: Auction = {
    id: raw.id,
    name: raw.name,
    expected_total: raw.expected_total,
    available_count: raw.available_count,
    up_count: raw.up_count,
    completed_count: raw.completed_count,
  };

  return auction;
}

export async function validateManagerSession(sessionToken: string, auctionId: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM managers
    WHERE session_token = ${sessionToken} AND auction_id = ${auctionId}
    LIMIT 1
  `;
  return result.length > 0;
}


// Function to save or update an auction
export async function saveAuction(auction: Auction): Promise<void> {
  await sql`
    INSERT INTO auctions (id, name, expected_total, available_count, up_count, completed_count)
    VALUES (${auction.id}, ${auction.name}, ${auction.expected_total}, ${auction.available_count}, ${auction.up_count}, ${auction.completed_count})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      expected_total = EXCLUDED.expected_total,
      available_count = EXCLUDED.available_count,
      up_count = EXCLUDED.up_count,
      completed_count = EXCLUDED.completed_count;
  `;
}

// Function to test the database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
