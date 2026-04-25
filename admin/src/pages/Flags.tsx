import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { ShieldAlert, AlertTriangle, Eye, ArrowUpCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Flags = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('Open');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [viewFlag, setViewFlag] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['flags', page, statusFilter, severityFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (severityFilter !== 'All') params.append('severity', severityFilter);
      
      return apiFetch(`/flags?${params.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/flags/${id}/dismiss`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flags'] })
  });

  const reviewMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/flags/${id}/in-review`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flags'] })
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/flags/${id}/escalate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flags'] })
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Flags & Reports</h2>
          <p className="text-gray-400 text-sm mt-1">Moderation queue for user reports and auto-flags</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex space-x-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm">
        <select 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Review">In Review</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select 
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Severities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Loading flags...</div>
        ) : data?.data?.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">No flags matching criteria</div>
        ) : (
          data?.data.map((flag: any) => (
            <div key={flag.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                  flag.severity === 'High' ? 'bg-red-900/40 text-red-400 border border-red-800/50' :
                  flag.severity === 'Medium' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50' :
                  'bg-blue-900/40 text-blue-400 border border-blue-800/50'
                }`}>
                  {flag.severity} Severity
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(flag.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <h3 className="text-white font-semibold mb-1">{flag.type}</h3>
              <p className="text-xs text-gray-400 mb-4 break-words">Target: {flag.subject_type} <br/><span className="font-mono text-gray-600">{flag.subject_id}</span></p>
              
              <div className="flex-1 text-sm text-gray-300 mb-4 bg-gray-950 p-3 rounded-lg border border-gray-800">
                {flag.summary || "No summary provided by reporter."}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-800 mt-auto">
                <span className="text-xs text-gray-500 font-semibold">{flag.report_count} Reports {flag.auto_flagged ? '(Auto)' : ''}</span>
                
                <div className="flex space-x-2">
                  <button 
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors" 
                    onClick={() => setViewFlag(flag)}
                    title="View Subject"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {flag.status === 'Open' && (
                    <button 
                      onClick={() => reviewMutation.mutate(flag.id)}
                      className="p-2 bg-blue-900/30 hover:bg-blue-900/60 text-blue-400 border border-blue-800/50 rounded-lg transition-colors" 
                      title="Mark In Review"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}

                  {flag.status !== 'Resolved' && (
                    <button 
                      onClick={() => dismissMutation.mutate(flag.id)}
                      className="p-2 bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded-lg transition-colors" 
                      title="Dismiss Flag"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {flag.severity !== 'High' && flag.status !== 'Resolved' && (
                    <button 
                      onClick={() => escalateMutation.mutate(flag.id)}
                      className="p-2 bg-gray-800 hover:bg-yellow-900/50 text-gray-400 hover:text-yellow-400 rounded-lg transition-colors" 
                      title="Escalate to High"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.meta && data.meta.total > 0 && (
        <div className="p-4 flex items-center justify-between text-sm text-gray-400">
          <div>
            Showing <span className="text-white">{(page - 1) * 15 + 1}</span> to <span className="text-white">{Math.min(page * 15, data.meta.total)}</span> of <span className="text-white">{data.meta.total}</span> flags
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={page * 15 >= data.meta.total}
              className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Flag Details Panel */}
      {viewFlag && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-gray-900 border-l border-gray-800 w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950">
              <h2 className="text-xl font-bold text-white flex items-center"><ShieldAlert className={`w-5 h-5 mr-3 ${viewFlag.severity === 'High' ? 'text-red-500' : 'text-blue-500'}`} /> Flag Details</h2>
              <button onClick={() => setViewFlag(null)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Report Info</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Type</span> <span className="text-white font-medium">{viewFlag.type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Severity</span> <span className="text-white font-bold">{viewFlag.severity}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span> <span className="text-white">{viewFlag.status}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Reports Count</span> <span className="text-white">{viewFlag.report_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Auto-flagged?</span> <span className="text-white">{viewFlag.auto_flagged ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Subject Information</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Target Type</span> <span className="text-blue-400 uppercase text-sm font-bold">{viewFlag.subject_type}</span></div>
                  <div className="flex justify-between flex-col">
                    <span className="text-gray-400 mb-1">Target ID</span> 
                    <span className="text-gray-500 font-mono text-xs bg-gray-900 p-2 rounded border border-gray-800 break-all">{viewFlag.subject_id}</span>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-yellow-500">Note: To view the full user or business profile, copy the Target ID and search for it in the respective dashboard tab.</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Summary provided by reporters</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-gray-300 text-sm">
                  {viewFlag.summary || 'No summary provided.'}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-800 bg-gray-950">
              <button onClick={() => setViewFlag(null)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
