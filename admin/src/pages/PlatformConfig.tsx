import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { AlertTriangle } from 'lucide-react';

interface ConfigItem {
  key: string;
  value: any;
  tier: string;
  updated_at: string;
}

export const PlatformConfig = () => {
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['config'],
    queryFn: () => apiFetch('/config'),
  });

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch(`/config/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, confirmation: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setEditState({});
    },
  });

  if (isLoading) return <div className="text-gray-400 p-8">Loading config...</div>;
  if (error) return <div className="text-red-400 p-8">Failed to load platform config.</div>;

  const handleSave = (key: string) => {
    if (editState[key] === undefined) return;
    mutation.mutate({ key, value: editState[key] });
  };

  const isDirty = (key: string) => editState[key] !== undefined;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">Platform Config</h2>
        <p className="text-gray-400 text-sm mt-1">Super Admin only. Changes to hot-tier settings take effect immediately.</p>
      </div>

      <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-yellow-300 text-sm font-medium">
          Changes here affect live app behavior for all users. Verify before saving.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="p-4 font-medium">Key</th>
              <th className="p-4 font-medium w-16">Tier</th>
              <th className="p-4 font-medium">Value</th>
              <th className="p-4 font-medium w-24 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-sm">
            {(data as ConfigItem[])?.map((item) => (
              <tr key={item.key} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4 font-mono text-gray-300 text-xs">{item.key}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.tier === 'hot' ? 'bg-orange-900/40 text-orange-400' :
                    item.tier === 'warm' ? 'bg-yellow-900/40 text-yellow-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{item.tier}</span>
                </td>
                <td className="p-4">
                  <input
                    type="text"
                    aria-label={item.key}
                    value={editState[item.key] ?? String(item.value)}
                    onChange={(e) => setEditState({ ...editState, [item.key]: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSave(item.key)}
                    disabled={!isDirty(item.key) || mutation.isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
