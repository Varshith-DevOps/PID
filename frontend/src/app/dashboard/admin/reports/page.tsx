'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import {
  downloadAuditPackExport,
  downloadReportExport,
  generateAuditPack,
  getAnalyticsReport,
  getAuditReportCenter,
  getDashboardData,
  getStatutoryReport,
  queryEmployeesReport,
  updateAuditPackStatus,
} from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TabType = 'center' | 'statutory' | 'internal' | 'builder';
type ExportFormat = 'xlsx' | 'csv' | 'pdf';

const EXPORT_REPORTS = [
  { value: 'employee-master', label: 'Employee Master' },
  { value: 'statutory:epf', label: 'EPF Register' },
  { value: 'statutory:esi', label: 'ESIC Register' },
  { value: 'statutory:pt', label: 'Professional Tax' },
  { value: 'statutory:lwf', label: 'LWF Register' },
  { value: 'statutory:minwage', label: 'Minimum Wage' },
  { value: 'statutory:gender-pay-gap', label: 'Gender Pay Gap' },
  { value: 'payroll:register', label: 'Payroll Register' },
  { value: 'payroll:cost-analysis', label: 'Payroll Cost Analysis' },
  { value: 'payroll:variance', label: 'Payroll Variance' },
  { value: 'analytics:headcount', label: 'Headcount Analytics' },
  { value: 'analytics:diversity', label: 'Diversity Analytics' },
  { value: 'analytics:age', label: 'Age Band Analytics' },
  { value: 'analytics:experience', label: 'Experience Analytics' },
  { value: 'audit:generated-reports', label: 'Generated Audit Reports' },
  { value: 'audit:activity-log', label: 'Audit Activity Log' },
  { value: 'audit:payroll-log', label: 'Payroll Audit Log' },
];

const allowedRoles = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'HR',
  'FINANCE',
  'ACCOUNTS',
  'PAYROLL_REVIEWER',
  'PAYROLL_APPROVER',
  'MANAGER',
]);

const monthName = (month: number) => new Date(2026, month - 1, 1).toLocaleString('en-IN', { month: 'long' });

const money = (value: any) => {
  if (typeof value !== 'number') return value ?? 'NA';
  return `INR ${value.toLocaleString('en-IN')}`;
};

const statusColor = (status: string) => {
  if (['LOW', 'GENERATED', 'SIGNED_OFF', 'APPROVED', 'COMPLIANT'].includes(status)) return '#10b981';
  if (['MEDIUM', 'UNDER_REVIEW', 'ATTENTION_REQUIRED', 'PENDING'].includes(status)) return '#f59e0b';
  return '#ef4444';
};

const compactCard: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: '8px',
  padding: '1rem',
};

