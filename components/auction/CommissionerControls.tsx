// components/auction/CommissionerControls.tsx
import React, { useState } from 'react';
import { Auction } from '../../lib/auction';

interface CommissionerControlsProps {
  auction: Auction;
  onPauseAuction: () => void;
  onResumeAuction: () => void;
  onEndAuction: () => void;
  onUpdateManagerBudget: (managerId: string, newBudget: number) => void;
  onNominateForManager: (playerId: string, startingBid: number, managerId: string) => void;
}

export default function CommissionerControls({
  auction,
  onPauseAuction,
  onResumeAuction,
  onEndAuction,
  onUpdateManagerBudget,
  onNominateForManager,
}: CommissionerControlsProps) {
  const [showBudgetControls, setShowBudgetControls] = useState(false);
  const [showNominationControls, setShowNominationControls] = useState(false);
  const [selectedManager, setSelectedManager] = useState('');
  const [newBudget, setNewBudget] = useState(0);
  
  // Nomination controls
  const [nominationManager, setNominationManager] = useState('');
  const [nominationSearch, setNominationSearch] = useState('');
  const [nominationPlayer, setNominationPlayer] = useState<string | null>(null);
  const [nominationBid, setNominationBid] = useState(1);
  
  // Filter available players by search term
  const filteredPlayers = nominationSearch
    ? auction.availablePlayers.filter(player =>
        player.full_name.toLowerCase().includes(nominationSearch.toLowerCase()) ||
        (player.team && player.team.toLowerCase().includes(nominationSearch.toLowerCase())) ||
        player.position.toLowerCase().includes(nominationSearch.toLowerCase())
      )
    : [];
  
  // Handle manager budget update
  const handleUpdateBudget = () => {
    if (selectedManager && newBudget >= 0) {
      onUpdateManagerBudget(selectedManager, newBudget);
      setShowBudgetControls(false);
      setSelectedManager('');
      setNewBudget(0);
    }
  };
  
  // Handle nomination for manager
  const handleNominateForManager = () => {
    if (nominationManager && nominationPlayer && nominationBid > 0) {
      onNominateForManager(nominationPlayer, nominationBid, nominationManager);
      setShowNominationControls(false);
      setNominationManager('');
      setNominationPlayer(null);
      setNominationSearch('');
      setNominationBid(1);
    }
  };
  
  // Select a player from search results
  const handleSelectPlayer = (playerId: string) => {
    setNominationPlayer(playerId);
    const player = auction.availablePlayers.find(p => p.player_id === playerId);
    if (player) {
      setNominationSearch(player.full_name);
    }
  };
  
  // Confirm end auction
  const handleEndAuction = () => {
    if (window.confirm('Are you sure you want to end the auction? This action cannot be undone.')) {
      onEndAuction();
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-yellow-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-lg font-medium text-yellow-800">Commissioner Controls</h3>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Auction status controls */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Auction Controls</h4>
          <div className="flex space-x-2">
            {auction.status === 'active' ? (
              <button
                type="button"
                onClick={onPauseAuction}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Pause Auction
              </button>
            ) : (
              <button
                type="button"
                onClick={onResumeAuction}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Resume Auction
              </button>
            )}
            
            <button
              type="button"
              onClick={handleEndAuction}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              End Auction
            </button>
          </div>
        </div>
        
        {/* Budget controls */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Manager Budgets</h4>
          <button
            type="button"
            onClick={() => setShowBudgetControls(!showBudgetControls)}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {showBudgetControls ? 'Hide Budget Controls' : 'Update Manager Budget'}
          </button>
          
          {showBudgetControls && (
            <div className="mt-2 space-y-2">
              <select
                value={selectedManager}
                onChange={(e) => {
                  setSelectedManager(e.target.value);
                  const manager = auction.managers.find(m => m.id === e.target.value);
                  if (manager) {
                    setNewBudget(manager.budget);
                  }
                }}
                className="block w-full mt-1 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select Manager</option>
                {auction.managers.map(manager => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} (Current: ${manager.budget})
                  </option>
                ))}
              </select>
              
              {selectedManager && (
                <>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={newBudget}
                      onChange={(e) => setNewBudget(parseInt(e.target.value) || 0)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleUpdateBudget}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Update Budget
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Nomination controls */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Force Nomination</h4>
          <button
            type="button"
            onClick={() => setShowNominationControls(!showNominationControls)}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {showNominationControls ? 'Hide Nomination Controls' : 'Nominate for Manager'}
          </button>
          
          {showNominationControls && (
            <div className="mt-2 space-y-2">
              <select
                value={nominationManager}
                onChange={(e) => setNominationManager(e.target.value)}
                className="block w-full mt-1 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select Manager</option>
                {auction.managers.map(manager => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
              
              {nominationManager && (
                <>
                  <div className="relative">
                    <input
                      type="text"
                      value={nominationSearch}
                      onChange={(e) => {
                        setNominationSearch(e.target.value);
                        setNominationPlayer(null);
                      }}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Search for a player to nominate"
                    />
                    
                    {/* Search results dropdown */}
                    {nominationSearch && filteredPlayers.length > 0 && !nominationPlayer && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-56 overflow-y-auto">
                        <ul className="divide-y divide-gray-200">
                          {filteredPlayers.slice(0, 10).map(player => (
                            <li
                              key={player.player_id}
                              onClick={() => handleSelectPlayer(player.player_id)}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <div className="flex justify-between">
                                <span className="font-medium">{player.full_name}</span>
                                <span className="text-gray-500">{player.position} - {player.team || 'FA'}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={nominationBid}
                      onChange={(e) => setNominationBid(parseInt(e.target.value) || 1)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                      placeholder="Starting bid"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleNominateForManager}
                    disabled={!nominationPlayer || nominationBid < 1}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Force Nomination
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}