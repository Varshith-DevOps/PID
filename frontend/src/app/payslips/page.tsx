'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getPayslipHistory, emailPayslip, getPayslip, emailBulkPayslips } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Select, Button, DataTable,
  EmptyState, ErrorState, ConfirmDialog, Card,
} from '@/components/ui';
import type { Column } from '@/components/ui';

interface PayslipRecord {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeId: string; department: { name: string } };
  payrollRun: { month: number; year: number };
  basicSalary: number;
  hra: number;
  grossEarnings: number;
  pf: number;
  tax: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  daysWorked: number;
}

export default function PayslipsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>('ALL');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [confirmEmailAll, setConfirmEmailAll] = useState(false);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadPayslips();
  }, [user, selectedYear, selectedMonth]);

  const loadPayslips = async () => {
    setLoading(true);
    setError(false);
    try {
      let employeeId = undefined;
      if (user?.role === 'EMPLOYEE') {
        employeeId = user.employeeId;
      }
      const data = await getPayslipHistory({
        employeeId,
        year: selectedYear,
        month: selectedMonth === 'ALL' ? undefined : selectedMonth,
      });
      setPayslips(data);
    } catch (err) { console.error(err); setError(true); }
    finally { setLoading(false); }
  };

  const handleView = async (id: string) => {
    try {
      const data = await getPayslip(id);
      setSelectedPayslip(data);
      setView('detail');
    } catch (err) { console.error(err); }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/payslip/pdf/${id}`, {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { console.error(err); }
  };

  const handleEmail = async (id: string) => {
    setSendingEmail(true);
    try {
      await emailPayslip(id);
      alert('Payslip sent to email');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadAll = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/payslip/pdf-bulk?month=${new Date().getMonth() + 1}&year=${selectedYear}`, {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslips-${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { console.error(err); }
  };

  const handleEmailAll = async () => {
    setConfirmEmailAll(false);
    setSendingEmail(true);
    try {
      await emailBulkPayslips(new Date().getMonth() + 1, selectedYear);
      alert('Bulk emails sent');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to send');
    } finally {
      setSendingEmail(false);
    }
  };

  const formatMonth = (month: number) => new Date(0, month - 1).toLocaleString('en', { month: 'long' });

  const formatCurrency = (amount: number) => amount ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0';

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;

  const monthOptions = [
    { value: 'ALL', label: 'All Months' },
    ...Array.from({ length: 12 }, (_, idx) => ({ value: String(idx + 1), label: new Date(0, idx).toLocaleString('en', { month: 'long' }) })),
  ];
  const yearOptions = [2024, 2025, 2026].map((y) => ({ value: String(y), label: String(y) }));

  const columns: Column<PayslipRecord>[] = [
    { key: 'month', header: 'Month', render: (p) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatMonth(p.payrollRun.month)} {p.payrollRun.year}</span> },
    { key: 'employee', header: 'Employee', render: (p) => <>{p.employee?.firstName} {p.employee?.lastName}</> },
    { key: 'gross', header: 'Gross', align: 'right', render: (p) => formatCurrency(p.grossEarnings) },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (p) => <span style={{ color: 'var(--danger-fg)' }}>{formatCurrency(p.totalDeductions)}</span> },
    { key: 'net', header: 'Net', align: 'right', render: (p) => <span style={{ fontWeight: 700, color: 'var(--success-fg)' }}>{formatCurrency(p.netSalary)}</span> },
    {
      key: 'actions', header: 'Actions', render: (p) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button size="sm" variant="primary" onClick={() => handleView(p.id)}>View</Button>
          <Button size="sm" variant="warning" onClick={() => handleDownload(p.id)}>PDF</Button>
          {isAdmin && (
            <Button size="sm" variant="success" disabled={sendingEmail} onClick={() => handleEmail(p.id)}>Email</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Payslips"
          subtitle="View & download salary slips"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ width: 140 }}>
                <Select value={String(selectedMonth)} onChange={(v) => setSelectedMonth(v === 'ALL' ? 'ALL' : parseInt(v))} options={monthOptions} />
              </div>
              <div style={{ width: 110 }}>
                <Select value={String(selectedYear)} onChange={(v) => setSelectedYear(parseInt(v))} options={yearOptions} />
              </div>
              {isAdmin && (
                <>
                  <Button variant="primary" size="sm" onClick={handleDownloadAll} leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}>
                    Download All
                  </Button>
                  <Button variant="success" size="sm" disabled={sendingEmail} loading={sendingEmail} onClick={() => setConfirmEmailAll(true)} leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}>
                    {sendingEmail ? 'Sending...' : 'Email All'}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {view === 'list' && (
          error ? (
            <Card><ErrorState onRetry={loadPayslips} /></Card>
          ) : (
            <DataTable
              columns={columns}
              rows={payslips}
              loading={loading}
              rowKey={(p) => p.id}
              empty={<EmptyState title="No payslips found" message="No payslips match the selected month and year." />}
            />
          )
        )}

        {view === 'detail' && selectedPayslip && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <Button variant="ghost" size="sm" onClick={() => setView('list')} leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>}>
                Back
              </Button>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatMonth(selectedPayslip.payrollRun.month)} {selectedPayslip.payrollRun.year}</h2>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{selectedPayslip.employee?.firstName} {selectedPayslip.employee?.lastName}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedPayslip.employee?.employeeId}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedPayslip.employee?.department?.name}</p>
            </div>

            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Earnings</h4>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Basic Salary</span><span>{formatCurrency(selectedPayslip.basicSalary)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>HRA</span><span>{formatCurrency(selectedPayslip.hra)}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <span>Gross Earnings</span><span>{formatCurrency(selectedPayslip.grossEarnings)}</span>
            </div>

            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Deductions</h4>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>PF</span><span style={{ color: 'var(--danger-fg)' }}>{formatCurrency(selectedPayslip.pf)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>TDS</span><span style={{ color: 'var(--danger-fg)' }}>{formatCurrency(selectedPayslip.tax)}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <span>Total Deductions</span><span style={{ color: 'var(--danger-fg)' }}>{formatCurrency(selectedPayslip.totalDeductions)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success-fg)' }}>NET SALARY</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-fg)' }}>{formatCurrency(selectedPayslip.netSalary)}</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <Button variant="primary" fullWidth onClick={() => handleDownload(selectedPayslip.id)} leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}>
                Download PDF
              </Button>
              {isAdmin && (
                <Button variant="success" fullWidth disabled={sendingEmail} loading={sendingEmail} onClick={() => handleEmail(selectedPayslip.id)}>
                  {sendingEmail ? 'Sending...' : 'Email Payslip'}
                </Button>
              )}
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmEmailAll}
          title="Email all payslips"
          message="Send payslips to all employees via email?"
          confirmLabel="Send to all"
          loading={sendingEmail}
          onConfirm={handleEmailAll}
          onCancel={() => setConfirmEmailAll(false)}
        />
      </main>
    </div>
  );
}
