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
    console.log('Login success');

    try {
      const summaryResp = await fetch('http://localhost:5000/api/dashboard/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Summary status:', summaryResp.status);
      const summary = await summaryResp.text();
      console.log('Summary response:', summary.slice(0, 100));
    } catch (e) {
      console.error('Summary failed', e.message);
    }

    try {
      const meResp = await fetch('http://localhost:5000/api/dashboard/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Me status:', meResp.status);
      const me = await meResp.text();
      console.log('Me response:', me.slice(0, 100));
    } catch (e) {
      console.error('Me failed', e.message);
    }

    try {
      const empResp = await fetch('http://localhost:5000/api/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Employees status:', empResp.status);
      const emp = await empResp.text();
      console.log('Employees response:', emp.slice(0, 100));
    } catch (e) {
      console.error('Employees failed', e.message);
    }
  } catch (e) {
    console.error('Login failed', e.message);
  }
}
main();
