/**
 * @fileoverview Payslip controller.
 * Handles payslip retrieval, PDF generation, bulk downloads,
 * and email distribution via SMTP (Nodemailer).
 * @module controllers/payslipController
 */

const prisma = require('../config/database');
const nodemailer = require('nodemailer');
const { generatePayslipPDF, generateBulkPayslips } = require('../services/pdfService');
const fs = require('fs');
const path = require('path');
const { canAccessEmployee } = require('../services/accessControl');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const getPayslipHistory = async (req, res) => {
  try {
    const { employeeId, year, month } = req.query;
    const where = {};

    if (employeeId) {
      if (!(await canAccessEmployee(req.user, employeeId))) {
        return res.status(403).json({ error: 'Access denied for requested employee payslips' });
      }
      where.employeeId = employeeId;
    } else if (req.user?.role === 'EMPLOYEE') {
      if (!req.user.employeeId) return res.status(403).json({ error: 'No employee profile linked to your account' });
      where.employeeId = req.user.employeeId;
    }

    if (year || month) {
      const payrollFilter = {};
      if (year) payrollFilter.year = parseInt(year);
      if (month) payrollFilter.month = parseInt(month);
      where.payrollRun = payrollFilter;
    }

    const records = await prisma.payrollRecord.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        payrollRun: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(records);
  } catch (error) {
    console.error('[GET PAYSLIP HISTORY ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const getPayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        employee: { include: { department: true } },
        payrollRun: true,
      },
    });

    if (!record) return res.status(404).json({ error: 'Payslip not found' });

    if (!(await canAccessEmployee(req.user, record.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only view authorized payslips.' });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadPayslipPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        employee: { include: { department: true, bankDetails: true, pfDetails: true, company: true } },
        payrollRun: true,
      },
    });

    if (!record) return res.status(404).json({ error: 'Payslip not found' });

    if (!(await canAccessEmployee(req.user, record.employeeId))) {
      return res.status(403).json({ error: 'Access denied. You can only download authorized payslips.' });
    }

    const pdfBuffer = await generatePayslipPDF(record, record.employee, {
      company: record.employee.company,
      bank: record.employee.bankDetails,
      pf: record.employee.pfDetails,
    });

    const monthName = new Date(0, record.payrollRun.month - 1).toLocaleString('en', { month: 'long' });
    const fileName = `Payslip_${record.employee.firstName}_${monthName}_${record.payrollRun.year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const downloadBulkPayslips = async (req, res) => {
  try {
    const { month, year } = req.query;
    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: parseInt(month), year: parseInt(year) },
    });

    if (!payrollRun) return res.status(404).json({ error: 'Payroll not found' });

    const records = await prisma.payrollRecord.findMany({
      where: { payrollRunId: payrollRun.id },
    });

    const employeeIds = records.map(r => r.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { department: true, bankDetails: true, pfDetails: true },
    });

    const company = employees[0]?.companyId
      ? await prisma.company.findUnique({ where: { id: employees[0].companyId } })
      : null;

    const pdfBuffer = await generateBulkPayslips(records, employees, { company });

    const monthName = new Date(0, parseInt(month) - 1).toLocaleString('en', { month: 'long' });
    const fileName = `Payslips_${monthName}_${year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const emailPayslip = async (req, res) => {
  try {
    const { id, email } = req.body;

    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        employee: { include: { department: true, bankDetails: true, pfDetails: true, company: true } },
        payrollRun: true,
      },
    });

    if (!record) return res.status(404).json({ error: 'Payslip not found' });

    const employee = record.employee;
    const toEmail = email || employee.email;

    if (!toEmail) return res.status(400).json({ error: 'No email address found' });

    const pdfBuffer = await generatePayslipPDF(record, employee, {
      company: employee.company,
      bank: employee.bankDetails,
      pf: employee.pfDetails,
    });

    const monthName = new Date(0, record.payrollRun.month - 1).toLocaleString('en', { month: 'long' });
    const fileName = `Payslip_${employee.firstName}_${monthName}_${record.payrollRun.year}.pdf`;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@hrms.com',
      to: toEmail,
      subject: `Payslip - ${monthName} ${record.payrollRun.year}`,
      text: `Dear ${employee.firstName},\n\nPlease find attached your payslip for ${monthName} ${record.payrollRun.year}.\n\nNet Salary: Rs.${record.netSalary?.toFixed(2)}\n\nRegards,\nHRMS`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      return res.json({ message: 'Payslip sent successfully' });
    }

    res.json({ message: 'Email not configured - SMTP settings missing' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const emailBulkPayslips = async (req, res) => {
  try {
    const { month, year } = req.body;

    const payrollRun = await prisma.payrollRun.findFirst({
      where: { month: parseInt(month), year: parseInt(year) },
    });

    if (!payrollRun) return res.status(404).json({ error: 'Payroll not run for this period' });

    const records = await prisma.payrollRecord.findMany({
      where: { payrollRunId: payrollRun.id },
    });

    const employeeIds = records.map(r => r.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { department: true, bankDetails: true, pfDetails: true },
    });
    const company = employees[0]?.companyId
      ? await prisma.company.findUnique({ where: { id: employees[0].companyId } })
      : null;

    let sent = 0;
    let failed = 0;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      for (const record of records) {
        try {
          const employee = employees.find(e => e.id === record.employeeId);
          if (!employee?.email) {
            failed++;
            continue;
          }

          const recordWithEmployee = { ...record, employee };
          const pdfBuffer = await generatePayslipPDF(recordWithEmployee, employee, {
            company,
            bank: employee.bankDetails,
            pf: employee.pfDetails,
          });

          const monthName = new Date(0, payrollRun.month - 1).toLocaleString('en', { month: 'long' });
          const fileName = `Payslip_${employee.firstName}_${monthName}_${payrollRun.year}.pdf`;

          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@hrms.com',
            to: employee.email,
            subject: `Payslip - ${monthName} ${payrollRun.year}`,
            text: `Dear ${employee.firstName},\n\nPlease find attached your payslip for ${monthName} ${payrollRun.year}.\n\nNet Salary: Rs.${record.netSalary?.toFixed(2)}\n\nRegards,\nHRMS`,
            attachments: [{ filename: fileName, content: pdfBuffer }],
          });
          sent++;
        } catch (err) {
          failed++;
        }
      }
    }

    res.json({ message: `Emails sent: ${sent}, Failed: ${failed}` });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getPayslipHistory,
  getPayslip,
  downloadPayslipPDF,
  downloadBulkPayslips,
  emailPayslip,
  emailBulkPayslips,
};
