const http = require('http');

function postLogin(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runVerification() {
  console.log('=== STARTING AUTHENTICATION VERIFICATION SUITE ===\n');

  const cases = [
    {
      name: '1. Provisioned User 1 (aarav.sharma@hrms.com)',
      payload: { email: 'aarav.sharma@hrms.com', password: 'employee123' },
      expectedStatus: 200,
    },
    {
      name: '2. Provisioned User 2 (diya.patel@hrms.com)',
      payload: { email: 'diya.patel@hrms.com', password: 'employee123' },
      expectedStatus: 200,
    },
    {
      name: '3. Provisioned User 3 (ananya.reddy@hrms.com)',
      payload: { email: 'ananya.reddy@hrms.com', password: 'employee123' },
      expectedStatus: 200,
    },
    {
      name: '4. Email Normalization (Uppercase & Spaces: "  Aarav.Sharma@hrms.com  ")',
      payload: { email: '  Aarav.Sharma@hrms.com  ', password: 'employee123' },
      expectedStatus: 200,
    },
    {
      name: '5. Existing Production Admin (admin@hrms.com)',
      payload: { email: 'admin@hrms.com', password: 'admin123' },
      expectedStatus: 200,
    },
    {
      name: '6. Existing User + Incorrect Password (admin@hrms.com)',
      payload: { email: 'admin@hrms.com', password: 'wrongpassword999' },
      expectedStatus: 401,
      expectedError: 'Incorrect password. Please try again.',
    },
    {
      name: '7. Nonexistent Email (nonexistent.user999@hrms.com)',
      payload: { email: 'nonexistent.user999@hrms.com', password: 'password123' },
      expectedStatus: 401,
      expectedError: 'No account found with this email address.',
    },
  ];

  for (const c of cases) {
    const res = await postLogin(c.payload);
    if (res.status === c.expectedStatus) {
      if (c.expectedStatus === 200) {
        console.log(`✅ [PASS] ${c.name}`);
        console.log(`   - Status: ${res.status}`);
        console.log(`   - Returned token: ${Boolean(res.data.token)}`);
        console.log(`   - User Role: ${res.data.user?.role}`);
        console.log(`   - User Email: ${res.data.user?.email}`);
      } else if (!c.expectedError || res.data?.error === c.expectedError) {
        console.log(`✅ [PASS] ${c.name}`);
        console.log(`   - Status: ${res.status}`);
        console.log(`   - Returned Error: "${res.data?.error}"`);
      } else {
        console.log(`❌ [FAIL] ${c.name} - Got error "${res.data?.error}", expected "${c.expectedError}"`);
      }
    } else {
      console.log(`❌ [FAIL] ${c.name} - Expected Status: ${c.expectedStatus}, Got: ${res.status}`);
      console.log(`   - Payload: ${JSON.stringify(res.data)}`);
    }
    console.log('');
    await delay(300);
  }

  console.log('=== VERIFICATION SUITE COMPLETE ===');
}

runVerification().catch(console.error);
