const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEMO_COMPANY_CODE = 'LMS-DEMO';
const DEMO_ADMIN_EMAIL = 'admin@hrms.com';
const dueDate = new Date('2026-08-23T00:00:00.000Z');

const employeeDefinitions = [
  { key: 'kiran', firstName: 'Kiran', lastName: 'Employee', email: 'kiran.employee@lms-demo.com', jobTitle: 'Frontend Developer', department: 'Engineering', employeeId: 'LMS-EMP-001', salary: 72000 },
  { key: 'vamshi', firstName: 'Vamshi', lastName: 'Victor', email: 'vamshi.victor@lms-demo.com', jobTitle: 'Backend Developer', department: 'Engineering', employeeId: 'LMS-EMP-002', salary: 76000 },
  { key: 'priya', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@lms-demo.com', jobTitle: 'HR Executive', department: 'HR', employeeId: 'LMS-EMP-003', salary: 62000 },
  { key: 'rahul', firstName: 'Rahul', lastName: 'Kumar', email: 'rahul.kumar@lms-demo.com', jobTitle: 'Sales Executive', department: 'Sales', employeeId: 'LMS-EMP-004', salary: 58000 },
  { key: 'sneha', firstName: 'Sneha', lastName: 'Reddy', email: 'sneha.reddy@lms-demo.com', jobTitle: 'QA Engineer', department: 'QA', employeeId: 'LMS-EMP-005', salary: 68000 },
];

const courseDefinitions = [
  { key: 'frontend', title: 'Frontend Development', code: 'LMS-FE-001', chapters: ['HTML', 'CSS', 'JavaScript', 'React', 'Next.js'] },
  { key: 'backend', title: 'Backend Development', code: 'LMS-BE-001', chapters: ['Node.js', 'Express', 'Prisma', 'REST APIs', 'Authentication'] },
  { key: 'java', title: 'Java Full Stack', code: 'LMS-JAVA-001', chapters: ['Java', 'Spring Boot', 'MySQL', 'REST', 'Deployment'] },
  { key: 'hr', title: 'HR Onboarding', code: 'LMS-HR-001', chapters: ['Company Policy', 'Attendance', 'Leave', 'Payroll', 'Performance'] },
];

const assignmentDefinitions = [
  ['kiran', 'frontend'], ['kiran', 'backend'],
  ['vamshi', 'backend'], ['vamshi', 'java'],
  ['priya', 'hr'], ['sneha', 'frontend'], ['rahul', 'hr'],
];

const progressDefinitions = [
  ['kiran', 'frontend', 100, 360], ['kiran', 'backend', 40, 90],
  ['vamshi', 'backend', 100, 420], ['vamshi', 'java', 20, 45],
  ['priya', 'hr', 100, 300], ['sneha', 'frontend', 75, 240],
  ['rahul', 'hr', 50, 120],
];

const attemptDefinitions = [
  ['kiran', 'frontend', 92, 'PASS', 'CERT-2026-0001'],
  ['priya', 'hr', 88, 'PASS', 'CERT-2026-0002'],
  ['sneha', 'frontend', 61, 'FAIL', null],
];

const questionTemplates = [
  ['Which concept is central to this course?', ['Structure', 'Styling', 'Logic', 'Deployment'], 'A'],
  ['Which practice improves maintainability?', ['Reuse', 'Duplication', 'Guessing', 'Skipping tests'], 'A'],
  ['What should be checked before release?', ['Quality', 'Nothing', 'Only color', 'Only speed'], 'A'],
  ['Which approach supports reliable delivery?', ['Incremental work', 'Manual repetition', 'No review', 'No documentation'], 'A'],
  ['What is a useful engineering habit?', ['Clear naming', 'Hidden assumptions', 'Unused code', 'Untracked changes'], 'A'],
  ['Which activity improves learning?', ['Practice', 'Avoidance', 'Copying blindly', 'Skipping feedback'], 'A'],
  ['What should a good solution include?', ['Validation', 'Guesswork', 'Ambiguity', 'Missing inputs'], 'A'],
  ['Which result indicates successful completion?', ['Verified outcome', 'Unstarted work', 'Broken build', 'Missing result'], 'A'],
  ['What helps teams collaborate?', ['Communication', 'Isolation', 'Silence', 'Unclear ownership'], 'A'],
  ['What should learners review after an exercise?', ['Feedback', 'Nothing', 'Only the title', 'Only the date'], 'A'],
];

const normalize = (value) => String(value || '').trim().toUpperCase();

async function getDemoCompany() {
  const admin = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL }, select: { companyId: true } });
  if (admin?.companyId) return prisma.company.findUnique({ where: { id: admin.companyId } });
  return prisma.company.upsert({
    where: { code: DEMO_COMPANY_CODE },
    update: {},
    create: { name: 'LMS Demo Company', code: DEMO_COMPANY_CODE, industry: 'Technology', status: 'ACTIVE' },
  });
}

