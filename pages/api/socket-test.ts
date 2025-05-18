// pages/api/socket-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Return environment info (safe version without sensitive details)
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      VERCEL_ENV: process.env.VERCEL_ENV || 'development',
      VERCEL_URL: process.env.VERCEL_URL || 'localhost',
      VERCEL_REGION: process.env.VERCEL_REGION || 'local',
      
      // Database connection info (masked)
      DB_CONNECTION: process.env.DATABASE_URL ? 'Set' : 'Not Set',
      UPSTASH_REDIS: process.env.UPSTASH_REDIS_REST_URL ? 'Set' : 'Not Set'
    };

    // System information
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    // Return socket configuration details for client debugging
    return res.status(200).json({
      success: true,
      message: 'Socket API diagnostic endpoint is running correctly',
      timestamp: new Date().toISOString(),
      socketConfig: {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        connectTimeout: 20000,
        pingTimeout: 20000,
        pingInterval: 5000,
      },
      environment: envInfo,
      system: systemInfo,
    });
  } catch (error) {
    console.error('Socket test diagnostic error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error in socket diagnostic endpoint',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}