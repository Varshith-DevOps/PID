/**
 * @fileoverview Prisma database client configuration.
 * Provides a singleton PrismaClient instance used throughout the application.
 * Includes development logging and graceful shutdown handling.
 * @module config/database
 */

const { PrismaClient } = require('@prisma/client');
const { tenantStorage } = require('../utils/tenantContext');
const { encryptWriteData, decryptReadResult } = require('../services/encryption');

/**
 * Singleton Prisma client instance.
 * Logs warnings and errors in all environments.
 * @type {import('@prisma/client').PrismaClient}
 */
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
  // Interactive transactions default to a 5s timeout, which is fine locally but
  // too tight for bulk work (e.g. a payroll run issuing many queries) against a
  // remote/pooled database. Raise the defaults; harmless on fast local SQLite.
  transactionOptions: {
    maxWait: 15000,   // wait up to 15s to acquire a pooled connection
    timeout: 60000,   // allow a transaction up to 60s to complete
  },
});

// Models carrying a companyId column that MUST be scoped to the caller's tenant.
// The query extension below injects `where.companyId` on reads and populates it on
// writes for every model in this list. Keep it in sync with the schema: any model
// with a `companyId` field belongs here, or it becomes a cross-tenant IDOR surface.
const tenantModels = [
  'User',
  'Department',
  'Employee',
  'Branch',
  'Location',
  'LegalEntity',
  'PolicyDefinition',
  'WorkflowDefinition',
  'IntegrationConnection',
  'ComplianceObligation',
  'Subscription',
  'PaymentTransaction',
  // Company-level operational models — previously global/relation-only and thus
  // readable across tenants by id. Now carry a companyId and are isolated here.
  'AttendanceSettings',
  'PayrollSettings',
  'PayrollRun',
  'Project',
  'Task',
  'Sprint',
  'JobOpening',
  'ShiftType',
  'ChecklistTemplate',
  'Holiday',
  'BiometricDevice',
  'Asset',
  'LearningCourse'
];

// Multi-tenant query isolation + transparent field-level encryption extension
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const companyId = tenantStorage.getStore();

        // Encrypt sensitive fields on the way in (create/update/upsert/createMany).
        if (['create', 'update', 'createMany', 'updateMany'].includes(operation) && args.data) {
          encryptWriteData(model, args.data);
        }
        if (operation === 'upsert') {
          if (args.create) encryptWriteData(model, args.create);
          if (args.update) encryptWriteData(model, args.update);
        }

        let result;
        if (companyId && tenantModels.includes(model)) {
          // Convert findUnique queries to findFirst to avoid unique index validation errors
          if (operation === 'findUnique') {
            args.where = args.where || {};
            args.where.companyId = companyId;
            const prismaModelName = model.charAt(0).toLowerCase() + model.slice(1);
            result = await basePrisma[prismaModelName].findFirst(args);
            return decryptReadResult(result);
          }

          if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'].includes(operation)) {
            args.where = args.where || {};
            if (args.where.companyId === undefined) {
              args.where.companyId = companyId;
            }
          }

          // Auto-populate companyId on create
          if (['create', 'createMany'].includes(operation)) {
            if (operation === 'create') {
              args.data = args.data || {};
              if (args.data.companyId === undefined) {
                args.data.companyId = companyId;
              }
            } else if (operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data.forEach(item => {
                  if (item.companyId === undefined) {
                    item.companyId = companyId;
                  }
                });
              } else if (args.data) {
                if (args.data.companyId === undefined) {
                  args.data.companyId = companyId;
                }
              }
            }
          }
        }

        result = await query(args);
        // Decrypt sensitive fields on the way out (covers nested relation includes).
        return decryptReadResult(result);
      }
    }
  }
});

/**
 * Disconnect the underlying Prisma client. Called by the server's graceful
 * shutdown sequence (see src/index.js) — this module no longer registers its own
 * process signal handlers so the HTTP server can drain in-flight requests first.
 */
prisma.$disconnectBase = () => basePrisma.$disconnect();

module.exports = prisma;