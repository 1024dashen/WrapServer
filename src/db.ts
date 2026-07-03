import initSqlJs, { Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';

const dbPath = join(process.cwd(), 'data.db');

let db: Database;

export async function getDb(): Promise<Database> {
  if (!db) {
    const SQL = await initSqlJs();
    
    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  }
  return db;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

export async function initDatabase() {
  const database = await getDb();

  // Users table
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '运营人员',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Projects table
  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_id INTEGER,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
    )
  `);

  // CardKeys table
  database.run(`
    CREATE TABLE IF NOT EXISTS card_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unused',
      expire_at TEXT,
      used_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Templates table
  database.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      html_content TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Roles table
  database.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL DEFAULT '[]'
    )
  `);

  // Permissions table
  database.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);

  // Insert default permissions if not exists
  const permCount = database.exec('SELECT COUNT(*) as count FROM permissions');
  const count = permCount[0]?.values[0][0] as number;
  
  if (count === 0) {
    const defaultPermissions = [
      ['仪表盘', 'dashboard', 'menu', null],
      ['数据总览', 'dashboard:overview', 'button', 1],
      ['最近项目', 'dashboard:recent', 'button', 1],
      ['系统信息', 'dashboard:system', 'button', 1],
      ['用户管理', 'user', 'menu', null],
      ['用户新增', 'user:add', 'button', 5],
      ['用户编辑', 'user:edit', 'button', 5],
      ['用户删除', 'user:delete', 'button', 5],
      ['项目管理', 'project', 'menu', null],
      ['项目新增', 'project:add', 'button', 9],
      ['项目编辑', 'project:edit', 'button', 9],
      ['项目删除', 'project:delete', 'button', 9],
      ['卡密管理', 'cardkey', 'menu', null],
      ['卡密新增', 'cardkey:add', 'button', 13],
      ['卡密编辑', 'cardkey:edit', 'button', 13],
      ['卡密删除', 'cardkey:delete', 'button', 13],
      ['模板管理', 'template', 'menu', null],
      ['模板新增', 'template:add', 'button', 17],
      ['模板删除', 'template:delete', 'button', 17],
      ['模板预览', 'template:preview', 'button', 17],
      ['角色管理', 'role', 'menu', null],
      ['角色新增', 'role:add', 'button', 21],
      ['角色编辑', 'role:edit', 'button', 21],
      ['角色删除', 'role:delete', 'button', 21],
      ['权限配置', 'role:config', 'button', 21],
    ];

    for (const perm of defaultPermissions) {
      database.run(
        'INSERT INTO permissions (name, code, type, parent_id) VALUES (?, ?, ?, ?)',
        perm
      );
    }
  }

  // Insert default roles if not exists
  const roleCount = database.exec('SELECT COUNT(*) as count FROM roles');
  const roleCountNum = roleCount[0]?.values[0][0] as number;
  
  if (roleCountNum === 0) {
    const allPerms = database.exec('SELECT code FROM permissions');
    const allPermCodes = JSON.stringify(allPerms[0]?.values.map((v: any) => v[0]) || []);
    
    const adminPerms = JSON.stringify(['dashboard', 'user', 'user:add', 'user:edit', 'user:delete', 'project', 'project:add', 'project:edit', 'project:delete', 'cardkey', 'cardkey:add', 'cardkey:edit', 'cardkey:delete', 'template', 'template:add', 'template:delete']);
    const operatorPerms = JSON.stringify(['dashboard', 'project', 'cardkey', 'cardkey:add', 'cardkey:edit', 'cardkey:delete']);

    database.run('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)', ['超级管理员', '拥有所有权限', allPermCodes]);
    database.run('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)', ['普通管理员', '拥有除角色管理外的所有权限', adminPerms]);
    database.run('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)', ['运营人员', '只能查看和管理卡密', operatorPerms]);
  }

  // Insert default admin user if not exists
  const userCount = database.exec('SELECT COUNT(*) as count FROM users');
  const userCountNum = userCount[0]?.values[0][0] as number;
  
  if (userCountNum === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    database.run(
      'INSERT INTO users (email, username, password, role, status) VALUES (?, ?, ?, ?, ?)',
      ['admin@example.com', '管理员', hashedPassword, '超级管理员', 'active']
    );
  }

  saveDb();
}
