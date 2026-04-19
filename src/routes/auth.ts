import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const result = await pool.query(
    'SELECT id, email, password_hash, role FROM users WHERE email = $1',
    [email.trim().toLowerCase()]
  );

  const user = result.rows[0];
  const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !validPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const secret = process.env.JWT_SECRET as string;
  const token = jwt.sign(
    { sub: user.id, role: user.role },
    secret,
    { algorithm: 'HS256', expiresIn: 86400 }
  );

  res.status(200).json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

export default router;
