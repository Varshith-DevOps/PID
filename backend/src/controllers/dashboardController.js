/**
 * @fileoverview Executive Dashboard controller.
 * Aggregates key HRMS metrics into a single API response
 * for the entrepreneur's at-a-glance overview.
 * @module controllers/dashboardController
 */

const prisma = require('../config/database');

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date = new Date()) => {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
};

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const displayName = (employee) => `${employee.firstName} ${employee.lastName}`.trim();

const nextBirthdayDate = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null;
  const birthday = new Date(today.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate());
  if (birthday < startOfDay(today)) birthday.setFullYear(today.getFullYear() + 1);
  return birthday;
};

const getUpcomingBirthdays = async (limit = 8) => {
  const today = startOfDay();
  const nextWindow = new Date(today);
  nextWindow.setDate(nextWindow.getDate() + 30);

  const employees = await prisma.employee.findMany({
    where: { isActive: true, dateOfBirth: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      department: { select: { name: true } },
    },
  });

  return employees
    .map((employee) => ({
      id: employee.id,
      name: displayName(employee),
      department: employee.department?.name || 'General',
      date: nextBirthdayDate(employee.dateOfBirth, today),
    }))
    .filter((item) => item.date && item.date <= nextWindow)
    .sort((a, b) => a.date - b.date)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      date: item.date.toISOString(),
      dayLabel: item.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }));
};

const getAvailability = async (employees) => {
  const today = startOfDay();
  const tomorrow = endOfDay();
  const employeeIds = employees.map((employee) => employee.id);

  if (!employeeIds.length) return [];

  const [attendance, leaves] = await Promise.all([
    prisma.attendance.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: today, lt: tomorrow } } }),
    prisma.leave.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: tomorrow },
        endDate: { gte: today },
      },
    }),
  ]);

  const attendanceMap = new Map(attendance.map((item) => [item.employeeId, item]));
  const leaveMap = new Map(leaves.map((item) => [item.employeeId, item]));

  return employees.map((employee) => {
    const att = attendanceMap.get(employee.id);
    const leave = leaveMap.get(employee.id);
    let status = 'NOT_CHECKED_IN';
    if (leave) status = 'ON_LEAVE';
    else if (att?.checkOut) status = 'SIGNED_OUT';
    else if (att?.checkIn) status = att.lateMinutes && att.lateMinutes > 0 ? 'LATE_ONLINE' : 'AVAILABLE';

    return {
      id: employee.id,
      name: displayName(employee),
      role: employee.jobTitle,
      department: employee.department?.name || 'General',
      status,
      checkIn: att?.checkIn || null,
      lateMinutes: att?.lateMinutes || 0,
      leaveType: leave?.leaveType || null,
    };
  });
};

const getPayrollSnapshot = async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [latestRun, currentRun, activeEmployees, salaryStructures, bankDetails, pendingExpenses] = await Promise.all([
    prisma.payrollRun.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, employeeCount: true, totalAmount: true },
    }),
    prisma.payrollRun.findFirst({
      where: { month, year },
      select: { id: true, status: true, employeeCount: true, totalAmount: true },
    }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.salaryStructure.count({ where: { employee: { isActive: true } } }),
    prisma.bankDetails.count({ where: { employee: { isActive: true } } }),
    prisma.expenseClaim.count({ where: { status: { in: ['APPROVED_BY_FINANCE', 'PAID'] } } }),
  ]);

  const run = currentRun || latestRun;
  const totals = run
    ? await prisma.payrollRecord.aggregate({
      where: { payrollRunId: run.id },
      _sum: { grossEarnings: true, netSalary: true },
      _count: true,
    })
    : null;
  const gross = Number(totals?._sum?.grossEarnings || run?.totalAmount || 0);
  const net = Number(totals?._sum?.netSalary || 0);

  return {
    month,
    year,
    status: run?.status || 'NOT_RUN',
    employeeCount: totals?._count || run?.employeeCount || 0,
    gross,
    net,
    salaryReadiness: pct(salaryStructures, activeEmployees),
    bankReadiness: pct(bankDetails, activeEmployees),
    pendingReimbursements: pendingExpenses,
  };
};

