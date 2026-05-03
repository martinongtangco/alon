import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/api';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  type: string;
  message: string;
  metadata: Record<string, string>;
}

const LOG_TYPES = ['All', 'buzz_sent', 'mutual_reveal', 'promo_triggered', 'new_session', 'rate_limit_hit'];

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
};

const LEVEL_BORDER: Record<string, string> = {
  INFO: 'border-blue-700/20',
  WARN: 'border-yellow-600/40',
  ERROR: 'border-red-600/40',
};

export const SystemLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [levelFilter, setLevelFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const source = new EventSource(`/api/v1/admin/sse/logs?token=${token}`);

    source.addEventListener('logs', (e) => {
      const log = JSON.parse(e.data) as LogEntry;
      setLogs((prev) => [log, ...prev].slice(0, 200));
      setIsConnected(true);
    });

    source.addEventListener('heartbeat', () => setIsConnected(true));
    source.onerror = () => setIsConnected(false);

    return () => source.close();
  }, []);

  const filtered = logs.filter((l) => {
    if (levelFilter !== 'All' && l.level !== levelFilter) return false;
    if (typeFilter !== 'All' && l.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">System Logs</h2>
          <p className="text-gray-400 text-sm mt-1">Live anonymized event stream from the platform</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-mono text-gray-400">{isConnected ? 'CONNECTED' : 'RECONNECTING'}</span>
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex space-x-1">
          {['All', 'INFO', 'WARN', 'ERROR'].map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevelFilter(l)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                levelFilter === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by log type"
          className="bg-gray-900 border border-gray-800 text-gray-400 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
        >
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-600 font-mono">{filtered.length} entries</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto font-mono text-xs" style={{ height: 'calc(100vh - 320px)', minHeight: '300px' }}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            {isConnected ? 'Listening for events...' : 'Connecting to log stream...'}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((log) => (
              <div
                key={log.id}
                className={`flex space-x-3 p-2 rounded hover:bg-gray-800/50 transition-colors border-l-2 ${LEVEL_BORDER[log.level] || 'border-gray-700/20'}`}
              >
                <span className="text-gray-500 shrink-0 w-20">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className={`font-bold shrink-0 w-12 ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>
                  {log.level}
                </span>
                <span className="text-gray-500 shrink-0 w-32 truncate">{log.type}</span>
                <span className="text-gray-300 flex-1">{log.message}</span>
                <span className="text-gray-600 shrink-0 hidden xl:block">{JSON.stringify(log.metadata)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
