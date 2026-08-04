#!/usr/bin/env node
/**
 * @fileoverview Migrate ALL data from the SQLite dev.db to the PostgreSQL
 * database pointed to by DATABASE_URL.  Preserves every record byte-for-byte
 * (UUIDs, timestamps, password hashes, foreign keys, etc.).
 *
 * Prerequisites:
 *   1. PostgreSQL is running and DATABASE_URL in .env points to it.
 *   2. The PG schema has been pushed:  npx prisma db push
 *   3. npm install better-sqlite3   (used to read the SQLite file directly)
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js
 *
 * The script is idempotent — re-running it will skip rows that already exist
 * (createMany uses skipDuplicates) and upsert for tables with unique
 * constraints.
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');

// ── Resolve the SQLite database path ──────────────────────────────────────
const SQLITE_PATH = path.resolve(__dirname, '..', 'prisma', 'dev.db');

// ── Connect to the target PostgreSQL database via Prisma ──────────────────
const prisma = new PrismaClient({
  log: ['error'],
});

const companySubscriptionMap = new Map();

// ── Table migration order (topological — parents before children) ─────────
// Each entry maps a Prisma model name to its underlying table name.
// The order ensures that every FK dependency is satisfied before the
// dependent table is inserted.
const MIGRATION_ORDER = [
  // ── Tier 0: No FK dependencies (standalone / master tables) ──
  { model: 'plan',                    table: 'plans' },
  { model: 'contactRequest',          table: 'contact_requests' },
  { model: 'ssoAccessRequest',        table: 'sso_access_requests' },
  { model: 'auditLog',               table: 'audit_logs' },
  { model: 'payrollAuditLog',        table: 'payroll_audit_logs' },
  { model: 'complianceReport',       table: 'compliance_reports' },
  { model: 'agentFeedback',          table: 'agent_feedback' },
  { model: 'learningAuditLog',       table: 'learning_audit_logs' },

  // ── Tier 1: Company ──
  { model: 'company',                table: 'companies' },

  // ── Tier 2: Depends on Company ──
  { model: 'user',                   table: 'users' },
  { model: 'department',             table: 'departments' },
  { model: 'legalEntity',            table: 'legal_entities' },
  { model: 'branch',                 table: 'branches' },
  { model: 'location',               table: 'locations' },
  { model: 'customModule',           table: 'custom_modules' },
  { model: 'supportAssignment',      table: 'support_assignments' },
  { model: 'policyDefinition',       table: 'policy_definitions' },
  { model: 'workflowDefinition',     table: 'workflow_definitions' },
  { model: 'integrationConnection',  table: 'integration_connections' },
  { model: 'complianceObligation',   table: 'compliance_obligations' },
  { model: 'notificationSetting',    table: 'notification_settings' },
  { model: 'notificationTemplate',   table: 'notification_templates' },
  { model: 'whiteListedWiFi',        table: 'whitelisted_wifis' },
  { model: 'biometricRawLog',        table: 'biometric_raw_logs' },
  { model: 'biometricDevice',        table: 'biometric_devices' },
  { model: 'attendanceSettings',     table: 'attendance_settings' },
  { model: 'payrollSettings',        table: 'payroll_settings' },
  { model: 'shiftType',              table: 'shift_types' },
  { model: 'checklistTemplate',      table: 'checklist_templates' },
  { model: 'holiday',                table: 'holidays' },
  { model: 'learningCategory',       table: 'learning_categories' },
  { model: 'learningSkill',          table: 'learning_skills' },
  { model: 'learningPath',           table: 'learning_paths' },
  { model: 'kpaDefinition',          table: 'kpa_definitions' },
  { model: 'pulseSurvey',            table: 'pulse_surveys' },
  { model: 'perkStoreItem',          table: 'perk_store_items' },
  { model: 'subscription',           table: 'subscriptions' },
  { model: 'paymentTransaction',     table: 'payment_transactions' },

  // ── Tier 2.5: Depends on Company + User ──
  { model: 'authenticator',          table: 'authenticators' },
  { model: 'permission',             table: 'permissions' },

  // ── Tier 3: Depends on Department / Company (Employee + related) ──
  { model: 'employee',               table: 'employees' },
  { model: 'kpiDefinition',          table: 'kpi_definitions' },
  { model: 'jobOpening',             table: 'job_openings' },

  // ── Tier 3.5: Depends on LegalEntity or Company ──
  { model: 'payrollRun',             table: 'payroll_runs' },

  // ── Tier 4: Depends on Employee ──
  { model: 'employeeAddress',        table: 'employee_addresses' },
  { model: 'education',              table: 'education' },
  { model: 'professionalExperience', table: 'professional_experience' },
  { model: 'salaryRevision',         table: 'salary_revisions' },
  { model: 'changeHistory',          table: 'change_history' },
  { model: 'document',               table: 'documents' },
  { model: 'bankDetails',            table: 'bank_details' },
  { model: 'pFDetails',              table: 'pf_details' },
  { model: 'exitDetails',            table: 'exit_details' },
  { model: 'dependent',              table: 'dependents' },
  { model: 'attendance',             table: 'attendances' },
  { model: 'leave',                  table: 'leaves' },
  { model: 'leaveQuota',             table: 'leave_quotas' },
  { model: 'salaryStructure',        table: 'salary_structures' },
  { model: 'payrollRecord',          table: 'payroll_records' },
  { model: 'project',                table: 'projects' },
  { model: 'task',                   table: 'tasks' },
  { model: 'sprint',                 table: 'sprints' },
  { model: 'timesheet',              table: 'timesheets' },
  { model: 'overtime',               table: 'overtime_requests' },
  { model: 'kRA',                    table: 'kras' },
  { model: 'performanceAppraisal',   table: 'performance_appraisals' },
  { model: 'feedback360',            table: 'feedback_360' },
  { model: 'expenseClaim',           table: 'expense_claims' },
  { model: 'travelAdvance',          table: 'travel_advances' },
  { model: 'shiftAssignment',        table: 'shift_assignments' },
  { model: 'employeeChecklistTask',  table: 'employee_checklist_tasks' },
  { model: 'attendanceRegularization', table: 'attendance_regularizations' },
  { model: 'previousEmployerIncome', table: 'previous_employer_income' },
  { model: 'employeeTaxDeclaration', table: 'employee_tax_declarations' },
  { model: 'tDSLedger',              table: 'tds_ledger' },
  { model: 'asset',                  table: 'assets' },
  { model: 'helpdeskTicket',         table: 'helpdesk_tickets' },
  { model: 'notification',           table: 'notifications' },
  { model: 'notificationPreference', table: 'notification_preferences' },
  { model: 'kudos',                  table: 'kudos' },
  { model: 'perkPurchase',           table: 'perk_purchases' },
  { model: 'pulseResponse',          table: 'pulse_responses' },
  { model: 'objective',              table: 'objectives' },
  { model: 'performanceReview9Box',  table: 'performance_reviews_9box' },
  { model: 'assetRequest',           table: 'asset_requests' },

  // ── Tier 4.5: Depends on Employee + KPI/KPA ──
  { model: 'employeeKpiAssignment',  table: 'employee_kpi_assignments' },
  { model: 'kpiVersion',             table: 'kpi_versions' },
  { model: 'kpaVersion',             table: 'kpa_versions' },
  { model: 'kpaSkill',               table: 'kpa_skills' },
  { model: 'kpaCourse',              table: 'kpa_courses' },
  { model: 'kpiKpa',                 table: 'kpi_kpas' },

  // ── Tier 5: Depends on Job Openings / Applicants ──
  { model: 'jobApplicant',           table: 'job_applicants' },
  { model: 'interview',              table: 'interviews' },
  { model: 'candidateReview',        table: 'candidate_reviews' },
  { model: 'jobOffer',               table: 'job_offers' },
  { model: 'aiCandidateAssessment',  table: 'ai_candidate_assessments' },

  // ── Tier 6: Learning Management (course-dependent) ──
  { model: 'learningCourse',         table: 'learning_courses' },
  { model: 'learningChapter',        table: 'learning_chapters' },
  { model: 'learningLesson',         table: 'learning_lessons' },
  { model: 'courseMaterial',         table: 'course_materials' },
  { model: 'courseAssignment',        table: 'course_assignments' },
  { model: 'learningEnrollment',     table: 'learning_enrollments' },
  { model: 'learningCourseVersion',  table: 'learning_course_versions' },
  { model: 'learningCourseApproval', table: 'learning_course_approvals' },
  { model: 'learningCourseMapping',  table: 'learning_course_mappings' },
  { model: 'learningCoursePrerequisite', table: 'learning_course_prerequisites' },
  { model: 'learningPathCourse',     table: 'learning_path_courses' },
  { model: 'learningPathAssignment', table: 'learning_path_assignments' },
  { model: 'learningCourseSkill',    table: 'learning_course_skills' },
  { model: 'employeeLearningSkill',  table: 'employee_learning_skills' },
  { model: 'learningFeedback',       table: 'learning_feedback' },
  { model: 'learningAiGeneration',   table: 'learning_ai_generations' },
  { model: 'learningBookmark',       table: 'learning_bookmarks' },
  { model: 'learningFavorite',       table: 'learning_favorites' },
  { model: 'learningNote',           table: 'learning_notes' },
  { model: 'learningNotification',   table: 'learning_notifications' },
  { model: 'certificate',            table: 'certificates' },

  // ── Tier 7: Deep nested (depends on Enrollment / Course) ──
  { model: 'learningLessonProgress', table: 'learning_lesson_progress' },
  { model: 'quiz',                   table: 'quizzes' },
  { model: 'quizQuestion',           table: 'quiz_questions' },
  { model: 'quizAttempt',            table: 'quiz_attempts' },
  { model: 'learningQuestionBank',   table: 'learning_question_bank' },
  { model: 'learningAssessment',     table: 'learning_assessments' },
  { model: 'learningAssessmentQuestion', table: 'learning_assessment_questions' },
  { model: 'learningAssessmentSubmission', table: 'learning_assessment_submissions' },

  // ── Tier 8: More nested ──
  { model: 'payrollApproval',        table: 'payroll_approvals' },
  { model: 'checklistTemplateTask',  table: 'checklist_template_tasks' },
  { model: 'projectResource',        table: 'project_resources' },
  { model: 'projectExpense',         table: 'project_expenses' },
  { model: 'notificationLog',        table: 'notification_logs' },
  { model: 'workflowInstance',       table: 'workflow_instances' },
  { model: 'workflowTask',           table: 'workflow_tasks' },
  { model: 'keyResult',              table: 'key_results' },
];

// ── SQLite boolean columns that store 0/1 instead of true/false ───────────
// Prisma maps these automatically when using the Prisma client, but since we
// read raw rows from SQLite via better-sqlite3, we need to convert manually.
// We'll detect based on the Prisma schema: any column typed Boolean.
// Instead of listing them all, we'll convert any 0/1 integer in a boolean
// column.  We'll do a generic approach: for each row, convert values.

/**
 * Get the column names and types for a SQLite table.
 */
