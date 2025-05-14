// pages/api/auction/settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuction, saveAuction } from '../../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { auctionId, settings } = req.body;
  
  if (!auctionId || !settings) {
    return res.status(400).json({ message: 'Auction ID and settings are required' });
  }
  
  try {
    console.log('Fetching auction with ID:', auctionId);
    
    // Get existing auction
    const auction = await getAuction(auctionId);
    
    if (!auction) {
      console.log('Auction not found with ID:', auctionId);
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    console.log('Current auction settings:', auction.settings);
    console.log('New settings to apply:', settings);
    
    // Update settings with more careful merging
    const updatedAuction = {
      ...auction,
      settings: {
        ...auction.settings,
        // Explicitly handle each field to ensure proper typing
        leagueId: settings.leagueId || auction.settings.leagueId,
        leagueName: settings.leagueName || auction.settings.leagueName,
        nominationRounds: settings.nominationRounds ?? auction.settings.nominationRounds,
        maxPlayers: settings.maxPlayers ?? auction.settings.maxPlayers,
        minPlayers: settings.minPlayers ?? auction.settings.minPlayers,
        simultaneousNominations: settings.simultaneousNominations ?? auction.settings.simultaneousNominations,
        nominationDuration: settings.nominationDuration ?? auction.settings.nominationDuration,
        nominationTimeAllowed: settings.nominationTimeAllowed ?? auction.settings.nominationTimeAllowed,
        skipMissedNominations: settings.skipMissedNominations ?? auction.settings.skipMissedNominations,
        showHighBidder: settings.showHighBidder ?? auction.settings.showHighBidder,
        defaultBudget: settings.defaultBudget ?? auction.settings.defaultBudget,
        completionType: settings.completionType || auction.settings.completionType,
        targetPlayersWon: settings.targetPlayersWon ?? auction.settings.targetPlayersWon,
      }
    };
    
    console.log('Saving updated auction with settings:', updatedAuction.settings);
    
    // Save auction
    await saveAuction(updatedAuction);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating auction settings:', error);
    
    // Send more detailed error information
    return res.status(500).json({ 
      message: 'Failed to update auction settings',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}