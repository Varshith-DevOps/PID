/**
 * Compliance and Audit Report Center.
 * Provides India-focused statutory, internal, and external audit pack metadata,
 * operational readiness checks, audit trail extracts, and XLSX evidence exports.
 */

const ExcelJS = require('exceljs');
const prisma = require('../config/database');

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const currentFinancialYear = () => {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const fiscalYearRange = (financialYear) => {
  const match = String(financialYear || currentFinancialYear()).match(/^(\d{4})-(\d{2}|\d{4})$/);
  const startYear = match ? parseInt(match[1], 10) : new Date().getFullYear();
  return {
    start: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0)),
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59)),
  };
};

const monthRange = (month, year) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
};

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 10000) / 100 : 100);

const currency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const AUDIT_REPORT_CATALOG = [
  {
    id: 'monthly-statutory-pack',
    name: 'Monthly Statutory Compliance Pack',
    category: 'STATUTORY',
    audience: 'External auditor, labour consultant, finance, HR head',
    frequency: 'MONTHLY',
    riskLevel: 'CRITICAL',
    laws: ['EPF Act', 'ESI Act', 'Professional Tax', 'Labour Welfare Fund', 'Payment of Wages'],
    reports: ['EPF register', 'ESIC register', 'PT/LWF deductions', 'minimum wage exception list', 'payroll register'],
    evidence: ['approved payroll run', 'ECR/ESIC export metadata', 'bank payment proof', 'compliance obligation status'],
  },
  {
    id: 'annual-payroll-tax-pack',
    name: 'Annual Payroll and Tax Audit Pack',
    category: 'STATUTORY',
    audience: 'External auditor, finance, tax consultant',
    frequency: 'ANNUAL',
    riskLevel: 'CRITICAL',
    laws: ['Income Tax Act', 'Form 16', 'TDS', 'Bonus Act', 'Gratuity Act'],
    reports: ['Form 16 generation status', 'TDS ledger summary', 'payroll register', 'bonus/gratuity readiness'],
    evidence: ['Form 16 PDFs', 'TDS ledger', 'salary revision history', 'final settlement records'],
  },
  {
    id: 'labour-inspection-pack',
    name: 'Labour Inspection Readiness Pack',
    category: 'EXTERNAL_AUDIT',
    audience: 'Labour inspector, compliance officer, HR admin',
    frequency: 'QUARTERLY',
    riskLevel: 'HIGH',
    laws: ['Shops and Establishments', 'Minimum Wages', 'Maternity Benefit', 'POSH', 'Equal Remuneration'],
    reports: ['muster roll', 'wage register', 'attendance exceptions', 'POSH summary', 'gender pay gap'],
    evidence: ['attendance records', 'leave records', 'training completion', 'policy documents'],
  },
  {
    id: 'internal-hr-audit-pack',
    name: 'Internal HR Control Audit Pack',
    category: 'INTERNAL_AUDIT',
    audience: 'HR head, internal auditor, management',
    frequency: 'MONTHLY',
    riskLevel: 'HIGH',
    laws: ['Company HR policies', 'data privacy controls', 'approval matrix'],
    reports: ['employee master completeness', 'leave controls', 'attendance regularization', 'asset custody', 'expense approvals'],
    evidence: ['change history', 'workflow status', 'approval timestamps', 'document register'],
  },
  {
    id: 'access-security-audit-pack',
    name: 'Access and Sensitive Data Audit Pack',
    category: 'INTERNAL_AUDIT',
    audience: 'IT admin, security auditor, HR admin',
    frequency: 'MONTHLY',
    riskLevel: 'CRITICAL',
    laws: ['privacy controls', 'role based access policy', 'audit trail policy'],
    reports: ['role permission matrix', 'privileged user list', 'audit log extracts', 'salary data access control'],
    evidence: ['permission grants', 'audit logs', 'payroll audit logs', 'inactive user report'],
  },
  {
    id: 'board-workforce-governance-pack',
    name: 'Board Workforce Governance Pack',
    category: 'MANAGEMENT',
    audience: 'CXO, board, department heads',
    frequency: 'QUARTERLY',
    riskLevel: 'MEDIUM',
    laws: ['management reporting', 'ESG/D&I governance'],
    reports: ['headcount', 'attrition', 'diversity', 'gender pay gap', 'cost by department'],
    evidence: ['employee master snapshot', 'payroll cost summary', 'performance cycle status'],
  },
];

