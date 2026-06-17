/**
 * @fileoverview Prisma database client configuration.
 * Provides a singleton PrismaClient instance used throughout the application.
 * Includes development logging and graceful shutdown handling.
 * @module config/database
 */

const { PrismaClient } = require('@prisma/client');
const { tenantStorage } = require('../utils/tenantContext');

/**
 * Singleton Prisma client instance.
 * Logs warnings and errors in all environments.
 * @type {import('@prisma/client').PrismaClient}
 */
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

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
  'PaymentTransaction'
];

// Multi-tenant query isolation extension
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const companyId = tenantStorage.getStore();

        if (companyId && tenantModels.includes(model)) {
          // Convert findUnique queries to findFirst to avoid unique index validation errors
          if (operation === 'findUnique') {
            args.where = args.where || {};
            args.where.companyId = companyId;
            const prismaModelName = model.charAt(0).toLowerCase() + model.slice(1);
            return basePrisma[prismaModelName].findFirst(args);
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

        return query(args);
      }
    }
  }
});

/**
 * Gracefully disconnect Prisma on process termination.
 * Ensures all pending database operations complete before exit.
 */
const shutdown = async () => {
  await basePrisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = prisma;