import { Hono } from 'hono';
import { getDb, saveDb } from '../db';

const cardkeys = new Hono();

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  const result: string[] = [];
  
  for (let s = 0; s < segments; s++) {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result.push(segment);
  }
  
  return result.join('-');
}

// Get card keys by project id
cardkeys.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const db = await getDb();
  
  const result = db.exec('SELECT * FROM card_keys WHERE project_id = ? ORDER BY id DESC', [projectId]);

  const cardKeys = result.length > 0 ? result[0].values.map(row => {
    const obj: any = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({ cardKeys });
});

// Get all card keys
cardkeys.get('/', async (c) => {
  const db = await getDb();
  const result = db.exec('SELECT * FROM card_keys ORDER BY id DESC');
  
  const cardKeys = result.length > 0 ? result[0].values.map(row => {
    const obj: any = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({ cardKeys });
});

// Get card key by id
cardkeys.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const result = db.exec('SELECT * FROM card_keys WHERE id = ?', [id]);

  if (result.length === 0 || result[0].values.length === 0) {
    return c.json({ error: '卡密不存在' }, 404);
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const cardKey: any = {};
  columns.forEach((col, i) => { cardKey[col] = values[i]; });

  return c.json({ cardKey });
});

// Create single card key
cardkeys.post('/', async (c) => {
  const body = await c.req.json();
  const { projectId, key, type, status, expireAt, usedBy } = body;

  if (!projectId || !key || !type) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();
  db.run(
    'INSERT INTO card_keys (project_id, key, type, status, expire_at, used_by) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, key, type, status || 'unused', expireAt || null, usedBy || null]
  );
  saveDb();

  const result = db.exec('SELECT last_insert_rowid()');
  const id = result[0].values[0][0];

  return c.json({ message: '创建成功', id });
});

// Batch generate card keys
cardkeys.post('/batch', async (c) => {
  const body = await c.req.json();
  const { projectId, type, count } = body;

  if (!projectId || !type || !count) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();

  for (let i = 0; i < count; i++) {
    const key = generateKey();
    db.run(
      'INSERT INTO card_keys (project_id, key, type, status) VALUES (?, ?, ?, ?)',
      [projectId, key, type, 'unused']
    );
  }
  saveDb();

  return c.json({ message: `成功生成 ${count} 个卡密` });
});

// Update card key
cardkeys.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status, expireAt, usedBy } = body;

  const db = await getDb();

  const cardKey = db.exec('SELECT id FROM card_keys WHERE id = ?', [id]);
  if (cardKey.length === 0 || cardKey[0].values.length === 0) {
    return c.json({ error: '卡密不存在' }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (status) { updates.push('status = ?'); values.push(status); }
  if (expireAt !== undefined) { updates.push('expire_at = ?'); values.push(expireAt); }
  if (usedBy !== undefined) { updates.push('used_by = ?'); values.push(usedBy); }

  if (updates.length > 0) {
    values.push(id);
    db.run(`UPDATE card_keys SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
  }

  return c.json({ message: '更新成功' });
});

// Delete card key
cardkeys.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  
  const cardKey = db.exec('SELECT id FROM card_keys WHERE id = ?', [id]);
  if (cardKey.length === 0 || cardKey[0].values.length === 0) {
    return c.json({ error: '卡密不存在' }, 404);
  }

  db.run('DELETE FROM card_keys WHERE id = ?', [id]);
  saveDb();
  return c.json({ message: '删除成功' });
});

export default cardkeys;
