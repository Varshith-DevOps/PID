async function main() {
  try {
    const loginResp = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hrms.com',
        password: 'admin123'
      })
    });
    const login = await loginResp.json();
    const token = login.token;

    const endpoints = [
      '/api/attendance',
      '/api/leave',
      '/api/recruitment/jobs',
      '/api/learning/courses'
    ];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(`http://localhost:5000${ep}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`${ep} status: ${resp.status}`);
        if (resp.status !== 200) {
          const err = await resp.text();
          console.log(`${ep} error: ${err}`);
        }
      } catch (e) {
        console.error(`${ep} failed`, e.message);
      }
    }
  } catch (e) {
    console.error('Login failed', e.message);
  }
}
main();
