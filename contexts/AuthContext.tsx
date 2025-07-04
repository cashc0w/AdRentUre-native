import { createContext, useContext, useState, useEffect } from 'react';
import { directus, loginUser, logout, getCurrentUser } from '../lib/directus';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  location: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('Initializing auth...');
        await checkAuth();
      } catch (err) {
        console.error('Auth initialization error:', err);
      }
    };
    initAuth();
  }, []);

  const checkAuth = async () => {
    console.log('Checking auth...');
    try {
      // getCurrentUser now handles token retrieval and setting internally.
      // The onResponse interceptor in the directus client handles refreshing.
      const currentUser = await getCurrentUser();
      console.log('Auth check successful, user is logged in.');
      setUser(currentUser);
    } catch (err) {
      console.log('Auth check failed, user is not logged in.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    console.log('Attempting login...');
    try {
      setLoading(true);
      setError(null);
      
      console.log('Calling loginUser...');
      const currentUser = await loginUser(email, password);
      
      console.log('Login successful, current user:', currentUser);
      
      setUser(currentUser);
    } catch (err) {
      console.error('Login error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    console.log('Attempting logout...');
    try {
      setLoading(true);
      setError(null);
      
      console.log('Calling logout...');
      await logout();
      
      console.log('Logout successful, clearing user');
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout: logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 