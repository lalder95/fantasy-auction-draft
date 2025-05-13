// components/shared/PlayerTable.tsx
import React from 'react';
import { SleeperPlayer } from '../../lib/sleeper';

interface PlayerTableProps {
  players: SleeperPlayer[];
  onPlayerAction?: (player: SleeperPlayer) => void;
  actionLabel?: string;
  emptyMessage?: string;
  showAddButton?: boolean;
}

export default function PlayerTable({
  players,
  onPlayerAction,
  actionLabel = 'Add',
  emptyMessage = 'No players found',
  showAddButton = true,
}: PlayerTableProps) {
  if (players.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Position
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            {showAddButton && (
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {actionLabel}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {players.map(player => (
            <tr key={player.player_id}>
              <td className="px-6 py-2 whitespace-nowrap">
                {player.full_name}
                {player.years_exp === 0 && (
                  <span className="ml-1 text-xs text-white bg-green-500 px-1 rounded">R</span>
                )}
              </td>
              <td className="px-6 py-2 whitespace-nowrap">
                {player.position}
              </td>
              <td className="px-6 py-2 whitespace-nowrap">
                {player.team || 'FA'}
              </td>
              {showAddButton && onPlayerAction && (
                <td className="px-6 py-2 whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => onPlayerAction(player)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    {actionLabel}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}