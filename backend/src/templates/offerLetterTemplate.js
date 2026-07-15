const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not specified';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const salaryRows = (offer) => [
  ['Basic Salary', offer.basicSalary],
  ['HRA', offer.hra],
  ['Special Allowance', offer.specialAllowance],
  ['Other Allowances', offer.otherAllowances],
  ['Variable Pay', offer.variablePay],
  ['Joining Bonus', offer.joiningBonus],
].filter(([, amount]) => Number(amount || 0) > 0);

const renderOfferLetterHtml = ({ offer, applicant, job, company }) => {
  const rows = salaryRows(offer);
  const companyName = company?.name || 'PID HCMS';
  const companyAddress = company?.registeredAddress || company?.address || 'Company registered office';
  const fixedCompensation = ['basicSalary', 'hra', 'specialAllowance', 'otherAllowances']
    .reduce((sum, key) => sum + Number(offer[key] || 0), 0);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Offer Letter</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #fff; font-size: 12px; line-height: 1.55; }
    .letter { width: 100%; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 54px; height: 54px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; }
    .company-name { font-size: 20px; font-weight: 700; color: #0f766e; }
    .muted { color: #6b7280; }
    h1 { font-size: 18px; text-align: center; margin: 20px 0; color: #111827; text-transform: uppercase; letter-spacing: 0; }
    h2 { font-size: 14px; margin: 18px 0 8px; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; page-break-inside: avoid; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 700; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 14px 0; }
    .summary div { border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .signature { margin-top: 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sign-line { border-top: 1px solid #111827; padding-top: 8px; margin-top: 48px; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; }
    @page { size: A4; margin: 20mm 15mm; }
  </style>
</head>
<body>
  <main class="letter">
    <section class="header">
      <div class="brand">
        ${company?.logoUrl ? `<img class="logo" src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(companyName)} logo" />` : ''}
        <div>
          <div class="company-name">${escapeHtml(companyName)}</div>
          <div class="muted">${escapeHtml(companyAddress)}</div>
        </div>
      </div>
      <div class="muted">Date: ${formatDate(new Date())}</div>
    </section>

    <div>
      <strong>To,</strong><br />
      ${escapeHtml(applicant.fullName)}<br />
      ${applicant.email ? escapeHtml(applicant.email) + '<br />' : ''}
      ${applicant.phone ? escapeHtml(applicant.phone) : ''}
    </div>

    <h1>Offer of Employment</h1>

    <p>Dear ${escapeHtml(applicant.fullName)},</p>
    <p>We are pleased to offer you employment with ${escapeHtml(companyName)} for the position of <strong>${escapeHtml(job.title)}</strong> in the ${escapeHtml(job.department?.name || 'assigned')} department.</p>

    <section class="summary">
      <div><strong>Position:</strong> ${escapeHtml(job.title)}</div>
      <div><strong>Department:</strong> ${escapeHtml(job.department?.name || 'Not specified')}</div>
      <div><strong>Work Location:</strong> ${escapeHtml(offer.workLocation || job.location || 'Not specified')}</div>
      <div><strong>Employment Type:</strong> ${escapeHtml(offer.employmentType || job.employmentType || 'FULL_TIME')}</div>
      <div><strong>Joining Date:</strong> ${formatDate(offer.joiningDate)}</div>
      <div><strong>Reporting Manager:</strong> ${escapeHtml(offer.reportingManager || 'Not specified')}</div>
      <div><strong>Probation Period:</strong> ${escapeHtml(offer.probationPeriod || 'As per company policy')}</div>
      <div><strong>Notice Period:</strong> ${escapeHtml(offer.noticePeriod || 'As per company policy')}</div>
    </section>

    <h2>Compensation Summary</h2>
    <p>Your offered annual CTC is <strong>${formatMoney(offer.offeredCtc || offer.offeredSalary)}</strong>. Fixed annual compensation is ${formatMoney(fixedCompensation)}.</p>

    <table>
      <thead><tr><th>Component</th><th>Annual Amount</th></tr></thead>
      <tbody>
        ${rows.map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td>${formatMoney(amount)}</td></tr>`).join('')}
        <tr><th>Total Offered CTC</th><th>${formatMoney(offer.offeredCtc || offer.offeredSalary)}</th></tr>
      </tbody>
    </table>

    <h2>Terms</h2>
    <p>Your working hours will be ${escapeHtml(offer.workingHours || 'as per company policy')}. This offer is subject to successful background verification, submission of required documents, and adherence to all company policies including confidentiality, information security, and code of conduct obligations.</p>
    ${offer.additionalTerms ? `<p>${escapeHtml(offer.additionalTerms)}</p>` : ''}
    <p>This offer remains valid until <strong>${formatDate(offer.offerExpiryDate)}</strong>.</p>

    <section class="signature">
      <div>
        <p>Sincerely,</p>
        <div class="sign-line">
          <strong>${escapeHtml(offer.signatoryName || 'HR Department')}</strong><br />
          ${escapeHtml(offer.signatoryDesignation || 'Human Resources')}
        </div>
      </div>
      <div>
        <p>Candidate Acceptance</p>
        <div class="sign-line">
          Signature / Name and Date
        </div>
      </div>
    </section>

    <div class="footer">Confidential employment offer. This document is intended only for the named candidate.</div>
  </main>
</body>
</html>`;
};

module.exports = {
  renderOfferLetterHtml,
  escapeHtml,
  formatDate,
  formatMoney,
};
