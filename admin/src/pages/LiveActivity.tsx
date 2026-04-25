import React, { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/api';
import { Activity, Users, Radio, Zap, Server, ShieldAlert } from 'lucide-react';

interface ActivityData {
  metrics: {
    activeSessions: number;
    bleBroadcasting: number;
    buzzesPerMin: number;
    promosTriggered: number;
    apiReqPerSec: number;
  };
  modes: {
    Networking: number;
    Chill: number;
    Dating: number;
    Explorer: number;
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  type: string;
  message: string;
  metadata: any;
}

export const LiveActivity = () => {
  const [data, setData] = useState<ActivityData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const activitySource = new EventSource(`/api/v1/admin/sse/activity?token=${token}`);
    const logsSource = new EventSource(`/api/v1/admin/sse/logs?token=${token}`);

    activitySource.addEventListener('activity', (e) => {
      setData(JSON.parse(e.data));
      setIsConnected(true);
    });

    logsSource.addEventListener('logs', (e) => {
      const newLog = JSON.parse(e.data);
      setLogs((prev) => [newLog, ...prev].slice(0, 50)); // Keep last 50
    });

    activitySource.onerror = () => setIsConnected(false);
    logsSource.onerror = () => setIsConnected(false);

    return () => {
      activitySource.close();
      logsSource.close();
    };
  }, []);

  const MetricCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center justify-between">
      <div>
        <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
        <p className={`text-3xl font-mono font-bold ${colorClass}`}>{value?.toLocaleString() || '--'}</p>
      </div>
      <div className={`p-3 rounded-lg bg-gray-950 border border-gray-800 ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Live System Activity</h2>
          <p className="text-gray-400 text-sm mt-1">Real-time metrics and event stream (Refreshes every 5s)</p>
        </div>
        <div className="flex items-center space-x-2 bg-gray-900 border border-gray-800 px-4 py-2 rounded-full">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs font-semibold text-gray-300">{isConnected ? 'STREAM CONNECTED' : 'RECONNECTING...'}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <MetricCard title="Active Sessions" value={data?.metrics.activeSessions} icon={Users} colorClass="text-blue-400" />
        <MetricCard title="BLE Broadcasters" value={data?.metrics.bleBroadcasting} icon={Radio} colorClass="text-purple-400" />
        <MetricCard title="Buzzes / Min" value={data?.metrics.buzzesPerMin} icon={Zap} colorClass="text-yellow-400" />
        <MetricCard title="Promos / Min" value={data?.metrics.promosTriggered} icon={Activity} colorClass="text-green-400" />
        <MetricCard title="API Req / Sec" value={data?.metrics.apiReqPerSec} icon={Server} colorClass="text-indigo-400" />
      </div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        {/* Modes Distribution */}
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Users By Mode</h3>
          {data ? (
            <div className="space-y-5">
              {Object.entries(data.modes).map(([mode, percentage]) => (
                <div key={mode}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300 font-medium">{mode}</span>
                    <span className="text-gray-400 font-mono">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-950 rounded-full h-2.5 border border-gray-800">
                    <div 
                      className={`h-2.5 rounded-full ${mode === 'Networking' ? 'bg-blue-500' : mode === 'Chill' ? 'bg-purple-500' : mode === 'Dating' ? 'bg-pink-500' : 'bg-green-500'}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">Awaiting data...</div>
          )}
        </div>

        {/* Live Event Log */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Live Event Stream</h3>
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">Anonymized</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
            {logs.length > 0 ? (
              logs.map(log => (
                <div key={log.id} className="flex space-x-3 p-2 rounded bg-gray-950 border border-gray-800/50 hover:bg-gray-800 transition-colors">
                  <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}</span>
                  <span className={`font-bold w-12 ${log.level === 'WARN' ? 'text-yellow-500' : log.level === 'ERROR' ? 'text-red-500' : 'text-blue-500'}`}>[{log.level}]</span>
                  <span className="text-gray-300 flex-1">{log.message}</span>
                  <span className="text-gray-500">{JSON.stringify(log.metadata)}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">Listening for events...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
