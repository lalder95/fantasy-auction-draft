// pages/api/diagnostics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check for environment variables
    const dbUrl = process.env.DATABASE_URL;
    
    // Log environment variable state (safe version)
    const envInfo = {
      DATABASE_URL_EXISTS: !!dbUrl,
      DATABASE_URL_LENGTH: dbUrl?.length || 0,
      DATABASE_URL_PREFIX: dbUrl?.substring(0, 10) + '...' || 'not set'
    };

    console.log('Environment variables:', envInfo);
    
    // Try to connect and run a simple query
    if (!dbUrl) {
      return res.status(400).json({
        success: false,
        message: 'DATABASE_URL is not set',
        environment: envInfo
      });
    }
    
    // Create an SQL client
    const sql = neon(dbUrl);
    
    // Run a simple test query
    console.log('Attempting to run test query...');
    const result = await sql`SELECT 1 as test`;
    console.log('Test query result:', result);
    
    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      result: result,
      environment: envInfo
    });
  } catch (error) {
    console.error('Database diagnostic error:', error);
    
    // Return detailed error information
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      environment: {
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0,
        DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 10) + '...' || 'not set'
      }
    });
  }
}