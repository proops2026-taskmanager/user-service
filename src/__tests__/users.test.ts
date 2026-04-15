import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import pool from '../db';
import app from '../app';

// Run the migration once before all tests, then wipe data between each test.
beforeAll(async () => {
  const migration = readFileSync(
    join(__dirname, '../../db/migrations/001_create_users.sql'),
    'utf8'
  );
  await pool.query(migration);
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------

describe('POST /users', () => {
  const valid = {
    email: 'alice@example.com',
    password: 'password123',
    full_name: 'Alice Nguyen',
  };

  it('201 — valid data returns id, email, full_name, role, created_at — no password_hash', async () => {
    const res = await request(app).post('/users').send(valid);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'alice@example.com',
      full_name: 'Alice Nguyen',
      role: 'member',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();
    expect(res.body.password_hash).toBeUndefined();
  });

  it('409 — duplicate email returns error message', async () => {
    await request(app).post('/users').send(valid);
    const res = await request(app).post('/users').send(valid);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already in use' });
  });

  it('400 — missing email', async () => {
    const res = await request(app)
      .post('/users')
      .send({ password: 'password123', full_name: 'Alice Nguyen' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'email is required' });
  });

  it('400 — missing password', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'alice@example.com', full_name: 'Alice Nguyen' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'password is required' });
  });

  it('400 — missing full_name', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'full_name is required' });
  });

  it('400 — password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/users')
      .send({ ...valid, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'password must be at least 8 characters' });
  });
});

// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  const credentials = { email: 'alice@example.com', password: 'password123' };

  beforeEach(async () => {
    await request(app).post('/users').send({
      ...credentials,
      full_name: 'Alice Nguyen',
    });
  });

  it('200 — correct credentials return token and user, JWT has userId + role, expires in 24h', async () => {
    const res = await request(app).post('/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({ email: credentials.email, role: 'member' });
    expect(res.body.user.id).toBeDefined();

    const payload = jwt.decode(res.body.token) as jwt.JwtPayload;
    expect(payload.userId).toBeDefined();
    expect(payload.role).toBe('member');

    const expiresIn = payload.exp! - payload.iat!;
    expect(expiresIn).toBe(24 * 60 * 60);
  });

  it('401 — wrong password returns Invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: credentials.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('401 — unknown email returns same message as wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('400 — missing email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'email and password are required' });
  });

  it('400 — missing password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: credentials.email });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'email and password are required' });
  });
});
