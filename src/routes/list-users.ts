import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /users — List all users (for assignment dropdown)
// Accessible by authenticated leads only
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userRole = req.headers['x-user-role'] as string | undefined;

  // Only leads can list all users (for task assignment)
  if (userRole !== 'lead') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users ORDER BY full_name ASC'
    );
    res.status(200).json({ users: result.rows });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;