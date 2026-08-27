import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('civicflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch (_e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('civicflow_token');
      if (token) {
        try {
          const data = await authService.getMe();
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('civicflow_user', JSON.stringify(data.user));
          }
        } catch (error) {
          if (error.message?.includes('401') || error.message?.includes('403')) {
            authService.logout();
            setUser(null);
          }
        }
      }
    };
    initAuth();
  }, []);

  const login = async (email) => {
    const data = await authService.login(email);
    if (data?.user) {
      setUser(data.user);
      localStorage.setItem('civicflow_user', JSON.stringify(data.user));
    }
    return data;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    if (data?.user) {
      setUser(data.user);
      localStorage.setItem('civicflow_user', JSON.stringify(data.user));
    }
    return data;
  };

  const updateProfile = async (profileData) => {
    const data = await authService.updateProfile(profileData);
    if (data?.user) {
      setUser(data.user);
      localStorage.setItem('civicflow_user', JSON.stringify(data.user));
    }
    return data;
  };

  const logout = () => {
    authService.logout();
    localStorage.removeItem('civicflow_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
