/**
 * @fileoverview Indian Statutory Compliance Controller.
 * Handles EPFO ECR, ESI Reports, and Form 16 PDF generation.
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const { generateEPFO_ECR } = require('../services/ecrGenerator');
const { generateESICReport } = require('../services/esicReportGenerator');
const { generateForm16 } = require('../services/form16Generator');
const { projectTDS } = require('../services/tdsEngine');
const { logPayrollEvent } = require('../services/auditService');
const { canAccessEmployee, isPayroll } = require('../services/accessControl');

/**
 * Helper to get records for a period
 */
const getRecordsForPeriod = async (month, year) => {
  const payrollRun = await prisma.payrollRun.findUnique({
    where: { month_year: { month: parseInt(month), year: parseInt(year) } }
  });

  if (!payrollRun) return null;

  return await prisma.payrollRecord.findMany({
    where: { payrollRunId: payrollRun.id },
    include: {
      employee: {
        include: {
          pfDetails: true,
          bankDetails: true,
          exitDetails: true
        }
      }
    }
  });
};

/**
 * GET /api/compliance/pf/ecr
 * Generate and download EPFO ECR text file.
 */
const getPF_ECR = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const records = await getRecordsForPeriod(month, year);
    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'No payroll records found for this period' });
    }

    const { ecrContent, validationReport } = generateEPFO_ECR(records);

    // Save report metadata in DB
    await prisma.complianceReport.create({
      data: {
        type: 'ECR',
        status: 'GENERATED',
        month: parseInt(month),
        year: parseInt(year),
        generatedBy: req.user?.email || 'admin@pid-hcms.com'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'ECR_EXPORT',
      entity: 'ComplianceReport',
      ipAddress: req.ip
    });

    // Option to return raw TXT or JSON report
    const { download = 'false' } = req.query;
    if (download === 'true') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="ECR_${year}_${month}.txt"`);
      return res.send(ecrContent);
    }

    res.json({
      ecrContent,
      validationReport
    });
  } catch (error) {
    console.error('ECR GENERATION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/compliance/esic/report
 * Generate and download ESIC monthly return CSV.
 */
const getESICReportController = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const records = await getRecordsForPeriod(month, year);
    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'No payroll records found for this period' });
    }

    const { csvContent, summary } = generateESICReport(records);

    await prisma.complianceReport.create({
      data: {
        type: 'ESIC',
        status: 'GENERATED',
        month: parseInt(month),
        year: parseInt(year),
        generatedBy: req.user?.email || 'admin@pid-hcms.com'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'ESIC_EXPORT',
      entity: 'ComplianceReport',
      ipAddress: req.ip
    });

    const { download = 'false' } = req.query;
    if (download === 'true') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ESIC_${year}_${month}.csv"`);
      return res.send(csvContent);
    }

    res.json({
      csvContent,
      summary
    });
  } catch (error) {
    console.error('ESIC REPORT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/tax/form16/:employeeId
 * Generate Individual Form 16 PDF.
 */
const getForm16Controller = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { financialYear } = req.query;

    if (!financialYear) {
      return res.status(400).json({ error: 'Financial year is required (e.g. 2025-26)' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        pfDetails: true,
        addresses: true
      }
    });

    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (!(await canAccessEmployee(req.user, employee.id))) {
      return res.status(403).json({ error: 'Access denied. You can only access authorized Form 16 records.' });
    }

    // Calculate/Fetch Tax projection data for details
    const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure) return res.status(400).json({ error: 'Salary structure not found' });

    const monthlyGross = structure.basicSalary + structure.hra + (structure.da || 0) + structure.conveyance + structure.medical + structure.specialAllowance + structure.otherAllowance;
    const taxDetails = await projectTDS(
      employeeId,
      3, // March as the final month representation
      parseInt(financialYear.split('-')[0]) + 1, // Next year March
      monthlyGross,
      structure.basicSalary,
      structure.da || 0
    );

    const pdfBuffer = await generateForm16(employee, taxDetails, financialYear);

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'FORM_16_DOWNLOAD',
      entity: 'Employee',
      entityId: employee.id,
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Form16_${employee.employeeId}_${financialYear}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('FORM 16 GENERATION ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/tax/form16/bulk
 * Bulk generate Form 16 PDFs.
 */
const bulkGenerateForm16Controller = async (req, res) => {
  try {
    const { financialYear, employeeIds } = req.body;

    if (!financialYear) {
      return res.status(400).json({ error: 'Financial year is required (e.g. 2025-26)' });
    }

    const where = { isActive: true };
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      where.id = { in: employeeIds };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { pfDetails: true, addresses: true }
    });

    const outputDir = path.join(__dirname, '../../private/compliance/form16');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];
    for (const employee of employees) {
      try {
        const structure = await prisma.salaryStructure.findUnique({ where: { employeeId: employee.id } });
        if (!structure) continue;

        const monthlyGross = structure.basicSalary + structure.hra + (structure.da || 0) + structure.conveyance + structure.medical + structure.specialAllowance + structure.otherAllowance;
        const taxDetails = await projectTDS(
          employee.id,
          3,
          parseInt(financialYear.split('-')[0]) + 1,
          monthlyGross,
          structure.basicSalary,
          structure.da || 0
        );

        const pdfBuffer = await generateForm16(employee, taxDetails, financialYear);
        const fileName = `Form16_${employee.employeeId}_${financialYear}.pdf`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, pdfBuffer);

        results.push({
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          status: 'SUCCESS',
          url: `/api/compliance/form16/download/${fileName}`
        });
      } catch (err) {
        results.push({
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          status: 'FAILED',
          reason: err.message
        });
      }
    }

    await prisma.complianceReport.create({
      data: {
        type: 'FORM16',
        status: 'GENERATED',
        financialYear,
        generatedBy: req.user?.email || 'admin@pid-hcms.com'
      }
    });

    await logPayrollEvent({
      userEmail: req.user?.email || 'admin@pid-hcms.com',
      action: 'FORM_16_BULK_EXPORT',
      entity: 'ComplianceReport',
      ipAddress: req.ip
    });

    res.json({
      message: `Form 16 bulk generation complete. Generated ${results.filter(r => r.status === 'SUCCESS').length} file(s).`,
      results
    });
  } catch (error) {
    console.error('BULK FORM 16 ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadForm16File = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+\.pdf$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid file format' });
    }

    const filePath = path.join(__dirname, '../../private/compliance/form16', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Role-based or ownership check
    if (!isPayroll(req.user)) {
      // For standard employees, verify that the Form 16 matches their employee record
      const parts = filename.split('_');
      const employeeId = parts[1]; // Extract EMPXXXXX

      if (!employeeId) {
        return res.status(400).json({ error: 'Invalid filename structure' });
      }

      const employee = await prisma.employee.findUnique({
        where: { employeeId },
        select: { userId: true }
      });

      if (!employee || employee.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only download your own Form 16.' });
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('DOWNLOAD FORM 16 ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getPF_ECR,
  getESICReport: getESICReportController,
  getForm16: getForm16Controller,
  bulkGenerateForm16: bulkGenerateForm16Controller,
  downloadForm16: downloadForm16File
};
