// pages/api/db-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Create a SQL client
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Test a simple query - USE BACKTICKS instead of quotes
    const result = await sql`SELECT 1 as test`;
    
    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      result
    });
  } catch (error) {
    console.error('Error testing database connection:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      envVarExists: !!process.env.DATABASE_URL
    });
  }
}