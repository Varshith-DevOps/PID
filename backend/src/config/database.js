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
  'AiCandidateAssessment',
  'AgentFeedback',
  'ShiftType',
  'ChecklistTemplate',
  'Holiday',
  'BiometricDevice',
  'Asset',
  'AssetRequest',
  'LearningCourse',
  'LearningCategory',
  'CourseAssignment',
  'LearningAuditLog',
  // Carries a companyId so company-wide broadcasts (no employee) stay isolated.
  'Notification',
  'NotificationTemplate',
  'NotificationPreference',
  'NotificationSetting',
  // Tenant-defined access modules — isolated per organization.
  'CustomModule'
];

// Leaf models that DON'T carry companyId but belong to a tenant via a parent
// relation. The extension AND-injects a relation filter so reads/counts can never
// span tenants (e.g. attendance is scoped through its employee's companyId).
// Value is the relation path from the model up to a record that has `companyId`.
const relationScopedModels = {
  Attendance: 'employee', AttendanceRegularization: 'employee', BankDetails: 'employee',
  ChangeHistory: 'employee', Dependent: 'employee', Document: 'employee', Education: 'employee',
  EmployeeAddress: 'employee', EmployeeChecklistTask: 'employee', EmployeeTaxDeclaration: 'employee',
  ExitDetails: 'employee', ExpenseClaim: 'employee', Feedback360: 'employee', HelpdeskTicket: 'employee',
  KRA: 'employee', LearningEnrollment: 'employee', LearningBookmark: 'employee', LearningNotification: 'employee', Certificate: 'employee', Leave: 'employee', LeaveQuota: 'employee',
  Overtime: 'employee', PFDetails: 'employee', PayrollRecord: 'employee', PerformanceAppraisal: 'employee',
  PreviousEmployerIncome: 'employee', ProfessionalExperience: 'employee', ProjectResource: 'employee',
  SalaryRevision: 'employee', SalaryStructure: 'employee', ShiftAssignment: 'employee', TDSLedger: 'employee',
  Timesheet: 'employee', TravelAdvance: 'employee',
  JobApplicant: 'jobOpening',
  ProjectExpense: 'project',
  CourseMaterial: 'course',
  Quiz: 'course',
  QuizQuestion: ['quiz', 'course'],
  QuizAttempt: ['enrollment', 'employee'],
  ChecklistTemplateTask: 'template',
  PayrollApproval: 'payrollRun',
  NotificationLog: 'notification',
  Interview: ['applicant', 'jobOpening'],
  JobOffer: ['applicant', 'jobOpening'],
};

// Build a nested relation `where` ending in { companyId }, e.g.
//   'employee'                     -> { employee: { companyId } }
//   ['applicant','jobOpening']     -> { applicant: { jobOpening: { companyId } } }
const buildRelationWhere = (spec, companyId) => {
  const path = Array.isArray(spec) ? spec : [spec];
  return path.reduceRight((acc, rel) => ({ [rel]: acc }), { companyId });
};

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

        // Relation-scoped leaf models: AND-inject the tenant relation filter so a
        // read/count/aggregate can never cross tenants. Never overwrites caller
        // filters (wrapped in AND).
        if (companyId && relationScopedModels[model]) {
          const relWhere = buildRelationWhere(relationScopedModels[model], companyId);
          if (operation === 'findUnique') {
            const prismaModelName = model.charAt(0).toLowerCase() + model.slice(1);
            let flatWhere = {};
            if (args.where) {
              for (const key in args.where) {
                if (args.where[key] && typeof args.where[key] === 'object' && !Array.isArray(args.where[key]) && !(args.where[key] instanceof Date)) {
                  let isCompoundKey = true;
                  const operators = ['lt', 'lte', 'gt', 'gte', 'equals', 'in', 'notIn', 'contains', 'startsWith', 'endsWith', 'not', 'mode'];
                  for (const subKey in args.where[key]) {
                    if (operators.includes(subKey)) {
                      isCompoundKey = false;
                      break;
                    }
                  }
                  if (isCompoundKey) {
                    Object.assign(flatWhere, args.where[key]);
                  } else {
                    flatWhere[key] = args.where[key];
                  }
                } else {
                  flatWhere[key] = args.where[key];
                }
              }
            }
            args.where = { AND: [flatWhere, relWhere] };
            result = await basePrisma[prismaModelName].findFirst(args);
            return decryptReadResult(result);
          }
          if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'].includes(operation)) {
            args.where = { AND: [args.where || {}, relWhere] };
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

/**
 * Executes a callback within a PostgreSQL RLS transaction context,
 * setting the session-level GUC app.current_company_id to isolate records.
 */
prisma.$withTenant = async (companyId, work) => {
  return prisma.$transaction(async (tx) => {
    const value = companyId || 'ALL';
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql') || process.env.DATABASE_URL?.startsWith('postgres');
    if (isPostgres) {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id = '${value}'`);
    }
    return work(tx);
  });
};

module.exports = prisma;
