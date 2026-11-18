import { createContext } from 'react';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string | null;
  loginStep: 1 | 2;
  tempToken: string | null;
  loginCredentials: (email: string, password: string) => Promise<void>;
  loginTotp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
