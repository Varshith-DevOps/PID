/**
 * @fileoverview Payslip template (format) configuration controller.
 *
 * Lets a company choose and customize its payslip format. Rules:
 *   - A company ADMIN may choose/customize the format the FIRST time only.
 *     Saving it sets `payslipTemplateLocked = true`.
 *   - After it is locked, only the PID hcms SUPER_ADMIN team can change it.
 *   - SUPER_ADMIN can edit any company's format at any time (bypasses the lock)
 *     and may target a specific company via `companyId`.
 *
 * @module controllers/payslipTemplateController
 */

const prisma = require('../config/database');
const { PAYSLIP_TEMPLATES, getTemplateById, normalizeConfig, DEFAULT_TEMPLATE_ID } = require('../config/payslipTemplates');

const LOCKED_MESSAGE =
  'This payslip format is locked. Contact the PID hcms Super Admin team to make further changes.';

function resolveCompanyId(req) {
  const isSuper = req.user?.role === 'SUPER_ADMIN';
  if (isSuper) return req.body?.companyId || req.query?.companyId || req.user?.companyId || null;
  return req.user?.companyId || null;
}

/**
 * GET /api/payslip/template
 * Returns the template catalog plus the company's current selection and whether
 * the current user may edit it.
 */
const getPayslipTemplate = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'No company is linked to your account.' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    const isSuper = req.user?.role === 'SUPER_ADMIN';
    const isAdmin = req.user?.role === 'ADMIN';
    const locked = Boolean(company.payslipTemplateLocked);
    const canEdit = isSuper || (isAdmin && !locked);

    res.json({
      templates: PAYSLIP_TEMPLATES,
      selected: {
        templateId: company.payslipTemplateId || DEFAULT_TEMPLATE_ID,
        config: normalizeConfig(company.payslipTemplateConfig),
        locked,
        setAt: company.payslipTemplateSetAt,
      },
      canEdit,
      lockedMessage: locked && !isSuper ? LOCKED_MESSAGE : null,
    });
  } catch (error) {
    console.error('[GET PAYSLIP TEMPLATE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PUT /api/payslip/template
 * Body: { templateId, config, companyId? }
 * Saves the selected format. Enforces the first-time-only rule for ADMINs.
 */
const updatePayslipTemplate = async (req, res) => {
  try {
    const isSuper = req.user?.role === 'SUPER_ADMIN';
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isSuper && !isAdmin) {
      return res.status(403).json({ error: 'Only an Admin or the PID hcms Super Admin team can change the payslip format.' });
    }

    const companyId = resolveCompanyId(req);
    if (!companyId) return res.status(400).json({ error: 'No company is linked to your account.' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    // Lock enforcement: once locked, only SUPER_ADMIN may change it.
    if (company.payslipTemplateLocked && !isSuper) {
      return res.status(403).json({ error: LOCKED_MESSAGE, locked: true });
    }

    const { templateId, config } = req.body || {};
    const template = getTemplateById(templateId);
    if (!templateId || template.id !== templateId) {
      return res.status(400).json({ error: 'Choose a valid payslip format from the available templates.' });
    }

    const mergedConfig = normalizeConfig(config);

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        payslipTemplateId: template.id,
        payslipTemplateConfig: JSON.stringify(mergedConfig),
        // The Admin gets exactly one customization; lock it now. SUPER_ADMIN keeps
        // edit rights regardless because it bypasses the lock above.
        payslipTemplateLocked: true,
        payslipTemplateSetById: req.user.id,
        payslipTemplateSetAt: new Date(),
      },
    });

    res.json({
      message: isSuper
        ? 'Payslip format updated by the PID hcms Super Admin team.'
        : 'Payslip format saved. Further changes now require the PID hcms Super Admin team.',
      selected: {
        templateId: updated.payslipTemplateId,
        config: normalizeConfig(updated.payslipTemplateConfig),
        locked: updated.payslipTemplateLocked,
        setAt: updated.payslipTemplateSetAt,
      },
    });
  } catch (error) {
    console.error('[UPDATE PAYSLIP TEMPLATE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getPayslipTemplate, updatePayslipTemplate };
