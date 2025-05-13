// components/setup/ManagerConfig.tsx
import React, { useState } from 'react';
import { Manager } from '../../lib/auction';

interface ManagerConfigProps {
  initialManagers: Manager[];
  onManagersConfigured: (managers: Manager[]) => void;
}

export default function ManagerConfig({
  initialManagers,
  onManagersConfigured,
}: ManagerConfigProps) {
  const [managers, setManagers] = useState<Manager[]>(initialManagers);
  
  const handleAddManager = () => {
    const newManager: Manager = {
      id: `manual-${Date.now()}`,
      name: `Manager ${managers.length + 1}`,
      rosterId: -1,
      budget: 200,
      initialBudget: 200,
      wonPlayers: [],
      nominationOrder: managers.length + 1,
    };
    
    setManagers([...managers, newManager]);
  };
  
  const handleRemoveManager = (index: number) => {
    const updatedManagers = [...managers];
    updatedManagers.splice(index, 1);
    
    // Update nomination orders
    const reorderedManagers = updatedManagers.map((manager, idx) => ({
      ...manager,
      nominationOrder: idx + 1,
    }));
    
    setManagers(reorderedManagers);
  };
  
  const handleManagerNameChange = (index: number, name: string) => {
    const updatedManagers = [...managers];
    updatedManagers[index] = {
      ...updatedManagers[index],
      name,
    };
    setManagers(updatedManagers);
  };
  
  const handleRandomizeOrder = () => {
    const shuffledManagers = [...managers];
    for (let i = shuffledManagers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledManagers[i], shuffledManagers[j]] = [shuffledManagers[j], shuffledManagers[i]];
    }
    
    const reorderedManagers = shuffledManagers.map((manager, idx) => ({
      ...manager,
      nominationOrder: idx + 1,
    }));
    
    setManagers(reorderedManagers);
  };
  
  const handleOrderChange = (index: number, newOrder: number) => {
    if (newOrder < 1 || newOrder > managers.length) return;
    
    const updatedManagers = [...managers];
    
    // Find the manager currently at the new order position
    const swapIndex = updatedManagers.findIndex(m => m.nominationOrder === newOrder);
    
    // Swap nomination orders
    updatedManagers[swapIndex].nominationOrder = updatedManagers[index].nominationOrder;
    updatedManagers[index].nominationOrder = newOrder;
    
    // Sort by nomination order
    updatedManagers.sort((a, b) => a.nominationOrder - b.nominationOrder);
    
    setManagers(updatedManagers);
  };
  
  const handleSubmit = () => {
    onManagersConfigured(managers);
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Configure Managers</h2>
      
      <div className="mb-4 flex justify-between">
        <button
          type="button"
          onClick={handleAddManager}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Manager
        </button>
        
        <button
          type="button"
          onClick={handleRandomizeOrder}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Randomize Order
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Manager
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {managers
              .sort((a, b) => a.nominationOrder - b.nominationOrder)
              .map((manager, index) => (
                <tr key={manager.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleOrderChange(index, manager.nominationOrder - 1)}
                        disabled={manager.nominationOrder === 1}
                        className="mr-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      {manager.nominationOrder}
                      <button
                        type="button"
                        onClick={() => handleOrderChange(index, manager.nominationOrder + 1)}
                        disabled={manager.nominationOrder === managers.length}
                        className="ml-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="text"
                      value={manager.name}
                      onChange={(e) => handleManagerNameChange(index, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => handleRemoveManager(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
