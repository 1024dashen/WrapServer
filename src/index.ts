import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initDatabase } from './db';
import { authMiddleware } from './middleware/auth';
import auth from './routes/auth';
import users from './routes/users';
import projects from './routes/projects';
import cardkeys from './routes/cardkeys';
import templates from './routes/templates';
import roles from './routes/roles';
import permissions from './routes/permissions';
import dashboard from './routes/dashboard';

// Initialize database
await initDatabase();

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Public routes - no auth required
app.route('/api/auth', auth);

// Protected routes - auth required
app.use('/api/users', authMiddleware);
app.route('/api/users', users);

app.use('/api/projects', authMiddleware);
app.route('/api/projects', projects);

app.use('/api/cardkeys', authMiddleware);
app.route('/api/cardkeys', cardkeys);

app.use('/api/templates', authMiddleware);
app.route('/api/templates', templates);

app.use('/api/roles', authMiddleware);
app.route('/api/roles', roles);

app.use('/api/permissions', authMiddleware);
app.route('/api/permissions', permissions);

app.use('/api/dashboard', authMiddleware);
app.route('/api/dashboard', dashboard);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const port = 3000;
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