async function upsertDepartment(companyId, name) {
  return prisma.department.upsert({
    where: { companyId_name: { companyId, name } },
    update: { isActive: true },
    create: { companyId, name, isActive: true },
  });
}

async function seedEmployees(company) {
  const employees = {};
  for (const definition of employeeDefinitions) {
    const department = await upsertDepartment(company.id, definition.department);
    const employee = await prisma.employee.upsert({
      where: { email: definition.email },
      update: { firstName: definition.firstName, lastName: definition.lastName, jobTitle: definition.jobTitle, departmentId: department.id, companyId: company.id, isActive: true },
      create: {
        companyId: company.id,
        employeeId: definition.employeeId,
        firstName: definition.firstName,
        lastName: definition.lastName,
        email: definition.email,
        jobTitle: definition.jobTitle,
        departmentId: department.id,
        salary: definition.salary,
        employmentType: 'FULL_TIME',
        accountStage: 'EMPLOYEE',
        isActive: true,
      },
    });
    employees[definition.key] = employee;
  }
  console.log('✓ Employees created');
  return employees;
}

async function seedCourses(company) {
  const courses = {};
  for (const definition of courseDefinitions) {
    const course = await prisma.learningCourse.upsert({
      where: { companyId_courseCode: { companyId: company.id, courseCode: definition.code } },
      update: { title: definition.title, status: 'PUBLISHED', isActive: true, certificateAvailable: true, passingScore: 70 },
      create: {
        companyId: company.id,
        title: definition.title,
        courseCode: definition.code,
        description: `${definition.title} demo learning programme.`,
        category: 'PROFESSIONAL DEVELOPMENT',
        difficulty: 'INTERMEDIATE',
        durationMinutes: 300,
        estimatedHours: 5,
        instructor: 'LMS Demo Academy',
        learningObjectives: `Build practical skills in ${definition.title}.`,
        passingScore: 70,
        certificateAvailable: true,
        status: 'PUBLISHED',
        isActive: true,
      },
    });
    courses[definition.key] = course;
    for (let chapterIndex = 0; chapterIndex < definition.chapters.length; chapterIndex += 1) {
      const chapterTitle = definition.chapters[chapterIndex];
      const chapter = await prisma.learningChapter.upsert({
        where: { id: `lms-demo-${definition.key}-chapter-${chapterIndex + 1}` },
        update: { title: chapterTitle, status: 'PUBLISHED', isActive: true, sortOrder: chapterIndex },
        create: { id: `lms-demo-${definition.key}-chapter-${chapterIndex + 1}`, companyId: company.id, courseId: course.id, title: chapterTitle, status: 'PUBLISHED', isActive: true, sortOrder: chapterIndex },
      });
      await prisma.learningLesson.upsert({
        where: { id: `lms-demo-${definition.key}-lesson-${chapterIndex + 1}` },
        update: { title: `${chapterTitle} Fundamentals`, status: 'PUBLISHED', isActive: true, chapterId: chapter.id, courseId: course.id },
        create: { id: `lms-demo-${definition.key}-lesson-${chapterIndex + 1}`, companyId: company.id, courseId: course.id, chapterId: chapter.id, title: `${chapterTitle} Fundamentals`, lessonType: 'RICH_TEXT', richText: `Practical ${chapterTitle} content for the ${definition.title} demo course.`, durationMinutes: 60, status: 'PUBLISHED', isActive: true, isMandatory: true, sortOrder: 0 },
      });
    }
  }
  console.log('✓ Courses created');
  return courses;
}

