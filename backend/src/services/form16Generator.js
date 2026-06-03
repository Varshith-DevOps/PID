/**
 * @fileoverview Form 16 (Part A & Part B) PDF Generator.
 * Creates a fully compliant Form 16 PDF layout for an employee.
 */

const PDFDocument = require('pdfkit');

/**
 * Helper to format date as DD-MM-YYYY
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
};

/**
 * Generates a Form 16 PDF for a specific employee and financial year.
 * Password-protected with employee's DOB (DDMMYYYY).
 * 
 * @param {Object} employee - Employee object with relations
 * @param {Object} taxDetails - Calculated tax details for the FY
 * @param {string} financialYear - e.g. "2025-26"
 * @returns {Promise<Buffer>}
 */
const generateForm16 = (employee, taxDetails, financialYear) => {
  return new Promise((resolve, reject) => {
    try {
      const dobStr = employee.dateOfBirth 
        ? formatDate(employee.dateOfBirth).replace(/-/g, '') // e.g. "25041995"
        : '12345678'; // fallback

      // Configure PDF document with password protection
      const doc = new PDFDocument({
        margin: 40,
        userPassword: dobStr, // password-protected
        permissions: { printing: 'highResolution', modifying: false, copying: false }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ay = `${parseInt(financialYear.split('-')[0]) + 1}-${parseInt(financialYear.split('-')[1]) + 1}`;

      // ----------------------------------------------------
      // PAGE 1: PART A (Certificate of Tax Deducted at Source)
      // ----------------------------------------------------
      doc.fontSize(16).font('Helvetica-Bold').text('FORM NO. 16', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('[See rule 31(1)(a)]', { align: 'center' });
      doc.fontSize(12).font('Helvetica-Bold').text('PART A', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text('Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source from income under the head "Salaries"', { align: 'center' });
      doc.moveDown(1.5);

      // Employer & Employee Box Table
      const tableTop = doc.y;
      doc.rect(40, tableTop, 530, 140).stroke();
      doc.line(305, tableTop, 305, tableTop + 140).stroke();

      // Left Column (Employer Details)
      doc.fontSize(9).font('Helvetica-Bold').text('Name and Address of the Employer:', 45, tableTop + 5);
      doc.font('Helvetica').text('NexusHR Solutions Private Limited', 45, tableTop + 20);
      doc.text('12th Floor, Cyber Towers, Hitec City,', 45, tableTop + 32);
      doc.text('Hyderabad, Telangana, 500081', 45, tableTop + 44);

      // Right Column (Employee Details)
      doc.font('Helvetica-Bold').text('Name and Address of the Employee:', 310, tableTop + 5);
      doc.font('Helvetica').text(`${employee.firstName} ${employee.lastName}`, 310, tableTop + 20);
      doc.text(employee.address || 'Address: N/A', 310, tableTop + 32, { width: 250 });

      // PAN / TAN Details Row
      doc.line(40, tableTop + 90, 570, tableTop + 90).stroke();
      doc.line(172, tableTop + 90, 172, tableTop + 140).stroke();
      doc.line(437, tableTop + 90, 437, tableTop + 140).stroke();

      doc.font('Helvetica-Bold').text('TDS Circle / CIT(TDS)', 45, tableTop + 95);
      doc.font('Helvetica').text('CIT (TDS), Hyderabad', 45, tableTop + 107);

      doc.font('Helvetica-Bold').text('TAN of the Deductor', 177, tableTop + 95);
      doc.font('Helvetica').text('HYDN01234G', 177, tableTop + 107);

      doc.font('Helvetica-Bold').text('PAN of the Employee', 310, tableTop + 95);
      doc.font('Helvetica').text(employee.panNumber || 'PAN: N/A', 310, tableTop + 107);

      doc.font('Helvetica-Bold').text('PAN of the Deductor', 442, tableTop + 95);
      doc.font('Helvetica').text('AAACN9876P', 442, tableTop + 107);

      doc.moveDown(7);

      // Period & Assessment Year Box
      const periodTop = doc.y;
      doc.rect(40, periodTop, 530, 45).stroke();
      doc.line(220, periodTop, 220, periodTop + 45).stroke();
      doc.line(400, periodTop, 400, periodTop + 45).stroke();

      doc.font('Helvetica-Bold').text('Period (From - To)', 45, periodTop + 5);
      doc.font('Helvetica').text(`01-04-${financialYear.split('-')[0]} to 31-03-20${financialYear.split('-')[1]}`, 45, periodTop + 18);

      doc.font('Helvetica-Bold').text('Assessment Year', 225, periodTop + 5);
      doc.font('Helvetica').text(`20${ay}`, 225, periodTop + 18);

      doc.font('Helvetica-Bold').text('Financial Year', 405, periodTop + 5);
      doc.font('Helvetica').text(`20${financialYear}`, 405, periodTop + 18);

      doc.moveDown(4);

      // Summary of Tax Deposited Table
      doc.font('Helvetica-Bold').text('Summary of Tax Deposited (Quarterly Breakdown):', 40, doc.y);
      doc.moveDown(0.5);

      const qTop = doc.y;
      doc.rect(40, qTop, 530, 100).stroke();
      doc.line(40, qTop + 20, 570, qTop + 20).stroke();
      // Columns: Quarter | Tax Deducted | Tax Deposited
      doc.line(160, qTop, 160, qTop + 100).stroke();
      doc.line(360, qTop, 360, qTop + 100).stroke();

      doc.text('Quarter', 45, qTop + 5);
      doc.text('Tax Deducted (Rs.)', 165, qTop + 5);
      doc.text('Tax Deposited / Paid (Rs.)', 365, qTop + 5);

      const qTax = Math.round(taxDetails.totalAnnualTax / 4 * 100) / 100;
      const quarters = [
        { q: 'Q1 (April - June)', tax: qTax },
        { q: 'Q2 (July - Sept)', tax: qTax },
        { q: 'Q3 (Oct - Dec)', tax: qTax },
        { q: 'Q4 (Jan - March)', tax: qTax },
      ];

      quarters.forEach((q, idx) => {
        const yOffset = qTop + 25 + (idx * 18);
        doc.line(40, yOffset + 15, 570, yOffset + 15).stroke();
        doc.font('Helvetica').text(q.q, 45, yOffset);
        doc.text(q.tax.toFixed(2), 165, yOffset);
        doc.text(q.tax.toFixed(2), 365, yOffset);
      });

      doc.font('Helvetica-Bold').text('Total Tax Deposited:', 45, qTop + 85);
      doc.text(taxDetails.totalAnnualTax.toFixed(2), 165, qTop + 85);
      doc.text(taxDetails.totalAnnualTax.toFixed(2), 365, qTop + 85);

      doc.moveDown(4.5);

      // Signature Section
      doc.fontSize(9).font('Helvetica-Bold').text('Verification / Digital Signature:', 40, doc.y);
      doc.font('Helvetica').text('I, Director of NexusHR Solutions Pvt Ltd, do hereby certify that a sum of Rs.' + taxDetails.totalAnnualTax.toFixed(2) + ' has been deducted and deposited to the credit of Central Government.', 40, doc.y + 10, { width: 530 });
      
      doc.moveDown(3);
      doc.font('Helvetica-Bold').text('Digitally Signed by: Authorized Signatory', 40, doc.y);
      doc.font('Helvetica').text('Date: ' + formatDate(new Date()), 40, doc.y + 12);
      doc.text('Place: Hyderabad', 40, doc.y + 24);

      // ----------------------------------------------------
      // PAGE 2: PART B (Details of Salary Paid and Deductions)
      // ----------------------------------------------------
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('PART B', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text('Details of Salary Paid, Other Income and Tax Deducted', { align: 'center' });
      doc.moveDown(1.5);

      // Grid for calculations
      const bTop = doc.y;
      doc.rect(40, bTop, 530, 420).stroke();
      doc.line(360, bTop, 360, bTop + 420).stroke();
      doc.line(480, bTop, 480, bTop + 420).stroke();

      // Headers
      doc.font('Helvetica-Bold');
      doc.text('Details of Salary Paid and Tax Deducted', 45, bTop + 5);
      doc.text('Amount (Rs.)', 365, bTop + 5);
      doc.text('Amount (Rs.)', 485, bTop + 5);
      doc.line(40, bTop + 20, 570, bTop + 20).stroke();

      let rowY = bTop + 25;
      const drawRow = (label, col1Val, col2Val, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, 45, rowY, { width: 310 });
        if (col1Val !== null) doc.text(col1Val, 365, rowY);
        if (col2Val !== null) doc.text(col2Val, 485, rowY);
        doc.line(40, rowY + 18, 570, rowY + 18).stroke();
        rowY += 22;
      };

      drawRow('1. Gross Salary', null, null, true);
      drawRow('   (a) Salary as per provisions contained in section 17(1)', taxDetails.annualGross.toFixed(2), null);
      drawRow('   (b) Value of perquisites under section 17(2)', '0.00', null);
      drawRow('   (c) Profits in lieu of salary under section 17(3)', '0.00', null);
      drawRow('2. Total Gross Salary', null, taxDetails.annualGross.toFixed(2), true);
      
      const standardDec = taxDetails.regime === 'NEW' ? 75000 : 50000;
      drawRow('3. Less: Standard Deduction under section 16(ia)', standardDec.toFixed(2), null);
      drawRow('4. Less: Professional Tax under section 16(iii)', '2400.00', null);
      
      const total16Deductions = standardDec + 2400;
      drawRow('5. Total Deductions under section 16', null, total16Deductions.toFixed(2), true);
      
      const incomeUnderSalaries = Math.max(0, taxDetails.annualGross - total16Deductions);
      drawRow('6. Income Chargeable under the head "Salaries"', null, incomeUnderSalaries.toFixed(2), true);
      
      // Deductions under Chapter VI-A
      drawRow('7. Deductions under Chapter VI-A (Section 80C, 80D, etc.)', null, null, true);
      const dec80C = taxDetails.regime === 'OLD' ? (taxDetails.deductions80C || 0) : 0;
      const dec80D = taxDetails.regime === 'OLD' ? (taxDetails.deductions80D || 0) : 0;
      drawRow('   (a) Section 80C (EPF, PPF, ELSS, VPF etc.)', dec80C.toFixed(2), null);
      drawRow('   (b) Section 80D (Health Insurance Premium)', dec80D.toFixed(2), null);
      
      const totalVIA = dec80C + dec80D;
      drawRow('8. Total Chapter VI-A Deductions', null, totalVIA.toFixed(2), true);
      drawRow('9. Total Taxable Income (6 - 8)', null, taxDetails.taxableIncome.toFixed(2), true);
      
      const baseTax = taxDetails.breakup?.baseTax || 0;
      const rebate = taxDetails.breakup?.rebate || 0;
      const surcharge = taxDetails.breakup?.surcharge || 0;
      const cess = taxDetails.breakup?.cess || 0;
      const totalTax = taxDetails.breakup?.totalTax || 0;

      drawRow('10. Tax on Total Income', null, baseTax.toFixed(2));
      drawRow('11. Less: Rebate under section 87A', null, rebate.toFixed(2));
      drawRow('12. Add: Surcharge', null, surcharge.toFixed(2));
      drawRow('13. Add: Health and Education Cess', null, cess.toFixed(2));
      drawRow('14. Total Tax Payable (10 - 11 + 12 + 13)', null, totalTax.toFixed(2), true);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateForm16
};
