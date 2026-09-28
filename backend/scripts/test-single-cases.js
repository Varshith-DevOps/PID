const http = require('http');
const loginGuard = require('../src/utils/loginGuard');

function test(email, password) {
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
  if (loginGuard && typeof loginGuard.resetAll === 'function') {
    loginGuard.resetAll();
  }

  console.log('--- TEST WRONG PASSWORD ---');
  console.log(await test('admin@hrms.com', 'wrongpass123'));

  console.log('\n--- TEST NONEXISTENT EMAIL ---');
  console.log(await test('nonexistent.user999@hrms.com', 'pass123'));
}

run();
