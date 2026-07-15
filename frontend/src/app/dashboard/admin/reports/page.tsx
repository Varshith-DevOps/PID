'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  KpiBar,
  KpiPie,
  PageHeader,
  Select,
  SkeletonTable,
  StatCard,
  StatusChip,
  Tabs,
} from '@/components/ui';
import type { Column } from '@/components/ui';

type TabType = 'center' | 'statutory' | 'internal' | 'builder';
type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type Row = Record<string, unknown>;

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

const FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
];

const BUILDER_COLUMNS = [
  'employeeId', 'firstName', 'lastName', 'email', 'gender',
  'jobTitle', 'department', 'location', 'employmentType', 'salary',
];

const FILTER_FIELD_OPTIONS = [
  { value: '', label: 'Field' },
  { value: 'gender', label: 'Gender' },
  { value: 'department', label: 'Department' },
  { value: 'location', label: 'Location' },
  { value: 'employmentType', label: 'Employment Type' },
  { value: 'age', label: 'Age' },
  { value: 'experience', label: 'Experience' },
];

const FILTER_OPERATOR_OPTIONS = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'GREATER_THAN', label: 'Greater Than' },
  { value: 'LESS_THAN', label: 'Less Than' },
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

const MONTH_OPTIONS = Array.from({ length: 12 }).map((_, index) => ({
  value: String(index + 1),
  label: monthName(index + 1),
}));

const money = (value: any) => {
  if (typeof value !== 'number') return value ?? 'NA';
  return `INR ${value.toLocaleString('en-IN')}`;
};

/** Maps a status/severity string onto a Badge tone (color is never the only signal — Badge dots + text). */
const statusTone = (status: string): 'success' | 'warning' | 'danger' => {
  if (['LOW', 'GENERATED', 'SIGNED_OFF', 'APPROVED', 'COMPLIANT'].includes(status)) return 'success';
  if (['MEDIUM', 'UNDER_REVIEW', 'ATTENTION_REQUIRED', 'PENDING'].includes(status)) return 'warning';
  return 'danger';
};

const StatusBadge = ({ value }: { value: string }) => (
  <Badge tone={statusTone(value)} dot>{value}</Badge>
);

/** Column helper: capitalize key into a header label, matching the old SimpleTable behavior. */
const labelize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const cell = (value: unknown): React.ReactNode =>
  value === null || value === undefined ? 'NA' : (value as React.ReactNode);

const textColumns = (keys: string[]): Column<Row>[] =>
  keys.map((key) => ({ key, header: labelize(key), render: (row) => cell(row[key]) }));

