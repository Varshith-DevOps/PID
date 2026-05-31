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

  // New States for Interactive Steps & Checklist
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const [activeManualStage, setActiveManualStage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [activeCheckDetail, setActiveCheckDetail] = useState<string | null>(null);

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

  const downloadCSVTemplate = (type: string) => {
    let headers = '';
    let rows: string[] = [];
    const empList = preflight?.employeeSummaries || [];
    
    if (type === 'arrears') {
      headers = 'EmployeeID,EmployeeName,ArrearsAmount,Notes';
      if (empList.length > 0) {
        rows = empList.slice(0, 3).map((e: any, index: number) => 
          `"${e.employeeId}","${e.name}",${[5000, 2500, 3000][index] || 1000},"May Performance Arrears"`
        );
      } else {
        rows = ['"EMP00022","Aishwarya Sen",5000,"Q1 performance arrears"'];
      }
    } else if (type === 'incentives') {
      headers = 'EmployeeID,EmployeeName,IncentiveAmount,Notes';
      if (empList.length > 0) {
        rows = empList.slice(0, 3).map((e: any, index: number) => 
          `"${e.employeeId}","${e.name}",${[8000, 4500, 6000][index] || 1500},"Milestone Incentive"`
        );
      } else {
        rows = ['"EMP00022","Aishwarya Sen",8000,"May milestone incentive"'];
      }
    } else if (type === 'tax') {
      headers = 'EmployeeID,EmployeeName,Regime,Section80C,Section80D,HomeLoanInterest,HRAExemption';
      if (empList.length > 0) {
        rows = empList.slice(0, 3).map((e: any, index: number) => 
          `"${e.employeeId}","${e.name}","${index % 2 === 0 ? 'NEW' : 'OLD'}",${index % 2 === 0 ? 0 : 150000},${index % 2 === 0 ? 0 : 25000},0,0`
        );
      } else {
        rows = ['"EMP00022","Aishwarya Sen","NEW",0,0,0,0', '"EMP00003","Amit Patel","OLD",150000,25000,0,0'];
      }
    } else if (type === 'proofs') {
      headers = 'EmployeeID,EmployeeName,DocumentType,AmountDeclared,AmountVerified,Remarks';
      if (empList.length > 0) {
        rows = empList.slice(0, 3).map((e: any, index: number) => 
          `"${e.employeeId}","${e.name}","80C PPF Receipts",150000,150000,"Verified and approved"`
        );
      } else {
        rows = ['"EMP00022","Aishwarya Sen","80C PPF Receipts",150000,150000,"Verified and approved"'];
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${type}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (type: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert('CSV file is empty or only contains headers');
        return;
      }
      
      const empList = preflight?.employeeSummaries || [];
      let count = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const char = line[charIndex];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim());

        const empId = cols[0];
        const valStr = cols[2];
        const notesVal = cols[3] || '';
        
        if (!empId) continue;
        const matchedEmp = empList.find((e: any) => e.employeeId === empId || e.id === empId);
        if (matchedEmp) {
          const numVal = parseFloat(valStr) || 0;
          if (type === 'arrears' || type === 'incentives') {
            setAdjustments((currentAdj) => ({
              ...currentAdj,
              [matchedEmp.id]: {
                ...(currentAdj[matchedEmp.id] || {}),
                [type]: numVal,
                notes: notesVal || (currentAdj[matchedEmp.id]?.notes || ''),
              },
            }));
          }
          count++;
        }
      }
      
      setUploadedFiles(prev => ({ ...prev, [type]: file.name }));
      alert(`Successfully imported ${type} data for ${count} employees from ${file.name}`);
    };
    reader.readAsText(file);
  };

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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Payroll Processing Command Center</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Verify system checks, run interactive manual tasks, and prepare variable payouts before processing.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select className="select-field" value={processMonth} onChange={(e) => setProcessMonth(Number(e.target.value))} style={{ width: '150px' }}>
                    {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString('en', { month: 'long' })}</option>)}
                  </select>
                  <input className="input-field" type="number" value={processYear} onChange={(e) => setProcessYear(Number(e.target.value))} style={{ width: '110px' }} />
                </div>
              </div>

              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }}><div className="stat-card-value text-info" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.3)' }}>{preflight?.summary?.activeEmployees || 0}</div><div className="stat-card-label">Active Employees</div></div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}><div className="stat-card-value text-warning" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>{preflight?.summary?.lopDays || 0}</div><div className="stat-card-label">LOP Days</div></div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)' }}><div className="stat-card-value text-success" style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.3)' }}>{preflight?.summary?.approvedOvertimeHours || 0}</div><div className="stat-card-label">Approved OT Hours</div></div>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}><div className="stat-card-value text-danger" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>{preflight?.summary?.pendingOvertime || 0}</div><div className="stat-card-label">Pending OT</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.5rem' }}>
                {/* Left Column: System Checks */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    System Health Checks
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {(preflight?.automaticChecks || []).map((check: any) => {
                      const empList = preflight?.employeeSummaries || [];
                      let affected: any[] = [];
                      if (check.key === 'salaryStructures') {
                        affected = empList.filter((e: any) => !e.salaryReady);
                      } else if (check.key === 'bankDetails') {
                        affected = empList.filter((e: any) => !e.bankReady);
                      } else if (check.key === 'pfDetails') {
                        affected = empList.filter((e: any) => !e.pfReady);
                      } else if (check.key === 'attendanceCaptured') {
                        affected = empList.filter((e: any) => e.attendanceEntries === 0);
                      }

                      const isExpanded = activeCheckDetail === check.key;

                      return (
                        <div key={check.key} className="glass-card" style={{ 
                          padding: '1rem', 
                          borderLeft: `4px solid ${check.passed ? 'var(--success)' : check.blocking ? 'var(--danger)' : 'var(--warning)'}`,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{check.label}</strong>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{check.detail}</div>
                            </div>
                            <span className={`badge ${check.passed ? 'badge-success' : check.blocking ? 'badge-danger' : 'badge-warning'}`} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                              {check.passed ? 'PASSED' : check.blocking ? 'BLOCKING' : 'REVIEW'}
                            </span>
                          </div>

                          {!check.passed && (
                            <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                              {affected.length > 0 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <button 
                                    onClick={() => setActiveCheckDetail(isExpanded ? null : check.key)}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><polyline points="9 18 15 12 9 6"/></svg>
                                    {isExpanded ? 'Hide' : 'View'} affected employees ({affected.length})
                                  </button>
                                  {isExpanded && (
                                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                      {affected.map(e => (
                                        <span key={e.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                                          {e.name} ({e.employeeId})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {check.key === 'salaryStructures' && (
                                  <button 
                                    onClick={() => {
                                      setView('structure');
                                      if (affected[0]) loadStructure(affected[0].id);
                                    }}
                                    className="btn btn-primary btn-sm" 
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '4px 10px' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    Go Configure Salary Structures
                                  </button>
                                )}
                                {check.key === 'bankDetails' && (
                                  <button 
                                    onClick={() => window.open('/employees', '_blank')}
                                    className="btn btn-ghost btn-sm" 
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '4px 10px' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    Update Bank Details (New Window)
                                  </button>
                                )}
                                {check.key === 'pfDetails' && (
                                  <button 
                                    onClick={() => window.open('/employees', '_blank')}
                                    className="btn btn-ghost btn-sm" 
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '4px 10px' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    Update PF Details (New Window)
                                  </button>
                                )}
                                {check.key === 'pendingOvertime' && (
                                  <button 
                                    onClick={() => window.open('/overtime', '_blank')}
                                    className="btn btn-danger btn-sm" 
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '4px 10px' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                    Go to Overtime Module to Approve
                                  </button>
                                )}
                                {check.key === 'attendanceCaptured' && (
                                  <button 
                                    onClick={() => window.open('/attendance', '_blank')}
                                    className="btn btn-ghost btn-sm" 
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '4px 10px' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    Verify Attendance (New Window)
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Interactive Manual Process Stages */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    Interactive Task Board
                  </h3>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {(preflight?.manualStages || []).map((stage: PayrollStage) => {
                      const isConfirmed = confirmations[stage.key] === true;
                      const isSkipped = skipReasons[stage.key] !== undefined;
                      const isActive = activeManualStage === stage.key;

                      let statusColor = 'rgba(255,255,255,0.03)';
                      let borderStyle = '1px solid rgba(255,255,255,0.06)';
                      if (isConfirmed && !isSkipped) {
                        statusColor = 'rgba(16, 185, 129, 0.05)';
                        borderStyle = '1px solid var(--success)';
                      } else if (isSkipped) {
                        statusColor = 'rgba(245, 158, 11, 0.05)';
                        borderStyle = '1px solid var(--warning)';
                      } else if (isActive) {
                        statusColor = 'rgba(59, 130, 246, 0.08)';
                        borderStyle = '1px solid var(--accent-blue)';
                      }

                      return (
                        <div key={stage.key} className="glass-card" style={{ 
                          padding: '1rem', 
                          background: statusColor, 
                          border: borderStyle,
                          transition: 'all 0.3s ease',
                          borderRadius: 'var(--radius-md)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <input 
                                type="checkbox" 
                                checked={isConfirmed} 
                                onChange={(e) => {
                                  setConfirmations(prev => ({ ...prev, [stage.key]: e.target.checked }));
                                  if (!e.target.checked) {
                                    setSkipReasons(prev => {
                                      const next = { ...prev };
                                      delete next[stage.key];
                                      return next;
                                    });
                                  }
                                }} 
                                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{stage.label}</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              {isSkipped && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>SKIPPED</span>}
                              {isConfirmed && !isSkipped && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>VERIFIED</span>}
                              
                              <button 
                                onClick={() => setActiveManualStage(isActive ? null : stage.key)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                            </div>
                          </div>

                          {isActive && (
                            <div style={{ marginTop: '0.9rem', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-blue)' }}>
                              
                              {stage.key === 'attendanceLocked' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Locking attendance prevents modifications during payroll generation and ensures all shifts are locked.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => window.open('/attendance', '_blank')} className="btn btn-primary btn-sm">
                                      Open Attendance Module
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Confirm Locked
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'lopsAdded' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Verify unpaid leaves (Loss Of Pay days) in the Leave requests panel to ensure correct proportional basic calculations.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => window.open('/leave', '_blank')} className="btn btn-primary btn-sm">
                                      Open Leave Requests
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Confirm Leaves Verified
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'salaryRevisionUpdated' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Make sure all appraisals, salary revisions, increment policies for this month have been committed to individual salary structures.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setView('structure')} className="btn btn-primary btn-sm">
                                      Open Salary Structure Console
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Confirm Revisions Checked
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'incomeTaxDeclaration' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Review and upload Employee tax declarations (Regime selection: OLD vs NEW) to update statutory TDS estimations.
                                  </p>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button onClick={() => downloadCSVTemplate('tax')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}>
                                        Download Sample CSV Template
                                      </button>
                                    </div>
                                    <input 
                                      type="file" 
                                      accept=".csv" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleCSVUpload('tax', file);
                                          setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        }
                                      }} 
                                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                    />
                                    {uploadedFiles['tax'] && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                        ✓ Uploaded: {uploadedFiles['tax']}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Verify Declarations
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const reason = prompt('Reason for skipping tax declarations review this month?');
                                        setSkipReasons(prev => ({ ...prev, [stage.key]: reason || 'Skipped' }));
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'var(--warning)' }}
                                    >
                                      Skip Step
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'investmentProofs' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Validate investment declarations proofs for 80C, 80D, home loans and HRA submitted by employees.
                                  </p>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button onClick={() => downloadCSVTemplate('proofs')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}>
                                        Download Sample CSV Template
                                      </button>
                                    </div>
                                    <input 
                                      type="file" 
                                      accept=".csv" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleCSVUpload('proofs', file);
                                          setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        }
                                      }} 
                                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                    />
                                    {uploadedFiles['proofs'] && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                        ✓ Uploaded: {uploadedFiles['proofs']}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Verify Investment Proofs
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const reason = prompt('Reason for skipping investment proofs verification?');
                                        setSkipReasons(prev => ({ ...prev, [stage.key]: reason || 'Skipped' }));
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'var(--warning)' }}
                                    >
                                      Skip Step
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'arrearsReviewed' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Bulk upload Arrears CSV file or key them in manually in the adjustments table below.
                                  </p>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button onClick={() => downloadCSVTemplate('arrears')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}>
                                        Download Sample CSV Template
                                      </button>
                                    </div>
                                    <input 
                                      type="file" 
                                      accept=".csv" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleCSVUpload('arrears', file);
                                          setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        }
                                      }} 
                                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                    />
                                    {uploadedFiles['arrears'] && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                        ✓ Uploaded: {uploadedFiles['arrears']}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Mark Verified
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const reason = prompt('Reason for skipping arrears adjustments?');
                                        setSkipReasons(prev => ({ ...prev, [stage.key]: reason || 'No arrears this month' }));
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'var(--warning)' }}
                                    >
                                      Skip (No Arrears)
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'incentivesReviewed' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Bulk upload Incentives/Bonus details via CSV file or enter them manually in the table below.
                                  </p>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button onClick={() => downloadCSVTemplate('incentives')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}>
                                        Download Sample CSV Template
                                      </button>
                                    </div>
                                    <input 
                                      type="file" 
                                      accept=".csv" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleCSVUpload('incentives', file);
                                          setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        }
                                      }} 
                                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                    />
                                    {uploadedFiles['incentives'] && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                        ✓ Uploaded: {uploadedFiles['incentives']}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Mark Verified
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const reason = prompt('Reason for skipping incentives?');
                                        setSkipReasons(prev => ({ ...prev, [stage.key]: reason || 'No incentives this month' }));
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }}
                                      className="btn btn-ghost btn-sm"
                                      style={{ color: 'var(--warning)' }}
                                    >
                                      Skip (No Incentives)
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'overtimeApproved' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    All OT requests for the period must be marked approved or rejected in the Overtime center.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => window.open('/overtime', '_blank')} className="btn btn-primary btn-sm">
                                      Verify Overtime Approvals
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Mark Verified
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'statutoryComplianceReviewed' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Review configured statutory formulas: EPF contribution split, Gratuity Act eligibility, state PT slabs, ESI cycles, and TDS tax brackets.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setView('settings')} className="btn btn-primary btn-sm">
                                      View Statutory Constants Settings
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Confirm Checked
                                    </button>
                                  </div>
                                </div>
                              )}

                              {stage.key === 'bankAndPayoutVerified' && (
                                <div>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                    Confirm that employee bank accounts, routing details and payout templates are correct.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => window.open('/employees', '_blank')} className="btn btn-primary btn-sm">
                                      Verify Employee Bank Directory
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setConfirmations(prev => ({ ...prev, [stage.key]: true }));
                                        setActiveManualStage(null);
                                      }} 
                                      className="btn btn-success btn-sm"
                                    >
                                      Confirm Verified
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isSkipped && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                  Skipped Reason: "{skipReasons[stage.key]}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Variable Inputs: Arrears, Incentives, OT and LOP Review</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => downloadCSVTemplate('arrears')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                    Download Arrears CSV Template
                  </button>
                  <button onClick={() => downloadCSVTemplate('incentives')} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                    Download Incentives CSV Template
                  </button>
                </div>
              </div>
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
