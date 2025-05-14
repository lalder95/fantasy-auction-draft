// lib/sleeper.ts (Complete version with enhanced error handling)
import axios from 'axios';

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

export interface SleeperLeague {
  league_id: string;
  name: string;
  total_rosters: number;
  roster_positions: string[];
  settings: {
    type: number;
    budget: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string;
  [key: string]: any;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  [key: string]: any;
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  status: string;
  years_exp: number;
  [key: string]: any;
}

/**
 * Create a safer axios instance with timeout and retries
 */
const sleeperAxios = axios.create({
  baseURL: SLEEPER_API_BASE,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Helper function to handle Axios errors with detailed logging
 */
function handleAxiosError(error: any, context: string): never {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      console.error(`Sleeper API responded with status ${error.response.status} for ${context}:`, error.response.data);
      throw new Error(`Sleeper API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`No response received from Sleeper API for ${context}:`, error.request);
      throw new Error('Network error: No response from Sleeper API');
    } else {
      console.error(`Error setting up request to Sleeper API for ${context}:`, error.message);
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
  
  console.error(`Error in ${context}:`, error);
  throw new Error(`Failed in ${context}: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Fetches league information from Sleeper API with better error handling
 */
export async function getLeagueInfo(leagueId: string): Promise<SleeperLeague> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Fetching league info for ID: ${leagueId}`);
    const response = await sleeperAxios.get(`/league/${leagueId}`);
    
    if (!response.data) {
      throw new Error('No data returned from Sleeper API');
    }
    
    if (!response.data.name) {
      console.warn('League info is missing name property:', response.data);
      // Add a default name if missing
      response.data.name = `League ${leagueId}`;
    }
    
    console.log(`Successfully fetched league: ${response.data.name}`);
    return response.data;
  } catch (error) {
    return handleAxiosError(error, `getLeagueInfo(${leagueId})`);
  }
}

/**
 * Fetches all users/managers in a league with enhanced error handling
 */
export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Fetching league users for ID: ${leagueId}`);
    const response = await sleeperAxios.get(`/league/${leagueId}/users`);
    
    if (!response.data) {
      throw new Error('No data returned from Sleeper API');
    }
    
    console.log(`Successfully fetched ${response.data.length} users for league: ${leagueId}`);
    return response.data;
  } catch (error) {
    return handleAxiosError(error, `getLeagueUsers(${leagueId})`);
  }
}

/**
 * Fetches all rosters in a league with enhanced error handling
 */
export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Fetching league rosters for ID: ${leagueId}`);
    const response = await sleeperAxios.get(`/league/${leagueId}/rosters`);
    
    if (!response.data) {
      throw new Error('No data returned from Sleeper API');
    }
    
    console.log(`Successfully fetched ${response.data.length} rosters for league: ${leagueId}`);
    return response.data;
  } catch (error) {
    return handleAxiosError(error, `getLeagueRosters(${leagueId})`);
  }
}

/**
 * Fetches all NFL players from Sleeper with enhanced error handling
 */
export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  try {
    console.log(`Fetching all NFL players from Sleeper`);
    const response = await sleeperAxios.get(`/players/nfl`);
    
    if (!response.data) {
      throw new Error('No data returned from Sleeper API');
    }
    
    const playerCount = Object.keys(response.data).length;
    console.log(`Successfully fetched ${playerCount} NFL players`);
    
    return response.data;
  } catch (error) {
    return handleAxiosError(error, `getAllPlayers()`);
  }
}

/**
 * Gets currently rostered players in a league with enhanced error handling
 */
export async function getRosteredPlayers(leagueId: string): Promise<string[]> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Getting rostered players for league ID: ${leagueId}`);
    const rosters = await getLeagueRosters(leagueId);
    
    // Combine all player IDs from all rosters
    const rosteredPlayerIds = rosters.flatMap(roster => roster.players || []);
    