const buildAuditSnapshot = async ({ month, year, financialYear }) => {
  const { start: monthStart, end: monthEnd } = monthRange(month, year);
  const { start: fyStart, end: fyEnd } = fiscalYearRange(financialYear);

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    employees,
    salaryStructureCount,
    bankCount,
    pfCount,
    esiEligible,
    esiCovered,
    payrollRun,
    approvedLeaves,
    pendingLeaves,
    attendanceExceptions,
    overtimePending,
    expensePending,
    assetsAssigned,
    documentsCount,
    form16Reports,
    generatedReports,
    obligations,
    auditLogs,
    payrollAuditLogs,
    privilegedUsers,
    inactiveUsers,
    poshCourses,
    poshCompleted,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: false } }),
    prisma.employee.findMany({
      where: { isActive: true },
      include: {
        department: true,
        salaryStructure: true,
        bankDetails: true,
        pfDetails: true,
        workLocation: true,
        branch: true,
        exitDetails: true,
      },
    }),
    prisma.salaryStructure.count({ where: { employee: { isActive: true } } }),
    prisma.bankDetails.count({ where: { employee: { isActive: true } } }),
    prisma.pFDetails.count({ where: { uanNumber: { not: null }, employee: { isActive: true } } }),
    prisma.employee.count({ where: { isActive: true, salary: { lte: 21000 } } }),
    prisma.employee.count({
      where: {
        isActive: true,
        salary: { lte: 21000 },
        OR: [
          { esicNumber: { not: null, not: '' } },
          { pfDetails: { esiNumber: { not: null, not: '' } } },
        ],
      },
    }),
    prisma.payrollRun.findFirst({
      where: { month, year },
      include: { records: { include: { employee: { include: { department: true } } } } },
    }),
    prisma.leave.count({ where: { status: 'APPROVED', startDate: { gte: monthStart, lte: monthEnd } } }),
    prisma.leave.count({ where: { status: 'PENDING' } }),
    prisma.attendance.count({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        OR: [{ status: { in: ['ABSENT', 'HALF_DAY'] } }, { lateMinutes: { gt: 0 } }, { checkOut: null }],
      },
    }),
    prisma.overtime.count({ where: { status: 'PENDING' } }),
    prisma.expenseClaim.count({ where: { status: { in: ['PENDING', 'APPROVED_BY_MANAGER'] } } }),
    prisma.asset.count({ where: { status: 'ASSIGNED' } }),
    prisma.document.count(),
    prisma.complianceReport.count({ where: { type: 'FORM16', financialYear } }),
    prisma.complianceReport.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.complianceObligation.findMany({ orderBy: { dueDate: 'asc' }, take: 50 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.payrollAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS', 'PAYROLL_REVIEWER', 'PAYROLL_APPROVER'] }, isActive: true },
      select: { id: true, email: true, name: true, role: true },
      take: 100,
    }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.learningEnrollment.count({ where: { course: { title: { contains: 'POSH' } } } }),
    prisma.learningEnrollment.count({ where: { course: { title: { contains: 'POSH' } }, status: 'COMPLETED' } }),
  ]);

  const totalGross = payrollRun?.records?.reduce((sum, record) => sum + Number(record.grossEarnings || 0), 0) || 0;
  const totalNet = payrollRun?.records?.reduce((sum, record) => sum + Number(record.netSalary || 0), 0) || 0;
  const totalPf = payrollRun?.records?.reduce((sum, record) => sum + Number(record.pf || 0), 0) || 0;
  const totalEsi = payrollRun?.records?.reduce((sum, record) => sum + Number(record.esi || 0), 0) || 0;
  const totalTds = payrollRun?.records?.reduce((sum, record) => sum + Number(record.tax || 0), 0) || 0;
  const totalPt = payrollRun?.records?.reduce((sum, record) => sum + Number(record.professionalTax || 0), 0) || 0;
  const totalLwf = payrollRun?.records?.reduce((sum, record) => sum + Number(record.lwfEmployee || 0) + Number(record.lwfEmployer || 0), 0) || 0;

  const female = employees.filter((employee) => employee.gender === 'FEMALE').length;
  const male = employees.filter((employee) => employee.gender === 'MALE').length;
  const employeeMasterCompleteness = pct(
    employees.filter((employee) => employee.dateOfBirth && employee.gender && employee.departmentId && employee.joinDate && employee.salary > 0).length,
    activeEmployees,
  );

  const statutoryChecks = [
    { code: 'PAYROLL_RUN', label: 'Monthly payroll run exists', status: payrollRun ? payrollRun.status : 'MISSING', severity: payrollRun ? 'LOW' : 'CRITICAL' },
    { code: 'PF_UAN', label: 'Active employees with UAN/PF details', status: `${pct(pfCount, activeEmployees)}%`, severity: pfCount === activeEmployees ? 'LOW' : 'HIGH' },
    { code: 'ESI_COVERAGE', label: 'ESI eligible employees covered', status: `${pct(esiCovered, esiEligible)}%`, severity: esiCovered === esiEligible ? 'LOW' : 'HIGH' },
    { code: 'BANK_DETAILS', label: 'Active employees with bank details', status: `${pct(bankCount, activeEmployees)}%`, severity: bankCount === activeEmployees ? 'LOW' : 'CRITICAL' },
    { code: 'SALARY_STRUCTURE', label: 'Active employees with salary structure', status: `${pct(salaryStructureCount, activeEmployees)}%`, severity: salaryStructureCount === activeEmployees ? 'LOW' : 'HIGH' },
    { code: 'FORM16', label: 'Form 16 generated for financial year', status: `${form16Reports} reports`, severity: form16Reports >= activeEmployees ? 'LOW' : 'MEDIUM' },
    { code: 'POSH_TRAINING', label: 'POSH training completion', status: `${pct(poshCompleted, poshCourses)}%`, severity: poshCourses === 0 || poshCompleted < poshCourses ? 'MEDIUM' : 'LOW' },
  ];

  const riskItems = [
    ...statutoryChecks.filter((check) => check.severity !== 'LOW'),
    ...(pendingLeaves ? [{ code: 'PENDING_LEAVES', label: 'Pending leave approvals', status: pendingLeaves, severity: 'MEDIUM' }] : []),
    ...(attendanceExceptions ? [{ code: 'ATTENDANCE_EXCEPTIONS', label: 'Attendance exceptions for period', status: attendanceExceptions, severity: 'HIGH' }] : []),
    ...(overtimePending ? [{ code: 'PENDING_OVERTIME', label: 'Pending overtime approvals', status: overtimePending, severity: 'MEDIUM' }] : []),
    ...(expensePending ? [{ code: 'PENDING_EXPENSES', label: 'Pending finance/manager claims', status: expensePending, severity: 'MEDIUM' }] : []),
    ...(inactiveUsers ? [{ code: 'INACTIVE_USERS', label: 'Inactive user accounts retained', status: inactiveUsers, severity: 'MEDIUM' }] : []),
  ];

  return {
    period: { month, year, financialYear, monthStart, monthEnd, fyStart, fyEnd },
    summary: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      payrollStatus: payrollRun?.status || 'NOT_RUN',
      payrollEmployeeCount: payrollRun?.records?.length || 0,
      totalGross: currency(totalGross),
      totalNet: currency(totalNet),
      totalPf: currency(totalPf),
      totalEsi: currency(totalEsi),
      totalTds: currency(totalTds),
      totalPt: currency(totalPt),
      totalLwf: currency(totalLwf),
      genderDiversityPercent: pct(female, activeEmployees),
      maleEmployees: male,
      femaleEmployees: female,
      employeeMasterCompleteness,
      pendingObligations: obligations.filter((item) => ['OPEN', 'PENDING'].includes(item.status)).length,
      overdueObligations: obligations.filter((item) => ['OPEN', 'PENDING'].includes(item.status) && new Date(item.dueDate) < new Date()).length,
      riskItems: riskItems.length,
    },
    statutoryChecks,
    riskItems,
    operationalControls: [
      { area: 'Leave', metric: 'Approved leaves in period', value: approvedLeaves },
      { area: 'Leave', metric: 'Pending leave approvals', value: pendingLeaves },
      { area: 'Attendance', metric: 'Attendance exception rows', value: attendanceExceptions },
      { area: 'Overtime', metric: 'Pending overtime approvals', value: overtimePending },
      { area: 'Expenses', metric: 'Pending expense claims', value: expensePending },
      { area: 'Assets', metric: 'Assets currently assigned', value: assetsAssigned },
      { area: 'Documents', metric: 'Employee documents stored', value: documentsCount },
    ],
    generatedReports,
    obligations,
    auditLogs,
    payrollAuditLogs,
    privilegedUsers,
  };
};

