const http = require('http');

const LIVE_HOST = '13.232.70.236';
const LIVE_PORT = 5000;

function apiRequest(path, method, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: LIVE_HOST,
      port: LIVE_PORT,
      path: `/api${path}`,
      method,
      headers,
      timeout: 10000
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch {
          resolve({ status: res.statusCode, data: b });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function testRole(name, email, password, role) {
  const loginRes = await apiRequest('/auth/login', 'POST', { email, password });
  if (loginRes.status !== 200 || !loginRes.data?.token) {
    return { role, name, email, login: 'FAIL', profile: 'FAIL', clockIn: 'FAIL', clockOut: 'FAIL', persisted: 'FAIL' };
  }
  const token = loginRes.data.token;

  const profileRes = await apiRequest('/auth/profile', 'GET', null, token);
  const empId = profileRes.data?.employeeId || loginRes.data?.user?.employeeId;
  if (!empId) {
    return { role, name, email, login: 'PASS', profile: 'FAIL (No Employee Profile)', clockIn: 'FAIL', clockOut: 'FAIL', persisted: 'FAIL' };
  }

  // Clock In
  const clockInRes = await apiRequest('/attendance/check-in', 'POST', { employeeId: empId }, token);
  const clockInPass = clockInRes.status === 200 || (clockInRes.data?.error && clockInRes.data.error.includes('Already checked in'));

  // Clock Out
  const clockOutRes = await apiRequest('/attendance/check-out', 'POST', { employeeId: empId }, token);
  const clockOutPass = clockOutRes.status === 200;

  // Persisted check
  const historyRes = await apiRequest(`/attendance/employee/${empId}`, 'GET', null, token);
  const persistedPass = historyRes.status === 200 && Array.isArray(historyRes.data?.attendances) && historyRes.data.attendances.length > 0;

  return {
    name,
    role,
    email,
    login: 'PASS',
    profile: 'PASS',
    employeeId: empId,
    clockIn: clockInPass ? 'PASS' : 'FAIL',
    clockOut: clockOutPass ? 'PASS' : 'FAIL',
    persisted: persistedPass ? 'PASS' : 'FAIL'
  };
}

async function runFullAudit() {
  console.log('===========================================================');
  console.log('   FULL LIVE PRODUCTION SYSTEM AUDIT (http://13.232.70.236) ');
  console.log('===========================================================\n');

  // 1. Role Matrix Test
  const testMatrix = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'Ananya Reddy', email: 'ananya.reddy@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'Diya Patel', email: 'diya.patel@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'HR Manager', email: 'hr@hrms.com', password: 'employee123', role: 'HR' },
    { name: 'Manager User', email: 'manager@hrms.com', password: 'employee123', role: 'MANAGER' },
    { name: 'Admin User', email: 'admin@hrms.com', password: 'admin123', role: 'ADMIN' },
    { name: 'Super Admin', email: 'pidsuperadmin@hcms.pid', password: 'Noallow#835', role: 'SUPER_ADMIN' },
  ];

  const roleResults = [];
  for (const acc of testMatrix) {
    const res = await testRole(acc.name, acc.email, acc.password, acc.role);
    roleResults.push(res);
  }

  console.log('\n--- ATTENDANCE MATRIX AUDIT RESULTS ---');
  console.table(roleResults);

  // 2. HR Features Audit
  console.log('\n--- FEATURE INTEGRITY AUDIT ---');

  // HR Login for feature testing
  const hrLogin = await apiRequest('/auth/login', 'POST', { email: 'hr@hrms.com', password: 'employee123' });
  const hrToken = hrLogin.data?.token;

  // HR Leave Approval Test
  const leaveRes = await apiRequest('/leaves', 'GET', null, hrToken);
  const hrLeavePass = leaveRes.status === 200 && Array.isArray(leaveRes.data?.leaves);
  console.log(`HR Leave Access (Status: ${leaveRes.status}): ${hrLeavePass ? 'PASS' : 'FAIL'}`);

  // Forgot Password API Test
  const forgotRes = await apiRequest('/auth/forgot-password', 'POST', { email: 'aarav.sharma@hrms.com' });
  const forgotPass = forgotRes.status === 200;
  console.log(`Forgot Password API (Status: ${forgotRes.status}): ${forgotPass ? 'PASS' : 'FAIL'}`);

  // Monthly Report API Test
  const reportRes = await apiRequest('/attendance/report/monthly?month=8&year=2026', 'GET', null, hrToken);
  const reportPass = reportRes.status === 200;
  console.log(`Monthly Attendance Report API (Status: ${reportRes.status}): ${reportPass ? 'PASS' : 'FAIL'}`);

  // Regularization Requests API Test
  const regRes = await apiRequest('/regularizations', 'GET', null, hrToken);
  const regPass = regRes.status === 200;
  console.log(`Regularization Requests API (Status: ${regRes.status}): ${regPass ? 'PASS' : 'FAIL'}`);

  console.log('\n===========================================================');
  console.log('   AUDIT COMPLETE');
  console.log('===========================================================');
}

runFullAudit();
