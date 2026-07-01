import { Hono } from 'hono';
import { getDb, saveDb } from '../db';
import bcrypt from 'bcryptjs';
import { generateToken, authMiddleware } from '../middleware/auth';

const auth = new Hono();

// Register
auth.post('/register', async (c) => {
  const body = await c.req.json();
  const { email, username, password } = body;

  if (!email || !username || !password) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();

  // Check if user exists
  const existing = db.exec('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return c.json({ error: '该邮箱已被注册' }, 400);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (email, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
    [email, username, hashedPassword, '运营人员', 'active']
  );
  saveDb();

  const result = db.exec('SELECT last_insert_rowid()');
  const id = result[0].values[0][0];

  return c.json({ message: '注册成功', id });
});

// Login
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();
  const result = db.exec('SELECT * FROM users WHERE email = ?', [email]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return c.json({ error: '登录失败，请检查邮箱和密码' }, 401);
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const user: any = {};
  columns.forEach((col, i) => { user[col] = values[i]; });

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return c.json({ error: '登录失败，请检查邮箱和密码' }, 401);
  }

  if (user.status === 'disabled') {
    return c.json({ error: '账户已被禁用' }, 403);
  }

  const token = await generateToken({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
  });

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.created_at
    }
  });
});

// Get current user (requires auth)
auth.get('/me', authMiddleware, async (c) => {
  const jwtUser = (c as any).get('user') as any;
  const db = await getDb();
  
  const result = db.exec('SELECT id, email, username, role, status, created_at FROM users WHERE id = ?', [jwtUser.id]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return c.json({ error: '用户不存在' }, 404);
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const dbUser: any = {};
  columns.forEach((col, i) => { dbUser[col] = values[i]; });

  // Get role permissions
  const roleResult = db.exec('SELECT permissions FROM roles WHERE name = ?', [dbUser.role]);
  const permissions = roleResult.length > 0 && roleResult[0].values.length > 0 
    ? JSON.parse(roleResult[0].values[0][0] as string) 
    : [];

  return c.json({
    user: {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role,
      status: dbUser.status,
      createdAt: dbUser.created_at
    },
    permissions
  });
});

export default auth;
