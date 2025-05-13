// components/setup/PlayerSelection.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SleeperPlayer } from '../../lib/sleeper';

interface PlayerSelectionProps {
  leagueId: string;
  onPlayersSelected: (players: SleeperPlayer[]) => void;
}

export default function PlayerSelection({
  leagueId,
  onPlayersSelected,
}: PlayerSelectionProps) {
  const [availablePlayers, setAvailablePlayers] = useState<SleeperPlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<SleeperPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [includeRostered, setIncludeRostered] = useState(false);
  const [includeRookiesOnly, setIncludeRookiesOnly] = useState(false);
  
  // Fetch players
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`/api/sleeper/players?leagueId=${leagueId}&includeRostered=${includeRostered}`);
        
        // Set available and selected players
        setAvailablePlayers(response.data.players);
        setSelectedPlayers(response.data.players);
      } catch (err: any) {
        console.error('Error fetching players:', err);
        setError(err.response?.data?.message || 'Failed to fetch players');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlayers();
  }, [leagueId, includeRostered]);
  
  // Filter players based on search and filters
  const filteredAvailablePlayers = availablePlayers.filter(player => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Position filter
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    
    // Rookie filter
    const matchesRookie = !includeRookiesOnly || player.years_exp === 0;
    
    return matchesSearch && matchesPosition && matchesRookie;
  });
  
  // Filter selected players based on search and filters
  const filteredSelectedPlayers = selectedPlayers.filter(player => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Position filter
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    
    // Rookie filter
    const matchesRookie = !includeRookiesOnly || player.years_exp === 0;
    
    return matchesSearch && matchesPosition && matchesRookie;
  });
  
  // Add all filtered players to selection
  const handleAddAll = () => {
    setSelectedPlayers(prevSelected => {
      // Get IDs of all players currently selected
      const selectedIds = new Set(prevSelected.map(p => p.player_id));
      
      // Add all filtered players that aren't already selected
      const newPlayers = filteredAvailablePlayers.filter(
        player => !selectedIds.has(player.player_id)
      );
      
      return [...prevSelected, ...newPlayers];
    });
  };
  
  // Remove all filtered players from selection
  const handleRemoveAll = () => {
    const filteredIds = new Set(filteredSelectedPlayers.map(p => p.player_id));
    
    setSelectedPlayers(prevSelected =>
      prevSelected.filter(player => !filteredIds.has(player.player_id))
    );
  };
  
  // Add a single player to selection
  const handleAddPlayer = (player: SleeperPlayer) => {
    setSelectedPlayers(prevSelected => {
      // Check if player is already selected
      if (prevSelected.some(p => p.player_id === player.player_id)) {
        return prevSelected;
      }
      
      return [...prevSelected, player];
    });
  };
  
  // Remove a single player from selection
  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(prevSelected =>
      prevSelected.filter(player => player.player_id !== playerId)
    );
  };
  
  // Complete player selection
  const handleSubmit = () => {
    onPlayersSelected(selectedPlayers);
  };
  
  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Loading Players...</h2>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Error Loading Players</h2>
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Select Players for Auction</h2>
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
            Search Players
          </label>
          <input
            type="text"
            id="searchTerm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or team"
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
        </div>
        
        <div>
          <label htmlFor="positionFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Position
          </label>
          <select
            id="positionFilter"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          >
            <option value="all">All Positions</option>
            <option value="QB">Quarterbacks</option>
            <option value="RB">Running Backs</option>
            <option value="WR">Wide Receivers</option>
            <option value="TE">Tight Ends</option>
            <option value="K">Kickers</option>
            <option value="DEF">Defense</option>
          </select>
        </div>
      </div>
      
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center">
          <input
            id="includeRostered"
            type="checkbox"
            checked={includeRostered}
            onChange={(e) => setIncludeRostered(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="includeRostered" className="ml-2 block text-sm text-gray-900">
            Include Rostered Players
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            id="includeRookiesOnly"
            type="checkbox"
            checked={includeRookiesOnly}
            onChange={(e) => setIncludeRookiesOnly(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="includeRookiesOnly" className="ml-2 block text-sm text-gray-900">
            Rookies Only
          </label>
        </div>
      </div>
      
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAddAll}
          className="py-1 px-3 text-xs border border-transparent rounded-md shadow-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Add All Filtered
        </button>
        
        <button
          type="button"
          onClick={handleRemoveAll}
          className="py-1 px-3 text-xs border border-transparent rounded-md shadow-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Remove All Filtered
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-md">
          <div className="px-4 py-2 bg-gray-50 border-b">
            <h3 className="text-lg font-medium">Available Players ({filteredAvailablePlayers.length})</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvailablePlayers.map(player => (
                  <tr key={player.player_id}>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.full_name}
                      {player.years_exp === 0 && (
                        <span className="ml-1 text-xs text-white bg-green-500 px-1 rounded">R</span>
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.position}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.team || 'FA'}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => handleAddPlayer(player)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAvailablePlayers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No players match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="border rounded-md">
          <div className="px-4 py-2 bg-gray-50 border-b">
            <h3 className="text-lg font-medium">Selected Players ({selectedPlayers.length})</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSelectedPlayers.map(player => (
                  <tr key={player.player_id}>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.full_name}
                      {player.years_exp === 0 && (
                        <span className="ml-1 text-xs text-white bg-green-500 px-1 rounded">R</span>
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.position}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      {player.team || 'FA'}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(player.player_id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSelectedPlayers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No selected players match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selectedPlayers.length === 0}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          Continue with {selectedPlayers.length} Players
        </button>
      </div>
    </div>
  );
}