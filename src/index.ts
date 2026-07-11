import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { initDatabase, getShanghaiTime } from './db'
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

// Template preview - public access (button visibility controlled by frontend permission)
app.get('/api/templates/preview/:id', async (c) => {
    const id = c.req.param('id')
    const { getDb } = await import('./db')
    const { join } = await import('path')
    const { existsSync, readFileSync } = await import('fs')
    const db = await getDb()
    const templateDir = join(process.cwd(), 'templates')

    const result = db.exec('SELECT file_name FROM templates WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
        return c.html('<html><body><h1>模板不存在</h1></body></html>', 404)
    }

    const fileName = result[0].values[0][0] as string
    const filePath = join(templateDir, fileName)

    if (!existsSync(filePath)) {
        return c.html('<html><body><h1>模板文件不存在</h1></body></html>', 404)
    }

    const htmlContent = readFileSync(filePath, 'utf-8')
    return c.html(htmlContent)
})

app.get('/api/templates/preview/:id/:projectId', async (c) => {
    const id = c.req.param('id')
    const projectId = c.req.param('projectId')
    const { getDb } = await import('./db')
    const { join } = await import('path')
    const { existsSync, readFileSync } = await import('fs')
    const db = await getDb()
    const templateDir = join(process.cwd(), 'templates')

    const result = db.exec('SELECT file_name FROM templates WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
        return c.html('<html><body><h1>模板不存在</h1></body></html>', 404)
    }

    const fileName = result[0].values[0][0] as string
    const filePath = join(templateDir, fileName)

    if (!existsSync(filePath)) {
        return c.html('<html><body><h1>模板文件不存在</h1></body></html>', 404)
    }

    let htmlContent = readFileSync(filePath, 'utf-8')
    // Inject project_id into template so it can be accessed via window.__PROJECT_ID__
    const injectScript = `<script>window.__PROJECT_ID__="${projectId}";</script>`
    htmlContent = htmlContent.replace(/<head>/, `<head>${injectScript}`)
    return c.html(htmlContent)
})

app.get('/api/cardkeys/verify/:key', async (c) => {
    const key = c.req.param('key')
    const projectId = c.req.query('project_id')
    const deviceId = c.req.query('device_id')
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

    // Check if card key belongs to the specified project
    if (projectId && String(cardKey.project_id) !== String(projectId)) {
        return c.json({ valid: false, error: '卡密不属于当前项目' }, 400)
    }

    // Check if project is disabled
    if (projectId) {
        const projectResult = db.exec(
            'SELECT status FROM projects WHERE id = ?',
            [projectId],
        )
        if (projectResult.length > 0 && projectResult[0].values.length > 0) {
            const projectStatus = projectResult[0].values[0][0] as string
            if (projectStatus === 'disabled') {
                return c.json({ valid: false, error: '项目已被禁用' }, 400)
            }
        }
    }

    // Check if card key is disabled
    if (cardKey.status === 'disabled') {
        return c.json({ valid: false, error: '卡密已被禁用' }, 400)
    }

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

    // One device one code check
    if (cardKey.one_device_one_code && cardKey.device_id) {
        if (deviceId && cardKey.device_id !== deviceId) {
            return c.json({ valid: false, error: '该卡密已绑定其他设备' }, 400)
        }
    }

    // Mark card key as used and bind device_id if it was unused
    if (cardKey.status === 'unused') {
        const updateParts: string[] = ["status = 'used'", 'used_at = ?']
        const updateValues: any[] = [getShanghaiTime()]

        if (deviceId) {
            updateParts.push('device_id = ?')
            updateValues.push(deviceId)
        }
        // Calculate expire_at from duration if not already set
        if (!cardKey.expire_at && cardKey.duration) {
            const durationSec = Number(cardKey.duration)
            if (durationSec > 0) {
                const expireDate = new Date(Date.now() + durationSec * 1000)
                const expireStr = expireDate.toLocaleString('sv-SE', {
                    timeZone: 'Asia/Shanghai',
                })
                updateParts.push('expire_at = ?')
                updateValues.push(expireStr)
            }
        }

        updateValues.push(cardKey.id)
        db.run(
            `UPDATE card_keys SET ${updateParts.join(', ')} WHERE id = ?`,
            updateValues,
        )
        const { saveDb } = await import('./db')
        saveDb()
    }

    // Get project URL and type
    let projectUrl = null
    let projectType = 'url'
    let htmlContent: string | null = null
    if (projectId) {
        const projectResult = db.exec(
            'SELECT url, type, html_file FROM projects WHERE id = ?',
            [projectId],
        )
        if (projectResult.length > 0 && projectResult[0].values.length > 0) {
            projectUrl = projectResult[0].values[0][0] as string
            projectType = (projectResult[0].values[0][1] as string) || 'url'
            const htmlFile = projectResult[0].values[0][2] as string

            // If HTML project, read file from html_file field
            if (projectType === 'html' && htmlFile) {
                const { join } = await import('path')
                const { existsSync, readFileSync } = await import('fs')
                const filePath = join(process.cwd(), 'prohtmls', htmlFile)
                if (existsSync(filePath)) {
                    htmlContent = readFileSync(filePath, 'utf-8')
                }
            }
        }
    }

    // Re-read expire_at in case it was just computed
    let finalExpireAt = cardKey.expire_at
    if (!finalExpireAt && cardKey.duration) {
        const refreshed = db.exec(
            'SELECT expire_at FROM card_keys WHERE id = ?',
            [cardKey.id],
        )
        if (refreshed.length > 0 && refreshed[0].values.length > 0) {
            finalExpireAt = refreshed[0].values[0][0]
        }
    }

    return c.json({
        valid: true,
        type: cardKey.type,
        expireAt: finalExpireAt,
        status: cardKey.status,
        projectUrl,
        projectType,
        htmlContent,
    })
})

