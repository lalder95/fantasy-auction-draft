// lib/auction.ts
import { v4 as uuidv4 } from 'uuid';
import { SleeperPlayer } from './sleeper';

export interface Manager {
  id: string;
  name: string;
  rosterId: number;
  avatar?: string;
  budget: number;
  initialBudget: number;
  wonPlayers: string[]; // IDs of players won
  nominationOrder: number;
}

export interface PlayerUp {
  playerId: string;
  name: string;
  position: string;
  team: string;
  nominatedBy: string; // Manager ID
  currentBid: number;
  currentBidder: string | null; // Manager ID
  passes: string[]; // Array of manager IDs who passed
  startTime: number; // Timestamp
  endTime: number; // Timestamp
  status: 'active' | 'completed' | 'cancelled';
  nominationIndex: number; // Which player slot this is (for multiple nominations)
}

export interface AuctionSettings {
  leagueId: string;
  leagueName: string;
  nominationRounds: number;
  maxPlayers: number | null; // Max players per team, null for unlimited
  minPlayers: number; // Min players per team
  simultaneousNominations: number;
  nominationDuration: number; // in seconds
  nominationTimeAllowed: number; // in seconds
  skipMissedNominations: boolean;
  showHighBidder: boolean;
  defaultBudget: number;
}

export interface Auction {
  id: string;
  createdAt: number;
  settings: AuctionSettings;
  managers: Manager[];
  availablePlayers: SleeperPlayer[];
  playersUp: PlayerUp[];
  completedPlayers: Array<PlayerUp & { finalBid: number; winner: string }>;
  currentNominationManagerIndex: number;
  status: 'setup' | 'active' | 'paused' | 'completed';
  commissionerId: string; // Manager ID who created the auction
}

/**
 * Create a new auction
 */
export function createAuction(
  leagueId: string,
  leagueName: string,
  commissionerId: string
): Auction {
  return {
    id: uuidv4(),
    createdAt: Date.now(),
    settings: {
      leagueId,
      leagueName,
      nominationRounds: 1,
      maxPlayers: null,
      minPlayers: 0,
      simultaneousNominations: 1,
      nominationDuration: 30, // 30 seconds default
      nominationTimeAllowed: 30, // 30 seconds default
      skipMissedNominations: false,
      showHighBidder: true,
      defaultBudget: 200,
    },
    managers: [],
    availablePlayers: [],
    playersUp: [],
    completedPlayers: [],
    currentNominationManagerIndex: 0,
    status: 'setup',
    commissionerId,
  };
}

/**
 * Add manager to auction
 */
export function addManager(
  auction: Auction,
  managerId: string,
  name: string,
  rosterId: number,
  avatar?: string
): Auction {
  // Check if manager already exists
  if (auction.managers.some(m => m.id === managerId)) {
    return auction;
  }
  
  const budget = auction.settings.defaultBudget;
  
  const updatedAuction = { ...auction };
  updatedAuction.managers = [
    ...auction.managers,
    {
      id: managerId,
      name,
      rosterId,
      avatar,
      budget,
      initialBudget: budget,
      wonPlayers: [],
      nominationOrder: auction.managers.length + 1,
    },
  ];
  
  return updatedAuction;
}

/**
 * Update manager's budget
 */
export function updateManagerBudget(
  auction: Auction,
  managerId: string,
  newBudget: number
): Auction {
  const updatedAuction = { ...auction };
  
  updatedAuction.managers = auction.managers.map(manager => {
    if (manager.id === managerId) {
      return {
        ...manager,
        budget: newBudget,
      };
    }
    return manager;
  });
  
  return updatedAuction;
}

/**
 * Start the auction
 */
export function startAuction(auction: Auction): Auction {
  // Sort managers by nomination order
  const sortedManagers = [...auction.managers].sort((a, b) => a.nominationOrder - b.nominationOrder);
  
  return {
    ...auction,
    status: 'active',
    managers: sortedManagers,
    currentNominationManagerIndex: 0,
  };
}

/**
 * Nominate a player
 */
export function nominatePlayer(
  auction: Auction,
  managerId: string,
  playerId: string,
  startingBid: number = 1
): Auction {
  // Find the player
  const player = auction.availablePlayers.find(p => p.player_id === playerId);
  if (!player) {
    throw new Error('Player not found in available players');
  }
  
  // Check if this manager is allowed to nominate now
  const isCommissioner = managerId === auction.commissionerId;
  if (!isCommissioner) {
    const nominatingManager = auction.managers[auction.currentNominationManagerIndex];
    if (nominatingManager.id !== managerId) {
      throw new Error('Not your turn to nominate');
    }
  }
  
  // Check if there are already max simultaneous nominations
  if (auction.playersUp.length >= auction.settings.simultaneousNominations) {
    throw new Error('Maximum number of simultaneous nominations already reached');
  }
  
  // Check if the player is already up for auction
  if (auction.playersUp.some(p => p.playerId === playerId)) {
    throw new Error('Player is already up for auction');
  }
  
  // Calculate end time
  const startTime = Date.now();
  const endTime = startTime + (auction.settings.nominationDuration * 1000);
  
  // Create player up
  const playerUp: PlayerUp = {
    playerId: player.player_id,
    name: player.full_name,
    position: player.position,
    team: player.team || 'FA', // Default to Free Agent if no team
    nominatedBy: managerId,
    currentBid: startingBid,
    currentBidder: managerId, // Nominator is initial bidder
    passes: [],
    startTime,
    endTime,
    status: 'active',
    nominationIndex: auction.playersUp.length,
  };
  
  // Update auction
  const updatedAuction = { ...auction };
  updatedAuction.playersUp = [...auction.playersUp, playerUp];
  
  // Remove player from available players
  updatedAuction.availablePlayers = auction.availablePlayers.filter(
    p => p.player_id !== playerId
  );
  
  // Move to next nominator if not commissioner
  if (!isCommissioner) {
    updatedAuction.currentNominationManagerIndex = 
      (auction.currentNominationManagerIndex + 1) % auction.managers.length;
  }
  
  return updatedAuction;
}

