import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  getCurrentSession,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '../lib/api';
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  setStoredSessionToken,
} from '../lib/user-session';
import type {
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthSessionResponse,
  AuthUser,
} from '../types/api';

interface UserSessionContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string;
  refreshSession: () => Promise<void>;
  registerUser: (payload: AuthRegisterRequest) => Promise<void>;
  loginUser: (payload: AuthLoginRequest) => Promise<void>;
  logoutUser: () => Promise<void>;
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

export function UserSessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function applySessionResponse(session: AuthSessionResponse) {
    setStoredSessionToken(session.token);
    setUser(session.user);
    setError('');
  }

  async function refreshSession() {
    const sessionToken = getStoredSessionToken();
    if (!sessionToken) {
      setUser(null);
      setError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextUser = await getCurrentSession();
      setUser(nextUser);
      setError('');
    } catch (sessionError) {
      clearStoredSessionToken();
      setUser(null);
      if (sessionError instanceof Error) {
        setError(sessionError.message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  async function registerUser(payload: AuthRegisterRequest) {
    setIsLoading(true);
    try {
      const session = await registerAccount(payload);
      await applySessionResponse(session);
    } finally {
      setIsLoading(false);
    }
  }

  async function loginUser(payload: AuthLoginRequest) {
    setIsLoading(true);
    try {
      const session = await loginAccount(payload);
      await applySessionResponse(session);
    } finally {
      setIsLoading(false);
    }
  }

  async function logoutUser() {
    try {
      await logoutAccount();
    } catch {
      // Ignore logout network failures and clear the local session anyway.
    } finally {
      clearStoredSessionToken();
      setUser(null);
      setError('');
    }
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      refreshSession,
      registerUser,
      loginUser,
      logoutUser,
    }),
    [error, isLoading, user],
  );

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error('useUserSession must be used within UserSessionProvider');
  }
  return context;
}
