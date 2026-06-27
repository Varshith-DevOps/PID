/**
 * @fileoverview Zod schemas for high-value mutating operations (leave, timesheet,
 * expense claims, travel advances). These mirror the presence/type/bounds checks the
 * controllers already perform, but reject malformed/oversized input centrally and
 * before the handler runs. All schemas use `.passthrough()` so the many optional
 * fields the controllers handle are preserved and behaviour is unchanged for valid
 * requests. Numeric fields use `z.coerce` because multipart (multer) form bodies
 * arrive as strings.
 * @module schemas/operationsSchemas
 */

const { z } = require('zod');

const leaveCreateSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
  leaveType: z.string().min(1, 'leaveType is required').max(50),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  reason: z.string().max(2000).optional(),
}).passthrough();

const timesheetCreateSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
  date: z.string().min(1, 'date is required'),
  hoursWorked: z.coerce
    .number({ invalid_type_error: 'hoursWorked must be a number' })
    .gt(0, 'Hours worked must be greater than 0')
    .max(24, 'Hours worked cannot exceed 24'),
  taskId: z.string().min(1).optional(),
  description: z.string().max(2000).optional(),
}).passthrough();

const expenseClaimCreateSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  category: z.string().min(1, 'category is required').max(50),
  amount: z.coerce
    .number({ invalid_type_error: 'amount must be a number' })
    .gt(0, 'Expense amount must be greater than 0')
    .max(1e9),
  description: z.string().max(5000).optional(),
  currency: z.string().max(10).optional(),
}).passthrough();

const travelAdvanceCreateSchema = z.object({
  purpose: z.string().min(1, 'purpose is required').max(500),
  amountRequested: z.coerce
    .number({ invalid_type_error: 'amountRequested must be a number' })
    .gt(0, 'Advance amount must be greater than 0')
    .max(1e9),
}).passthrough();

module.exports = {
  leaveCreateSchema,
  timesheetCreateSchema,
  expenseClaimCreateSchema,
  travelAdvanceCreateSchema,
};