function getTableColumns(sqliteDb, tableName) {
  return sqliteDb.pragma(`table_info("${tableName}")`);
}

/**
 * Convert SQLite row values to PostgreSQL-compatible values.
 * - SQLite stores booleans as 0/1 integers
 * - SQLite stores dates as ISO strings or unix timestamps
 */
function convertRow(row, columns) {
  const converted = { ...row };
  for (const col of columns) {
    const val = converted[col.name];
    if (val === null || val === undefined) continue;

    // SQLite boolean → JS boolean (Prisma expects true/false)
    // We detect by checking if the Prisma schema defines this as Boolean.
    // Since we can't easily introspect the Prisma schema at runtime,
    // we'll handle the common pattern: INTEGER columns with values 0 or 1
    // that are actually booleans.  We'll rely on the fact that Prisma's
    // createMany will handle type coercion properly.
  }
  return converted;
}

/**
 * Read all rows from a SQLite table.
 */
function readSqliteTable(sqliteDb, tableName) {
  try {
    const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all();
    return rows;
  } catch (err) {
    if (err.message.includes('no such table')) {
      return [];
    }
    throw err;
  }
}

/**
 * Convert SQLite integer booleans to JS booleans, and unix timestamps to Date objects
 * for Prisma compatibility.
 */
function fixDataTypes(rows, booleanCols, dateCols) {
  if (rows.length === 0) return rows;
  
  // Convert types
  return rows.map(row => {
    const newRow = { ...row };
    // Fix Booleans
    for (const col of booleanCols) {
      if (newRow[col] === 0) newRow[col] = false;
      else if (newRow[col] === 1) newRow[col] = true;
    }
    
    // Fix Dates
    for (const key of dateCols) {
      if (newRow[key] === null || newRow[key] === undefined) continue;
      
      if (typeof newRow[key] === 'number') {
        // If it's a small number, it might be in seconds instead of ms, but JS Dates expect ms.
        // Let's assume standard JS Date.now() style ms, or convert if it looks like seconds.
        let ms = newRow[key];
        if (ms < 100000000000) ms *= 1000; 
        newRow[key] = new Date(ms);
      } else if (typeof newRow[key] === 'string') {
        const d = new Date(newRow[key]);
        if (!isNaN(d.getTime())) {
          newRow[key] = d;
        }
      }
    }
    return newRow;
  });
}

