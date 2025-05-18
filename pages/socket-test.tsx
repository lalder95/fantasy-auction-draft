// pages/socket-test.tsx - React component page
import React from 'react';
import Head from 'next/head';
import SocketTester from '../components/auction/SocketTester';

export default function SocketTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-10">
      <Head>
        <title>Socket Connection Test</title>
      </Head>
      
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Socket Connection Test</h1>
        <SocketTester />
        
        <div className="mt-8 p-4 bg-white shadow rounded">
          <h2 className="text-xl font-bold mb-4">Troubleshooting Steps</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Check if the base API is working (first test in debug messages)
            </li>
            <li>
              Verify that Socket.IO can establish a connection (second test)
            </li>
            <li>
              Look for any error messages in the debug output above
            </li>
            <li>
              Check browser console for additional errors (press F12 to open)
            </li>
            <li>
              Try refreshing the page or using a different browser
            </li>
          </ol>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="font-bold mb-2">Common Issues:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>CORS errors - Make sure the API is configured to accept connections from this domain</li>
              <li>Socket.IO version mismatch - Ensure client and server versions are compatible</li>
              <li>Server timeout - Check if server is responding within expected timeframe</li>
              <li>Firewall/Proxy - Check if your network is blocking WebSocket connections</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}