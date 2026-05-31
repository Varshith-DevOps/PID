/**
 * @fileoverview Onboarding & Offboarding Checklist controller.
 * Manages reusable templates, template tasks, and instantiated employee checklists.
 * @module controllers/checklistController
 */

const prisma = require('../config/database');

// ==========================================
// 1. Checklist Template Management
// ==========================================

const getTemplates = async (req, res) => {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      include: {
        tasks: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error) {
    console.error('[GET CHECKLIST TEMPLATES ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const createTemplate = async (req, res) => {
  try {
    const { name, type, description, tasks } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Required fields missing (name, type)' });
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        type,
        description: description || null,
        tasks: {
          create: (tasks || []).map((t, idx) => ({
            title: t.title,
            description: t.description || null,
            order: t.order !== undefined ? parseInt(t.order) : idx,
          })),
        },
      },
      include: {
        tasks: true,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('[CREATE CHECKLIST TEMPLATE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.checklistTemplate.delete({ where: { id } });
    res.json({ message: 'Checklist template deleted successfully' });
  } catch (error) {
    console.error('[DELETE CHECKLIST TEMPLATE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, tasks } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Required fields missing (name, type)' });
    }

    const template = await prisma.$transaction(async (tx) => {
      await tx.checklistTemplateTask.deleteMany({
        where: { templateId: id },
      });

      return await tx.checklistTemplate.update({
        where: { id },
        data: {
          name,
          type,
          description: description || null,
          tasks: {
            create: (tasks || []).map((t, idx) => ({
              title: t.title,
              description: t.description || null,
              order: t.order !== undefined ? parseInt(t.order) : idx,
            })),
          },
        },
        include: {
          tasks: true,
        },
      });
    });

    res.json(template);
  } catch (error) {
    console.error('[UPDATE CHECKLIST TEMPLATE ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 2. Employee Task Management & Instantiation
// ==========================================

const getEmployeeChecklistTasks = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const tasks = await prisma.employeeChecklistTask.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(tasks);
  } catch (error) {
    console.error('[GET EMPLOYEE CHECKLIST TASKS ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const instantiateEmployeeChecklist = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required.' });
    }

    // Fetch the template and its tasks
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: true },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Instantiate each task for the employee
    const createdTasks = [];
    for (const t of template.tasks) {
      const task = await prisma.employeeChecklistTask.create({
        data: {
          employeeId,
          type: template.type,
          title: t.title,
          description: t.description || null,
          status: 'PENDING',
        },
      });
      createdTasks.push(task);
    }

    // If the template type is OFFBOARDING, make sure the employee account stage changes or updates if appropriate
    if (template.type === 'OFFBOARDING') {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { accountStage: 'OFFBOARDING' },
      });
    }

    res.status(201).json({
      message: `Successfully instantiated ${createdTasks.length} checklist tasks from "${template.name}".`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error('[INSTANTIATE CHECKLIST ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateEmployeeChecklistTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, remarks, dueDate } = req.body;

    const existing = await prisma.employeeChecklistTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      return res.status(404).json({ error: 'Checklist task not found' });
    }

    const data = {};
    if (status !== undefined) {
      data.status = status;
      if (status === 'COMPLETED') {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
    }
    if (remarks !== undefined) data.remarks = remarks;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await prisma.employeeChecklistTask.update({
      where: { id: taskId },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('[UPDATE EMPLOYEE CHECKLIST TASK ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const createCustomChecklistTask = async (req, res) => {
  try {
    const { employeeId, type, title, description, dueDate } = req.body;

    if (!employeeId || !type || !title) {
      return res.status(400).json({ error: 'Required fields missing (employeeId, type, title)' });
    }

    const task = await prisma.employeeChecklistTask.create({
      data: {
        employeeId,
        type,
        title,
        description: description || null,
        status: 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('[CREATE CUSTOM CHECKLIST TASK ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// 3. Stage Transition Automations
// ==========================================

/**
 * Complete onboarding: validates all ONBOARDING tasks are done,
 * then transitions accountStage from ONBOARDING → EMPLOYEE.
 * This is the Onboarding → Employee Creation automation.
 */
const completeOnboarding = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { force } = req.body; // Allow force-complete even if tasks are pending

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (employee.accountStage !== 'ONBOARDING') {
      return res.status(400).json({ error: 'Employee is not in ONBOARDING stage.' });
    }

    // Check task completion
    const tasks = await prisma.employeeChecklistTask.findMany({
      where: { employeeId, type: 'ONBOARDING' },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const pendingTasks = totalTasks - completedTasks;

    if (pendingTasks > 0 && !force) {
      return res.status(400).json({
        error: `Cannot complete onboarding: ${pendingTasks} of ${totalTasks} checklist tasks are still pending. Complete all tasks or use force-complete.`,
        progress: { total: totalTasks, completed: completedTasks, pending: pendingTasks },
      });
    }

    // Transition to EMPLOYEE stage
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { accountStage: 'EMPLOYEE' },
    });

    console.log(`[AUTOMATION] Onboarding→Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId}) is now fully active. Tasks: ${completedTasks}/${totalTasks}`);

    res.json({
      message: `Onboarding complete! ${employee.firstName} ${employee.lastName} is now an active employee.`,
      employee: updated,
      progress: { total: totalTasks, completed: completedTasks, pending: pendingTasks },
    });
  } catch (error) {
    console.error('[COMPLETE ONBOARDING ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Complete offboarding: validates all OFFBOARDING tasks are done,
 * then transitions accountStage from OFFBOARDING → TERMINATED.
 */
const completeOffboarding = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { force } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (employee.accountStage !== 'OFFBOARDING') {
      return res.status(400).json({ error: 'Employee is not in OFFBOARDING stage.' });
    }

    const tasks = await prisma.employeeChecklistTask.findMany({
      where: { employeeId, type: 'OFFBOARDING' },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const pendingTasks = totalTasks - completedTasks;

    if (pendingTasks > 0 && !force) {
      return res.status(400).json({
        error: `Cannot complete offboarding: ${pendingTasks} of ${totalTasks} clearance tasks are still pending.`,
        progress: { total: totalTasks, completed: completedTasks, pending: pendingTasks },
      });
    }

    // Transition to TERMINATED + deactivate
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { accountStage: 'TERMINATED', isActive: false },
    });

    // Also deactivate the linked user account
    if (employee.userId) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { isActive: false },
      });
    }

    console.log(`[AUTOMATION] Offboarding→Separated: ${employee.firstName} ${employee.lastName} (${employee.employeeId}) has been separated. Tasks: ${completedTasks}/${totalTasks}`);

    res.json({
      message: `Offboarding complete! ${employee.firstName} ${employee.lastName} has been separated.`,
      employee: updated,
      progress: { total: totalTasks, completed: completedTasks, pending: pendingTasks },
    });
  } catch (error) {
    console.error('[COMPLETE OFFBOARDING ERROR]:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  deleteTemplate,
  updateTemplate,
  getEmployeeChecklistTasks,
  instantiateEmployeeChecklist,
  updateEmployeeChecklistTask,
  createCustomChecklistTask,
  completeOnboarding,
  completeOffboarding,
};