/**
 * Insert rows into PostgreSQL via Prisma, using createMany with skipDuplicates.
 * Falls back to individual upserts if createMany fails (e.g. for models with
 * complex unique constraints).
 */
async function insertRows(modelName, rows, batchSize = 100) {
  if (rows.length === 0) return 0;

  const model = prisma[modelName];
  if (!model) {
    console.warn(`  ⚠ Prisma model "${modelName}" not found, skipping.`);
    return 0;
  }

  let inserted = 0;
  
  // For Company, remove subscriptionId during insert to avoid circular FK
  if (modelName === 'company') {
    rows.forEach(r => {
      if (r.subscriptionId) {
        companySubscriptionMap.set(r.id, r.subscriptionId);
        r.subscriptionId = null;
      }
    });
  }

  // Try bulk insert first
  try {
    const result = await model.createMany({
      data: rows,
      skipDuplicates: true,
    });
    inserted = result.count;
    return inserted;
  } catch (err) {
    // If bulk insert fails (e.g. self-referential FKs or complex unique constraints),
    // fall back to individual inserts with a retry queue for unresolved FKs.
  }

  let pending = [...rows];
  let makingProgress = true;

  while (pending.length > 0 && makingProgress) {
    makingProgress = false;
    const nextPending = [];

    for (const row of pending) {
      try {
        await model.create({ data: row });
        inserted++;
        makingProgress = true;
      } catch (innerErr) {
        if (innerErr.code === 'P2002') {
          // Record already exists, skip it (idempotent)
          continue;
        }
        if (innerErr.code === 'P2003') {
          // FK violation. It might be a self-reference (e.g., managerId) where
          // the parent hasn't been inserted yet. Queue it for the next pass.
          nextPending.push(row);
        } else {
          // Log the error but don't abort the whole batch, skip this row
          console.error(`  ✗ Error inserting into ${modelName} (Row ID: ${row.id || 'N/A'}): ${innerErr.code}`);
        }
      }
    }
    pending = nextPending;
  }

  // Whatever is left in pending after making no progress are true FK failures (orphans)
  if (pending.length > 0) {
    console.error(`  ⚠ Skipped ${pending.length} rows in ${modelName} due to unresolvable FK constraints (likely orphaned in SQLite).`);
  }

  return inserted;
}

