import { Hono } from 'hono';
import { getDb, saveDb } from '../db';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const templates = new Hono();
const templateDir = join(process.cwd(), 'templates');

// Ensure template directory exists
if (!existsSync(templateDir)) {
  mkdirSync(templateDir, { recursive: true });
}

// Get all templates
templates.get('/', async (c) => {
  const db = await getDb();
  const result = db.exec('SELECT * FROM templates ORDER BY id DESC');
  
  const templates = result.length > 0 ? result[0].values.map((row: any) => {
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({ templates });
});

// Preview template (serve HTML file directly)
templates.get('/preview/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const result = db.exec('SELECT file_name FROM templates WHERE id = ?', [id]);

  if (result.length === 0 || result[0].values.length === 0) {
    return c.html('<html><body><h1>模板不存在</h1></body></html>', 404);
  }

  const fileName = result[0].values[0][0] as string;
  const filePath = join(templateDir, fileName);

  if (!existsSync(filePath)) {
    return c.html('<html><body><h1>模板文件不存在</h1></body></html>', 404);
  }

  const { readFileSync } = require('fs');
  const htmlContent = readFileSync(filePath, 'utf-8');
  
  return c.html(htmlContent);
});

// Get template by id (with file content)
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
  columns.forEach((col: string, i: number) => { template[col] = values[i]; });

  // Read HTML file content from filesystem
  const filePath = join(templateDir, template.file_name);
  if (existsSync(filePath)) {
    const { readFileSync } = require('fs');
    template.html_content = readFileSync(filePath, 'utf-8');
  }

  return c.json({ template });
});

// Create template
templates.post('/', async (c) => {
  const body = await c.req.json();
  const { name, htmlContent, fileName } = body;

  if (!name || !htmlContent || !fileName) {
    return c.json({ error: '请填写完整信息' }, 400);
  }

  // Save HTML file to templates directory
  const filePath = join(templateDir, fileName);
  writeFileSync(filePath, htmlContent, 'utf-8');

  const db = await getDb();
  db.run('INSERT INTO templates (name, html_content, file_name) VALUES (?, ?, ?)', [name, fileName, fileName]);
  saveDb();

  const result = db.exec('SELECT last_insert_rowid()');
  const id = result[0].values[0][0];

  return c.json({ message: '创建成功', id });
});

// Delete template
templates.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  
  const template = db.exec('SELECT id, file_name FROM templates WHERE id = ?', [id]);
  if (template.length === 0 || template[0].values.length === 0) {
    return c.json({ error: '模板不存在' }, 404);
  }

  const fileName = template[0].values[0][1] as string;
  const filePath = join(templateDir, fileName);

  // Delete HTML file from filesystem
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  db.run('DELETE FROM templates WHERE id = ?', [id]);
  saveDb();
  return c.json({ message: '删除成功' });
});

export default templates;
