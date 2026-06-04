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
  });
});
