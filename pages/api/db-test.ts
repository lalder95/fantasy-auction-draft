// pages/api/db-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const databaseUrl = process.env.DATABASE_URL || '';
    
    if (!databaseUrl) {
      return res.status(500).json({
        success: false,
        message: 'DATABASE_URL environment variable is not set',
      });
    }
    
    // Create a SQL client
    const sql = neon(databaseUrl);
    
    // Test a simple query
    const result = await sql`SELECT 1 as test`;
    
    // Check if tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      result,
      tables: tables.map(t => t.table_name),
      databaseUrlExists: !!databaseUrl,
      databaseUrlStart: databaseUrl.substring(0, 10) + '...' // Safe way to show part of the URL
    });
  } catch (error) {
    console.error('Error testing database connection:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      envVarExists: !!process.env.DATABASE_URL,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}