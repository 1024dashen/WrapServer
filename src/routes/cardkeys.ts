import { Hono } from 'hono'
import { getDb, saveDb, getShanghaiTime } from '../db'

const cardkeys = new Hono()

function generateKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 18; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function mapRow(columns: string[], values: any[]): any {
    const obj: any = {}
    columns.forEach((col, i) => {
        const key = toCamelCase(col)
        // Convert integer boolean fields back to boolean
        if (col === 'one_device_one_code') {
            obj[key] = !!values[i]
        } else {
            obj[key] = values[i]
        }
    })
    return obj
}

// Get card keys by project id
cardkeys.get('/project/:projectId', async (c) => {
    const projectId = c.req.param('projectId')
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '10')
    const search = (c.req.query('search') || '').trim()
    const status = (c.req.query('status') || '').trim()
    const offset = (page - 1) * pageSize
    const db = await getDb()

    let whereClause = 'WHERE project_id = ?'
    const params: any[] = [projectId]

    if (search) {
        whereClause += ' AND (key LIKE ? OR remark LIKE ? OR device_id LIKE ?)'
        const like = `%${search}%`
        params.push(like, like, like)
    }

    if (status) {
        whereClause += ' AND status = ?'
        params.push(status)
    }

    const countResult = db.exec(
        `SELECT COUNT(*) FROM card_keys ${whereClause}`,
        params,
    )
    const total = countResult[0]?.values[0]?.[0] || 0

    const result = db.exec(
        `SELECT * FROM card_keys ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
    )

    const cardKeys =
        result.length > 0
            ? result[0].values.map((row: any[]) =>
                  mapRow(result[0].columns, row),
              )
            : []

    return c.json({ cardKeys, total })
})

// Get all card keys
cardkeys.get('/', async (c) => {
    const db = await getDb()
    const result = db.exec('SELECT * FROM card_keys ORDER BY id DESC')

    const cardKeys =
        result.length > 0
            ? result[0].values.map((row: any[]) =>
                  mapRow(result[0].columns, row),
              )
            : []

    return c.json({ cardKeys })
})

// Get card key by id
cardkeys.get('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()
    const result = db.exec('SELECT * FROM card_keys WHERE id = ?', [id])

    if (result.length === 0 || result[0].values.length === 0) {
        return c.json({ error: '卡密不存在' }, 404)
    }

    const cardKey = mapRow(result[0].columns, result[0].values[0])

    return c.json({ cardKey })
})

// Create single card key
cardkeys.post('/', async (c) => {
    const body = await c.req.json()
    const {
        projectId,
        key,
        type,
        status,
        duration,
        remark,
        oneDeviceOneCode,
        expireAt,
        usedBy,
    } = body

    if (!projectId || !key || !type) {
        return c.json({ error: '请填写完整信息' }, 400)
    }

    const db = await getDb()
    db.run(
        'INSERT INTO card_keys (project_id, key, type, status, duration, remark, one_device_one_code, expire_at, used_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            projectId,
            key,
            type,
            status || 'unused',
            duration ?? null,
            remark || null,
            oneDeviceOneCode ? 1 : 0,
            expireAt || null,
            usedBy || null,
            getShanghaiTime(),
        ],
    )
    const result = db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0]
    saveDb()

    return c.json({ message: '创建成功', id })
})

// Batch generate card keys
cardkeys.post('/batch', async (c) => {
    const body = await c.req.json()
    const {
        projectId,
        type,
        count,
        status,
        duration,
        remark,
        oneDeviceOneCode,
    } = body

    if (!projectId || !type || !count) {
        return c.json({ error: '请填写完整信息' }, 400)
    }

    const db = await getDb()

    for (let i = 0; i < count; i++) {
        const key = generateKey()
        db.run(
            'INSERT INTO card_keys (project_id, key, type, status, duration, remark, one_device_one_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                projectId,
                key,
                type,
                status || 'unused',
                duration ?? null,
                remark || null,
                oneDeviceOneCode ? 1 : 0,
                getShanghaiTime(),
            ],
        )
    }
    saveDb()

    return c.json({ message: `成功生成 ${count} 个卡密` })
})

// Update card key
cardkeys.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const {
        status,
        duration,
        remark,
        oneDeviceOneCode,
        deviceId,
        expireAt,
        usedBy,
        usedAt,
    } = body

    const db = await getDb()

    const cardKey = db.exec('SELECT id FROM card_keys WHERE id = ?', [id])
    if (cardKey.length === 0 || cardKey[0].values.length === 0) {
        return c.json({ error: '卡密不存在' }, 404)
    }

    const updates: string[] = []
    const values: any[] = []

    if (status) {
        updates.push('status = ?')
        values.push(status)
    }
    if (duration !== undefined) {
        updates.push('duration = ?')
        values.push(duration)
    }
    if (remark !== undefined) {
        updates.push('remark = ?')
        values.push(remark)
    }
    if (oneDeviceOneCode !== undefined) {
        updates.push('one_device_one_code = ?')
        values.push(oneDeviceOneCode ? 1 : 0)
    }
    if (deviceId !== undefined) {
        updates.push('device_id = ?')
        values.push(deviceId)
    }
    if (expireAt !== undefined) {
        updates.push('expire_at = ?')
        values.push(expireAt)
    }
    if (usedBy !== undefined) {
        updates.push('used_by = ?')
        values.push(usedBy)
    }
    if (usedAt !== undefined) {
        updates.push('used_at = ?')
        values.push(usedAt)
    }
    // Auto-set used_at when status changes to 'used'
    if (status === 'used' && usedAt === undefined) {
        updates.push('used_at = ?')
        values.push(getShanghaiTime())
    }

    if (updates.length > 0) {
        values.push(id)
        db.run(
            `UPDATE card_keys SET ${updates.join(', ')} WHERE id = ?`,
            values,
        )
        saveDb()
    }

    return c.json({ message: '更新成功' })
})

// Delete card key
cardkeys.post('/batch-delete', async (c) => {
    const { ids } = await c.req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: '请选择要删除的卡密' }, 400)
    }

    const db = await getDb()
    const placeholders = ids.map(() => '?').join(',')
    db.run(`DELETE FROM card_keys WHERE id IN (${placeholders})`, ids)
    saveDb()
    return c.json({ message: `已删除 ${ids.length} 条卡密` })
})

cardkeys.post('/batch-update-remark', async (c) => {
    const { ids, remark } = await c.req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: '请选择要修改的卡密' }, 400)
    }

    const db = await getDb()
    const placeholders = ids.map(() => '?').join(',')
    db.run(`UPDATE card_keys SET remark = ? WHERE id IN (${placeholders})`, [
        remark ?? '',
        ...ids,
    ])
    saveDb()
    return c.json({ message: `已修改 ${ids.length} 条卡密备注` })
})

cardkeys.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const db = await getDb()

    const cardKey = db.exec('SELECT id FROM card_keys WHERE id = ?', [id])
    if (cardKey.length === 0 || cardKey[0].values.length === 0) {
        return c.json({ error: '卡密不存在' }, 404)
    }

    db.run('DELETE FROM card_keys WHERE id = ?', [id])
    saveDb()
    return c.json({ message: '删除成功' })
})

export default cardkeys
