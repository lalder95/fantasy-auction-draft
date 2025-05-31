// components/auction/AuctionRoom.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Auction, Manager } from '../../lib/auction';
import { getPusherClient } from '../../lib/pusher-client';
import AuctionStatus from './AuctionStatus';
import PlayerCard from './PlayerCard';
import BidInterface from './BidInterface';
import PlayerQueue from './PlayerQueue';
import CommissionerControls from './CommissionerControls';
import PlayerCountDebugger from '../diagnostic/PlayerCountDebugger';

interface AuctionRoomProps {
  auctionId: string;
  role: 'commissioner' | 'manager' | 'viewer';
  managerId?: string;
  sessionId?: string;
}

export default function AuctionRoom({
  auctionId,
  role,
  managerId,
  sessionId,
}: AuctionRoomProps) {
  const router = useRouter();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [currentManager, setCurrentManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [expirationChecker, setExpirationChecker] = useState<any>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const [showDebugger, setShowDebugger] = useState(false);

  const addDebugMessage = (message: string) => {
    setDebug(prev => {
      const newMessages = [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`];
      return newMessages.slice(-50);
    });
    console.log(`DEBUG: ${message}`);
  };
  
  // Improved fetch full auction data function
  const fetchFullAuction = useCallback(async () => {
    try {
      addDebugMessage(`Fetching full auction data for ID: ${auctionId}`);
      
      // Always verify player count on load to ensure consistency
      try {
        addDebugMessage('Running player count verification...');
        const fixResponse = await fetch('/api/auction/fix-player-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auctionId })
        });
        
        if (fixResponse.ok) {
          const fixData = await fixResponse.json();
          addDebugMessage(`Player count verification complete: ${fixData.counts.available} available players`);
        }
      } catch (fixError) {
        addDebugMessage(`Player count verification failed: ${fixError}`);
      }

      // Now fetch the auction data after fixing counts
      const auctionResponse = await axios.get(`/api/auction/${auctionId}`, {
        params: { role, managerId, sessionId }
      });
      
      if (!auctionResponse.data.auction) {
        addDebugMessage('No auction data in response');
        throw new Error('Failed to load auction data');
      }
      
      const auctionData = auctionResponse.data.auction;
      
      // Only fetch player stats if we don't have player counts yet or if they seem incorrect
      const needsPlayerStats = !auctionData.settings.totalPlayers || 
                              !auctionData.settings.availablePlayersCount ||
                              auctionData.settings.availablePlayersCount !== auctionData.availablePlayers?.length;
      
      if (needsPlayerStats) {
        try {
          const statsResponse = await axios.get(`/api/auction/player-stats`, {
            params: { auctionId }
          });
          
          if (statsResponse.data.success) {
            // Update auction with the latest player counts
            auctionData.settings = {
              ...auctionData.settings,
              totalPlayers: statsResponse.data.totalPlayers,
              availablePlayersCount: statsResponse.data.availablePlayers
            };
            
            addDebugMessage(`Auction data updated with verified counts - Total: ${statsResponse.data.totalPlayers}, Available: ${statsResponse.data.availablePlayers}`);
          }
        } catch (statsError) {
          addDebugMessage(`Failed to fetch player stats: ${statsError}`);
          // Continue with auction data as-is
        }
      }
      
      setAuction(auctionData);
      
      // If manager role, find current manager
      if (role === 'manager' && managerId && auctionData.managers) {
        const manager = auctionData.managers.find(
          (m: Manager) => m.id === managerId
        );
        setCurrentManager(manager || null);
      }
      
    } catch (err) {
      addDebugMessage(`Error fetching full auction: ${err instanceof Error ? err.message : String(err)}`);
      setError('Failed to load auction data. Please try again.');
    }
  }, [auctionId, role, managerId, sessionId, auction]);
  
  // Initialize Pusher and fetch auction data
  useEffect(() => {
    // Import expiration checker dynamically to avoid server-side rendering issues
    import('../../lib/expiration-checker').then(({ ExpirationChecker }) => {
      // Initial fetch of auction data
      fetchFullAuction().then(() => {
        setLoading(false);
      });
      
      // Start expiration checker if commissioner
      if (role === 'commissioner') {
        addDebugMessage('Starting expiration checker (commissioner only)');
        const checker = new ExpirationChecker(
          auctionId, 
          process.env.NEXT_PUBLIC_AUCTION_WORKER_SECRET || 'dev-secret'
        );
        checker.start(1000); // Check every second
        
        // Store in component state for cleanup
        setExpirationChecker(checker);
      }
    });
    
    // Subscribe to Pusher channel for real-time updates
    const pusher = getPusherClient();
    addDebugMessage('Initializing Pusher connection');
    
    // Create a channel specific to this auction
    const channelName = `auction-${auctionId}`;
    addDebugMessage(`Subscribing to Pusher channel: ${channelName}`);
    const channel = pusher.subscribe(channelName);
    
    // Handle connection success
    pusher.connection.bind('connected', () => {
      addDebugMessage('Pusher connected successfully');
      setConnectionStatus('connected');
    });
    
    // Handle connection errors
    pusher.connection.bind('error', (err: any) => {
      addDebugMessage(`Pusher connection error: ${err.message}`);
      setConnectionStatus('disconnected');
      setError(`Connection error: ${err.message}`);
    });
    
    // Handle auction updates - modified to support optimized updates
    channel.bind('auction-update', (data: { auction?: Auction, updateInfo?: any, fullUpdateNeeded?: boolean }) => {
      addDebugMessage('Received auction update from Pusher');
      
      if (data.auction) {
        // Full auction update (legacy format)
        addDebugMessage('Received full auction data');
        setAuction(data.auction);
        
        // Update current manager if needed
        if (role === 'manager' && managerId && data.auction.managers) {
          const manager = data.auction.managers.find(m => m.id === managerId);
          setCurrentManager(manager || null);
        }
      } else if (data.updateInfo) {
        // Partial update with optimized payload
        addDebugMessage(`Received partial update: ${data.updateInfo.updateType}`);
        
        if (data.fullUpdateNeeded) {
          // Fetch full auction data if needed
          addDebugMessage('Full update required, fetching complete auction data');
          fetchFullAuction();
        } else {
          // Apply partial update to existing auction state
          setAuction(prevAuction => {
            if (!prevAuction) return null;
            
            // Create a new auction object with the updated properties
            const updatedAuction = { ...prevAuction };
            
            // Update auction status if provided
            if (data.updateInfo.status) {
              updatedAuction.status = data.updateInfo.status;
            }
            
            // Update nomination manager index if provided
            if (data.updateInfo.currentNominationManagerIndex !== undefined) {
              updatedAuction.currentNominationManagerIndex = data.updateInfo.currentNominationManagerIndex;
            }
            
            // Update specific player if provided
            if (data.updateInfo.affectedPlayer) {
              const { playerId } = data.updateInfo.affectedPlayer;
              const playerIndex = updatedAuction.playersUp.findIndex(p => p.playerId === playerId);
              
              if (playerIndex >= 0) {
                updatedAuction.playersUp = [
                  ...updatedAuction.playersUp.slice(0, playerIndex),
                  { 
                    ...updatedAuction.playersUp[playerIndex],
                    ...data.updateInfo.affectedPlayer
                  },
                  ...updatedAuction.playersUp.slice(playerIndex + 1)
                ];
              }
            }
            
            // Update specific manager if provided
            if (data.updateInfo.affectedManager) {
              const { id } = data.updateInfo.affectedManager;
              const managerIndex = updatedAuction.managers.findIndex(m => m.id === id);
              
              if (managerIndex >= 0) {
                updatedAuction.managers = [
                  ...updatedAuction.managers.slice(0, managerIndex),
                  { 
                    ...updatedAuction.managers[managerIndex],
                    ...data.updateInfo.affectedManager
                  },
                  ...updatedAuction.managers.slice(managerIndex + 1)
                ];
                
                // Update current manager if needed
                if (role === 'manager' && managerId === id) {
                  setCurrentManager(updatedAuction.managers[managerIndex]);
                }
              }
            }
            
            // Handle player removals
            if (data.updateInfo.updateType === 'REMOVE_PLAYER' && data.updateInfo.removedPlayerId) {
              updatedAuction.playersUp = updatedAuction.playersUp.filter(
                p => p.playerId !== data.updateInfo.removedPlayerId
              );
              
              // If we have player details and it should return to available, add it back
              if (data.updateInfo.returnToAvailable && data.updateInfo.playerDetails) {
                // This would require fetching the full player data, so trigger a full refresh
                fetchFullAuction();
              }
            }
            
            // Handle nominations
            if (data.updateInfo.updateType === 'NOMINATE' && data.updateInfo.newPlayerUp) {
              updatedAuction.playersUp.push(data.updateInfo.newPlayerUp);
              
              // Remove from available players if we have the ID
              if (data.updateInfo.nominatedPlayerId) {
                updatedAuction.availablePlayers = updatedAuction.availablePlayers.filter(
                  p => p.player_id !== data.updateInfo.nominatedPlayerId
                );
              }
            }
            
            // Handle completed players
            if (data.updateInfo.completedPlayers && data.updateInfo.completedPlayers.length > 0) {
              data.updateInfo.completedPlayers.forEach((completed: any) => {
                // Remove from playersUp
                const playerUpIndex = updatedAuction.playersUp.findIndex(
                  p => p.playerId === completed.playerId
                );
                
                if (playerUpIndex >= 0) {
                  const playerUp = updatedAuction.playersUp[playerUpIndex];
                  
                  // Add to completed
                  updatedAuction.completedPlayers.push({
                    ...playerUp,
                    finalBid: completed.finalBid,
                    winner: completed.winningManagerId || completed.winner,
                    status: 'completed'
                  } as any);
                  
                  // Remove from playersUp
                  updatedAuction.playersUp = [
                    ...updatedAuction.playersUp.slice(0, playerUpIndex),
                    ...updatedAuction.playersUp.slice(playerUpIndex + 1)
                  ];
                  
                  // Update winning manager's budget and won players
                  const winningManagerIndex = updatedAuction.managers.findIndex(
                    m => m.id === (completed.winningManagerId || completed.winner)
                  );
                  
                  if (winningManagerIndex >= 0) {
                    const winningManager = updatedAuction.managers[winningManagerIndex];
                    updatedAuction.managers = [
                      ...updatedAuction.managers.slice(0, winningManagerIndex),
                      {
                        ...winningManager,
                        budget: winningManager.budget - completed.finalBid,
                        wonPlayers: [...winningManager.wonPlayers, completed.playerId]
                      },
                      ...updatedAuction.managers.slice(winningManagerIndex + 1)
                    ];
                    
                    // Update current manager if it's the winning manager
                    if (role === 'manager' && managerId === winningManager.id) {
                      setCurrentManager(updatedAuction.managers[winningManagerIndex]);
                    }
                  }
                }
              });
            }
            
            return updatedAuction;
          });
        }
      }
    });
    
    // Handle errors
    channel.bind('auction-error', (data: { message: string }) => {
      addDebugMessage(`Received error: ${data.message}`);
      // Don't set the error state to avoid blocking the UI, just log it
      // Unless it's critical
      if (data.message.includes('authentication') || data.message.includes('not found')) {
        setError(data.message);
      }
    });
    
    return () => {
      // Clean up Pusher subscription
      addDebugMessage('Cleaning up Pusher subscriptions');
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      
      // Clean up expiration checker if it exists
      if (expirationChecker) {
        addDebugMessage('Stopping expiration checker');
        expirationChecker.stop();
      }
    };
  }, [auctionId, role, managerId, sessionId, fetchFullAuction]);
  
  // Determine if current manager can nominate
  const canNominate = useCallback(() => {
    if (!auction || !currentManager) return false;
    if (auction.status !== 'active') return false;
    
    // Get the manager whose turn it is to nominate
    const nominatingManager = auction.managers[auction.currentNominationManagerIndex];
    
    // Check if it's this manager's turn
    return nominatingManager && nominatingManager.id === currentManager.id;
  }, [auction, currentManager]);
  
  // API call helpers for actions
  const makeAuctionAction = async (action: string, data: any) => {
    try {
      addDebugMessage(`Making auction action: ${action}`);
      await axios.post('/api/auction/action', {
        auctionId,
        action,
        ...data,
        managerId: role === 'commissioner' ? data.managerId : managerId,
      });
      
      // We don't need to update state here - Pusher will handle that
      addDebugMessage(`Action ${action} sent successfully`);
      return true;
    } catch (err) {
      addDebugMessage(`Error making action ${action}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  };
  
  // Place bid
  const handleBid = useCallback((playerId: string, bidAmount: number) => {
    return makeAuctionAction('BID', { playerId, bidAmount });
  }, [auctionId, managerId, role]);
  
  // Pass on player
  const handlePass = useCallback((playerId: string) => {
    return makeAuctionAction('PASS', { playerId });
  }, [auctionId, managerId, role]);
  
  // Nominate player
  const handleNominate = useCallback((playerId: string, startingBid: number) => {
    return makeAuctionAction('NOMINATE', { playerId, startingBid });
  }, [auctionId, managerId, role]);
  
  // Commissioner specific handlers
  const handlePauseAuction = useCallback(() => {
    return makeAuctionAction('PAUSE_AUCTION', {});
  }, [auctionId]);
  
  const handleResumeAuction = useCallback(() => {
    return makeAuctionAction('RESUME_AUCTION', {});
  }, [auctionId]);
  
  const handleEndAuction = useCallback(() => {
    return makeAuctionAction('END_AUCTION', {});
  }, [auctionId]);
  
  const handleUpdateManagerBudget = useCallback((managerId: string, newBudget: number) => {
    return makeAuctionAction('UPDATE_BUDGET', { managerId, newBudget });
  }, [auctionId]);
  
  const handleNominateForManager = useCallback((playerId: string, startingBid: number, managerId: string) => {
    return makeAuctionAction('NOMINATE', { playerId, startingBid, managerId });
  }, [auctionId]);
  
  const handleAdjustTime = useCallback((playerId: string, secondsToAdjust: number) => {
    return makeAuctionAction('ADJUST_TIME', { playerId, secondsToAdjust });
  }, [auctionId]);
  
  const handleRemovePlayer = useCallback((playerId: string) => {
    return makeAuctionAction('REMOVE_PLAYER', { playerId });
  }, [auctionId]);
  
  const handleCancelBid = useCallback((playerId: string) => {
    return makeAuctionAction('CANCEL_BID', { playerId });
  }, [auctionId]);
  
  const handleBidForManager = useCallback((playerId: string, bidAmount: number, managerId: string) => {
    return makeAuctionAction('BID', { playerId, bidAmount, managerId });
  }, [auctionId]);
  
  // Manual verify player count
  const handleVerifyPlayerCount = useCallback(async () => {
    try {
      addDebugMessage('Manual player count verification requested');
      const response = await fetch('/api/auction/fix-player-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        addDebugMessage(`Player count verification complete: ${JSON.stringify(data.counts)}`);
        // Refresh the auction data
        await fetchFullAuction();
      } else {
        addDebugMessage('Player count verification failed');
      }
    } catch (error) {
      console.error('Failed to verify player count:', error);
      addDebugMessage(`Error verifying player count: ${error}`);
    }
  }, [auctionId, fetchFullAuction]);
  
  // Manual retry connection button handler
  const handleRetryConnection = () => {
    addDebugMessage('Manual retry connection requested');
    setConnectionStatus('connecting');
    setLoading(true);
    setError(null);
    
    // Reload the page to reconnect
    window.location.reload();
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading auction...</p>
          <p className="mt-2 text-sm text-gray-500">Connection status: {connectionStatus}</p>
          
          {connectionStatus === 'disconnected' && (
            <button
              onClick={handleRetryConnection}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Retry Connection
            </button>
          )}
          
          {/* Debug information - collapsible */}
          <details className="mt-6 text-xs text-left mx-auto max-w-md bg-white p-4 rounded shadow">
            <summary className="cursor-pointer text-gray-500 font-medium">Connection Details</summary>
            <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
              <div className="mb-1">Status: {connectionStatus}</div>
              <div className="mb-1">Auction ID: {auctionId}</div>
              <div className="mb-1">Role: {role}</div>
              <div className="mb-1">Manager ID: {managerId || 'N/A'}</div>
              <div className="mb-1">Session ID: {sessionId ? `${sessionId.substring(0, 8)}...` : 'N/A'}</div>
              
              <div className="mt-2 font-medium">Recent Debug Messages:</div>
              {debug.slice(-10).map((msg, i) => (
                <div key={i} className="mb-1 text-xs">{msg}</div>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }
  
  if (error || !auction) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="mb-4">{error || 'Failed to load auction'}</p>
          <p className="mb-4 text-sm text-gray-500">Connection status: {connectionStatus}</p>
          
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleRetryConnection}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Retry Connection
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/')}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to Home
            </button>
          </div>
          
          {/* Debug information */}
          <details className="mt-6 text-xs">
            <summary className="cursor-pointer text-gray-500">Show Debug Info</summary>
            <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-80">
              <div className="mb-1">Status: {connectionStatus}</div>
              <div className="font-medium mt-2">All Debug Messages:</div>
              {debug.map((msg, i) => (
                <div key={i} className="mb-1">{msg}</div>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {auction.settings.leagueName} Auction
          </h1>
          
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
              connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
            }`}>
              {connectionStatus}
            </span>
            
            {role === 'commissioner' && (
              <button
                onClick={() => setShowDebugger(!showDebugger)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {showDebugger ? 'Hide' : 'Show'} Debugger
              </button>
            )}
          </div>
        </div>
        
        <AuctionStatus
          auction={auction}
          currentManager={currentManager}
          role={role}
        />
        
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main auction area - players up for auction */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Players Up For Auction
            </h2>
            
            {auction.playersUp.length === 0 ? (
              <div className="bg-white shadow-md rounded-lg p-6 text-center">
                <p className="text-gray-500">
                  {auction.status === 'completed'
                    ? 'Auction is complete'
                    : auction.status === 'paused'
                    ? 'Auction is paused'
                    : 'No players up for auction'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {auction.playersUp.map((player) => (
                  <PlayerCard
                    key={player.playerId}
                    player={player}
                    currentManager={currentManager}
                    role={role}
                    managers={auction.managers}
                    isBlindBidding={!auction.settings.showHighBidder}
                    onBid={handleBid}
                    onPass={handlePass}
                    onRemove={role === 'commissioner' ? handleRemovePlayer : undefined}
                    onCancelBid={role === 'commissioner' ? handleCancelBid : undefined}
                    onAdjustTime={role === 'commissioner' ? handleAdjustTime : undefined}
                    onBidForManager={role === 'commissioner' ? handleBidForManager : undefined}
                  />
                ))}
              </div>
            )}
            
            {/* Recently completed players */}
            {auction.completedPlayers.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Recently Completed
                </h2>
                
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Player
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Winning Bid
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Winner
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auction.completedPlayers.slice(0, 5).map((player) => {
                        const winner = auction.managers.find(m => m.id === player.winner);
                        
                        return (
                          <tr key={player.playerId}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {player.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {player.position}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-medium">
                              ${player.finalBid}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {winner ? winner.name : 'Unknown'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar - controls and info */}
          <div className="space-y-6">
            {/* Commissioner controls with verify button */}
            {role === 'commissioner' && (
              <>
                <CommissionerControls
                  auction={auction}
                  onPauseAuction={handlePauseAuction}
                  onResumeAuction={handleResumeAuction}
                  onEndAuction={handleEndAuction}
                  onUpdateManagerBudget={handleUpdateManagerBudget}
                  onNominateForManager={handleNominateForManager}
                />
                
                {/* Verify Player Count Button */}
                <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                  <div className="p-4">
                    <button
                      type="button"
                      onClick={handleVerifyPlayerCount}
                      className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Verify Player Count
                    </button>
                    <p className="mt-2 text-xs text-gray-500">
                      Use this if player counts seem incorrect
                    </p>
                  </div>
                </div>
              </>
            )}
            
            {/* Player Count Debugger - for commissioner only */}
            {role === 'commissioner' && showDebugger && (
              <PlayerCountDebugger auctionId={auctionId} />
            )}
            
            {/* Bid/Nomination interface for managers */}
            {(role === 'manager' || role === 'commissioner') && (
              <BidInterface
                auction={auction}
                currentManager={currentManager}
                role={role}
                canNominate={canNominate()}
                onNominate={handleNominate}
              />
            )}
            
            {/* Player nomination queue (for managers) */}
            {(role === 'manager') && (
              <PlayerQueue
                auction={auction}
                onNominate={canNominate() ? handleNominate : undefined}
              />
            )}
            
            {/* Team summaries */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-lg font-medium">Team Summaries</h3>
              </div>
              
              <div className="divide-y divide-gray-200">
                {auction.managers.map(manager => {
                  // Get players won by this manager
                  const wonPlayers = auction.completedPlayers.filter(p => p.winner === manager.id);
                  
                  // Group won players by position
                  const playersByPosition: Record<string, typeof wonPlayers> = {};
                  wonPlayers.forEach(player => {
                    if (!playersByPosition[player.position]) {
                      playersByPosition[player.position] = [];
                    }
                    playersByPosition[player.position].push(player);
                  });
                  
                  return (
                    <div key={manager.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">
                          {manager.name} 
                          {currentManager && currentManager.id === manager.id && ' (You)'}
                        </h4>
                        <span className="text-green-600 font-medium">
                          ${manager.budget}
                        </span>
                      </div>
                      
                      {wonPlayers.length > 0 ? (
                        <div className="mt-2">
                          {Object.entries(playersByPosition).map(([position, players]) => (
                            <div key={position} className="mb-2">
                              <h5 className="text-xs font-medium text-gray-500">{position}</h5>
                              <ul className="text-sm">
                                {players.map(player => (
                                  <li key={player.playerId}>
                                    {player.name} (${player.finalBid})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">No players won yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}