export default function ReportsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabType>('center');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPack, setSelectedPack] = useState('monthly-statutory-pack');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [financialYear, setFinancialYear] = useState(`${now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1}-${String((now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1) + 1).slice(-2)}`);
  const [selectedReport, setSelectedReport] = useState('employee-master');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');

  const [center, setCenter] = useState<any>(null);
  const [chroData, setChroData] = useState<any>(null);
  const [compStats, setCompStats] = useState<any>(null);
  const [epfData, setEpfData] = useState<any[]>([]);
  const [esiData, setEsiData] = useState<any[]>([]);
  const [minWageData, setMinWageData] = useState<any[]>([]);
  const [genderGapData, setGenderGapData] = useState<any[]>([]);
  const [diversityData, setDiversityData] = useState<any[]>([]);

  const [builderCols, setBuilderCols] = useState<string[]>(['employeeId', 'firstName', 'lastName', 'gender', 'jobTitle', 'department']);
  const [builderFilters, setBuilderFilters] = useState<any[]>([{ field: 'department', operator: 'CONTAINS', value: '' }]);
  const [builderResult, setBuilderResult] = useState<any[]>([]);
  const [builderRunning, setBuilderRunning] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !allowedRoles.has(user.role))) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, month, year, financialYear]);

  const selectedPackMeta = useMemo(
    () => center?.catalog?.find((pack: any) => pack.id === selectedPack),
    [center, selectedPack],
  );

  const riskChart = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 };
    (center?.riskItems || []).forEach((item: any) => {
      if (counts[item.severity as keyof typeof counts] !== undefined) counts[item.severity as keyof typeof counts] += 1;
    });
    return Object.entries(counts).map(([severity, count]) => ({ severity, count }));
  }, [center]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [auditCenter, chro, comp, epf, esi, minWage, payGap, diversity] = await Promise.all([
        getAuditReportCenter({ month, year, financialYear }),
        getDashboardData('chro'),
        getDashboardData('compliance'),
        getStatutoryReport('epf'),
        getStatutoryReport('esi'),
        getStatutoryReport('minwage'),
        getStatutoryReport('gender-pay-gap'),
        getAnalyticsReport('diversity'),
      ]);

      setCenter(auditCenter);
      setChroData(chro);
      setCompStats(comp);
      setEpfData(epf.data || []);
      setEsiData(esi.data || []);
      setMinWageData(minWage.data || []);
      setGenderGapData(payGap.data || []);
      setDiversityData(diversity.data || []);
    } catch (err) {
      console.error('Failed to load compliance and audit center:', err);
    } finally {
      setLoading(false);
    }
  };

  const runBuilderQuery = async () => {
    try {
      setBuilderRunning(true);
      const res = await queryEmployeesReport({
        columns: builderCols,
        filters: builderFilters.filter((filter) => filter.field && String(filter.value || '').trim()),
      });
      setBuilderResult(res.data || []);
    } catch (err) {
      console.error('Failed to execute builder query:', err);
    } finally {
      setBuilderRunning(false);
    }
  };

  const handleGeneratePack = async () => {
    try {
      setActionLoading(true);
      await generateAuditPack({ packType: selectedPack, month, year, financialYear });
      await loadAll();
    } catch (err) {
      alert('Failed to generate audit pack');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPack = async () => {
    try {
      setActionLoading(true);
      await downloadAuditPackExport({ packType: selectedPack, month, year, financialYear });
    } catch (err) {
      alert('Failed to export audit pack');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      setActionLoading(true);
      await updateAuditPackStatus(id, { status, remarks: `Marked ${status} from Audit Report Center` });
      await loadAll();
    } catch (err) {
      alert('Failed to update audit pack status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMasterExport = async () => {
    try {
      setActionLoading(true);
      await downloadReportExport({ reportType: selectedReport, format: exportFormat });
    } catch {
      alert('Failed to export report');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || !user) {
    return <div className="loading-container"><div className="loading-spinner" />Loading...</div>;
  }

  const summary = center?.summary || {};
  const tabStyle = (tab: TabType): CSSProperties => ({
    background: activeTab === tab ? 'rgba(37, 99, 235, 0.16)' : 'transparent',
    border: activeTab === tab ? '1px solid rgba(96, 165, 250, 0.55)' : '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '8px',
    color: activeTab === tab ? '#93c5fd' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 700,
    padding: '0.55rem 0.8rem',
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'white', margin: 0 }}>
                Compliance & Audit Report Center
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.35rem 0 0' }}>
                India statutory packs, internal controls, access review, audit trails, evidence export, and management reporting.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="form-control" value={month} onChange={(event) => setMonth(Number(event.target.value))} style={{ width: '120px', height: '36px' }}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>{monthName(index + 1)}</option>
                ))}
              </select>
              <input className="form-control" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} style={{ width: '96px', height: '36px' }} />
              <input className="form-control" value={financialYear} onChange={(event) => setFinancialYear(event.target.value)} style={{ width: '100px', height: '36px' }} />
              <button className="btn btn-neutral btn-sm" onClick={loadAll}>Refresh</button>
            </div>
          </div>

          <div style={{ ...compactCard, display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ minWidth: '190px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Universal Export</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Choose any report and output format.</div>
            </div>
            <select className="form-control" value={selectedReport} onChange={(event) => setSelectedReport(event.target.value)} style={{ width: '240px', height: '36px' }}>
              {EXPORT_REPORTS.map((report) => (
                <option key={report.value} value={report.value}>{report.label}</option>
              ))}
            </select>
            <select className="form-control" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)} style={{ width: '120px', height: '36px' }}>
              <option value="xlsx">Excel</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleMasterExport} disabled={actionLoading}>
              {actionLoading ? 'Exporting...' : 'Export Report'}
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                {[
                  ['Active Headcount', summary.activeEmployees],
                  ['Payroll Status', summary.payrollStatus],
                  ['Gross Payroll', money(summary.totalGross)],
                  ['PF Compliance', `${compStats?.pfCompliancePercent ?? 0}%`],
                  ['ESI Compliance', `${compStats?.esiCompliancePercent ?? 0}%`],
                  ['Risk Exceptions', summary.riskItems],
                  ['Overdue Obligations', summary.overdueObligations],
                  ['Master Completeness', `${summary.employeeMasterCompleteness ?? 0}%`],
                ].map(([label, value]) => (
                  <div key={String(label)} style={compactCard}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                    <div style={{ color: 'white', fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem', wordBreak: 'break-word' }}>{String(value ?? 'NA')}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button style={tabStyle('center')} onClick={() => setActiveTab('center')}>Audit Center</button>
                <button style={tabStyle('statutory')} onClick={() => setActiveTab('statutory')}>Statutory Reports</button>
                <button style={tabStyle('internal')} onClick={() => setActiveTab('internal')}>Internal Controls</button>
                <button style={tabStyle('builder')} onClick={() => setActiveTab('builder')}>Report Builder</button>
              </div>

              {activeTab === 'center' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '1rem' }}>
                  <section style={compactCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <h2 style={{ color: 'white', fontSize: '1rem', margin: 0 }}>Audit Pack Generator</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '0.25rem 0 0' }}>Generate monthly, quarterly, annual, internal, and external audit evidence packs.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-neutral btn-sm" disabled={actionLoading} onClick={handleGeneratePack}>Generate Run</button>
                        <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleExportPack}>Export XLSX Pack</button>
                      </div>
                    </div>

                    <select className="form-control" value={selectedPack} onChange={(event) => setSelectedPack(event.target.value)} style={{ marginBottom: '0.85rem' }}>
                      {(center?.catalog || []).map((pack: any) => (
                        <option key={pack.id} value={pack.id}>{pack.name}</option>
                      ))}
                    </select>

                    {selectedPackMeta && (
                      <div style={{ border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '8px', padding: '0.9rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.14)', color: '#93c5fd' }}>{selectedPackMeta.category}</span>
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#fbbf24' }}>{selectedPackMeta.frequency}</span>
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.14)', color: '#fca5a5' }}>{selectedPackMeta.riskLevel}</span>
                        </div>
                        <div style={{ color: 'white', fontWeight: 700 }}>{selectedPackMeta.name}</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.5 }}>{selectedPackMeta.audience}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <ListBlock title="Laws / Controls" items={selectedPackMeta.laws} />
                          <ListBlock title="Reports" items={selectedPackMeta.reports} />
                          <ListBlock title="Evidence" items={selectedPackMeta.evidence} />
                        </div>
                      </div>
                    )}

                    <h3 style={{ color: 'white', fontSize: '0.9rem', margin: '0 0 0.6rem' }}>Generated Runs</h3>
                    <SimpleTable
                      columns={['type', 'status', 'period', 'generatedBy', 'createdAt', 'actions']}
                      rows={(center?.generatedReports || []).filter((row: any) => row.type?.startsWith('AUDIT_PACK_')).map((row: any) => ({
                        type: row.type.replace('AUDIT_PACK_', '').replaceAll('_', ' '),
                        status: <span style={{ color: statusColor(row.status), fontWeight: 800 }}>{row.status}</span>,
                        period: row.financialYear || `${row.month || ''}/${row.year || ''}`,
                        generatedBy: row.generatedBy,
                        createdAt: new Date(row.createdAt).toLocaleString('en-IN'),
                        actions: (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button className="btn btn-neutral btn-sm" onClick={() => handleStatus(row.id, 'UNDER_REVIEW')}>Review</button>
                            <button className="btn btn-primary btn-sm" onClick={() => handleStatus(row.id, 'SIGNED_OFF')}>Sign Off</button>
                          </div>
                        ),
                      }))}
                      empty="No audit packs generated yet."
                    />
                  </section>

                  <section style={compactCard}>
                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '0 0 0.75rem' }}>Risk Register</h2>
                    <div style={{ height: 190, marginBottom: '1rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                          <XAxis dataKey="severity" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(148,163,184,0.25)' }} />
                          <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {(center?.riskItems || []).slice(0, 8).map((item: any) => (
                        <div key={item.code} style={{ border: '1px solid rgba(148,163,184,0.14)', borderRadius: '8px', padding: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <span style={{ color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>{item.label}</span>
                            <span style={{ color: statusColor(item.severity), fontSize: '0.7rem', fontWeight: 800 }}>{item.severity}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.25rem' }}>Status: {String(item.status)}</div>
                        </div>
                      ))}
                      {(center?.riskItems || []).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>No open risk exceptions for this period.</p>}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'statutory' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem' }}>
                  <section style={compactCard}>
                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '0 0 0.75rem' }}>Statutory Readiness Checks</h2>
                    <SimpleTable
                      columns={['code', 'label', 'status', 'severity']}
                      rows={(center?.statutoryChecks || []).map((row: any) => ({
                        ...row,
                        severity: <span style={{ color: statusColor(row.severity), fontWeight: 800 }}>{row.severity}</span>,
                      }))}
                      empty="No statutory checks available."
                    />
                  </section>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                    <section style={compactCard}>
                      <h3 style={{ color: 'white', fontSize: '0.95rem', margin: '0 0 0.75rem' }}>EPF Register</h3>
                      <SimpleTable
                        columns={['employeeId', 'name', 'uan', 'pfWages', 'employeePf', 'employerPf']}
                        rows={epfData.slice(0, 12).map((row) => ({ ...row, pfWages: money(row.pfWages), employeePf: money(row.employeePf), employerPf: money(row.employerPf) }))}
                        empty="No EPF rows found."
                      />
                    </section>
                    <section style={compactCard}>
                      <h3 style={{ color: 'white', fontSize: '0.95rem', margin: '0 0 0.75rem' }}>ESIC Register</h3>
                      <SimpleTable
                        columns={['employeeId', 'name', 'esiNumber', 'esiWages', 'employeeContribution', 'employerContribution']}
                        rows={esiData.slice(0, 12).map((row) => ({ ...row, esiWages: money(row.esiWages), employeeContribution: money(row.employeeContribution), employerContribution: money(row.employerContribution) }))}
                        empty="No ESIC rows found."
                      />
                    </section>
                    <section style={compactCard}>
                      <h3 style={{ color: 'white', fontSize: '0.95rem', margin: '0 0 0.75rem' }}>Minimum Wage Exceptions</h3>
                      <SimpleTable
                        columns={['employeeId', 'name', 'state', 'designation', 'currentWage', 'minimumWage', 'complianceStatus']}
                        rows={minWageData.map((row) => ({ ...row, currentWage: money(row.currentWage), minimumWage: money(row.minimumWage) }))}
                        empty="No minimum wage records found."
                      />
                    </section>
                    <section style={compactCard}>
                      <h3 style={{ color: 'white', fontSize: '0.95rem', margin: '0 0 0.75rem' }}>Diversity and Pay Gap</h3>
                      <div style={{ height: 230 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={diversityData} dataKey="count" nameKey="gender" innerRadius={54} outerRadius={84}>
                              {diversityData.map((_, index) => <Cell key={index} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <SimpleTable
                        columns={['department', 'maleAvgSalary', 'femaleAvgSalary', 'genderGapPercent']}
                        rows={genderGapData.map((row) => ({ ...row, maleAvgSalary: money(row.maleAvgSalary), femaleAvgSalary: money(row.femaleAvgSalary) }))}
                        empty="No pay gap rows found."
                      />
                    </section>
                  </div>
                </div>
              )}

              {activeTab === 'internal' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 0.8fr)', gap: '1rem' }}>
                  <section style={compactCard}>
                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '0 0 0.75rem' }}>Operational Control Evidence</h2>
                    <SimpleTable columns={['area', 'metric', 'value']} rows={center?.operationalControls || []} empty="No controls available." />

                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '1.25rem 0 0.75rem' }}>Compliance Obligations Calendar</h2>
                    <SimpleTable
                      columns={['name', 'obligationType', 'dueDate', 'status', 'riskLevel', 'ownerRole']}
                      rows={(center?.obligations || []).map((row: any) => ({
                        name: row.name,
                        obligationType: row.obligationType,
                        dueDate: new Date(row.dueDate).toLocaleDateString('en-IN'),
                        status: <span style={{ color: statusColor(row.status), fontWeight: 800 }}>{row.status}</span>,
                        riskLevel: row.riskLevel,
                        ownerRole: row.ownerRole || 'NA',
                      }))}
                      empty="No compliance obligations configured."
                    />
                  </section>

                  <section style={compactCard}>
                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '0 0 0.75rem' }}>Access Review</h2>
                    <SimpleTable
                      columns={['name', 'email', 'role']}
                      rows={(center?.privilegedUsers || []).slice(0, 12)}
                      empty="No privileged users found."
                    />

                    <h2 style={{ color: 'white', fontSize: '1rem', margin: '1.25rem 0 0.75rem' }}>Recent Audit Trail</h2>
                    <SimpleTable
                      columns={['createdAt', 'userEmail', 'action', 'entity']}
                      rows={[...(center?.auditLogs || []), ...(center?.payrollAuditLogs || [])].slice(0, 14).map((row: any) => ({
                        createdAt: new Date(row.createdAt).toLocaleString('en-IN'),
                        userEmail: row.userEmail || 'system',
                        action: row.action,
                        entity: row.entity,
                      }))}
                      empty="No audit logs available."
                    />
                  </section>
                </div>
              )}

              {activeTab === 'builder' && (
                <section style={compactCard}>
                  <h2 style={{ color: 'white', fontSize: '1rem', margin: '0 0 0.75rem' }}>Ad-Hoc Employee Report Builder</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 700 }}>Output Columns</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem', marginTop: '0.5rem' }}>
                        {['employeeId', 'firstName', 'lastName', 'email', 'gender', 'jobTitle', 'department', 'location', 'employmentType', 'salary'].map((column) => (
                          <label key={column} style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="checkbox"
                              checked={builderCols.includes(column)}
                              onChange={(event) => setBuilderCols(event.target.checked ? [...builderCols, column] : builderCols.filter((item) => item !== column))}
                            />
                            {column}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 700 }}>Filters</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
                        {builderFilters.map((filter, index) => (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.35rem' }}>
                            <select className="form-control" value={filter.field} onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].field = event.target.value;
                              setBuilderFilters(list);
                            }}>
                              <option value="">Field</option>
                              <option value="gender">Gender</option>
                              <option value="department">Department</option>
                              <option value="location">Location</option>
                              <option value="employmentType">Employment Type</option>
                              <option value="age">Age</option>
                              <option value="experience">Experience</option>
                            </select>
                            <select className="form-control" value={filter.operator} onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].operator = event.target.value;
                              setBuilderFilters(list);
                            }}>
                              <option value="EQUALS">Equals</option>
                              <option value="CONTAINS">Contains</option>
                              <option value="GREATER_THAN">Greater Than</option>
                              <option value="LESS_THAN">Less Than</option>
                            </select>
                            <input className="form-control" value={filter.value} placeholder="Value" onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].value = event.target.value;
                              setBuilderFilters(list);
                            }} />
                            <button className="btn btn-neutral btn-sm" onClick={() => setBuilderFilters(builderFilters.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                          </div>
                        ))}
                        <button className="btn btn-neutral btn-sm" style={{ width: 'fit-content' }} onClick={() => setBuilderFilters([...builderFilters, { field: '', operator: 'EQUALS', value: '' }])}>Add Filter</button>
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-sm" disabled={builderRunning} onClick={runBuilderQuery}>
                    {builderRunning ? 'Running...' : 'Run Query'}
                  </button>

                  <div style={{ marginTop: '1rem' }}>
                    <SimpleTable columns={builderCols} rows={builderResult} empty="Run a query to view matching records." />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: '1rem', color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.55 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function SimpleTable({ columns, rows, empty }: { columns: string[]; rows: any[]; empty: string }) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: columns.length > 4 ? '720px' : '420px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
            {columns.map((column) => (
              <th key={column} style={{ color: 'var(--text-secondary)', padding: '0.55rem', textAlign: 'left', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                {column.replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>{empty}</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={index} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
              {columns.map((column) => (
                <td key={column} style={{ color: 'var(--text-secondary)', padding: '0.52rem', verticalAlign: 'top', maxWidth: '260px', wordBreak: 'break-word' }}>
                  {row[column] === null || row[column] === undefined ? 'NA' : row[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