export default function ReportsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabType>('center');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  const [statusPrompt, setStatusPrompt] = useState<{ id: string; status: string } | null>(null);

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
      setLoadError(false);
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
      setLoadError(true);
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

  const handleStatus = async (id: string, status: string, remarks?: string) => {
    try {
      setActionLoading(true);
      await updateAuditPackStatus(id, { status, remarks: remarks || `Marked ${status} from Audit Report Center` });
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
    return (
      <div className="app-layout">
        <Sidebar activePath="/dashboard/admin/reports" />
        <main className="main-content">
          <Card padded><SkeletonTable rows={3} cols={4} /></Card>
        </main>
      </div>
    );
  }

  const summary = center?.summary || {};

  // Turn enum-style values (e.g. NOT_RUN) into readable labels (e.g. "Not Run").
  const humanize = (v: unknown) =>
    v == null ? 'NA' : String(v).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const statCards: { label: string; value: React.ReactNode }[] = [
    { label: 'Active Headcount', value: String(summary.activeEmployees ?? 'NA') },
    { label: 'Payroll Status', value: humanize(summary.payrollStatus) },
    { label: 'Gross Payroll', value: String(money(summary.totalGross)) },
    { label: 'PF Compliance', value: `${compStats?.pfCompliancePercent ?? 0}%` },
    { label: 'ESI Compliance', value: `${compStats?.esiCompliancePercent ?? 0}%` },
    { label: 'Risk Exceptions', value: String(summary.riskItems ?? 'NA') },
    { label: 'Overdue Obligations', value: String(summary.overdueObligations ?? 'NA') },
    { label: 'Master Completeness', value: `${summary.employeeMasterCompleteness ?? 0}%` },
  ];

  // ---- Column definitions (logic-preserving renders) ----
  const auditRunRows: Row[] = (center?.generatedReports || [])
    .filter((row: any) => row.type?.startsWith('AUDIT_PACK_'));

  const auditRunColumns: Column<Row>[] = [
    { key: 'type', header: 'Type', render: (row) => String((row.type as string).replace('AUDIT_PACK_', '').replaceAll('_', ' ')) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={String(row.status)} /> },
    { key: 'period', header: 'Period', render: (row) => String(row.financialYear || `${row.month || ''}/${row.year || ''}`) },
    { key: 'generatedBy', header: 'Generated By', render: (row) => cell(row.generatedBy) },
    { key: 'createdAt', header: 'Created At', render: (row) => new Date(row.createdAt as string).toLocaleString('en-IN') },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <Button variant="ghost" size="sm" onClick={() => setStatusPrompt({ id: String(row.id), status: 'UNDER_REVIEW' })}>Review</Button>
          <Button variant="primary" size="sm" onClick={() => setStatusPrompt({ id: String(row.id), status: 'SIGNED_OFF' })}>Sign Off</Button>
        </div>
      ),
    },
  ];

  const statutoryCheckColumns: Column<Row>[] = [
    { key: 'code', header: 'Code', render: (row) => cell(row.code) },
    { key: 'label', header: 'Label', render: (row) => cell(row.label) },
    { key: 'status', header: 'Status', render: (row) => cell(row.status) },
    { key: 'severity', header: 'Severity', render: (row) => <StatusBadge value={String(row.severity)} /> },
  ];

  const epfColumns: Column<Row>[] = [
    ...textColumns(['employeeId', 'name', 'uan']),
    { key: 'pfWages', header: 'Pf Wages', render: (row) => String(money(row.pfWages)) },
    { key: 'employeePf', header: 'Employee Pf', render: (row) => String(money(row.employeePf)) },
    { key: 'employerPf', header: 'Employer Pf', render: (row) => String(money(row.employerPf)) },
  ];

  const esiColumns: Column<Row>[] = [
    ...textColumns(['employeeId', 'name', 'esiNumber']),
    { key: 'esiWages', header: 'Esi Wages', render: (row) => String(money(row.esiWages)) },
    { key: 'employeeContribution', header: 'Employee Contribution', render: (row) => String(money(row.employeeContribution)) },
    { key: 'employerContribution', header: 'Employer Contribution', render: (row) => String(money(row.employerContribution)) },
  ];

  const minWageColumns: Column<Row>[] = [
    ...textColumns(['employeeId', 'name', 'state', 'designation']),
    { key: 'currentWage', header: 'Current Wage', render: (row) => String(money(row.currentWage)) },
    { key: 'minimumWage', header: 'Minimum Wage', render: (row) => String(money(row.minimumWage)) },
    { key: 'complianceStatus', header: 'Compliance Status', render: (row) => cell(row.complianceStatus) },
  ];

  const genderGapColumns: Column<Row>[] = [
    { key: 'department', header: 'Department', render: (row) => cell(row.department) },
    { key: 'maleAvgSalary', header: 'Male Avg Salary', render: (row) => String(money(row.maleAvgSalary)) },
    { key: 'femaleAvgSalary', header: 'Female Avg Salary', render: (row) => String(money(row.femaleAvgSalary)) },
    { key: 'genderGapPercent', header: 'Gender Gap Percent', render: (row) => cell(row.genderGapPercent) },
  ];

  const obligationColumns: Column<Row>[] = [
    { key: 'name', header: 'Name', render: (row) => cell(row.name) },
    { key: 'obligationType', header: 'Obligation Type', render: (row) => cell(row.obligationType) },
    { key: 'dueDate', header: 'Due Date', render: (row) => new Date(row.dueDate as string).toLocaleDateString('en-IN') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={String(row.status)} /> },
    { key: 'riskLevel', header: 'Risk Level', render: (row) => <StatusChip status={String(row.riskLevel ?? '')} /> },
    { key: 'ownerRole', header: 'Owner Role', render: (row) => String(row.ownerRole || 'NA') },
  ];

  const auditTrailRows: Row[] = [...(center?.auditLogs || []), ...(center?.payrollAuditLogs || [])].slice(0, 14);
  const auditTrailColumns: Column<Row>[] = [
    { key: 'createdAt', header: 'Created At', render: (row) => new Date(row.createdAt as string).toLocaleString('en-IN') },
    { key: 'userEmail', header: 'User Email', render: (row) => String(row.userEmail || 'system') },
    { key: 'action', header: 'Action', render: (row) => cell(row.action) },
    { key: 'entity', header: 'Entity', render: (row) => cell(row.entity) },
  ];

  const builderColumns: Column<Row>[] = textColumns(builderCols);

  const tabItems = [
    { key: 'center', label: 'Audit Center' },
    { key: 'statutory', label: 'Statutory Reports' },
    { key: 'internal', label: 'Internal Controls' },
    { key: 'builder', label: 'Report Builder' },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
          <PageHeader
            title="Compliance & Audit Report Center"
            subtitle="India statutory packs, internal controls, access review, audit trails, evidence export, and management reporting."
            actions={(
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ width: 140 }}>
                  <Select label="Month" value={String(month)} onChange={(v) => setMonth(Number(v))} options={MONTH_OPTIONS} />
                </div>
                <div style={{ width: 110 }}>
                  <Field label="Year">
                    <input className="input-field" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
                  </Field>
                </div>
                <div style={{ width: 120 }}>
                  <Field label="Financial Year">
                    <input className="input-field" value={financialYear} onChange={(event) => setFinancialYear(event.target.value)} />
                  </Field>
                </div>
                <Button variant="ghost" onClick={loadAll} loading={loading}>Refresh</Button>
              </div>
            )}
          />

          <Card padded style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '200px', alignSelf: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Universal Export</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Choose any report and output format.</div>
              </div>
              <div style={{ width: 260 }}>
                <Select label="Report" value={selectedReport} onChange={setSelectedReport} options={EXPORT_REPORTS} />
              </div>
              <div style={{ width: 140 }}>
                <Select label="Format" value={exportFormat} onChange={(v) => setExportFormat(v as ExportFormat)} options={FORMAT_OPTIONS} />
              </div>
              <Button variant="primary" onClick={handleMasterExport} loading={actionLoading}>Export Report</Button>
            </div>
          </Card>

          {loading ? (
            <Card padded><SkeletonTable rows={6} cols={6} /></Card>
          ) : loadError ? (
            <Card padded>
              <ErrorState
                title="Couldn’t load the audit center"
                message="We couldn’t reach the compliance and audit services. Please try again."
                onRetry={loadAll}
              />
            </Card>
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: '1rem' }}>
                {statCards.map((card) => (
                  <StatCard key={card.label} label={card.label} value={card.value} />
                ))}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <Tabs items={tabItems} value={activeTab} onChange={(key) => setActiveTab(key as TabType)} />
              </div>

              {activeTab === 'center' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '1rem' }}>
                  <Card
                    title="Audit Pack Generator"
                    actions={(
                      <>
                        <Button variant="ghost" size="sm" loading={actionLoading} onClick={handleGeneratePack}>Generate Run</Button>
                        <Button variant="primary" size="sm" loading={actionLoading} onClick={handleExportPack}>Export XLSX Pack</Button>
                      </>
                    )}
                  >
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '-0.5rem 0 0.85rem' }}>
                      Generate monthly, quarterly, annual, internal, and external audit evidence packs.
                    </p>

                    <Select
                      value={selectedPack}
                      onChange={setSelectedPack}
                      options={(center?.catalog || []).map((pack: any) => ({ value: pack.id, label: pack.name }))}
                    />

                    {selectedPackMeta && (
                      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.9rem', margin: '0.5rem 0 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <Badge tone="compliance">{selectedPackMeta.category}</Badge>
                          <Badge tone="warning">{selectedPackMeta.frequency}</Badge>
                          <Badge tone="risk">{selectedPackMeta.riskLevel}</Badge>
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{selectedPackMeta.name}</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', lineHeight: 1.5 }}>{selectedPackMeta.audience}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <ListBlock title="Laws / Controls" items={selectedPackMeta.laws} />
                          <ListBlock title="Reports" items={selectedPackMeta.reports} />
                          <ListBlock title="Evidence" items={selectedPackMeta.evidence} />
                        </div>
                      </div>
                    )}

                    <h3 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: '0 0 0.6rem' }}>Generated Runs</h3>
                    <DataTable
                      columns={auditRunColumns}
                      rows={auditRunRows}
                      rowKey={(row) => String(row.id)}
                      empty={<EmptyState title="No audit packs yet" message="No audit packs generated yet." />}
                    />
                  </Card>

                  <Card title="Risk Register">
                    <div style={{ marginBottom: '1rem' }}>
                      <KpiBar
                        data={riskChart}
                        xKey="severity"
                        bars={[{ key: 'count', name: 'Exceptions', color: 'var(--risk-fg)' }]}
                        height={190}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {(center?.riskItems || []).slice(0, 8).map((item: any) => (
                        <div key={item.code} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 700 }}>{item.label}</span>
                            <Badge tone={statusTone(item.severity)} dot>{item.severity}</Badge>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.25rem' }}>Status: {String(item.status)}</div>
                        </div>
                      ))}
                      {(center?.riskItems || []).length === 0 && (
                        <EmptyState title="No open risk exceptions" message="No open risk exceptions for this period." />
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === 'statutory' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem' }}>
                  <Card title="Statutory Readiness Checks">
                    <DataTable
                      columns={statutoryCheckColumns}
                      rows={(center?.statutoryChecks || []) as Row[]}
                      empty={<EmptyState title="No statutory checks" message="No statutory checks available." />}
                    />
                  </Card>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                    <Card title="EPF Register">
                      <DataTable
                        columns={epfColumns}
                        rows={epfData.slice(0, 12) as Row[]}
                        empty={<EmptyState title="No EPF rows" message="No EPF rows found." />}
                      />
                    </Card>
                    <Card title="ESIC Register">
                      <DataTable
                        columns={esiColumns}
                        rows={esiData.slice(0, 12) as Row[]}
                        empty={<EmptyState title="No ESIC rows" message="No ESIC rows found." />}
                      />
                    </Card>
                    <Card title="Minimum Wage Exceptions">
                      <DataTable
                        columns={minWageColumns}
                        rows={minWageData as Row[]}
                        empty={<EmptyState title="No minimum wage records" message="No minimum wage records found." />}
                      />
                    </Card>
                    <Card title="Diversity and Pay Gap">
                      {diversityData.length > 0 ? (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <KpiPie data={diversityData} dataKey="count" nameKey="gender" height={230} />
                        </div>
                      ) : (
                        <EmptyState title="No diversity data" message="No diversity data available." />
                      )}
                      <DataTable
                        columns={genderGapColumns}
                        rows={genderGapData as Row[]}
                        empty={<EmptyState title="No pay gap rows" message="No pay gap rows found." />}
                      />
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'internal' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 0.8fr)', gap: '1rem' }}>
                  <Card title="Operational Control Evidence">
                    <DataTable
                      columns={textColumns(['area', 'metric', 'value'])}
                      rows={(center?.operationalControls || []) as Row[]}
                      empty={<EmptyState title="No controls" message="No controls available." />}
                    />

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: '1.25rem 0 0.75rem' }}>Compliance Obligations Calendar</h2>
                    <DataTable
                      columns={obligationColumns}
                      rows={(center?.obligations || []) as Row[]}
                      empty={<EmptyState title="No obligations" message="No compliance obligations configured." />}
                    />
                  </Card>

                  <Card title="Access Review">
                    <DataTable
                      columns={textColumns(['name', 'email', 'role'])}
                      rows={((center?.privilegedUsers || []) as Row[]).slice(0, 12)}
                      empty={<EmptyState title="No privileged users" message="No privileged users found." />}
                    />

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1rem', margin: '1.25rem 0 0.75rem' }}>Recent Audit Trail</h2>
                    <DataTable
                      columns={auditTrailColumns}
                      rows={auditTrailRows}
                      empty={<EmptyState title="No audit logs" message="No audit logs available." />}
                    />
                  </Card>
                </div>
              )}

              {activeTab === 'builder' && (
                <Card title="Ad-Hoc Employee Report Builder">
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Output Columns</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem', marginTop: '0.5rem' }}>
                        {BUILDER_COLUMNS.map((column) => (
                          <Checkbox
                            key={column}
                            label={column}
                            checked={builderCols.includes(column)}
                            onChange={(checked) => setBuilderCols(checked ? [...builderCols, column] : builderCols.filter((item) => item !== column))}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Filters</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
                        {builderFilters.map((filter, index) => (
                          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.35rem', alignItems: 'center' }}>
                            <select className="select-field" value={filter.field} onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].field = event.target.value;
                              setBuilderFilters(list);
                            }}>
                              {FILTER_FIELD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            <select className="select-field" value={filter.operator} onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].operator = event.target.value;
                              setBuilderFilters(list);
                            }}>
                              {FILTER_OPERATOR_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                            <input className="input-field" value={filter.value} placeholder="Value" onChange={(event) => {
                              const list = [...builderFilters];
                              list[index].value = event.target.value;
                              setBuilderFilters(list);
                            }} />
                            <Button variant="ghost" size="sm" onClick={() => setBuilderFilters(builderFilters.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" style={{ width: 'fit-content' }} onClick={() => setBuilderFilters([...builderFilters, { field: '', operator: 'EQUALS', value: '' }])}>Add Filter</Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="primary" size="sm" loading={builderRunning} onClick={runBuilderQuery}>Run Query</Button>

                  <div style={{ marginTop: '1rem' }}>
                    <DataTable
                      columns={builderColumns}
                      rows={builderResult as Row[]}
                      empty={<EmptyState title="No results" message="Run a query to view matching records." />}
                    />
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!statusPrompt}
        title={statusPrompt?.status === 'SIGNED_OFF' ? 'Sign off audit pack' : 'Mark under review'}
        message={statusPrompt?.status === 'SIGNED_OFF'
          ? 'Record your sign-off on this audit pack. This adds your remarks to the audit trail.'
          : 'Move this audit pack into review. Add remarks for the audit trail.'}
        confirmLabel={statusPrompt?.status === 'SIGNED_OFF' ? 'Sign Off' : 'Mark Under Review'}
        requireReason
        reasonLabel="Remarks"
        loading={actionLoading}
        onCancel={() => setStatusPrompt(null)}
        onConfirm={async (reason) => {
          if (!statusPrompt) return;
          const { id, status } = statusPrompt;
          setStatusPrompt(null);
          await handleStatus(id, status, reason);
        }}
      />
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
