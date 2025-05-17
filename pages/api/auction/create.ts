// pages/api/auction/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuction } from '../../../lib/auction';
import { getLeagueInfo } from '../../../lib/sleeper';
import { saveAuction } from '../../../lib/database-neon';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers to make debugging easier
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  console.log('Received create auction request with body:', JSON.stringify(req.body));
  const { leagueId, commissionerId } = req.body;
  
  if (!leagueId || !commissionerId) {
    return res.status(400).json({ 
      message: 'League ID and commissioner ID are required',
      received: { leagueId, commissionerId }
    });
  }
  
  try {
    // Step 1: Get league info from Sleeper
    console.log('Attempting to fetch league info from Sleeper for ID:', leagueId);
    let leagueInfo;
    try {
      leagueInfo = await getLeagueInfo(leagueId);
      console.log('Successfully fetched league info:', leagueInfo.name);
    } catch (sleeperError) {
      console.error('Error fetching league info from Sleeper:', sleeperError);
      return res.status(500).json({ 
        message: 'Failed to fetch league information from Sleeper API',
        error: sleeperError instanceof Error ? sleeperError.message : String(sleeperError),
        step: 'get-league-info' 
      });
    }
    
    // Step 2: Create auction object
    console.log('Creating auction object');
    let auction;
    try {
      auction = createAuction(leagueId, leagueInfo.name, commissionerId);
      console.log('Successfully created auction object with ID:', auction.id);
    } catch (createError) {
      console.error('Error creating auction object:', createError);
      return res.status(500).json({ 
        message: 'Failed to create auction object',
        error: createError instanceof Error ? createError.message : String(createError),
        step: 'create-auction-object' 
      });
    }
    
    // Step 3: Save auction to database
    console.log('Saving auction to database');
    try {
      await saveAuction(auction);
      console.log('Successfully saved auction to database');
    } catch (saveError) {
      console.error('Error saving auction to database:', {
        error: saveError instanceof Error ? saveError.message : String(saveError),
        stack: saveError instanceof Error ? saveError.stack : undefined,
        auctionId: auction.id,
        leagueId,
        commissionerId
      });
      return res.status(500).json({ 
        message: 'Failed to save auction to database',
        error: saveError instanceof Error ? saveError.message : String(saveError),
        step: 'save-auction' 
      });
    }
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      auctionId: auction.id,
    });
  } catch (error) {
    console.error('Unexpected error in create auction handler:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      leagueId,
      commissionerId
    });
    return res.status(500).json({ 
      message: 'Unexpected error creating auction',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}