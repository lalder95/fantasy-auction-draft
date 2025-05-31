// pages/auction/[id].tsx - Fixed props
import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AuctionRoom from '../../components/auction/AuctionRoom';

export default function AuctionPage() {
  const router = useRouter();
  const { id, role, commissionerId } = router.query;
  
  if (!id || typeof id !== 'string' || !role || typeof role !== 'string') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Invalid Auction Link</h1>
          <p className="mb-4">This auction link is missing required parameters.</p>
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
  
  // Validate role
  const validRole: 'commissioner' | 'manager' | 'viewer' = 
    role === 'commissioner' || role === 'manager' || role === 'viewer' 
      ? role as 'commissioner' | 'manager' | 'viewer' 
      : 'viewer'; // Default to viewer for invalid roles
  
  return (
    <div>
      <Head>
        <title>Auction Room | Fantasy Football Auction Draft</title>
        <meta name="description" content="Fantasy football auction draft room" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <AuctionRoom
        auctionId={id}
        role={validRole}
        managerId={typeof commissionerId === 'string' ? commissionerId : undefined}
      />
    </div>
  );//
}