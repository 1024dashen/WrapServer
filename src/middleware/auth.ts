import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';

const SECRET = 'wrap-server-secret-key-change-in-production';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未授权，请先登录' }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = await verify(token, SECRET, 'HS256');
    console.log('Token verified successfully:', decoded);
    c.set('user', decoded);
    await next();
  } catch (e) {
    console.error('Token verification failed:', e);
    return c.json({ error: '无效的token' }, 401);
  }
}

export async function generateToken(payload: any): Promise<string> {
  return await sign(payload, SECRET);
}
