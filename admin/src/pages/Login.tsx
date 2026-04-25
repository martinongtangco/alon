import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export const Login = () => {
  const { loginStep, loginCredentials, loginTotp } = useAuth();
  
  const [email, setEmail] = useState('admin@vibr8.me');
  const [password, setPassword] = useState('password123');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginCredentials(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginTotp(code);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 px-4 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
      
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800 z-10">
        
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mb-4 border border-blue-500/30">
            <ShieldAlert className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-white">vibr8.me</h1>
          <p className="text-sm text-gray-400 mt-1 uppercase tracking-widest font-semibold">System Access</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg text-center">
            {error}
          </div>
        )}

        {loginStep === 1 ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">EMAIL</label>
              <input 
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">PASSWORD</label>
              <input 
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required 
              />
            </div>
            <button 
              disabled={isSubmitting}
              className="w-full p-3 mt-4 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50" 
              type="submit"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 text-center">TWO-FACTOR AUTHENTICATION</label>
              <p className="text-sm text-gray-400 mb-4 text-center">Enter the code from your authenticator app.</p>
              <input 
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-lg text-white text-center tracking-widest text-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                type="text" 
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required 
              />
            </div>
            <button 
              disabled={isSubmitting || code.length !== 6}
              className="w-full p-3 mt-4 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50" 
              type="submit"
            >
              {isSubmitting ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
