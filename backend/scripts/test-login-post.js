const http = require('http');

function postLogin(email, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
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

async function run() {
  console.log('--- TESTING POST /api/auth/login FOR aarav.sharma@hrms.com ---');
  const res = await postLogin('aarav.sharma@hrms.com', 'employee123');
  console.log('STATUS:', res.status);
  console.log('SUCCESSFUL TOKEN RETURNED:', Boolean(res.data?.token));
  console.log('RETURNED ROLE:', res.data?.user?.role);
  console.log('RETURNED EMPLOYEE ID:', res.data?.user?.employeeId);
  console.log('ERROR (if any):', res.data?.error);
}

run();
