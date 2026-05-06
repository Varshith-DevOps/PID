const prisma = require('../config/database');

const getEmployeeUtilization = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const timesheets = await prisma.timesheet.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end },
      },
    });

    const tasks = await prisma.task.findMany({
      where: { assigneeId: employeeId, status: { not: 'COMPLETED' } },
    });

    const totalLoggedHours = timesheets.reduce((sum, t) => sum + t.hoursWorked, 0);
    const workingDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
    const availableHours = workingDays * 8;
    const assignedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const utilizationPercent = availableHours > 0 ? Math.round((totalLoggedHours / availableHours) * 100) : 0;

    res.json({
      period: { start, end },
      metrics: {
        availableHours,
        loggedHours: totalLoggedHours,
        assignedHours,
        utilizationPercent,
        workingDays,
      },
      dailyBreakdown: timesheets.reduce((acc, t) => {
        const date = new Date(t.date).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date] += t.hoursWorked;
        return acc;
      }, {}),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllEmployeesUtilization = async (req, res) => {
  try {
    const { departmentId, startDate, endDate } = req.query;

    const where = { isActive: true };
    if (departmentId) where.departmentId = departmentId;

    const employees = await prisma.employee.findMany({
      where,
      include: { department: true },
    });

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const timesheets = await prisma.timesheet.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const utilization = employees.map((emp) => {
      const empTimesheets = timesheets.filter((t) => t.employeeId === emp.id);
      const loggedHours = empTimesheets.reduce((sum, t) => sum + t.hoursWorked, 0);
      const workingDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
      const availableHours = workingDays * 8;
      const utilization = availableHours > 0 ? Math.round((loggedHours / availableHours) * 100) : 0;

      return {
        employee: { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, department: emp.department?.name },
        loggedHours,
        availableHours,
        utilization,
      };
    });

    const avgUtilization = utilization.length > 0
      ? Math.round(utilization.reduce((sum, u) => sum + u.utilization, 0) / utilization.length)
      : 0;

    res.json({ utilization, avgUtilization, period: { start, end } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalEmployees,
      activeProjects,
      pendingTasks,
      pendingOvertime,
      todayAttendance,
      monthlyAttendance,
    ] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.task.count({ where: { status: { not: 'COMPLETED' } } }),
      prisma.overtime.count({ where: { status: 'PENDING' } }),
      prisma.attendance.count({ where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      prisma.attendance.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const present = monthlyAttendance.find((a) => a.status === 'PRESENT')?._count || 0;
    const absent = monthlyAttendance.find((a) => a.status === 'ABSENT')?._count || 0;
    const late = monthlyAttendance.find((a) => a.status === 'LATE')?._count || 0;

    res.json({
      employees: totalEmployees,
      projects: activeProjects,
      tasks: pendingTasks,
      overtime: pendingOvertime,
      attendance: {
        today: todayAttendance,
        monthly: { present, absent, late, total: present + absent + late },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getManagerDashboard = async (req, res) => {
  try {
    const { managerId } = req.params;

    const [teamEmployees, pendingTasks, pendingOvertime, teamTasks] = await Promise.all([
      prisma.employee.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true } }),
      prisma.task.count({ where: { status: 'TODO' } }),
      prisma.overtime.count({ where: { status: 'PENDING' } }),
      prisma.task.findMany({
        where: { status: { not: 'COMPLETED' } },
        include: { assignee: { select: { firstName: true, lastName: true } }, project: { select: { name: true } } },
        orderBy: { deadline: 'asc' },
        take: 10,
      }),
    ]);

    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const timesheets = await prisma.timesheet.findMany({
      where: { date: { gte: start } },
    });

    const teamWorkload = teamEmployees.map((emp) => {
      const hours = timesheets.filter((t) => t.employeeId === emp.id).reduce((sum, t) => sum + t.hoursWorked, 0);
      return { employee: `${emp.firstName} ${emp.lastName}`, hours };
    });

    res.json({
      pendingTasks,
      pendingOvertime,
      teamWorkload,
      recentTasks: teamTasks,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployeeDashboard = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const [assignedTasks, recentTimesheets, attendance] = await Promise.all([
      prisma.task.findMany({
        where: { assigneeId: employeeId, status: { not: 'COMPLETED' } },
        include: { project: { select: { name: true } } },
        orderBy: { deadline: 'asc' },
      }),
      prisma.timesheet.findMany({
        where: { employeeId },
        orderBy: { date: 'desc' },
        take: 7,
      }),
      prisma.attendance.findFirst({
        where: { employeeId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    const loggedHours = recentTimesheets.reduce((sum, t) => sum + t.hoursWorked, 0);
    const overtime = await prisma.overtime.findMany({
      where: { employeeId, status: 'PENDING' },
    });

    res.json({
      assignedTasks,
      recentTimesheets,
      thisWeekHours: loggedHours,
      todayStatus: attendance?.status || 'ABSENT',
      pendingOvertime: overtime.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getProjectDashboard = async (req, res) => {
  try {
    const { projectId } = req.params;

const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: true,
        expenses: true,
        resources: { include: { employee: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const completedTasks = project.tasks.filter((t) => t.status === 'COMPLETED').length;
    const totalTasks = project.tasks.length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const laborCost = project.tasks.reduce((sum, t) => sum + (t.actualHours || 0) * 500, 0);
    const totalExpense = project.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalCost = laborCost + totalExpense;
    const budgetUsage = project.budget > 0 ? Math.round((totalCost / project.budget) * 100) : 0;

    const daysUntilDeadline = project.deadline
      ? Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      project: { name: project.name, status: project.status, budget: project.budget, deadline: project.deadline },
      metrics: {
        completionPercent,
        totalTasks,
        completedTasks,
        totalCost,
        laborCost,
        totalExpense,
        budgetUsage,
        resources: project.resources.length,
        daysUntilDeadline,
      },
      taskStatus: {
        TODO: project.tasks.filter((t) => t.status === 'TODO').length,
        IN_PROGRESS: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        COMPLETED: project.tasks.filter((t) => t.status === 'COMPLETED').length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getResourceAllocation = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        department: true,
        tasks: { where: { status: { not: 'COMPLETED' } } },
      },
    });

    const occupied = [];
    const bench = [];

    for (const emp of employees) {
      const info = {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        department: emp.department?.name,
        jobTitle: emp.jobTitle,
        activeTasks: emp.tasks.length,
      };
      if (emp.tasks.length > 0) {
        occupied.push(info);
      } else {
        bench.push(info);
      }
    }

    res.json({
      total: employees.length,
      occupiedCount: occupied.length,
      benchCount: bench.length,
      occupied,
      bench,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getEmployeeUtilization,
  getAllEmployeesUtilization,
  getDashboardStats,
  getManagerDashboard,
  getEmployeeDashboard,
  getProjectDashboard,
  getResourceAllocation,
};