/**
 * @fileoverview Axios API client and request services.
 * Centralizes all frontend network requests to the HRMS backend API.
 * Handles automatic JWT authorization header injection via request interceptors.
 * @module lib/api
 */

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

export const addCustomModule = async (module: string) => {
  const { data } = await api.post('/permissions/modules', { module });
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

export const getEmployees = async (params?: { departmentId?: string; search?: string; page?: number; limit?: number; gender?: string; location?: string }) => {
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

export const scheduleInterview = async (interview: { applicantId: string; interviewerName: string; interviewDate: string; roundName: string }) => {
  const { data } = await api.post('/recruitment/interviews', interview);
  return data;
};

export const submitInterviewFeedback = async (id: string, feedback: { feedback: string; rating: number; status?: string }) => {
  const { data } = await api.put(`/recruitment/interviews/${id}`, feedback);
  return data;
};

export const createJobOffer = async (offer: { applicantId: string; offeredSalary: number; joiningDate: string }) => {
  const { data } = await api.post('/recruitment/offers', offer);
  return data;
};

export const downloadOfferLetterPDF = async (offerId: string, fullName: string) => {
  const response = await api.get(`/recruitment/offers/${offerId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `offer-${fullName.replace(/\s+/g, '_')}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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

export const downloadReportExport = async (payload: { reportType: string; filters?: any }) => {
  const response = await api.post('/reports/export', payload, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `report-${Date.now()}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
