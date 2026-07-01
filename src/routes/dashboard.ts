import { Hono } from 'hono';
import { getDb } from '../db';

const dashboard = new Hono();

// Get dashboard stats
dashboard.get('/stats', async (c) => {
  const db = await getDb();
  
  const totalUsersResult = db.exec('SELECT COUNT(*) as count FROM users');
  const totalUsers = totalUsersResult[0]?.values[0][0] as number;
  
  const totalProjectsResult = db.exec('SELECT COUNT(*) as count FROM projects');
  const totalProjects = totalProjectsResult[0]?.values[0][0] as number;
  
  const totalCardKeysResult = db.exec('SELECT COUNT(*) as count FROM card_keys');
  const totalCardKeys = totalCardKeysResult[0]?.values[0][0] as number;
  
  const unusedCardKeysResult = db.exec("SELECT COUNT(*) as count FROM card_keys WHERE status = 'unused'");
  const unusedCardKeys = unusedCardKeysResult[0]?.values[0][0] as number;

  const recentProjectsResult = db.exec(`
    SELECT p.*, COUNT(ck.id) as cardKeyCount 
    FROM projects p 
    LEFT JOIN card_keys ck ON p.id = ck.project_id 
    GROUP BY p.id 
    ORDER BY p.created_at DESC 
    LIMIT 5
  `);

  const recentProjects = recentProjectsResult.length > 0 ? recentProjectsResult[0].values.map(row => {
    const obj: any = {};
    recentProjectsResult[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  }) : [];

  return c.json({
    stats: {
      totalUsers,
      totalProjects,
      totalCardKeys,
      unusedCardKeys
    },
    recentProjects
  });
});

export default dashboard;
