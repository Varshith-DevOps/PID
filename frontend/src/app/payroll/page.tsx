'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getAllPayrollRuns, getPayrollReport, getPayrollPreflight, downloadPayrollExport, runPayroll, getEmployees, getSalaryStructure, setSalaryStructure, calculateEmployeeSalary, getPayrollSettings, updatePayrollSettings } from '@/lib/api';
import { CanView, CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  totalAmount: number;
  employeeCount: number;
  createdAt: string;
}

interface PayrollRecord {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeId: string; department: { name: string } };
  basicSalary: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  specialAllowance: number;
  otherAllowance: number;
  grossEarnings: number;
  pf: number;
  tax: number;
  esi?: number;
  professionalTax?: number;
  insurance: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  workDays: number;
  daysWorked: number;
  leaves: number;
  lopDays?: number;
  lopDeduction?: number;
  overtimeHours?: number;
  overtimePay?: number;
  arrears?: number;
  incentives?: number;
}

interface PayrollStage {
  key: string;
  label: string;
  required: boolean;
}

export default function PayrollPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'runs' | 'process' | 'report' | 'structure' | 'settings'>('runs');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [structure, setStructure] = useState<any>(null);
  const [form, setForm] = useState({ basicSalary: 0, hra: 0, da: 0, conveyance: 0, medical: 0, specialAllowance: 0, otherAllowance: 0, pfEnabled: true, tdsEnabled: true, esiEnabled: true, professionalTaxEnabled: true, insurance: 0, otherDeduction: 0 });
  const [processing, setProcessing] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const previousMonth = new Date();
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const [processMonth, setProcessMonth] = useState(previousMonth.getMonth() + 1);
  const [processYear, setProcessYear] = useState(previousMonth.getFullYear());
  const [preflight, setPreflight] = useState<any>(null);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [adjustments, setAdjustments] = useState<Record<string, { arrears?: number; incentives?: number; notes?: string }>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role === 'EMPLOYEE')) router.push('/');
  }, [user, authLoading]);

  useEffect(() => {
    if (user && view === 'runs') loadRuns();
    if (user && view === 'process') loadPreflight();
    if (user && view === 'structure') loadEmployees();
  }, [user, view, processMonth, processYear]);

  useEffect(() => {
    if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) loadGlobalSettings();
  }, [user]);

  const loadGlobalSettings = async () => {
    try {
      const data = await getPayrollSettings();
      setGlobalSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await getAllPayrollRuns();
      setRuns(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadPreflight = async () => {
    setLoading(true);
    try {
      const data = await getPayrollPreflight({ month: processMonth, year: processYear });
      setPreflight(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadEmployees = async () => {
    try {
      const data = await getEmployees({ limit: 100 });
      setEmployees(data.employees);
    } catch (err) { console.error(err); }
  };

  const loadReport = async (run: PayrollRun) => {
    setLoading(true);
    try {
      const data = await getPayrollReport({ month: run.month, year: run.year });
      setSelectedRun(run);
      setRecords(data.records);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRunPayroll = async () => {
    const missing = (preflight?.manualStages || []).filter((stage: PayrollStage) => stage.required && !confirmations[stage.key]);
    if (missing.length > 0) {
      alert('Complete all manual payroll process checks before running payroll.');
      return;
    }
    if (!preflight?.canRun) {
      alert('Resolve blocking payroll checks before running payroll.');
      return;
    }
    if (!confirm(`Run payroll for ${new Date(0, processMonth - 1).toLocaleString('en', { month: 'long' })} ${processYear}?`)) return;
    setProcessing(true);
    try {
      await runPayroll(processMonth, processYear, { confirmations, adjustments });
      loadRuns();
      loadPreflight();
      alert('Payroll processed successfully');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const updateAdjustment = (employeeId: string, field: 'arrears' | 'incentives' | 'notes', value: string) => {
    setAdjustments((current) => ({
      ...current,
      [employeeId]: {
        ...(current[employeeId] || {}),
        [field]: field === 'notes' ? value : Number(value) || 0,
      },
    }));
  };

  const loadStructure = async (empId: string) => {
    try {
      const data = await getSalaryStructure(empId);
      setSelectedEmployee(employees.find(e => e.id === empId));
      if (data) {
        setStructure(data);
        const calc = data.calculations || {};
        setForm({
          basicSalary: data.basicSalary,
          hra: data.hra,
          da: data.da,
          conveyance: data.conveyance || data.conveyence || 0,
          medical: data.medical,
          specialAllowance: data.specialAllowance,
          otherAllowance: data.otherAllowance,
          pfEnabled: data.pfEnabled !== false,
          tdsEnabled: data.tdsEnabled !== false,
          esiEnabled: data.esiEnabled !== false,
          professionalTaxEnabled: data.professionalTaxEnabled !== false,
          insurance: data.insurance,
          otherDeduction: data.otherDeduction,
        });
      } else {
        setStructure(null);
        setForm({ basicSalary: 0, hra: 0, da: 0, conveyance: 0, medical: 0, specialAllowance: 0, otherAllowance: 0, pfEnabled: true, tdsEnabled: true, esiEnabled: true, professionalTaxEnabled: true, insurance: 0, otherDeduction: 0 });
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveStructure = async () => {
    if (!selectedEmployee) return;
    try {
      await setSalaryStructure(selectedEmployee.id, form);
      alert('Salary structure saved');
    } catch (err) { alert('Failed to save'); }
  };

  const calculatePreview = () => {
    const basicSalary = form.basicSalary || 0;
    const da = form.da || 0;
    const grossEarnings = basicSalary + (form.hra || 0) + da + (form.conveyance || 0) + (form.medical || 0) + (form.specialAllowance || 0) + (form.otherAllowance || 0);
    
    // Indian PF: 12% of Basic + DA capped at ₹15,000 wage base (Max ₹1,800/month)
    const pfWages = basicSalary + da;
    const pf = form.pfEnabled ? Math.min(pfWages * 0.12, 1800) : 0;
    
    // ESI: 0.75% of Gross if monthly gross <= ₹21,000
    const esi = (form.esiEnabled !== false && grossEarnings <= 21000) ? (grossEarnings * 0.0075) : 0;
    
    // Professional Tax (PT): ₹200 flat if gross > ₹25,000
    const pt = (form.professionalTaxEnabled !== false && grossEarnings > 25000) ? 200 : 0;
    
    const tds = form.tdsEnabled ? calculateTDS(grossEarnings) : 0;
    const totalDeductions = pf + esi + pt + tds + (form.insurance || 0) + (form.otherDeduction || 0);
    const netSalary = grossEarnings - totalDeductions;
    
    return {
      grossEarnings,
      employeePf: pf,
      employerPf: pf,
      employeeEsi: esi,
      employerEsi: (form.esiEnabled !== false && grossEarnings <= 21000) ? (grossEarnings * 0.0325) : 0,
      professionalTax: pt,
      tds,
      totalDeductions,
      netSalary,
      taxSlab: getTaxSlab(Math.max(0, grossEarnings * 12 - 75000)),
    };
  };

  const calculateTDS = (monthlyGross: number) => {
    const annual = monthlyGross * 12;
    const standardDeduction = 75000;
    const taxable = Math.max(0, annual - standardDeduction);
    if (taxable <= 700000) return 0; // Section 87A rebate
    
    let tax = 0;
    if (taxable <= 300000) {
      tax = 0;
    } else if (taxable <= 700000) {
      tax = (taxable - 300000) * 0.05;
    } else if (taxable <= 1000000) {
      tax = 20000 + (taxable - 700000) * 0.10;
    } else if (taxable <= 1200000) {
      tax = 50000 + (taxable - 1000000) * 0.15;
    } else if (taxable <= 1500000) {
      tax = 80000 + (taxable - 1200000) * 0.20;
    } else {
      tax = 140000 + (taxable - 1500000) * 0.30;
    }
    
    // Add 4% Cess
    const totalTax = tax * 1.04;
    return totalTax / 12;
  };

  const getTaxSlab = (annualNetTaxable: number) => {
    if (annualNetTaxable <= 300000) return 'Nil';
    if (annualNetTaxable <= 700000) return '5%';
    if (annualNetTaxable <= 1000000) return '10%';
    if (annualNetTaxable <= 1200000) return '15%';
    if (annualNetTaxable <= 1500000) return '20%';
    return '30%';
  };

  const preview = structure ? calculatePreview() : null;

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  if (user.role === 'EMPLOYEE') return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div><h1 className="page-title">Payroll</h1><p className="page-subtitle">Process payroll & manage salary structures</p></div>
          </div>
          <div className="page-header-actions">
            <div className="tab-group">
              <button className={`tab-btn ${view === 'runs' ? 'active' : ''}`} onClick={() => setView('runs')}>Runs</button>
              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <button className={`tab-btn ${view === 'process' ? 'active' : ''}`} onClick={() => setView('process')}>Process</button>}
              <button className={`tab-btn ${view === 'structure' ? 'active' : ''}`} onClick={() => setView('structure')}>Salary Structure</button>
              {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <button className={`tab-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>Settings</button>}
            </div>
          </div>
        </div>

        {view === 'runs' && (
          <>
            {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <button onClick={() => setView('process')} disabled={processing} className="btn btn-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  Open Payroll Process
                </button>
              </div>
            )}

            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table className="data-table">
                <thead><tr><th>Period</th><th style={{ textAlign: 'center' }}>Employees</th><th style={{ textAlign: 'right' }}>Total Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="loading-container"><div className="loading-spinner" />Loading...</td></tr> :
                    runs.map((run) => (
                      <tr key={run.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(0, run.month - 1).toLocaleString('en', { month: 'long' })} {run.year}</td>
                        <td style={{ textAlign: 'center' }}>{run.employeeCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>₹{run.totalAmount?.toLocaleString()}</td>
                        <td><span className={`badge ${run.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{run.status}</span></td>
                        <td><button onClick={() => loadReport(run)} className="btn btn-primary btn-sm">View</button></td>
                      </tr>
                    ))}
                  {runs.length === 0 && !loading && <tr><td colSpan={5} className="empty-state">No payroll runs found</td></tr>}
                </tbody>
              </table>
            </div>

            {selectedRun && records.length > 0 && (
              <div className="glass-card mt-2" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.25rem 0' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{new Date(0, selectedRun.month - 1).toLocaleString('en', { month: 'long' })} {selectedRun.year} — {records.length} Employees</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1.25rem 0.75rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'excel' })}>Excel</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'csv' })}>CSV</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'pdf' })}>PDF</button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th style={{ textAlign: 'right' }}>Basic</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>LOP</th><th style={{ textAlign: 'right' }}>OT</th><th style={{ textAlign: 'right' }}>Arrears</th><th style={{ textAlign: 'right' }}>Incentives</th><th style={{ textAlign: 'right' }}>PF</th><th style={{ textAlign: 'right' }}>ESI</th><th style={{ textAlign: 'right' }}>PT</th><th style={{ textAlign: 'right' }}>Tax (TDS)</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={rec.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee?.firstName} {rec.employee?.lastName}</td>
                        <td style={{ textAlign: 'right' }}>₹{rec.basicSalary?.toFixed(0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>₹{rec.grossEarnings?.toFixed(0)}</td>
                        <td style={{ textAlign: 'right' }}>{rec.lopDays || rec.leaves || 0}</td>
                        <td style={{ textAlign: 'right' }}>₹{(rec.overtimePay || 0).toFixed(0)}</td>
                        <td style={{ textAlign: 'right' }}>₹{(rec.arrears || 0).toFixed(0)}</td>
                        <td style={{ textAlign: 'right' }}>₹{(rec.incentives || 0).toFixed(0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>₹{rec.pf?.toFixed(0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>₹{(rec.esi || 0).toFixed(0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>₹{(rec.professionalTax || 0).toFixed(0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>₹{rec.tax?.toFixed(0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>₹{rec.totalDeductions?.toFixed(0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>₹{rec.netSalary?.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {view === 'process' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Payroll Processing Checklist</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manual statutory and payroll input stages must be completed before payroll can run.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select className="select-field" value={processMonth} onChange={(e) => setProcessMonth(Number(e.target.value))} style={{ width: '150px' }}>
                    {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString('en', { month: 'long' })}</option>)}
                  </select>
                  <input className="input-field" type="number" value={processYear} onChange={(e) => setProcessYear(Number(e.target.value))} style={{ width: '110px' }} />
                </div>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
                <div className="stat-card"><div className="stat-card-value text-info">{preflight?.summary?.activeEmployees || 0}</div><div className="stat-card-label">Active Employees</div></div>
                <div className="stat-card"><div className="stat-card-value text-warning">{preflight?.summary?.lopDays || 0}</div><div className="stat-card-label">LOP Days</div></div>
                <div className="stat-card"><div className="stat-card-value text-success">{preflight?.summary?.approvedOvertimeHours || 0}</div><div className="stat-card-label">Approved OT Hours</div></div>
                <div className="stat-card"><div className="stat-card-value text-danger">{preflight?.summary?.pendingOvertime || 0}</div><div className="stat-card-label">Pending OT</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>System Checks</h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {(preflight?.automaticChecks || []).map((check: any) => (
                      <div key={check.key} className="glass-card" style={{ padding: '0.9rem', borderLeft: `3px solid ${check.passed ? 'var(--success)' : check.blocking ? 'var(--danger)' : 'var(--warning)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <strong>{check.label}</strong>
                          <span className={`badge ${check.passed ? 'badge-success' : check.blocking ? 'badge-danger' : 'badge-warning'}`}>{check.passed ? 'OK' : check.blocking ? 'BLOCKED' : 'REVIEW'}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{check.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Manual Process Stages</h3>
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {(preflight?.manualStages || []).map((stage: PayrollStage) => (
                      <label key={stage.key} className="glass-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!confirmations[stage.key]} onChange={(e) => setConfirmations({ ...confirmations, [stage.key]: e.target.checked })} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Variable Inputs: Arrears, Incentives, OT and LOP Review</h3>
              <div style={{ overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Attendance</th><th>LOP</th><th>OT Hours</th><th>Arrears</th><th>Incentives</th><th>Notes</th></tr></thead>
                  <tbody>
                    {(preflight?.employeeSummaries || []).map((employee: any) => (
                      <tr key={employee.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{employee.name}<div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{employee.employeeId}</div></td>
                        <td>{employee.attendanceEntries}</td>
                        <td>{employee.lopDays}</td>
                        <td>{employee.overtimeHours}</td>
                        <td><input className="input-field" type="number" value={adjustments[employee.id]?.arrears || ''} onChange={(e) => updateAdjustment(employee.id, 'arrears', e.target.value)} style={{ width: '110px' }} /></td>
                        <td><input className="input-field" type="number" value={adjustments[employee.id]?.incentives || ''} onChange={(e) => updateAdjustment(employee.id, 'incentives', e.target.value)} style={{ width: '110px' }} /></td>
                        <td><input className="input-field" value={adjustments[employee.id]?.notes || ''} onChange={(e) => updateAdjustment(employee.id, 'notes', e.target.value)} placeholder="Optional" style={{ minWidth: '160px' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={handleRunPayroll} disabled={processing || !preflight?.canRun} className="btn btn-success">
                  {processing ? 'Processing...' : 'Run Payroll'}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'structure' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Employees</h3>
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {employees.map((emp) => (
                  <div key={emp.id} onClick={() => loadStructure(emp.id)} style={{ padding: '0.75rem', cursor: 'pointer', background: selectedEmployee?.id === emp.id ? 'rgba(59,130,246,0.15)' : 'transparent', borderRadius: 'var(--radius-sm)', marginBottom: '0.25rem', transition: 'var(--transition)' }}>
                    <div style={{ fontWeight: 600, color: selectedEmployee?.id === emp.id ? 'var(--accent-blue)' : 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.firstName} {emp.lastName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{emp.employeeId}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '2rem' }}>
              {selectedEmployee ? (
                <>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Salary Structure — {selectedEmployee.firstName} {selectedEmployee.lastName}</h3>
                  <div className="form-grid">
                    <div className="form-group"><label className="form-label">Basic Salary *</label><input type="number" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">HRA</label><input type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">DA</label><input type="number" value={form.da} onChange={(e) => setForm({ ...form, da: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">Conveyance</label><input type="number" value={form.conveyance} onChange={(e) => setForm({ ...form, conveyance: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">Medical</label><input type="number" value={form.medical} onChange={(e) => setForm({ ...form, medical: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">Special Allowance</label><input type="number" value={form.specialAllowance} onChange={(e) => setForm({ ...form, specialAllowance: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="form-label">Insurance Deduction</label><input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: parseFloat(e.target.value) })} className="input-field" /></div>
                    <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.pfEnabled} onChange={(e) => setForm({ ...form, pfEnabled: e.target.checked })} /> Enable EPF (12%)</label></div>
                    <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.esiEnabled} onChange={(e) => setForm({ ...form, esiEnabled: e.target.checked })} /> Enable ESI (0.75%)</label></div>
                    <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.professionalTaxEnabled} onChange={(e) => setForm({ ...form, professionalTaxEnabled: e.target.checked })} /> Enable Professional Tax (PT)</label></div>
                    <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={form.tdsEnabled} onChange={(e) => setForm({ ...form, tdsEnabled: e.target.checked })} /> Enable TDS (New Regime)</label></div>
                  </div>

                  {preview && (
                    <div className="glass-card mt-2" style={{ padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Monthly Calculation Preview (Indian Compliance)</h4>
                      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div><span className="form-label">Gross Earnings</span><div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{preview.grossEarnings.toFixed(2)}</div></div>
                        <div><span className="form-label">Employee PF (12%)</span><div style={{ fontSize: '1rem', color: 'var(--danger)' }}>₹{preview.employeePf.toFixed(2)}</div></div>
                        <div><span className="form-label">Employee ESI (0.75%)</span><div style={{ fontSize: '1rem', color: 'var(--danger)' }}>₹{preview.employeeEsi.toFixed(2)}</div></div>
                        <div><span className="form-label">Professional Tax (PT)</span><div style={{ fontSize: '1rem', color: 'var(--danger)' }}>₹{preview.professionalTax.toFixed(2)}</div></div>
                        <div><span className="form-label">TDS ({preview.taxSlab})</span><div style={{ fontSize: '1rem', color: 'var(--danger)' }}>₹{preview.tds.toFixed(2)}</div></div>
                        <div><span className="form-label">Total Deductions</span><div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>₹{preview.totalDeductions.toFixed(2)}</div></div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="form-label">Net Salary (Take Home)</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>₹{preview.netSalary.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="form-label">Employer Share (PF + ESI)</span>
                          <div style={{ fontSize: '1rem', color: 'var(--warning)' }}>₹{(preview.employerPf + preview.employerEsi).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={handleSaveStructure} className="btn btn-primary mt-2">Save Structure</button>
                </>
              ) : (
                <div className="empty-state">Select an employee to configure salary structure</div>
              )}
            </div>
          </div>
        )}

        {view === 'settings' && globalSettings && (
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>Payroll Settings (PF, TDS, Gratuity)</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {[
                { label: 'PF Rate', desc: 'Employee provident fund percentage', value: `${(globalSettings.pfRate * 100).toFixed(0)}%` },
                { label: 'Max PF', desc: 'Maximum PF deduction per month', value: `$${globalSettings.maxPf}` },
                { label: 'Gratuity Rate', desc: 'Gratuity calculation rate', value: `${(globalSettings.gratuityRate * 100).toFixed(2)}%` },
                { label: 'TDS Enabled', desc: 'Tax deducted at source', value: globalSettings.tdsEnabled ? 'Yes' : 'No' },
                { label: 'EPF Enabled', desc: 'Employee provident fund', value: globalSettings.epfEnabled ? 'Yes' : 'No' },
              ].map((item) => (
                <div key={item.label} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.label}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.desc}</div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="glass-card mt-2" style={{ padding: '1rem', borderLeft: '3px solid var(--warning)' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--warning)', fontSize: '0.9rem', fontWeight: 700 }}>Indian New Tax Slabs (Budget 2024-25 / 2026)</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>₹0 - ₹3.0L: Nil</div>
                <div>₹3.0L - ₹7.0L: 5% (Rebate under Section 87A if taxable &le; ₹7L)</div>
                <div>₹7.0L - ₹10.0L: 10%</div>
                <div>₹10.0L - ₹12.0L: 15%</div>
                <div>₹12.0L - ₹15.0L: 20%</div>
                <div>₹15.0L+: 30%</div>
                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>Standard Deduction: ₹75,000 | Cess: 4% Surcharge</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
