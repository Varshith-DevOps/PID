/**
 * @fileoverview Zod schemas for unauthenticated public endpoints (contact, signup).
 * These are the highest-value validation targets because anyone on the internet
 * can hit them.
 * @module schemas/publicSchemas
 */

const { z } = require('zod');

const email = z.string().min(1, 'Email is required').max(254).email('Enter a valid email address');
const optionalPhone = z.string().max(20).regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number').optional().or(z.literal(''));

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required').max(120),
  email,
  phone: optionalPhone,
  companyName: z.string().max(160).optional().or(z.literal('')),
  message: z.string().min(1, 'Message is required').max(5000),
}).strip();

const signupSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').max(160),
  companyCode: z.string().min(2, 'Company code is required').max(60),
  email,
  password: z.string().min(12, 'Password must be at least 12 characters').max(200),
  name: z.string().min(2, 'Admin name is required').max(120),
  phone: optionalPhone,
  companySize: z.string().max(40).optional().or(z.literal('')),
  industry: z.string().max(80).optional().or(z.literal('')),
  planId: z.string().max(80).optional().or(z.literal('')),
  cin: z.string().max(40).optional().or(z.literal('')),
  demoCallDate: z.string().max(40).optional().or(z.literal('')),
}).strip();

module.exports = { contactSchema, signupSchema };
