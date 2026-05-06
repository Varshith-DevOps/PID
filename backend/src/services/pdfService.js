const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generatePayslipPDF = (record, employee, company) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const monthName = new Date(0, record.payrollRun?.month - 1).toLocaleString('en', { month: 'long' });
      const year = record.payrollRun?.year;

      doc.fontSize(20).font('Helvetica-Bold').text('PAYSLIP', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').text(`${monthName} ${year}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('Employee Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Employee ID: ${employee.employeeId}`);
      doc.text(`Name: ${employee.firstName} ${employee.lastName}`);
      doc.text(`Department: ${employee.department?.name || 'N/A'}`);
      doc.text(`Job Title: ${employee.jobTitle}`);
      doc.moveDown(2);

      doc.fontSize(12).font('Helvetica-Bold').text('Earnings', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const earningsData = [
        ['Basic Salary', record.basicSalary?.toFixed(2)],
        ['HRA', record.hra?.toFixed(2)],
        ['DA', record.da?.toFixed(2)],
        ['Conveyance', record.conveyance?.toFixed(2)],
        ['Medical Allowance', record.medical?.toFixed(2)],
        ['Special Allowance', record.specialAllowance?.toFixed(2)],
        ['Other Allowance', record.otherAllowance?.toFixed(2)],
      ];

      let earningsTotal = 0;
      earningsData.forEach(([label, value]) => {
        if (value && parseFloat(value) > 0) {
          doc.text(`${label}: Rs.${value}`);
          earningsTotal += parseFloat(value);
        }
      });

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text(`Gross Earnings: Rs.${record.grossEarnings?.toFixed(2)}`);
      doc.moveDown(2);

      doc.font('Helvetica').fontSize(12).font('Helvetica-Bold').text('Deductions', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const deductionsData = [
        ['PF', record.pf?.toFixed(2)],
        ['TDS', record.tax?.toFixed(2)],
        ['Insurance', record.insurance?.toFixed(2)],
        ['Other Deductions', record.otherDeductions?.toFixed(2)],
      ];

      let deductionsTotal = 0;
      deductionsData.forEach(([label, value]) => {
        if (value && parseFloat(value) > 0) {
          doc.text(`${label}: Rs.${value}`);
          deductionsTotal += parseFloat(value);
        }
      });

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text(`Total Deductions: Rs.${record.totalDeductions?.toFixed(2)}`);
      doc.moveDown(2);

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('NET SALARY: Rs.' + record.netSalary?.toFixed(2), { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(8).font('Helvetica');
      doc.text(`Work Days: ${record.workDays}`, { align: 'center' });
      doc.text(`Days Worked: ${record.daysWorked}`, { align: 'center' });
      doc.text(`Leaves: ${record.leaves || 0}`, { align: 'center' });
      doc.moveDown(2);

      const dateStr = new Date().toLocaleDateString();
      doc.fontSize(8).text(`Generated on: ${dateStr}`, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

const generateBulkPayslips = (records, employees) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      doc.fontSize(16).font('Helvetica-Bold').text('MONTHLY PAYSLIP REPORT', { align: 'center' });
      doc.moveDown(2);

      const monthName = new Date(0, records[0]?.payrollRun?.month - 1).toLocaleString('en', { month: 'long' });
      const year = records[0]?.payrollRun?.year;
      doc.fontSize(12).text(`${monthName} ${year}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('S.No', 30, doc.y, { width: 30 });
      doc.text('Employee', 70, doc.y, { width: 120 });
      doc.text('Gross', 200, doc.y, { width: 70 });
      doc.text('Deductions', 280, doc.y, { width: 70 });
      doc.text('Net', 360, doc.y, { width: 70 });
      doc.text('Status', 440, doc.y, { width: 70 });
      doc.moveDown(1);

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      records.forEach((record, index) => {
        const emp = employees.find(e => e.id === record.employeeId);
        doc.font('Helvetica').fontSize(9);
        doc.text(String(index + 1), 30, doc.y, { width: 30 });
        doc.text(emp ? `${emp.firstName} ${emp.lastName}`.substring(0, 20) : 'N/A', 70, doc.y, { width: 120 });
        doc.text(`Rs.${record.grossEarnings?.toFixed(0)}`, 200, doc.y, { width: 70 });
        doc.text(`Rs.${record.totalDeductions?.toFixed(0)}`, 280, doc.y, { width: 70 });
        doc.text(`Rs.${record.netSalary?.toFixed(0)}`, 360, doc.y, { width: 70 });
        doc.text(record.status || 'Paid', 440, doc.y, { width: 70 });
        doc.moveDown(1);

        totalGross += record.grossEarnings || 0;
        totalDeductions += record.totalDeductions || 0;
        totalNet += record.netSalary || 0;
      });

      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('', 30, doc.y);
      doc.text('TOTAL', 70, doc.y);
      doc.text(`Rs.${totalGross.toFixed(0)}`, 200, doc.y);
      doc.text(`Rs.${totalDeductions.toFixed(0)}`, 280, doc.y);
      doc.text(`Rs.${totalNet.toFixed(0)}`, 360, doc.y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generatePayslipPDF, generateBulkPayslips };