/**
 * User-facing action messages for PID hcms.
 *
 * Keep every message short, plain, and action-related. The API may return
 * technical details, but users should see what happened and what to do next.
 */

type MessageContext = {
  method: string;
  url: string;
  status?: number;
  serverMessage?: string;
};

type MessageRule = {
  id: string;
  methods?: string[];
  match: string | RegExp;
  message: string | ((ctx: MessageContext) => string);
};

const normalize = (value?: string) => String(value || '').toLowerCase();

const methodMatches = (rule: MessageRule, method: string) => !rule.methods || rule.methods.includes(method);

const urlMatches = (rule: MessageRule, url: string) => {
  if (typeof rule.match === 'string') return normalize(url).includes(rule.match);
  return rule.match.test(url);
};

const applyRule = (rules: MessageRule[], ctx: MessageContext) => {
  const url = normalize(ctx.url);
  const method = normalize(ctx.method);
  const rule = rules.find((item) => methodMatches(item, method) && urlMatches(item, url));
  if (!rule) return null;
  return typeof rule.message === 'function' ? rule.message(ctx) : rule.message;
};

const successRules: MessageRule[] = [
  { id: 'auth-login-ok', methods: ['post'], match: '/auth/login', message: 'Login successful. Your dashboard is ready.' },
  { id: 'auth-signup-ok', methods: ['post'], match: '/auth/signup', message: 'Registration submitted. Complete KYC to unlock your workspace.' },
  { id: 'password-change-ok', methods: ['post', 'put'], match: /\/auth\/(change-password|reset-password)/, message: 'Password updated successfully.' },
  { id: 'mfa-ok', methods: ['post', 'put'], match: '/auth/mfa', message: 'Multi-factor authentication updated successfully.' },

  { id: 'employee-create-ok', methods: ['post'], match: '/employees', message: 'Employee profile created. Share the login details with the employee.' },
  { id: 'employee-update-ok', methods: ['put', 'patch'], match: '/employees', message: 'Employee profile updated and saved.' },
  { id: 'employee-delete-ok', methods: ['delete'], match: '/employees', message: 'Employee record removed from active use.' },
  { id: 'document-ok', methods: ['post', 'put', 'delete'], match: '/documents', message: 'Document action completed successfully.' },

  { id: 'attendance-checkin-ok', methods: ['post'], match: '/attendance/check-in', message: 'Check-in recorded. Have a productive day.' },
  { id: 'attendance-checkout-ok', methods: ['post'], match: '/attendance/check-out', message: 'Check-out recorded. Your work hours are updated.' },
  { id: 'attendance-mark-ok', methods: ['post', 'put'], match: /\/attendance\/(mark|manual)/, message: 'Attendance entry saved.' },
  { id: 'regularization-ok', methods: ['post', 'put'], match: '/regularizations', message: 'Attendance correction request updated.' },
  { id: 'shift-ok', methods: ['post', 'put', 'delete'], match: '/shifts', message: 'Shift details updated successfully.' },

  { id: 'leave-submit-ok', methods: ['post'], match: '/leave', message: 'Leave request submitted for approval.' },
  { id: 'leave-update-ok', methods: ['put', 'patch', 'delete'], match: '/leave', message: 'Leave request updated.' },

  { id: 'payroll-run-ok', methods: ['post'], match: '/payroll/run', message: 'Payroll run completed. Review the payroll summary before release.' },
  { id: 'payroll-action-ok', methods: ['post', 'put'], match: '/payroll', message: 'Payroll action completed successfully.' },
  { id: 'payslip-ok', methods: ['post'], match: '/payslip', message: 'Payslip action completed successfully.' },
  { id: 'tax-ok', methods: ['post', 'put'], match: '/tax', message: 'Tax details saved successfully.' },
  { id: 'fnf-ok', methods: ['post', 'put'], match: '/fnf', message: 'Full and final settlement action completed.' },

  { id: 'project-task-ok', methods: ['post', 'put', 'delete'], match: '/projects/tasks', message: 'Task action completed successfully.' },
  { id: 'project-ok', methods: ['post', 'put', 'delete'], match: '/projects', message: 'Project action completed successfully.' },
  { id: 'timesheet-ok', methods: ['post', 'put', 'delete'], match: '/timesheet', message: 'Timesheet entry saved.' },
  { id: 'overtime-ok', methods: ['post', 'put'], match: '/overtime', message: 'Overtime request updated.' },

  { id: 'expense-ok', methods: ['post', 'put'], match: '/expenses', message: 'Expense action completed successfully.' },
  { id: 'recruitment-ok', methods: ['post', 'put', 'delete'], match: '/recruitment', message: 'Recruitment action completed successfully.' },
  { id: 'performance-ok', methods: ['post', 'put'], match: '/performance', message: 'Performance record saved.' },
  { id: 'asset-ok', methods: ['post', 'put', 'delete'], match: '/assets', message: 'Asset record updated.' },
  { id: 'learning-ok', methods: ['post', 'put', 'delete'], match: '/learning', message: 'Learning record updated.' },
  { id: 'helpdesk-ok', methods: ['post', 'put'], match: '/helpdesk', message: 'Helpdesk ticket updated.' },
  { id: 'notification-ok', methods: ['post', 'put'], match: '/notifications', message: 'Notification updated.' },

  { id: 'report-export-ok', methods: ['post'], match: '/reports/export', message: 'Report exported. Check your downloads folder.' },
  { id: 'audit-pack-ok', methods: ['post'], match: '/reports/audit', message: 'Audit report action completed successfully.' },
  { id: 'permission-ok', methods: ['post', 'put', 'delete'], match: '/permissions', message: 'Permission changes saved.' },
  { id: 'platform-ok', methods: ['post', 'put'], match: '/platform', message: 'Platform settings updated.' },
  { id: 'billing-ok', methods: ['post', 'put'], match: '/billing', message: 'Billing action completed successfully.' },
  { id: 'contact-ok', methods: ['post'], match: '/contact', message: 'Request submitted. The team will contact you soon.' },
];

