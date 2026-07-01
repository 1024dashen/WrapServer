import { Hono } from 'hono';
import { getDb } from '../db';

const permissions = new Hono();

// Get all permissions
permissions.get('/', async (c) => {
  const db = await getDb();
  const result = db.exec('SELECT * FROM permissions ORDER BY id');
  
  const permissions = result.length > 0 ? result[0].values.map((row: any) => {
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      // Convert snake_case to camelCase
      const camelCol = col.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      obj[camelCol] = row[i];
    });
    return obj;
  }) : [];

  return c.json({ permissions });
});

export default permissions;
