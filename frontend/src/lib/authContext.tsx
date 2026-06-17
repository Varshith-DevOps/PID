'use client';

/**
 * @fileoverview React Context for Authentication & Permissions.
 * Manages user state, login/logout operations, and role-based / permission checks.
 * Integrates with cookies and localstorage to persist authentication tokens.
 * @module lib/authContext
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfile } from './api';

interface Permission {
  module: string;
  action: string;
  isGranted: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  employeeId?: string;
  permissions?: Permission[];
  subscriptionFeatures?: Record<string, boolean> | null;
  companyName?: string | null;
  companyLogo?: string | null;
  companyKycStatus?: string | null;
  companyCin?: string | null;
  hasUsedFreeTrial?: boolean;
  freeTrialExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  login: (token: string, user: User, permissions?: Permission[]) => void;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSuperAdmin = (role: string) => role === 'SUPER_ADMIN';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getProfile()
        .then((data) => {
          setUser(data);
          setPermissions(data.permissions || []);
        })
        .catch(() => {
          localStorage.removeItem('token');
          document.cookie = 'token=; path=/; max-age=0';
          setUser(null);
          setPermissions([]);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token: string, userData: User, userPermissions?: Permission[]) => {
    localStorage.setItem('token', token);
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
    setUser(userData);
    setPermissions(userPermissions || []);
  };

  const logout = () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    setUser(null);
    setPermissions([]);
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin(user.role)) return true;
    return permissions.some((p) => p.module === module && p.action === action && p.isGranted);
  };

  const canEdit = (module: string): boolean => hasPermission(module, 'EDIT');
  const canDelete = (module: string): boolean => hasPermission(module, 'DELETE');

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasPermission, canEdit, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