const errorRules: MessageRule[] = [
  { id: 'auth-login-fail', match: '/auth/login', message: 'Login failed. Check your email, password, and MFA if enabled.' },
  { id: 'auth-session-fail', match: '/auth/profile', message: 'Your session could not be verified. Please log in again.' },
  { id: 'auth-password-fail', match: /\/auth\/(change-password|reset-password)/, message: 'Password update failed. Check the current password and password rules.' },
  { id: 'mfa-fail', match: '/auth/mfa', message: 'MFA action failed. Check the code and try again.' },

  { id: 'employee-fail', match: '/employees', message: 'Employee action failed. Check mandatory fields, duplicate email, and department selection.' },
  { id: 'document-fail', match: '/documents', message: 'Document action failed. Check file type, file size, and access rights.' },
  { id: 'attendance-checkin-fail', match: '/attendance/check-in', message: 'Check-in failed. Confirm employee, shift, location, and duplicate punch status.' },
  { id: 'attendance-checkout-fail', match: '/attendance/check-out', message: 'Check-out failed. Check that a valid check-in exists for today.' },
  { id: 'attendance-fail', match: '/attendance', message: 'Attendance action failed. Check date, employee access, and payroll lock status.' },
  { id: 'regularization-fail', match: '/regularizations', message: 'Attendance correction failed. Check the correction date and approval status.' },
  { id: 'shift-fail', match: '/shifts', message: 'Shift action failed. Check employee, dates, overlap, and shift rules.' },

  { id: 'leave-fail', match: '/leave', message: 'Leave action failed. Check balance, date range, overlap, and approval rights.' },
  { id: 'payroll-fail', match: '/payroll', message: 'Payroll action failed. Resolve preflight issues before trying again.' },
  { id: 'payslip-fail', match: '/payslip', message: 'Payslip action failed. Check payroll status and employee access.' },
  { id: 'tax-fail', match: '/tax', message: 'Tax action failed. Check financial year and declaration values.' },
  { id: 'fnf-fail', match: '/fnf', message: 'Final settlement action failed. Check exit details, assets, and payroll locks.' },

  { id: 'project-task-fail', match: '/projects/tasks', message: 'Task action failed. Check assignee, project, dates, and task ownership.' },
  { id: 'project-fail', match: '/projects', message: 'Project action failed. Check project owner, required fields, and active status.' },
  { id: 'timesheet-fail', match: '/timesheet', message: 'Timesheet action failed. Check assigned task, date, and hours entered.' },
  { id: 'overtime-fail', match: '/overtime', message: 'Overtime action failed. Check hours, approval status, and policy limits.' },

  { id: 'expense-fail', match: '/expenses', message: 'Expense action failed. Check amount, receipt, approval role, and claim status.' },
  { id: 'recruitment-fail', match: '/recruitment', message: 'Recruitment action failed. Check candidate, job status, and required interview details.' },
  { id: 'performance-fail', match: '/performance', message: 'Performance action failed. Check rating range, cycle, and reviewer access.' },
  { id: 'asset-fail', match: '/assets', message: 'Asset action failed. Check asset tag, assignment status, and employee access.' },
  { id: 'learning-fail', match: '/learning', message: 'Learning action failed. Check course, employee, and progress value.' },
  { id: 'helpdesk-fail', match: '/helpdesk', message: 'Helpdesk action failed. Check ticket owner, assignee, and status.' },

  { id: 'report-export-fail', match: '/reports/export', message: 'Report export failed. Select a valid report and format, then try again.' },
  { id: 'audit-report-fail', match: '/reports/audit', message: 'Audit report action failed. Check pack type, period, and export permission.' },
  { id: 'dashboard-fail', match: '/dashboard', message: 'Dashboard could not load. Refresh the page or check your access.' },
  { id: 'permission-fail', match: '/permissions', message: 'Permission update failed. Check role access and permission values.' },
  { id: 'platform-fail', match: '/platform', message: 'Platform action failed. Check company, KYC, subscription, and admin access.' },
  { id: 'billing-plans-fail', methods: ['get'], match: '/billing/plans', message: 'Could not load live billing plans. Using fallback plan options for now.' },
  { id: 'billing-fail', match: '/billing', message: 'Billing action failed. Check the plan, payment status, and subscription access.' },
  { id: 'contact-fail', match: '/contact', message: 'Contact request failed. Check the required fields and try again.' },
];

