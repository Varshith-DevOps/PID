const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { normalizeSubdomain } = require('../utils/subdomain');

/**
 * Public tenant branding lookup for the workspace login screen. No auth — returns
 * only non-sensitive identity so a tenant subdomain can render its name/logo.
 * GET /api/public/tenant/:subdomain
 */
router.get('/tenant/:subdomain', async (req, res) => {
  try {
    const sub = normalizeSubdomain(req.params.subdomain);
    if (!sub) return res.status(404).json({ error: 'Unknown workspace' });

    const company = await prisma.company.findFirst({
      where: { subdomain: sub },
      select: { name: true, logoUrl: true, subdomain: true, status: true },
    });
    if (!company || company.status !== 'ACTIVE') {
      return res.status(404).json({ error: 'Unknown or inactive workspace' });
    }
    res.json({ name: company.name, logoUrl: company.logoUrl, subdomain: company.subdomain });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