const getPersonalizedDashboard = async (req, res) => {
  try {
    const role = req.user?.role || 'EMPLOYEE';
    const employeeId = req.user?.employeeId;
    const today = startOfDay();
    const tomorrow = endOfDay();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      activeEmployees,
      presentToday,
      lateToday,
      onLeaveToday,
      pendingLeaves,
      activeProjects,
      openTasks,
      birthdays,
      payroll,
      employee,
    ] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.attendance.count({ where: { date: { gte: today, lt: tomorrow }, checkIn: { not: null } } }),
      prisma.attendance.count({ where: { date: { gte: today, lt: tomorrow }, lateMinutes: { gt: 0 } } }),
      prisma.leave.count({ where: { status: 'APPROVED', startDate: { lte: tomorrow }, endDate: { gte: today } } }),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.project.count({ where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
      prisma.task.count({ where: { status: { not: 'COMPLETED' } } }),
      getUpcomingBirthdays(10),
      getPayrollSnapshot(),
      employeeId
        ? prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true, manager: true } })
        : null,
    ]);

    let scopedEmployee = employee;
    if (role === 'MANAGER' && !scopedEmployee) {
      scopedEmployee = await prisma.employee.findFirst({
        where: {
          isActive: true,
          OR: [
            { accountStage: 'MANAGER' },
            { subordinates: { some: { isActive: true } } },
          ],
        },
        include: { department: true, manager: true },
      });
    }

    const base = {
      role,
      generatedAt: new Date().toISOString(),
      user: {
        employeeId: scopedEmployee?.id || null,
        name: scopedEmployee ? displayName(scopedEmployee) : req.user?.email || 'User',
        department: scopedEmployee?.department?.name || null,
        title: scopedEmployee?.jobTitle || role,
      },
      organization: {
        activeEmployees,
        presentToday,
        lateToday,
        onLeaveToday,
        attendanceRate: pct(presentToday, activeEmployees),
        pendingLeaves,
        activeProjects,
        openTasks,
        birthdays,
      },
      payroll,
    };

    if (role === 'EMPLOYEE' && scopedEmployee) {
      const employee = scopedEmployee;
      const [attendance, recentAttendance, leaveQuotas, tasks, timesheets, projectResources, peers] = await Promise.all([
        prisma.attendance.findFirst({ where: { employeeId: employee.id, date: { gte: today, lt: tomorrow } } }),
        prisma.attendance.findMany({ where: { employeeId: employee.id }, orderBy: { date: 'desc' }, take: 7 }),
        prisma.leaveQuota.findMany({ where: { employeeId: employee.id, year: today.getFullYear() } }),
        prisma.task.findMany({
          where: { assigneeId: employee.id, status: { not: 'COMPLETED' } },
          include: { project: true },
          orderBy: { deadline: 'asc' },
          take: 8,
        }),
        prisma.timesheet.findMany({ where: { employeeId: employee.id, date: { gte: sevenDaysAgo } }, orderBy: { date: 'asc' } }),
        prisma.projectResource.findMany({ where: { employeeId: employee.id }, include: { project: { include: { tasks: true } } }, take: 6 }),
        prisma.employee.findMany({
          where: { isActive: true, departmentId: employee.departmentId, id: { not: employee.id } },
          include: { department: true },
          take: 8,
        }),
      ]);

      const weeklyHours = timesheets.reduce((sum, item) => sum + item.hoursWorked, 0);
      const leaveBalance = leaveQuotas.reduce((sum, quota) => sum + Math.max(0, quota.quota - quota.used), 0);

      return res.json({
        ...base,
        dashboardType: 'EMPLOYEE',
        focus: {
          attendanceStatus: attendance?.status || 'ABSENT',
          checkIn: attendance?.checkIn || null,
          workHours: attendance?.workHours || 0,
          weeklyHours,
          leaveBalance,
          assignedTasks: tasks.length,
          pendingTasks: tasks.filter((task) => task.status !== 'COMPLETED').length,
        },
        cards: {
          attendanceHistory: recentAttendance,
          leaveQuotas,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            deadline: task.deadline,
            project: task.project?.name || 'Unassigned',
            estimatedHours: task.estimatedHours || 0,
            actualHours: task.actualHours || 0,
          })),
          projects: projectResources.map((resource) => {
            const projectTasks = resource.project?.tasks || [];
            const completed = projectTasks.filter((task) => task.status === 'COMPLETED').length;
            return {
              id: resource.project.id,
              name: resource.project.name,
              status: resource.project.status,
              deadline: resource.project.deadline,
              progress: pct(completed, projectTasks.length),
              openTasks: projectTasks.length - completed,
            };
          }),
          teamAvailability: await getAvailability(peers),
          birthdays,
        },
      });
    }

    if (role === 'MANAGER' && scopedEmployee) {
      const employee = scopedEmployee;
      const team = await prisma.employee.findMany({
        where: { isActive: true, managerId: employee.id },
        include: { department: true },
      });
      const teamIds = team.map((member) => member.id);
      const [teamTasks, teamTimesheets, teamLeaves, pendingOvertime] = await Promise.all([
        prisma.task.findMany({
          where: { assigneeId: { in: teamIds.length ? teamIds : ['__empty__'] }, status: { not: 'COMPLETED' } },
          include: { assignee: true, project: true },
          orderBy: { deadline: 'asc' },
          take: 20,
        }),
        prisma.timesheet.findMany({ where: { employeeId: { in: teamIds.length ? teamIds : ['__empty__'] }, date: { gte: sevenDaysAgo } } }),
        prisma.leave.findMany({
          where: { employeeId: { in: teamIds.length ? teamIds : ['__empty__'] }, status: 'PENDING' },
          include: { employee: true },
          take: 10,
        }),
        prisma.overtime.count({ where: { employeeId: { in: teamIds.length ? teamIds : ['__empty__'] }, status: 'PENDING' } }),
      ]);

      const teamAvailability = await getAvailability(team);
      const workload = team.map((member) => {
        const hours = teamTimesheets.filter((item) => item.employeeId === member.id).reduce((sum, item) => sum + item.hoursWorked, 0);
        const tasks = teamTasks.filter((task) => task.assigneeId === member.id);
        return {
          id: member.id,
          name: displayName(member),
          title: member.jobTitle,
          department: member.department?.name || 'General',
          hours,
          openTasks: tasks.length,
          health: hours >= 32 && tasks.length <= 5 ? 'STRONG' : hours < 20 ? 'UNDER_UTILIZED' : tasks.length > 6 ? 'AT_RISK' : 'STEADY',
        };
      });

      return res.json({
        ...base,
        dashboardType: 'MANAGER',
        focus: {
          teamSize: team.length,
          teamAvailability: pct(teamAvailability.filter((item) => item.status === 'AVAILABLE' || item.status === 'LATE_ONLINE').length, team.length),
          openTeamTasks: teamTasks.length,
          pendingTeamLeaves: teamLeaves.length,
          pendingOvertime,
        },
        cards: {
          teamAvailability,
          workload,
          teamTasks: teamTasks.map((task) => ({
            id: task.id,
            title: task.title,
            assignee: displayName(task.assignee),
            assigneeId: task.assigneeId,
            status: task.status,
            project: task.project?.name || 'Unassigned',
            deadline: task.deadline,
          })),
          pendingLeaves: teamLeaves.map((leave) => ({
            id: leave.id,
            employee: displayName(leave.employee),
            leaveType: leave.leaveType,
            days: leave.days,
            startDate: leave.startDate,
            endDate: leave.endDate,
          })),
          birthdays,
        },
      });
    }

    const [departments, pendingExpenses, recruitment, recentHires, auditLogs] = await Promise.all([
      prisma.department.findMany({ where: { isActive: true }, select: { name: true, _count: { select: { employees: true } } } }),
      prisma.expenseClaim.count({ where: { status: { in: ['PENDING', 'APPROVED_BY_MANAGER'] } } }),
      prisma.jobApplicant.groupBy({ by: ['stage'], _count: true }),
      prisma.employee.findMany({ where: { isActive: true }, include: { department: true }, orderBy: { joinDate: 'desc' }, take: 8 }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

    const executiveType = ['FINANCE', 'ACCOUNTS', 'PAYROLL_REVIEWER', 'PAYROLL_APPROVER'].includes(role)
      ? 'PAYROLL'
      : role === 'HR'
        ? 'HR'
        : 'ADMIN';

    return res.json({
      ...base,
      dashboardType: executiveType,
      focus: {
        attendanceRate: base.organization.attendanceRate,
        pendingLeaves,
        activeProjects,
        openTasks,
        pendingExpenses,
        payrollStatus: payroll.status,
        payrollReadiness: Math.min(payroll.salaryReadiness, payroll.bankReadiness),
      },
      cards: {
        departments: departments.map((department) => ({ name: department.name, employees: department._count.employees })),
        recruitment: recruitment.map((stage) => ({ stage: stage.stage, count: stage._count })),
        recentHires: recentHires.map((hire) => ({
          id: hire.id,
          name: displayName(hire),
          department: hire.department?.name || 'General',
          title: hire.jobTitle,
          joinDate: hire.joinDate,
        })),
        birthdays,
        auditLogs,
      },
    });
  } catch (error) {
    console.error('[PERSONALIZED DASHBOARD ERROR]:', error.message);
    res.status(500).json({ error: 'Failed to load personalized dashboard' });
  }
};

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
        status: { not: 'COMPLETED' },
        deadline: { lt: today },
      },
    });
    const totalTasks = await prisma.task.count();
    const completedTasks = await prisma.task.count({ where: { status: 'COMPLETED' } });

    // ──── 6. Pending Expense Claims ────
    let pendingExpenses = 0;
    let pendingExpenseAmount = 0;
    try {
      const expClaims = await prisma.expenseClaim.findMany({
        where: { status: 'PENDING' },
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

module.exports = { getExecutiveSummary, getPersonalizedDashboard };
