import { Hono } from 'hono'
import { getDb, saveDb } from '../db'
import bcrypt from 'bcryptjs'

const users = new Hono()

// Get all users
users.get('/', async (c) => {
    const db = await getDb()
    const result = db.exec(
        'SELECT id, email, username, role, status, created_at FROM users ORDER BY id',
    )

    const users =
        result.length > 0
            ? result[0].values.map((row) => {
                  const obj: any = {}
                  result[0].columns.forEach((col, i) => {
                      obj[col] = row[i]
                  })
                  return obj
              })
            : []

    return c.json({ users })
})

// Get user by id
users.get('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()
    const result = db.exec(
        'SELECT id, email, username, role, status, created_at FROM users WHERE id = ?',
        [id],
    )

    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ error: '用户不存在' }, 404)
    }

    const columns = result[0].columns
    const values = result[0].values[0]
    const user: any = {}
    columns.forEach((col, i) => {
        user[col] = values[i]
    })

    return c.json({ user })
})

// Create user
users.post('/', async (c) => {
    const body = await c.req.json()
    const { email, username, password, role, status } = body

    if (!email || !username || !password) {
        return c.json({ error: '请填写完整信息' }, 400)
    }

    const db = await getDb()

    const existing = db.exec('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0 && existing[0].values.length > 0) {
        return c.json({ error: '该邮箱已被注册' }, 400)
    }

    const hashedPassword = bcrypt.hashSync(password, 10)

    db.run(
        'INSERT INTO users (email, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [
            email,
            username,
            hashedPassword,
            role || '运营人员',
            status || 'active',
        ],
    )
    saveDb()

    const result = db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0]

    return c.json({ message: '创建成功', id })
})

// Update user
users.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { email, username, role, status } = body

    const db = await getDb()

    const user = db.exec('SELECT id FROM users WHERE id = ?', [id])
    if (user.length === 0 || user[0].values.length === 0) {
        return c.json({ error: '用户不存在' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (email) {
        updates.push('email = ?')
        values.push(email)
    }
    if (username) {
        updates.push('username = ?')
        values.push(username)
    }
    if (role) {
        updates.push('role = ?')
        values.push(role)
    }
    if (status) {
        updates.push('status = ?')
        values.push(status)
    }

    if (updates.length > 0) {
        values.push(id)
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)
        saveDb()
    }

    return c.json({ message: '更新成功' })
})

// Delete user
users.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()

    const user = db.exec('SELECT id, email FROM users WHERE id = ?', [id])
    if (user.length === 0 || user[0].values.length === 0) {
        return c.json({ error: '用户不存在' }, 404)
    }

    // Prevent deletion of protected admin account
    const email = user[0].values[0][1] as string
    if (email === '1024xiaoshen@qq.com') {
        return c.json({ error: '该账号为系统保护账号，不允许删除' }, 403)
    }

    db.run('DELETE FROM users WHERE id = ?', [id])
    saveDb()
    return c.json({ message: '删除成功' })
})

export default users
