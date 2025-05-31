// components/auction/AuctionStatus.tsx - Updated version
import React from 'react';
import { Auction, Manager } from '../../lib/auction';

interface AuctionStatusProps {
  auction: Auction;
  currentManager: Manager | null;
  role: 'commissioner' | 'manager' | 'viewer';
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'setup':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const AuctionStatus = ({ auction, currentManager, role }: AuctionStatusProps) => {
  // Get total players from the diagnostic data instead of calculating
  const totalPlayers = auction.settings?.playerCountDiagnostic?.totalPlayers || 
                      auction.availablePlayers?.length || 
                      0;

  // If diagnostic data is available but doesn't match the UI count, show a warning
  const hasPlayerCountMismatch = 
    auction.settings?.playerCountDiagnostic?.totalPlayers && 
    auction.settings.playerCountDiagnostic.totalPlayers !== auction.availablePlayers?.length;

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
            {nominatingManager ? nominatingManager.name : <span className="text-gray-400">N/A</span>}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-500">Players Auctioned:</span>
          <span className="ml-2">
            {auction.completedPlayers.length} of {totalPlayers}
            {hasPlayerCountMismatch && (
              <span className="ml-2 text-xs text-orange-500">
                (Player count mismatch detected)
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuctionStatus;