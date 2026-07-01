import { Hono } from 'hono';
import { getDb, saveDb } from '../db';

const templates = new Hono();

// Get all templates
templates.get('/', async (c) => {
  const db = await getDb();
  const result = db.exec('SELECT * FROM templates ORDER BY id DESC');
  
  const templates = result.length > 0 ? result[0].values.map(row => {
    const obj: any = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({ templates });
});

// Get template by id
templates.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const result = db.exec('SELECT * FROM templates WHERE id = ?', [id]);

  if (result.length === 0 || result[0].values.length === 0) {
    return c.json({ error: '模板不存在' }, 404);
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const template: any = {};
  columns.forEach((col, i) => { template[col] = values[i]; });

  return c.json({ template });
});

// Create template
templates.post('/', async (c) => {
  const body = await c.req.json();
  const { name, htmlContent, fileName } = body;

  if (!name || !htmlContent || !fileName) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  const db = await getDb();
  db.run('INSERT INTO templates (name, html_content, file_name) VALUES (?, ?, ?)', [name, htmlContent, fileName]);
  saveDb();

  const result = db.exec('SELECT last_insert_rowid()');
  const id = result[0].values[0][0];

  return c.json({ message: '创建成功', id });
});

// Delete template
templates.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  
  const template = db.exec('SELECT id FROM templates WHERE id = ?', [id]);
  if (template.length === 0 || template[0].values.length === 0) {
    return c.json({ error: '模板不存在' }, 404);
  }

  db.run('DELETE FROM templates WHERE id = ?', [id]);
  saveDb();
  return c.json({ message: '删除成功' });
});

export default templates;
