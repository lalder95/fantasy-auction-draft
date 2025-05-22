import React, { useState, useEffect } from 'react';

interface PlayerCountDebuggerProps {
  auctionId: string;
}

export default function PlayerCountDebugger({ auctionId }: PlayerCountDebuggerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  
  useEffect(() => {
    const fetchDiagnosticData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/auction/player-stats-diagnostic?auctionId=${auctionId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setDiagnosticData(data);
        } else {
          setError('Failed to fetch diagnostic data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    
    fetchDiagnosticData();
  }, [auctionId, refreshCount]);
  
  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
  };
  
  const handleFixMismatch = async () => {
    try {
      setLoading(true);
      // Force a recount and fix
      const response = await fetch('/api/auction/fix-player-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ auctionId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      handleRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Player Count Diagnostic</h3>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {diagnosticData && !diagnosticData.diagnostics.countMatch && (
            <button
              onClick={handleFixMismatch}
              disabled={loading}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Fix Mismatch
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading && !diagnosticData && (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading diagnostic data...</p>
        </div>
      )}
      
      {diagnosticData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Available Players</div>
              <div className="text-xl font-semibold">{diagnosticData.availablePlayers}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Total Players</div>
              <div className="text-xl font-semibold">{diagnosticData.totalPlayers}</div>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Verification</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Expected Count:</span>
                <span className="font-medium">{diagnosticData.expectedPlayerCount !== null ? diagnosticData.expectedPlayerCount : 'Not set'}</span>
              </div>
              
              {diagnosticData.expectedPlayerCount !== null && (
                <div className="flex justify-between">
                  <span>Matches Actual:</span>
                  <span className={diagnosticData.availablePlayers === diagnosticData.expectedPlayerCount ? 'text-green-600' : 'text-red-600 font-medium'}>
                    {diagnosticData.availablePlayers === diagnosticData.expectedPlayerCount ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Direct Count vs. Code Count:</span>
                <span className={diagnosticData.diagnostics.countMatch ? 'text-green-600' : 'text-red-600 font-medium'}>
                  {diagnosticData.diagnostics.directCount} / {diagnosticData.diagnostics.codeCount}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Duplicate Records:</span>
                <span className={diagnosticData.diagnostics.hasDuplicates ? 'text-red-600 font-medium' : 'text-green-600'}>
                  {diagnosticData.diagnostics.hasDuplicates ? `${diagnosticData.diagnostics.duplicateCount} found` : 'None'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Active Transactions:</span>
                <span className="font-medium">{diagnosticData.diagnostics.activeTransactions}</span>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Sample Players</h4>
            
            {diagnosticData.diagnostics.randomSample.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500">ID</th>
                      <th className="px-2 py-1 text-left text-gray-500">Name</th>
                      <th className="px-2 py-1 text-left text-gray-500">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {diagnosticData.diagnostics.randomSample.map((player: any, index: number) => (
                      <tr key={index}>
                        <td className="px-2 py-1 truncate max-w-32">{player.player_id}</td>
                        <td className="px-2 py-1">{player.full_name}</td>
                        <td className="px-2 py-1">{player.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No sample players found</p>
            )}
          </div>
          
          {diagnosticData.diagnostics.hasDuplicates && (
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium mb-2 text-red-600">Duplicate Players</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-gray-500">Player ID</th>
                      <th className="px-2 py-1 text-left text-gray-500">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {diagnosticData.diagnostics.sampleDuplicates.map((dup: any, index: number) => (
                      <tr key={index}>
                        <td className="px-2 py-1 truncate max-w-32">{dup.player_id}</td>
                        <td className="px-2 py-1">{dup.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}