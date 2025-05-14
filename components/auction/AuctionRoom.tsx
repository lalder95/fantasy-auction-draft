// components/auction/AuctionRoom.tsx - Updated with correct role types
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
  
  // Initialize socket connection
  useEffect(() => {
    const initSocket = async () => {
      try {
        // Make sure socket is created on client side only
        await fetch('/api/socket');
        
        // Initialize socket if not already initialized
        if (!socket) {
          socket = io({
            path: '/api/socket',
          });
        }
        
        // Socket event handlers
        socket.on('connect', () => {
          setConnectionStatus('connected');
          
          // Join auction room
          if (socket) {
            socket.emit('JOIN_AUCTION', {
              auctionId,
              role,
              sessionId,
              managerId,
            });
          }
        });
        
        socket.on('disconnect', () => {
          setConnectionStatus('disconnected');
        });
        
        socket.on('AUCTION_UPDATE', (data) => {
          setAuction(data);
          setLoading(false);
          
          // If manager role, find current manager
          if (role === 'manager' && managerId) {
            const manager = data.managers.find((m: Manager) => m.id === managerId);
            setCurrentManager(manager || null);
          }
        });
        
        if (managerId) {
          socket.on(`AUCTION_UPDATE:${managerId}`, (data) => {
            setAuction(data);
            setLoading(false);
            setCurrentManager(data.currentManager || null);
          });
        }
        
        socket.on('ERROR', (data) => {
          setError(data.message);
        });
      } catch (err) {
        console.error('Error initializing socket:', err);
        setError('Failed to connect to auction room');
        setLoading(false);
      }
    };
    
    initSocket();
    
    // Cleanup function
    return () => {
      if (socket) {
        // Remove all listeners
        socket.off('connect');
        socket.off('disconnect');
        socket.off('AUCTION_UPDATE');
        if (managerId) {
          socket.off(`AUCTION_UPDATE:${managerId}`);
        }
        socket.off('ERROR');
        
        // Disconnect socket
        socket.disconnect();
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
    if (!socket) return;
    
    socket.emit('PLACE_BID', {
      playerId,
      bidAmount,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId]);
  
  // Pass on player
  const handlePass = useCallback((playerId: string) => {
    if (!socket) return;
    
    socket.emit('PASS_ON_PLAYER', {
      playerId,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId]);
  
  // Nominate player
  const handleNominate = useCallback((playerId: string, startingBid: number) => {
    if (!socket) return;
    
    socket.emit('NOMINATE_PLAYER', {
      playerId,
      startingBid,
      managerId: role === 'commissioner' ? undefined : managerId,
    });
  }, [role, managerId]);
  
  // Commissioner specific handlers
  const handlePauseAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('PAUSE_AUCTION');
  }, [role]);
  
  const handleResumeAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('RESUME_AUCTION');
  }, [role]);
  
  const handleEndAuction = useCallback(() => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('END_AUCTION');
  }, [role]);
  
  const handleUpdateManagerBudget = useCallback((managerId: string, newBudget: number) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('UPDATE_BUDGET', {
      managerId,
      newBudget,
    });
  }, [role]);
  
  const handleNominateForManager = useCallback((playerId: string, startingBid: number, managerId: string) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('NOMINATE_PLAYER', {
      playerId,
      startingBid,
      managerId,
    });
  }, [role]);
  
  const handleAdjustTime = useCallback((playerId: string, secondsToAdjust: number) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('ADJUST_TIME', {
      playerId,
      secondsToAdjust,
    });
  }, [role]);
  
  const handleRemovePlayer = useCallback((playerId: string) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('REMOVE_PLAYER', {
      playerId,
    });
  }, [role]);
  
  const handleCancelBid = useCallback((playerId: string) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('CANCEL_BID', {
      playerId,
    });
  }, [role]);
  
  const handleBidForManager = useCallback((playerId: string, bidAmount: number, managerId: string) => {
    if (!socket || role !== 'commissioner') return;
    
    socket.emit('PLACE_BID', {
      playerId,
      bidAmount,
      managerId,
    });
  }, [role]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading auction...</p>
          <p className="mt-2 text-sm text-gray-500">Connection status: {connectionStatus}</p>
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
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {auction.settings.leagueName} Auction
          </h1>
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
          </div>
        </div>
      </div>
    </div>
  );
}