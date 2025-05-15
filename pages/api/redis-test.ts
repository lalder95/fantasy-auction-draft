// pages/api/redis-test.ts (Simplified)
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Log environment variables (without exposing full values)
    console.log('Environment variables check:');
    console.log('UPSTASH_REDIS_REST_URL exists:', !!process.env.UPSTASH_REDIS_REST_URL);
    console.log('UPSTASH_REDIS_REST_TOKEN exists:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
    
    // Direct Redis test with hardcoded credentials
    console.log('Testing direct Redis connection with hardcoded credentials:');
    try {
      // Create Redis instance directly with hardcoded credentials
      const redis = new Redis({
        url: 'https://crisp-lacewing-27676.upstash.io',
        token: 'AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA'
      });
      
      // Test simple operations
      const testKey = 'direct-test';
      const testValue = `direct-${Date.now()}`;
      
      // Try the set operation
      console.log('Attempting to set a test value...');
      await redis.set(testKey, testValue);
      console.log('Set operation successful');
      
      // Try the get operation
      console.log('Attempting to get the test value...');
      const fetchedValue = await redis.get(testKey);
      console.log('Get operation successful, value:', fetchedValue);
      
      // Try the delete operation
      console.log('Attempting to delete the test value...');
      await redis.del(testKey);
      console.log('Delete operation successful');
      
      const success = fetchedValue === testValue;
      console.log('Redis test result:', success ? 'PASSED' : 'FAILED');
      
      return res.status(200).json({
        success: true,
        message: 'Redis connection successful',
        test: {
          setValue: testValue,
          retrievedValue: fetchedValue,
          match: success
        }
      });
    } catch (error) {
      console.error('Direct Redis test failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    }
  } catch (error) {
    console.error('Unexpected error in Redis test endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}