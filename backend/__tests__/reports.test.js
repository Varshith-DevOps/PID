/**
 * @fileoverview Integration tests for Reporting & Workforce Analytics Module.
 * @module __tests__/reports.test
 */

const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('HRMS Reports & Analytics Module', () => {
  let adminToken;
  let employeeToken;

  beforeAll(async () => {
    // Authenticate Admin User
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminRes.headers['set-cookie'] 
      ? adminRes.headers['set-cookie'][0].split(';')[0].split('=')[1]
      : adminRes.body.token;

    // Authenticate standard employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empRes.headers['set-cookie']
      ? empRes.headers['set-cookie'][0].split(';')[0].split('=')[1]
      : empRes.body.token;
  });

  describe('GET /api/reports/dashboards/:role', () => {
    it('should retrieve CHRO dashboard stats for Admin', async () => {
      const res = await request(app)
        .get('/api/reports/dashboards/chro')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalEmployees');
      expect(res.body).toHaveProperty('diversityRatio');
      expect(res.body).toHaveProperty('payrollCost');
      expect(res.body.payrollCost).not.toBe('CONFIDENTIAL');
    });

    it('should mask payroll costs in dashboard stats for non-admin/managers', async () => {
      const res = await request(app)
        .get('/api/reports/dashboards/chro')
        .set('Cookie', `token=${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.payrollCost).toBe('CONFIDENTIAL');
    });
  });

  describe('POST /api/reports/query (Dynamic Query Builder)', () => {
    it('should build dynamic filter queries successfully', async () => {
      const res = await request(app)
        .post('/api/reports/query')
        .set('Cookie', `token=${adminToken}`)
        .send({
          columns: ['employeeId', 'firstName', 'lastName', 'gender', 'salary'],
          filters: [
            { field: 'gender', operator: 'EQUALS', value: 'FEMALE' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach(emp => {
        expect(emp.gender).toBe('FEMALE');
        expect(emp.salary).not.toBe('CONFIDENTIAL');
      });
    });
  });

  describe('GET /api/reports/statutory/:type', () => {
    it('should compute EPF compliance values correctly with capped wages', async () => {
      const res = await request(app)
        .get('/api/reports/statutory/epf')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      
      const records = res.body.data;
      expect(records.length).toBeGreaterThan(0);

      // Verify mathematical PF Cap at 15000
      records.forEach(rec => {
        expect(rec).toHaveProperty('uan');
        expect(rec).toHaveProperty('pfWages');
        if (rec.pfWages !== 'CONFIDENTIAL') {
          expect(rec.pfWages).toBeLessThanOrEqual(15000);
          expect(rec.employeePf).toBe(Math.round(rec.pfWages * 0.12));
        }
      });
    });

    it('should restrict ESI report only to employees with salary <= 21000', async () => {
      const res = await request(app)
        .get('/api/reports/statutory/esi')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');

      res.body.data.forEach(rec => {
        if (rec.esiWages !== 'CONFIDENTIAL') {
          expect(rec.esiWages).toBeLessThanOrEqual(21000);
          expect(rec.employeeContribution).toBe(Math.round(rec.esiWages * 0.0075 * 100) / 100);
        }
      });
    });

    it('should generate gender pay gap details grouped by department', async () => {
      const res = await request(app)
        .get('/api/reports/statutory/gender-pay-gap')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      res.body.data.forEach(dept => {
        expect(dept).toHaveProperty('department');
        expect(dept).toHaveProperty('genderGapPercent');
      });
    });

    it('should generate POSH stats dynamically', async () => {
      const res = await request(app)
        .get('/api/reports/statutory/posh')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('femaleWorkforcePercentage');
      expect(res.body.data).toHaveProperty('poshTrainingCompletionRate');
      expect(res.body.data).toHaveProperty('poshCommitteeMembersCount');
    });

    it('should generate minimum wage compliance reports with state info', async () => {
      const res = await request(app)
        .get('/api/reports/statutory/minwage')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      res.body.data.forEach(rec => {
        expect(rec).toHaveProperty('state');
        expect(rec).toHaveProperty('minimumWage');
        expect(rec).toHaveProperty('complianceStatus');
      });
    });
  });

  describe('GET /api/reports/dashboards/compliance', () => {
    it('should retrieve compliance dashboard stats with dynamic percentages', async () => {
      const res = await request(app)
        .get('/api/reports/dashboards/compliance')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pfCompliancePercent');
      expect(res.body).toHaveProperty('esiCompliancePercent');
      expect(res.body).toHaveProperty('ptCompliancePercent');
      expect(res.body).toHaveProperty('lwfCompliancePercent');
      expect(res.body).toHaveProperty('pendingFilingsCount');
    });
  });

  describe('GET /api/reports/payroll/variance', () => {
    it('should retrieve payroll cost variance data', async () => {
      const res = await request(app)
        .get('/api/reports/payroll/variance')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach(m => {
        expect(m).toHaveProperty('month');
        expect(m).toHaveProperty('totalCost');
        expect(m).toHaveProperty('employeeCount');
      });
    });
  });

  describe('Compliance & Audit Report Center', () => {
    it('should expose an India-focused audit report catalog', async () => {
      const res = await request(app)
        .get('/api/reports/audit/catalog')
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
      expect(res.body.data.map(item => item.id)).toContain('monthly-statutory-pack');
      expect(res.body.data.map(item => item.id)).toContain('access-security-audit-pack');
    });

    it('should load audit center metrics, risks, obligations, and audit trails', async () => {
      const res = await request(app)
        .get('/api/reports/audit/center')
        .set('Cookie', `token=${adminToken}`)
        .query({ month: 5, year: 2026, financialYear: '2026-27' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('statutoryChecks');
      expect(res.body).toHaveProperty('operationalControls');
      expect(res.body).toHaveProperty('generatedReports');
      expect(res.body).toHaveProperty('privilegedUsers');
      expect(Array.isArray(res.body.riskItems)).toBe(true);
    });

    it('should generate and sign off audit pack metadata with audit logging', async () => {
      const generated = await request(app)
        .post('/api/reports/audit/generate')
        .set('Cookie', `token=${adminToken}`)
        .send({ packType: 'internal-hr-audit-pack', month: 5, year: 2026, financialYear: '2026-27' });

      expect(generated.status).toBe(201);
      expect(generated.body.report.type).toContain('AUDIT_PACK_INTERNAL_HR_AUDIT_PACK');
      expect(generated.body).toHaveProperty('snapshot');

      const signedOff = await request(app)
        .patch(`/api/reports/audit/runs/${generated.body.report.id}/status`)
        .set('Cookie', `token=${adminToken}`)
        .send({ status: 'SIGNED_OFF', remarks: 'QA signoff test' });

      expect(signedOff.status).toBe(200);
      expect(signedOff.body.report.status).toBe('SIGNED_OFF');
    });

    it('should export a multi-sheet XLSX audit evidence pack', async () => {
      const res = await request(app)
        .post('/api/reports/audit/export')
        .set('Cookie', `token=${adminToken}`)
        .send({ packType: 'monthly-statutory-pack', month: 5, year: 2026, financialYear: '2026-27' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should block audit pack generation for users without export permission', async () => {
      const res = await request(app)
        .post('/api/reports/audit/generate')
        .set('Cookie', `token=${employeeToken}`)
        .send({ packType: 'monthly-statutory-pack', month: 5, year: 2026, financialYear: '2026-27' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/reports/export', () => {
    it('should generate and return binary xlsx excel stream', async () => {
      const res = await request(app)
        .post('/api/reports/export')
        .set('Cookie', `token=${adminToken}`)
        .send({ reportType: 'general' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should export any supported report as CSV', async () => {
      const res = await request(app)
        .post('/api/reports/export')
        .set('Cookie', `token=${adminToken}`)
        .send({ reportType: 'statutory:epf', format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('employeeId');
      expect(res.text).toContain('uan');
    });

    it('should export any supported report as PDF', async () => {
      const res = await request(app)
        .post('/api/reports/export')
        .set('Cookie', `token=${adminToken}`)
        .send({ reportType: 'payroll:register', format: 'pdf' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('should reject unsupported export formats', async () => {
      const res = await request(app)
        .post('/api/reports/export')
        .set('Cookie', `token=${adminToken}`)
        .send({ reportType: 'employee-master', format: 'xml' });

      expect(res.status).toBe(400);
    });
  });
});
