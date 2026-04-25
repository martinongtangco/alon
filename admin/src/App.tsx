import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LayoutDashboard, Activity, Users, ShieldAlert, Store,
  Tag, Calendar, DollarSign, Server, Settings, ScrollText,
} from 'lucide-react';

const queryClient = new QueryClient();

const navItems = [
  { to: '/',        label: 'Overview',        icon: LayoutDashboard },
  { to: '/live',    label: 'Live Activity',   icon: Activity },
  { to: '/users',   label: 'Users',           icon: Users },
  { to: '/flags',   label: 'Flags & Reports', icon: ShieldAlert },
  { to: '/businesses', label: 'Businesses',   icon: Store },
  { to: '/promos',  label: 'Promos',          icon: Tag },
  { to: '/events',  label: 'Events',          icon: Calendar },
  { to: '/revenue', label: 'Revenue',         icon: DollarSign },
  { to: '/logs',    label: 'System Logs',     icon: Server },
  { to: '/config',  label: 'Platform Config', icon: Settings },
  { to: '/audit',   label: 'Audit Log',       icon: ScrollText },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen bg-gray-900 text-gray-100">
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-wider text-white">vibr8.me ADMIN</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center space-x-3 p-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>

    <main className="flex-1 flex flex-col min-w-0">
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            API: Healthy
          </span>
          <span className="flex items-center text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            DB: Healthy
          </span>
        </div>
        <div className="text-sm text-gray-400">admin@vibr8.me</div>
      </header>
      <div className="flex-1 p-6 overflow-y-auto">{children}</div>
    </main>
  </div>
);

const Placeholder = ({ title }: { title: string }) => (
  <div>
    <h2 className="text-2xl font-semibold mb-6 text-white">{title}</h2>
    <div className="p-8 bg-gray-800 rounded-lg border border-gray-700 text-gray-400">
      Not yet implemented.
    </div>
  </div>
);

const Overview = () => (
  <div>
    <h2 className="text-2xl font-semibold mb-6 text-white">Platform Overview</h2>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {['Total Users', 'Active Promos', 'MRR', 'Open Flags'].map(metric => (
        <div key={metric} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-sm">{metric}</p>
          <p className="text-2xl font-bold text-white mt-1">—</p>
        </div>
      ))}
    </div>
  </div>
);

const Login = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-900">
    <div className="w-full max-w-md p-8 space-y-6 bg-gray-950 rounded-xl border border-gray-800">
      <h1 className="text-2xl font-bold text-center text-white">vibr8.me System Control</h1>
      <form className="space-y-4">
        <input className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-500" placeholder="Email" type="email" />
        <input className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-500" placeholder="Password" type="password" />
        <button className="w-full p-3 font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 transition-colors" type="button">
          Sign In
        </button>
      </form>
    </div>
  </div>
);

function App() {
  const isAuthenticated = false;

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          {isAuthenticated ? (
            <>
              <Route path="/" element={<DashboardLayout><Overview /></DashboardLayout>} />
              <Route path="/live"       element={<DashboardLayout><Placeholder title="Live Activity" /></DashboardLayout>} />
              <Route path="/users"      element={<DashboardLayout><Placeholder title="Users" /></DashboardLayout>} />
              <Route path="/flags"      element={<DashboardLayout><Placeholder title="Flags & Reports" /></DashboardLayout>} />
              <Route path="/businesses" element={<DashboardLayout><Placeholder title="Businesses" /></DashboardLayout>} />
              <Route path="/promos"     element={<DashboardLayout><Placeholder title="Promos" /></DashboardLayout>} />
              <Route path="/events"     element={<DashboardLayout><Placeholder title="Events" /></DashboardLayout>} />
              <Route path="/revenue"    element={<DashboardLayout><Placeholder title="Revenue" /></DashboardLayout>} />
              <Route path="/logs"       element={<DashboardLayout><Placeholder title="System Logs" /></DashboardLayout>} />
              <Route path="/config"     element={<DashboardLayout><Placeholder title="Platform Config" /></DashboardLayout>} />
              <Route path="/audit"      element={<DashboardLayout><Placeholder title="Audit Log" /></DashboardLayout>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <Route path="*" element={<DashboardLayout><Overview /></DashboardLayout>} />
          )}
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
