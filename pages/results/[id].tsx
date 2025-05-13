// pages/results/[id].tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';

export default function ResultsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchResults = async () => {
      if (!id || typeof id !== 'string') return;
      
      try {
        const response = await axios.get(`/api/auction/results?auctionId=${id}`);
        setResults(response.data.results);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching results:', err);
        setError(err.response?.data?.message || 'Failed to fetch auction results');
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [id]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading auction results...</p>
        </div>
      </div>
    );
  }
  
  if (error || !results) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="mb-4">{error || 'Failed to load auction results'}</p>
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
  
  // Group results by position
  const resultsByPosition: Record<string, typeof results> = {};
  results.forEach(result => {
    if (!resultsByPosition[result.position]) {
      resultsByPosition[result.position] = [];
    }
    resultsByPosition[result.position].push(result);
  });
  
  // Group results by manager
  const resultsByManager: Record<string, typeof results> = {};
  results.forEach(result => {
    if (!resultsByManager[result.winningManager]) {
      resultsByManager[result.winningManager] = [];
    }
    resultsByManager[result.winningManager].push(result);
  });
  
  return (
    <div className="bg-gray-100 min-h-screen py-12">
      <Head>
        <title>Auction Results | Fantasy Football Auction Draft</title>
        <meta name="description" content="Fantasy football auction draft results" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Auction Results
        </h1>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-xl font-bold text-gray-900">Results by Position</h2>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-8">
              {Object.entries(resultsByPosition).map(([position, players]) => (
                <div key={position}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">{position}</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Player
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Team
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Winning Bid
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Manager
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {players
                          .sort((a, b) => b.winningBid - a.winningBid)
                          .map(player => (
                            <tr key={player.playerId}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {player.playerName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {player.team}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-medium">
                                ${player.winningBid}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {player.winningManager}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-xl font-bold text-gray-900">Results by Manager</h2>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="space-y-8">
              {Object.entries(resultsByManager).map(([manager, players]) => {
                // Calculate total spent
                const totalSpent = players.reduce((sum, player) => sum + player.winningBid, 0);
                
                // Group by position
                const playersByPosition: Record<string, typeof players> = {};
                players.forEach(player => {
                  if (!playersByPosition[player.position]) {
                    playersByPosition[player.position] = [];
                  }
                  playersByPosition[player.position].push(player);
                });
                
                return (
                  <div key={manager}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">{manager}</h3>
                      <span className="text-green-600 font-medium">Total Spent: ${totalSpent}</span>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(playersByPosition).map(([position, posPlayers]) => (
                          <div key={position} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                            <dt className="text-sm font-medium text-gray-500">{position}</dt>
                            <dd className="mt-1">
                              <ul className="divide-y divide-gray-200">
                                {posPlayers
                                  .sort((a, b) => b.winningBid - a.winningBid)
                                  .map(player => (
                                    <li key={player.playerId} className="py-2 flex justify-between">
                                      <span className="text-sm">{player.playerName} ({player.team})</span>
                                      <span className="text-sm text-green-600 font-medium">${player.winningBid}</span>
                                    </li>
                                  ))}
                              </ul>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}