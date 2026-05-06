'use client';

import { useAuth } from '@/lib/authContext';
import { ReactNode } from 'react';

interface PermissionGuardProps {
  module: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface GuardProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ module, action, children, fallback = null }: PermissionGuardProps) {
  const { hasPermission, user } = useAuth();

  if (!user) return <>{fallback}</>;
  if (hasPermission(module, action)) return <>{children}</>;

  return <>{fallback}</>;
}

export function CanView({ module, children, fallback = null }: GuardProps) {
  return <PermissionGuard module={module} action="VIEW" children={children} fallback={fallback} />;
}

export function CanCreate({ module, children, fallback = null }: GuardProps) {
  return <PermissionGuard module={module} action="CREATE" children={children} fallback={fallback} />;
}

export function CanEdit({ module, children, fallback = null }: GuardProps) {
  return <PermissionGuard module={module} action="EDIT" children={children} fallback={fallback} />;
}

export function CanDelete({ module, children, fallback = null }: GuardProps) {
  return <PermissionGuard module={module} action="DELETE" children={children} fallback={fallback} />;
}

export function CanExport({ module, children, fallback = null }: GuardProps) {
  return <PermissionGuard module={module} action="EXPORT" children={children} fallback={fallback} />;
}