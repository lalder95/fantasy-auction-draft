// components/auction/PlayerQueue.tsx - Updated for consistency
import React, { useState } from 'react';
import { Auction } from '../../lib/auction';

interface PlayerQueueProps {
  auction: Auction;
  onNominate?: (playerId: string, startingBid: number) => void;
}

export default function PlayerQueue({
  auction,
  onNominate,
}: PlayerQueueProps) {
  const [queuedPlayers, setQueuedPlayers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter available players by search term
  const filteredPlayers = searchTerm
    ? auction.availablePlayers.filter(player =>
        player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.team && player.team.toLowerCase().includes(searchTerm.toLowerCase())) ||
        player.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
  
  // Add player to queue
  const addToQueue = (playerId: string) => {
    if (!queuedPlayers.includes(playerId)) {
      setQueuedPlayers([...queuedPlayers, playerId]);
    }
    setSearchTerm('');
  };
  
  // Remove player from queue
  const removeFromQueue = (playerId: string) => {
    setQueuedPlayers(queuedPlayers.filter(id => id !== playerId));
  };
  
  // Move player up in queue
  const moveUp = (index: number) => {
    if (index <= 0) return;
    
    const updatedQueue = [...queuedPlayers];
    [updatedQueue[index], updatedQueue[index - 1]] = [updatedQueue[index - 1], updatedQueue[index]];
    setQueuedPlayers(updatedQueue);
  };
  
  // Move player down in queue
  const moveDown = (index: number) => {
    if (index >= queuedPlayers.length - 1) return;
    
    const updatedQueue = [...queuedPlayers];
    [updatedQueue[index], updatedQueue[index + 1]] = [updatedQueue[index + 1], updatedQueue[index]];
    setQueuedPlayers(updatedQueue);
  };
  
  // Nominate next player from queue
  const nominateNext = () => {
    if (queuedPlayers.length === 0 || !onNominate) return;
    
    const nextPlayerId = queuedPlayers[0];
    onNominate(nextPlayerId, 1);
    setQueuedPlayers(queuedPlayers.slice(1));
  };
  
  // Button disabled state
  const isNominateButtonDisabled = queuedPlayers.length === 0 || !onNominate;
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-lg font-medium">Nomination Queue</h3>
      </div>
      
      <div className="p-4">
        <div className="mb-4">
          <label htmlFor="queueSearch" className="block text-sm font-medium text-gray-700 mb-1">
            Add Players to Queue
          </label>
          <input
            type="text"
            id="queueSearch"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            placeholder="Search players..."
          />
          
          {/* Search results */}
          {searchTerm && filteredPlayers.length > 0 && (
            <div className="mt-1 w-full bg-white shadow-sm rounded-md border border-gray-200 max-h-32 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {filteredPlayers.slice(0, 5).map(player => (
                  <li
                    key={player.player_id}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                    onClick={() => addToQueue(player.player_id)}
                  >
                    <span className="text-sm">{player.full_name}</span>
                    <span className="text-xs text-gray-500">{player.position} - {player.team || 'FA'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Queue list */}
        {queuedPlayers.length === 0 ? (
          <p className="text-sm text-gray-500">Your queue is empty. Add players to queue them for nomination.</p>
        ) : (
          <div>
            <ul className="divide-y divide-gray-200 mb-4 max-h-48 overflow-y-auto">
              {queuedPlayers.map((playerId, index) => {
                const player = auction.availablePlayers.find(p => p.player_id === playerId);
                if (!player) return null;
                
                return (
                  <li key={playerId} className="py-2 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{player.full_name}</p>
                      <p className="text-xs text-gray-500">{player.position} - {player.team || 'FA'}</p>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-500 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === queuedPlayers.length - 1}
                        className="text-gray-400 hover:text-gray-500 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(playerId)}
                        className="text-red-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            
            {onNominate && (
              <button
                type="button"
                onClick={nominateNext}
                disabled={isNominateButtonDisabled}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Nominate Next Player
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}