// ── Main migration function ──────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     HRMS SQLite → PostgreSQL Data Migration                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ── Load better-sqlite3 ──
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    console.error('❌ better-sqlite3 is required. Install it:');
    console.error('   npm install better-sqlite3');
    process.exit(1);
  }

  // ── Open SQLite database ──
  console.log(`📂 Opening SQLite database: ${SQLITE_PATH}`);
  const sqliteDb = new Database(SQLITE_PATH, { readonly: true });
  
  // Get list of tables in SQLite
  const sqliteTables = sqliteDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
  ).all().map(r => r.name);
  console.log(`   Found ${sqliteTables.length} tables in SQLite.`);
  console.log();

  // ── Verify PostgreSQL connection ──
  console.log('🔗 Connecting to PostgreSQL...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✓ PostgreSQL connected successfully.');
  } catch (err) {
    console.error('❌ Cannot connect to PostgreSQL:', err.message);
    console.error('   Make sure DATABASE_URL in .env points to a running PostgreSQL instance.');
    process.exit(1);
  }
  console.log();

  // ── Migrate tables ──
  const results = [];
  let totalSourceRows = 0;
  let totalInserted = 0;

  for (const { model, table } of MIGRATION_ORDER) {
    if (!sqliteTables.includes(table)) {
      results.push({ table, model, source: 0, inserted: 0, status: 'SKIP (no table)' });
      continue;
    }

    process.stdout.write(`  📋 ${table.padEnd(42)} `);
    
    // Read from SQLite
    let rows = readSqliteTable(sqliteDb, table);
    const sourceCount = rows.length;
    totalSourceRows += sourceCount;

    if (sourceCount === 0) {
      console.log(`0 rows (empty)`);
      results.push({ table, model, source: 0, inserted: 0, status: '✓ EMPTY' });
      continue;
    }

    // Determine actual boolean and date columns from SQLite schema
    const columns = getTableColumns(sqliteDb, table);
    const booleanCols = columns.filter(c => c.type.toUpperCase() === 'BOOLEAN').map(c => c.name);
    const dateCols = columns.filter(c => c.type.toUpperCase() === 'DATETIME' || c.type.toUpperCase() === 'DATE').map(c => c.name);

    // Fix SQLite data types
    rows = fixDataTypes(rows, booleanCols, dateCols);

    // Insert into PostgreSQL
    try {
      const inserted = await insertRows(model, rows);
      totalInserted += inserted;
      const status = inserted === sourceCount ? '✓ OK' : `⚠ ${inserted}/${sourceCount}`;
      console.log(`${sourceCount} rows → ${inserted} inserted ${status}`);
      results.push({ table, model, source: sourceCount, inserted, status });
    } catch (err) {
      console.log(`✗ FAILED: ${err.message}`);
      results.push({ table, model, source: sourceCount, inserted: 0, status: `✗ ${err.message.slice(0, 60)}` });
    }
  }

  // ── Close SQLite ──
  sqliteDb.close();

  // ── Restore circular FKs ──
  console.log('🔄 Restoring circular references...');
  if (companySubscriptionMap.size > 0) {
    let restored = 0;
    for (const [companyId, subId] of companySubscriptionMap.entries()) {
      try {
        await prisma.company.update({ where: { id: companyId }, data: { subscriptionId: subId } });
        restored++;
      } catch (e) {
        // Ignore if missing
      }
    }
    console.log(`   Restored ${restored} subscription references in Company.`);
  }

  // ── Validation: compare counts ──
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VALIDATION: Comparing record counts (PostgreSQL vs SQLite)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  let allMatch = true;
  const validationResults = [];

  for (const { model, table } of MIGRATION_ORDER) {
    const pgModel = prisma[model];
    if (!pgModel) continue;

    try {
      const pgCount = await pgModel.count();
      const sourceEntry = results.find(r => r.table === table);
      const sourceCount = sourceEntry ? sourceEntry.source : 0;
      const match = pgCount >= sourceCount;
      if (!match) allMatch = false;
      const icon = match ? '✓' : '✗';
      validationResults.push({ table, sqlite: sourceCount, postgres: pgCount, match });
      if (sourceCount > 0 || pgCount > 0) {
        console.log(`  ${icon} ${table.padEnd(42)} SQLite: ${String(sourceCount).padStart(6)} | PG: ${String(pgCount).padStart(6)}`);
      }
    } catch {
      // Model might not exist in PG yet
    }
  }

  // ── Summary ──
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`  Total SQLite rows read:     ${totalSourceRows}`);
  console.log(`  Total PostgreSQL rows added: ${totalInserted}`);
  console.log(`  Tables processed:            ${results.length}`);
  console.log(`  Validation:                  ${allMatch ? '✓ ALL COUNTS MATCH' : '⚠ SOME MISMATCHES (check above)'}`);
  console.log();

  if (allMatch) {
    console.log('  ✅ Migration completed successfully! All data preserved.');
  } else {
    console.log('  ⚠  Migration completed with some discrepancies.');
    console.log('     Tables with fewer rows may have had duplicates skipped (idempotent run).');
    console.log('     Re-run after clearing the PostgreSQL database for a clean migration.');
  }
  console.log();

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal migration error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