async function seedPaths(company, courses) {
  const pathDefinitions = [
    { name: 'Engineering Roadmap', code: 'engineering', courseKeys: ['frontend', 'backend', 'java'] },
    { name: 'HR Roadmap', code: 'hr', courseKeys: ['hr'] },
  ];
  for (const definition of pathDefinitions) {
    let path = await prisma.learningPath.findFirst({ where: { companyId: company.id, name: definition.name } });
    path = path || await prisma.learningPath.create({ data: { companyId: company.id, name: definition.name, description: `${definition.name} demo learning path.`, pathType: 'SEQUENTIAL', targetType: 'COMPANY', status: 'ACTIVE', createdBy: 'lms-demo-seeder' } });
    for (let index = 0; index < definition.courseKeys.length; index += 1) {
      await prisma.learningPathCourse.upsert({
        where: { pathId_courseId: { pathId: path.id, courseId: courses[definition.courseKeys[index]].id } },
        update: { sortOrder: index, required: true },
        create: { companyId: company.id, pathId: path.id, courseId: courses[definition.courseKeys[index]].id, sortOrder: index, required: true },
      });
    }
  }
  console.log('✓ Learning paths created');
}

async function seedAssignments(company, employees, courses) {
  const enrollments = {};
  for (const [employeeKey, courseKey] of assignmentDefinitions) {
    const employee = employees[employeeKey];
    const course = courses[courseKey];
    const assignment = await prisma.courseAssignment.findFirst({ where: { companyId: company.id, courseId: course.id, employeeId: employee.id } }) || await prisma.courseAssignment.create({ data: { companyId: company.id, courseId: course.id, employeeId: employee.id, assignmentType: 'EMPLOYEE', dueDate, priority: 'HIGH', notifyEmployees: false, assignedBy: 'lms-demo-seeder' } });
    const enrollment = await prisma.learningEnrollment.upsert({
      where: { courseId_employeeId: { courseId: course.id, employeeId: employee.id } },
      update: { assignmentId: assignment.id, dueDate },
      create: { courseId: course.id, employeeId: employee.id, assignmentId: assignment.id, dueDate, status: 'ASSIGNED' },
    });
    enrollments[`${employeeKey}:${courseKey}`] = enrollment;
  }
  console.log('✓ Assignments created');
  return enrollments;
}

async function seedProgress(employees, courses, enrollments) {
  for (const [employeeKey, courseKey, progress, timeSpentMins] of progressDefinitions) {
    const enrollment = enrollments[`${employeeKey}:${courseKey}`];
    const completed = progress === 100;
    await prisma.learningEnrollment.update({ where: { id: enrollment.id }, data: { progress, timeSpentMins, status: completed ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'ASSIGNED', completedAt: completed ? new Date('2026-07-20T00:00:00.000Z') : null } });
    const lessons = await prisma.learningLesson.findMany({ where: { courseId: courses[courseKey].id, isActive: true }, orderBy: { sortOrder: 'asc' } });
    const completedCount = Math.round((lessons.length * progress) / 100);
    for (let index = 0; index < lessons.length; index += 1) {
      const lessonCompleted = index < completedCount;
      await prisma.learningLessonProgress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lessons[index].id } },
        update: { employeeId: employees[employeeKey].id, status: lessonCompleted ? 'COMPLETED' : 'IN_PROGRESS', progress: lessonCompleted ? 100 : progress, completionPercentage: lessonCompleted ? 100 : progress, timeSpentMins: lessonCompleted ? 60 : Math.round(timeSpentMins / Math.max(lessons.length, 1)) },
        create: { companyId: employees[employeeKey].companyId, enrollmentId: enrollment.id, lessonId: lessons[index].id, employeeId: employees[employeeKey].id, status: lessonCompleted ? 'COMPLETED' : 'IN_PROGRESS', progress: lessonCompleted ? 100 : progress, completionPercentage: lessonCompleted ? 100 : progress, timeSpentMins: lessonCompleted ? 60 : Math.round(timeSpentMins / Math.max(lessons.length, 1)), completedAt: lessonCompleted ? new Date('2026-07-20T00:00:00.000Z') : null },
      });
    }
  }
  console.log('✓ Progress created');
}

