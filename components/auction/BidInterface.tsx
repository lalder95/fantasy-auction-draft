// components/auction/BidInterface.tsx
import React, { useState } from 'react';
import { Auction, Manager } from '../../lib/auction';

interface BidInterfaceProps {
  auction: Auction;
  currentManager: Manager | null;
  role: 'commissioner' | 'manager';
  canNominate: boolean;
  onNominate: (playerId: string, startingBid: number) => void;
}

export default function BidInterface({
  auction,
  currentManager,
  role,
  canNominate,
  onNominate,
}: BidInterfaceProps) {
  const [nominationSearch, setNominationSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [startingBid, setStartingBid] = useState(1);
  
  // Filter available players by search term
  const filteredPlayers = nominationSearch
    ? auction.availablePlayers.filter(player =>
        player.full_name.toLowerCase().includes(nominationSearch.toLowerCase()) ||
        (player.team && player.team.toLowerCase().includes(nominationSearch.toLowerCase())) ||
        player.position.toLowerCase().includes(nominationSearch.toLowerCase())
      )
    : [];
  
  // Handle nomination
  const handleNominate = () => {
    if (selectedPlayer && canNominate) {
      onNominate(selectedPlayer, startingBid);
      setSelectedPlayer(null);
      setNominationSearch('');
      setStartingBid(1);
    }
  };
  
  // Select a player from search results
  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayer(playerId);
    const player = auction.availablePlayers.find(p => p.player_id === playerId);
    if (player) {
      setNominationSearch(player.full_name);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-lg font-medium">
          {canNominate ? 'Nominate a Player' : 'Waiting for Nomination'}
        </h3>
      </div>
      
      <div className="p-4">
        {!canNominate ? (
          <p className="text-gray-500 text-sm">
            {auction.status === 'active'
              ? `Waiting for ${auction.managers[auction.currentNominationManagerIndex]?.name || 'next manager'} to nominate`
              : 'Auction is not active'}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <label htmlFor="nominationSearch" className="block text-sm font-medium text-gray-700 mb-1">
                Search for a player to nominate
              </label>
              <input
                type="text"
                id="nominationSearch"
                value={nominationSearch}
                onChange={(e) => {
                  setNominationSearch(e.target.value);
                  setSelectedPlayer(null);
                }}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Type player name, team, or position"
              />
              
              {/* Search results dropdown */}
              {nominationSearch && filteredPlayers.length > 0 && !selectedPlayer && (
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
            
            <div>
              <label htmlFor="startingBid" className="block text-sm font-medium text-gray-700 mb-1">
                Starting Bid
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="startingBid"
                  min="1"
                  max={currentManager?.budget || 999999}
                  value={startingBid}
                  onChange={(e) => setStartingBid(parseInt(e.target.value) || 1)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <button
                type="button"
                onClick={handleNominate}
                disabled={!!(selectedPlayer === null) || startingBid < 1 || !!(currentManager && startingBid > currentManager.budget)}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                Nominate Player
            </button>
          </div>
        )}
      </div>
    </div>
  );
}