// pages/setup.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import LeagueSetup from '../components/setup/LeagueSetup';
import ManagerConfig from '../components/setup/ManagerConfig';
import BudgetConfig from '../components/setup/BudgetConfig';
import NominationConfig from '../components/setup/NominationConfig';
import PlayerSelection from '../components/setup/PlayerSelection';
import { Manager } from '../lib/auction';

enum SetupStep {
  LEAGUE_SETUP,
  MANAGER_CONFIG,
  BUDGET_CONFIG,
  NOMINATION_CONFIG,
  PLAYER_SELECTION,
  GENERATE_LINKS,
}

export default function Setup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(SetupStep.LEAGUE_SETUP);
  const [leagueInfo, setLeagueInfo] = useState<any>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [settings, setSettings] = useState({
    nominationRounds: 1,
    maxPlayers: null as number | null,
    minPlayers: 0,
    simultaneousNominations: 1,
    nominationDuration: 30, // seconds
    nominationTimeAllowed: 30, // seconds
    skipMissedNominations: false,
    showHighBidder: true,
    defaultBudget: 200,
  });
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commissionerId, setCommissionerId] = useState<string>(uuidv4());
  const [commissionerEmail, setCommissionerEmail] = useState('');
  const [generatedUrls, setGeneratedUrls] = useState<{
    commissioner: string;
    managers: Array<{ managerId: string; name: string; url: string }>;
    viewer: string;
  } | null>(null);
  
  // Handle league loaded
  const handleLeagueLoaded = (leagueInfo: any, leagueManagers: any[]) => {
    setLeagueInfo(leagueInfo);
    
    // Convert league managers to our format
    const formattedManagers: Manager[] = leagueManagers.map((manager, index) => ({
      id: manager.managerId,
      name: manager.displayName,
      rosterId: manager.rosterId,
      avatar: manager.avatar,
      budget: settings.defaultBudget,
      initialBudget: settings.defaultBudget,
      wonPlayers: [],
      nominationOrder: index + 1,
    }));
    
    setManagers(formattedManagers);
    setCurrentStep(SetupStep.MANAGER_CONFIG);
  };
  
  // Handle manager configuration completed
  const handleManagersConfigured = (updatedManagers: Manager[]) => {
    setManagers(updatedManagers);
    setCurrentStep(SetupStep.BUDGET_CONFIG);
  };
  
  // Handle budget configuration completed
  const handleBudgetConfigured = (updatedManagers: Manager[], defaultBudget: number) => {
    setManagers(updatedManagers);
    setSettings({
      ...settings,
      defaultBudget,
    });
    setCurrentStep(SetupStep.NOMINATION_CONFIG);
  };
  
  // Handle nomination settings configured
  const handleNominationConfigured = (updatedSettings: typeof settings) => {
    setSettings(updatedSettings);
    setCurrentStep(SetupStep.PLAYER_SELECTION);
  };
  
  // Handle player selection completed
  const handlePlayersSelected = (players: any[]) => {
    setSelectedPlayers(players);
    setCurrentStep(SetupStep.GENERATE_LINKS);
  };
  
  // Create auction and generate links
  const handleCreateAuction = async () => {
    if (!leagueInfo || !commissionerEmail) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Create the auction
      const createResponse = await axios.post('/api/auction/create', {
        leagueId: leagueInfo.league_id,
        commissionerId,
      });
      
      const newAuctionId = createResponse.data.auctionId;
      setAuctionId(newAuctionId);
      
      // Update settings
      await axios.put('/api/auction/settings', {
        auctionId: newAuctionId,
        settings,
      });
      
      // Update managers
      await axios.put('/api/auction/managers', {
        auctionId: newAuctionId,
        managers,
      });
      
      // Update available players
      await axios.put('/api/auction/players', {
        auctionId: newAuctionId,
        availablePlayers: selectedPlayers,
      });
      
      // Generate URLs
      const urlsResponse = await axios.post('/api/auction/urls', {
        auctionId: newAuctionId,
        commissionerId,
        commissionerEmail,
        baseUrl: window.location.origin,
      });
      
      setGeneratedUrls(urlsResponse.data.urls);
      
      // Redirect to the commissioner view
      router.push(`/auction/${newAuctionId}?role=commissioner&id=${commissionerId}`);
    } catch (err: any) {
      console.error('Error creating auction:', err);
      setError(err.response?.data?.message || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };
  
  // Render current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case SetupStep.LEAGUE_SETUP:
        return <LeagueSetup onLeagueLoaded={handleLeagueLoaded} />;
      
      case SetupStep.MANAGER_CONFIG:
        return <ManagerConfig initialManagers={managers} onManagersConfigured={handleManagersConfigured} />;
      
      case SetupStep.BUDGET_CONFIG:
        return (
          <BudgetConfig
            managers={managers}
            defaultBudget={settings.defaultBudget}
            onBudgetConfigured={handleBudgetConfigured}
          />
        );
      
      case SetupStep.NOMINATION_CONFIG:
        return (
          <NominationConfig
            initialSettings={settings}
            onNominationConfigured={handleNominationConfigured}
          />
        );
      
      case SetupStep.PLAYER_SELECTION:
        return (
          <PlayerSelection
            leagueId={leagueInfo.league_id}
            onPlayersSelected={handlePlayersSelected}
          />
        );
      
      case SetupStep.GENERATE_LINKS:
        return (
          <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-4">Create Auction</h2>
            
            <div className="mb-4">
              <label htmlFor="commissionerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Commissioner Email
              </label>
              <input
                type="email"
                id="commissionerEmail"
                value={commissionerEmail}
                onChange={(e) => setCommissionerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your email address"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                The auction URLs and results will be sent to this email address.
              </p>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <button
              type="button"
              onClick={handleCreateAuction}
              disabled={loading || !commissionerEmail}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating Auction...' : 'Create Auction & Generate Links'}
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-gray-100 min-h-screen py-12">
      <Head>
        <title>Setup Auction | Fantasy Football Auction Draft</title>
        <meta name="description" content="Setup your customized fantasy football auction draft" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center text-gray-900">
            Create Fantasy Football Auction
          </h1>
          
          <div className="max-w-3xl mx-auto mt-6">
            <div className="relative">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                <div
                  style={{ width: `${(currentStep / (SetupStep.GENERATE_LINKS)) * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600"
                ></div>
              </div>
              
              <div className="flex justify-between">
                <div className={`text-xs ${currentStep >= SetupStep.LEAGUE_SETUP ? 'text-indigo-600' : 'text-gray-500'}`}>
                  League Setup
                </div>
                <div className={`text-xs ${currentStep >= SetupStep.MANAGER_CONFIG ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Managers
                </div>
                <div className={`text-xs ${currentStep >= SetupStep.BUDGET_CONFIG ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Budgets
                </div>
                <div className={`text-xs ${currentStep >= SetupStep.NOMINATION_CONFIG ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Rules
                </div>
                <div className={`text-xs ${currentStep >= SetupStep.PLAYER_SELECTION ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Players
                </div>
                <div className={`text-xs ${currentStep >= SetupStep.GENERATE_LINKS ? 'text-indigo-600' : 'text-gray-500'}`}>
                  Create
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {renderCurrentStep()}
      </main>
    </div>
  );
}