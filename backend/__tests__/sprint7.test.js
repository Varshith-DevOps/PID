const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Sprint 7: Talent Ops & Learning Upgrades', () => {
  let adminToken;
  let employee;
  let employeeToken;

  beforeAll(async () => {
    // Authenticate
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hrms.com', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const empLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rajesh.kumar@company.com', password: 'employee123' });
    employeeToken = empLogin.body.token;

    employee = await prisma.employee.findFirst({ where: { email: 'rajesh.kumar@company.com' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('LMS Certificate Download API', () => {
    let mockCertificate;
    let mockEnrollment;

    beforeAll(async () => {
      // Find or create a learning course
      let course = await prisma.learningCourse.findFirst();
      if (!course) {
        course = await prisma.learningCourse.create({
          data: {
            title: 'Test Training Course',
            description: 'Course description',
            certificateAvailable: true,
            status: 'PUBLISHED',
          }
        });
      }

      // Create enrollment and certificate
      mockEnrollment = await prisma.learningEnrollment.findFirst({
        where: { employeeId: employee.id, courseId: course.id }
      });
      if (!mockEnrollment) {
        mockEnrollment = await prisma.learningEnrollment.create({
          data: {
            employeeId: employee.id,
            courseId: course.id,
            status: 'COMPLETED',
            progress: 100,
          }
        });
      }

      mockCertificate = await prisma.certificate.findFirst({
        where: { employeeId: employee.id, courseId: course.id }
      });
      if (!mockCertificate) {
        mockCertificate = await prisma.certificate.create({
          data: {
            employeeId: employee.id,
            courseId: course.id,
            enrollmentId: mockEnrollment.id,
            certificateNumber: `PID-TEST-CERT-${Date.now()}`,
            employeeName: 'Rajesh Kumar',
            courseName: course.title,
            completionDate: new Date(),
          }
        });
      }
    });

    it('should download the certificate PDF successfully', async () => {
      const res = await request(app)
        .get(`/api/learning/certificates/${mockCertificate.id}/download`)
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('should return 404 for a non-existent certificate ID', async () => {
      const res = await request(app)
        .get('/api/learning/certificates/invalid-uuid-here/download')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('9-Box Talent Grid Manual Overrides API', () => {
    let testReview;

    beforeAll(async () => {
      // Find reviewer
      let reviewerEmp = await prisma.employee.findFirst({ where: { email: 'admin@hrms.com' } });
      if (!reviewerEmp) {
        reviewerEmp = await prisma.employee.findFirst({ where: { NOT: { id: employee.id } } });
      }

      // Create performance review 9box
      testReview = await prisma.performanceReview9Box.create({
        data: {
          employeeId: employee.id,
          reviewerId: reviewerEmp.id,
          cycleName: 'Annual 2026',
          performanceRating: 2,
          potentialRating: 2,
          boxPlacement: 5,
          status: 'COMPLETED',
          companyId: employee.companyId
        }
      });
    });

    afterAll(async () => {
      if (testReview) {
        await prisma.performanceReview9Box.delete({ where: { id: testReview.id } });
      }
    });

    it('should allow supervisor/admin to override the grid position with review notes', async () => {
      const res = await request(app)
        .post(`/api/appraisals/9box-override/${testReview.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          overrideBoxPlacement: 9,
          reviewNotes: 'High potential leader candidate override.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.review.overrideBoxPlacement).toBe(9);
      expect(res.body.review.reviewNotes).toBe('High potential leader candidate override.');
    });

    it('should clear override if overrideBoxPlacement is set to 0 or null', async () => {
      const res = await request(app)
        .post(`/api/appraisals/9box-override/${testReview.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          overrideBoxPlacement: 0,
          reviewNotes: ''
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.review.overrideBoxPlacement).toBeNull();
    });
  });
});
