// pages/join.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Join() {
  const router = useRouter();
  const [auctionLink, setAuctionLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handleJoin = () => {
    if (!auctionLink) {
      setError('Please enter an auction link');
      return;
    }
    
    try {
      // Extract auction ID from URL
      const url = new URL(auctionLink);
      const pathname = url.pathname;
      
      if (pathname.startsWith('/auction/') || 
          pathname.startsWith('/manager/') || 
          pathname.startsWith('/viewer/')) {
        // Redirect to the provided link
        router.push(auctionLink);
      } else {
        setError('Invalid auction link format');
      }
    } catch (err) {
      setError('Invalid URL format');
    }
  };
  
  return (
    <div className="bg-gray-100 min-h-screen py-12">
      <Head>
        <title>Join Auction | Fantasy Football Auction Draft</title>
        <meta name="description" content="Join an existing fantasy football auction draft" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Join Auction</h1>
          
          <div className="mb-4">
            <label htmlFor="auctionLink" className="block text-sm font-medium text-gray-700 mb-1">
              Auction Link
            </label>
            <input
              type="text"
              id="auctionLink"
              value={auctionLink}
              onChange={(e) => setAuctionLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Paste your auction link here"
            />
            <p className="mt-1 text-sm text-gray-500">
              The commissioner should have sent you a link to join the auction.
            </p>
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <button
            type="button"
            onClick={handleJoin}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Join Auction
          </button>
        </div>
      </main>
    </div>
  );
}