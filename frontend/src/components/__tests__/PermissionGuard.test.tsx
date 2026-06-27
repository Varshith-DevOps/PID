import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionGuard, CanDelete } from '@/components/PermissionGuard';

// Controllable mock of the auth context the guard depends on.
const state = vi.hoisted(() => ({ user: null as null | { id: string }, granted: false }));
vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({ user: state.user, hasPermission: () => state.granted }),
}));

describe('PermissionGuard', () => {
  beforeEach(() => { state.user = { id: 'u1' }; state.granted = false; });

  it('renders children when the permission is granted', () => {
    state.granted = true;
    render(<PermissionGuard module="PAYROLL" action="VIEW"><span>secret</span></PermissionGuard>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('renders the fallback when the permission is denied', () => {
    state.granted = false;
    render(
      <PermissionGuard module="PAYROLL" action="VIEW" fallback={<span>denied</span>}>
        <span>secret</span>
      </PermissionGuard>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('renders the fallback when there is no logged-in user', () => {
    state.user = null;
    state.granted = true; // even if a stray grant exists, no user => fallback
    render(
      <PermissionGuard module="PAYROLL" action="VIEW" fallback={<span>please log in</span>}>
        <span>secret</span>
      </PermissionGuard>,
    );
    expect(screen.getByText('please log in')).toBeInTheDocument();
  });

  it('CanDelete helper gates on the DELETE action', () => {
    state.granted = true;
    render(<CanDelete module="EMPLOYEES"><button>Delete</button></CanDelete>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
