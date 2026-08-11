const http = require('http');

function request(path, method, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers,
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

async function testRoleAttendance(name, email, password, expectedRole) {
  console.log(`--------------------------------------------------`);
  console.log(`Testing Role: ${expectedRole} (${name} - ${email})`);

  // 1. Login
  const loginRes = await request('/api/auth/login', 'POST', { email, password });
  if (loginRes.status !== 200 || !loginRes.data?.token) {
    console.log(`❌ Login Failed! Status: ${loginRes.status}, Error:`, loginRes.data?.error || loginRes.data);
    return false;
  }
  const token = loginRes.data.token;
  console.log(`✅ Login Success! Token Issued. Role: ${loginRes.data.user.role}`);

  // 2. Profile lookup & Employee link check
  const profileRes = await request('/api/auth/profile', 'GET', null, token);
  const empId = profileRes.data?.employeeId || profileRes.data?.user?.employeeId || loginRes.data?.user?.employeeId;
  console.log(`✅ Profile Lookup: EmployeeID = ${empId || 'NULL'}`);
  if (!empId) {
    console.log(`❌ FAILED: User account has no linked Employee profile!`);
    return false;
  }

  // 3. Clock In (self-service)
  const clockInRes = await request('/api/attendance/check-in', 'POST', { employeeId: empId }, token);
  if (clockInRes.status === 200 || (clockInRes.data?.error && clockInRes.data.error.includes('Already checked in'))) {
    console.log(`✅ Clock In: SUCCESS / Handled (Status: ${clockInRes.status})`);
  } else {
    console.log(`❌ Clock In Failed! Status: ${clockInRes.status}, Error:`, clockInRes.data);
    return false;
  }

  // 4. Clock Out (self-service)
  const clockOutRes = await request('/api/attendance/check-out', 'POST', { employeeId: empId }, token);
  if (clockOutRes.status === 200) {
    console.log(`✅ Clock Out: SUCCESS (WorkHours: ${clockOutRes.data.workHours})`);
  } else {
    console.log(`❌ Clock Out Failed! Status: ${clockOutRes.status}, Error:`, clockOutRes.data);
    return false;
  }

  // 5. Submit Punch Correction (self-service)
  const todayStr = new Date().toISOString().split('T')[0];
  const regPayload = {
    date: todayStr,
    requestType: 'MISSING_PUNCH_IN',
    checkInCorrection: `${todayStr}T09:00:00.000Z`,
    checkOutCorrection: `${todayStr}T18:00:00.000Z`,
    reason: 'Test automated punch correction for all 5 roles',
  };
  const regRes = await request('/api/regularizations', 'POST', regPayload, token);
  if (regRes.status === 201 || regRes.status === 200) {
    console.log(`✅ Punch Correction: SUBMITTED SUCCESSFULLY! (ID: ${regRes.data.id || regRes.data.data?.id})`);
  } else {
    console.log(`❌ Punch Correction Failed! Status: ${regRes.status}, Error:`, regRes.data);
    return false;
  }

  // 6. View Correction Requests
  const getRegRes = await request('/api/regularizations', 'GET', null, token);
  if (getRegRes.status === 200) {
    console.log(`✅ Get Regularizations: SUCCESS (Count: ${getRegRes.data.data?.length || getRegRes.data.length || 0})`);
  } else {
    console.log(`❌ Get Regularizations Failed! Status: ${getRegRes.status}`);
    return false;
  }

  return true;
}

async function runAllTests() {
  console.log('=== COMPREHENSIVE ATTENDANCE MATRIX TEST ACROSS ALL 5 ROLES ===\n');

  const testMatrix = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'Diya Patel', email: 'diya.patel@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'Ananya Reddy', email: 'ananya.reddy@hrms.com', password: 'employee123', role: 'EMPLOYEE' },
    { name: 'Manager User', email: 'manager@hrms.com', password: 'employee123', role: 'MANAGER' },
    { name: 'HR Manager', email: 'hr@hrms.com', password: 'employee123', role: 'HR' },
    { name: 'Admin User', email: 'admin@hrms.com', password: 'admin123', role: 'ADMIN' },
    { name: 'Super Admin', email: 'pidsuperadmin@hcms.pid', password: 'Noallow#835', role: 'SUPER_ADMIN' },
  ];

  let passed = 0;
  for (const acc of testMatrix) {
    const ok = await testRoleAttendance(acc.name, acc.email, acc.password, acc.role);
    if (ok) passed++;
  }

  console.log(`\n==================================================`);
  console.log(`ATTENDANCE MATRIX RESULTS: ${passed} / ${testMatrix.length} TEST ACCOUNTS PASSED`);
  console.log(`==================================================`);
}

runAllTests();
