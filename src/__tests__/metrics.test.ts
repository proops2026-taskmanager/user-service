import request from 'supertest';
import app from '../app';
import pool from '../db';

afterAll(async () => {
  await pool.end();
});

describe('GET /metrics', () => {
  it('exposes Prometheus-format metrics including http_requests_total', async () => {
    // Generate at least one request for the counter to have a non-zero series.
    await request(app).get('/health');

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });
});
