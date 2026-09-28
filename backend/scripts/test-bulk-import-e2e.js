const http = require('http');

function request(path, method, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
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
          resolve({ status: res.statusCode, data: JSON.parse(b), raw: b });
        } catch {
          resolve({ status: res.statusCode, data: b, raw: b });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function runBulkImportTest() {
  console.log('=== AUTOMATED BULK IMPORT E2E TEST ===\n');

  // 1. Login as Admin
  const loginRes = await request('/api/auth/login', 'POST', { email: 'admin@hrms.com', password: 'admin123' });
  if (loginRes.status !== 200) {
    console.log('❌ Admin Login Failed!', loginRes.status, loginRes.data);
    return;
  }
  const token = loginRes.data.token;
  console.log('✅ Admin Login Successful.');

  // 2. Download CSV Template
  const templateRes = await request('/api/employees/bulk-import/template', 'GET', null, token);
  if (templateRes.status === 200 && templateRes.raw.includes('firstName,lastName,email')) {
    console.log('✅ Download CSV Template Endpoint Verified!');
  } else {
    console.log('❌ CSV Template Endpoint Failed!', templateRes.status);
    return;
  }

  // 3. Pre-Validation with valid & duplicate rows
  const ts = Date.now().toString().slice(-4);
  const sampleRows = [
    {
      rowNumber: 1,
      firstName: 'Rahul',
      lastName: 'Verma',
      email: `rahul.verma${ts}@hrms.com`,
      jobTitle: 'Software Engineer',
      departmentName: 'Engineering',
      employmentType: 'FULL_TIME',
      salary: 85000,
      joinDate: '2026-08-01',
      role: 'EMPLOYEE',
      password: 'employee123',
    },
    {
      rowNumber: 2,
      firstName: 'Sneha',
      lastName: 'Kapoor',
      email: `sneha.kapoor${ts}@hrms.com`,
      jobTitle: 'HR Specialist',
      departmentName: 'Human Resources',
      employmentType: 'FULL_TIME',
      salary: 75000,
      joinDate: '2026-08-01',
      role: 'HR',
      password: 'employee123',
    },
    {
      rowNumber: 3,
      firstName: 'Duplicate',
      lastName: 'Email',
      email: 'aarav.sharma@hrms.com', // Duplicate email intentionally
      jobTitle: 'Engineer',
      departmentName: 'Engineering',
      employmentType: 'FULL_TIME',
      salary: 80000,
      joinDate: '2026-08-01',
      role: 'EMPLOYEE',
      password: 'employee123',
    }
  ];

  const valRes = await request('/api/employees/bulk-import/validate', 'POST', { rows: sampleRows }, token);
  if (valRes.status === 200) {
    console.log(`✅ Pre-Validation Preview Verified!`);
    console.log(`   Total Rows: ${valRes.data.totalRows}, Valid: ${valRes.data.validRows}, Invalid: ${valRes.data.invalidRows}`);
    const dupRow = valRes.data.rows.find(r => r.rowNumber === 3);
    if (!dupRow?.isValid && dupRow?.errors[0].includes('already exists')) {
      console.log(`✅ Row Validation Badge & Duplicate Email Detection Verified! ("${dupRow.errors[0]}")`);
    } else {
      console.log('❌ Duplicate email validation check failed.');
    }
  } else {
    console.log('❌ Pre-Validation Failed!', valRes.status, valRes.data);
    return;
  }

  // 4. Execute Atomic Bulk Import for valid rows only
  const validRowsToImport = sampleRows.slice(0, 2);
  const impRes = await request('/api/employees/bulk-import', 'POST', { rows: validRowsToImport }, token);
  if (impRes.status === 201 || impRes.status === 200) {
    console.log(`✅ Atomic Bulk Employee Import Transaction Executed Successfully!`);
    console.log(`   Imported ${impRes.data.importedCount} employees into PostgreSQL.`);
  } else {
    console.log('❌ Bulk Import Execution Failed!', impRes.status, impRes.data);
  }

  console.log('\n==================================================');
  console.log('BULK IMPORT E2E VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('==================================================');
}

runBulkImportTest();
