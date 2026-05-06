import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const updateUserPermissions = async (userId: string, permissions: any[]) => {
  const { data } = await api.put(`/permissions/user/${userId}`, { permissions });
  return data;
};

export const resetPermissions = async (userId: string) => {
  const { data } = await api.post(`/permissions/reset/${userId}`);
  return data;
};

export const getEmployees = async (params?: { departmentId?: string; search?: string; page?: number; limit?: number }) => {
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

export const deleteEmployee = async (id: string) => {
  const { data } = await api.delete(`/employees/${id}`);
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

export const getPayslipHistory = async (params?: { employeeId?: string; year?: number }) => {
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
  return data;
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

export default api;
