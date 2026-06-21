const prisma = require('../config/database');

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const HR_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR']);
const PAYROLL_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR', 'FINANCE', 'ACCOUNTS', 'PAYROLL_REVIEWER', 'PAYROLL_APPROVER']);
const MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER']);

const hasAnyRole = (user, roles) => Boolean(user?.role && roles.has(user.role));
const isAdmin = (user) => hasAnyRole(user, ADMIN_ROLES);
const isHr = (user) => hasAnyRole(user, HR_ROLES);
const isPayroll = (user) => hasAnyRole(user, PAYROLL_ROLES);
const isManagerOrAdmin = (user) => hasAnyRole(user, MANAGER_ROLES);

const getLinkedEmployeeId = async (user) => {
  if (!user?.id) return null;
  if (user.employeeId) return user.employeeId;
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  return employee?.id || null;
};

/**
 * True if the employee exists *within the caller's tenant*.
 *
 * The Prisma client extension (config/database.js) scopes Employee queries by the
 * caller's companyId via AsyncLocalStorage, so a cross-tenant employeeId resolves
 * to null here and is denied. A platform SUPER_ADMIN has no companyId and is
 * intentionally left unscoped (can act across tenants).
 */
const employeeInTenant = async (employeeId) => {
  if (!employeeId) return false;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  return Boolean(employee);
};

const canAccessEmployee = async (user, employeeId) => {
  if (!employeeId) return false;

  // Privileged roles may act on employees, but ONLY inside their own company.
  // Previously this returned true unconditionally, which allowed cross-tenant
  // IDOR (e.g. reading another company's payslips by id). Now we confirm the
  // target employee is in the caller's tenant.
  if (isHr(user) || isPayroll(user)) {
    return employeeInTenant(employeeId);
  }

  const ownEmployeeId = await getLinkedEmployeeId(user);
  if (ownEmployeeId === employeeId) return true;

  if (user?.role === 'MANAGER') {
    const scopeIds = await getEmployeeScopeIds(user);
    return scopeIds.includes(employeeId);
  }

  return false;
};

const getEmployeeScopeIds = async (user, { includeReports = true } = {}) => {
  const ownEmployeeId = await getLinkedEmployeeId(user);
  const ids = ownEmployeeId ? [ownEmployeeId] : [];

  if (includeReports && user?.role === 'MANAGER' && ownEmployeeId) {
    let currentIds = [ownEmployeeId];
    let allReportIds = [];
    let depth = 0;
    while (currentIds.length > 0 && depth < 10) {
      const reports = await prisma.employee.findMany({
        where: { managerId: { in: currentIds } },
        select: { id: true },
      });
      currentIds = reports.map((emp) => emp.id);
      if (currentIds.length === 0) break;
      allReportIds.push(...currentIds);
      depth++;
    }
    ids.push(...allReportIds);
  }

  return ids;
};

const isDirectManagerOf = async (user, employeeId) => {
  if (!employeeId || user?.role !== 'MANAGER') return false;
  const ownEmployeeId = await getLinkedEmployeeId(user);
  if (!ownEmployeeId) return false;

  const target = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });

  return target?.managerId === ownEmployeeId;
};

const canApproveEmployeeWorkflow = async (user, employeeId) => {
  if (!employeeId) return false;
  // Approval rights still require the target to be in the caller's tenant.
  // canAccessEmployee already enforces the company boundary for HR/Admin/Payroll.
  return canAccessEmployee(user, employeeId);
};

module.exports = {
  ADMIN_ROLES,
  HR_ROLES,
  PAYROLL_ROLES,
  MANAGER_ROLES,
  hasAnyRole,
  isAdmin,
  isHr,
  isPayroll,
  isManagerOrAdmin,
  getLinkedEmployeeId,
  canAccessEmployee,
  employeeInTenant,
  getEmployeeScopeIds,
  isDirectManagerOf,
  canApproveEmployeeWorkflow,
};
