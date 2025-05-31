// pages/api/db-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT 1 as test`;
    console.log('Database connection successful:', result);
    return res.status(200).json({ status: 'ok', result });
  } catch (error) {
    console.error('Database connection failed:', error);
    return res.status(500).json({ error: String(error) });
  }
}