import { Hono } from 'hono'
import { getDb, saveDb } from '../db'

const roles = new Hono()

// Get all roles
roles.get('/', async (c) => {
    const db = await getDb()
    const result = db.exec('SELECT * FROM roles ORDER BY id')

    const roles =
        result.length > 0
            ? result[0].values.map((row) => {
                  const obj: any = {}
                  result[0].columns.forEach((col, i) => {
                      obj[col] = row[i]
                  })
                  obj.permissions = JSON.parse(obj.permissions)
                  return obj
              })
            : []

    return c.json({ roles })
})

// Get role by id
roles.get('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()
    const result = db.exec('SELECT * FROM roles WHERE id = ?', [id])

    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ error: '角色不存在' }, 404)
    }

    const columns = result[0].columns
    const values = result[0].values[0]
    const role: any = {}
    columns.forEach((col, i) => {
        role[col] = values[i]
    })
    role.permissions = JSON.parse(role.permissions)

    return c.json({ role })
})

// Create role
roles.post('/', async (c) => {
    const body = await c.req.json()
    const { name, description, permissions } = body

    if (!name) {
        return c.json({ error: '请填写角色名称' }, 400)
    }

    const db = await getDb()

    const existing = db.exec('SELECT id FROM roles WHERE name = ?', [name])
    if (existing.length > 0 && existing[0].values.length > 0) {
        return c.json({ error: '该角色名称已存在' }, 400)
    }

    db.run(
        'INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)',
        [name, description || '', JSON.stringify(permissions || [])],
    )
    const result = db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0]
    saveDb()

    return c.json({ message: '创建成功', id })
})

// Update role
roles.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { name, description, permissions } = body

    const db = await getDb()

    const role = db.exec('SELECT id FROM roles WHERE id = ?', [id])
    if (role.length === 0 || role[0].values.length === 0) {
        return c.json({ error: '角色不存在' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (name) {
        updates.push('name = ?')
        values.push(name)
    }
    if (description !== undefined) {
        updates.push('description = ?')
        values.push(description)
    }
    if (permissions !== undefined) {
        updates.push('permissions = ?')
        values.push(JSON.stringify(permissions))
    }

    if (updates.length > 0) {
        values.push(id)
        db.run(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values)
        saveDb()
    }

    return c.json({ message: '更新成功' })
})

// Delete role
roles.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()

    const role = db.exec('SELECT id FROM roles WHERE id = ?', [id])
    if (role.length === 0 || role[0].values.length === 0) {
        return c.json({ error: '角色不存在' }, 404)
    }

    db.run('DELETE FROM roles WHERE id = ?', [id])
    saveDb()
    return c.json({ message: '删除成功' })
})

export default roles
