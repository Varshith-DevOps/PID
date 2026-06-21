/**
 * @fileoverview Zod-based request validation middleware.
 * Validates a request section against a schema and returns a clean 400 with
 * field-level details on failure, before the handler runs. Keeps controllers
 * from hand-rolling presence checks and rejects malformed/oversized input early.
 * @module middleware/validate
 */

const { z } = require('zod');

/**
 * Build a middleware that validates `req[section]` against a Zod schema and
 * replaces it with the parsed (coerced, stripped) result.
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [section]
 */
function validate(schema, section = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[section]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || section,
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }
    // Reassign query is read-only on some Express versions; mutate in place there.
    if (section === 'query') {
      Object.keys(req.query).forEach((k) => delete req.query[k]);
      Object.assign(req.query, result.data);
    } else {
      req[section] = result.data;
    }
    next();
  };
}

/** Shared pagination schema: coerces ?page & ?limit, clamps to safe bounds. */
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
}).passthrough();

/**
 * Parse and clamp pagination params from any query object (use inside
 * controllers that don't mount the validate middleware).
 * @param {object} query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query = {}) {
  const parsed = paginationSchema.pick({ page: true, limit: true }).safeParse({
    page: query.page,
    limit: query.limit,
  });
  const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 50 };
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { validate, parsePagination, paginationSchema, z };
