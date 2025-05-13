// lib/sleeper.ts
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
 * Fetches league information from Sleeper API
 */
export async function getLeagueInfo(leagueId: string): Promise<SleeperLeague> {
  try {
    const response = await axios.get(`${SLEEPER_API_BASE}/league/${leagueId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching league info:', error);
    throw new Error('Failed to fetch league information from Sleeper');
  }
}

/**
 * Fetches all users/managers in a league
 */
export async function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  try {
    const response = await axios.get(`${SLEEPER_API_BASE}/league/${leagueId}/users`);
    return response.data;
  } catch (error) {
    console.error('Error fetching league users:', error);
    throw new Error('Failed to fetch league users from Sleeper');
  }
}

/**
 * Fetches all rosters in a league
 */
export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  try {
    const response = await axios.get(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`);
    return response.data;
  } catch (error) {
    console.error('Error fetching league rosters:', error);
    throw new Error('Failed to fetch league rosters from Sleeper');
  }
}

/**
 * Fetches all NFL players from Sleeper
 */
export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  try {
    const response = await axios.get(`${SLEEPER_API_BASE}/players/nfl`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all players:', error);
    throw new Error('Failed to fetch NFL players from Sleeper');
  }
}

/**
 * Gets currently rostered players in a league
 */
export async function getRosteredPlayers(leagueId: string): Promise<string[]> {
  try {
    const rosters = await getLeagueRosters(leagueId);
    // Combine all player IDs from all rosters
    return rosters.flatMap(roster => roster.players || []);
  } catch (error) {
    console.error('Error getting rostered players:', error);
    throw new Error('Failed to get rostered players');
  }
}

/**
 * Gets eligible players for auction based on league settings
 */
export async function getEligiblePlayers(
  leagueId: string, 
  includeRostered: boolean = false
): Promise<SleeperPlayer[]> {
  try {
    const [league, allPlayers] = await Promise.all([
      getLeagueInfo(leagueId),
      getAllPlayers()
    ]);
    
    let rosteredPlayerIds: string[] = [];
    if (!includeRostered) {
      rosteredPlayerIds = await getRosteredPlayers(leagueId);
    }
    
    // Convert to array and filter by roster positions
    const eligiblePositions = getEligiblePositionsSet(league.roster_positions);
    
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
    
    return eligiblePlayers;
  } catch (error) {
    console.error('Error getting eligible players:', error);
    throw new Error('Failed to get eligible players for auction');
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
 * Match Sleeper users with rosters to get complete manager information
 */
export async function getLeagueManagers(leagueId: string): Promise<Array<{
  managerId: string;
  displayName: string;
  avatar: string;
  rosterId: number;
}>> {
  try {
    const [users, rosters] = await Promise.all([
      getLeagueUsers(leagueId),
      getLeagueRosters(leagueId)
    ]);
    
    return rosters.map(roster => {
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
  } catch (error) {
    console.error('Error getting league managers:', error);
    throw new Error('Failed to get league managers');
  }
}