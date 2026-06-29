'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getAllPayrollRuns, getPayrollReport, getPayrollPreflight, downloadPayrollExport, runPayroll, getEmployees, getSalaryStructure, setSalaryStructure, calculateEmployeeSalary, getPayrollSettings, updatePayrollSettings } from '@/lib/api';
import { CanView, CanCreate, CanEdit } from '@/components/PermissionGuard';
import Sidebar from '@/components/Sidebar';
import {
  PageHeader, Tabs, Button, DataTable, StatCard, Card, Banner,
  StatusChip, Stepper, Checkbox, ConfirmDialog,
  LoadingBlock, EmptyState,
} from '@/components/ui';
import type { Column, Step, TabItem } from '@/components/ui';

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
  const [form, setForm] = useState({ basicSalary: 0, hra: 0, da: 0, conveyance: 0, medical: 0, specialAllowance: 0, otherAllowance: 0, pfEnabled: true, tdsEnabled: true, esiEnabled: true, professionalTaxEnabled: true, insurance: 0, otherDeduction: 0, usePercentSettings: true });
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

  // Dialog state (replaces native confirm/prompt)
  const [confirmRun, setConfirmRun] = useState(false);
  const [skipDialog, setSkipDialog] = useState<{ stage: string; fallback: string } | null>(null);

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
    setConfirmRun(true);
  };

  const runPayrollConfirmed = async () => {
    setConfirmRun(false);
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

  const handleBasicSalaryChange = (basic: number) => {
    if (form.usePercentSettings && globalSettings) {
      const hra = Number((basic * (globalSettings.hraPercent ?? 40.0) / 100).toFixed(2));
      const da = Number((basic * (globalSettings.daPercent ?? 20.0) / 100).toFixed(2));
      const conveyance = Number((basic * (globalSettings.conveyancePercent ?? 10.0) / 100).toFixed(2));
      const medical = Number((basic * (globalSettings.medicalPercent ?? 5.0) / 100).toFixed(2));
      const specialAllowance = Number((basic * (globalSettings.specialAllowancePercent ?? 15.0) / 100).toFixed(2));
      const insurance = Number((basic * (globalSettings.insurancePercent ?? 5.0) / 100).toFixed(2));

      setForm({
        ...form,
        basicSalary: basic,
        hra,
        da,
        conveyance,
        medical,
        specialAllowance,
        insurance,
      });
    } else {
      setForm({ ...form, basicSalary: basic });
    }
  };

  const handleUsePercentToggle = (checked: boolean) => {
    if (checked && globalSettings) {
      const basic = form.basicSalary || 0;
      const hra = Number((basic * (globalSettings.hraPercent ?? 40.0) / 100).toFixed(2));
      const da = Number((basic * (globalSettings.daPercent ?? 20.0) / 100).toFixed(2));
      const conveyance = Number((basic * (globalSettings.conveyancePercent ?? 10.0) / 100).toFixed(2));
      const medical = Number((basic * (globalSettings.medicalPercent ?? 5.0) / 100).toFixed(2));
      const specialAllowance = Number((basic * (globalSettings.specialAllowancePercent ?? 15.0) / 100).toFixed(2));
      const insurance = Number((basic * (globalSettings.insurancePercent ?? 5.0) / 100).toFixed(2));

      setForm({
        ...form,
        usePercentSettings: true,
        hra,
        da,
        conveyance,
        medical,
        specialAllowance,
        insurance,
      });
    } else {
      setForm({ ...form, usePercentSettings: false });
    }
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
          usePercentSettings: data.usePercentSettings !== false,
        });
      } else {
        setStructure(null);
        setForm({ basicSalary: 0, hra: 0, da: 0, conveyance: 0, medical: 0, specialAllowance: 0, otherAllowance: 0, pfEnabled: true, tdsEnabled: true, esiEnabled: true, professionalTaxEnabled: true, insurance: 0, otherDeduction: 0, usePercentSettings: true });
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

  // ---- Helpers for the migrated UI ----
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const monthName = (m: number) => new Date(0, m - 1).toLocaleString('en', { month: 'long' });

  const confirmStage = (key: string) => {
    setConfirmations(prev => ({ ...prev, [key]: true }));
    setActiveManualStage(null);
  };

  const inputStyle = (readOnly?: boolean): React.CSSProperties => ({
    opacity: readOnly ? 0.75 : 1,
    cursor: readOnly ? 'not-allowed' : 'text',
  });

  // File upload control for stepper detail panels
  const csvUploadControl = (type: string, stageKey: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="ghost" size="sm" onClick={() => downloadCSVTemplate(type)}>Download Sample CSV Template</Button>
      </div>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleCSVUpload(type, file);
            setConfirmations(prev => ({ ...prev, [stageKey]: true }));
          }
        }}
        style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
      />
      {uploadedFiles[type] && (
        <div style={{ fontSize: '0.7rem', color: 'var(--success-fg)' }}>✓ Uploaded: {uploadedFiles[type]}</div>
      )}
    </div>
  );

  const stageContent = (stage: PayrollStage): React.ReactNode => {
    const isSkipped = skipReasons[stage.key] !== undefined;

    const wrap = (body: React.ReactNode) => (
      <div>
        {body}
        {isSkipped && (
          <div style={{ fontSize: '0.75rem', color: 'var(--warning-fg)', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Skipped Reason: "{skipReasons[stage.key]}"
          </div>
        )}
      </div>
    );

    switch (stage.key) {
      case 'attendanceLocked':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Locking attendance prevents modifications during payroll generation and ensures all shifts are locked.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => window.open('/attendance', '_blank')}>Open Attendance Module</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Confirm Locked</Button>
          </div>
        </div>);

      case 'lopsAdded':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Verify unpaid leaves (Loss Of Pay days) in the Leave requests panel to ensure correct proportional basic calculations.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => window.open('/leave', '_blank')}>Open Leave Requests</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Confirm Leaves Verified</Button>
          </div>
        </div>);

      case 'salaryRevisionUpdated':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Make sure all appraisals, salary revisions, increment policies for this month have been committed to individual salary structures.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => setView('structure')}>Open Salary Structure Console</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Confirm Revisions Checked</Button>
          </div>
        </div>);

      case 'incomeTaxDeclaration':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Review and upload Employee tax declarations (Regime selection: OLD vs NEW) to update statutory TDS estimations.
          </p>
          {csvUploadControl('tax', stage.key)}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Verify Declarations</Button>
            <Button variant="ghost" size="sm" style={{ color: 'var(--warning-fg)' }} onClick={() => setSkipDialog({ stage: stage.key, fallback: 'Skipped' })}>Skip Step</Button>
          </div>
        </div>);

      case 'investmentProofs':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Validate investment declarations proofs for 80C, 80D, home loans and HRA submitted by employees.
          </p>
          {csvUploadControl('proofs', stage.key)}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Verify Investment Proofs</Button>
            <Button variant="ghost" size="sm" style={{ color: 'var(--warning-fg)' }} onClick={() => setSkipDialog({ stage: stage.key, fallback: 'Skipped' })}>Skip Step</Button>
          </div>
        </div>);

      case 'arrearsReviewed':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Bulk upload Arrears CSV file or key them in manually in the adjustments table below.
          </p>
          {csvUploadControl('arrears', stage.key)}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Mark Verified</Button>
            <Button variant="ghost" size="sm" style={{ color: 'var(--warning-fg)' }} onClick={() => setSkipDialog({ stage: stage.key, fallback: 'No arrears this month' })}>Skip (No Arrears)</Button>
          </div>
        </div>);

      case 'incentivesReviewed':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Bulk upload Incentives/Bonus details via CSV file or enter them manually in the table below.
          </p>
          {csvUploadControl('incentives', stage.key)}
          <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Mark Verified</Button>
            <Button variant="ghost" size="sm" style={{ color: 'var(--warning-fg)' }} onClick={() => setSkipDialog({ stage: stage.key, fallback: 'No incentives this month' })}>Skip (No Incentives)</Button>
          </div>
        </div>);

      case 'overtimeApproved':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            All OT requests for the period must be marked approved or rejected in the Overtime center.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => window.open('/overtime', '_blank')}>Verify Overtime Approvals</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Mark Verified</Button>
          </div>
        </div>);

      case 'statutoryComplianceReviewed':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Review configured statutory formulas: EPF contribution split, Gratuity Act eligibility, state PT slabs, ESI cycles, and TDS tax brackets.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => setView('settings')}>View Statutory Constants Settings</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Confirm Checked</Button>
          </div>
        </div>);

      case 'bankAndPayoutVerified':
        return wrap(<div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Confirm that employee bank accounts, routing details and payout templates are correct.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" size="sm" onClick={() => window.open('/employees', '_blank')}>Verify Employee Bank Directory</Button>
            <Button variant="success" size="sm" onClick={() => confirmStage(stage.key)}>Confirm Verified</Button>
          </div>
        </div>);

      default:
        return wrap(null);
    }
  };

  if (authLoading || !user) return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  if (user.role === 'EMPLOYEE') return null;

  const tabItems: TabItem[] = [
    { key: 'runs', label: 'Runs' },
    ...(isAdmin ? [{ key: 'process', label: 'Process' }] : []),
    { key: 'structure', label: 'Salary Structure' },
    ...(isAdmin ? [{ key: 'settings', label: 'Settings' }] : []),
  ];

  const runsColumns: Column<PayrollRun>[] = [
    { key: 'period', header: 'Period', render: (run) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{monthName(run.month)} {run.year}</span> },
    { key: 'employees', header: 'Employees', align: 'center', render: (run) => run.employeeCount },
    { key: 'total', header: 'Total Amount', align: 'right', render: (run) => <span style={{ fontWeight: 600, color: 'var(--success-fg)' }}>₹{run.totalAmount?.toLocaleString()}</span> },
    { key: 'status', header: 'Status', render: (run) => <StatusChip status={run.status} /> },
    { key: 'actions', header: 'Actions', render: (run) => <Button size="sm" variant="primary" onClick={() => loadReport(run)}>View</Button> },
  ];

  const reportColumns: Column<PayrollRecord>[] = [
    { key: 'employee', header: 'Employee', render: (rec) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.employee?.firstName} {rec.employee?.lastName}</span> },
    { key: 'basic', header: 'Basic', align: 'right', render: (rec) => `₹${rec.basicSalary?.toFixed(0)}` },
    { key: 'gross', header: 'Gross', align: 'right', render: (rec) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{rec.grossEarnings?.toFixed(0)}</span> },
    { key: 'lop', header: 'LOP', align: 'right', render: (rec) => rec.lopDays || rec.leaves || 0 },
    { key: 'ot', header: 'OT', align: 'right', render: (rec) => `₹${(rec.overtimePay || 0).toFixed(0)}` },
    { key: 'arrears', header: 'Arrears', align: 'right', render: (rec) => `₹${(rec.arrears || 0).toFixed(0)}` },
    { key: 'incentives', header: 'Incentives', align: 'right', render: (rec) => `₹${(rec.incentives || 0).toFixed(0)}` },
    { key: 'pf', header: 'PF', align: 'right', render: (rec) => <span style={{ color: 'var(--danger-fg)' }}>₹{rec.pf?.toFixed(0)}</span> },
    { key: 'esi', header: 'ESI', align: 'right', render: (rec) => <span style={{ color: 'var(--danger-fg)' }}>₹{(rec.esi || 0).toFixed(0)}</span> },
    { key: 'pt', header: 'PT', align: 'right', render: (rec) => <span style={{ color: 'var(--danger-fg)' }}>₹{(rec.professionalTax || 0).toFixed(0)}</span> },
    { key: 'tax', header: 'Tax (TDS)', align: 'right', render: (rec) => <span style={{ color: 'var(--danger-fg)' }}>₹{rec.tax?.toFixed(0)}</span> },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (rec) => <span style={{ color: 'var(--danger-fg)' }}>₹{rec.totalDeductions?.toFixed(0)}</span> },
    { key: 'net', header: 'Net', align: 'right', render: (rec) => <span style={{ fontWeight: 700, color: 'var(--success-fg)' }}>₹{rec.netSalary?.toFixed(0)}</span> },
  ];

  // System health check fix buttons
  const checkFixButton = (check: any, affected: any[]): React.ReactNode => {
    switch (check.key) {
      case 'salaryStructures':
        return <Button variant="primary" size="sm" onClick={() => { setView('structure'); if (affected[0]) loadStructure(affected[0].id); }}>Go Configure Salary Structures</Button>;
      case 'bankDetails':
        return <Button variant="ghost" size="sm" onClick={() => window.open('/employees', '_blank')}>Update Bank Details (New Window)</Button>;
      case 'pfDetails':
        return <Button variant="ghost" size="sm" onClick={() => window.open('/employees', '_blank')}>Update PF Details (New Window)</Button>;
      case 'pendingOvertime':
        return <Button variant="danger" size="sm" onClick={() => window.open('/overtime', '_blank')}>Go to Overtime Module to Approve</Button>;
      case 'attendanceCaptured':
        return <Button variant="ghost" size="sm" onClick={() => window.open('/attendance', '_blank')}>Verify Attendance (New Window)</Button>;
      default:
        return null;
    }
  };

  // Build the stepper steps from manual stages
  const manualStages: PayrollStage[] = preflight?.manualStages || [];
  const steps: Step[] = manualStages.map((stage) => {
    const isConfirmed = confirmations[stage.key] === true;
    const isSkipped = skipReasons[stage.key] !== undefined;
    const isActive = activeManualStage === stage.key;
    const status: Step['status'] = isSkipped ? 'skipped' : isConfirmed ? 'done' : isActive ? 'active' : 'pending';
    return {
      key: stage.key,
      status,
      label: stage.label,
      content: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <Checkbox
              label={stage.required ? 'Confirm this stage (required)' : 'Confirm this stage'}
              checked={isConfirmed}
              onChange={(checked) => {
                setConfirmations(prev => ({ ...prev, [stage.key]: checked }));
                if (!checked) {
                  setSkipReasons(prev => {
                    const next = { ...prev };
                    delete next[stage.key];
                    return next;
                  });
                }
              }}
            />
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {isSkipped && <StatusChip status="SKIPPED" />}
              {isConfirmed && !isSkipped && <StatusChip status="VERIFIED" />}
              <button
                onClick={() => setActiveManualStage(isActive ? null : stage.key)}
                aria-label={isActive ? 'Collapse stage' : 'Expand stage'}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform var(--motion-base)' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          </div>
          {isActive && (
            <div style={{ marginTop: '0.9rem', padding: '0.8rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
              {stageContent(stage)}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PageHeader
          title="Payroll"
          subtitle="Process payroll & manage salary structures"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
          actions={<Tabs items={tabItems} value={view === 'report' ? 'runs' : view} onChange={(k) => setView(k as typeof view)} />}
        />

        {view === 'runs' && (
          <>
            {isAdmin && (
              <div style={{ marginBottom: '1.5rem' }}>
                <Button variant="success" disabled={processing} onClick={() => setView('process')} leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}>
                  Open Payroll Process
                </Button>
              </div>
            )}

            <DataTable
              columns={runsColumns}
              rows={runs}
              loading={loading}
              rowKey={(run) => run.id}
              empty={<EmptyState title="No payroll runs found" message="Run payroll for a period to see it listed here." />}
            />

            {selectedRun && records.length > 0 && (
              <Card style={{ marginTop: '1rem' }} padded={false}>
                <div style={{ padding: '1.25rem 1.25rem 0' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{monthName(selectedRun.month)} {selectedRun.year} — {records.length} Employees</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1.25rem 0.75rem' }}>
                  <Button variant="primary" size="sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'excel' })}>Excel</Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'csv' })}>CSV</Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadPayrollExport({ month: selectedRun.month, year: selectedRun.year, format: 'pdf' })}>PDF</Button>
                </div>
                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                  <DataTable
                    columns={reportColumns}
                    rows={records}
                    rowKey={(rec) => rec.id}
                    stickyFirst
                  />
                </div>
              </Card>
            )}
          </>
        )}

        {view === 'process' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Payroll Processing Command Center</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Verify system checks, run interactive manual tasks, and prepare variable payouts before processing.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select className="select-field" value={processMonth} onChange={(e) => setProcessMonth(Number(e.target.value))} style={{ width: '150px' }}>
                    {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString('en', { month: 'long' })}</option>)}
                  </select>
                  <input className="input-field" type="number" value={processYear} onChange={(e) => setProcessYear(Number(e.target.value))} style={{ width: '110px' }} />
                </div>
              </div>

              {loading ? (
                <LoadingBlock label="Loading preflight checks…" />
              ) : (
                <>
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                    <StatCard label="Active Employees" value={preflight?.summary?.activeEmployees || 0} />
                    <StatCard label="LOP Days" value={preflight?.summary?.lopDays || 0} />
                    <StatCard label="Approved OT Hours" value={preflight?.summary?.approvedOvertimeHours || 0} />
                    <StatCard label="Pending OT" value={preflight?.summary?.pendingOvertime || 0} />
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
                          const statusLabel = check.passed ? 'PASSED' : check.blocking ? 'BLOCKING' : 'REVIEW';
                          const accent = check.passed ? 'var(--success-border)' : check.blocking ? 'var(--danger-border)' : 'var(--warning-border)';

                          return (
                            <Card key={check.key} style={{ borderLeft: `4px solid ${accent}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                <div>
                                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{check.label}</strong>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{check.detail}</div>
                                </div>
                                <StatusChip status={statusLabel} />
                              </div>

                              {!check.passed && (
                                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                                  {affected.length > 0 && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                      <button
                                        onClick={() => setActiveCheckDetail(isExpanded ? null : check.key)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform var(--motion-base)' }}><polyline points="9 18 15 12 9 6"/></svg>
                                        {isExpanded ? 'Hide' : 'View'} affected employees ({affected.length})
                                      </button>
                                      {isExpanded && (
                                        <div style={{ background: 'var(--surface-sunken)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                          {affected.map(e => (
                                            <span key={e.id} style={{ background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                              {e.name} ({e.employeeId})
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {checkFixButton(check, affected)}
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Interactive Task Board as a Stepper */}
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        Interactive Task Board
                      </h3>
                      <Stepper steps={steps} />
                    </div>
                  </div>
                </>
              )}
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Variable Inputs: Arrears, Incentives, OT and LOP Review</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => downloadCSVTemplate('arrears')}>Download Arrears CSV Template</Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadCSVTemplate('incentives')}>Download Incentives CSV Template</Button>
                </div>
              </div>
              <div className="table-container">
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
                <Button variant="success" disabled={processing || !preflight?.canRun} loading={processing} onClick={handleRunPayroll}>
                  {processing ? 'Processing...' : 'Run Payroll'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {view === 'structure' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
            <Card title="Employees">
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {employees.map((emp) => {
                  const active = selectedEmployee?.id === emp.id;
                  return (
                    <div key={emp.id} onClick={() => loadStructure(emp.id)} style={{ padding: '0.75rem', cursor: 'pointer', background: active ? 'var(--surface-sunken)' : 'transparent', borderRadius: 'var(--radius-sm)', marginBottom: '0.25rem', transition: 'var(--transition)' }}>
                      <div style={{ fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-primary)', fontSize: '0.9rem' }}>{emp.firstName} {emp.lastName}</div>
                      <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.employeeId}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              {selectedEmployee ? (
                <>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Salary Structure — {selectedEmployee.firstName} {selectedEmployee.lastName}</h3>
                  <div className="form-grid">
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <Checkbox
                        label="Auto-calculate allowances using Payroll Settings percentage"
                        checked={form.usePercentSettings}
                        onChange={handleUsePercentToggle}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Basic Salary *</label>
                      <input type="number" value={form.basicSalary} onChange={(e) => handleBasicSalaryChange(parseFloat(e.target.value) || 0)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">HRA {form.usePercentSettings && `(${globalSettings?.hraPercent ?? 40}%)`}</label>
                      <input type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">DA {form.usePercentSettings && `(${globalSettings?.daPercent ?? 20}%)`}</label>
                      <input type="number" value={form.da} onChange={(e) => setForm({ ...form, da: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Conveyance {form.usePercentSettings && `(${globalSettings?.conveyancePercent ?? 10}%)`}</label>
                      <input type="number" value={form.conveyance} onChange={(e) => setForm({ ...form, conveyance: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Medical {form.usePercentSettings && `(${globalSettings?.medicalPercent ?? 5}%)`}</label>
                      <input type="number" value={form.medical} onChange={(e) => setForm({ ...form, medical: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Special Allowance {form.usePercentSettings && `(${globalSettings?.specialAllowancePercent ?? 15}%)`}</label>
                      <input type="number" value={form.specialAllowance} onChange={(e) => setForm({ ...form, specialAllowance: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Insurance Deduction {form.usePercentSettings && `(${globalSettings?.insurancePercent ?? 5}%)`}</label>
                      <input type="number" value={form.insurance} onChange={(e) => setForm({ ...form, insurance: parseFloat(e.target.value) || 0 })} readOnly={form.usePercentSettings} style={inputStyle(form.usePercentSettings)} className="input-field" />
                    </div>
                    <div className="form-group"><Checkbox label="Enable EPF (12%)" checked={form.pfEnabled} onChange={(v) => setForm({ ...form, pfEnabled: v })} /></div>
                    <div className="form-group"><Checkbox label="Enable ESI (0.75%)" checked={form.esiEnabled} onChange={(v) => setForm({ ...form, esiEnabled: v })} /></div>
                    <div className="form-group"><Checkbox label="Enable Professional Tax (PT)" checked={form.professionalTaxEnabled} onChange={(v) => setForm({ ...form, professionalTaxEnabled: v })} /></div>
                    <div className="form-group"><Checkbox label="Enable TDS (New Regime)" checked={form.tdsEnabled} onChange={(v) => setForm({ ...form, tdsEnabled: v })} /></div>
                  </div>

                  {preview && (
                    <Card style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Monthly Calculation Preview (Indian Compliance)</h4>
                      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <StatCard label="Gross Earnings" value={`₹${preview.grossEarnings.toFixed(2)}`} />
                        <StatCard label="Employee PF (12%)" value={<span style={{ color: 'var(--danger-fg)' }}>₹{preview.employeePf.toFixed(2)}</span>} />
                        <StatCard label="Employee ESI (0.75%)" value={<span style={{ color: 'var(--danger-fg)' }}>₹{preview.employeeEsi.toFixed(2)}</span>} />
                        <StatCard label="Professional Tax (PT)" value={<span style={{ color: 'var(--danger-fg)' }}>₹{preview.professionalTax.toFixed(2)}</span>} />
                        <StatCard label={`TDS (${preview.taxSlab})`} value={<span style={{ color: 'var(--danger-fg)' }}>₹{preview.tds.toFixed(2)}</span>} />
                        <StatCard label="Total Deductions" value={<span style={{ color: 'var(--danger-fg)' }}>₹{preview.totalDeductions.toFixed(2)}</span>} />
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '1rem', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="form-label">Net Salary (Take Home)</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-fg)' }}>₹{preview.netSalary.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="form-label">Employer Share (PF + ESI)</span>
                          <div style={{ fontSize: '1rem', color: 'var(--warning-fg)' }}>₹{(preview.employerPf + preview.employerEsi).toFixed(2)}</div>
                        </div>
                      </div>
                    </Card>
                  )}

                  <Button variant="primary" style={{ marginTop: '1rem' }} onClick={handleSaveStructure}>Save Structure</Button>
                </>
              ) : (
                <EmptyState title="Select an employee" message="Choose an employee to configure their salary structure." />
              )}
            </Card>
          </div>
        )}

        {view === 'settings' && globalSettings && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '1200px' }}>
            <Card title="Statutory Rates & Thresholds">
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">EPF Contribution Rate (Employee)</label>
                  <input type="number" step="0.01" value={globalSettings.pfRate} onChange={(e) => setGlobalSettings({ ...globalSettings, pfRate: parseFloat(e.target.value) || 0 })} className="input-field" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>e.g. 0.12 for 12%</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Maximum Monthly EPF (₹)</label>
                  <input type="number" value={globalSettings.maxPf} onChange={(e) => setGlobalSettings({ ...globalSettings, maxPf: parseFloat(e.target.value) || 0 })} className="input-field" />
                </div>
                <div className="form-group">
                  <label className="form-label">Gratuity Formula Rate</label>
                  <input type="number" step="0.0001" value={globalSettings.gratuityRate} onChange={(e) => setGlobalSettings({ ...globalSettings, gratuityRate: parseFloat(e.target.value) || 0 })} className="input-field" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>e.g. 0.0481 (15/26 days per year of service)</span>
                </div>
                <div className="form-group" style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <Checkbox label="Enable TDS Projection" checked={globalSettings.tdsEnabled} onChange={(v) => setGlobalSettings({ ...globalSettings, tdsEnabled: v })} />
                  <Checkbox label="Enable EPF Deduction" checked={globalSettings.epfEnabled} onChange={(v) => setGlobalSettings({ ...globalSettings, epfEnabled: v })} />
                </div>
              </div>
            </Card>

            <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Salary Component Allocations (% of Basic)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">HRA %</label>
                    <input type="number" value={globalSettings.hraPercent ?? 40} onChange={(e) => setGlobalSettings({ ...globalSettings, hraPercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DA %</label>
                    <input type="number" value={globalSettings.daPercent ?? 20} onChange={(e) => setGlobalSettings({ ...globalSettings, daPercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conveyance %</label>
                    <input type="number" value={globalSettings.conveyancePercent ?? 10} onChange={(e) => setGlobalSettings({ ...globalSettings, conveyancePercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medical %</label>
                    <input type="number" value={globalSettings.medicalPercent ?? 5} onChange={(e) => setGlobalSettings({ ...globalSettings, medicalPercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Special Allowance %</label>
                    <input type="number" value={globalSettings.specialAllowancePercent ?? 15} onChange={(e) => setGlobalSettings({ ...globalSettings, specialAllowancePercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Insurance Deduction %</label>
                    <input type="number" value={globalSettings.insurancePercent ?? 5} onChange={(e) => setGlobalSettings({ ...globalSettings, insurancePercent: parseFloat(e.target.value) || 0 })} className="input-field" />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <Button variant="primary" onClick={async () => {
                  try {
                    await updatePayrollSettings(globalSettings);
                    alert('Payroll settings and component percentages updated successfully.');
                    loadGlobalSettings();
                  } catch (err) {
                    alert('Failed to update settings');
                  }
                }}>Save Settings</Button>
              </div>
            </Card>

            <div style={{ gridColumn: 'span 2' }}>
              <Banner tone="warning" title="Indian New Tax Slabs (Budget 2024-25 / 2026)">
                <div style={{ fontSize: '0.8rem', lineHeight: 1.8 }}>
                  <div>₹0 - ₹3.0L: Nil</div>
                  <div>₹3.0L - ₹7.0L: 5% (Rebate under Section 87A if taxable &le; ₹7L)</div>
                  <div>₹7.0L - ₹10.0L: 10%</div>
                  <div>₹10.0L - ₹12.0L: 15%</div>
                  <div>₹12.0L - ₹15.0L: 20%</div>
                  <div>₹15.0L+: 30%</div>
                  <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>Standard Deduction: ₹75,000 | Cess: 4% Surcharge</div>
                </div>
              </Banner>
            </div>
          </div>
        )}

        {/* Run payroll confirmation */}
        <ConfirmDialog
          open={confirmRun}
          title="Run Payroll"
          message={`Run payroll for ${monthName(processMonth)} ${processYear}?`}
          confirmLabel="Run Payroll"
          loading={processing}
          onConfirm={runPayrollConfirmed}
          onCancel={() => setConfirmRun(false)}
        />

        {/* Skip-stage reason capture (replaces native prompt) */}
        <ConfirmDialog
          open={skipDialog !== null}
          title="Skip stage"
          message="Provide a reason for skipping this payroll stage. It will be recorded against the run."
          confirmLabel="Skip stage"
          tone="primary"
          requireReason
          reasonLabel="Reason for skipping"
          onConfirm={(reason) => {
            if (skipDialog) {
              const key = skipDialog.stage;
              const value = reason || skipDialog.fallback;
              setSkipReasons(prev => ({ ...prev, [key]: value }));
              setConfirmations(prev => ({ ...prev, [key]: true }));
              setActiveManualStage(null);
            }
            setSkipDialog(null);
          }}
          onCancel={() => setSkipDialog(null)}
        />
      </main>
    </div>
  );
}