async function seedAssessments(company, courses) {
  const assessments = {};
  for (const definition of courseDefinitions) {
    const course = courses[definition.key];
    const questions = questionTemplates.map(([question, options, correctAnswer], index) => ({ id: `q${index + 1}`, question: `${question} (${definition.title})`, questionType: 'MCQ', options, correctAnswer, marks: 10, sortOrder: index }));
    const rubric = { passingScore: 70, timeLimitMins: 30, randomize: false, questions };
    let assessment = await prisma.learningAssessment.findFirst({ where: { companyId: company.id, courseId: course.id, title: `${definition.title} Assessment` } });
    assessment = assessment ? await prisma.learningAssessment.update({ where: { id: assessment.id }, data: { rubricJson: JSON.stringify(rubric), maxMarks: 100, attemptLimit: 3, status: 'ACTIVE' } }) : await prisma.learningAssessment.create({ data: { companyId: company.id, courseId: course.id, title: `${definition.title} Assessment`, assessmentType: 'ASSESSMENT', instructions: 'Complete all questions. You must score at least 70% to pass.', rubricJson: JSON.stringify(rubric), maxMarks: 100, attemptLimit: 3, status: 'ACTIVE', createdBy: 'lms-demo-seeder' } });
    assessments[definition.key] = assessment;
  }
  console.log('✓ Assessments created');
  return assessments;
}

async function seedAttempts(company, employees, courses, assessments, enrollments) {
  for (const [employeeKey, courseKey, score, status, certificateNumber] of attemptDefinitions) {
    const enrollment = enrollments[`${employeeKey}:${courseKey}`];
    const assessment = assessments[courseKey];
    const employee = employees[employeeKey];
    const existing = await prisma.learningAssessmentSubmission.findFirst({ where: { companyId: company.id, assessmentId: assessment.id, enrollmentId: enrollment.id, attemptNumber: 1 } });
    const attempt = existing || await prisma.learningAssessmentSubmission.create({ data: { companyId: company.id, assessmentId: assessment.id, enrollmentId: enrollment.id, employeeId: employee.id, attemptNumber: 1, submissionText: JSON.stringify({ demo: true }), status, marks: score } });
    if (certificateNumber) {
      await prisma.certificate.upsert({
        where: { certificateNumber },
        update: { courseId: courses[courseKey].id, employeeId: employee.id, enrollmentId: enrollment.id, employeeName: `${employee.firstName} ${employee.lastName}`, courseName: courses[courseKey].title, completionDate: new Date('2026-07-20T00:00:00.000Z') },
        create: { certificateNumber, courseId: courses[courseKey].id, employeeId: employee.id, enrollmentId: enrollment.id, employeeName: `${employee.firstName} ${employee.lastName}`, courseName: courses[courseKey].title, completionDate: new Date('2026-07-20T00:00:00.000Z'), issuedAt: new Date('2026-07-20T00:00:00.000Z') },
      });
    }
  }
  console.log('✓ Assessment attempts created');
  console.log('✓ Certificates created');
}

async function seedReports(company, courses, enrollments) {
  const report = { averageCompletion: 69, averageAssessmentScore: 80, certificatesIssued: 2, learningHours: 25.75, completedCourses: 3, passRate: 80, totalCourses: 4, assignedCourses: 7 };
  for (const [entityId, details] of [['summary', report], ['analytics', { ...report, note: 'Derived from LMS demo courses, enrollments, progress, attempts, and certificates.' }]]) {
    const existing = await prisma.learningAuditLog.findFirst({ where: { companyId: company.id, action: 'REPORT_GENERATED', entity: 'LearningReport', entityId } });
    const data = { companyId: company.id, action: 'REPORT_GENERATED', entity: 'LearningReport', entityId, actorEmail: 'lms-demo-seeder', details: JSON.stringify(details) };
    if (existing) await prisma.learningAuditLog.update({ where: { id: existing.id }, data });
    else await prisma.learningAuditLog.create({ data });
  }
  console.log('✓ Reports created');
}

async function main() {
  const company = await getDemoCompany();
  if (!company) throw new Error('No company available. Run the base seed first or provide admin@hrms.com.');
  const employees = await seedEmployees(company);
  const courses = await seedCourses(company);
  await seedPaths(company, courses);
  const enrollments = await seedAssignments(company, employees, courses);
  await seedProgress(employees, courses, enrollments);
  const assessments = await seedAssessments(company, courses);
  await seedAttempts(company, employees, courses, assessments, enrollments);
  await seedReports(company, courses, enrollments);
  console.log('✓ LMS Demo Data Ready');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
