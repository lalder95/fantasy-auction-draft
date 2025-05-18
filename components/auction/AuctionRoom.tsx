// components/auction/AuctionRoom.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import io, { Socket } from 'socket.io-client';
import { Auction, Manager, PlayerUp } from '../../lib/auction';
import AuctionStatus from './AuctionStatus';
import PlayerCard from './PlayerCard';
import BidInterface from './BidInterface';
import PlayerQueue from './PlayerQueue';
import CommissionerControls from './CommissionerControls';

interface AuctionRoomProps {
  auctionId: string;
  role: 'commissioner' | 'manager' | 'viewer';
  managerId?: string;
  sessionId?: string;
}

// Move socket outside component to maintain it between renders
let socket: Socket | null = null;
let socketRetryCount = 0;
const MAX_RETRIES = 5;

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
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'reconnecting'>('connecting');
  const [debug, setDebug] = useState<string[]>([]);

  const addDebugMessage = (message: string) => {
    setDebug(prev => {
      const newMessages = [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`];
      return newMessages.slice(-50);
    });
    console.log(`DEBUG: ${message}`);
  };
  
  // Initialize socket connection - simplified approach
  useEffect(() => {
    const setupSocket = () => {
      try {
        addDebugMessage('Initializing socket connection...');
        
        // Directly attempt to create the socket connection
        if (socket) {
          addDebugMessage('Cleaning up previous socket...');
          socket.disconnect();
        }
        
        // Create socket with simplified configuration
        socket = io({
          path: '/api/socket',
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000
        });
        
        // Set up event handlers
        socket.on('connect', () => {
          addDebugMessage(`Socket connected with ID: ${socket?.id}`);
          setConnectionStatus('connected');
          socketRetryCount = 0;
          
          // Join auction room
          if (socket) {
            addDebugMessage(`Joining auction room: ${auctionId}`);
            socket.emit('JOIN_AUCTION', {
              auctionId,
              role,
              sessionId,
              managerId,
            });
          }
        });
        
        socket.on('connect_error', (err) => {
          addDebugMessage(`Socket connection error: ${err.message}`);
          setError(`Connection error: ${err.message}`);
          
          if (socketRetryCount < MAX_RETRIES) {
            socketRetryCount++;
            setConnectionStatus('reconnecting');
          }
        });
        
        socket.on('disconnect', (reason) => {
          addDebugMessage(`Socket disconnected: ${reason}`);
          setConnectionStatus('disconnected');
        });
        
        socket.on('AUCTION_UPDATE', (data) => {
          addDebugMessage('Received auction update');
          setAuction(data);
          setLoading(false);
          
          // If manager role, find current manager
          if (role === 'manager' && managerId && data.managers) {
            const manager = data.managers.find((m: Manager) => m.id === managerId);
            setCurrentManager(manager || null);
          }
        });
        
        socket.on('ERROR', (data) => {
          addDebugMessage(`Received error: ${data.message}`);
          setError(data.message);
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addDebugMessage(`Socket initialization error: ${errorMessage}`);
        setError(`Failed to connect: ${errorMessage}`);
      }
    };
    
    // Start the socket setup
    setupSocket();
    
    // Cleanup function
    return () => {
      if (socket) {
        addDebugMessage('Cleaning up socket connection');
        socket.disconnect();
        socket = null;
      }
    };
  }, [auctionId, role, managerId, sessionId]);
  
  // Determine if current manager can nominate
  const canNominate = useCallback(() => {
    if (!auction || !currentManager) return false;
    if (auction.status !== 'active') return false;
    
    // Get the manager whose turn it is to nominate
    const nominatingManager = auction.managers[auction.currentNominationManagerIndex];
    
    // Check if it's this manager's turn
    return nominatingManager && nominatingManager.id === currentManager.id;
  }, [auction, currentManager]);
  
  // Socket event emitters with null checks
  
  // Place bid
  const handleBid = useCallback((playerId: string, bidAmount: number) => {
    if (!socket) {
      addDebugMessage('Cannot place bid: No socket connection');
      return;
    }
    
    addDebugMessage(`Sending PLACE_BID: Player ${playerId}, Bid $${bidAmount}`);
    socket.emit('PLACE_BID', {
      playerId,
      bidAmount,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId, addDebugMessage]);
  
  // Pass on player
  const handlePass = useCallback((playerId: string) => {
    if (!socket) {
      addDebugMessage('Cannot pass: No socket connection');
      return;
    }
    
    addDebugMessage(`Sending PASS_ON_PLAYER: Player ${playerId}`);
    socket.emit('PASS_ON_PLAYER', {
      playerId,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId, addDebugMessage]);
  
  // Nominate player
  const handleNominate = useCallback((playerId: string, startingBid: number) => {
    if (!socket) {
      addDebugMessage('Cannot nominate: No socket connection');
      return;
    }
    
    addDebugMessage(`Sending NOMINATE_PLAYER: Player ${playerId}, Starting Bid $${startingBid}`);
    socket.emit('NOMINATE_PLAYER', {
      playerId,
      startingBid,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId, addDebugMessage]);
  
  // Commissioner specific handlers
  const handlePauseAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot pause auction: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending PAUSE_AUCTION`);
    socket.emit('PAUSE_AUCTION');
  }, [role, addDebugMessage]);
  
  const handleResumeAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot resume auction: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending RESUME_AUCTION`);
    socket.emit('RESUME_AUCTION');
  }, [role, addDebugMessage]);
  
  const handleEndAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot end auction: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending END_AUCTION`);
    socket.emit('END_AUCTION');
  }, [role, addDebugMessage]);
  
  const handleUpdateManagerBudget = useCallback((managerId: string, newBudget: number) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot update budget: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending UPDATE_BUDGET: Manager ${managerId}, Budget $${newBudget}`);
    socket.emit('UPDATE_BUDGET', {
      managerId,
      newBudget,
    });
  }, [role, addDebugMessage]);
  
  const handleNominateForManager = useCallback((playerId: string, startingBid: number, managerId: string) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot nominate for manager: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending NOMINATE_PLAYER as commissioner: Player ${playerId}, Starting Bid $${startingBid}, Manager ${managerId}`);
    socket.emit('NOMINATE_PLAYER', {
      playerId,
      startingBid,
      managerId,
    });
  }, [role, addDebugMessage]);
  
  const handleAdjustTime = useCallback((playerId: string, secondsToAdjust: number) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot adjust time: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending ADJUST_TIME: Player ${playerId}, Seconds ${secondsToAdjust}`);
    socket.emit('ADJUST_TIME', {
      playerId,
      secondsToAdjust,
    });
  }, [role, addDebugMessage]);
  
  const handleRemovePlayer = useCallback((playerId: string) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot remove player: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending REMOVE_PLAYER: Player ${playerId}`);
    socket.emit('REMOVE_PLAYER', {
      playerId,
    });
  }, [role, addDebugMessage]);
  
  const handleCancelBid = useCallback((playerId: string) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot cancel bid: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending CANCEL_BID: Player ${playerId}`);
    socket.emit('CANCEL_BID', {
      playerId,
    });
  }, [role, addDebugMessage]);
  
  const handleBidForManager = useCallback((playerId: string, bidAmount: number, managerId: string) => {
    if (!socket || role !== 'commissioner') {
      addDebugMessage('Cannot bid for manager: No socket or not commissioner');
      return;
    }
    
    addDebugMessage(`Sending PLACE_BID as commissioner: Player ${playerId}, Bid $${bidAmount}, Manager ${managerId}`);
    socket.emit('PLACE_BID', {
      playerId,
      bidAmount,
      managerId,
    });
  }, [role, addDebugMessage]);
  
  // Manual retry connection button handler
  const handleRetryConnection = () => {
    addDebugMessage('Manual retry connection requested');
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    socketRetryCount = 0;
    setConnectionStatus('connecting');
    setLoading(true);
    setError(null);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading auction...</p>
          <p className="mt-2 text-sm text-gray-500">Connection status: {connectionStatus}</p>
          
          {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
            <button
              onClick={handleRetryConnection}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Retry Connection
            </button>
          )}
          
          {/* Extended debug information to help troubleshooting */}
          <details className="mt-6 text-xs text-left mx-auto max-w-md bg-white p-4 rounded shadow">
            <summary className="cursor-pointer text-gray-500 font-medium">Connection Details</summary>
            <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
              <div className="mb-1">Status: {connectionStatus}</div>
              <div className="mb-1">Socket ID: {socket?.id || 'none'}</div>
              <div className="mb-1">Connected: {socket?.connected ? 'Yes' : 'No'}</div>
              <div className="mb-1">Retry Count: {socketRetryCount}</div>
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
          
          {/* Debug information (expanded for troubleshooting) */}
          <details className="mt-6 text-xs">
            <summary className="cursor-pointer text-gray-500">Show Debug Info</summary>
            <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-80">
              <div className="mb-1">Status: {connectionStatus}</div>
              <div className="mb-1">Socket ID: {socket?.id || 'none'}</div>
              <div className="mb-1">Connected: {socket?.connected ? 'Yes' : 'No'}</div>
              <div className="mb-1">Retry Count: {socketRetryCount}</div>
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
          
          <div className="text-sm">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 
              connectionStatus === 'reconnecting' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
            }`}>
              {connectionStatus}
            </span>
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
                {auction.playersUp.map((player: PlayerUp) => (
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
            {/* Commissioner controls */}
            {role === 'commissioner' && (
              <CommissionerControls
                auction={auction}
                onPauseAuction={handlePauseAuction}
                onResumeAuction={handleResumeAuction}
                onEndAuction={handleEndAuction}
                onUpdateManagerBudget={handleUpdateManagerBudget}
                onNominateForManager={handleNominateForManager}
              />
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
            
            {/* Debug information (hidden by default) */}
            <details className="text-xs bg-white shadow-md rounded-lg p-3">
              <summary className="cursor-pointer text-gray-500">Connection Info</summary>
              <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                <div className="mb-1">Status: {connectionStatus}</div>
                <div className="mb-1">Socket ID: {socket?.id || 'none'}</div>
                <div className="mb-1">Connected: {socket?.connected ? 'Yes' : 'No'}</div>
                <div className="mb-1">Retry Count: {socketRetryCount}</div>
                <div className="mt-2 font-medium">Recent Debug Messages:</div>
                {debug.slice(-5).map((msg, i) => (
                  <div key={i} className="mb-1">{msg}</div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}