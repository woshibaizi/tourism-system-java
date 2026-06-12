import { useState, useCallback, useEffect, useRef } from 'react';

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      const loggedIn = localStorage.getItem('isLoggedIn');
      if (loggedIn === 'true' && saved) return JSON.parse(saved);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('token');
    }
    return null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true' && Boolean(localStorage.getItem('user'));
  });

  const [loading, setLoading] = useState(true);
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const tryAutoLogin = useCallback(() => {
    if (autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const loggedInFlag = localStorage.getItem('isLoggedIn');

    if (token && savedUser && loggedInFlag === 'true') {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setIsLoggedIn(true);
        return true;
      } catch {
        // invalid stored data
      }
    }
    return false;
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData?.token) {
      localStorage.setItem('token', userData.token);
    }
    localStorage.setItem('isLoggedIn', 'true');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
  }, []);

  return { user, isLoggedIn, loading, login, logout, tryAutoLogin };
}
