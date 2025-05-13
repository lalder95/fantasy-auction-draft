// components/auction/PlayerCard.tsx
import React, { useState, useEffect } from 'react';
import { Manager, PlayerUp } from '../../lib/auction';

interface PlayerCardProps {
  player: PlayerUp;
  currentManager?: Manager | null;
  role: 'commissioner' | 'manager' | 'viewer';
  managers: Manager[];
  isBlindBidding: boolean;
  onBid: (playerId: string, bidAmount: number) => void;
  onPass: (playerId: string) => void;
  onRemove?: (playerId: string) => void;
  onCancelBid?: (playerId: string) => void;
  onAdjustTime?: (playerId: string, secondsToAdjust: number) => void;
  onBidForManager?: (playerId: string, bidAmount: number, managerId: string) => void;
}

export default function PlayerCard({
  player,
  currentManager,
  role,
  managers,
  isBlindBidding,
  onBid,
  onPass,
  onRemove,
  onCancelBid,
  onAdjustTime,
  onBidForManager,
}: PlayerCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [bidAmount, setBidAmount] = useState<number>(player.currentBid + 1);
  const [showCommissionerControls, setShowCommissionerControls] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [commissionerBidAmount, setCommissionerBidAmount] = useState<number>(player.currentBid + 1);
  
  // Calculate time remaining
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, player.endTime - now);
      setTimeRemaining(remaining);
    };
    
    calculateTimeRemaining();
    
    const interval = setInterval(calculateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [player.endTime]);
  
  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Get current high bidder name
  const highBidderName = (): string => {
    if (!player.currentBidder) return 'No bids';
    
    // If blind bidding and not commissioner, hide bidder unless it's current manager
    if (isBlindBidding && role !== 'commissioner' && player.currentBidder !== currentManager?.id) {
      return 'Hidden';
    }
    
    const bidder = managers.find(m => m.id === player.currentBidder);
    return bidder ? bidder.name : 'Unknown';
  };
  
  // Check if current manager is winning
  const isWinning = currentManager && player.currentBidder === currentManager.id;
  
  // Check if current manager has passed
  const hasPassed = currentManager && player.passes.includes(currentManager.id);
  
  // Handle bid
  const handleBid = () => {
    onBid(player.playerId, bidAmount);
  };
  
  // Handle pass
  const handlePass = () => {
    onPass(player.playerId);
  };
  
  // Handle commissioner bid for manager
  const handleCommissionerBidForManager = () => {
    if (onBidForManager && selectedManagerId) {
      onBidForManager(player.playerId, commissionerBidAmount, selectedManagerId);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium">
          {player.name} <span className="text-gray-500">({player.position} - {player.team})</span>
        </h3>
        <div className="text-sm">
          Time: <span className={timeRemaining < 10000 ? 'text-red-600 font-bold' : ''}>
            {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-500">Current Bid</p>
            <p className="text-xl font-bold">${player.currentBid}</p>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-500">High Bidder</p>
            <p className="text-lg font-semibold">{highBidderName()}</p>
          </div>
        </div>
        
        {/* Bid controls for managers and commissioner */}
        {role !== 'viewer' && (
          <div className={`flex items-center space-x-2 ${isWinning ? 'opacity-50' : ''}`}>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                min={player.currentBid + 1}
                max={currentManager?.budget || 999999}
                value={bidAmount}
                onChange={(e) => setBidAmount(parseInt(e.target.value) || player.currentBid + 1)}
                disabled={isWinning || hasPassed}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            
            <button
              type="button"
              onClick={handleBid}
              disabled={isWinning || hasPassed || (currentManager && bidAmount > currentManager.budget)}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Bid
            </button>
            
            <button
              type="button"
              onClick={handlePass}
              disabled={isWinning || hasPassed}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Pass
            </button>
          </div>
        )}
        
        {/* Commissioner controls */}
        {role === 'commissioner' && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowCommissionerControls(!showCommissionerControls)}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              {showCommissionerControls ? 'Hide Commissioner Controls' : 'Show Commissioner Controls'}
            </button>
            
            {showCommissionerControls && (
              <div className="mt-2 space-y-4 border-t border-gray-200 pt-4">
                {/* Bid on behalf of manager */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Bid on Behalf of Manager</h4>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="">Select Manager</option>
                      {managers.map(manager => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} (${manager.budget})
                        </option>
                      ))}
                    </select>
                    
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        min={player.currentBid + 1}
                        value={commissionerBidAmount}
                        onChange={(e) => setCommissionerBidAmount(parseInt(e.target.value) || player.currentBid + 1)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCommissionerBidForManager}
                      disabled={!selectedManagerId}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      Place Bid
                    </button>
                  </div>
                </div>
                
                {/* Time adjustment */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Adjust Time</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onAdjustTime && onAdjustTime(player.playerId, -10)}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      -10s
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => onAdjustTime && onAdjustTime(player.playerId, -30)}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      -30s
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => onAdjustTime && onAdjustTime(player.playerId, 30)}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      +30s
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => onAdjustTime && onAdjustTime(player.playerId, 60)}
                      className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      +1m
                    </button>
                  </div>
                </div>
                
                {/* Other controls */}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => onCancelBid && onCancelBid(player.playerId)}
                    className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel Last Bid
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => onRemove && onRemove(player.playerId)}
                    className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Remove Player
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}