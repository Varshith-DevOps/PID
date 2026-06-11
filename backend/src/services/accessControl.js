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

const canAccessEmployee = async (user, employeeId) => {
  if (!employeeId) return false;
  if (isHr(user) || isPayroll(user)) return true;

  const ownEmployeeId = await getLinkedEmployeeId(user);
  if (ownEmployeeId === employeeId) return true;

  if (user?.role === 'MANAGER') {
    const target = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    });
    return target?.managerId === ownEmployeeId;
  }

  return false;
};

const getEmployeeScopeIds = async (user, { includeReports = true } = {}) => {
  const ownEmployeeId = await getLinkedEmployeeId(user);
  const ids = ownEmployeeId ? [ownEmployeeId] : [];

  if (includeReports && user?.role === 'MANAGER' && ownEmployeeId) {
    const reports = await prisma.employee.findMany({
      where: { managerId: ownEmployeeId },
      select: { id: true },
    });
    ids.push(...reports.map((employee) => employee.id));
  }

  return ids;
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
  getEmployeeScopeIds,
};