    console.log(`Found ${rosteredPlayerIds.length} rostered players in league: ${leagueId}`);
    return rosteredPlayerIds;
  } catch (error) {
    console.error(`Error getting rostered players for league ${leagueId}:`, error);
    throw new Error(`Failed to get rostered players: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper to get set of eligible positions from roster positions
 */
function getEligiblePositionsSet(rosterPositions: string[]): Set<string> {
  const positionMap: Record<string, string[]> = {
    'QB': ['QB'],
    'RB': ['RB'],
    'WR': ['WR'],
    'TE': ['TE'],
    'FLEX': ['RB', 'WR', 'TE'],
    'SUPER_FLEX': ['QB', 'RB', 'WR', 'TE'],
    'K': ['K'],
    'DEF': ['DEF'],
    'DL': ['DL'],
    'LB': ['LB'],
    'DB': ['DB'],
    'IDP_FLEX': ['DL', 'LB', 'DB'],
    'BN': ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB']
  };
  
  const eligiblePositions = new Set<string>();
  
  rosterPositions.forEach(pos => {
    const mappedPositions = positionMap[pos] || [];
    mappedPositions.forEach(p => eligiblePositions.add(p));
  });
  
  return eligiblePositions;
}

/**
 * Gets eligible players for auction based on league settings with enhanced error handling
 */
export async function getEligiblePlayers(
  leagueId: string, 
  includeRostered: boolean = false
): Promise<SleeperPlayer[]> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Getting eligible players for league ID: ${leagueId}, includeRostered: ${includeRostered}`);
    
    // Fetch league info and all players in parallel
    const [league, allPlayers] = await Promise.all([
      getLeagueInfo(leagueId),
      getAllPlayers()
    ]);
    
    let rosteredPlayerIds: string[] = [];
    if (!includeRostered) {
      console.log('Fetching currently rostered players');
      rosteredPlayerIds = await getRosteredPlayers(leagueId);
      console.log(`Found ${rosteredPlayerIds.length} currently rostered players`);
    }
    
    // Convert to array and filter by roster positions
    const eligiblePositions = getEligiblePositionsSet(league.roster_positions);
    console.log(`Eligible positions for league: ${Array.from(eligiblePositions).join(', ')}`);
    
    const eligiblePlayers = Object.values(allPlayers)
      .filter(player => {
        // Check if player is eligible based on position
        const isEligiblePosition = eligiblePositions.has(player.position);
        
        // Check if player is already rostered
        const isRostered = rosteredPlayerIds.includes(player.player_id);
        
        // Include player if they have eligible position and either includeRostered is true or they're not rostered
        return isEligiblePosition && (includeRostered || !isRostered);
      })
      // Sort by name for convenience
      .sort((a, b) => {
        // Handle cases where full_name might be undefined
        if (!a.full_name && !b.full_name) return 0; // Both undefined, consider equal
        if (!a.full_name) return 1; // a undefined, b defined, sort a after b
        if (!b.full_name) return -1; // a defined, b undefined, sort a before b
        return a.full_name.localeCompare(b.full_name); // Normal comparison
      });
    
    console.log(`Found ${eligiblePlayers.length} eligible players for league: ${leagueId}`);
    return eligiblePlayers;
  } catch (error) {
    console.error(`Error getting eligible players for league ${leagueId}:`, error);
    throw new Error(`Failed to get eligible players for auction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Match Sleeper users with rosters to get complete manager information with enhanced error handling
 */
export async function getLeagueManagers(leagueId: string): Promise<Array<{
  managerId: string;
  displayName: string;
  avatar: string;
  rosterId: number;
}>> {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  try {
    console.log(`Getting league managers for league ID: ${leagueId}`);
    
    // Fetch users and rosters in parallel
    const [users, rosters] = await Promise.all([
      getLeagueUsers(leagueId),
      getLeagueRosters(leagueId)
    ]);
    
    const managers = rosters.map(roster => {
      const user = users.find(u => u.user_id === roster.owner_id) || {
        user_id: roster.owner_id,
        display_name: `Manager ${roster.roster_id}`,
        avatar: ''
      };
      
      return {
        managerId: user.user_id,
        displayName: user.display_name,
        avatar: user.avatar,
        rosterId: roster.roster_id
      };
    });
    
    console.log(`Found ${managers.length} managers for league: ${leagueId}`);
    return managers;
  } catch (error) {
    console.error(`Error getting league managers for league ${leagueId}:`, error);
    throw new Error(`Failed to get league managers: ${error instanceof Error ? error.message : String(error)}`);
  }
}