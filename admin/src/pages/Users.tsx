import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Search, ShieldAlert, Ban, AlertTriangle, Eye, User as UserIcon, XCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Users = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; action: 'suspend' | 'ban' | 'reinstate'; user: any } | null>(null);
  const [viewUser, setViewUser] = useState<any>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', page, search, statusFilter, planFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (search) params.append('search', search);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (planFilter !== 'All') params.append('plan', planFilter);
      
      return apiFetch(`/users?${params.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: 'suspend' | 'ban' | 'reinstate' }) => {
      return apiFetch(`/users/${id}/${action}`, {
        method: 'POST',
        body: action === 'reinstate' ? undefined : JSON.stringify({ confirmation: true })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmModal(null);
    }
  });

  const handleAction = (user: any, action: 'suspend' | 'ban' | 'reinstate') => {
    if (action === 'reinstate') {
      actionMutation.mutate({ id: user.id, action: 'reinstate' });
    } else {
      setConfirmModal({ isOpen: true, action, user });
    }
  };

  const confirmAction = () => {
    if (confirmModal) {
      actionMutation.mutate({ id: confirmModal.user.id, action: confirmModal.action });
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">User Management</h2>
          <p className="text-gray-400 text-sm mt-1">View, filter, and moderate platform users</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex space-x-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name or token..." 
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
          <option value="Suspended">Suspended</option>
          <option value="Banned">Banned</option>
        </select>
        <select 
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="All">All Plans</option>
          <option value="Free">Free</option>
          <option value="Pro">Pro</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Token ID</th>
                <th className="p-4 font-medium">Mode</th>
                <th className="p-4 font-medium">Plan</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Platform</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading users...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="p-8 text-center text-red-400">Failed to load users</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No users found matching filters</td></tr>
              ) : (
                data?.data.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-800/50 flex items-center justify-center text-xs font-bold text-blue-400">
                          {user.display_name?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-gray-200">{user.display_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">{user.internal_token?.split('-')[0]}...</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">{user.current_mode}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${user.plan === 'Pro' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-400'}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs flex w-fit items-center ${
                        user.status === 'Active' ? 'bg-green-900/30 text-green-400 border border-green-800/30' : 
                        user.status === 'Suspended' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30' : 
                        'bg-red-900/30 text-red-400 border border-red-800/30'
                      }`}>
                        {user.status === 'Active' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></div>}
                        {user.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-xs">{user.platform}</td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" 
                        onClick={() => setViewUser(user)}
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {user.status !== 'Active' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors" 
                          onClick={() => actionMutation.mutate({ id: user.id, action: 'reinstate' })}
                          title="Reinstate User"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}

                      <button 
                        className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-30" 
                        onClick={() => handleAction(user, 'suspend')}
                        disabled={user.status !== 'Active'}
                        title="Suspend User"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>
                      {role === 'SUPER_ADMIN' && (
                        <button 
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-30" 
                          onClick={() => handleAction(user, 'ban')}
                          disabled={user.status === 'Banned'}
                          title="Ban User"
                        >
                          <Ban className="w-4 h-4" />
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
        {data && data.meta && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <div>
              Showing <span className="text-white">{(page - 1) * 15 + 1}</span> to <span className="text-white">{Math.min(page * 15, data.meta.total)}</span> of <span className="text-white">{data.meta.total}</span> users
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
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-lg ${confirmModal.action === 'ban' ? 'bg-red-900/30 text-red-500' : 'bg-yellow-900/30 text-yellow-500'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Confirm {confirmModal.action === 'ban' ? 'Permanent Ban' : 'Suspension'}
              </h3>
            </div>
            
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to {confirmModal.action} the user <span className="font-semibold text-white">{confirmModal.user.display_name}</span>? 
              {confirmModal.action === 'ban' ? ' This action is irreversible.' : ' This user will not be able to use the platform until reinstated.'}
            </p>

            <div className="flex space-x-3 justify-end">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmAction}
                disabled={actionMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                  confirmModal.action === 'ban' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {actionMutation.isPending ? 'Processing...' : `Yes, ${confirmModal.action} user`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over User Profile Panel */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-gray-900 border-l border-gray-800 w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950">
              <h2 className="text-xl font-bold text-white flex items-center"><UserIcon className="w-5 h-5 mr-3 text-blue-500" /> User Profile</h2>
              <button onClick={() => setViewUser(null)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-full transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Account Details</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex justify-between"><span className="text-gray-400">Display Name</span> <span className="text-white font-medium">{viewUser.display_name}</span></div>
                  <div className="flex justify-between flex-col">
                    <span className="text-gray-400 mb-1">Internal Target ID</span> 
                    <span className="text-gray-500 font-mono text-xs bg-gray-900 p-2 rounded border border-gray-800 break-all">{viewUser.id}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Platform</span> <span className="text-white">{viewUser.platform}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Current Mode</span> <span className="text-white">{viewUser.current_mode}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Plan Tier</span> <span className="text-purple-400 font-bold">{viewUser.plan}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span> <span className={`font-bold ${viewUser.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>{viewUser.status}</span></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Timestamps</h3>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Created</span> <span className="text-gray-300">{new Date(viewUser.created_at).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Last Active</span> <span className="text-gray-300">{new Date(viewUser.last_active_at).toLocaleString()}</span></div>
                </div>
              </div>

              {role === 'SUPER_ADMIN' && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-2">Super Admin Only PII:</p>
                  <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30 text-sm">
                     <span className="text-red-400 font-mono break-all">{viewUser.email || 'Email protected / not fetched'}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-800 bg-gray-950">
              <button onClick={() => setViewUser(null)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
