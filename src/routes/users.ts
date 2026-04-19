import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { email, password, full_name, role } = req.body;

  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: 'password is required' });
    return;
  }
  if (!full_name) {
    res.status(400).json({ error: 'full_name is required' });
    return;
  }
  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'email format is invalid' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters' });
    return;
  }

  const allowedRoles = ['member', 'lead'];
  const resolvedRole = role ?? 'member';
  if (!allowedRoles.includes(resolvedRole)) {
    res.status(400).json({ error: 'role must be member or lead' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = full_name.trim();

  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
  const password_hash = await bcrypt.hash(password, rounds);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [normalizedEmail, password_hash, trimmedName, resolvedRole]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
    throw err;
  }
});

export default router;
