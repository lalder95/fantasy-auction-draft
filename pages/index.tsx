// pages/index.tsx - Fixed version
import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  
  return (
    <div className="bg-gray-100 min-h-screen">
      <Head>
        <title>Fantasy Football Auction Draft</title>
        <meta name="description" content="Customizable auction draft platform for Sleeper fantasy football leagues" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Fantasy Football</span>
            <span className="block text-indigo-600">Auction Draft Platform</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A highly customizable auction draft platform for Sleeper fantasy football leagues.
            Create your auction, invite managers, and enjoy full control over your draft experience.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <Link href="/setup" legacyBehavior>
                <a className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10">
                  Create New Auction
                </a>
              </Link>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <Link href="/join" legacyBehavior>
                <a className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10">
                  Join Auction
                </a>
              </Link>
            </div>
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">
            Features
          </h2>
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Sleeper Integration</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Connect directly with your Sleeper league to import teams and players for a seamless experience.
                </p>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Full Customization</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Set custom budgets, nomination rules, auction formats, and more to match your league&apos;s preferences.
                </p>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Real-time Bidding</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Experience live auction action with instant updates and no page refreshes needed.
                </p>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Commissioner Tools</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Pause auctions, adjust time, cancel bids, and more with powerful commissioner controls.
                </p>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Nomination Queues</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Let managers prepare by creating a queue of players they want to nominate when it&apos;s their turn.
                </p>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">Results Export</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Get detailed auction results sent directly to your email once the draft is complete.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Fantasy Auction Draft. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}