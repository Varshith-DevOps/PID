/**
 * @fileoverview Zod schema for employee creation. Validates the core required
 * fields and bounds string lengths to reject malformed/oversized input early,
 * while passing through the many optional profile fields the controller already
 * handles (panNumber, aadharNumber, address, etc.) so behavior is unchanged.
 * @module schemas/employeeSchemas
 */

const { z } = require('zod');

const employeeCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email is required').max(254),
  jobTitle: z.string().min(1, 'Job title is required').max(150),
  departmentId: z.string().min(1, 'Department is required'),
  salary: z.coerce.number({ invalid_type_error: 'Salary must be a number' }).nonnegative('Salary cannot be negative').max(1e9),
}).passthrough();

module.exports = { employeeCreateSchema };