const addRowsSheet = (workbook, title, rows) => {
  const sheet = workbook.addWorksheet(title.slice(0, 31));
  if (!rows.length) {
    sheet.addRow(['No records']);
    return sheet;
  }

  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, Math.min(32, header.length + 4)),
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
};

const buildAuditWorkbook = async (snapshot, packType) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PID hcms Compliance and Audit Report Center';
  workbook.created = new Date();

  addRowsSheet(workbook, 'Executive Summary', [
    { metric: 'Pack Type', value: packType },
    { metric: 'Month', value: snapshot.period.month },
    { metric: 'Year', value: snapshot.period.year },
    { metric: 'Financial Year', value: snapshot.period.financialYear },
    ...Object.entries(snapshot.summary).map(([metric, value]) => ({ metric, value })),
  ]);

  addRowsSheet(workbook, 'Statutory Readiness', snapshot.statutoryChecks);
  addRowsSheet(workbook, 'Risk Exceptions', snapshot.riskItems);
  addRowsSheet(workbook, 'Operational Controls', snapshot.operationalControls);
  addRowsSheet(workbook, 'Compliance Obligations', snapshot.obligations.map((item) => ({
    name: item.name,
    obligationType: item.obligationType,
    dueDate: item.dueDate,
    status: item.status,
    riskLevel: item.riskLevel,
    ownerRole: item.ownerRole || '',
  })));
  addRowsSheet(workbook, 'Generated Reports', snapshot.generatedReports.map((item) => ({
    type: item.type,
    status: item.status,
    month: item.month || '',
    year: item.year || '',
    financialYear: item.financialYear || '',
    generatedBy: item.generatedBy,
    createdAt: item.createdAt,
  })));
  addRowsSheet(workbook, 'Privileged Users', snapshot.privilegedUsers.map((user) => ({
    name: user.name,
    email: user.email,
    role: user.role,
  })));
  addRowsSheet(workbook, 'Audit Logs', snapshot.auditLogs.map((log) => ({
    createdAt: log.createdAt,
    userEmail: log.userEmail || '',
    action: log.action,
    entity: log.entity,
    entityId: log.entityId || '',
    ipAddress: log.ipAddress || '',
  })));
  addRowsSheet(workbook, 'Payroll Audit Logs', snapshot.payrollAuditLogs.map((log) => ({
    createdAt: log.createdAt,
    userEmail: log.userEmail,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId || '',
    ipAddress: log.ipAddress || '',
  })));

  return workbook;
};

