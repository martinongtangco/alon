import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Business, Paginated } from '../lib/types';
import { Search, Store, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Eye, RotateCcw } from 'lucide-react';
export const Businesses = () => {
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');

  const [modal, setModal] = useState<{ isOpen: boolean; type: 'approve' | 'suspend'; business: Business } | null>(null);
  const [modalNotes, setModalNotes] = useState('');
  const [modalPlan, setModalPlan] = useState('');
  const [viewBiz, setViewBiz] = useState<Business | null>(null);

  const { data, isLoading } = useQuery<Paginated<Business>>({
    queryKey: ['businesses', page, search, statusFilter, planFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (search) params.append('search', search);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (planFilter !== 'All') params.append('plan', planFilter);
      return apiFetch(`/businesses?${params.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, endpoint, payload }: { id: string; endpoint: 'approve' | 'suspend' | 'reinstate'; payload?: Record<string, unknown> }) => apiFetch(`/businesses/${id}/${endpoint}`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setModal(null);
      setModalNotes('');
    }
  });

  const handleAction = () => {
    if (!modal) return;
    if (modal.type === 'approve') {
      actionMutation.mutate({ 
        id: modal.business.id, 
        endpoint: 'approve', 
        payload: { admin_notes: modalNotes, plan_override: modalPlan } 
      });
    } else {
      actionMutation.mutate({ 
        id: modal.business.id, 
        endpoint: 'suspend', 
        payload: { suspension_reason: modalNotes, confirmation: true } 
      });
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Partner Businesses</h2>
          <p className="text-gray-400 text-sm mt-1">Approve and manage partner accounts</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex space-x-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name, city, or email..." 
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
          <option value="Pending">Pending</option>
          <option value="Suspended">Suspended</option>
        </select>
        <select 
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Plans</option>
          <option value="Basic">Basic</option>
          <option value="Pro">Pro</option>
          <option value="Enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="p-4 font-medium">Business</th>
                <th className="p-4 font-medium">Category / City</th>
                <th className="p-4 font-medium">Plan</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Contact</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading businesses...</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No businesses found matching filters</td></tr>
              ) : (
                data?.data.map((biz) => (
                  <tr key={biz.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                          {biz.name?.substring(0, 2).toUpperCase() || 'B'}
                        </div>
                        <span className="font-medium text-gray-200">{biz.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-300">{biz.category}</div>
                      <div className="text-gray-500 text-xs">{biz.address_city}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${biz.plan === 'Enterprise' ? 'bg-indigo-900/50 text-indigo-400' : biz.plan === 'Pro' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-400'}`}>
                        {biz.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs flex w-fit items-center ${
                        biz.status === 'Active' ? 'bg-green-900/30 text-green-400 border border-green-800/30' : 
                        biz.status === 'Pending' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/30' : 
                        'bg-red-900/30 text-red-400 border border-red-800/30'
                      }`}>
                        {biz.status === 'Active' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>}
                        {biz.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      <div>{biz.contact_name}</div>
                      <div>{biz.contact_email}</div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" 
                        onClick={() => setViewBiz(biz)}
                        title="View Portal"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {biz.status === 'Pending' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors" 
                          onClick={() => { setModalPlan(biz.plan); setModal({ isOpen: true, type: 'approve', business: biz }); }}
                          title="Review & Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      
                      {biz.status === 'Active' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors" 
                          onClick={() => { setModalNotes(''); setModal({ isOpen: true, type: 'suspend', business: biz }); }}
                          title="Suspend Business"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      )}

                      {biz.status === 'Suspended' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors" 
                          onClick={() => actionMutation.mutate({ id: biz.id, endpoint: 'reinstate' })}
                          title="Reinstate Business"
                        >
                          <RotateCcw className="w-4 h-4" />
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
              Showing <span className="text-white">{(page - 1) * 15 + 1}</span> to <span className="text-white">{Math.min(page * 15, data.meta.total)}</span> of <span className="text-white">{data.meta.total}</span> businesses
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= data.meta.total} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Approve/Suspend Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-lg ${modal.type === 'suspend' ? 'bg-yellow-900/30 text-yellow-500' : 'bg-green-900/30 text-green-500'}`}>
                {modal.type === 'suspend' ? <AlertTriangle className="w-6 h-6" /> : <Store className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-white">
                {modal.type === 'suspend' ? 'Suspend Business' : 'Approve Partner Account'}
              </h3>
            </div>
            
            <p className="text-gray-400 text-sm mb-6">
              {modal.type === 'suspend' 
                ? `You are about to suspend ${modal.business.name}. This will immediately pause all active promos and reject live events.` 
                : `Review and approve the partner application for ${modal.business.name}.`}
            </p>

            <div className="space-y-4 mb-6">
              {modal.type === 'approve' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Plan Override</label>
                  <select 
                    value={modalPlan}
                    onChange={(e) => setModalPlan(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {modal.type === 'approve' ? 'Admin Notes (Internal)' : 'Reason for Suspension (Required)'}
                </label>
                <textarea 
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                  placeholder="Enter details..."
                />
              </div>
            </div>

            <div className="flex space-x-3 justify-end">
              <button 
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAction}
                disabled={actionMutation.isPending || (modal.type === 'suspend' && !modalNotes)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  modal.type === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {actionMutation.isPending ? 'Processing...' : modal.type === 'suspend' ? 'Suspend Business' : 'Approve & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Profile Panel */}
      {viewBiz && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-gray-900 border-l border-gray-800 w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950">
              <h2 className="text-xl font-bold text-white flex items-center"><Store className="w-5 h-5 mr-3 text-blue-500" /> Business Profile</h2>
              <button onClick={() => setViewBiz(null)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Core Info</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Name</span> <span className="text-white font-medium">{viewBiz.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">ID</span> <span className="text-gray-500 font-mono text-xs">{viewBiz.id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Category</span> <span className="text-white">{viewBiz.category}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">City</span> <span className="text-white">{viewBiz.address_city}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Plan Tier</span> <span className="text-purple-400 font-bold">{viewBiz.plan}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span> <span className={`font-bold ${viewBiz.status === 'Active' ? 'text-green-500' : 'text-yellow-500'}`}>{viewBiz.status}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact Details</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Point of Contact</span> <span className="text-white">{viewBiz.contact_name || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Email</span> <span className="text-blue-400">{viewBiz.contact_email || 'N/A'}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Timestamps</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Created</span> <span className="text-gray-300">{new Date(viewBiz.created_at).toLocaleString()}</span></div>
                  {viewBiz.approved_at && <div className="flex justify-between"><span className="text-gray-400">Approved</span> <span className="text-gray-300">{new Date(viewBiz.approved_at).toLocaleString()}</span></div>}
                  {viewBiz.suspended_at && <div className="flex justify-between"><span className="text-gray-400 text-red-400">Suspended</span> <span className="text-red-400">{new Date(viewBiz.suspended_at).toLocaleString()}</span></div>}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-800 bg-gray-950">
              <button onClick={() => setViewBiz(null)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
