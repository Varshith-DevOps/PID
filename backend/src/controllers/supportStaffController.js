/**
 * @fileoverview Platform support/maintenance staff management.
 * SUPER_ADMIN creates SUPPORT users (platform-level, no home company) and grants
 * them READ-ONLY visibility into specific customer tenants via SupportAssignment.
 * The auth middleware scopes a support user's reads to an assigned company when
 * they "view" it, and rejects any write. Support users carry default VIEW/EXPORT
 * permissions only (see permissionController getDefaultPermissions).
 * @module controllers/supportStaffController
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { PLATFORM_STAFF_ROLES } = require('../rbac/platformRoles');
const { logPlatformAction } = require('../services/platformAudit');

const sanitizeStaff = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  assignments: (u.supportAssignments || [])
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => ({
      id: a.id,
      companyId: a.companyId,
      companyName: a.company?.name || null,
      companyCode: a.company?.code || null,
      companyStatus: a.company?.status || null,
      status: a.status,
      createdAt: a.createdAt,
    })),
});

/** GET /api/platform-admin/support-staff — list all platform staff + (support) assignments. */
const listSupportStaff = async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: PLATFORM_STAFF_ROLES } },
      include: {
        supportAssignments: {
          include: { company: { select: { id: true, name: true, code: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(staff.map(sanitizeStaff));
  } catch (error) {
    console.error('[SUPPORT LIST ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to retrieve platform staff' });
  }
};

/** POST /api/platform-admin/support-staff — create a platform-staff user with a role. */
const createSupportStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const role = String(req.body.role || 'SUPPORT').toUpperCase();
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (!PLATFORM_STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid platform staff role.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        password: hashed,
        role,
        companyId: null, // platform-level account
        isActive: true,
      },
    });

    await logPlatformAction(req.user, { action: 'PLATFORM_STAFF_CREATE', entity: 'User', entityId: user.id, newDetails: { email: user.email, role }, ipAddress: req.ip });
    res.status(201).json({ message: 'Platform staff created successfully', staff: sanitizeStaff({ ...user, supportAssignments: [] }) });
  } catch (error) {
    console.error('[SUPPORT CREATE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to create platform staff' });
  }
};

/** PUT /api/platform-admin/support-staff/:id/status — activate/deactivate. */
const setSupportStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const target = await prisma.user.findFirst({ where: { id, role: { in: PLATFORM_STAFF_ROLES } } });
    if (!target) return res.status(404).json({ error: 'Platform staff not found.' });

    const user = await prisma.user.update({
      where: { id },
      // Bumping tokenVersion invalidates any active session on deactivate.
      data: { isActive: Boolean(isActive), tokenVersion: { increment: 1 } },
    });
    await logPlatformAction(req.user, { action: 'PLATFORM_STAFF_STATUS', entity: 'User', entityId: id, newDetails: { isActive: Boolean(isActive) }, ipAddress: req.ip });
    res.json({ message: 'Platform staff status updated', isActive: user.isActive });
  } catch (error) {
    console.error('[SUPPORT STATUS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to update support staff status' });
  }
};

/** POST /api/platform-admin/support-staff/:id/assignments — assign a tenant. */
const assignCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });

    const staff = await prisma.user.findFirst({ where: { id, role: 'SUPPORT' } });
    if (!staff) return res.status(404).json({ error: 'Support staff not found.' });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    const assignment = await prisma.supportAssignment.upsert({
      where: { staffUserId_companyId: { staffUserId: id, companyId } },
      create: { staffUserId: id, companyId, assignedById: req.user?.id || null, status: 'ACTIVE' },
      update: { status: 'ACTIVE', assignedById: req.user?.id || null },
    });
    await logPlatformAction(req.user, { action: 'SUPPORT_ASSIGN', entity: 'Company', entityId: companyId, newDetails: { staff: staff.email }, ipAddress: req.ip });
    res.json({ message: `Assigned ${staff.name} to ${company.name}`, assignment });
  } catch (error) {
    console.error('[SUPPORT ASSIGN ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to assign tenant' });
  }
};

/** DELETE /api/platform-admin/support-staff/:id/assignments/:companyId — revoke. */
const revokeCompany = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const existing = await prisma.supportAssignment.findUnique({
      where: { staffUserId_companyId: { staffUserId: id, companyId } },
    });
    if (!existing) return res.status(404).json({ error: 'Assignment not found.' });

    await prisma.supportAssignment.update({
      where: { staffUserId_companyId: { staffUserId: id, companyId } },
      data: { status: 'REVOKED' },
    });
    await logPlatformAction(req.user, { action: 'SUPPORT_REVOKE', entity: 'Company', entityId: companyId, ipAddress: req.ip });
    res.json({ message: 'Assignment revoked' });
  } catch (error) {
    console.error('[SUPPORT REVOKE ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to revoke assignment' });
  }
};

/** GET /api/support/my-assignments — a support user's own active tenants. */
const myAssignments = async (req, res) => {
  try {
    const assignments = await prisma.supportAssignment.findMany({
      where: { staffUserId: req.user.id, status: 'ACTIVE' },
      include: { company: { select: { id: true, name: true, code: true, subdomain: true, status: true, kycStatus: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      assignments
        .filter((a) => a.company)
        .map((a) => ({
          assignmentId: a.id,
          companyId: a.companyId,
          name: a.company.name,
          code: a.company.code,
          subdomain: a.company.subdomain || a.company.code,
          status: a.company.status,
          kycStatus: a.company.kycStatus,
          logoUrl: a.company.logoUrl,
        }))
    );
  } catch (error) {
    console.error('[SUPPORT MY-ASSIGNMENTS ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to load assignments' });
  }
};

module.exports = {
  listSupportStaff,
  createSupportStaff,
  setSupportStaffStatus,
  assignCompany,
  revokeCompany,
  myAssignments,
};