const getAuditReportCatalog = async (req, res) => {
  res.json({ data: AUDIT_REPORT_CATALOG });
};

const getAuditReportCenter = async (req, res) => {
  try {
    const now = new Date();
    const month = toInt(req.query.month, now.getMonth() + 1);
    const year = toInt(req.query.year, now.getFullYear());
    const financialYear = req.query.financialYear || currentFinancialYear();

    const snapshot = await buildAuditSnapshot({ month, year, financialYear });
    res.json({
      catalog: AUDIT_REPORT_CATALOG,
      ...snapshot,
    });
  } catch (error) {
    console.error('[AUDIT REPORT CENTER ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to load audit report center' });
  }
};

const generateAuditPack = async (req, res) => {
  try {
    const now = new Date();
    const packType = req.body.packType || 'monthly-statutory-pack';
    const month = toInt(req.body.month, now.getMonth() + 1);
    const year = toInt(req.body.year, now.getFullYear());
    const financialYear = req.body.financialYear || currentFinancialYear();

    if (!AUDIT_REPORT_CATALOG.some((pack) => pack.id === packType)) {
      return res.status(400).json({ error: 'Unsupported audit pack type' });
    }

    const snapshot = await buildAuditSnapshot({ month, year, financialYear });
    const status = snapshot.riskItems.some((item) => item.severity === 'CRITICAL') ? 'ATTENTION_REQUIRED' : 'GENERATED';

    const report = await prisma.complianceReport.create({
      data: {
        type: `AUDIT_PACK_${packType.toUpperCase().replace(/-/g, '_')}`,
        status,
        month,
        year,
        financialYear,
        generatedBy: req.user?.email || req.user?.id || 'system',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        action: 'AUDIT_PACK_GENERATED',
        entity: 'ComplianceReport',
        entityId: report.id,
        newDetails: JSON.stringify({ packType, month, year, financialYear, status, riskItems: snapshot.riskItems.length }),
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ report, snapshot });
  } catch (error) {
    console.error('[AUDIT PACK GENERATE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to generate audit pack' });
  }
};

const updateAuditPackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const allowedStatuses = new Set(['GENERATED', 'UNDER_REVIEW', 'SIGNED_OFF', 'REJECTED', 'ATTENTION_REQUIRED']);

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'Invalid audit pack status' });
    }

    const existing = await prisma.complianceReport.findUnique({ where: { id } });
    if (!existing || !existing.type.startsWith('AUDIT_PACK_')) {
      return res.status(404).json({ error: 'Audit pack not found' });
    }

    const updated = await prisma.complianceReport.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        action: 'AUDIT_PACK_STATUS_CHANGED',
        entity: 'ComplianceReport',
        entityId: id,
        oldDetails: JSON.stringify({ status: existing.status }),
        newDetails: JSON.stringify({ status, remarks: remarks || null }),
        ipAddress: req.ip,
      },
    });

    res.json({ report: updated });
  } catch (error) {
    console.error('[AUDIT PACK STATUS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update audit pack status' });
  }
};

const exportAuditPack = async (req, res) => {
  try {
    const now = new Date();
    const packType = req.body.packType || req.query.packType || 'monthly-statutory-pack';
    const month = toInt(req.body.month || req.query.month, now.getMonth() + 1);
    const year = toInt(req.body.year || req.query.year, now.getFullYear());
    const financialYear = req.body.financialYear || req.query.financialYear || currentFinancialYear();

    if (!AUDIT_REPORT_CATALOG.some((pack) => pack.id === packType)) {
      return res.status(400).json({ error: 'Unsupported audit pack type' });
    }

    const snapshot = await buildAuditSnapshot({ month, year, financialYear });
    const workbook = await buildAuditWorkbook(snapshot, packType);

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
        action: 'AUDIT_PACK_EXPORTED',
        entity: 'AuditReportCenter',
        newDetails: JSON.stringify({ packType, month, year, financialYear }),
        ipAddress: req.ip,
      },
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=audit-pack-${packType}-${month}-${year}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[AUDIT PACK EXPORT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to export audit pack' });
  }
};

module.exports = {
  getAuditReportCatalog,
  getAuditReportCenter,
  generateAuditPack,
  updateAuditPackStatus,
  exportAuditPack,
};
