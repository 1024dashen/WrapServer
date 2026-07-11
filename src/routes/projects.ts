import { Hono } from 'hono'
import { getDb, saveDb, getShanghaiTime } from '../db'
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, extname } from 'path'

const projects = new Hono()

const PROHTMLS_DIR = join(process.cwd(), 'prohtmls')

function randomString(len: number): string {
    const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < len; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
}

// Upload HTML file for project
projects.post('/upload', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
        return c.json({ error: '请上传 HTML 文件' }, 400)
    }

    if (!file.name.toLowerCase().endsWith('.html')) {
        return c.json({ error: '仅支持上传 .html 文件' }, 400)
    }

    // Ensure prohtmls directory exists
    if (!existsSync(PROHTMLS_DIR)) {
        mkdirSync(PROHTMLS_DIR, { recursive: true })
    }

    const ext = extname(file.name)
    const uniqueName = `${randomString(6)}${ext}`
    const filePath = join(PROHTMLS_DIR, uniqueName)

    const arrayBuffer = await file.arrayBuffer()
    writeFileSync(filePath, Buffer.from(arrayBuffer))

    // Build accessible URL
    const baseUrl = `${c.req.url.replace(/\/api\/projects\/upload.*/, '')}`
    const accessUrl = `${baseUrl}/prohtmls/${uniqueName}`

    return c.json({ url: accessUrl, fileName: uniqueName })
})

// Get all projects with card key count (only for current user)
projects.get('/', async (c) => {
    const jwtUser = (c as any).get('user') as any
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '10')
    const offset = (page - 1) * pageSize
    const db = await getDb()

    const countResult = db.exec(
        `SELECT COUNT(*) FROM projects WHERE user_id = ?`,
        [jwtUser.id],
    )
    const total = countResult[0]?.values[0]?.[0] || 0

    const result = db.exec(
        `
    SELECT p.*, COUNT(ck.id) as cardKeyCount 
    FROM projects p 
    LEFT JOIN card_keys ck ON p.id = ck.project_id 
    WHERE p.user_id = ?
    GROUP BY p.id 
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `,
        [jwtUser.id, pageSize, offset],
    )

    const projects =
        result.length > 0
            ? result[0].values.map((row: any) => {
                  const obj: any = {}
                  result[0].columns.forEach((col: string, i: number) => {
                      obj[col] = row[i]
                  })
                  return obj
              })
            : []

    return c.json({ projects, total })
})

// Get project by id (only if owned by current user)
projects.get('/:id', async (c) => {
    const jwtUser = (c as any).get('user') as any
    const id = c.req.param('id')
    const db = await getDb()
    const result = db.exec(
        `
    SELECT p.*, COUNT(ck.id) as cardKeyCount 
    FROM projects p 
    LEFT JOIN card_keys ck ON p.id = ck.project_id 
    WHERE p.id = ? AND p.user_id = ?
    GROUP BY p.id
  `,
        [id, jwtUser.id],
    )

    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ error: '项目不存在' }, 404)
    }

    const columns = result[0].columns
    const values = result[0].values[0]
    const project: any = {}
    columns.forEach((col, i) => {
        project[col] = values[i]
    })

    return c.json({ project })
})

// Create project
projects.post('/', async (c) => {
    const jwtUser = (c as any).get('user') as any
    const body = await c.req.json()
    const { name, url, status, template_id, type, proxy_url } = body

    if (!name || !url) {
        return c.json({ error: '请填写完整信息' }, 400)
    }

    // 若 URL 不以 http:// 或 https:// 开头，自动补全 http://
    let normalizedUrl = url
    if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'http://' + normalizedUrl
    }

    // For HTML projects, extract filename and will set game URL after insert
    let htmlFile: string | null = null
    const projectType = type || 'url'
    if (projectType === 'html') {
        htmlFile = normalizedUrl.split('/').pop() || null
    }

    const db = await getDb()
    db.run(
        'INSERT INTO projects (user_id, template_id, name, url, type, status, proxy_url, html_file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            jwtUser.id,
            template_id || null,
            name,
            normalizedUrl,
            projectType,
            status || 'active',
            proxy_url || null,
            htmlFile,
            getShanghaiTime(),
        ],
    )
    const result = db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0]

    // For HTML projects, update URL to game route address
    if (projectType === 'html') {
        // Extract base URL from request: http://host/api/projects → http://host
        const reqUrl = new URL(c.req.url)
        const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`
        const gameUrl = `${baseUrl}/game/${id}/`
        db.run('UPDATE projects SET url = ? WHERE id = ?', [gameUrl, id])
    }

    saveDb()

    return c.json({ message: '创建成功', id })
})

// Update project (only if owned by current user)
projects.put('/:id', async (c) => {
    const jwtUser = (c as any).get('user') as any
    const id = c.req.param('id')
    const body = await c.req.json()
    const { name, url, status, template_id, type, proxy_url } = body

    const db = await getDb()

    const project = db.exec(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [id, jwtUser.id],
    )
    if (project.length === 0 || project[0].values.length === 0) {
        return c.json({ error: '项目不存在或无权操作' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (name) {
        updates.push('name = ?')
        values.push(name)
    }
    if (url) {
        // 若 URL 不以 http:// 或 https:// 开头，自动补全 http://
        let normalizedUrl = url
        if (!/^https?:\/\//i.test(normalizedUrl)) {
            normalizedUrl = 'http://' + normalizedUrl
        }
        updates.push('url = ?')
        values.push(normalizedUrl)
    }
    if (status) {
        updates.push('status = ?')
        values.push(status)
    }
    if (template_id !== undefined) {
        updates.push('template_id = ?')
        values.push(template_id)
    }
    if (type) {
        updates.push('type = ?')
        values.push(type)
    }
    if (proxy_url !== undefined) {
        updates.push('proxy_url = ?')
        values.push(proxy_url || null)
    }

    if (updates.length > 0) {
        values.push(id)
        db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values)
        saveDb()
    }

    return c.json({ message: '更新成功' })
})

// Delete project (only if owned by current user)
projects.delete('/:id', async (c) => {
    const jwtUser = (c as any).get('user') as any
    const id = c.req.param('id')
    const db = await getDb()

    const project = db.exec(
        'SELECT id, url, type, html_file FROM projects WHERE id = ? AND user_id = ?',
        [id, jwtUser.id],
    )
    if (project.length === 0 || project[0].values.length === 0) {
        return c.json({ error: '项目不存在或无权操作' }, 404)
    }

    const [, , projType, htmlFile] = project[0].values[0]

    // Delete associated HTML file if this is an html project
    if (projType === 'html' && htmlFile) {
        const filePath = join(PROHTMLS_DIR, htmlFile as string)
        if (existsSync(filePath)) {
            unlinkSync(filePath)
        }
    }

    db.run('DELETE FROM card_keys WHERE project_id = ?', [id])
    db.run('DELETE FROM projects WHERE id = ?', [id])
    saveDb()
    return c.json({ message: '删除成功' })
})

export default projects
