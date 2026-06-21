/**
 * @fileoverview Payslip PDF generation service.
 *
 * Renders payslips in one of 8 selectable company formats (see
 * config/payslipTemplates.js). Every format shows the same mandatory payroll
 * data and ends with the required statements:
 *   - centered: "This is a computer-generated payslip ..."
 *   - right-aligned: "Generated from PID HCMS application".
 *
 * @module services/pdfService
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getTemplateById, normalizeConfig } = require('../config/payslipTemplates');

// ─── helpers ─────────────────────────────────────────────────────────────────

const COMPUTER_GENERATED_NOTE =
  'This is a computer-generated payslip and does not require a signature.';
const PID_HCMS_NOTE = 'Generated from PID HCMS application';

/** Indian-grouped money format, e.g. 123456.5 => "1,23,456.50". */
function formatINR(value) {
  const n = Number(value) || 0;
  const fixed = Math.abs(n).toFixed(2);
  const [whole, dec] = fixed.split('.');
  let lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return `${n < 0 ? '-' : ''}${grouped}.${dec}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

/** Convert an amount to Indian-system words: "Rupees One Lakh ... Only". */
function numberToWordsINR(amount) {
  let n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(`${parts.length ? 'and ' : ''}${twoDigits(n)}`);
  return `Rupees ${parts.join(' ')} Only`;
}

function maskAccount(acc) {
  const v = String(acc || '');
  if (v.length <= 4) return v || 'N/A';
  return 'XXXX' + v.slice(-4);
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [31, 41, 55];
}
/** Lighten a hex colour toward white by ratio (0..1) and return an rgb() string. */
function tint(hex, ratio) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function monthName(m) {
  if (!m) return '';
  return new Date(0, m - 1).toLocaleString('en', { month: 'long' });
}

// ─── data assembly ───────────────────────────────────────────────────────────

/** Build the mandatory earnings / deductions line items from a payroll record. */
function buildLineItems(record) {
  const earnings = [
    ['Basic Salary', record.basicSalary, true],
    ['House Rent Allowance (HRA)', record.hra],
    ['Dearness Allowance (DA)', record.da],
    ['Conveyance', record.conveyance],
    ['Medical Allowance', record.medical],
    ['Special Allowance', record.specialAllowance],
    ['Other Allowance', record.otherAllowance],
    ['Overtime Pay', record.overtimePay],
    ['Arrears', record.arrears],
    ['Incentives', record.incentives],
    ['Bonus', record.bonusAmount],
  ].filter(([, v], i) => i === 0 || (Number(v) || 0) > 0).map(([l, v]) => [l, Number(v) || 0]);

  const deductions = [
    ['Provident Fund (PF)', record.pf],
    ['Employee State Insurance (ESI)', record.esi],
    ['Professional Tax (PT)', record.professionalTax],
    ['TDS / Income Tax', record.tax],
    ['Insurance', record.insurance],
    ['Voluntary PF (VPF)', record.vpfAmount],
    ['Labour Welfare Fund (LWF)', record.lwfEmployee],
    ['NPS (Employee)', record.npsEmployee],
    ['Loss of Pay', record.lopDeduction],
    ['Other Deductions', record.otherDeductions],
  ].filter(([, v]) => (Number(v) || 0) > 0).map(([l, v]) => [l, Number(v) || 0]);

  return { earnings, deductions };
}

function buildContext(record, employee, opts = {}) {
  const company = opts.company || {};
  const bank = opts.bank || employee.bankDetails || null;
  const pf = opts.pf || employee.pfDetails || null;
  const template = getTemplateById(opts.templateId || company.payslipTemplateId);
  const config = normalizeConfig(opts.config || company.payslipTemplateConfig);
  const accent = config.accent || template.accent;
  return { record, employee, company, bank, pf, template, config, accent };
}

// ─── drawing primitives ──────────────────────────────────────────────────────

const PAGE = { left: 40, right: 555, width: 515 };

function drawHeader(doc, ctx) {
  const { company, template, accent, config, record } = ctx;
  const title = 'PAYSLIP';
  const period = `${monthName(record.payrollRun?.month)} ${record.payrollRun?.year || ''}`.trim();
  const companyName = company.name || 'Company';
  const logoPath = config.showLogo && company.logoUrl ? resolveLogo(company.logoUrl) : null;

  if (template.header === 'band') {
    doc.rect(0, 0, doc.page.width, 90).fill(accent);
    if (logoPath) try { doc.image(logoPath, PAGE.left, 22, { fit: [46, 46] }); } catch { /* ignore */ }
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
      .text(companyName, PAGE.left + (logoPath ? 58 : 0), 24, { width: 320 });
    if (config.headerNote) doc.font('Helvetica').fontSize(8).fillColor('#eef2ff')
      .text(config.headerNote, PAGE.left + (logoPath ? 58 : 0), 48, { width: 320 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
      .text(title, PAGE.left, 26, { width: PAGE.width, align: 'right' });
    doc.font('Helvetica').fontSize(10)
      .text(`Pay Period: ${period}`, PAGE.left, 50, { width: PAGE.width, align: 'right' });
    doc.fillColor('#000000');
    doc.y = 110;
  } else if (template.header === 'letterhead') {
    if (logoPath) try { doc.image(logoPath, PAGE.left, 36, { fit: [50, 50] }); } catch { /* ignore */ }
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(18)
      .text(companyName, PAGE.left + (logoPath ? 62 : 0), 38, { width: PAGE.width });
    doc.fillColor('#444').font('Helvetica').fontSize(8.5);
    const addr = [company.address, config.headerNote, company.gstin ? `GSTIN: ${company.gstin}` : '', company.cin ? `CIN: ${company.cin}` : '']
      .filter(Boolean).join('  |  ');
    if (addr) doc.text(addr, PAGE.left + (logoPath ? 62 : 0), 60, { width: PAGE.width - (logoPath ? 62 : 0) });
    doc.moveTo(PAGE.left, 92).lineTo(PAGE.right, 92).lineWidth(1.5).strokeColor(accent).stroke();
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
      .text(`PAYSLIP — ${period}`, PAGE.left, 100, { width: PAGE.width, align: 'center' });
    doc.y = 124;
  } else if (template.header === 'boxed') {
    doc.rect(PAGE.left, 34, PAGE.width, 56).lineWidth(1.5).strokeColor(accent).stroke();
    if (logoPath) try { doc.image(logoPath, PAGE.left + 10, 44, { fit: [40, 40] }); } catch { /* ignore */ }
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(16)
      .text(companyName, PAGE.left, 46, { width: PAGE.width, align: 'center' });
    doc.fillColor('#000').font('Helvetica').fontSize(10)
      .text(`PAYSLIP  •  ${period}`, PAGE.left, 68, { width: PAGE.width, align: 'center' });
    doc.y = 104;
  } else if (template.header === 'minimal') {
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(15).text(companyName, PAGE.left, 44);
    doc.fillColor('#888').font('Helvetica').fontSize(9)
      .text(`Payslip · ${period}`, PAGE.left, 64);
    doc.moveTo(PAGE.left, 82).lineTo(PAGE.right, 82).lineWidth(0.5).strokeColor('#cccccc').stroke();
    doc.fillColor('#000');
    doc.y = 94;
  } else {
    // centered (classic)
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(18)
      .text(companyName, PAGE.left, 42, { width: PAGE.width, align: 'center' });
    if (config.headerNote) doc.fillColor('#555').font('Helvetica').fontSize(8.5)
      .text(config.headerNote, PAGE.left, 64, { width: PAGE.width, align: 'center' });
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
      .text(`PAYSLIP for ${period}`, PAGE.left, config.headerNote ? 80 : 66, { width: PAGE.width, align: 'center' });
    doc.moveTo(PAGE.left, config.headerNote ? 100 : 86).lineTo(PAGE.right, config.headerNote ? 100 : 86)
      .lineWidth(1).strokeColor(accent).stroke();
    doc.y = config.headerNote ? 110 : 96;
  }
}

function resolveLogo(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  // Only embed locally-stored uploads (skip remote URLs pdfkit can't fetch).
  if (/^https?:\/\//i.test(logoUrl)) return null;
  // Confine to the uploads directory and block path traversal (e.g. ../../etc/passwd).
  const uploadsRoot = path.resolve(__dirname, '../../uploads');
  const rel = logoUrl.replace(/^\/+/, '').replace(/^uploads[\\/]/, '');
  const candidate = path.resolve(uploadsRoot, rel);
  if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + path.sep)) return null;
  return fs.existsSync(candidate) ? candidate : null;
}

/** Two-column employee + pay-period info block. */
function drawInfoBlock(doc, ctx) {
  const { employee, record, bank, pf, config, accent } = ctx;
  const startY = doc.y + 6;
  const colW = PAGE.width / 2;
  const left = [
    ['Employee ID', employee.employeeId],
    ['Name', `${employee.firstName || ''} ${employee.lastName || ''}`.trim()],
    ['Designation', employee.jobTitle || 'N/A'],
    ['Department', employee.department?.name || 'N/A'],
    ['Date of Joining', employee.joinDate ? new Date(employee.joinDate).toLocaleDateString('en-IN') : 'N/A'],
    ['Location', employee.location || employee.workLocation?.name || 'N/A'],
  ];
  const right = [
    ['PAN', employee.panNumber || 'N/A'],
    ['UAN', pf?.uanNumber || 'N/A'],
    ['PF No.', pf?.pfNumber || 'N/A'],
    ['ESIC No.', employee.esicNumber || pf?.esiNumber || 'N/A'],
  ];
  if (config.showBankDetails && bank) {
    right.push(['Bank', bank.bankName || 'N/A']);
    right.push(['Bank A/C', maskAccount(bank.accountNumber)]);
    right.push(['IFSC', bank.ifscCode || 'N/A']);
  }
  // Attendance / pay days
  if (config.showAttendance) {
    left.push(['Total Days', String(record.workDays ?? 'N/A')]);
    left.push(['Paid Days', String(record.daysWorked ?? 'N/A')]);
    left.push(['LOP Days', String(record.lopDays ?? 0)]);
  }

  doc.fontSize(9).fillColor('#000');
  const rows = Math.max(left.length, right.length);
  let y = startY;
  const lineH = ctx.template.density === 'compact' ? 13 : 15;
  for (let i = 0; i < rows; i++) {
    if (left[i]) {
      doc.font('Helvetica-Bold').fillColor('#555').text(`${left[i][0]}:`, PAGE.left, y, { width: 90, continued: false });
      doc.font('Helvetica').fillColor('#111').text(String(left[i][1]), PAGE.left + 92, y, { width: colW - 100 });
    }
    if (right[i]) {
      doc.font('Helvetica-Bold').fillColor('#555').text(`${right[i][0]}:`, PAGE.left + colW, y, { width: 70 });
      doc.font('Helvetica').fillColor('#111').text(String(right[i][1]), PAGE.left + colW + 72, y, { width: colW - 80 });
    }
    y += lineH;
  }
  doc.y = y + 4;
  doc.moveTo(PAGE.left, doc.y).lineTo(PAGE.right, doc.y).lineWidth(0.5).strokeColor(tint(accent, 0.4)).stroke();
  doc.y += 8;
}

function rowHeight(ctx) {
  return ctx.template.density === 'compact' ? 15 : 17;
}

/** Render a single titled column of [label, amount] rows + a total row. */
function drawAmountColumn(doc, ctx, x, w, title, items, totalLabel, totalValue) {
  const { accent, template } = ctx;
  const rh = rowHeight(ctx);
  let y = doc.y;
  // header
  doc.rect(x, y, w, rh).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9.5)
    .text(title, x + 6, y + (rh - 10) / 2, { width: w * 0.6 });
  doc.text('Amount (Rs.)', x + 6, y + (rh - 10) / 2, { width: w - 12, align: 'right' });
  y += rh;
  doc.fontSize(9);
  items.forEach((it, idx) => {
    if (template.zebra && idx % 2 === 1) doc.rect(x, y, w, rh).fill(tint(accent, 0.88));
    doc.fillColor('#111').font('Helvetica').text(it[0], x + 6, y + (rh - 9) / 2, { width: w - 80 });
    doc.text(formatINR(it[1]), x + 6, y + (rh - 9) / 2, { width: w - 12, align: 'right' });
    y += rh;
  });
  // total
  doc.rect(x, y, w, rh).fill(tint(accent, 0.7));
  doc.fillColor('#000').font('Helvetica-Bold').text(totalLabel, x + 6, y + (rh - 9) / 2, { width: w - 80 });
  doc.text(formatINR(totalValue), x + 6, y + (rh - 9) / 2, { width: w - 12, align: 'right' });
  doc.rect(x, doc.y, w, y + rh - doc.y).lineWidth(0.5).strokeColor(tint(accent, 0.3)).stroke();
  return y + rh;
}

function drawEarningsDeductions(doc, ctx) {
  const { record, template } = ctx;
  const { earnings, deductions } = buildLineItems(record);
  const gross = Number(record.grossEarnings) || earnings.reduce((s, [, v]) => s + v, 0);
  const totalDed = Number(record.totalDeductions) || deductions.reduce((s, [, v]) => s + v, 0);

  if (template.table === 'split' || template.table === 'grid') {
    const gap = 15;
    const colW = (PAGE.width - gap) / 2;
    const top = doc.y;
    doc.y = top;
    const endL = drawAmountColumn(doc, ctx, PAGE.left, colW, 'Earnings', earnings, 'Gross Earnings', gross);
    doc.y = top;
    const endR = drawAmountColumn(doc, ctx, PAGE.left + colW + gap, colW, 'Deductions', deductions, 'Total Deductions', totalDed);
    doc.y = Math.max(endL, endR) + 8;
  } else {
    // stacked
    doc.y = drawAmountColumn(doc, ctx, PAGE.left, PAGE.width, 'Earnings', earnings, 'Gross Earnings', gross) + 8;
    doc.y = drawAmountColumn(doc, ctx, PAGE.left, PAGE.width, 'Deductions', deductions, 'Total Deductions', totalDed) + 8;
  }
}

function drawNetPay(doc, ctx) {
  const { record, accent } = ctx;
  const net = Number(record.netSalary) || 0;
  const rh = 30;
  const y = doc.y + 4;
  doc.rect(PAGE.left, y, PAGE.width, rh).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13)
    .text('NET PAY', PAGE.left + 12, y + 9, { width: 200 });
  doc.fontSize(13).text(`Rs. ${formatINR(net)}`, PAGE.left, y + 9, { width: PAGE.width - 12, align: 'right' });
  doc.y = y + rh + 6;
  doc.fillColor('#111').font('Helvetica-Oblique').fontSize(9)
    .text(`Net Pay in words: ${numberToWordsINR(net)}`, PAGE.left, doc.y, { width: PAGE.width });
  doc.y += 6;
}

/** Mandatory footer: computer-generated note (centered) + PID HCMS note (right). */
function drawFooter(doc, ctx) {
  const { config } = ctx;
  const bottom = doc.page.height - 64;
  let y = Math.max(doc.y + 16, bottom);
  if (y > doc.page.height - 56) y = doc.page.height - 56;

  if (config.signatoryLabel) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#333')
      .text(config.signatoryLabel, PAGE.left, y - 24, { width: PAGE.width, align: 'right' });
  }

  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
  y += 6;
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666')
    .text(COMPUTER_GENERATED_NOTE, PAGE.left, y, { width: PAGE.width, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor('#888')
    .text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, PAGE.left, y + 12, { width: PAGE.width, align: 'left' });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#00A7B5')
    .text(PID_HCMS_NOTE, PAGE.left, y + 12, { width: PAGE.width, align: 'right' });
}

/** Render one full payslip onto the current page of `doc`. */
function renderPayslip(doc, ctx) {
  drawHeader(doc, ctx);
  drawInfoBlock(doc, ctx);
  drawEarningsDeductions(doc, ctx);
  drawNetPay(doc, ctx);
  drawFooter(doc, ctx);
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Generate a single-page payslip PDF in the company's chosen format.
 * @param {Object} record   payroll record (with payrollRun)
 * @param {Object} employee employee (optionally with department/bankDetails/pfDetails)
 * @param {Object} [opts]   { company, bank, pf, templateId, config }
 * @returns {Promise<Buffer>}
 */
const generatePayslipPDF = (record, employee, opts = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderPayslip(doc, buildContext(record, employee, opts));
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate a multi-page PDF: one formatted payslip per employee, plus a summary.
 * @param {Object[]} records
 * @param {Object[]} employees
 * @param {Object} [opts] { company, config, templateId }
 */
const generateBulkPayslips = (records, employees, opts = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const empById = new Map(employees.map((e) => [e.id, e]));
      records.forEach((record, i) => {
        if (i > 0) doc.addPage();
        const employee = record.employee || empById.get(record.employeeId) || {};
        renderPayslip(doc, buildContext(record, employee, {
          ...opts,
          bank: employee.bankDetails,
          pf: employee.pfDetails,
        }));
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generatePayslipPDF,
  generateBulkPayslips,
  // exported for tests / reuse
  formatINR,
  numberToWordsINR,
};
