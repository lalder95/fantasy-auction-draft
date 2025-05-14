// pages/api/sleeper-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getLeagueInfo } from '../../lib/sleeper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add test league ID
  const testLeagueId = req.query.leagueId as string || '1085115384984973312'; // Example public league ID
  
  try {
    console.log(`Testing Sleeper API with league ID: ${testLeagueId}`);
    
    // Test direct axios call to Sleeper API
    const axios = require('axios');
    console.log('Testing direct axios call to Sleeper API');
    try {
      const directResponse = await axios.get(`https://api.sleeper.app/v1/league/${testLeagueId}`);
      console.log('Direct axios call successful with response:', directResponse.data);
    } catch (axiosError) {
      console.error('Direct axios call failed:', axiosError);
      return res.status(500).json({
        success: false,
        step: 'direct-axios',
        error: axiosError instanceof Error ? axiosError.message : String(axiosError)
      });
    }
    
    // Test getLeagueInfo
    console.log('Testing getLeagueInfo function');
    const leagueInfo = await getLeagueInfo(testLeagueId);
    
    return res.status(200).json({
      success: true,
      leagueInfo
    });
  } catch (error) {
    console.error('Error testing Sleeper API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}