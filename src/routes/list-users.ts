import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /users — List all users (any authenticated user)
// api-gateway injects X-User-Id after JWT validation; this route requires authentication only
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
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