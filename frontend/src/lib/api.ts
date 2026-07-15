/**
 * @fileoverview Axios API client and request services.
 * Centralizes all frontend network requests to the HRMS backend API.
 * Uses backend-issued HttpOnly cookies and CSRF headers for browser sessions.
 * @module lib/api
 */

import axios from 'axios';
import { getActionErrorMessage, getActionSuccessMessage } from './userMessages';

type Listener<T> = (data: T) => void;

class ApiEventEmitter {
  private listeners: { [key: string]: Listener<any>[] } = {};

  on<T>(event: string, callback: Listener<T>) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit<T>(event: string, data: T) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}

export const apiEvents = new ApiEventEmitter();

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
  // Send the httpOnly refresh cookie on cross-origin auth calls.
  withCredentials: true,
});

// Single in-flight refresh shared across concurrent 401s.
let refreshPromise: Promise<boolean> | null = null;
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', {}, { headers: { 'x-skip-refresh': '1' } })
      .then((res) => Boolean(res.data?.token))
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.request.use(
  (config) => {
    apiEvents.emit('request-start', config.url || '');
    if (typeof window !== 'undefined') {
      // Double-submit CSRF: echo the readable csrfToken cookie on mutations.
      const method = (config.method || 'get').toLowerCase();
      if (['post', 'put', 'patch', 'delete'].includes(method)) {
        const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
        if (match) config.headers['x-csrf-token'] = decodeURIComponent(match[1]);
      }
      // Support staff "view as tenant": scope read-only requests to the selected
      // customer. The backend only honours this header for SUPPORT-role accounts.
      const viewCompany = localStorage.getItem('pid_support_company_id');
      if (viewCompany) config.headers['x-support-company-id'] = viewCompany;
      // Workspace binding: tell the API which tenant subdomain this browser is on
      // ('__apex__' for the owner/apex host). Used to bind login to the workspace.
      const host = window.location.hostname.toLowerCase();
      const base = (process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost').toLowerCase();
      let sub = '__apex__';
      if (host !== base && host.endsWith('.' + base)) {
        sub = host.slice(0, host.length - (base.length + 1)).split('.')[0] || '__apex__';
      }
      config.headers['x-tenant-subdomain'] = sub;
    }
    return config;
  },
  (error) => {
    apiEvents.emit('request-end', error.config?.url || '');
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    apiEvents.emit('request-end', response.config.url || '');
    const method = response.config.method?.toLowerCase() || '';
    const successMsg = getActionSuccessMessage(method, response.config.url || '');
    if (successMsg) {
      apiEvents.emit('toast-success', successMsg);
    }
    return response;
  },
  async (error) => {
    apiEvents.emit('request-end', error.config?.url || '');

    // On 401, try a one-time refresh-and-retry before surfacing the error.
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || '';
    const skipRefresh = original._retry
      || original.headers?.['x-skip-refresh']
      || url.includes('/auth/refresh')
      || url.includes('/auth/login');
    if (status === 401 && !skipRefresh && typeof window !== 'undefined') {
      original._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return api(original); // replay the original request silently
      }
    }

    const method = error.config?.method?.toLowerCase() || '';
    const errorMsg = getActionErrorMessage(method, error.config?.url || '', error.response);
    if (errorMsg) {
      apiEvents.emit('toast-error', errorMsg);
    }
    return Promise.reject(error);
  }
);

// ─── Lightweight in-memory GET cache (stale-while-fresh) ──────────────────────
// Identical GET requests within CACHE_TTL_MS are served from memory, so switching
// tabs / navigating back feels instant instead of refetching. Browser-only (a
// shared module cache on the server would leak data across users), short-lived,
// and fully invalidated after any mutation so the user never sees stale writes.
const GET_CACHE = new Map<string, { ts: number; response: any }>();
const GET_IN_FLIGHT = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 30000;
// Session/live endpoints that must always hit the network.
const CACHE_SKIP = ['/auth/', '/notifications'];

export function clearApiCache() {
  GET_CACHE.clear();
  GET_IN_FLIGHT.clear();
}

function cacheKeyOf(config: any): string {
  const h = config.headers || {};
  return [
    config.baseURL || '', config.url || '',
    JSON.stringify(config.params || {}),
    h['x-support-company-id'] || '', h['x-tenant-subdomain'] || '',
  ].join('|');
}

const baseAdapter = axios.getAdapter(axios.defaults.adapter);

api.defaults.adapter = async (config: any) => {
  const method = (config.method || 'get').toLowerCase();
  const browser = typeof window !== 'undefined';
  const cacheable = browser && method === 'get' && !config.__noCache
    && !CACHE_SKIP.some((p) => (config.url || '').includes(p));

  if (cacheable) {
    const key = cacheKeyOf(config);
    const hit = GET_CACHE.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      // Clone so a caller mutating the result can't corrupt the cached copy.
      const data = typeof structuredClone === 'function' ? structuredClone(hit.response.data) : hit.response.data;
      return { ...hit.response, data, config, request: {}, cached: true };
    }
    const pending = GET_IN_FLIGHT.get(key);
    if (pending) {
      const res = await pending;
      const data = typeof structuredClone === 'function' ? structuredClone(res.data) : res.data;
      return { ...res, data, config, request: {}, cached: true };
    }
    const request = baseAdapter(config)
      .then((res) => {
        GET_CACHE.set(key, { ts: Date.now(), response: { ...res, config: undefined, request: undefined } });
        return res;
      })
      .finally(() => GET_IN_FLIGHT.delete(key));
    GET_IN_FLIGHT.set(key, request);
    return request;
  }

  const res = await baseAdapter(config);
  // A successful mutation may have changed server state — drop the read cache.
  if (browser && method !== 'get') GET_CACHE.clear();
  return res;
};

export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const getProfile = async () => {
  const { data } = await api.get('/auth/profile');
  return data;
};

export const getUserPermissions = async (userId: string) => {
  const { data } = await api.get(`/permissions/user/${userId}`);
  return data;
};

export const getAllPermissions = async () => {
  const { data } = await api.get('/permissions/all');
  return data;
};

export const getRolePermissions = async () => {
  const { data } = await api.get('/permissions/roles');
  return data;
};

