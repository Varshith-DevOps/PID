/**
 * @fileoverview Payslip template catalog.
 *
 * Defines the 8 selectable payslip formats a company can choose from. Each entry
 * is a *style descriptor* consumed by the PDF renderer (services/pdfService.js)
 * to produce a visually distinct, professional payslip while always showing the
 * same mandatory payroll data.
 *
 * The same catalog is returned to the frontend so the Admin can preview and pick
 * a format. Keep ids stable — they are stored on the company record.
 *
 * @module config/payslipTemplates
 */

/**
 * @typedef {Object} PayslipTemplate
 * @property {string} id            Stable identifier stored on the company.
 * @property {string} name          Display name.
 * @property {string} description   One-line summary for the picker.
 * @property {string} accent        Default accent colour (hex).
 * @property {'band'|'centered'|'letterhead'|'minimal'|'boxed'|'sidebar'} header  Header style.
 * @property {'split'|'stacked'|'grid'} table  Earnings/deductions layout.
 * @property {'comfortable'|'compact'} density  Vertical spacing.
 * @property {boolean} zebra        Alternating row shading.
 * @property {boolean} showLogo     Reserve space for the company logo.
 */

/** @type {PayslipTemplate[]} */
const PAYSLIP_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional payslip with a centered title and a two-column earnings/deductions table.',
    accent: '#1f2937',
    header: 'centered',
    table: 'split',
    density: 'comfortable',
    zebra: false,
    showLogo: false,
  },
  {
    id: 'modern',
    name: 'Modern Accent',
    description: 'Contemporary layout with a coloured header band and clean split columns.',
    accent: '#00A7B5',
    header: 'band',
    table: 'split',
    density: 'comfortable',
    zebra: true,
    showLogo: true,
  },
  {
    id: 'corporate',
    name: 'Corporate Letterhead',
    description: 'Formal letterhead with logo and company address block at the top.',
    accent: '#182B6D',
    header: 'letterhead',
    table: 'split',
    density: 'comfortable',
    zebra: false,
    showLogo: true,
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Condensed single-page format that fits the essentials with minimal spacing.',
    accent: '#374151',
    header: 'centered',
    table: 'split',
    density: 'compact',
    zebra: false,
    showLogo: false,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Comprehensive format showing bank, PF/UAN, attendance and full statutory breakup.',
    accent: '#0f766e',
    header: 'band',
    table: 'stacked',
    density: 'comfortable',
    zebra: true,
    showLogo: true,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Light, spacious design with thin rules and understated typography.',
    accent: '#6b7280',
    header: 'minimal',
    table: 'split',
    density: 'comfortable',
    zebra: false,
    showLogo: false,
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Premium look with boxed sections and accent borders.',
    accent: '#7c3aed',
    header: 'boxed',
    table: 'grid',
    density: 'comfortable',
    zebra: false,
    showLogo: true,
  },
  {
    id: 'banded',
    name: 'Banded Grid',
    description: 'Grid earnings/deductions with bold alternating bands for quick reading.',
    accent: '#b45309',
    header: 'band',
    table: 'grid',
    density: 'comfortable',
    zebra: true,
    showLogo: true,
  },
];

const DEFAULT_TEMPLATE_ID = 'classic';

const getTemplateById = (id) =>
  PAYSLIP_TEMPLATES.find((t) => t.id === id) ||
  PAYSLIP_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);

/** Default, safe customization config applied when none is saved. */
const DEFAULT_CONFIG = {
  accent: null,            // null => use the template's default accent
  showLogo: true,
  showBankDetails: true,
  showAttendance: true,
  showYearToDate: false,
  headerNote: '',          // optional company address / tagline under the name
  signatoryLabel: '',      // e.g. "For Acme Pvt Ltd" (optional)
};

const normalizeConfig = (raw) => {
  let parsed = {};
  if (raw && typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  }
  return { ...DEFAULT_CONFIG, ...parsed };
};

module.exports = {
  PAYSLIP_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_CONFIG,
  getTemplateById,
  normalizeConfig,
};
