const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/database');

describe('Health checks', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('liveness returns ok without touching the DB', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('readiness verifies the database is reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
  });

  it('default /health includes the DB check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
  });
});
