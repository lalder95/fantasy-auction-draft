// pages/api/sleeper/players.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getEligiblePlayers } from '../../../lib/sleeper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { leagueId, includeRostered } = req.query;
  
  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ message: 'League ID is required' });
  }
  
  try {
    const players = await getEligiblePlayers(
      leagueId, 
      includeRostered === 'true'
    );
    
    return res.status(200).json({ players });
  } catch (error) {
    console.error('Error fetching eligible players:', error);
    return res.status(500).json({ message: 'Failed to fetch eligible players' });
  }
}