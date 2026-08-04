'use client';

/**
 * @fileoverview React Context for Authentication & Permissions.
 * Manages user state, login/logout operations, and role-based / permission checks.
 * Uses backend-issued HttpOnly cookies for session persistence.
 * @module lib/authContext
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { clearApiCache, getProfile, logout as apiLogout } from './api';

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
  mustChangePassword?: boolean;
  mustSetupMfa?: boolean;
  mfaEnabled?: boolean;
  permissions?: Permission[];
  subscriptionFeatures?: Record<string, boolean> | null;
  companyName?: string | null;
  companyLogo?: string | null;
  companyKycStatus?: string | null;
  companyKycRemarks?: string | null;
  companyCin?: string | null;
  companySubdomain?: string | null;
  hasUsedFreeTrial?: boolean;
  freeTrialExpiresAt?: string | null;
  billingStatus?: string | null;
  graceEndsAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  login: (token: string | undefined, user: User, permissions?: Permission[]) => void;
  logout: () => void;
  markPasswordChanged: () => void;
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
    getProfile()
      .then((data) => {
        setUser(data);
        setPermissions(data.permissions || []);
      })
      .catch(() => {
        setUser(null);
        setPermissions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((_token: string | undefined, userData: User, userPermissions?: Permission[]) => {
    clearApiCache();
    setUser(userData);
    setPermissions(userPermissions || []);
  }, []);

  const logout = useCallback(async () => {
    // Clear auth cookies BEFORE the server call so the revocation request
    // isn't blocked by a stale CSRF check, and AFTER so any server-set
    // clear-cookie headers are supplemented on the client side.
    const clearCookies = () => {
      if (typeof document === 'undefined') return;
      const names = ['token', 'csrfToken', 'refreshToken'];
      const paths = ['/', '/api/auth', '/api'];
      for (const name of names) {
        for (const path of paths) {
          document.cookie = `${name}=; path=${path}; max-age=0`;
          document.cookie = `${name}=; path=${path}; max-age=0; domain=${window.location.hostname}`;
        }
      }
    };
    clearCookies();
    // Revoke server-side (bumps tokenVersion).
    await apiLogout();
    clearCookies();
    clearApiCache();
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    setUser(null);
    setPermissions([]);
  }, []);

  const markPasswordChanged = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  const hasPermission = useCallback((module: string, action: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin(user.role)) return true;
    return permissions.some((p) => p.module === module && p.action === action && p.isGranted);
  }, [permissions, user]);

  const canEdit = useCallback((module: string): boolean => hasPermission(module, 'EDIT'), [hasPermission]);
  const canDelete = useCallback((module: string): boolean => hasPermission(module, 'DELETE'), [hasPermission]);

  const value = useMemo(
    () => ({ user, permissions, loading, login, logout, markPasswordChanged, hasPermission, canEdit, canDelete }),
    [user, permissions, loading, login, logout, markPasswordChanged, hasPermission, canEdit, canDelete]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
