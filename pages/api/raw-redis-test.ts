// pages/api/raw-redis-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Starting raw Redis test');
  
  // Log exact library version
  try {
    console.log('Upstash Redis library version:', require('@upstash/redis/package.json').version);
  } catch (err) {
    console.log('Could not determine Upstash Redis version');
  }

  try {
    // Create Redis instance with exact credentials from screenshot
    console.log('Creating Redis client with hardcoded credentials');
    const redis = new Redis({
      url: "https://crisp-lacewing-27676.upstash.io",
      token: "AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA"
    });
    
    // Generate a unique test key
    const testKey = `raw-test-${Date.now()}`;
    const testValue = `value-${Date.now()}`;
    
    console.log(`Setting test key: ${testKey} to value: ${testValue}`);
    
    // Simple set operation
    await redis.set(testKey, testValue);
    console.log('Set operation successful');
    
    // Read it back
    const result = await redis.get(testKey);
    console.log(`Retrieved value: ${result}`);
    
    // Clean up
    await redis.del(testKey);
    console.log('Delete operation successful');
    
    return res.status(200).json({
      success: true,
      testKey,
      sentValue: testValue,
      retrievedValue: result,
      match: testValue === result
    });
  } catch (error: unknown) {
    console.error('Raw Redis test failed:', error);
    
    // Additional diagnostic information
    const errorDetails: Record<string, unknown> = {};
    
    if (error instanceof Error) {
      errorDetails.name = error.name;
      errorDetails.message = error.message;
      errorDetails.stack = error.stack;
      
      // If it has a cause property, extract that too
      const anyError = error as any;
      if (anyError.cause) {
        errorDetails.upstashDetails = {
          name: anyError.cause.name,
          message: anyError.cause.message
        };
      }
    }
    
    // Try to get library information
    let libraryVersion = 'unknown';
    try {
      libraryVersion = require('@upstash/redis/package.json').version;
    } catch {
      // Ignore errors
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: errorDetails,
      libraryInfo: {
        version: libraryVersion
      }
    });
  }
}