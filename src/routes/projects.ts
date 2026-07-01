import { Hono } from 'hono';
import { getDb, saveDb } from '../db';

const projects = new Hono();

// Get all projects with card key count
projects.get('/', async (c) => {
  const db = await getDb();
  const result = db.exec(`
    SELECT p.*, COUNT(ck.id) as cardKeyCount 
    FROM projects p 
    LEFT JOIN card_keys ck ON p.id = ck.project_id 
    GROUP BY p.id 
    ORDER BY p.id
  `);

  const projects = result.length > 0 ? result[0].values.map(row => {
    const obj: any = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({ projects });
});

// Get project by id
projects.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const result = db.exec(`
    SELECT p.*, COUNT(ck.id) as cardKeyCount 
    FROM projects p 
    LEFT JOIN card_keys ck ON p.id = ck.project_id 
    WHERE p.id = ?
    GROUP BY p.id
  `, [id]);

  if (result.length === 0 || result[0].values.length === 0) {
    return c.json({ error: '项目不存在' }, 404);
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const project: any = {};
  columns.forEach((col, i) => { project[col] = values[i]; });

  return c.json({ project });
});

// Create project
projects.post('/', async (c) => {
  const body = await c.req.json();
  const { name, url, status } = body;

  if (!name || !url) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();
  db.run('INSERT INTO projects (name, url, status) VALUES (?, ?, ?)', [name, url, status || 'active']);
  saveDb();

  const result = db.exec('SELECT last_insert_rowid()');
  const id = result[0].values[0][0];

  return c.json({ message: '创建成功', id });
});

// Update project
projects.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, url, status } = body;

  const db = await getDb();

  const project = db.exec('SELECT id FROM projects WHERE id = ?', [id]);
  if (project.length === 0 || project[0].values.length === 0) {
    return c.json({ error: '项目不存在' }, 404);
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (url) { updates.push('url = ?'); values.push(url); }
  if (status) { updates.push('status = ?'); values.push(status); }

  if (updates.length > 0) {
    values.push(id);
    db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDb();
  }

  return c.json({ message: '更新成功' });
});

// Delete project
projects.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  
  const project = db.exec('SELECT id FROM projects WHERE id = ?', [id]);
  if (project.length === 0 || project[0].values.length === 0) {
    return c.json({ error: '项目不存在' }, 404);
  }

  db.run('DELETE FROM projects WHERE id = ?', [id]);
  saveDb();
  return c.json({ message: '删除成功' });
});

export default projects;
