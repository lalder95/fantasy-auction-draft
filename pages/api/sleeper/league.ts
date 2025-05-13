// pages/api/sleeper/league.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLeagueInfo, getLeagueManagers } from '../../../lib/sleeper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { leagueId } = req.query;
  
  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ message: 'League ID is required' });
  }
  
  try {
    const [leagueInfo, managers] = await Promise.all([
      getLeagueInfo(leagueId),
      getLeagueManagers(leagueId)
    ]);
    
    return res.status(200).json({ leagueInfo, managers });
  } catch (error) {
    console.error('Error fetching league info:', error);
    return res.status(500).json({ message: 'Failed to fetch league information' });
  }
}