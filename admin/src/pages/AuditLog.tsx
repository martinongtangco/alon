import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { AuditEntry, Paginated } from '../lib/types';
import { Shield } from 'lucide-react';

const ACTION_TYPES = [
  'All',
  'USER_SUSPEND', 'USER_REINSTATE', 'USER_BAN', 'USER_RATE_LIMIT',
  'BUSINESS_APPROVE', 'BUSINESS_REJECT', 'BUSINESS_SUSPEND', 'BUSINESS_REINSTATE',
  'PROMO_PAUSE', 'PROMO_KILL',
  'FLAG_DISMISS', 'FLAG_ESCALATE', 'FLAG_RESOLVE',
  'EVENT_APPROVE', 'EVENT_REJECT', 'EVENT_FEATURE',
  'CONFIG_UPDATE',
  'ADMIN_LOGIN', 'ADMIN_LOGOUT',
];

const ACTION_BADGE: Record<string, string> = {
  USER_BAN: 'text-red-400 bg-red-900/20',
  USER_SUSPEND: 'text-orange-400 bg-orange-900/20',
  BUSINESS_REJECT: 'text-red-400 bg-red-900/20',
  BUSINESS_SUSPEND: 'text-orange-400 bg-orange-900/20',
  PROMO_KILL: 'text-red-400 bg-red-900/20',
  FLAG_ESCALATE: 'text-yellow-400 bg-yellow-900/20',
  FLAG_RESOLVE: 'text-green-400 bg-green-900/20',
  CONFIG_UPDATE: 'text-purple-400 bg-purple-900/20',
  ADMIN_LOGIN: 'text-blue-400 bg-blue-900/20',
  ADMIN_LOGOUT: 'text-gray-400 bg-gray-800',
};

const PAGE_SIZE = 50;

export const AuditLog = () => {
  const [page, setPage] = useState(1);
  const [actionType, setActionType] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Paginated<AuditEntry>>({
    queryKey: ['audit', page, actionType],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: PAGE_SIZE.toString() });
      if (actionType !== 'All') params.append('action_type', actionType);
      return apiFetch(`/audit?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const totalPages = data?.meta ? Math.ceil(data.meta.total / PAGE_SIZE) || 1 : 1;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="mb-8 flex items-center space-x-3">
        <Shield className="w-6 h-6 text-purple-400 shrink-0" />
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Audit Log</h2>
          <p className="text-gray-400 text-sm mt-1">Immutable record of all admin actions — Super Admin only</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <select
          value={actionType}
          onChange={(e) => { setActionType(e.target.value); setPage(1); }}
          aria-label="Filter by action type"
          className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {data?.meta && (
          <span className="ml-auto text-xs text-gray-600 font-mono">{data.meta.total} entries</span>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="p-4 font-medium">Timestamp</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Action</th>
              <th className="p-4 font-medium">Subject ID</th>
              <th className="p-4 font-medium">IP</th>
              <th className="p-4 font-medium w-16 text-right">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-sm">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading audit log...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="p-8 text-center text-red-400">Failed to load audit log</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No audit entries found</td></tr>
            ) : (
              data?.data.map((entry) => (
                <Fragment key={entry.id}>
                  <tr className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-mono">{entry.admin_role}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium font-mono ${ACTION_BADGE[entry.action_type] || 'text-gray-400 bg-gray-800'}`}>
                        {entry.action_type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600 truncate max-w-xs">
                      {entry.subject_id || '—'}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600">{entry.ip_address || '—'}</td>
                    <td className="p-4 text-right">
                      {(!!entry.before_state || !!entry.after_state) && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        >
                          {expandedId === entry.id ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="bg-gray-950/60">
                      <td colSpan={6} className="px-4 pb-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          {!!entry.before_state && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Before</p>
                              <pre className="text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-auto max-h-40">
                                {JSON.stringify(entry.before_state, null, 2)}
                              </pre>
                            </div>
                          )}
                          {!!entry.after_state && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-medium">After</p>
                              <pre className="text-xs text-green-400/80 bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-auto max-h-40">
                                {JSON.stringify(entry.after_state, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>

        {data?.meta && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <span>
              Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
            </span>
            <div className="flex space-x-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Previous</button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
