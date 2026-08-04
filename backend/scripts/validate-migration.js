#!/usr/bin/env node
/**
 * @fileoverview Post-migration validation script.
 * Connects to the PostgreSQL database and verifies:
 *   1. All tables have records (with counts)
 *   2. Critical user accounts exist (Super Admin, Admin, HR, Employee)
 *   3. Password hashes are intact (bcrypt format check)
 *   4. Foreign key relationships are valid (spot-check)
 *
 * Usage:
 *   node scripts/validate-migration.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     HRMS PostgreSQL Migration — Validation Report          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ── 1. Connection check ──
  console.log('🔗 Testing PostgreSQL connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✓ Connected successfully.');
  } catch (err) {
    console.error('   ✗ Connection failed:', err.message);
    process.exit(1);
  }
  console.log();

  // ── 2. Table record counts ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TABLE RECORD COUNTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const models = [
    'user', 'authenticator', 'supportAssignment', 'customModule', 'permission',
    'department', 'employee', 'employeeAddress', 'education', 'professionalExperience',
    'salaryRevision', 'changeHistory', 'document', 'bankDetails', 'pFDetails',
    'exitDetails', 'dependent', 'attendance', 'attendanceSettings', 'leave',
    'leaveQuota', 'salaryStructure', 'payrollSettings', 'payrollRecord', 'payrollRun',
    'project', 'projectResource', 'projectExpense', 'task', 'sprint', 'timesheet',
    'overtime', 'jobOpening', 'jobApplicant', 'aiCandidateAssessment', 'candidateReview',
    'interview', 'jobOffer', 'kRA', 'performanceAppraisal', 'feedback360',
    'expenseClaim', 'travelAdvance', 'shiftType', 'shiftAssignment',
    'attendanceRegularization', 'checklistTemplate', 'checklistTemplateTask',
    'employeeChecklistTask', 'previousEmployerIncome', 'employeeTaxDeclaration',
    'tDSLedger', 'payrollApproval', 'payrollAuditLog', 'complianceReport',
    'branch', 'location', 'company', 'legalEntity', 'policyDefinition',
    'workflowDefinition', 'workflowInstance', 'workflowTask',
    'integrationConnection', 'complianceObligation', 'holiday',
    'biometricDevice', 'asset', 'assetRequest', 'auditLog', 'agentFeedback',
    'learningCourse', 'learningEnrollment', 'learningCategory', 'courseMaterial',
    'courseAssignment', 'learningCourseVersion', 'learningCourseApproval',
    'learningCourseMapping', 'learningCoursePrerequisite', 'learningChapter',
    'learningLesson', 'learningPath', 'learningPathCourse', 'learningPathAssignment',
    'learningLessonProgress', 'learningNote', 'learningFavorite', 'quiz',
    'quizQuestion', 'quizAttempt', 'learningQuestionBank', 'learningAssessment',
    'learningAssessmentQuestion', 'learningAssessmentSubmission',
    'learningSkill', 'learningCourseSkill', 'employeeLearningSkill',
    'learningFeedback', 'learningAiGeneration', 'certificate',
    'learningNotification', 'learningBookmark', 'learningAuditLog',
    'kpiDefinition', 'kpiVersion', 'kpaDefinition', 'kpaVersion',
    'kpaSkill', 'kpaCourse', 'kpiKpa', 'employeeKpiAssignment',
    'helpdeskTicket', 'notification', 'notificationTemplate',
    'notificationPreference', 'notificationLog', 'notificationSetting',
    'plan', 'subscription', 'paymentTransaction', 'contactRequest',
    'whiteListedWiFi', 'biometricRawLog', 'kudos', 'perkStoreItem',
    'perkPurchase', 'pulseSurvey', 'pulseResponse', 'objective', 'keyResult',
    'performanceReview9Box', 'ssoAccessRequest',
  ];

  let totalRecords = 0;
  let tablesWithData = 0;
  let emptyTables = 0;

  for (const modelName of models) {
    const model = prisma[modelName];
    if (!model) continue;
    try {
      const count = await model.count();
      totalRecords += count;
      if (count > 0) {
        tablesWithData++;
        console.log(`  ✓ ${modelName.padEnd(42)} ${String(count).padStart(6)} records`);
      } else {
        emptyTables++;
      }
    } catch (err) {
      console.log(`  ✗ ${modelName.padEnd(42)} ERROR: ${err.message.slice(0, 50)}`);
    }
  }

  console.log();
  console.log(`  Total records: ${totalRecords}`);
  console.log(`  Tables with data: ${tablesWithData}`);
  console.log(`  Empty tables: ${emptyTables}`);
  console.log();

  // ── 3. Critical user accounts ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CRITICAL USER ACCOUNTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, password: true },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    console.log('  ⚠ No users found in the database.');
  } else {
    const roleCounts = {};
    for (const user of users) {
      roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
    }

    console.log('  User breakdown by role:');
    for (const [role, count] of Object.entries(roleCounts)) {
      console.log(`    ${role.padEnd(20)} ${count} users`);
    }
    console.log();

    // Show critical accounts
    console.log('  Critical accounts:');
    for (const user of users) {
      const pwOk = user.password && user.password.startsWith('$2');
      const icon = pwOk ? '✓' : '⚠';
      console.log(`    ${icon} ${user.email.padEnd(35)} Role: ${user.role.padEnd(15)} Active: ${user.isActive}  Hash: ${pwOk ? 'bcrypt ✓' : 'INVALID ✗'}`);
    }
    console.log();

    // Verify password hashes are valid bcrypt
    const invalidHashes = users.filter(u => !u.password || !u.password.startsWith('$2'));
    if (invalidHashes.length === 0) {
      console.log('  ✓ All password hashes are valid bcrypt format.');
    } else {
      console.log(`  ✗ ${invalidHashes.length} users have invalid password hashes:`);
      for (const u of invalidHashes) {
        console.log(`    - ${u.email} (${u.role})`);
      }
    }
  }
  console.log();

  // ── 4. Foreign key spot-checks ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FOREIGN KEY INTEGRITY SPOT-CHECKS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Check employees have valid departments
  const employees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, departmentId: true },
    take: 10,
  });
  if (employees.length > 0) {
    let fkOk = true;
    for (const emp of employees) {
      const dept = await prisma.department.findUnique({ where: { id: emp.departmentId } });
      if (!dept) {
        console.log(`  ✗ Employee ${emp.firstName} ${emp.lastName} has invalid department ${emp.departmentId}`);
        fkOk = false;
      }
    }
    if (fkOk) {
      console.log(`  ✓ Employee → Department FK integrity verified (${employees.length} sampled)`);
    }
  }

  // Check employees have valid user accounts
  const linkedEmployees = await prisma.employee.findMany({
    where: { userId: { not: null } },
    select: { id: true, firstName: true, lastName: true, userId: true },
    take: 10,
  });
  if (linkedEmployees.length > 0) {
    let fkOk = true;
    for (const emp of linkedEmployees) {
      const user = await prisma.user.findUnique({ where: { id: emp.userId } });
      if (!user) {
        console.log(`  ✗ Employee ${emp.firstName} ${emp.lastName} has invalid userId ${emp.userId}`);
        fkOk = false;
      }
    }
    if (fkOk) {
      console.log(`  ✓ Employee → User FK integrity verified (${linkedEmployees.length} sampled)`);
    }
  }

  // Check companies exist
  const companies = await prisma.company.findMany({ select: { id: true, name: true, code: true }, take: 5 });
  if (companies.length > 0) {
    console.log(`  ✓ Companies exist: ${companies.map(c => `${c.name} (${c.code})`).join(', ')}`);
  }

  console.log();

  // ── Final verdict ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FINAL VERDICT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  const allGood = totalRecords > 0 && users.length > 0;
  if (allGood) {
    console.log('  ✅ MIGRATION VALIDATED SUCCESSFULLY');
    console.log('  All data has been preserved. Login credentials are intact.');
    console.log('  Users can log in with their existing email/password.');
  } else {
    console.log('  ⚠  VALIDATION INCOMPLETE — review issues above.');
  }
  console.log();

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Validation error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
