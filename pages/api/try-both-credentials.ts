// pages/api/try-both-credentials.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Starting credential test for both Redis and REST API');
  
  const results: Record<string, any> = {
    restApi: { tried: false, success: false, error: null },
    redisProtocol: { tried: false, success: false, error: null }
  };

  // First try REST API with all possible credentials
  try {
    console.log('Trying REST API with direct credentials');
    results.restApi.tried = true;
    
    // Create Redis instance with REST API credentials
    const redis = new Redis({
      url: 'https://crisp-lacewing-27676.upstash.io',
      token: 'AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA'
    });
    
    // Test operation
    const testKey = `rest-test-${Date.now()}`;
    const testValue = `value-${Date.now()}`;
    
    await redis.set(testKey, testValue);
    const result = await redis.get(testKey);
    await redis.del(testKey);
    
    results.restApi.success = true;
    results.restApi.result = result;
    results.restApi.match = testValue === result;
    
    console.log('REST API test succeeded');
  } catch (error: unknown) {
    results.restApi.success = false;
    results.restApi.error = error instanceof Error ? error.message : String(error);
    console.error('REST API test failed:', error);
    
    // Try another potential REST API format
    try {
      console.log('Trying REST API with alternative token format');
      
      const redis2 = new Redis({
        url: 'https://crisp-lacewing-27676.upstash.io',
        token: 'default:AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA'
      });
      
      const testKey = `rest-alt-test-${Date.now()}`;
      const testValue = `value-${Date.now()}`;
      
      await redis2.set(testKey, testValue);
      const result = await redis2.get(testKey);
      await redis2.del(testKey);
      
      results.restApiAlt = {
        tried: true,
        success: true,
        result,
        match: testValue === result
      };
      
      console.log('Alternative REST API test succeeded');
    } catch (error2: unknown) {
      results.restApiAlt = {
        tried: true,
        success: false,
        error: error2 instanceof Error ? error2.message : String(error2)
      };
      console.error('Alternative REST API test failed:', error2);
    }
  }
  
  // Now try Redis Protocol
  try {
    console.log('Trying Redis Protocol connection');
    results.redisProtocol.tried = true;
    
    // Create Redis client using protocol
    const client = createClient({
      url: 'rediss://default:AWwcAAIjcDEiZDQwNGNmMDZiYWI0MWMzOTU0YjQ1ZDhkNzgyOTdmMXAxMA@crisp-lacewing-27676.upstash.io:6379'
    });
    
    await client.connect();
    console.log('Connected via Redis Protocol');
    
    const testKey = `protocol-test-${Date.now()}`;
    const testValue = `value-${Date.now()}`;
    
    await client.set(testKey, testValue);
    const result = await client.get(testKey);
    await client.del(testKey);
    
    await client.disconnect();
    
    results.redisProtocol.success = true;
    results.redisProtocol.result = result;
    results.redisProtocol.match = testValue === result;
    
    console.log('Redis Protocol test succeeded');
  } catch (error: unknown) {
    results.redisProtocol.success = false;
    results.redisProtocol.error = error instanceof Error ? error.message : String(error);
    console.error('Redis Protocol test failed:', error);
  }
  
  // Also try to fetch environment variables to see if they're different
  const envVars = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 
      process.env.UPSTASH_REDIS_REST_URL.substring(0, 10) + '...' : 'not set',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 
      process.env.UPSTASH_REDIS_REST_TOKEN.substring(0, 10) + '...' : 'not set'
  };
  
  return res.status(200).json({
    results,
    envVars,
    timestamp: new Date().toISOString()
  });
}