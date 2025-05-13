// components/setup/LeagueSetup.tsx
import React, { useState } from 'react';
import axios from 'axios';

interface LeagueSetupProps {
  onLeagueLoaded: (leagueInfo: any, managers: any[]) => void;
}

export default function LeagueSetup({ onLeagueLoaded }: LeagueSetupProps) {
  const [leagueId, setLeagueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leagueId) {
      setError('Please enter a Sleeper league ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/sleeper/league?leagueId=${leagueId}`);
      onLeagueLoaded(response.data.leagueInfo, response.data.managers);
    } catch (err: any) {
      console.error('Error loading league:', err);
      setError(err.response?.data?.message || 'Failed to load league information');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Create Fantasy Football Auction</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="leagueId" className="block text-sm font-medium text-gray-700 mb-1">
            Sleeper League ID
          </label>
          <input
            id="leagueId"
            type="text"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter your Sleeper league ID"
          />
          <p className="mt-1 text-sm text-gray-500">
            You can find your league ID in the URL when viewing your Sleeper league.
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}