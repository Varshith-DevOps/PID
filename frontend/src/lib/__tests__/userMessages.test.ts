import { describe, it, expect } from 'vitest';
import { getActionSuccessMessage, getActionErrorMessage, normalizeManualMessage } from '@/lib/userMessages';

describe('getActionSuccessMessage', () => {
  it('returns null for read methods (only mutations get success toasts)', () => {
    expect(getActionSuccessMessage('GET', '/api/employees')).toBeNull();
  });

  it('maps known mutation endpoints to friendly messages', () => {
    expect(getActionSuccessMessage('POST', '/api/auth/login')).toMatch(/Login successful/);
    expect(getActionSuccessMessage('POST', '/api/payroll/run')).toMatch(/Payroll run completed/);
    expect(getActionSuccessMessage('DELETE', '/api/employees/123')).toMatch(/removed from active use/);
  });

  it('stays silent for background endpoints', () => {
    expect(getActionSuccessMessage('POST', '/api/auth/refresh')).toBeNull();
    expect(getActionSuccessMessage('POST', '/api/auth/logout')).toBeNull();
  });

  it('falls back to a generic confirmation for unmapped mutations', () => {
    expect(getActionSuccessMessage('POST', '/api/unknown/thing')).toBe('Action completed successfully.');
  });
});

describe('getActionErrorMessage', () => {
  it('prefers a module-specific rule', () => {
    expect(getActionErrorMessage('POST', '/api/leave', { status: 400 })).toMatch(/Leave action failed/);
  });

  it('falls back to a status-code message when no rule matches', () => {
    expect(getActionErrorMessage('GET', '/api/widgets/5', { status: 404 })).toMatch(/was not found/);
    expect(getActionErrorMessage('PUT', '/api/widgets/5', { status: 403 })).toMatch(/do not have permission/);
  });

  it('falls back to the server message, then a generic message', () => {
    expect(getActionErrorMessage('GET', '/api/zzz', { status: 599, data: { message: 'boom' } })).toBe('boom');
    expect(getActionErrorMessage('GET', '/api/zzz', {})).toMatch(/Action failed/);
  });
});

describe('normalizeManualMessage', () => {
  it('classifies error-like text as error and the rest as success', () => {
    expect(normalizeManualMessage('Update failed').type).toBe('error');
    expect(normalizeManualMessage('Access denied').type).toBe('error');
    expect(normalizeManualMessage('Profile saved').type).toBe('success');
    expect(normalizeManualMessage(undefined)).toEqual({ message: 'Action completed.', type: 'success' });
  });

  it('classifies imperative validation messages as errors (not green success)', () => {
    expect(normalizeManualMessage('Please correct the highlighted fields.').type).toBe('error');
    expect(normalizeManualMessage('End date must be on or after the start date.').type).toBe('error');
    expect(normalizeManualMessage('Resolve blocking payroll checks before running payroll.').type).toBe('error');
    expect(normalizeManualMessage('Complete all manual payroll process checks before running payroll.').type).toBe('error');
    expect(normalizeManualMessage('Select a customer to assign.').type).toBe('error');
    expect(normalizeManualMessage('CSV file is empty or only contains headers').type).toBe('error');
  });

  it('keeps genuine confirmations (incl. successful rejections) as success', () => {
    expect(normalizeManualMessage('Leave rejected').type).toBe('success');
    expect(normalizeManualMessage('Payroll processed successfully').type).toBe('success');
    expect(normalizeManualMessage('Salary structure saved').type).toBe('success');
  });
});
