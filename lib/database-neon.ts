// lib/database-neon.ts

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Auction interface
export interface Auction {
  id: string;
  name: string;
  expected_total: number;
  available_count: number;
  up_count: number;
  completed_count: number;
  // Extend with any other fields your app uses
}

// Retrieve auction by ID
export async function getAuction(id: string): Promise<Auction | null> {
  const result = await sql`SELECT * FROM auctions WHERE id = ${id}`;
  const row = result[0];
  if (!row) return null;

  const auction: Auction = {
    id: row.id,
    name: row.name,
    expected_total: Number(row.expected_total),
    available_count: Number(row.available_count),
    up_count: Number(row.up_count),
    completed_count: Number(row.completed_count),
  };

  return auction;
}


// Save or update an auction
export async function saveAuction(auction: Auction): Promise<void> {
  await sql`
    INSERT INTO auctions (id, name, expected_total, available_count, up_count, completed_count)
    VALUES (
      ${auction.id},
      ${auction.name},
      ${auction.expected_total},
      ${auction.available_count},
      ${auction.up_count},
      ${auction.completed_count}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      expected_total = EXCLUDED.expected_total,
      available_count = EXCLUDED.available_count,
      up_count = EXCLUDED.up_count,
      completed_count = EXCLUDED.completed_count;
  `;
}

// Validate a manager session and return the manager ID if valid
export async function validateManagerSession(sessionToken: string, auctionId: string): Promise<string | null> {
  const result = await sql`
    SELECT id FROM managers
    WHERE session_token = ${sessionToken} AND auction_id = ${auctionId}
    LIMIT 1
  `;
  return result[0]?.id || null;
}

// Optional: test the DB connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