/**
 * Place a bid on a player
 */
export function placeBid(
  auction: Auction,
  managerId: string,
  playerId: string,
  bidAmount: number
): Auction {
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Check if auction is active
  if (playerUp.status !== 'active') {
    throw new Error('This auction is not active');
  }
  
  // Check if auction has expired
  if (Date.now() > playerUp.endTime) {
    throw new Error('This auction has expired');
  }
  
  // Find the manager
  const manager = auction.managers.find(m => m.id === managerId);
  if (!manager) {
    throw new Error('Manager not found');
  }
  
  // Check if bid is higher than current bid
  if (bidAmount <= playerUp.currentBid) {
    throw new Error('Bid must be higher than current bid');
  }
  
  // Check if manager has enough budget
  if (bidAmount > manager.budget) {
    throw new Error('Not enough budget for this bid');
  }
  
  // Calculate minimum required funds for min players
  const wonPlayersCount = manager.wonPlayers.length;
  const minPlayersRemaining = Math.max(0, auction.settings.minPlayers - wonPlayersCount);
  const reservedFunds = minPlayersRemaining; // $1 per min player
  
  // Check if bid would leave enough for minimum required players
  if (bidAmount > manager.budget - reservedFunds) {
    throw new Error(`Must reserve at least $${reservedFunds} for minimum required players`);
  }
  
  // Update the auction
  const updatedAuction = { ...auction };
  const updatedPlayerUp = {
    ...playerUp,
    currentBid: bidAmount,
    currentBidder: managerId,
    // Reset passes if new bid
    passes: [],
  };
  
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    updatedPlayerUp,
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Pass on a player
 */
export function passOnPlayer(
  auction: Auction,
  managerId: string,
  playerId: string
): Auction {
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Check if auction is active
  if (playerUp.status !== 'active') {
    throw new Error('This auction is not active');
  }
  
  // Check if manager already passed
  if (playerUp.passes.includes(managerId)) {
    throw new Error('You have already passed on this player');
  }
  
  // Check if manager is the current high bidder (can't pass if you're winning)
  if (playerUp.currentBidder === managerId) {
    throw new Error('Cannot pass when you are the current high bidder');
  }
  
  // Update the auction
  const updatedAuction = { ...auction };
  const updatedPasses = [...playerUp.passes, managerId];
  
  // Check if all managers except high bidder have passed
  const highBidder = playerUp.currentBidder;
  const allManagersExceptHighBidder = auction.managers
    .filter(m => m.id !== highBidder)
    .map(m => m.id);
  
  // Check if all managers except high bidder have passed
  const allPassed = allManagersExceptHighBidder.every(id => updatedPasses.includes(id));
  
  // If all managers except high bidder passed, shorten timer to 10 seconds from now
  let updatedEndTime = playerUp.endTime;
  if (allPassed) {
    updatedEndTime = Math.min(playerUp.endTime, Date.now() + 10000); // 10 seconds
  }
  
  const updatedPlayerUp = {
    ...playerUp,
    passes: updatedPasses,
    endTime: updatedEndTime,
  };
  
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    updatedPlayerUp,
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Complete an auction for a player
 */
export function completePlayerAuction(
  auction: Auction,
  playerId: string
): Auction {
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Check if there's a winner
  if (!playerUp.currentBidder) {
    throw new Error('No winning bid for this player');
  }
  
  // Find the winning manager
  const winningManagerIndex = auction.managers.findIndex(m => m.id === playerUp.currentBidder);
  if (winningManagerIndex === -1) {
    throw new Error('Winning manager not found');
  }
  
  // Update the auction
  const updatedAuction = { ...auction };
  
  // Update the winning manager's budget and won players
  updatedAuction.managers = auction.managers.map((manager, index) => {
    if (index === winningManagerIndex) {
      return {
        ...manager,
        budget: manager.budget - playerUp.currentBid,
        wonPlayers: [...manager.wonPlayers, playerUp.playerId],
      };
    }
    return manager;
  });
  
  // Move player from playersUp to completedPlayers
  updatedAuction.completedPlayers = [
    ...auction.completedPlayers,
    {
      ...playerUp,
      status: 'completed',
      finalBid: playerUp.currentBid,
      winner: playerUp.currentBidder!,
    },
  ];
  
  // Remove from playersUp
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Expire auctions that have reached their end time
 */
export function expireAuctions(auction: Auction): Auction {
  const now = Date.now();
  let updatedAuction = { ...auction };
  
  // Check each player up for auction
  auction.playersUp.forEach(playerUp => {
    if (playerUp.status === 'active' && now > playerUp.endTime) {
      // Complete this auction
      updatedAuction = completePlayerAuction(updatedAuction, playerUp.playerId);
    }
  });
  
  return updatedAuction;
}

/**
 * Cancel a bid
 */
export function cancelBid(
  auction: Auction,
  playerId: string,
  managerId: string
): Auction {
  // Only commissioner can cancel bids
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can cancel bids');
  }
  
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Find previous bids (would need bid history, which we don't have in this model)
  // For simplicity, we'll just reset to starting bid of 1
  const updatedPlayerUp = {
    ...playerUp,
    currentBid: 1,
    currentBidder: playerUp.nominatedBy, // Reset to nominator
    passes: [], // Reset passes
  };
  
  // Update the auction
  const updatedAuction = { ...auction };
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    updatedPlayerUp,
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Remove a player from auction
 */
export function removePlayerFromAuction(
  auction: Auction,
  playerId: string,
  managerId: string
): Auction {
  // Only commissioner can remove players
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can remove players from auction');
  }
  
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Update the auction
  const updatedAuction = { ...auction };
  
  // Add back to available players
  const originalPlayer = auction.availablePlayers.find(p => p.player_id === playerId);
  if (originalPlayer) {
    updatedAuction.availablePlayers = [...auction.availablePlayers, originalPlayer];
  }
  
  // Remove from playersUp
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Add or remove time to a player's auction
 */
export function adjustAuctionTime(
  auction: Auction,
  playerId: string,
  managerId: string,
  secondsToAdjust: number
): Auction {
  // Only commissioner can adjust time
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can adjust auction time');
  }
  
  // Find the player up for auction
  const playerIndex = auction.playersUp.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in active auctions');
  }
  
  const playerUp = auction.playersUp[playerIndex];
  
  // Update the auction
  const updatedAuction = { ...auction };
  const updatedPlayerUp = {
    ...playerUp,
    endTime: playerUp.endTime + (secondsToAdjust * 1000),
  };
  
  updatedAuction.playersUp = [
    ...auction.playersUp.slice(0, playerIndex),
    updatedPlayerUp,
    ...auction.playersUp.slice(playerIndex + 1),
  ];
  
  return updatedAuction;
}

/**
 * Pause the auction
 */
export function pauseAuction(auction: Auction, managerId: string): Auction {
  // Only commissioner can pause
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can pause the auction');
  }
  
  return {
    ...auction,
    status: 'paused',
  };
}

/**
 * Resume the auction
 */
export function resumeAuction(auction: Auction, managerId: string): Auction {
  // Only commissioner can resume
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can resume the auction');
  }
  
  return {
    ...auction,
    status: 'active',
  };
}

