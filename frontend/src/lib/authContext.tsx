'use client';

/**
 * @fileoverview React Context for Authentication & Permissions.
 * Manages user state, login/logout operations, and role-based / permission checks.
 * Uses backend-issued HttpOnly cookies for session persistence.
 * @module lib/authContext
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfile, logout as apiLogout } from './api';

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

  const login = (_token: string | undefined, userData: User, userPermissions?: Permission[]) => {
    setUser(userData);
    setPermissions(userPermissions || []);
  };

  const logout = () => {
    // Revoke server-side (bumps tokenVersion) before clearing local state.
    void apiLogout();
    document.cookie = 'csrfToken=; path=/; max-age=0';
    setUser(null);
    setPermissions([]);
  };

  const markPasswordChanged = () => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (isSuperAdmin(user.role)) return true;
    return permissions.some((p) => p.module === module && p.action === action && p.isGranted);
  };

  const canEdit = (module: string): boolean => hasPermission(module, 'EDIT');
  const canDelete = (module: string): boolean => hasPermission(module, 'DELETE');

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, markPasswordChanged, hasPermission, canEdit, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
