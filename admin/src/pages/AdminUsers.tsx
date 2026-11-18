import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, ShieldCheck, AlertTriangle, Copy, Check } from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OPS' | 'FINANCE';
  status: 'Active' | 'Inactive';
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
};

const roleBadge = (role: AdminUser['role']) => {
  const styles: Record<AdminUser['role'], string> = {
    SUPER_ADMIN: 'bg-purple-900/40 text-purple-300 border-purple-800/40',
    OPS: 'bg-blue-900/40 text-blue-300 border-blue-800/40',
    FINANCE: 'bg-green-900/40 text-green-300 border-green-800/40',
  };
  return <span className={`px-2 py-0.5 rounded text-xs border ${styles[role]}`}>{role}</span>;
};

export const AdminUsers = () => {
  const { role: currentRole } = useAuth();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<AdminUser['role']>('OPS');
  const [createdCreds, setCreatedCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery<{ data: AdminUser[] }>({
    queryKey: ['admins'],
    queryFn: () => apiFetch('/admins'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      apiFetch('/admins', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setCreatedCreds({ email: res.data.email, tempPassword: res.tempPassword });
      setShowCreate(false);
      setFormEmail('');
      setFormRole('OPS');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) =>
      apiFetch(`/admins/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setConfirmDeactivate(null);
    },
  });

  const copyPassword = () => {
    if (createdCreds) {
      navigator.clipboard.writeText(createdCreds.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (currentRole !== 'SUPER_ADMIN') {
    return <div className="text-gray-500 p-8">Access restricted to Super Admins.</div>;
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Admin Accounts</h2>
          <p className="text-gray-400 text-sm mt-1">Manage who has access to this dashboard</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Admin</span>
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">2FA</th>
              <th className="p-4 font-medium">Last Login</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-sm">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.data?.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="p-4 text-gray-200">{admin.email}</td>
                <td className="p-4">{roleBadge(admin.role)}</td>
                <td className="p-4">
                  <span className={`flex items-center w-fit px-2 py-0.5 rounded text-xs border ${
                    admin.status === 'Active'
                      ? 'bg-green-900/30 text-green-400 border-green-800/30'
                      : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {admin.status === 'Active' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />}
                    {admin.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`text-xs ${admin.totp_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                    {admin.totp_enabled ? 'Enabled' : 'Off'}
                  </span>
                </td>
                <td className="p-4 text-gray-400 text-xs">
                  {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : 'Never'}
                </td>
                <td className="p-4 text-gray-400 text-xs">{new Date(admin.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  {admin.status === 'Active' ? (
                    <button
                      onClick={() => setConfirmDeactivate(admin)}
                      className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-800/50 transition-colors"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleMutation.mutate({ id: admin.id, action: 'activate' })}
                      className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-green-900/40 text-gray-400 hover:text-green-400 border border-gray-700 hover:border-green-800/50 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-900/30 text-blue-400"><ShieldCheck className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-white">Add Admin Account</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as AdminUser['role'])}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="OPS">OPS</option>
                  <option value="FINANCE">FINANCE</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">A temporary password will be generated. Share it securely — it won't be shown again.</p>
            </div>

            {createMutation.isError && (
              <p className="mt-3 text-xs text-red-400">{(createMutation.error as any)?.message || 'Failed to create admin'}</p>
            )}

            <div className="flex space-x-3 justify-end mt-6">
              <button
                onClick={() => { setShowCreate(false); setFormEmail(''); setFormRole('OPS'); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ email: formEmail, role: formRole })}
                disabled={!formEmail || createMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp Password Modal */}
      {createdCreds && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-green-900/30 text-green-400"><ShieldCheck className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-white">Admin Created</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Share these credentials securely. The temporary password <span className="text-white font-semibold">will not be shown again</span>.
            </p>
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-200">{createdCreds.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Temp Password</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-yellow-300">{createdCreds.tempPassword}</span>
                  <button onClick={copyPassword} className="text-gray-500 hover:text-white transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setCreatedCreds(null)}
              className="mt-6 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation */}
      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-yellow-900/30 text-yellow-500"><AlertTriangle className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-white">Deactivate Admin</h3>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Deactivate <span className="text-white font-semibold">{confirmDeactivate.email}</span>? They'll be locked out immediately but their account can be reactivated.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => toggleMutation.mutate({ id: confirmDeactivate.id, action: 'deactivate' })}
                disabled={toggleMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
              >
                {toggleMutation.isPending ? 'Deactivating...' : 'Yes, deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
