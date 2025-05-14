// components/setup/NominationConfig.tsx - Fixed maxPlayers null issue
import React, { useState } from 'react';

interface NominationConfigProps {
  initialSettings: {
    nominationRounds: number;
    maxPlayers: number | null;
    minPlayers: number;
    simultaneousNominations: number;
    nominationDuration: number;
    nominationTimeAllowed: number;
    skipMissedNominations: boolean;
    showHighBidder: boolean;
    completionType: 'nominationRounds' | 'playersWon';
    targetPlayersWon: number;
  };
  onNominationConfigured: (settings: NominationConfigProps['initialSettings']) => void;
}

export default function NominationConfig({
  initialSettings,
  onNominationConfigured,
}: NominationConfigProps) {
  const [settings, setSettings] = useState(initialSettings);
  
  const handleSettingChange = (
    field: keyof NominationConfigProps['initialSettings'],
    value: string | number | boolean
  ) => {
    setSettings({
      ...settings,
      [field]: value,
    });
  };
  
  // Special handler for maxPlayers which can be null
  const handleMaxPlayersChange = (value: string) => {
    setSettings({
      ...settings,
      maxPlayers: value === '' ? null : parseInt(value) || 0,
    });
  };
  
  const handleSubmit = () => {
    onNominationConfigured(settings);
  };
  
  // Convert seconds to minutes and seconds for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0
        ? `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`
        : `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return remainingMinutes > 0
        ? `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
        : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Configure Nomination Settings</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auction Completion Type
          </label>
          <div className="mt-2">
            <div className="flex items-center mb-4">
              <input
                id="completionType-nominationRounds"
                type="radio"
                name="completionType"
                checked={settings.completionType === 'nominationRounds'}
                onChange={() => handleSettingChange('completionType', 'nominationRounds')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <label htmlFor="completionType-nominationRounds" className="ml-3 block text-sm font-medium text-gray-700">
                Complete after each manager has had X nominations
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="completionType-playersWon"
                type="radio"
                name="completionType"
                checked={settings.completionType === 'playersWon'}
                onChange={() => handleSettingChange('completionType', 'playersWon')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <label htmlFor="completionType-playersWon" className="ml-3 block text-sm font-medium text-gray-700">
                Complete after each manager has won X players
              </label>
            </div>
          </div>
        </div>
        
        {settings.completionType === 'nominationRounds' ? (
          <div>
            <label htmlFor="nominationRounds" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Nomination Rounds
            </label>
            <input
              type="number"
              id="nominationRounds"
              min="1"
              value={settings.nominationRounds}
              onChange={(e) => handleSettingChange('nominationRounds', parseInt(e.target.value) || 1)}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <p className="mt-1 text-sm text-gray-500">
              How many complete rounds of nominations will occur in this auction.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="targetPlayersWon" className="block text-sm font-medium text-gray-700 mb-1">
              Target Players Won Per Team
            </label>
            <input
              type="number"
              id="targetPlayersWon"
              min="1"
              value={settings.targetPlayersWon}
              onChange={(e) => handleSettingChange('targetPlayersWon', parseInt(e.target.value) || 1)}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            <p className="mt-1 text-sm text-gray-500">
              The auction will complete when each manager has won this many players.
            </p>
          </div>
        )}
        
        <div>
          <label htmlFor="minPlayers" className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Players Per Team
          </label>
          <input
            type="number"
            id="minPlayers"
            min="0"
            value={settings.minPlayers}
            onChange={(e) => handleSettingChange('minPlayers', parseInt(e.target.value) || 0)}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
          <p className="mt-1 text-sm text-gray-500">
            Minimum number of players each team must win.
          </p>
        </div>
        
        <div>
          <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Players Per Team
          </label>
          <input
            type="number"
            id="maxPlayers"
            min="0"
            value={settings.maxPlayers === null ? '' : settings.maxPlayers}
            onChange={(e) => handleMaxPlayersChange(e.target.value)}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
          <p className="mt-1 text-sm text-gray-500">
            Maximum number of players each team can win. Leave blank for no limit.
          </p>
        </div>
        
        <div>
          <label htmlFor="simultaneousNominations" className="block text-sm font-medium text-gray-700 mb-1">
            Simultaneous Nominations
          </label>
          <input
            type="number"
            id="simultaneousNominations"
            min="1"
            max="10"
            value={settings.simultaneousNominations}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 1;
              handleSettingChange('simultaneousNominations', Math.min(10, Math.max(1, value)));
            }}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
          <p className="mt-1 text-sm text-gray-500">
            Number of players that can be up for auction at the same time (1-10).
          </p>
        </div>
        
        <div>
          <label htmlFor="nominationDuration" className="block text-sm font-medium text-gray-700 mb-1">
            Nomination Duration: {formatDuration(settings.nominationDuration)}
          </label>
          <input
            type="range"
            id="nominationDuration"
            min="10"
            max="172800" // 48 hours in seconds
            step="10"
            value={settings.nominationDuration}
            onChange={(e) => handleSettingChange('nominationDuration', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10 seconds</span>
            <span>5 minutes</span>
            <span>1 hour</span>
            <span>48 hours</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            How long managers have to bid on a nominated player.
          </p>
        </div>
        
        <div>
          <label htmlFor="nominationTimeAllowed" className="block text-sm font-medium text-gray-700 mb-1">
            Nomination Time Allowed: {formatDuration(settings.nominationTimeAllowed)}
          </label>
          <input
            type="range"
            id="nominationTimeAllowed"
            min="10"
            max="172800" // 48 hours in seconds
            step="10"
            value={settings.nominationTimeAllowed}
            onChange={(e) => handleSettingChange('nominationTimeAllowed', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10 seconds</span>
            <span>5 minutes</span>
            <span>1 hour</span>
            <span>48 hours</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            How long managers have to nominate a player when it&apos;s their turn.
          </p>
        </div>
        
        <div className="flex items-center">
          <input
            id="skipMissedNominations"
            type="checkbox"
            checked={settings.skipMissedNominations}
            onChange={(e) => handleSettingChange('skipMissedNominations', e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="skipMissedNominations" className="ml-2 block text-sm text-gray-900">
            Skip missed nominations (if unchecked, an auto-nomination will occur)
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            id="showHighBidder"
            type="checkbox"
            checked={settings.showHighBidder}
            onChange={(e) => handleSettingChange('showHighBidder', e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="showHighBidder" className="ml-2 block text-sm text-gray-900">
            Show current high bidder (if unchecked, bidding will be blind)
          </label>
        </div>
      </div>
      
      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Continue
        </button>
      </div>
    </div>
  );
}