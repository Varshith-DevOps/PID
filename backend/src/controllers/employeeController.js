const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');

// Helper to log changes to ChangeHistory
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
  documents: true,
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

const getChangeHistory = async (req, res) => {
  try {
    const { id } = req.params;
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
    const { departmentId, search, page = 1, limit = 20 } = req.query;
    const where = { isActive: true };

    if (departmentId) where.departmentId = departmentId;
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
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: employeeFullIncludes,
    });

    if (!employee) return res.status(404).json({ error: 'Employee not found' });
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
      photoUrl, accountStage
    } = req.body;

    if (!firstName || !lastName || !email || !jobTitle || !departmentId || !salary) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const count = await prisma.employee.count();
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        employeeId,
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

    res.status(201).json(employee);
  } catch (error) {
    console.error('CREATE EMPLOYEE ERROR:', error);
    res.status(500).json({ error: error.message || 'Server error' });
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
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

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
    await prisma.dependent.update({ 
      where: { id: depId },
      data: { isActive: false, inactiveRemark: inactiveRemark || 'No remark provided' }
    });
    
    // get employee id from dependent
    const dependent = await prisma.dependent.findUnique({ where: { id: depId } });
    if (dependent) {
      await logChange(dependent.employeeId, req.user?.email, 'Dependent', 'isActive', 'true', 'false', inactiveRemark);
    }
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
      // Basic salary is typically 40-50% of monthly salary, but for simplicity we will just update standard allowances proportionally if needed.
      // Assuming a simple 40% basic, 20% HRA, etc.
      const s = parseFloat(revisedSalary);
      await prisma.salaryStructure.update({
        where: { employeeId: id },
        data: {
          basicSalary: s * 0.4,
          hra: s * 0.2,
          specialAllowance: s * 0.4, // Simplified
          effectiveFrom: new Date(effectiveDate)
        }
      });
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

    // Delete old photo if exists
    if (employee.photoUrl) {
      const oldPath = path.resolve(employee.photoUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
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

// ──── Account Stage ────
const updateAccountStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountStage } = req.body;
    const validStages = ['EMPLOYEE', 'MANAGER', 'ADMIN', 'INACTIVE'];
    if (!accountStage || !validStages.includes(accountStage)) {
      return res.status(400).json({ error: `Account stage must be one of: ${validStages.join(', ')}` });
    }

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
      },
      orderBy: { firstName: 'asc' },
    });

    const chart = employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      title: e.jobTitle,
      managerId: e.managerId,
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