import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { initDatabase } from './db'
import { authMiddleware } from './middleware/auth'
import auth from './routes/auth'
import users from './routes/users'
import projects from './routes/projects'
import cardkeys from './routes/cardkeys'
import templates from './routes/templates'
import roles from './routes/roles'
import permissions from './routes/permissions'
import dashboard from './routes/dashboard'

// Initialize database
await initDatabase()

const app = new Hono()

// CORS middleware
app.use(
    '*',
    cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    }),
)

// Public routes - no auth required
app.route('/api/auth', auth)
app.get('/api/cardkeys/verify/:key', async (c) => {
    const key = c.req.param('key')
    const { getDb } = await import('./db')
    const db = await getDb()

    const result = db.exec('SELECT * FROM card_keys WHERE key = ?', [key])

    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ valid: false, error: '卡密不存在' }, 404)
    }

    const columns = result[0].columns
    const values = result[0].values[0]
    const cardKey: any = {}
    columns.forEach((col: string, i: number) => {
        cardKey[col] = values[i]
    })

    // Check if card key is expired
    if (cardKey.status === 'expired') {
        return c.json({ valid: false, error: '卡密已过期' }, 400)
    }

    // Check if card key has expiration date and if it's past
    if (cardKey.expire_at) {
        const expireDate = new Date(cardKey.expire_at)
        const now = new Date()
        if (expireDate < now) {
            return c.json({ valid: false, error: '卡密已过期' }, 400)
        }
    }

    return c.json({
        valid: true,
        type: cardKey.type,
        expireAt: cardKey.expire_at,
        status: cardKey.status,
    })
})

// Protected routes - auth required
app.use('/api/users', authMiddleware)
app.use('/api/users/*', authMiddleware)
app.route('/api/users', users)

app.use('/api/projects', authMiddleware)
app.use('/api/projects/*', authMiddleware)
app.route('/api/projects', projects)

app.use('/api/cardkeys', authMiddleware)
app.use('/api/cardkeys/*', authMiddleware)
app.route('/api/cardkeys', cardkeys)

app.use('/api/templates', authMiddleware)
app.use('/api/templates/*', authMiddleware)
app.route('/api/templates', templates)

app.use('/api/roles', authMiddleware)
app.use('/api/roles/*', authMiddleware)
app.route('/api/roles', roles)

app.use('/api/permissions', authMiddleware)
app.use('/api/permissions/*', authMiddleware)
app.route('/api/permissions', permissions)

app.use('/api/dashboard', authMiddleware)
app.use('/api/dashboard/*', authMiddleware)
app.route('/api/dashboard', dashboard)

// Health check
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const port = 3000
serve(
    {
        fetch: app.fetch,
        port,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`)
    },
)
