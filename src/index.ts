import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Public routes
app.route('/api/auth', auth);

// Protected routes
app.use('/api/*', authMiddleware);

app.route('/api/users', users);
app.route('/api/projects', projects);
app.route('/api/cardkeys', cardkeys);
app.route('/api/templates', templates);
app.route('/api/roles', roles);
app.route('/api/permissions', permissions);
app.route('/api/dashboard', dashboard);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