export const updateRolePermissions = async (role: string, permissions: any[]) => {
  const { data } = await api.put(`/permissions/role/${role}`, { permissions });
  return data;
};

export const resetRolePermissions = async (role: string) => {
  const { data } = await api.post(`/permissions/reset-role/${role}`);
  return data;
};

export const addCustomModule = async (module: string, description?: string) => {
  const { data } = await api.post('/permissions/modules', { module, description });
  return data;
};

export const getCustomModules = async () => {
  const { data } = await api.get('/permissions/modules');
  return data;
};

export const deleteCustomModule = async (key: string) => {
  const { data } = await api.delete(`/permissions/modules/${key}`);
  return data;
};

export const updateUserPermissions = async (userId: string, permissions: any[]) => {
  const { data } = await api.put(`/permissions/user/${userId}`, { permissions });
  return data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const { data } = await api.put(`/permissions/user/${userId}/role`, { role });
  return data;
};

export const resetPermissions = async (userId: string) => {
  const { data } = await api.post(`/permissions/reset/${userId}`);
  return data;
};

export const getEmployees = async (params?: { departmentId?: string; search?: string; page?: number; limit?: number; gender?: string; location?: string; status?: 'active' | 'inactive' | 'all' }) => {
  const { data } = await api.get('/employees', { params });
  return data;
};

export const getEmployeeById = async (id: string) => {
  const { data } = await api.get(`/employees/${id}`);
  return data;
};

export const createEmployee = async (employee: any) => {
  const { data } = await api.post('/employees', employee);
  return data;
};

export const updateEmployee = async (id: string, employee: any) => {
  const { data } = await api.put(`/employees/${id}`, employee);
  return data;
};

export const updateEmployeeAccountStage = async (id: string, accountStage: string) => {
  const { data } = await api.put(`/employees/${id}/account-stage`, { accountStage });
  return data;
};

export const deleteEmployee = async (id: string) => {
  const { data } = await api.delete(`/employees/${id}`);
  return data;
};

export const deactivateEmployee = async (id: string, payload: { reason: string; effectiveDate: string; remarks?: string; confirmation: string }) => {
  const { data } = await api.patch(`/employees/${id}/deactivate`, payload);
  return data;
};

export const reactivateEmployee = async (id: string, payload?: { remarks?: string }) => {
  const { data } = await api.patch(`/employees/${id}/reactivate`, payload || {});
  return data;
};

export const getDepartments = async () => {
  const { data } = await api.get('/employees/departments');
  return data;
};

export const createDepartment = async (department: { name: string; description?: string }) => {
  const { data } = await api.post('/employees/departments', department);
  return data;
};

export const getOrgChart = async () => {
  const { data } = await api.get('/employees/org-chart');
  return data;
};

export const getEmployeeDocuments = async (employeeId: string) => {
  const { data } = await api.get(`/documents/${employeeId}`);
  return data;
};

