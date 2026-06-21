/**
 * @fileoverview DPDP / privacy-rights controller.
 * Implements data-subject rights for India's DPDP Act (and GDPR-equivalent):
 *  - Right to access: export all personal data the system holds for an employee.
 *  - Right to erasure: anonymize personal data while RETAINING records the law
 *    requires us to keep (payroll/TDS/statutory) for the mandated retention period.
 * @module controllers/dpdpController
 */

const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const { canAccessEmployee, isHr } = require('../services/accessControl');
const { generateTempPassword } = require('../services/validators');

/**
 * Right to access — return a complete export of an employee's personal data.
 * Allowed for the employee themselves or HR/Admin (via canAccessEmployee).
 */
const exportEmployeeData = async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployee(req.user, id))) {
      return res.status(403).json({ error: 'Access denied for requested employee data export' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } },
        addresses: true,
        education: true,
        experience: true,
        dependents: true,
        bankDetails: true,
        pfDetails: true,
        salaryStructure: true,
        salaryRevisions: true,
        documents: { select: { id: true, name: true, type: true, createdAt: true } }, // metadata only
        changeHistory: true,
        user: { select: { email: true, role: true, lastLoginAt: true, mfaEnabled: true } },
      },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Related operational/financial records held about the subject.
    const [attendance, leave, payrollRecords, expenses, timesheets] = await Promise.all([
      prisma.attendance.findMany({ where: { employeeId: id } }),
      prisma.leave.findMany({ where: { employeeId: id } }),
      prisma.payrollRecord.findMany({ where: { employeeId: id } }),
      prisma.expenseClaim.findMany({ where: { employeeId: id } }).catch(() => []),
      prisma.timesheet.findMany({ where: { employeeId: id } }).catch(() => []),
    ]);

    const exportPayload = {
      generatedFor: { employeeId: id, requestedBy: req.user?.email || req.user?.id },
      profile: employee,
      attendance,
      leave,
      payrollRecords,
      expenses,
      timesheets,
      notice: 'This export contains personal data held about you under the DPDP Act. PII fields are decrypted for the data subject.',
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="data-export-${id}.json"`);
    res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (error) {
    console.error('[DPDP EXPORT ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to export employee data' });
  }
};

/**
 * Right to erasure — anonymize an employee's PII while preserving statutory
 * records (payroll/TDS). Admin/HR only. Idempotent-ish (re-running re-anonymizes).
 */
const anonymizeEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isHr(req.user) && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only HR/Admin can erase personal data' });
    }

    const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const token = id.slice(0, 8);
    await prisma.$transaction(async (tx) => {
      // 1. Delete pure-PII sub-records (no statutory retention requirement).
      await tx.employeeAddress.deleteMany({ where: { employeeId: id } });
      await tx.education.deleteMany({ where: { employeeId: id } });
      await tx.professionalExperience.deleteMany({ where: { employeeId: id } });
      await tx.dependent.deleteMany({ where: { employeeId: id } });
      await tx.bankDetails.deleteMany({ where: { employeeId: id } });
      await tx.pFDetails.deleteMany({ where: { employeeId: id } }); // delegate is pFDetails (PFDetails model)

      // 2. Scrub PII scalars on the employee; KEEP the row so payroll/TDS FKs hold.
      await tx.employee.update({
        where: { id },
        data: {
          firstName: 'Redacted', lastName: 'User',
          email: `anonymized+${token}@redacted.local`,
          phone: null, dateOfBirth: null, gender: null, photoUrl: null,
          address: null, nationality: null, bloodGroup: null, maritalStatus: null,
          personalEmail: null, panNumber: null, aadharNumber: null,
          emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelation: null,
          isActive: false, anonymizedAt: new Date(),
        },
      });

      // 3. Disable the linked login and revoke all its sessions.
      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: {
            email: `anonymized+${token}@redacted.local`,
            password: await bcrypt.hash(generateTempPassword(), 10),
            isActive: false,
            mfaSecret: null,
            mfaRecoveryCodes: null,
            tokenVersion: { increment: 1 },
          },
        });
      }
    });

    res.json({
      message: 'Personal data erased (anonymized). Statutory payroll/TDS records were retained as required by law.',
      employeeId: id,
      anonymizedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DPDP ERASE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to erase personal data' });
  }
};

module.exports = { exportEmployeeData, anonymizeEmployee };
