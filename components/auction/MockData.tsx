// components/auction/MockData.tsx - Create a simple component to test socket connection
import React, { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export default function MockDataTester() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'success' | 'error' | 'pending'>('pending');
  
  const addMessage = (msg: string) => {
    setMessages(prev => [...prev, `${new Date().toISOString().slice(11, 19)} - ${msg}`]);
  };
  
  useEffect(() => {
    // Test direct connection to the socket API
    const testDirectApi = async () => {
      try {
        addMessage('Testing direct API connection...');
        const response = await fetch('/api/socket', {
          method: 'GET'
        });
        
        if (response.ok) {
          const data = await response.json();
          addMessage(`API test successful: ${JSON.stringify(data)}`);
          return true;
        } else {
          addMessage(`API test failed: ${response.status} ${response.statusText}`);
          return false;
        }
      } catch (error) {
        addMessage(`API test error: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    };
    
    // Create socket connection
    const createSocket = () => {
      addMessage('Creating socket connection...');
      const socket = io({
        path: '/api/socket',
        transports: ['websocket', 'polling']
      });
      
      socket.on('connect', () => {
        addMessage(`Socket connected with ID: ${socket.id}`);
        setSocketId(socket.id);
        setConnected(true);
        setTestResult('success');
        
        // Send a test message
        socket.emit('ping');
      });
      
      socket.on('connect_error', (err) => {
        addMessage(`Socket connection error: ${err.message}`);
        setTestResult('error');
      });
      
      socket.on('pong', (data) => {
        addMessage(`Received pong response: ${JSON.stringify(data)}`);
      });
      
      socket.on('disconnect', (reason) => {
        addMessage(`Socket disconnected: ${reason}`);
        setConnected(false);
      });
      
      return () => {
        socket.disconnect();
      };
    };
    
    // Run tests
    const runTests = async () => {
      const apiWorks = await testDirectApi();
      if (apiWorks) {
        createSocket();
      } else {
        setTestResult('error');
      }
    };
    
    runTests();
  }, []);
  
  return (
    <div className="max-w-md mx-auto p-4 bg-white shadow-lg rounded-lg mt-10">
      <h2 className="text-xl font-bold mb-4">Socket Connection Tester</h2>
      
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <span className="font-medium mr-2">Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            testResult === 'success' ? 'bg-green-100 text-green-800' :
            testResult === 'error' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {testResult === 'success' ? 'Connected' :
             testResult === 'error' ? 'Failed' :
             'Testing...'}
          </span>
        </div>
        
        {connected && (
          <div className="text-sm mb-2">
            <span className="font-medium">Socket ID:</span> {socketId}
          </div>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b">
          <h3 className="font-medium">Debug Messages</h3>
        </div>
        <div className="p-4 max-h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm">No messages yet...</p>
          ) : (
            <div className="space-y-1 text-xs font-mono">
              {messages.map((message, index) => (
                <div key={index} className="whitespace-pre-wrap">{message}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        This component tests direct socket connection. Check the debug messages above
        to diagnose connection issues.
      </div>
    </div>
  );
}