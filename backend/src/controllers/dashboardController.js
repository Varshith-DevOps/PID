/**
 * @fileoverview Executive Dashboard controller.
 * Aggregates key HRMS metrics into a single API response
 * for the entrepreneur's at-a-glance overview.
 * @module controllers/dashboardController
 */

const prisma = require('../config/database');

const getExecutiveSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ──── 1. Workforce Overview ────
    const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
    const employeesByStage = await prisma.employee.groupBy({
      by: ['accountStage'],
      _count: true,
      where: { isActive: true },
    });
    const stageMap = {};
    employeesByStage.forEach(s => { stageMap[s.accountStage] = s._count; });

    const departmentBreakdown = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        name: true,
        _count: { select: { employees: true } },
      },
    });

    // ──── 2. Detailed Today's Attendance ────
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } }
          }
        }
      }
    });

    const presentCount = todayAttendances.filter(a => a.status === 'PRESENT').length;
    const lateCount = todayAttendances.filter(a => a.status === 'LATE' || (a.lateMinutes && a.lateMinutes > 0)).length;
    const halfDayCount = todayAttendances.filter(a => a.status === 'HALF_DAY').length;
    const totalPresent = presentCount + lateCount + halfDayCount;

    // Who is late today
    const lateArrivals = todayAttendances
      .filter(a => a.status === 'LATE' || (a.lateMinutes && a.lateMinutes > 0))
      .map(a => ({
        id: a.id,
        name: `${a.employee.firstName} ${a.employee.lastName}`,
        department: a.employee.department?.name || 'General',
        checkIn: a.checkIn ? new Date(a.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
        lateMinutes: a.lateMinutes || 0
      }));

    // Find absentees (Active employees with stage 'EMPLOYEE' who don't have attendance and aren't on leave)
    const activeEmployees = await prisma.employee.findMany({
      where: { isActive: true, accountStage: 'EMPLOYEE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } }
      }
    });

    const attendedEmployeeIds = new Set(todayAttendances.map(a => a.employeeId));

    // Find approved leaves active today
    const approvedLeavesToday = await prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    });

    const onLeaveEmployeeIds = new Set(approvedLeavesToday.map(l => l.employeeId));

    const absentees = activeEmployees
      .filter(e => !attendedEmployeeIds.has(e.id) && !onLeaveEmployeeIds.has(e.id))
      .map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name || 'General'
      }));

    // Currently on leave today
    const activeLeavesToday = approvedLeavesToday.map(l => ({
      id: l.id,
      name: `${l.employee.firstName} ${l.employee.lastName}`,
      department: l.employee.department?.name || 'General',
      leaveType: l.leaveType,
      days: l.days,
      range: `${new Date(l.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${new Date(l.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
    }));

    // ──── 3. Detailed Leave & Approvals ────
    const pendingLeaves = await prisma.leave.findMany({
      where: { status: 'PENDING' },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      }
    });

    const pendingLeaveDetails = pendingLeaves.map(l => ({
      id: l.id,
      name: `${l.employee.firstName} ${l.employee.lastName}`,
      department: l.employee.department?.name || 'General',
      leaveType: l.leaveType,
      days: l.days,
      reason: l.reason || 'No reason provided',
      range: `${new Date(l.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${new Date(l.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
    }));

    // ──── 4. Recruitment Pipeline ────
    const openJobs = await prisma.jobOpening.count({ where: { status: 'OPEN' } });
    const totalApplicants = await prisma.jobApplicant.count();
    const applicantsByStage = await prisma.jobApplicant.groupBy({
      by: ['stage'],
      _count: true,
    });
    const applicantStageMap = {};
    applicantsByStage.forEach(s => { applicantStageMap[s.stage] = s._count; });

    const upcomingInterviews = await prisma.interview.count({
      where: {
        status: 'SCHEDULED',
        interviewDate: { gte: today },
      },
    });

    // ──── 5. Operations & Tasks ────
    const activeProjects = await prisma.project.count({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
    });
    const overdueTasks = await prisma.task.count({
      where: {
        status: { not: 'DONE' },
        deadline: { lt: today },
      },
    });
    const totalTasks = await prisma.task.count();
    const completedTasks = await prisma.task.count({ where: { status: 'DONE' } });

    // ──── 6. Pending Expense Claims ────
    let pendingExpenses = 0;
    let pendingExpenseAmount = 0;
    try {
      const expClaims = await prisma.expenseClaim.findMany({
        where: { status: 'SUBMITTED' },
        select: { amount: true },
      });
      pendingExpenses = expClaims.length;
      pendingExpenseAmount = expClaims.reduce((s, e) => s + (e.amount || 0), 0);
    } catch (e) { /* expenses may not exist */ }

    // ──── 7. Recent Hires (last 30 days) ────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentHires = await prisma.employee.count({
      where: {
        joinDate: { gte: thirtyDaysAgo },
        isActive: true,
      },
    });

    res.json({
      workforce: {
        total: totalEmployees,
        active: stageMap['EMPLOYEE'] || 0,
        managers: stageMap['MANAGER'] || 0,
        admins: stageMap['ADMIN'] || 0,
        onboarding: stageMap['ONBOARDING'] || 0,
        offboarding: stageMap['OFFBOARDING'] || 0,
        recentHires,
      },
      attendance: {
        presentCount,
        lateCount,
        halfDayCount,
        absentCount: absentees.length,
        attendanceRate: totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0,
        lateArrivals,
        absentees,
      },
      leave: {
        onLeaveTodayCount: activeLeavesToday.length,
        onLeaveToday: activeLeavesToday,
        pendingApprovalsCount: pendingLeaveDetails.length,
        pendingApprovals: pendingLeaveDetails,
      },
      recruitment: {
        openPositions: openJobs,
        totalApplicants,
        pipeline: applicantStageMap,
        upcomingInterviews,
      },
      projects: {
        active: activeProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
        taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      expenses: {
        pendingClaims: pendingExpenses,
        pendingAmount: pendingExpenseAmount,
      },
    });
  } catch (error) {
    console.error('[EXECUTIVE SUMMARY ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getExecutiveSummary };
