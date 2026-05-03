import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

interface PlanRow {
  plan: string;
  count: string;
  estimated_mrr: string;
}

const PLAN_PRICE: Record<string, string> = {
  Pro: '$49.99',
  Enterprise: '$199.99',
  Free: '$0.00',
};

const PLAN_COLOR: Record<string, string> = {
  Pro: 'text-blue-400',
  Enterprise: 'text-purple-400',
  Free: 'text-gray-500',
};

export const Revenue = () => {
  const { data, isLoading, error } = useQuery<PlanRow[]>({
    queryKey: ['revenue'],
    queryFn: () => apiFetch('/revenue'),
  });

  const totalMRR = data?.reduce((sum, row) => sum + parseFloat(row.estimated_mrr || '0'), 0) ?? 0;
  const paidBusinesses = data
    ?.filter((r) => r.plan !== 'Free')
    .reduce((sum, row) => sum + parseInt(row.count || '0', 10), 0) ?? 0;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) return <div className="text-gray-400 p-8">Loading revenue data...</div>;
  if (error) return <div className="text-red-400 p-8">Failed to load revenue data.</div>;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-wide">Revenue</h2>
        <p className="text-gray-400 text-sm mt-1">Estimated MRR from active business subscriptions</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm font-medium">Estimated MRR</p>
          <p className="text-3xl font-bold text-white mt-2 font-mono">${fmt(totalMRR)}</p>
          <p className="text-gray-600 text-xs mt-1">Active paid businesses only</p>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm font-medium">Paying Businesses</p>
          <p className="text-3xl font-bold text-white mt-2 font-mono">{paidBusinesses}</p>
          <p className="text-gray-600 text-xs mt-1">Pro + Enterprise tiers</p>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400 text-sm font-medium">Estimated ARR</p>
          <p className="text-3xl font-bold text-white mt-2 font-mono">${fmt(totalMRR * 12)}</p>
          <p className="text-gray-600 text-xs mt-1">MRR × 12</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-950/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
              <th className="p-4 font-medium">Plan</th>
              <th className="p-4 font-medium">Active Businesses</th>
              <th className="p-4 font-medium">Monthly Price / Seat</th>
              <th className="p-4 font-medium text-right">Estimated MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50 text-sm">
            {data?.map((row) => (
              <tr key={row.plan} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <span className={`font-semibold ${PLAN_COLOR[row.plan] || 'text-gray-400'}`}>{row.plan}</span>
                </td>
                <td className="p-4 text-gray-300 font-mono">{row.count}</td>
                <td className="p-4 text-gray-400 font-mono">{PLAN_PRICE[row.plan] ?? '—'}</td>
                <td className="p-4 text-right font-mono text-white">
                  ${fmt(parseFloat(row.estimated_mrr))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-950/50 border-t border-gray-800">
              <td colSpan={3} className="p-4 text-right text-gray-400 text-sm font-medium">
                Total Estimated MRR
              </td>
              <td className="p-4 text-right font-mono font-bold text-white text-lg">
                ${fmt(totalMRR)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-gray-600 text-xs">
        Revenue estimates are based on plan tier pricing. Actual revenue is tracked via your payment processor.
      </p>
    </div>
  );
};
