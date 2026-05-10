import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Activity, Users, ShieldAlert, Store, Tag, Calendar, DollarSign, Settings, Server, LogOut, Radio, BookOpen, UserCog } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { LiveActivity } from './pages/LiveActivity';
import { Users as UsersPage } from './pages/Users';
import { Flags as FlagsPage } from './pages/Flags';
import { Businesses as BusinessesPage } from './pages/Businesses';
import { Promos as PromosPage } from './pages/Promos';
import { Events as EventsPage } from './pages/Events';
import { Revenue } from './pages/Revenue';
import { SystemLogs } from './pages/SystemLogs';
import { AuditLog } from './pages/AuditLog';
import { PlatformConfig } from './pages/PlatformConfig';
import { AdminUsers } from './pages/AdminUsers';
import { apiFetch, getAccessToken } from './lib/api';

const queryClient = new QueryClient();

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, role } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const statusSource = new EventSource(`/api/v1/admin/sse/status?token=${token}`);
    statusSource.addEventListener('status', (e) => {
      setStatus(JSON.parse(e.data));
    });

    return () => statusSource.close();
  }, []);

  const navItemClass = (path: string) => `flex items-center space-x-3 p-3 rounded-lg transition-colors ${
    location.pathname === path 
      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
  }`;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col z-20">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="text-blue-500 w-6 h-6" />
            <h1 className="text-xl font-bold tracking-wider text-white">Alon</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Admin Control</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link to="/" className={navItemClass('/')}><Activity size={18} /><span>Overview</span></Link>
          <Link to="/activity" className={navItemClass('/activity')}><Radio size={18} /><span>Live Activity</span></Link>
          <Link to="/users" className={navItemClass('/users')}><Users size={18} /><span>Users</span></Link>
          <Link to="/flags" className={navItemClass('/flags')}><ShieldAlert size={18} /><span>Flags & Reports</span></Link>
          <Link to="/businesses" className={navItemClass('/businesses')}><Store size={18} /><span>Businesses</span></Link>
          <Link to="/promos" className={navItemClass('/promos')}><Tag size={18} /><span>Promos</span></Link>
          <Link to="/events" className={navItemClass('/events')}><Calendar size={18} /><span>Events</span></Link>
          <Link to="/revenue" className={navItemClass('/revenue')}><DollarSign size={18} /><span>Revenue</span></Link>
          <Link to="/logs" className={navItemClass('/logs')}><Server size={18} /><span>System Logs</span></Link>
          
          {role === 'SUPER_ADMIN' && (
            <>
              <div className="pt-4 mt-4 border-t border-gray-800"></div>
              <Link to="/audit" className={navItemClass('/audit')}><BookOpen size={18} /><span>Audit Log</span></Link>
              <Link to="/config" className={navItemClass('/config')}><Settings size={18} /><span>Platform Config</span></Link>
              <Link to="/admin-users" className={navItemClass('/admin-users')}><UserCog size={18} /><span>Admin Accounts</span></Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={logout}
            className="flex items-center space-x-3 w-full p-3 rounded-lg text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        {/* System Status Bar */}
        <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-6 justify-between text-xs z-10 shadow-sm">
          <div className="flex space-x-6 font-mono">
            {['api', 'db', 'ble', 'promo', 'push'].map(svc => (
              <div key={svc} className="flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${!status ? 'bg-gray-600' : status[svc] === 'healthy' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                <span className="text-gray-400 uppercase">{svc}</span>
              </div>
            ))}
          </div>
          <div className="text-gray-500 font-mono">
            SYNC: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'CONNECTING...'}
          </div>
        </div>

        <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center px-6 justify-between">
          <div className="text-sm font-medium text-gray-300">
            {location.pathname === '/' ? 'Platform Overview' : location.pathname.substring(1).toUpperCase()}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold px-2 py-1 bg-blue-900/50 text-blue-300 rounded border border-blue-800/50">{role}</span>
          </div>
        </header>
        <div className="p-8 overflow-y-auto h-full relative">
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Authenticating session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const DashboardHome = () => {
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiFetch('/overview'),
    refetchInterval: 30000,
  });

  const metrics = [
    { label: 'Total Users', value: data?.total_users ?? null, prefix: '' },
    { label: 'Active Businesses', value: data?.active_businesses ?? null, prefix: '' },
    { label: 'Active Promos', value: data?.active_promos ?? null, prefix: '' },
    { label: 'Estimated MRR', value: data?.estimated_mrr != null ? parseFloat(data.estimated_mrr).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : null, prefix: '$' },
    { label: 'Open Flags', value: data?.open_flags ?? null, prefix: '' },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold mb-8 text-white tracking-wide">Platform Overview</h2>
      <div className="grid grid-cols-5 gap-5">
        {metrics.map(({ label, value, prefix }) => (
          <div key={label} className="p-6 bg-gray-900 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
            <h3 className="text-gray-400 text-sm font-medium tracking-wide">{label}</h3>
            <p className="text-3xl font-bold text-white mt-2 font-mono">
              {value != null ? `${prefix}${value}` : `${prefix}--`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><DashboardLayout><DashboardHome /></DashboardLayout></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><DashboardLayout><LiveActivity /></DashboardLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><DashboardLayout><UsersPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/flags" element={<ProtectedRoute><DashboardLayout><FlagsPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/businesses" element={<ProtectedRoute><DashboardLayout><BusinessesPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/promos" element={<ProtectedRoute><DashboardLayout><PromosPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><DashboardLayout><EventsPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute><DashboardLayout><Revenue /></DashboardLayout></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute><DashboardLayout><SystemLogs /></DashboardLayout></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute><DashboardLayout><AuditLog /></DashboardLayout></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><DashboardLayout><PlatformConfig /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin-users" element={<ProtectedRoute><DashboardLayout><AdminUsers /></DashboardLayout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

