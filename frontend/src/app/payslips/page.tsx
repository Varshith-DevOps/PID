'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getPayslipHistory, downloadPayslipPDF, emailPayslip, getPayslip, downloadBulkPayslips, emailBulkPayslips, getEmployees } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

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
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadPayslips();
  }, [user, selectedYear]);

  const loadPayslips = async () => {
    setLoading(true);
    try {
      let employeeId = undefined;
      if (user?.role === 'EMPLOYEE') {
        employeeId = user.employeeId;
      }
      const data = await getPayslipHistory({ employeeId, year: selectedYear });
      setPayslips(data);
    } catch (err) { console.error(err); }
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payslip/pdf/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payslip/pdf-bulk?month=${new Date().getMonth() + 1}&year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
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
    if (!confirm('Send payslips to all employees via email?')) return;
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

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div><h1 className="page-title">Payslips</h1><p className="page-subtitle">View & download salary slips</p></div>
          </div>
          <div className="page-header-actions">
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="select-field" style={{ width: '120px' }}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
              <>
                <button onClick={handleDownloadAll} className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download All
                </button>
                <button onClick={handleEmailAll} disabled={sendingEmail} className="btn btn-success btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {sendingEmail ? 'Sending...' : 'Email All'}
                </button>
              </>
            )}
          </div>
        </div>

        {view === 'list' && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Month</th><th>Employee</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                  payslips.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatMonth(p.payrollRun.month)} {p.payrollRun.year}</td>
                      <td>{p.employee?.firstName} {p.employee?.lastName}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.grossEarnings)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(p.totalDeductions)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.netSalary)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleView(p.id)} className="btn btn-primary btn-sm">View</button>
                          <button onClick={() => handleDownload(p.id)} className="btn btn-warning btn-sm">PDF</button>
                          {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                            <button onClick={() => handleEmail(p.id)} disabled={sendingEmail} className="btn btn-success btn-sm">Email</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {payslips.length === 0 && !loading && <tr><td colSpan={6} className="empty-state">No payslips found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {view === 'detail' && selectedPayslip && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button onClick={() => setView('list')} className="btn btn-ghost btn-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <span>Gross Earnings</span><span>{formatCurrency(selectedPayslip.grossEarnings)}</span>
            </div>

            <h4 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Deductions</h4>
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>PF</span><span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedPayslip.pf)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>TDS</span><span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedPayslip.tax)}</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <span>Total Deductions</span><span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedPayslip.totalDeductions)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)' }}>NET SALARY</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(selectedPayslip.netSalary)}</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button onClick={() => handleDownload(selectedPayslip.id)} className="btn btn-primary" style={{ flex: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </button>
              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                <button onClick={() => handleEmail(selectedPayslip.id)} disabled={sendingEmail} className="btn btn-success" style={{ flex: 1 }}>
                  {sendingEmail ? 'Sending...' : 'Email Payslip'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}