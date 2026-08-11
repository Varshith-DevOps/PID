const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

const VALID_ROLES = new Set(['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN']);
const VALID_EMP_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);

/** Download CSV Template */
const downloadTemplate = (req, res) => {
  const headers = 'employeeId,firstName,lastName,email,phone,jobTitle,department,role,employmentType,joiningDate,location\n';
  const sampleRow1 = 'EMP-2001,Amit,Sharma,amit.sharma@hrms.com,9876543210,Software Engineer,Engineering,EMPLOYEE,FULL_TIME,2026-08-11,Mumbai\n';
  const sampleRow2 = 'EMP-2002,Pooja,Patel,pooja.patel@hrms.com,9876543211,HR Executive,Human Resources,HR,FULL_TIME,2026-08-11,Bangalore\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="employee_bulk_import_template.csv"');
  res.status(200).send(headers + sampleRow1 + sampleRow2);
};

/** Validate Bulk Upload Payload before Transactional Execution */
const validateBulkImport = async (req, res) => {
  try {
    const employees = req.body?.employees || req.body?.rows || [];
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'No employee rows provided for validation.' });
    }

    const companyId = req.user.companyId;
    if (!companyId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'Company context required for employee import.' });
    }

    // Fetch existing company departments
    const departments = await prisma.department.findMany({
      where: companyId ? { companyId } : {}
    });

    const deptMap = new Map();
    departments.forEach(d => deptMap.set(d.name.trim().toLowerCase(), d));

    // Fetch existing user/employee emails and employee IDs
    const existingUsers = await prisma.user.findMany({ select: { email: true } });
    const existingEmployees = await prisma.employee.findMany({ select: { email: true, employeeId: true } });

    const dbUserEmails = new Set(existingUsers.map(u => u.email.trim().toLowerCase()));
    const dbEmpEmails = new Set(existingEmployees.map(e => e.email.trim().toLowerCase()));
    const dbEmpIds = new Set(existingEmployees.map(e => e.employeeId.trim().toLowerCase()));

    const seenEmailsInFile = new Set();
    const seenEmpIdsInFile = new Set();

    const validatedRows = [];
    let validRowsCount = 0;
    let invalidRowsCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const row = employees[i] || {};
      const rowNum = i + 1;
      const errors = [];

      const firstName = String(row.firstName || '').trim();
      const lastName = String(row.lastName || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const empId = String(row.employeeId || '').trim();
      const jobTitle = String(row.jobTitle || '').trim();
      const deptName = String(row.department || '').trim();
      const role = String(row.role || 'EMPLOYEE').trim().toUpperCase();
      const empType = String(row.employmentType || 'FULL_TIME').trim().toUpperCase();
      const phone = String(row.phone || '').trim();
      const location = String(row.location || '').trim();
      const joiningDate = row.joiningDate ? new Date(row.joiningDate) : new Date();

      if (!firstName) errors.push('First Name is required.');
      if (!lastName) errors.push('Last Name is required.');
      if (!email) {
        errors.push('Email is required.');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format.');
      } else if (seenEmailsInFile.has(email)) {
        errors.push('Duplicate email found within uploaded file.');
      } else if (dbUserEmails.has(email) || dbEmpEmails.has(email)) {
        errors.push('Email already exists in production database.');
      }

      if (!empId) {
        errors.push('Employee ID is required.');
      } else if (seenEmpIdsInFile.has(empId.toLowerCase())) {
        errors.push('Duplicate Employee ID found within uploaded file.');
      } else if (dbEmpIds.has(empId.toLowerCase())) {
        errors.push('Employee ID already exists in database.');
      }

      if (!jobTitle) errors.push('Job Title is required.');
      if (!deptName) {
        errors.push('Department is required.');
      } else if (!deptMap.has(deptName.toLowerCase())) {
        errors.push(`Department "${deptName}" does not exist in company records.`);
      }

      if (!VALID_ROLES.has(role)) {
        errors.push(`Invalid role "${role}". Must be one of: EMPLOYEE, MANAGER, HR, ADMIN.`);
      }

      if (!VALID_EMP_TYPES.has(empType)) {
        errors.push(`Invalid employment type "${empType}". Must be one of: FULL_TIME, PART_TIME, CONTRACT, INTERN.`);
      }

      if (email) seenEmailsInFile.add(email);
      if (empId) seenEmpIdsInFile.add(empId.toLowerCase());

      const isValid = errors.length === 0;
      if (isValid) validRowsCount++;
      else invalidRowsCount++;

      validatedRows.push({
        rowNumber: rowNum,
        data: {
          firstName,
          lastName,
          email,
          employeeId: empId,
          jobTitle,
          department: deptName,
          departmentId: deptMap.get(deptName.toLowerCase())?.id || null,
          role,
          employmentType: empType,
          phone,
          location,
          joiningDate: isNaN(joiningDate.getTime()) ? new Date() : joiningDate,
        },
        isValid,
        errors,
      });
    }

    return res.json({
      totalRows: employees.length,
      validRows: validRowsCount,
      invalidRows: invalidRowsCount,
      rows: validatedRows,
    });
  } catch (err) {
    console.error('[BULK VALIDATE ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to validate bulk employee import payload.' });
  }
};