const statusMessages: Record<number, string> = {
  400: 'The request has missing or invalid details. Please review the form and try again.',
  401: 'You are not logged in, or your session expired. Please log in again.',
  402: 'Your subscription needs attention. Please update billing to continue.',
  403: 'You do not have permission for this action. Ask an admin if you need access.',
  404: 'The requested record was not found. It may have been deleted or moved.',
  409: 'This action conflicts with an existing record. Check for duplicates or locked data.',
  413: 'The file is too large. Upload a smaller file and try again.',
  429: 'Too many attempts. Wait a moment, then try again.',
  500: 'Something went wrong on the server. Please try again or contact support.',
};

export function getActionSuccessMessage(method: string, url: string): string | null {
  const normalizedMethod = normalize(method);
  if (!['post', 'put', 'patch', 'delete'].includes(normalizedMethod)) return null;
  return applyRule(successRules, { method: normalizedMethod, url });
}

export function getActionErrorMessage(method: string, url: string, errorResponse: any): string {
  const ctx: MessageContext = {
    method: normalize(method),
    url,
    status: errorResponse?.status,
    serverMessage: errorResponse?.data?.error || errorResponse?.data?.message,
  };
  return applyRule(errorRules, ctx)
    || statusMessages[ctx.status || 0]
    || ctx.serverMessage
    || 'Action failed. Check the details and try again.';
}

export function normalizeManualMessage(message: unknown): { message: string; type: 'success' | 'error' } {
  const text = String(message || 'Action completed.');
  const lower = text.toLowerCase();
  const isError = ['failed', 'error', 'invalid', 'required', 'denied', 'missing', 'cannot', 'blocked'].some((word) => lower.includes(word));
  return { message: text, type: isError ? 'error' : 'success' };
}
