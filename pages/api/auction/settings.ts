// pages/api/auction/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers to make debugging easier
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Log request body for debugging
  console.log('Received request body:', JSON.stringify(req.body, null, 2));
  
  const { auctionId, settings } = req.body;
  
  if (!auctionId || !settings) {
    return res.status(400).json({ 
      message: 'Auction ID and settings are required',
      received: { auctionId, hasSettings: !!settings }
    });
  }

  try {
    // Test Redis connection first
    const diagnosticKey = 'diagnostic-test';
    try {
      console.log('Testing database connection...');
      const redis = require('@upstash/redis');
      const connectionResult = await redis.set(diagnosticKey, 'test-value');
      console.log('Database connection test result:', connectionResult);
    } catch (dbError) {
      console.error('Database connection test failed:', dbError);
      return res.status(500).json({
        message: 'Database connection test failed',
        error: dbError instanceof Error ? dbError.message : String(dbError),
        step: 'connection-test'
      });
    }

    // Try to get the auction
    let auction;
    try {
      console.log('Fetching auction with ID:', auctionId);
      auction = await getAuction(auctionId);
    } catch (fetchError) {
      console.error('Error fetching auction:', fetchError);
      return res.status(500).json({
        message: 'Failed to fetch auction',
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        step: 'fetch-auction'
      });
    }
    
    if (!auction) {
      console.log('Auction not found with ID:', auctionId);
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Try a very simple update with minimal processing
    try {
      console.log('Processing update...');
      
      // Use a simplified approach first to test basic functionality
      const updatedAuction = {
        ...auction,
        settings: {
          ...auction.settings,
          // Just update a few key fields to test
          leagueName: settings.leagueName || auction.settings.leagueName,
          defaultBudget: settings.defaultBudget || auction.settings.defaultBudget
        }
      };
      
      console.log('Created updated auction object');
      
      // Try saving the updated auction
      await saveAuction(updatedAuction);
      console.log('Successfully saved auction');
      
      return res.status(200).json({ success: true });
    } catch (updateError) {
      console.error('Error updating auction:', updateError);
      return res.status(500).json({
        message: 'Failed to update auction',
        error: updateError instanceof Error ? updateError.message : String(updateError),
        step: 'update-auction'
      });
    }
  } catch (error) {
    console.error('Unexpected error in settings handler:', error);
    return res.status(500).json({
      message: 'Unexpected error in settings handler',
      error: error instanceof Error ? error.message : String(error),
      step: 'unexpected'
    });
  }
}