export const uploadDocument = async (employeeId: string, formData: FormData) => {
  const { data } = await api.post(`/documents/${employeeId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteDocument = async (id: string) => {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
};

export const checkIn = async (employeeId: string) => {
  const { data } = await api.post('/attendance/check-in', { employeeId });
  return data;
};

export const checkOut = async (employeeId: string) => {
  const { data } = await api.post('/attendance/check-out', { employeeId });
  return data;
};

export const getTodayAttendance = async () => {
  const { data } = await api.get('/attendance/today');
  return data;
};

export const getEmployeeAttendance = async (employeeId: string, params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) => {
  const { data } = await api.get(`/attendance/employee/${employeeId}`, { params });
  return data;
};

export const getMonthlyReport = async (params?: { month?: number; year?: number; departmentId?: string }) => {
  const { data } = await api.get('/attendance/report/monthly', { params });
  return data;
};

export const markAttendance = async (data: { employeeId: string; date?: string; status: string; notes?: string }) => {
  const { data: res } = await api.post('/attendance/mark', data);
  return res;
};

export const getAttendanceSettings = async () => {
  const { data } = await api.get('/attendance/settings');
  return data;
};

export const updateAttendanceSettings = async (settings: any) => {
  const { data } = await api.put('/attendance/settings', settings);
  return data;
};

export const getLeaveRequests = async (params?: { employeeId?: string; status?: string; page?: number; limit?: number }) => {
  const { data } = await api.get('/leave', { params });
  return data;
};

export const getMyLeaves = async (status?: string) => {
  const { data } = await api.get('/leave/my', { params: { status } });
  return data;
};

export const getLeaveBalance = async (employeeId: string, year?: number) => {
  const { data } = await api.get('/leave/balance', { params: { employeeId, year } });
  return data;
};

export const getAllLeaveBalances = async (year?: number) => {
  const { data } = await api.get('/leave/balances/all', { params: { year } });
  return data;
};

export const getLeaveCalendar = async (params?: { year?: number; month?: number; employeeId?: string }) => {
  const { data } = await api.get('/leave/calendar', { params });
  return data;
};

export const createLeaveRequest = async (leave: { employeeId: string; leaveType: string; startDate: string; endDate: string; reason?: string }) => {
  const { data } = await api.post('/leave', leave);
  return data;
};

export const approveLeave = async (id: string) => {
  const { data } = await api.put(`/leave/${id}/approve`);
  return data;
};

export const rejectLeave = async (id: string, rejectReason: string) => {
  const { data } = await api.put(`/leave/${id}/reject`, { rejectReason });
  return data;
};

export const cancelLeaveRequest = async (id: string) => {
  const { data } = await api.put(`/leave/${id}/cancel`);
  return data;
};

export const getSalaryStructure = async (employeeId: string) => {
  const { data } = await api.get(`/payroll/structure/${employeeId}`);
  return data;
};

export const setSalaryStructure = async (employeeId: string, structure: any) => {
  const { data } = await api.put(`/payroll/structure/${employeeId}`, structure);
  return data;
};

export const getAllPayrollRuns = async () => {
  const { data } = await api.get('/payroll/runs');
  return data;
};

export const getPayrollReport = async (params?: { month?: number; year?: number }) => {
  const { data } = await api.get('/payroll/report', { params });
  return data;
};

export const getPayrollPreflight = async (params?: { month?: number; year?: number }) => {
  const { data } = await api.get('/payroll/preflight', { params });
  return data;
};

export const downloadPayrollExport = async (params: { month: number; year: number; format: 'excel' | 'csv' | 'pdf' }) => {
  const response = await api.get('/payroll/export', { params, responseType: 'blob' });
  const extension = params.format === 'excel' ? 'xls' : params.format;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `payroll-${params.year}-${String(params.month).padStart(2, '0')}.${extension}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const calculateEmployeeSalary = async (employeeId: string, params?: { month?: number; year?: number }) => {
  const { data } = await api.get(`/payroll/calculate/${employeeId}`, { params });
  return data;
};

export const runPayroll = async (month: number, year: number, payload?: { confirmations?: Record<string, boolean>; adjustments?: Record<string, any> }) => {
  const { data } = await api.post('/payroll/run', { month, year, ...(payload || {}) });
  return data;
};

export const getPayrollSettings = async () => {
  const { data } = await api.get('/payroll/settings');
  return data;
};

export const updatePayrollSettings = async (settings: any) => {
  const { data } = await api.put('/payroll/settings', settings);
  return data;
};

export const getPayslipHistory = async (params?: { employeeId?: string; year?: number; month?: number }) => {
  const { data } = await api.get('/payslip/history', { params });
  return data;
};

export const getPayslip = async (id: string) => {
  const { data } = await api.get(`/payslip/${id}`);
  return data;
};

export const downloadPayslipPDF = async (id: string) => {
  const response = await api.get(`/payslip/pdf/${id}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `payslip.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const downloadBulkPayslips = async (month: number, year: number) => {
  const response = await api.get('/payslip/pdf-bulk', { params: { month, year }, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `payslips-${month}-${year}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const emailPayslip = async (id: string, email?: string) => {
  const { data } = await api.post('/payslip/email', { id, email });
  return data;
};

export const emailBulkPayslips = async (month: number, year: number) => {
  const { data } = await api.post('/payslip/email-bulk', { month, year });
  return data;
};

export const getPayslipTemplate = async () => {
  const { data } = await api.get('/payslip/template');
  return data;
};

export const updatePayslipTemplate = async (payload: { templateId: string; config: any; companyId?: string }) => {
  const { data } = await api.put('/payslip/template', payload);
  return data;
};

export const getProjects = async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
  const { data } = await api.get('/projects', { params });
  return data;
};

export const getProjectById = async (id: string) => {
  const { data } = await api.get(`/projects/${id}`);
  return data;
};

export const createProject = async (project: any) => {
  const { data } = await api.post('/projects', project);
  return data;
};

export const updateProject = async (id: string, project: any) => {
  const { data } = await api.put(`/projects/${id}`, project);
  return data;
};

export const deleteProject = async (id: string) => {
  const { data } = await api.delete(`/projects/${id}`);
  return data;
};

export const addProjectExpense = async (projectId: string, expense: { description: string; amount: number; date?: string }) => {
  const { data } = await api.post(`/projects/${projectId}/expenses`, expense);
  return data;
};

export const getTasks = async (params?: { projectId?: string; assigneeId?: string; status?: string; priority?: string }) => {
  const { data } = await api.get('/projects/tasks/all', { params });
  return data;
};

export const createTask = async (task: any) => {
  const { data } = await api.post('/projects/tasks', task);
  return data;
};

export const updateTask = async (id: string, task: any) => {
  const { data } = await api.put(`/projects/tasks/${id}`, task);
  return data;
};

export const deleteTask = async (id: string) => {
  const { data } = await api.delete(`/projects/tasks/${id}`);
  return data;
};

// ─── Jira-style board + costing ───────────────────────────────────────────────
export const getProjectBoard = async (projectId: string) => {
  const { data } = await api.get(`/projects/${projectId}/board`);
  return data;
};

export const moveTask = async (id: string, payload: { status?: string; boardRank?: number }) => {
  const { data } = await api.put(`/projects/tasks/${id}/move`, payload);
  return data;
};

export const getProjectCosting = async (projectId: string) => {
  const { data } = await api.get(`/projects/${projectId}/costing`);
  return data;
};

export const setResourceRate = async (
  projectId: string,
  payload: { employeeId: string; costRate?: number; billRate?: number; allocationPct?: number },
) => {
  const { data } = await api.put(`/projects/${projectId}/resource-rate`, payload);
  return data;
};

// ─── Sprints + burndown ───────────────────────────────────────────────────────
export const getSprints = async (projectId: string) => {
  const { data } = await api.get(`/projects/${projectId}/sprints`);
  return data;
};

export const createSprint = async (
  projectId: string,
  payload: { name: string; goal?: string; startDate: string; endDate: string; status?: string },
) => {
  const { data } = await api.post(`/projects/${projectId}/sprints`, payload);
  return data;
};

export const updateSprint = async (id: string, payload: any) => {
  const { data } = await api.put(`/projects/sprints/${id}`, payload);
  return data;
};

export const assignTaskToSprint = async (taskId: string, sprintId: string | null) => {
  const { data } = await api.put(`/projects/tasks/${taskId}/sprint`, { sprintId });
  return data;
};

export const getBurndown = async (sprintId: string) => {
  const { data } = await api.get(`/projects/sprints/${sprintId}/burndown`);
  return data;
};

export const logTimesheet = async (data: { employeeId: string; taskId?: string; date: string; hoursWorked: number; description?: string }) => {
  const { data: res } = await api.post('/timesheet', data);
  return res;
};

export const getEmployeeTimesheets = async (employeeId: string, params?: { startDate?: string; endDate?: string }) => {
  const { data } = await api.get(`/timesheet/employee/${employeeId}`, { params });
  return data;
};

export const getAllTimesheets = async (params?: { date?: string; startDate?: string; endDate?: string }) => {
  const { data } = await api.get('/timesheet/all', { params });
  return data;
};

export const getDailySummary = async (date?: string) => {
  const { data } = await api.get('/timesheet/daily', { params: { date } });
  return data;
};

export const generateAttendanceFromTimesheet = async (date?: string) => {
  const { data } = await api.post('/timesheet/generate-attendance', { date });
  return data;
};

export const getEmployeeOvertime = async (params?: { employeeId?: string; status?: string; startDate?: string; endDate?: string }) => {
  const { data } = await api.get('/overtime', { params });
  return data;
};

export const approveOvertime = async (id: string) => {
  const { data } = await api.put(`/overtime/${id}/approve`);
  return data;
};

export const rejectOvertime = async (id: string, rejectReason: string) => {
  const { data } = await api.put(`/overtime/${id}/reject`, { rejectReason });
  return data;
};

export const getOTSummary = async (params?: { month?: number; year?: number }) => {
  const { data } = await api.get('/overtime/summary', { params });
  return data;
};

export const getEmployeeUtilization = async (params: { employeeId: string; startDate?: string; endDate?: string }) => {
  const { data } = await api.get('/utilization/employee', { params });
  return data;
};

export const getAllUtilization = async (params?: { departmentId?: string; startDate?: string; endDate?: string }) => {
  const { data } = await api.get('/utilization/all', { params });
  return data;
};

export const getDashboardStats = async () => {
  const { data } = await api.get('/utilization/dashboard');
  return data;
};

export const getManagerDashboard = async (managerId: string) => {
  const { data } = await api.get(`/utilization/manager/${managerId}`);
  return data;
};

export const getEmployeeDashboard = async (employeeId: string) => {
  const { data } = await api.get(`/utilization/employee/${employeeId}`);
  return data;
};

export const getProjectDashboard = async (projectId: string) => {
  const { data } = await api.get(`/utilization/project/${projectId}`);
  return data;
};

export const getResourceAllocation = async () => {
  const { data } = await api.get('/utilization/resource-allocation');
  return data;
};

export const getMyAttendanceHistory = async (employeeId: string, params?: { startDate?: string; endDate?: string }) => {
  const { data } = await api.get(`/attendance/employee/${employeeId}`, { params });
  return data;
};

// Employee sub-resources
export const addEmployeeAddress = async (employeeId: string, address: any) => {
  const { data } = await api.post(`/employees/${employeeId}/address`, address);
  return data;
};
export const updateEmployeeAddress = async (addressId: string, address: any) => {
  const { data } = await api.put(`/employees/address/${addressId}`, address);
  return data;
};
export const deleteEmployeeAddress = async (addressId: string) => {
  const { data } = await api.delete(`/employees/address/${addressId}`);
  return data;
};
export const addEmployeeEducation = async (employeeId: string, edu: any) => {
  const { data } = await api.post(`/employees/${employeeId}/education`, edu);
  return data;
};
export const updateEmployeeEducation = async (eduId: string, edu: any) => {
  const { data } = await api.put(`/employees/education/${eduId}`, edu);
  return data;
};
export const deleteEmployeeEducation = async (eduId: string) => {
  const { data } = await api.delete(`/employees/education/${eduId}`);
  return data;
};
export const addEmployeeExperience = async (employeeId: string, exp: any) => {
  const { data } = await api.post(`/employees/${employeeId}/experience`, exp);
  return data;
};
export const updateEmployeeExperience = async (expId: string, exp: any) => {
  const { data } = await api.put(`/employees/experience/${expId}`, exp);
  return data;
};
export const deleteEmployeeExperience = async (expId: string) => {
  const { data } = await api.delete(`/employees/experience/${expId}`);
  return data;
};
export const addSalaryRevision = async (employeeId: string, revision: any) => {
  const { data } = await api.post(`/employees/${employeeId}/salary-revision`, revision);
  return data;
};
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
  // The server bumps tokenVersion and refreshes the HttpOnly session cookie.
  return data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // Best-effort server-side revocation; local state is cleared regardless.
  }
};

export const getChangeHistory = async (employeeId: string) => {
  const { data } = await api.get(`/employees/${employeeId}/history`);
  return data;
};

// Bank Details
export const upsertBankDetails = async (employeeId: string, bankData: any) => {
  const { data } = await api.put(`/employees/${employeeId}/bank-details`, bankData);
  return data;
};

// PF Details
export const upsertPFDetails = async (employeeId: string, pfData: any) => {
  const { data } = await api.put(`/employees/${employeeId}/pf-details`, pfData);
  return data;
};

// Exit Details
export const upsertExitDetails = async (employeeId: string, exitData: any) => {
  const { data } = await api.put(`/employees/${employeeId}/exit-details`, exitData);
  return data;
};

// Dependents
export const addDependent = async (employeeId: string, dep: any) => {
  const { data } = await api.post(`/employees/${employeeId}/dependent`, dep);
  return data;
};
export const updateDependent = async (depId: string, dep: any) => {
  const { data } = await api.put(`/employees/dependent/${depId}`, dep);
  return data;
};
export const deleteDependent = async (depId: string, inactiveRemark: string) => {
  const { data } = await api.put(`/employees/dependent/${depId}/inactive`, { inactiveRemark });
  return data;
};

// Photo Upload
export const uploadEmployeePhoto = async (employeeId: string, formData: FormData) => {
  const { data } = await api.post(`/employees/${employeeId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// Account Stage
export const updateAccountStage = async (employeeId: string, accountStage: string) => {
  const { data } = await api.put(`/employees/${employeeId}/account-stage`, { accountStage });
  return data;
};

// Document download
export const downloadDocumentFile = async (docId: string) => {
  const response = await api.get(`/documents/download/${docId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'document');
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Admin: reset password for a user
export const resetPasswordForUser = async (userId: string, newPassword?: string) => {
  const { data } = await api.put(`/auth/reset-password/${userId}`, { newPassword });
  return data;
};

// ──── Recruitment & ATS Endpoints ──────────────────────────────────────────

export const getJobOpenings = async () => {
  const { data } = await api.get('/recruitment/jobs');
  return data;
};

export const getJobOpeningById = async (id: string) => {
  const { data } = await api.get(`/recruitment/jobs/${id}`);
  return data;
};

export const createJobOpening = async (job: any) => {
  const { data } = await api.post('/recruitment/jobs', job);
  return data;
};

export const updateJobOpening = async (id: string, job: any) => {
  const { data } = await api.put(`/recruitment/jobs/${id}`, job);
  return data;
};

export const deleteJobOpening = async (id: string) => {
  const { data } = await api.delete(`/recruitment/jobs/${id}`);
  return data;
};

export const getApplicants = async (params?: { jobOpeningId?: string; stage?: string }) => {
  const { data } = await api.get('/recruitment/applicants', { params });
  return data;
};

export const getCareerConnectJobs = async () => {
  const { data } = await api.get('/recruitment/career-connect/jobs');
  return data;
};

export const getCareerPortalJobById = async (id: string) => {
  const { data } = await api.get(`/recruitment/career-portal/jobs/${id}`);
  return data;
};

export const applyForJob = async (formData: FormData) => {
  const { data } = await api.post('/recruitment/applicants', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateApplicantStage = async (id: string, payload: { stage: string; rating?: number; notes?: string }) => {
  const { data } = await api.put(`/recruitment/applicants/${id}/stage`, payload);
  return data;
};

export const updateApplicantEvaluation = async (id: string, payload: { rating: number | null; reviewNotes: string; updatedAt?: string }) => {
  const { data } = await api.patch(`/recruitment/applicants/${id}/evaluation`, payload);
  return data;
};

export const getApplicantReviews = async (applicantId: string) => {
  const { data } = await api.get(`/recruitment/applicants/${applicantId}/reviews`);
  return data;
};

export const createApplicantReview = async (applicantId: string, payload: { rating: number; reviewText: string; interviewRoundId?: string | null }) => {
  const { data } = await api.post(`/recruitment/applicants/${applicantId}/reviews`, payload);
  return data;
};

export const scheduleInterview = async (interview: {
  applicantId: string;
  interviewerName: string;
  interviewDate: string;
  roundName: string;
  interviewMode?: string;
  meetingLink?: string;
  location?: string;
  instructions?: string;
}) => {
  const { data } = await api.post('/recruitment/interviews', interview);
  return data;
};

export const resendInterviewEmail = async (id: string) => {
  const { data } = await api.post(`/recruitment/interviews/${id}/resend-email`);
  return data;
};

export const submitInterviewFeedback = async (id: string, feedback: { feedback: string; rating: number; status?: string }) => {
  const { data } = await api.put(`/recruitment/interviews/${id}`, feedback);
  return data;
};

export interface JobOfferPayload {
  applicantId?: string;
  offeredCtc: number;
  basicSalary?: number | null;
  hra?: number | null;
  specialAllowance?: number | null;
  otherAllowances?: number | null;
  variablePay?: number | null;
  joiningBonus?: number | null;
  workLocation: string;
  employmentType: string;
  joiningDate: string;
  probationPeriod?: string;
  noticePeriod?: string;
  reportingManager: string;
  reportingManagerTitle?: string;
  workingHours?: string;
  offerExpiryDate: string;
  additionalTerms?: string;
  signatoryName: string;
  signatoryDesignation: string;
  updatedAt?: string;
}

export const getApplicantOffers = async (applicantId: string) => {
  const { data } = await api.get(`/recruitment/applicants/${applicantId}/offers`);
  return data;
};

export const createJobOffer = async (applicantId: string, offer: JobOfferPayload) => {
  const { data } = await api.post(`/recruitment/applicants/${applicantId}/offers`, offer);
  return data;
};

export const updateJobOffer = async (offerId: string, offer: JobOfferPayload) => {
  const { data } = await api.patch(`/recruitment/offers/${offerId}`, offer);
  return data;
};

export const generateJobOfferPdf = async (offerId: string) => {
  const { data } = await api.post(`/recruitment/offers/${offerId}/generate`);
  return data;
};

export const sendJobOffer = async (offerId: string) => {
  const { data } = await api.post(`/recruitment/offers/${offerId}/send`);
  return data;
};

export const cancelJobOffer = async (offerId: string) => {
  const { data } = await api.post(`/recruitment/offers/${offerId}/cancel`);
  return data;
};

export const downloadOfferLetterPDF = async (offerId: string, fullName: string) => {
  const response = await api.get(`/recruitment/offers/${offerId}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `offer-${fullName.replace(/\s+/g, '_')}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getPublicOffer = async (token: string) => {
  const { data } = await api.get(`/career/offers/${token}`);
  return data;
};

export const downloadPublicOfferPDF = async (token: string, fileName = 'offer-letter.pdf') => {
  const response = await api.get(`/career/offers/${token}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const acceptPublicOffer = async (token: string, payload: { acceptedTerms: boolean; candidateName?: string }) => {
  const { data } = await api.post(`/career/offers/${token}/accept`, payload);
  return data;
};

export const rejectPublicOffer = async (token: string, payload: { reason?: string }) => {
  const { data } = await api.post(`/career/offers/${token}/reject`, payload);
  return data;
};

export const getKras = async (employeeId?: string) => {
  const { data } = await api.get('/performance/kras', { params: { employeeId } });
  return data;
};

export const createKra = async (kra: { employeeId: string; title: string; description?: string; weightage: number; target?: string; year?: number; quarter?: number }) => {
  const { data } = await api.post('/performance/kras', kra);
  return data;
};

export const updateKra = async (id: string, kra: any) => {
  const { data } = await api.put(`/performance/kras/${id}`, kra);
  return data;
};

export const deleteKra = async (id: string) => {
  const { data } = await api.delete(`/performance/kras/${id}`);
  return data;
};

export const getAppraisals = async (params?: { employeeId?: string; all?: boolean }) => {
  const { data } = await api.get('/performance/appraisals', { params });
  return data;
};

export const createAppraisal = async (appraisal: { employeeId: string; appraisalCycle: string; startDate: string; endDate: string }) => {
  const { data } = await api.post('/performance/appraisals', appraisal);
  return data;
};

export const submitSelfEvaluation = async (id: string, evaluation: { selfRating: number; selfFeedback: string }) => {
  const { data } = await api.put(`/performance/appraisals/${id}/self`, evaluation);
  return data;
};

export const submitManagerEvaluation = async (id: string, evaluation: { managerRating: number; managerFeedback: string; finalRating?: number }) => {
  const { data } = await api.put(`/performance/appraisals/${id}/manager`, evaluation);
  return data;
};

export const getFeedback360 = async (employeeId?: string) => {
  const { data } = await api.get('/performance/feedback360', { params: { employeeId } });
  return data;
};

export const submitFeedback360 = async (feedback: { employeeId: string; feedback: string; rating: number; relationship?: string; anonymous?: boolean }) => {
  const { data } = await api.post('/performance/feedback360', feedback);
  return data;
};

export const getExpenseClaims = async (params?: { all?: boolean; status?: string }) => {
  const { data } = await api.get('/expenses/claims', { params });
  return data;
};

export const createExpenseClaim = async (formData: FormData) => {
  const { data } = await api.post('/expenses/claims', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const managerApproveClaim = async (id: string, remarks: string) => {
  const { data } = await api.put(`/expenses/claims/${id}/manager-approve`, { remarks });
  return data;
};

export const financeApproveClaim = async (id: string, remarks: string, markAsPaid?: boolean) => {
  const { data } = await api.put(`/expenses/claims/${id}/finance-approve`, { remarks, markAsPaid });
  return data;
};

export const rejectClaim = async (id: string, remarks: string, level: 'manager' | 'finance') => {
  const { data } = await api.put(`/expenses/claims/${id}/reject`, { remarks, level });
  return data;
};

export const getTravelAdvances = async (params?: { all?: boolean }) => {
  const { data } = await api.get('/expenses/advances', { params });
  return data;
};

export const createTravelAdvance = async (advance: { purpose: string; amountRequested: number }) => {
  const { data } = await api.post('/expenses/advances', advance);
  return data;
};

export const approveTravelAdvance = async (id: string, approval: { amountApproved: number; remarks: string; status: 'APPROVED' | 'REJECTED' }) => {
  const { data } = await api.put(`/expenses/advances/${id}/approve`, approval);
  return data;
};

export const settleTravelAdvance = async (id: string, settlement: { settledAmount: number; remarks: string }) => {
  const { data } = await api.put(`/expenses/advances/${id}/settle`, settlement);
  return data;
};

export const getShiftTypes = async () => {
  const { data } = await api.get('/shifts/types');
  return data;
};

export const createShiftType = async (shift: any) => {
  const { data } = await api.post('/shifts/types', shift);
  return data;
};

export const updateShiftType = async (id: string, shift: any) => {
  const { data } = await api.put(`/shifts/types/${id}`, shift);
  return data;
};

export const deleteShiftType = async (id: string) => {
  const { data } = await api.delete(`/shifts/types/${id}`);
  return data;
};

export const getShiftAssignments = async (employeeId?: string) => {
  const { data } = await api.get('/shifts/assignments', { params: { employeeId } });
  return data;
};

export const createShiftAssignment = async (assignment: { employeeId: string; shiftTypeId: string; startDate: string; endDate?: string }) => {
  const { data } = await api.post('/shifts/assignments', assignment);
  return data;
};

export const deleteShiftAssignment = async (id: string) => {
  const { data } = await api.delete(`/shifts/assignments/${id}`);
  return data;
};

export const verifyCheckin = async (coords: { latitude?: number; longitude?: number; clientIp?: string }) => {
  const { data } = await api.post('/shifts/verify-checkin', coords);
  return data;
};

export const getShiftAuditLogs = async () => {
  const { data } = await api.get('/shifts/audit-logs');
  return data;
};

// ──── Checklist Integration API Methods ──────────────────────────────────────
export const getChecklistTemplates = async () => {
  const { data } = await api.get('/checklists/templates');
  return data;
};

export const createChecklistTemplate = async (template: { name: string; type: string; description?: string; tasks: { title: string; description?: string; order: number }[] }) => {
  const { data } = await api.post('/checklists/templates', template);
  return data;
};

export const updateChecklistTemplate = async (id: string, template: { name: string; type: string; description?: string; tasks: { title: string; description?: string; order: number }[] }) => {
  const { data } = await api.put(`/checklists/templates/${id}`, template);
  return data;
};

export const deleteChecklistTemplate = async (id: string) => {
  const { data } = await api.delete(`/checklists/templates/${id}`);
  return data;
};

export const getEmployeeChecklistTasks = async (employeeId: string) => {
  const { data } = await api.get(`/checklists/employee/${employeeId}`);
  return data;
};

export const instantiateEmployeeChecklist = async (employeeId: string, templateId: string) => {
  const { data } = await api.post(`/checklists/employee/${employeeId}/instantiate`, { templateId });
  return data;
};

export const updateEmployeeChecklistTask = async (taskId: string, payload: { status?: string; remarks?: string; dueDate?: string }) => {
  const { data } = await api.put(`/checklists/tasks/${taskId}`, payload);
  return data;
};

export const createCustomChecklistTask = async (task: { employeeId: string; type: string; title: string; description?: string; dueDate?: string }) => {
  const { data } = await api.post('/checklists/tasks', task);
  return data;
};

export const completeOnboarding = async (employeeId: string, force: boolean = false) => {
  const { data } = await api.post(`/checklists/employee/${employeeId}/complete-onboarding`, { force });
  return data;
};

export const completeOffboarding = async (employeeId: string, force: boolean = false) => {
  const { data } = await api.post(`/checklists/employee/${employeeId}/complete-offboarding`, { force });
  return data;
};

export const getRegularizations = async (params?: { status?: string }) => {
  const { data } = await api.get('/regularizations', { params });
  return data;
};

export const submitRegularization = async (payload: {
  date: string;
  requestType: string;
  checkInCorrection?: string;
  checkOutCorrection?: string;
  statusCorrection?: string;
  reason: string;
}) => {
  const { data } = await api.post('/regularizations', payload);
  return data;
};

export const actionRegularization = async (id: string, payload: { status: 'APPROVED' | 'REJECTED'; managerRemarks?: string }) => {
  const { data } = await api.post(`/regularizations/${id}/action`, payload);
  return data;
};

export const getExecutiveSummary = async () => {
  const { data } = await api.get('/dashboard/summary');
  return data;
};

export const getPersonalizedDashboard = async () => {
  const { data } = await api.get('/dashboard/me');
  return data;
};

// ──── HRMS Reports & Analytics Module API Callers ────
export const getStatutoryReport = async (type: string) => {
  const { data } = await api.get(`/reports/statutory/${type}`);
  return data;
};

export const getReportsPayroll = async (type: string) => {
  const { data } = await api.get(`/reports/payroll/${type}`);
  return data;
};

export const getAnalyticsReport = async (type: string) => {
  const { data } = await api.get(`/reports/analytics/${type}`);
  return data;
};

export const getDashboardData = async (role: string) => {
  const { data } = await api.get(`/reports/dashboards/${role}`);
  return data;
};

export const queryEmployeesReport = async (payload: { columns?: string[]; filters?: any[]; limit?: number; page?: number }) => {
  const { data } = await api.post('/reports/query', payload);
  return data;
};

export const downloadReportExport = async (payload: { reportType: string; format?: 'xlsx' | 'csv' | 'pdf'; filters?: any }) => {
  const response = await api.post('/reports/export', payload, { responseType: 'blob' });
  const format = payload.format || 'xlsx';
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `report-${payload.reportType.replace(/[^a-z0-9-]+/gi, '-')}-${Date.now()}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getAuditReportCatalog = async () => {
  const { data } = await api.get('/reports/audit/catalog');
  return data;
};

export const getAuditReportCenter = async (params?: { month?: number; year?: number; financialYear?: string }) => {
  const { data } = await api.get('/reports/audit/center', { params });
  return data;
};

export const generateAuditPack = async (payload: { packType: string; month?: number; year?: number; financialYear?: string }) => {
  const { data } = await api.post('/reports/audit/generate', payload);
  return data;
};

export const updateAuditPackStatus = async (id: string, payload: { status: string; remarks?: string }) => {
  const { data } = await api.patch(`/reports/audit/runs/${id}/status`, payload);
  return data;
};

export const downloadAuditPackExport = async (payload: { packType: string; month?: number; year?: number; financialYear?: string }) => {
  const response = await api.post('/reports/audit/export', payload, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `audit-pack-${payload.packType}-${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getAssets = async (params?: { status?: string; assignedToId?: string }) => {
  const { data } = await api.get('/assets', { params });
  return data;
};

export const createAsset = async (payload: { assetTag: string; name: string; category: string; serialNumber?: string; condition?: string; notes?: string }) => {
  const { data } = await api.post('/assets', payload);
  return data;
};

export const assignAsset = async (id: string, employeeId: string) => {
  const { data } = await api.put(`/assets/${id}/assign`, { employeeId });
  return data;
};

export const returnAsset = async (id: string, payload?: { condition?: string; notes?: string }) => {
  const { data } = await api.put(`/assets/${id}/return`, payload || {});
  return data;
};

export const getLearningCourses = async () => {
  const { data } = await api.get('/learning/courses');
  return data;
};

export const createLearningCourse = async (payload: { title: string; description?: string; category?: string; isMandatory?: boolean }) => {
  const { data } = await api.post('/learning/courses', payload);
  return data;
};

export const getLearningEnrollments = async (params?: { employeeId?: string }) => {
  const { data } = await api.get('/learning/enrollments', { params });
  return data;
};

export const assignLearningCourse = async (payload: { courseId: string; employeeId: string; dueDate?: string }) => {
  const { data } = await api.post('/learning/enrollments', payload);
  return data;
};

export const updateLearningEnrollment = async (id: string, payload: { status?: string; progress?: number }) => {
  const { data } = await api.put(`/learning/enrollments/${id}`, payload);
  return data;
};

export const getHelpdeskTickets = async (params?: { status?: string; employeeId?: string }) => {
  const { data } = await api.get('/helpdesk/tickets', { params });
  return data;
};

export const createHelpdeskTicket = async (payload: { employeeId?: string; category?: string; subject: string; description: string; priority?: string }) => {
  const { data } = await api.post('/helpdesk/tickets', payload);
  return data;
};

export const updateHelpdeskTicket = async (id: string, payload: { status?: string; assignedTo?: string; resolution?: string; priority?: string }) => {
  const { data } = await api.put(`/helpdesk/tickets/${id}`, payload);
  return data;
};

export const getNotifications = async (params?: { employeeId?: string; unreadOnly?: boolean }) => {
  const { data } = await api.get('/notifications', { params });
  return data;
};

export const createNotification = async (payload: { employeeId?: string; title: string; message: string; type?: string; actionUrl?: string }) => {
  const { data } = await api.post('/notifications', payload);
  return data;
};

export const markNotificationRead = async (id: string) => {
  const { data } = await api.put(`/notifications/${id}/read`);
  return data;
};

// Platform architecture, policy, workflow, compliance and integration APIs
export const getPlatformOverview = async () => {
  const { data } = await api.get('/platform/overview');
  return data;
};

export const bootstrapPlatform = async () => {
  const { data } = await api.post('/platform/bootstrap');
  return data;
};

export const getOrganizationSetup = async () => {
  const { data } = await api.get('/platform/organization');
  return data;
};

export const createLegalEntity = async (payload: any) => {
  const { data } = await api.post('/platform/organization/legal-entities', payload);
  return data;
};

export const createBranch = async (payload: any) => {
  const { data } = await api.post('/platform/organization/branches', payload);
  return data;
};

export const createWorkLocation = async (payload: any) => {
  const { data } = await api.post('/platform/organization/locations', payload);
  return data;
};

export const getPolicyDefinitions = async (params?: { policyType?: string; status?: string }) => {
  const { data } = await api.get('/platform/policies', { params });
  return data;
};

export const createPolicyDefinition = async (payload: any) => {
  const { data } = await api.post('/platform/policies', payload);
  return data;
};

export const getWorkflowDefinitions = async (params?: { module?: string }) => {
  const { data } = await api.get('/platform/workflows', { params });
  return data;
};

export const createWorkflowDefinition = async (payload: any) => {
  const { data } = await api.post('/platform/workflows', payload);
  return data;
};

export const startWorkflowInstance = async (payload: any) => {
  const { data } = await api.post('/platform/workflows/start', payload);
  return data;
};

export const getApprovalInbox = async (params?: { status?: string; assignedRole?: string }) => {
  const { data } = await api.get('/platform/approvals/inbox', { params });
  return data;
};

export const actionApprovalTask = async (taskId: string, payload: { action: 'APPROVE' | 'REJECT'; comments?: string }) => {
  const { data } = await api.post(`/platform/approvals/tasks/${taskId}/action`, payload);
  return data;
};

export const getComplianceObligations = async (params?: { month?: number; year?: number; status?: string }) => {
  const { data } = await api.get('/platform/compliance/obligations', { params });
  return data;
};

export const generateComplianceCalendar = async (payload: { month?: number; year?: number; legalEntityId?: string; ownerRole?: string }) => {
  const { data } = await api.post('/platform/compliance/calendar', payload);
  return data;
};

export const updateComplianceObligation = async (id: string, payload: any) => {
  const { data } = await api.put(`/platform/compliance/obligations/${id}`, payload);
  return data;
};

export const getIntegrationConnections = async (params?: { category?: string }) => {
  const { data } = await api.get('/platform/integrations', { params });
  return data;
};

export const upsertIntegrationConnection = async (payload: any) => {
  const { data } = await api.post('/platform/integrations', payload);
  return data;
};

export const testIntegrationConnection = async (id: string) => {
  const { data } = await api.post(`/platform/integrations/${id}/test`);
  return data;
};

// ──── SaaS APIs ────────────────────────────────────────────────────────────
export const signup = async (payload: any) => {
  const { data } = await api.post('/auth/signup', payload);
  return data;
};

export const getBillingPlans = async () => {
  const { data } = await api.get('/billing/plans');
  return data;
};

export const getBillingSubscription = async () => {
  const { data } = await api.get('/billing/subscription');
  return data;
};

export const billingCheckout = async (planId: string) => {
  const { data } = await api.post('/billing/checkout', { planId });
  return data;
};

export const billingConfirmPayment = async (payload: { transactionId: string; planId: string; status: 'SUCCESS' | 'FAILED' }) => {
  const { data } = await api.post('/billing/confirm-payment', payload);
  return data;
};

export const getBillingTransactions = async () => {
  const { data } = await api.get('/billing/transactions');
  return data;
};

export const submitContactRequest = async (payload: { name: string; email: string; phone?: string; companyName?: string; message: string }) => {
  const { data } = await api.post('/contact', payload);
  return data;
};

export const getContactRequests = async () => {
  const { data } = await api.get('/contact');
  return data;
};

export const getPlatformCompanies = async () => {
  const { data } = await api.get('/platform-admin/companies');
  return data;
};

export const updatePlatformCompanyStatus = async (id: string, status: string) => {
  const { data } = await api.put(`/platform-admin/companies/${id}/status`, { status });
  return data;
};

export const createCustomPlan = async (companyId: string, payload: { name: string; description?: string; price: number; employeeLimit: number; featureLimits: any; durationDays?: number }) => {
  const { data } = await api.post(`/platform-admin/companies/${companyId}/custom-plan`, payload);
  return data;
};

export const getPlatformSubscriptions = async () => {
  const { data } = await api.get('/platform-admin/subscriptions');
  return data;
};

export const updatePlatformSubscription = async (id: string, payload: any) => {
  const { data } = await api.put(`/platform-admin/subscriptions/${id}`, payload);
  return data;
};

export const getPlatformMetrics = async () => {
  const { data } = await api.get('/platform-admin/metrics');
  return data;
};

// ──── Support / Maintenance Staff (SUPER_ADMIN) ─────────────────────────────
export const getSupportStaff = async () => {
  const { data } = await api.get('/platform-admin/support-staff');
  return data;
};

export const createSupportStaff = async (payload: { name: string; email: string; password: string }) => {
  const { data } = await api.post('/platform-admin/support-staff', payload);
  return data;
};

export const setSupportStaffStatus = async (id: string, isActive: boolean) => {
  const { data } = await api.put(`/platform-admin/support-staff/${id}/status`, { isActive });
  return data;
};

export const assignSupportCompany = async (id: string, companyId: string) => {
  const { data } = await api.post(`/platform-admin/support-staff/${id}/assignments`, { companyId });
  return data;
};

export const revokeSupportCompany = async (id: string, companyId: string) => {
  const { data } = await api.delete(`/platform-admin/support-staff/${id}/assignments/${companyId}`);
  return data;
};

// ──── Support staff (own) ────────────────────────────────────────────────────
export const getMySupportAssignments = async () => {
  const { data } = await api.get('/support/my-assignments');
  return data;
};

// ──── Tenant workspace subdomain ────────────────────────────────────────────
/** Owner-side: change a tenant's workspace subdomain (SUPER_ADMIN or SUPPORT). */
export const updateTenantSubdomain = async (companyId: string, subdomain: string) => {
  const { data } = await api.put(`/platform-admin/companies/${companyId}/subdomain`, { subdomain });
  return data;
};

/** Public branding for a workspace login screen (no auth). */
export const getPublicTenant = async (subdomain: string) => {
  const { data } = await api.get(`/public/tenant/${encodeURIComponent(subdomain)}`);
  return data;
};

// ──── AI Agents APIs ────────────────────────────────────────────────────────
export const auditTdsProof = async (formData: FormData) => {
  const { data } = await api.post('/ai/sherlock/audit-proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const auditPayrollCompliance = async (month: number, year: number) => {
  const { data } = await api.post('/ai/jarvis/audit-payroll', { month, year });
  return data;
};

export const regularizeAttendanceWinston = async (payload: { dateStr: string; timeIn?: string; timeOut?: string }) => {
  const { data } = await api.post('/ai/winston/regularize', payload);
  return data;
};

export const askAthenaPolicy = async (question: string) => {
  const { data } = await api.post('/ai/athena/ask', { question });
  return data;
};

export const updateCompanyKYC = async (payload: any) => {
  const { data } = await api.put('/platform/organization/company', payload);
  return data;
};

export const verifyCompanyKYC = async (companyId: string, payload: { status: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO'; remarks?: string }) => {
  const { data } = await api.put(`/platform-admin/companies/${companyId}/kyc`, payload);
  return data;
};

export const setupMfa = async () => {
  const { data } = await api.post('/auth/mfa/setup');
  return data;
};

export const enableMfa = async (code: string) => {
  const { data } = await api.post('/auth/mfa/enable', { code });
  return data;
};

export const recordTenantPayment = async (companyId: string, payload: { amount?: number; months?: number }) => {
  const { data } = await api.post(`/platform-admin/companies/${companyId}/record-payment`, payload);
  return data;
};

export const runDunningSweep = async () => {
  const { data } = await api.post('/platform-admin/billing/run-dunning');
  return data;
};

export const getPlatformAuditLogs = async (params?: { action?: string; actor?: string; days?: number; take?: number }) => {
  const { data } = await api.get('/platform-admin/audit-logs', { params });
  return data;
};

export default api;
