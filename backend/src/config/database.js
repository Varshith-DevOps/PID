/**
 * @fileoverview Prisma database client configuration.
 * Provides a singleton PrismaClient instance used throughout the application.
 * Includes development logging and graceful shutdown handling.
 * @module config/database
 */

const { PrismaClient } = require('@prisma/client');

/**
 * Singleton Prisma client instance.
 * Logs warnings and errors in all environments.
 * @type {import('@prisma/client').PrismaClient}
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

/**
 * Gracefully disconnect Prisma on process termination.
 * Ensures all pending database operations complete before exit.
 */
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = prisma;