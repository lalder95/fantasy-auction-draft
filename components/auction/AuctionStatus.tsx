// components/auction/AuctionStatus.tsx - Fixed version
import React from 'react';
import { Auction, Manager } from '../../lib/auction';

interface AuctionStatusProps {
  auction: Auction;
  currentManager: Manager | null;
  role: 'commissioner' | 'manager' | 'viewer';
}

export default function AuctionStatus({
  auction,
  currentManager,
}: AuctionStatusProps) {
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
    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">Status:</span>
          {getStatusTag()}
        </div>
        
        {auction.status === 'active' && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">
              Current Nominator:
            </span>
            <span className={`font-medium ${isCurrentManagerNominating ? 'text-green-600' : ''}`}>
              {nominatingManager ? nominatingManager.name : 'None'}
              {isCurrentManagerNominating && " (You)"}
            </span>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">
            Players Auctioned:
          </span>
          <span className="font-medium">
            {auction.completedPlayers.length} of {auction.completedPlayers.length + auction.availablePlayers.length + auction.playersUp.length}
          </span>
        </div>
        
        {/* Completion status based on auction type */}
        {auction.settings.completionType === 'nominationRounds' ? (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">
              Nomination Rounds:
            </span>
            <span className="font-medium">
              {/* This would require additional tracking to show current round */}
              {/* For now, just show the target */}
              Target: {auction.settings.nominationRounds} rounds
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">
              Player Acquisition:
            </span>
            <span className="font-medium">
              Target: {auction.settings.targetPlayersWon} per team
            </span>
          </div>
        )}
        
        {currentManager && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Your Budget:</span>
            <span className="font-medium text-green-600">${currentManager.budget}</span>
          </div>
        )}
      </div>
    </div>
  );
}