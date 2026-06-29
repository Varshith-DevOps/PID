/**
 * @fileoverview Employee management controller.
 * Provides CRUD operations for employees along with sub-resource management
 * for addresses, education, experience, bank details, PF, exit details,
 * dependents, salary revisions, and photo uploads.
 * All changes to employee data are tracked via the ChangeHistory audit log.
 * @module controllers/employeeController
 */

const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');
const { validatePAN, validateIFSC, validateAadhaar, validateUAN, validateBankAccount } = require('../services/validators');
const { canAccessEmployee, getLinkedEmployeeId, isHr, isPayroll } = require('../services/accessControl');
const { assertPayrollRangeOpen, assertPayrollPeriodOpen } = require('../services/payrollPeriodGuard');
const { getUploadRoot } = require('../config/storage');

/**
 * Log a field-level change to the ChangeHistory audit trail.
 * Skips logging if old and new values are identical.
 * @param {string} employeeId - The employee being changed
 * @param {string} changedBy - Email/ID of the user making the change
 * @param {string} entity - Category of change (e.g., 'Personal', 'Bank')
 * @param {string} field - The specific field that changed
 * @param {*} oldValue - Previous value
 * @param {*} newValue - New value
 * @param {string} reason - Reason for the change
 */
const logChange = async (employeeId, changedBy, entity, field, oldValue, newValue, reason) => {
  if (oldValue === newValue) return; // No change
  try {
    await prisma.changeHistory.create({
      data: {
        employeeId,
        changedBy: changedBy || 'system',
        entity,
        field,
        oldValue: oldValue ? String(oldValue) : null,
        newValue: newValue ? String(newValue) : null,
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    console.error('LOG CHANGE ERROR:', error);
  }
};
const employeeIncludes = {
  department: true,
  manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  subordinates: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
};

const employeeFullIncludes = {
  department: true,
  manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  subordinates: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
  documents: { orderBy: { createdAt: 'desc' } },
  addresses: { orderBy: { type: 'asc' } },
  education: { orderBy: { yearOfPassing: 'desc' } },
  experience: { orderBy: { fromDate: 'desc' } },
  salaryRevisions: { orderBy: { effectiveDate: 'desc' } },
  salaryStructure: true,
  user: { select: { id: true, email: true, role: true } },
  bankDetails: true,
  pfDetails: true,
  exitDetails: true,
  dependents: { orderBy: { createdAt: 'asc' } },
  changeHistory: { orderBy: { createdAt: 'desc' } },
};

const assertEmployeeAccess = async (req, res, employeeId, action = 'modify') => {
  if (!(await canAccessEmployee(req.user, employeeId))) {
    res.status(403).json({ error: `Access denied. You cannot ${action} this employee record.` });
    return false;
  }
  return true;
};

const getChangeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await assertEmployeeAccess(req, res, id, 'view history for'))) return;
    const history = await prisma.changeHistory.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const { departmentId, search, gender, location, page = 1, limit = 250 } = req.query;
    const where = { isActive: true };

    if (departmentId) where.departmentId = departmentId;
    if (gender) where.gender = gender;
    if (location) where.location = { contains: location };

    // Role-based filtering: Managers should only see their direct subordinates in listings unless they are Admin/HR/SuperAdmin
    if (req.user && req.user.role === 'MANAGER') {
      const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (managerEmp) {
        where.managerId = managerEmp.id;
      } else {
        where.id = 'none'; // Return empty list if manager has no employee profile
      }
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: employeeIncludes,
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.employee.count({ where });

    res.json({ employees, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployee(req.user, id))) {
      return res.status(403).json({ error: 'Access denied for requested employee profile' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: employeeFullIncludes,
    });

    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const ownEmployeeId = await getLinkedEmployeeId(req.user);
    const canSeeSensitive = isHr(req.user) || isPayroll(req.user) || ownEmployeeId === id;
    if (!canSeeSensitive) {
      employee.salary = null;
      employee.annualCTC = null;
      employee.bonusPercent = null;
      employee.panNumber = employee.panNumber ? `XXXXX${employee.panNumber.slice(-4)}` : null;
      employee.aadharNumber = employee.aadharNumber ? `XXXXXXXX${employee.aadharNumber.slice(-4)}` : null;
      employee.salaryStructure = null;
      employee.salaryRevisions = [];
      employee.bankDetails = null;
      employee.pfDetails = null;
      employee.documents = [];
      employee.changeHistory = [];
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createEmployee = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dateOfBirth, gender, address, nationality,
      jobTitle, departmentId, employmentType, joinDate, salary, managerId,
      bloodGroup, maritalStatus, personalEmail, panNumber, aadharNumber,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      photoUrl, accountStage, shiftTypeId
    } = req.body;

    if (!firstName || !lastName || !email || !jobTitle || !departmentId || !salary) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    if (panNumber && !validatePAN(panNumber)) {
      return res.status(400).json({ error: 'Invalid PAN Number format (must be 5 uppercase letters, 4 digits, 1 uppercase letter)' });
    }
    if (aadharNumber && !validateAadhaar(aadharNumber)) {
      return res.status(400).json({ error: 'Invalid Aadhaar Number (must be 12 digits matching Verhoeff checksum and cannot start with 0 or 1)' });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    // Enforce the subscription plan's employee cap (usage-limit enforcement).
    if (req.user?.companyId) {
      const activeSub = await prisma.subscription.findFirst({
        where: { companyId: req.user.companyId, status: 'ACTIVE' },
        include: { plan: true },
        orderBy: { endDate: 'desc' },
      });
      const limit = activeSub?.plan?.employeeLimit;
      if (limit && limit > 0) {
        const activeCount = await prisma.employee.count({ where: { isActive: true } });
        if (activeCount >= limit) {
          return res.status(403).json({
            error: `Your plan allows ${limit} employees and you've reached that limit. Upgrade your plan to add more.`,
            limitReached: true,
          });
        }
      }
    }

    // Link or create a corresponding User login record
    const existingUser = await prisma.user.findUnique({ where: { email } });
    let userId = existingUser ? existingUser.id : null;
    let temporaryPassword = null;

    if (!existingUser) {
      const { hashPassword } = require('../utils/password');
      const { generateTempPassword } = require('../services/validators');
      temporaryPassword = generateTempPassword();
      const hashedPassword = await hashPassword(temporaryPassword);

      const { getDefaultPermissions } = require('./permissionController');

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: `${firstName} ${lastName}`,
          role: 'EMPLOYEE',
          mustChangePassword: true,
          permissions: {
            create: getDefaultPermissions('EMPLOYEE'),
          },
        },
      });
      userId = user.id;
    }

    const count = await prisma.employee.count();
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        employeeId,
        userId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        photoUrl: photoUrl || null,
        accountStage: accountStage || 'EMPLOYEE',
        address: address || null,
        nationality: nationality || null,
        jobTitle,
        departmentId,
        employmentType: employmentType || 'FULL_TIME',
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        salary: parseFloat(salary),
        managerId: managerId || null,
        bloodGroup: bloodGroup || null,
        maritalStatus: maritalStatus || null,
        personalEmail: personalEmail || null,
        panNumber: panNumber || null,
        aadharNumber: aadharNumber || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
      },
      include: employeeIncludes,
    });

    // Auto-assign shift if provided during onboarding
    if (shiftTypeId) {
      await prisma.shiftAssignment.create({
        data: {
          employeeId: employee.id,
          shiftTypeId,
          startDate: joinDate ? new Date(joinDate) : new Date(),
          changedBy: req.user?.email || req.user?.role || 'SYSTEM',
          changeReason: 'Shift assigned during onboarding',
        },
      });
    }

    // Surface the one-time temporary password so the admin can deliver it to the
    // new employee. The account is flagged mustChangePassword and will be forced
    // to set a new password on first login.
    res.status(201).json(temporaryPassword ? { ...employee, temporaryPassword } : employee);
  } catch (error) {
    console.error('CREATE EMPLOYEE ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, email, phone, dateOfBirth, gender, address, nationality,
      jobTitle, departmentId, employmentType, joinDate, salary, managerId, isActive,
      bloodGroup, maritalStatus, personalEmail, panNumber, aadharNumber,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      photoUrl, accountStage, annualCTC, bonusPercent, changeReason
    } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await assertEmployeeAccess(req, res, id, 'update'))) return;

    if (joinDate) await assertPayrollPeriodOpen(joinDate, 'Joining date update');
    if (salary !== undefined || annualCTC !== undefined || bonusPercent !== undefined || departmentId || managerId !== undefined || isActive !== undefined) {
      await assertPayrollPeriodOpen(new Date(), 'Employee payroll-impacting profile update');
    }

    if (panNumber && !validatePAN(panNumber)) {
      return res.status(400).json({ error: 'Invalid PAN Number format (must be 5 uppercase letters, 4 digits, 1 uppercase letter)' });
    }
    if (aadharNumber && !validateAadhaar(aadharNumber)) {
      return res.status(400).json({ error: 'Invalid Aadhaar Number (must be 12 digits matching Verhoeff checksum and cannot start with 0 or 1)' });
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender !== undefined && { gender: gender || null }),
        ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
        ...(accountStage !== undefined && { accountStage }),
        ...(address !== undefined && { address: address || null }),
        ...(nationality !== undefined && { nationality: nationality || null }),
        ...(jobTitle && { jobTitle }),
        ...(departmentId && { departmentId }),
        ...(employmentType && { employmentType }),
        ...(joinDate && { joinDate: new Date(joinDate) }),
        ...(salary && { salary: parseFloat(salary) }),
        ...(managerId !== undefined && { managerId: managerId || null }),
        ...(isActive !== undefined && { isActive }),
        ...(bloodGroup !== undefined && { bloodGroup: bloodGroup || null }),
        ...(maritalStatus !== undefined && { maritalStatus: maritalStatus || null }),
        ...(personalEmail !== undefined && { personalEmail: personalEmail || null }),
        ...(panNumber !== undefined && { panNumber: panNumber || null }),
        ...(aadharNumber !== undefined && { aadharNumber: aadharNumber || null }),
        ...(emergencyContactName !== undefined && { emergencyContactName: emergencyContactName || null }),
        ...(emergencyContactPhone !== undefined && { emergencyContactPhone: emergencyContactPhone || null }),
        ...(emergencyContactRelation !== undefined && { emergencyContactRelation: emergencyContactRelation || null }),
        ...(annualCTC !== undefined && { annualCTC: annualCTC ? parseFloat(annualCTC) : null }),
        ...(bonusPercent !== undefined && { bonusPercent: bonusPercent ? parseFloat(bonusPercent) : null }),
      },
      include: employeeFullIncludes,
    });

    // Log changes for any field passed in body
    const fieldsToLog = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'jobTitle', 'departmentId', 'employmentType', 'joinDate', 'bloodGroup', 'maritalStatus', 'personalEmail', 'panNumber', 'aadharNumber', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'accountStage'];
    for (const f of fieldsToLog) {
      if (req.body[f] !== undefined) {
        let oldV = employee[f];
        let newV = req.body[f];
        if (oldV instanceof Date) oldV = oldV.toISOString().split('T')[0];
        if (f === 'dateOfBirth' || f === 'joinDate') {
           newV = new Date(newV).toISOString().split('T')[0];
        }
        if (String(oldV) !== String(newV)) {
          await logChange(id, req.user?.email, 'Personal/Professional', f, oldV, newV, changeReason);
        }
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('UPDATE EMPLOYEE ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await assertEmployeeAccess(req, res, id, 'deactivate'))) return;
    await assertPayrollPeriodOpen(new Date(), 'Employee deactivation');

    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Employee deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Address CRUD ────
const addAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, line1, line2, city, state, pincode, country, changeReason } = req.body;
    if (!line1 || !city || !state || !pincode) return res.status(400).json({ error: 'Address fields required' });
    if (!(await assertEmployeeAccess(req, res, id, 'add addresses for'))) return;

    const address = await prisma.employeeAddress.create({
      data: { employeeId: id, type: type || 'CURRENT', line1, line2, city, state, pincode, country: country || 'India' },
    });
    await logChange(id, req.user?.email, 'Address', 'details', 'None', 'Created', changeReason);
    res.status(201).json(address);
  } catch (error) {
    console.error('ADD ADDRESS ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { type, line1, line2, city, state, pincode, country, changeReason } = req.body;
    
    const existing = await prisma.employeeAddress.findUnique({ where: { id: addressId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'update addresses for'))) return;
    
    const address = await prisma.employeeAddress.update({
      where: { id: addressId },
      data: {
        ...(type && { type }),
        ...(line1 && { line1 }),
        ...(line2 !== undefined && { line2 }),
        ...(city && { city }),
        ...(state && { state }),
        ...(pincode && { pincode }),
        ...(country && { country }),
      },
    });
    await logChange(existing.employeeId, req.user?.email, 'Address', 'details', 'Updated', 'Updated', changeReason);
    res.json(address);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const existing = await prisma.employeeAddress.findUnique({ where: { id: addressId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'delete addresses for'))) return;
    await prisma.employeeAddress.delete({ where: { id: addressId } });
    res.json({ message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Education CRUD ────
const addEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const { degree, specialization, institution, university, yearOfPassing, percentage } = req.body;
    if (!degree || !institution || !yearOfPassing) return res.status(400).json({ error: 'Degree, institution, and year required' });
    if (!(await assertEmployeeAccess(req, res, id, 'add education for'))) return;

    const edu = await prisma.education.create({
      data: { employeeId: id, degree, specialization, institution, university, yearOfPassing: parseInt(yearOfPassing), percentage: percentage ? parseFloat(percentage) : null },
    });
    res.status(201).json(edu);
  } catch (error) {
    console.error('ADD EDUCATION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateEducation = async (req, res) => {
  try {
    const { eduId } = req.params;
    const { degree, specialization, institution, university, yearOfPassing, percentage } = req.body;
    const existing = await prisma.education.findUnique({ where: { id: eduId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'update education for'))) return;
    const edu = await prisma.education.update({
      where: { id: eduId },
      data: {
        ...(degree && { degree }),
        ...(specialization !== undefined && { specialization }),
        ...(institution && { institution }),
        ...(university !== undefined && { university }),
        ...(yearOfPassing && { yearOfPassing: parseInt(yearOfPassing) }),
        ...(percentage !== undefined && { percentage: percentage ? parseFloat(percentage) : null }),
      },
    });
    res.json(edu);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteEducation = async (req, res) => {
  try {
    const { eduId } = req.params;
    const existing = await prisma.education.findUnique({ where: { id: eduId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'delete education for'))) return;
    await prisma.education.delete({ where: { id: eduId } });
    res.json({ message: 'Education record deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Experience CRUD ────
const addExperience = async (req, res) => {
  try {
    const { id } = req.params;
    const { company, designation, fromDate, toDate, description } = req.body;
    if (!company || !designation || !fromDate) return res.status(400).json({ error: 'Company, designation, and start date required' });
    if (!(await assertEmployeeAccess(req, res, id, 'add experience for'))) return;

    const exp = await prisma.professionalExperience.create({
      data: { employeeId: id, company, designation, fromDate: new Date(fromDate), toDate: toDate ? new Date(toDate) : null, description },
    });
    res.status(201).json(exp);
  } catch (error) {
    console.error('ADD EXPERIENCE ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateExperience = async (req, res) => {
  try {
    const { expId } = req.params;
    const { company, designation, fromDate, toDate, description } = req.body;
    const existing = await prisma.professionalExperience.findUnique({ where: { id: expId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'update experience for'))) return;
    const exp = await prisma.professionalExperience.update({
      where: { id: expId },
      data: {
        ...(company && { company }),
        ...(designation && { designation }),
        ...(fromDate && { fromDate: new Date(fromDate) }),
        ...(toDate !== undefined && { toDate: toDate ? new Date(toDate) : null }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(exp);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteExperience = async (req, res) => {
  try {
    const { expId } = req.params;
    const existing = await prisma.professionalExperience.findUnique({ where: { id: expId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'delete experience for'))) return;
    await prisma.professionalExperience.delete({ where: { id: expId } });
    res.json({ message: 'Experience record deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};


// ──── Bank Details ────
const upsertBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { bankName, accountNumber, ifscCode, branchName, accountType, changeReason } = req.body;
    if (!bankName || !accountNumber || !ifscCode) {
      return res.status(400).json({ error: 'Bank name, account number, and IFSC code are required' });
    }
    if (!(await assertEmployeeAccess(req, res, id, 'update bank details for'))) return;
    await assertPayrollPeriodOpen(new Date(), 'Bank detail update');

    if (!validateBankAccount(accountNumber)) {
      return res.status(400).json({ error: 'Invalid Bank Account Number (must be between 9 and 18 digits)' });
    }
    if (!validateIFSC(ifscCode)) {
      return res.status(400).json({ error: 'Invalid IFSC Code (must be 4 letters, a zero, and 6 alphanumeric characters)' });
    }

    const existing = await prisma.bankDetails.findUnique({ where: { employeeId: id } });
    let result;
    if (existing) {
      result = await prisma.bankDetails.update({
        where: { employeeId: id },
        data: { bankName, accountNumber, ifscCode, branchName: branchName || null, accountType: accountType || 'SAVINGS' },
      });
      if (existing.accountNumber !== accountNumber) await logChange(id, req.user?.email, 'Bank', 'accountNumber', existing.accountNumber, accountNumber, changeReason);
      if (existing.ifscCode !== ifscCode) await logChange(id, req.user?.email, 'Bank', 'ifscCode', existing.ifscCode, ifscCode, changeReason);
      if (existing.bankName !== bankName) await logChange(id, req.user?.email, 'Bank', 'bankName', existing.bankName, bankName, changeReason);
    } else {
        result = await prisma.bankDetails.create({
          data: { employeeId: id, bankName, accountNumber, ifscCode, branchName: branchName || null, accountType: accountType || 'SAVINGS' },
        });
        await logChange(id, req.user?.email, 'Bank', 'details', 'None', 'Created', changeReason);
      }
      res.json(result);
  } catch (error) {
    console.error('UPSERT BANK DETAILS ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── PF Details ────
const upsertPFDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { pfNumber, uanNumber, epsNumber, pfJoinDate, voluntaryPF, vpfPercentage, changeReason } = req.body;

    if (uanNumber && !validateUAN(uanNumber)) {
      return res.status(400).json({ error: 'Invalid UAN Number (must be a 12-digit number not starting with 0)' });
    }
    if (!(await assertEmployeeAccess(req, res, id, 'update PF details for'))) return;
    await assertPayrollPeriodOpen(new Date(), 'PF/statutory detail update');

    const existing = await prisma.pFDetails.findUnique({ where: { employeeId: id } });
    let result;
    if (existing) {
      result = await prisma.pFDetails.update({
        where: { employeeId: id },
        data: {
          pfNumber: pfNumber || null,
          uanNumber: uanNumber || null,
          epsNumber: epsNumber || null,
          pfJoinDate: pfJoinDate ? new Date(pfJoinDate) : null,
          voluntaryPF: voluntaryPF || false,
          vpfPercentage: vpfPercentage ? parseFloat(vpfPercentage) : null,
        },
      });
      await logChange(id, req.user?.email, 'PF', 'details', 'Updated', 'Updated', changeReason);
    } else {
      result = await prisma.pFDetails.create({
        data: {
          employeeId: id,
          pfNumber: pfNumber || null,
          uanNumber: uanNumber || null,
          epsNumber: epsNumber || null,
          pfJoinDate: pfJoinDate ? new Date(pfJoinDate) : null,
          voluntaryPF: voluntaryPF || false,
          vpfPercentage: vpfPercentage ? parseFloat(vpfPercentage) : null,
        },
      });
      await logChange(id, req.user?.email, 'PF', 'details', 'None', 'Created', changeReason);
    }
    res.json(result);
  } catch (error) {
    console.error('UPSERT PF DETAILS ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Exit Details ────
const upsertExitDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { exitType, resignationDate, lastWorkingDate, noticePeriodDays, exitReason, exitInterview, rehireEligible, fnfStatus, fnfAmount, changeReason } = req.body;
    if (!(await assertEmployeeAccess(req, res, id, 'update exit details for'))) return;
    if (resignationDate || lastWorkingDate) {
      await assertPayrollRangeOpen(resignationDate || lastWorkingDate, lastWorkingDate || resignationDate, 'Exit detail update');
    }

    const existing = await prisma.exitDetails.findUnique({ where: { employeeId: id } });
    let result;
    const data = {
      exitType: exitType || null,
      resignationDate: resignationDate ? new Date(resignationDate) : null,
      lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
      noticePeriodDays: noticePeriodDays ? parseInt(noticePeriodDays) : null,
      exitReason: exitReason || null,
      exitInterview: exitInterview || false,
      rehireEligible: rehireEligible !== undefined ? rehireEligible : true,
      fnfStatus: fnfStatus || 'PENDING',
      fnfAmount: fnfAmount ? parseFloat(fnfAmount) : null,
    };

    if (existing) {
      result = await prisma.exitDetails.update({ where: { employeeId: id }, data });
      await logChange(id, req.user?.email, 'Exit', 'details', 'Updated', 'Updated', changeReason);
    } else {
      result = await prisma.exitDetails.create({ data: { employeeId: id, ...data } });
      await logChange(id, req.user?.email, 'Exit', 'details', 'None', 'Created', changeReason);
    }
    res.json(result);
  } catch (error) {
    console.error('UPSERT EXIT DETAILS ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Dependent CRUD ────
const addDependent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relationship, dateOfBirth, gender, isNominee, nomineePercent } = req.body;
    if (!name || !relationship) return res.status(400).json({ error: 'Name and relationship are required' });
    if (!(await assertEmployeeAccess(req, res, id, 'add dependents for'))) return;

    const dep = await prisma.dependent.create({
      data: {
        employeeId: id,
        name,
        relationship,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        isNominee: isNominee || false,
        nomineePercent: nomineePercent ? parseFloat(nomineePercent) : null,
      },
    });
    res.status(201).json(dep);
  } catch (error) {
    console.error('ADD DEPENDENT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateDependent = async (req, res) => {
  try {
    const { depId } = req.params;
    const { name, relationship, dateOfBirth, gender, isNominee, nomineePercent } = req.body;
    const existing = await prisma.dependent.findUnique({ where: { id: depId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, existing.employeeId, 'update dependents for'))) return;
    const dep = await prisma.dependent.update({
      where: { id: depId },
      data: {
        ...(name && { name }),
        ...(relationship && { relationship }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender: gender || null }),
        ...(isNominee !== undefined && { isNominee }),
        ...(nomineePercent !== undefined && { nomineePercent: nomineePercent ? parseFloat(nomineePercent) : null }),
      },
    });
    res.json(dep);
  } catch (error) {
    console.error('UPDATE DEPENDENT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteDependent = async (req, res) => {
  try {
    const { depId } = req.params;
    const { inactiveRemark } = req.body;
    const dependent = await prisma.dependent.findUnique({ where: { id: depId } });
    if (!dependent) return res.status(404).json({ error: 'Not found' });
    if (!(await assertEmployeeAccess(req, res, dependent.employeeId, 'delete dependents for'))) return;
    await prisma.dependent.update({ 
      where: { id: depId },
      data: { isActive: false, inactiveRemark: inactiveRemark || 'No remark provided' }
    });
    
    await logChange(dependent.employeeId, req.user?.email, 'Dependent', 'isActive', 'true', 'false', inactiveRemark);
    res.json({ message: 'Dependent marked inactive' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Salary Revision ────
const addSalaryRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { effectiveDate, revisedSalary, reason, annualCTC, bonusPercent } = req.body;
    
    if (!effectiveDate || !revisedSalary) {
      return res.status(400).json({ error: 'Effective date and revised salary are required' });
    }

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await assertEmployeeAccess(req, res, id, 'add salary revisions for'))) return;
    await assertPayrollPeriodOpen(effectiveDate, 'Salary revision');

    const previousSalary = employee.salary;

    // 1. Create revision record
    await prisma.salaryRevision.create({
      data: {
        employeeId: id,
        effectiveDate: new Date(effectiveDate),
        previousSalary,
        revisedSalary: parseFloat(revisedSalary),
        reason,
        revisedBy: req.user.email,
      }
    });

    // 2. Update employee
    const updatedEmp = await prisma.employee.update({
      where: { id },
      data: {
        salary: parseFloat(revisedSalary),
        ...(annualCTC !== undefined && { annualCTC: annualCTC ? parseFloat(annualCTC) : null }),
        ...(bonusPercent !== undefined && { bonusPercent: bonusPercent ? parseFloat(bonusPercent) : null }),
      }
    });

    // 3. Update salary structure if exists (Payroll sync)
    const struct = await prisma.salaryStructure.findUnique({ where: { employeeId: id } });
    if (struct) {
      const s = parseFloat(revisedSalary);
      const money = (val) => Math.round((Number(val) || 0) * 100) / 100;

      if (struct.usePercentSettings) {
        let settings = await prisma.payrollSettings.findFirst();
        if (!settings) {
          settings = await prisma.payrollSettings.create({ data: {} });
        }

        const hraPercent = settings.hraPercent ?? 40.0;
        const daPercent = settings.daPercent ?? 20.0;
        const conveyancePercent = settings.conveyancePercent ?? 10.0;
        const medicalPercent = settings.medicalPercent ?? 5.0;
        const specialAllowancePercent = settings.specialAllowancePercent ?? 15.0;
        const insurancePercent = settings.insurancePercent ?? 5.0;

        // Gross = Basic * (1 + HRA% + DA% + Conveyance% + Medical% + Special%)
        const multiplier = 1 + (hraPercent + daPercent + conveyancePercent + medicalPercent + specialAllowancePercent) / 100;
        const basic = money(s / multiplier);

        await prisma.salaryStructure.update({
          where: { employeeId: id },
          data: {
            basicSalary: basic,
            hra: money(basic * hraPercent / 100),
            da: money(basic * daPercent / 100),
            conveyance: money(basic * conveyancePercent / 100),
            medical: money(basic * medicalPercent / 100),
            specialAllowance: money(basic * specialAllowancePercent / 100),
            insurance: money(basic * insurancePercent / 100),
            effectiveFrom: new Date(effectiveDate)
          }
        });
      } else {
        await prisma.salaryStructure.update({
          where: { employeeId: id },
          data: {
            basicSalary: s * 0.4,
            hra: s * 0.2,
            specialAllowance: s * 0.4,
            effectiveFrom: new Date(effectiveDate)
          }
        });
      }
    }

    res.json({ message: 'Salary revised successfully', employee: updatedEmp });
  } catch (error) {
    console.error('ADD SALARY REVISION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ──── Photo Upload ────
const uploadEmployeePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await assertEmployeeAccess(req, res, id, 'upload photos for'))) return;

    // Delete old photo if exists (with path traversal protection)
    if (employee.photoUrl) {
      const uploadsDir = getUploadRoot();
      const oldPath = path.resolve(employee.photoUrl);
      if (oldPath.startsWith(uploadsDir) && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { photoUrl: req.file.path },
    });
    res.json({ photoUrl: updated.photoUrl });
  } catch (error) {
    console.error('UPLOAD PHOTO ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateAccountStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountStage } = req.body;
    const validStages = ['ONBOARDING', 'EMPLOYEE', 'OFFBOARDING', 'TERMINATED', 'MANAGER', 'ADMIN', 'INACTIVE'];
    if (!accountStage || !validStages.includes(accountStage)) {
      return res.status(400).json({ error: `Account stage must be one of: ${validStages.join(', ')}` });
    }
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await assertEmployeeAccess(req, res, id, 'update account stage for'))) return;

    const updated = await prisma.employee.update({
      where: { id },
      data: { accountStage },
    });
    res.json(updated);
  } catch (error) {
    console.error('UPDATE ACCOUNT STAGE ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const department = await prisma.department.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name required' });

    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Department exists' });

    const department = await prisma.department.create({
      data: { name, description },
    });

    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getOrgChart = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        managerId: true,
        email: true,
        photoUrl: true,
        department: { select: { name: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    const chart = employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      title: e.jobTitle,
      managerId: e.managerId,
      email: e.email,
      photoUrl: e.photoUrl,
      department: e.department?.name || '',
    }));

    res.json(chart);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDepartments,
  updateDepartment,
  createDepartment,
  getOrgChart,
  addAddress,
  updateAddress,
  deleteAddress,
  addEducation,
  updateEducation,
  deleteEducation,
  addExperience,
  updateExperience,
  deleteExperience,
  addSalaryRevision,
  upsertBankDetails,
  upsertPFDetails,
  upsertExitDetails,
  addDependent,
  updateDependent,
  deleteDependent,
  uploadEmployeePhoto,
  updateAccountStage,
  getChangeHistory,
};
