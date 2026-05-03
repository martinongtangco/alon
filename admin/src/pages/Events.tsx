import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Star, StarOff, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export const Events = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: page.toString(), limit: '15' });
      if (statusFilter !== 'All') params.append('status', statusFilter);
      return apiFetch(`/events?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/events/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejection_reason }: { id: string; rejection_reason: string }) =>
      apiFetch(`/events/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejection_reason }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); setRejectModal(null); setRejectReason(''); },
  });

  const featureMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/events/${id}/feature`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const statusColor: Record<string, string> = {
    'Scheduled': 'bg-blue-900/30 text-blue-400',
    'Live': 'bg-green-900/30 text-green-400',
    'Ended': 'bg-gray-800 text-gray-500',
    'Pending Review': 'bg-yellow-900/30 text-yellow-400',
    'Rejected': 'bg-red-900/30 text-red-400',
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">Events</h2>
        <p className="text-gray-400 text-sm mt-1">Moderate and curate platform events</p>
      </div>

      <div className="flex space-x-2">
        {['All', 'Pending Review', 'Scheduled', 'Live', 'Ended', 'Rejected'].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-600'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="p-4 font-medium">Event</th>
              <th className="p-4 font-medium">Organizer</th>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-sm">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading events...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="p-8 text-center text-red-400">Failed to load events</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No events found</td></tr>
            ) : (
              data?.data.map((event: any) => (
                <tr key={event.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      {event.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                      <span className="font-medium text-gray-200">{event.name}</span>
                      {event.is_community && <span className="px-1.5 py-0.5 bg-purple-900/40 text-purple-400 text-xs rounded">Community</span>}
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{event.business_name || event.submitter_name || '—'}</td>
                  <td className="p-4 text-gray-400 text-xs font-mono">{new Date(event.event_date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${statusColor[event.status] || 'bg-gray-800 text-gray-400'}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-1">
                    {event.status === 'Pending Review' && (
                      <>
                        <button type="button" title="Approve" onClick={() => approveMutation.mutate(event.id)} className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 rounded transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button type="button" title="Reject" onClick={() => setRejectModal({ id: event.id, name: event.name })} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {['Scheduled', 'Live'].includes(event.status) && (
                      <button
                        type="button"
                        title={event.is_featured ? 'Un-feature' : 'Feature'}
                        onClick={() => featureMutation.mutate(event.id)}
                        className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
                      >
                        {event.is_featured ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data?.meta && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between text-sm text-gray-400">
            <span>Total: <span className="text-white">{data.meta.total}</span></span>
            <div className="flex space-x-2">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Previous</button>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={page * 15 >= data.meta.total} className="px-3 py-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-red-900/30 text-red-500"><AlertTriangle className="w-5 h-5" /></div>
              <h3 className="text-lg font-bold text-white">Reject Event</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">Rejecting <span className="text-white font-medium">{rejectModal.name}</span>. This will be shown to the submitter.</p>
            <textarea
              aria-label="Rejection reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button type="button" onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors">Cancel</button>
              <button type="button" onClick={() => rejectMutation.mutate({ id: rejectModal.id, rejection_reason: rejectReason })} disabled={!rejectReason.trim() || rejectMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
