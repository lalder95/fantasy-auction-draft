// pages/api/redis-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { testRedisConnection } from '../../lib/database';
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
    
    // First use our database module's test function
    console.log('Testing Redis connection using database module:');
    const moduleTestResult = await testRedisConnection();
    
    // Then try a direct test for comparison
    console.log('Testing direct Redis connection:');
    let directTestResult = false;
    let directError = null;
    
    try {
      // Create Redis instance directly
      const directRedis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || '',
        token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
      });
      
      // Test simple operations
      const testKey = 'direct-test';
      const testValue = `direct-${Date.now()}`;
      
      await directRedis.set(testKey, testValue);
      const fetchedValue = await directRedis.get(testKey);
      await directRedis.del(testKey);
      
      directTestResult = fetchedValue === testValue;
      console.log('Direct Redis test result:', directTestResult ? 'PASSED' : 'FAILED');
    } catch (error) {
      directError = error;
      console.error('Direct Redis test failed:', error);
    }
    
    // Check for any other Redis-related env vars that might be causing conflicts
    const redisEnvVars = Object.keys(process.env)
      .filter(key => key.includes('REDIS') || key.includes('KV'))
      .map(key => ({
        name: key,
        exists: true,
        // Only show first few characters of the value for security
        preview: process.env[key] ? `${process.env[key].substring(0, 8)}...` : 'undefined'
      }));
    
    return res.status(200).json({
      success: moduleTestResult && directTestResult,
      moduleTest: {
        success: moduleTestResult
      },
      directTest: {
        success: directTestResult,
        error: directError ? String(directError) : null
      },
      redisEnvVars
    });
  } catch (error) {
    console.error('Unexpected error in Redis test endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}