// Lightweight check: is there a valid card key bound to this device + project?
app.get('/api/cardkeys/check', async (c) => {
    const projectId = c.req.query('project_id')
    const deviceId = c.req.query('device_id')
    if (!projectId || !deviceId) {
        return c.json({ valid: false })
    }

    const { getDb } = await import('./db')
    const db = await getDb()

    // Find card key bound to this device for this project
    const result = db.exec(
        'SELECT * FROM card_keys WHERE project_id = ? AND device_id = ? LIMIT 1',
        [projectId, deviceId],
    )
    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ valid: false })
    }

    const columns = result[0].columns
    const values = result[0].values[0]
    const cardKey: any = {}
    columns.forEach((col: string, i: number) => {
        cardKey[col] = values[i]
    })

    // Check project status
    const projResult = db.exec('SELECT status FROM projects WHERE id = ?', [
        projectId,
    ])
    if (projResult.length > 0 && projResult[0].values.length > 0) {
        if ((projResult[0].values[0][0] as string) === 'disabled') {
            return c.json({ valid: false })
        }
    }

    // Card must be used status (unused means unbound)
    if (cardKey.status !== 'used') {
        return c.json({ valid: false })
    }

    // Check expiry
    if (cardKey.expire_at) {
        const expireDate = new Date(cardKey.expire_at)
        if (expireDate < new Date()) {
            return c.json({ valid: false })
        }
    }

    return c.json({ valid: true, expireAt: cardKey.expire_at || null })
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

// Game routes - serve HTML project files and proxy resources
app.get('/game/:projectId', async (c) => {
    return handleGameIndex(c)
})
app.get('/game/:projectId/*', async (c) => {
    return handleGameProxy(c)
})

async function handleGameIndex(c: any) {
    const projectId = c.req.param('projectId')
    const { getDb } = await import('./db')
    const { join } = await import('path')
    const { existsSync, readFileSync } = await import('fs')
    const db = await getDb()

    // Query project info - read html_file for the actual file reference
    const result = db.exec(
        'SELECT type, html_file FROM projects WHERE id = ?',
        [projectId],
    )
    if (result.length === 0 || result[0].values.length === 0) {
        return c.text('项目不存在', 404)
    }

    const [projType, htmlFile] = result[0].values[0] as string[]
    if (projType !== 'html') {
        return c.text('该项目不是 HTML 类型项目', 400)
    }

    if (!htmlFile) {
        return c.text('项目未关联 HTML 文件', 500)
    }

    const filePath = join(process.cwd(), 'prohtmls', htmlFile)
    if (!existsSync(filePath)) {
        return c.text('HTML 文件不存在', 404)
    }

    const htmlContent = readFileSync(filePath, 'utf-8')
    return c.html(htmlContent)
}

async function handleGameProxy(c: any) {
    const projectId = c.req.param('projectId')

    // Extract the sub-path after /game/:projectId/
    const fullPath = c.req.path // e.g. /game/01/js/app.js
    const prefix = `/game/${projectId}/`
    const subPath = fullPath.startsWith(prefix)
        ? fullPath.slice(prefix.length)
        : fullPath.slice(`/game/${projectId}`.length + 1)

    // Empty sub-path means /game/18/ → serve HTML index
    if (!subPath) {
        return handleGameIndex(c)
    }

    return proxyResource(c, projectId, subPath)
}

async function proxyResource(c: any, projectId: string, resourcePath: string) {
    const { getDb } = await import('./db')
    const db = await getDb()

    const result = db.exec('SELECT proxy_url FROM projects WHERE id = ?', [
        projectId,
    ])
    if (result.length === 0 || result[0].values.length === 0) {
        return c.text('项目不存在', 404)
    }

    const proxyUrl = result[0].values[0][0] as string
    if (!proxyUrl) {
        return c.text('该项目未配置代理地址', 400)
    }

    const targetUrl = proxyUrl.replace(/\/$/, '') + '/' + resourcePath
    const queryStr = c.req.query()
    const finalUrl = queryStr ? `${targetUrl}?${queryStr}` : targetUrl

    try {
        const response = await fetch(finalUrl, {
            method: c.req.method,
            headers: {
                'User-Agent': 'WebWrap-Proxy/1.0',
            },
        })

        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase()
            if (
                lowerKey !== 'transfer-encoding' &&
                lowerKey !== 'connection' &&
                lowerKey !== 'content-encoding'
            ) {
                responseHeaders[key] = value
            }
        })

        const contentType =
            response.headers.get('content-type') || 'application/octet-stream'
        const body = await response.arrayBuffer()

        return new Response(body, {
            status: response.status,
            headers: {
                ...responseHeaders,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
            },
        })
    } catch (error: any) {
        console.error(`[GameProxy] Failed to proxy ${finalUrl}:`, error.message)
        return c.text(`代理请求失败: ${error.message}`, 502)
    }
}

// Serve prohtmls static files (uploaded project HTML files)
app.get('/prohtmls/:filename', async (c) => {
    const filename = c.req.param('filename')
    const { join } = await import('path')
    const { existsSync, readFileSync } = await import('fs')
    const filePath = join(process.cwd(), 'prohtmls', filename)

    if (!existsSync(filePath)) {
        return c.text('文件不存在', 404)
    }

    const htmlContent = readFileSync(filePath, 'utf-8')
    return c.html(htmlContent)
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
