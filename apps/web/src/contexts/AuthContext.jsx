import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync initial auth state from the persisted store
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record);
    }
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.record || null);
    });
    setLoading(false);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const authData = await pb.collection('users').authWithPassword(email, password);
    setUser(authData.record);
    return authData.record;
  }, []);

  const signup = useCallback(async (email, password, extra = {}) => {
    const record = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name: extra.name || '',
      emailVisibility: true,
    });
    // Log the new user in immediately
    await pb.collection('users').authWithPassword(email, password);
    setUser(pb.authStore.record);
    return record;
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data) => {
    if (!pb.authStore.record) return null;
    const updated = await pb.collection('users').update(pb.authStore.record.id, data);
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    if (!pb.authStore.record) throw new Error('Not logged in');
    await pb.collection('users').update(pb.authStore.record.id, {
      password: newPassword,
      passwordConfirm: newPassword,
      oldPassword,
    });
    return true;
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    await pb.collection('users').requestPasswordReset(email);
    return true;
  }, []);

  const isAuthed = !!user;

  const value = {
    user,
    isAuthed,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    changePassword,
    requestPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