/** Execute Atomic Transactional Bulk Import */
const executeBulkImport = async (req, res) => {
  try {
    const employees = req.body?.employees || req.body?.rows || [];
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'No valid employee rows provided for import.' });
    }

    const companyId = req.user.companyId;
    const defaultPasswordHash = await bcrypt.hash('employee123', 10);

    const departments = await prisma.department.findMany({
      where: companyId ? { companyId } : {}
    });
    const deptMap = new Map();
    departments.forEach(d => deptMap.set(d.name.trim().toLowerCase(), d));

    const failures = [];
    let createdUsersCount = 0;
    let createdEmployeesCount = 0;

    // Process in atomic chunks to prevent partial database corruption
    for (let i = 0; i < employees.length; i++) {
      const empData = employees[i];
      const cleanEmail = String(empData.email || '').trim().toLowerCase();
      const empId = String(empData.employeeId || '').trim();
      const deptName = String(empData.department || '').trim();
      const deptObj = deptMap.get(deptName.toLowerCase());

      if (!deptObj) {
        failures.push({ row: i + 1, email: cleanEmail, reason: `Department "${deptName}" not found.` });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Check uniqueness inside transaction
          const existingUser = await tx.user.findUnique({ where: { email: cleanEmail } });
          const existingEmp = await tx.employee.findUnique({ where: { email: cleanEmail } });
          const existingId = await tx.employee.findFirst({ where: { employeeId: empId } });

          if (existingUser || existingEmp || existingId) {
            throw new Error(`Duplicate record found for ${cleanEmail} or Employee ID ${empId}.`);
          }

          const newUser = await tx.user.create({
            data: {
              email: cleanEmail,
              password: defaultPasswordHash,
              name: `${empData.firstName} ${empData.lastName}`,
              role: empData.role || 'EMPLOYEE',
              companyId,
              isActive: true,
              mustChangePassword: true,
            }
          });

          await tx.employee.create({
            data: {
              employeeId: empId,
              firstName: empData.firstName,
              lastName: empData.lastName,
              email: cleanEmail,
              phone: empData.phone || null,
              location: empData.location || null,
              jobTitle: empData.jobTitle,
              departmentId: deptObj.id,
              employmentType: empData.employmentType || 'FULL_TIME',
              companyId,
              userId: newUser.id,
              salary: empData.salary ? parseFloat(empData.salary) : 80000,
              isActive: true,
              joinDate: empData.joiningDate ? new Date(empData.joiningDate) : new Date(),
            }
          });

          createdUsersCount++;
          createdEmployeesCount++;
        });
      } catch (rowErr) {
        failures.push({ row: i + 1, email: cleanEmail, reason: rowErr.message });
      }
    }

    return res.json({
      success: true,
      totalRows: employees.length,
      importedCount: createdEmployeesCount,
      createdUsers: createdUsersCount,
      createdEmployees: createdEmployeesCount,
      skippedDuplicates: failures.length,
      failedRows: failures.length,
      failures,
    });
  } catch (err) {
    console.error('[BULK IMPORT ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to execute bulk employee import transaction.' });
  }
};

module.exports = {
  downloadTemplate,
  validateBulkImport,
  executeBulkImport,
};
