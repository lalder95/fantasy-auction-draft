// pages/api/diagnostic.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Log environment variable existence (not the actual values for security)
    console.log('Environment variables check:');
    console.log('UPSTASH_REDIS_REST_URL exists:', !!process.env.UPSTASH_REDIS_REST_URL);
    console.log('UPSTASH_REDIS_REST_TOKEN exists:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
    
    // Attempt to initialize Redis
    let redis: Redis;
    try {
      redis = Redis.fromEnv();
      console.log('Redis initialized successfully from environment variables');
    } catch (initError) {
      console.error('Failed to initialize Redis from environment variables:', initError);
      return res.status(500).json({
        success: false,
        step: 'redis-init',
        error: initError instanceof Error ? initError.message : String(initError),
        envVarsExist: {
          UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
          UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN
        }
      });
    }
    
    // Try a simple Redis operation
    try {
      const testKey = 'diagnostic:test';
      const testValue = `test-${Date.now()}`;
      
      console.log(`Setting test key: ${testKey} with value: ${testValue}`);
      await redis.set(testKey, testValue);
      
      console.log(`Reading back test key: ${testKey}`);
      const retrievedValue = await redis.get(testKey);
      
      console.log(`Cleaning up test key: ${testKey}`);
      await redis.del(testKey);
      
      return res.status(200).json({
        success: true,
        test: 'passed',
        valueMatches: testValue === retrievedValue,
        valueSet: testValue,
        valueRetrieved: retrievedValue
      });
    } catch (operationError) {
      console.error('Redis operation failed:', operationError);
      return res.status(500).json({
        success: false,
        step: 'redis-operation',
        error: operationError instanceof Error ? operationError.message : String(operationError)
      });
    }
  } catch (error) {
    console.error('Unexpected error in diagnostic endpoint:', error);
    return res.status(500).json({
      success: false,
      step: 'unexpected',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}