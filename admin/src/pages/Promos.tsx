import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Search, Tag, AlertTriangle, Eye, PauseCircle, Trash2, ShieldAlert, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Promos = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['promos', page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (search) params.append('search', search);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      return apiFetch(`/promos?${params.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/promos/${id}/pause`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promos'] })
  });

  const killMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/promos/${id}/kill`, { 
      method: 'POST', 
      body: JSON.stringify({ kill_reason: 'Admin manually killed promo', confirmation: true }) 
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promos'] })
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Platform Promos</h2>
          <p className="text-gray-400 text-sm mt-1">Oversight and moderation of all active promos</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex space-x-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by headline or business name..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Killed">Killed</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="p-4 font-medium">Promo Headline</th>
                <th className="p-4 font-medium">Business</th>
                <th className="p-4 font-medium">Radius (m)</th>
                <th className="p-4 font-medium">Redemptions</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading promos...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No promos found matching filters</td></tr>
              ) : (
                data?.data.map((promo: any) => (
                  <tr key={promo.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-200">{promo.headline}</div>
                      <div className="text-gray-500 text-xs mt-1 font-mono">{new Date(promo.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4 text-gray-300">
                      <div className="flex items-center space-x-2">
                        <Store className="w-3 h-3 text-gray-500" />
                        <span>{promo.business_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-gray-300">{promo.broadcast_radius}m</span>
                    </td>
                    <td className="p-4">
                      <span className={`font-mono ${promo.redemption_limit >= 10000 ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                        {promo.redemption_count} / {promo.redemption_limit >= 10000 ? '∞' : promo.redemption_limit}
                      </span>
                      {promo.redemption_limit >= 10000 && <AlertTriangle className="w-3 h-3 inline-block ml-2 text-red-500" title="Unlimited redemptions detected" />}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs flex w-fit items-center ${
                        promo.status === 'Active' ? 'bg-green-900/30 text-green-400 border border-green-800/30' : 
                        promo.status === 'Paused' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30' : 
                        'bg-red-900/30 text-red-400 border border-red-800/30'
                      }`}>
                        {promo.status === 'Active' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>}
                        {promo.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      <button 
                        className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-30" 
                        onClick={() => pauseMutation.mutate(promo.id)}
                        disabled={promo.status !== 'Active'}
                        title="Pause Promo"
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>

                      {role === 'SUPER_ADMIN' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-30" 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to permanently kill this promo?')) {
                              killMutation.mutate(promo.id);
                            }
                          }}
                          disabled={promo.status === 'Killed'}
                          title="Kill Promo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data && data.meta && data.meta.total > 0 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <div>
              Showing <span className="text-white">{(page - 1) * 15 + 1}</span> to <span className="text-white">{Math.min(page * 15, data.meta.total)}</span> of <span className="text-white">{data.meta.total}</span> promos
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= data.meta.total} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
