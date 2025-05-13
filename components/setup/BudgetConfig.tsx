// components/setup/BudgetConfig.tsx
import React, { useState } from 'react';
import { Manager } from '../../lib/auction';

interface BudgetConfigProps {
  managers: Manager[];
  defaultBudget: number;
  onBudgetConfigured: (managers: Manager[], defaultBudget: number) => void;
}

export default function BudgetConfig({
  managers,
  defaultBudget,
  onBudgetConfigured,
}: BudgetConfigProps) {
  const [managerBudgets, setManagerBudgets] = useState<Manager[]>(managers);
  const [globalBudget, setGlobalBudget] = useState<number>(defaultBudget);
  const [useCustomBudgets, setUseCustomBudgets] = useState<boolean>(false);
  
  const handleGlobalBudgetChange = (value: number) => {
    setGlobalBudget(value);
    
    if (!useCustomBudgets) {
      // Update all managers' budgets
      const updatedManagers = managerBudgets.map(manager => ({
        ...manager,
        budget: value,
        initialBudget: value,
      }));
      
      setManagerBudgets(updatedManagers);
    }
  };
  
  const handleCustomBudgetChange = (index: number, value: number) => {
    const updatedManagers = [...managerBudgets];
    updatedManagers[index] = {
      ...updatedManagers[index],
      budget: value,
      initialBudget: value,
    };
    
    setManagerBudgets(updatedManagers);
  };
  
  const handleUseCustomBudgetsChange = (checked: boolean) => {
    setUseCustomBudgets(checked);
    
    if (!checked) {
      // Reset all managers to global budget
      const updatedManagers = managerBudgets.map(manager => ({
        ...manager,
        budget: globalBudget,
        initialBudget: globalBudget,
      }));
      
      setManagerBudgets(updatedManagers);
    }
  };
  
  const handleSubmit = () => {
    onBudgetConfigured(managerBudgets, globalBudget);
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Configure Auction Budget</h2>
      
      <div className="mb-6">
        <label htmlFor="globalBudget" className="block text-sm font-medium text-gray-700 mb-1">
          Default Budget
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            id="globalBudget"
            min="1"
            value={globalBudget}
            onChange={(e) => handleGlobalBudgetChange(parseInt(e.target.value) || 0)}
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
          />
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center">
          <input
            id="useCustomBudgets"
            type="checkbox"
            checked={useCustomBudgets}
            onChange={(e) => handleUseCustomBudgetsChange(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="useCustomBudgets" className="ml-2 block text-sm text-gray-900">
            Set custom budgets for individual managers
          </label>
        </div>
      </div>
      
      {useCustomBudgets && (
        <div className="mb-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {managerBudgets.map((manager, index) => (
                <tr key={manager.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {manager.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={manager.budget}
                        onChange={(e) => handleCustomBudgetChange(index, parseInt(e.target.value) || 0)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-32 pl-7 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
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