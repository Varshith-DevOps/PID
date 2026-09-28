const http = require('http');

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(JSON.stringify(bodyData));
    req.end();
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runEndToEndTests() {
  console.log('=== RUNNING COMPREHENSIVE END-TO-END WORKFLOW TESTS ===\n');

  const testAccounts = [
    {
      name: 'Aarav Sharma (Senior Software Engineer, Engineering)',
      email: 'aarav.sharma@hrms.com',
      password: 'employee123',
      expectedRole: 'EMPLOYEE',
    },
    {
      name: 'Diya Patel (Product Manager, Product)',
      email: 'diya.patel@hrms.com',
      password: 'employee123',
      expectedRole: 'EMPLOYEE',
    },
    {
      name: 'Ananya Reddy (HR Specialist, Human Resources)',
      email: 'ananya.reddy@hrms.com',
      password: 'employee123',
      expectedRole: 'EMPLOYEE',
    },
    {
      name: 'Manager User (Engineering Manager, Engineering)',
      email: 'manager@hrms.com',
      password: 'employee123',
      expectedRole: 'MANAGER',
    },
    {
      name: 'Admin User',
      email: 'admin@hrms.com',
      password: 'admin123',
      expectedRole: 'ADMIN',
    },
    {
      name: 'Super Admin User',
      email: 'PIDsuperadmin@hcms.pid',
      password: 'Noallow#835',
      expectedRole: 'SUPER_ADMIN',
    },
  ];

  for (const acc of testAccounts) {
    console.log(`--------------------------------------------------`);
    console.log(`Testing Account: ${acc.name}`);
    console.log(`Email: ${acc.email}`);

    // 1. LOGIN
    const loginRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: acc.email, password: acc.password });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.log(`❌ Login Failed! Status: ${loginRes.status}, Error:`, loginRes.data);
      continue;
    }

    const token = loginRes.data.token;
    console.log(`✅ Login Success! Role: ${loginRes.data.user?.role}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // 2. GET PROFILE
    const profileRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/profile',
      method: 'GET',
      headers: authHeaders,
    });
    console.log(`✅ Profile Lookup: EmployeeID = ${profileRes.data?.employeeId}`);

    // 3. CLOCK IN (For Employees & Managers)
    if (acc.expectedRole === 'EMPLOYEE' || acc.expectedRole === 'MANAGER') {
      const clockInRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/attendance/check-in',
        method: 'POST',
        headers: authHeaders,
      }, { timestamp: new Date().toISOString() });

      if (clockInRes.status === 200 || clockInRes.data?.error?.includes('Already checked in')) {
        console.log(`✅ Clock In: Success / Handled (Status: ${clockInRes.status})`);
      } else {
        console.log(`❌ Clock In Failed:`, clockInRes.data);
      }

      // 4. CLOCK OUT
      const clockOutRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/attendance/check-out',
        method: 'POST',
        headers: authHeaders,
      }, { timestamp: new Date().toISOString() });

      if (clockOutRes.status === 200) {
        console.log(`✅ Clock Out: Success (WorkHours: ${clockOutRes.data?.workHours})`);
      } else {
        console.log(`❌ Clock Out Failed:`, clockOutRes.data);
      }

      // 5. PUNCH CORRECTION / REGULARIZATION (POST /api/regularizations)
      const todayStr = new Date().toISOString().split('T')[0];
      const regRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/regularizations',
        method: 'POST',
        headers: authHeaders,
      }, {
        date: todayStr,
        requestType: 'MISSING_PUNCH_IN',
        checkInCorrection: `${todayStr}T09:00:00Z`,
        checkOutCorrection: `${todayStr}T18:00:00Z`,
        statusCorrection: 'PRESENT',
        reason: 'Automated test correction request verification',
      });

      if (regRes.status === 201) {
        console.log(`✅ Punch Correction: Submitted Successfully! (ID: ${regRes.data?.id})`);
      } else {
        console.log(`❌ Punch Correction Failed:`, regRes.data);
      }

      // 6. GET REGULARIZATIONS (GET /api/regularizations)
      const getRegRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/regularizations',
        method: 'GET',
        headers: authHeaders,
      });

      if (getRegRes.status === 200 && Array.isArray(getRegRes.data)) {
        console.log(`✅ Get Regularizations: Success (Count: ${getRegRes.data.length})`);
      } else {
        console.log(`❌ Get Regularizations Failed:`, getRegRes.data);
      }
    }

    await delay(300);
  }

  console.log('\n=== ALL END-TO-END WORKFLOW TESTS COMPLETED ===');
}

runEndToEndTests().catch(console.error);