/**
 * End the auction
 */
export function endAuction(auction: Auction, managerId: string): Auction {
  // Only commissioner can end
  if (auction.commissionerId !== managerId) {
    throw new Error('Only the commissioner can end the auction');
  }
  
  // Complete any active player auctions
  let updatedAuction = { ...auction };
  auction.playersUp.forEach(playerUp => {
    if (playerUp.status === 'active' && playerUp.currentBidder) {
      updatedAuction = completePlayerAuction(updatedAuction, playerUp.playerId);
    }
  });
  
  // Set status to completed
  updatedAuction.status = 'completed';
  
  return updatedAuction;
}

/**
 * Get auction results in a format suitable for export
 */
export function getAuctionResults(auction: Auction): Array<{
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  winningBid: number;
  winningManager: string;
}> {
  return auction.completedPlayers.map(player => {
    const winningManager = auction.managers.find(m => m.id === player.winner);
    
    return {
      playerId: player.playerId,
      playerName: player.name,
      position: player.position,
      team: player.team,
      winningBid: player.finalBid,
      winningManager: winningManager ? winningManager.name : 'Unknown',
    };
  });
}

/**
 * Generate access URLs for an auction
 */
export function generateAuctionUrls(auction: Auction, baseUrl: string): {
  commissioner: string;
  managers: Array<{ managerId: string; name: string; url: string }>;
  viewer: string;
} {
  const commissionerUrl = `${baseUrl}/auction/${auction.id}?role=commissioner&id=${auction.commissionerId}`;
  
  const managerUrls = auction.managers.map(manager => ({
    managerId: manager.id,
    name: manager.name,
    url: `${baseUrl}/manager/${auction.id}/${manager.id}`,
  }));
  
  const viewerUrl = `${baseUrl}/viewer/${auction.id}`;
  
  return {
    commissioner: commissionerUrl,
    managers: managerUrls,
    viewer: viewerUrl,
  };
}