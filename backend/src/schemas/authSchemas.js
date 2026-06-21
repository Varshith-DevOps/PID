/**
 * @fileoverview Zod schemas for auth endpoint request bodies.
 * @module schemas/authSchemas
 */

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').max(254),
  password: z.string().min(1, 'Password is required').max(200),
}).strip();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: z.string().min(12, 'Password must be at least 12 characters').max(200),
}).strip();

const resetPasswordSchema = z.object({
  // Optional explicit password; when omitted the server generates a temp one.
  newPassword: z.string().min(12).max(200).optional(),
}).strip();

module.exports = { loginSchema, changePasswordSchema, resetPasswordSchema };
