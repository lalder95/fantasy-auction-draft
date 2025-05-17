// pages/manager/[id]/[managerId].tsx - Fixed props
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AuctionRoom from '../../../components/auction/AuctionRoom';
import { createManagerSession } from '../../../lib/database-neon';

export default function ManagerPage() {
  const router = useRouter();
  const { id, managerId } = router.query;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create session for manager
  useEffect(() => {
    const createSession = async () => {
      if (!id || !managerId || typeof id !== 'string' || typeof managerId !== 'string') {
        setError('Invalid manager URL');
        setLoading(false);
        return;
      }
      
      try {
        const sessionId = await createManagerSession(id, managerId);
        setSessionId(sessionId);
        setLoading(false);
      } catch (err) {
        console.error('Error creating manager session:', err);
        setError('Failed to authenticate manager');
        setLoading(false);
      }
    };
    
    createSession();
  }, [id, managerId]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading auction...</p>
        </div>
      </div>
    );
  }
  
  if (error || !sessionId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="mb-4">{error || 'Failed to authenticate manager'}</p>
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
  
  return (
    <div>
      <Head>
        <title>Manager View | Fantasy Football Auction Draft</title>
        <meta name="description" content="Fantasy football auction draft manager view" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <AuctionRoom
        auctionId={id as string}
        role="manager"
        managerId={managerId as string}
        sessionId={sessionId}
      />
    </div>
  );
}