// components/auction/AuctionStatus.tsx - Updated version
import React from 'react';
import { Auction, Manager } from '../../lib/auction';

interface AuctionStatusProps {
  auction: Auction;
  currentManager: Manager | null;
  role: 'commissioner' | 'manager' | 'viewer';
}

const AuctionStatus = ({ auction, currentManager, role }: AuctionStatusProps) => {
  // Use the availablePlayers length or availablePlayersCount for total players
  const totalPlayers = auction.availablePlayers?.length || 
                      auction.settings.availablePlayersCount || 
                      auction.settings.totalPlayers || 0;

  const getStatusTag = () => {
    switch (auction.status) {
      case 'setup':
        return (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
            Setup
          </span>
        );
      case 'active':
        return (
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
            Paused
          </span>
        );
      case 'completed':
        return (
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
            Completed
          </span>
        );
      default:
        return null;
    }
  };
  
  // Get the current nominating manager
  const getCurrentNominatingManager = () => {
    if (auction.status !== 'active') return null;
    
    const nominatingManager = auction.managers[auction.currentNominationManagerIndex];
    if (!nominatingManager) return null;
    
    return nominatingManager;
  };
  
  const nominatingManager = getCurrentNominatingManager();
  const isCurrentManagerNominating = nominatingManager && currentManager && 
    nominatingManager.id === currentManager.id;
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <span className="text-sm text-gray-500">Status:</span>
          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            getStatusColor(auction.status)
          }`}>
            {auction.status}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-500">Current Nominator:</span>
          <span className="ml-2">
            {getCurrentNominator(auction)}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-500">Players Auctioned:</span>
          <span className="ml-2">
            {auction.completedPlayers.length} of {totalPlayers}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuctionStatus;