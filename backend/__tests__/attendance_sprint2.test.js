const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Attendance Wi-Fi Verification & Biometric webhook Sync', () => {
  let employeeToken;
  let employee;
  let company;

  beforeAll(async () => {
    // The biometric webhook now fails closed unless BIOMETRIC_API_KEY is set;
    // configure it for the duration of this suite so the flow can be validated.
    process.env.BIOMETRIC_API_KEY = 'TEST_SECRET';

    // Get employee details
    employee = await prisma.employee.findFirst({
      where: { email: 'rajesh.kumar@company.com' }
    });

    company = await prisma.company.findUnique({
      where: { id: employee.companyId }
    });

    // Clear login audit logs to avoid anomalous geo-velocity blocks from prior tests
    await prisma.auditLog.deleteMany({
      where: {
        userId: employee.userId,
        action: { in: ['AUTH_LOGIN_SUCCESS', 'AUTH_PASSKEY_LOGIN_SUCCESS', 'AUTH_SSO_LOGIN_SUCCESS', 'AUTH_LOGIN_ANOMALOUS_GEO_VELOCITY'] }
      }
    });

    // Disable IP and geo restrictions on employee's shifts for local test checking
    const activeAssignments = await prisma.shiftAssignment.findMany({
      where: { employeeId: employee.id },
      include: { shiftType: true }
    });
    for (const a of activeAssignments) {
      if (a.shiftType) {
        await prisma.shiftType.update({
          where: { id: a.shiftTypeId },
          data: { ipRestricted: false, geoRestricted: false }
        });
      }
    }

    // Log in to get employee credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    
    employeeToken = loginRes.body.token;

    // Clean up any existing Wi-Fi rules or biometric logs for this company
    await prisma.whiteListedWiFi.deleteMany({ where: { companyId: company.id } });
    await prisma.biometricRawLog.deleteMany({ where: { companyId: company.id } });
  });

  afterAll(async () => {
    delete process.env.BIOMETRIC_API_KEY;
    await prisma.whiteListedWiFi.deleteMany({ where: { companyId: company.id } });
    await prisma.biometricRawLog.deleteMany({ where: { companyId: company.id } });
    await prisma.$disconnect();
  });

  describe('Wi-Fi Whitelist Verification on Check-In', () => {
    it('should allow check-in normally when no whitelisted Wi-Fi is configured', async () => {
      // Delete existing check-ins to make sure check-in works
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: today } });

      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId: employee.id, timestamp: new Date().toISOString() });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'PRESENT');
    });

    it('should reject check-in if whitelisted Wi-Fi is configured but not provided in request', async () => {
      // 1. Configure whitelisted Wi-Fi
      await prisma.whiteListedWiFi.create({
        data: {
          companyId: company.id,
          ssid: 'Office-Staff-5G',
          bssid: 'aa:bb:cc:dd:ee:ff',
          notes: 'Main Router'
        }
      });

      // Clear attendance record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: today } });

      // 2. Perform check-in without Wi-Fi params
      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId: employee.id, timestamp: new Date().toISOString() });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You must be connected to a corporate Wi-Fi network');
    });

    it('should reject check-in if incorrect SSID or BSSID is provided', async () => {
      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId: employee.id, ssid: 'Home-WiFi', bssid: '11:22:33:44:55:66', timestamp: new Date().toISOString() });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You are not connected to a whitelisted corporate Wi-Fi network');
    });

    it('should allow check-in if correct SSID and BSSID are provided (case-insensitive for SSID)', async () => {
      const res = await request(app)
        .post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ employeeId: employee.id, ssid: 'office-staff-5g', bssid: 'aa:bb:cc:dd:ee:ff', timestamp: new Date().toISOString() });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'PRESENT');
    });
  });

  describe('Biometric Webhook Gateway sync', () => {
    it('should reject webhook push with invalid or missing API key', async () => {
      const res = await request(app)
        .post('/api/attendance/sync/biometric-webhook')
        .send({ companyId: company.id, logs: [] });

      expect(res.status).toBe(401);
    });

    it('should process biometric push logs, create RawLog entry, and sync attendance', async () => {
      // 1. Set biometric ID on Employee
      await prisma.employee.update({
        where: { id: employee.id },
        data: { biometricId: 'BIO-105' }
      });

      // Clear today's attendance to test IN punch
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });

      const logTimestamp = new Date();
      logTimestamp.setHours(9, 10, 0, 0); // 9:10 AM checkin

      // 2. Post logs to biometric webhook
      const res = await request(app)
        .post('/api/attendance/sync/biometric-webhook?apiKey=TEST_SECRET')
        .send({
          companyId: company.id,
          logs: [
            {
              deviceSerial: 'DS100XX',
              biometricId: 'BIO-105',
              timestamp: logTimestamp.toISOString(),
              direction: 'IN'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.logsReceived).toBe(1);

      // Wait a moment for async sync to run
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Confirm Attendance row is created
      const attendance = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: today }
      });
      expect(attendance).not.toBeNull();
      expect(attendance.status).toBe('PRESENT'); // Shift start is 9:00, checked in 9:10 (within 15m grace)
      expect(attendance.markedBy).toBe('SYSTEM_BIOMETRIC');

      // 4. Test OUT punch
      const checkoutTimestamp = new Date();
      checkoutTimestamp.setHours(17, 30, 0, 0); // 5:30 PM checkout

      const outRes = await request(app)
        .post('/api/attendance/sync/biometric-webhook?apiKey=TEST_SECRET')
        .send({
          companyId: company.id,
          logs: [
            {
              deviceSerial: 'DS100XX',
              biometricId: 'BIO-105',
              timestamp: checkoutTimestamp.toISOString(),
              direction: 'OUT'
            }
          ]
        });

      expect(outRes.status).toBe(201);

      // Wait a moment for async sync to run
      await new Promise(resolve => setTimeout(resolve, 500));

      // 5. Confirm Attendance row is updated with checkout
      const updatedAttendance = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: today }
      });
      expect(updatedAttendance.checkOut).not.toBeNull();
      expect(updatedAttendance.workHours).toBeGreaterThan(0);
    });
  });
});
