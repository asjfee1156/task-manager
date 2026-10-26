/**
 * server.js — Express 主程式
 *
 * 路由總覽（完整 curl 範例見 README）：
 *   POST  /api/auth/register         註冊
 *   POST  /api/auth/login            登入
 *   GET   /api/auth/me               取得目前登入者（驗 token 用）
 *   GET   /api/tasks                 列表（支援 ?status=&q=&priority=）
 *   POST  /api/tasks                 新增
 *   PUT   /api/tasks/:id             更新（部分欄位）
 *   DELETE /api/tasks/:id            刪除
 *   PATCH /api/tasks/:id/toggle      切換完成狀態（快速勾選）
 *   GET   /api/tasks/stats           統計：總數/已完成/進行中/今日到期/完成率
 *
 * 中介層：
 *   express.json()        解析 JSON body
 *   cors()                允許跨域（本機無所謂，展示時若被問到 CORS 就有得講）
 *   靜態檔               把 frontend/ 當網站根目錄
 *   authRequired          保護 /api/tasks/* 與 /api/auth/me
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const db = require('./db');
const { signToken, authRequired } = require('./auth');
const { PORT, BCRYPT_ROUNDS } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

/* ─────────────────────── Auth ─────────────────────── */

app.post('/api/auth/register', (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '帳號與密碼必填' });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: '帳號至少 3 字、密碼至少 4 字' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: '這個帳號已經被註冊過了' });
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const info = db.prepare(`
    INSERT INTO users (username, password_hash, display_name)
    VALUES (?, ?, ?)
  `).run(username, hash, display_name || username);

  const user = { id: info.lastInsertRowid, username, display_name: display_name || username };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '帳號與密碼必填' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const user = { id: row.id, username: row.username, display_name: row.display_name };
  const token = signToken(user);
  res.json({ token, user });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const row = db.prepare(`
    SELECT id, username, display_name, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);
  if (!row) return res.status(404).json({ error: '使用者不存在' });
  res.json({ user: row });
});

/* ─────────────────────── Tasks ─────────────────────── */

const taskBelongsToUser = (taskId, userId) => {
  const row = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(taskId);
  return row && row.user_id === userId;
};

app.get('/api/tasks', authRequired, (req, res) => {
  const { status, q, priority } = req.query;
  const where = ['user_id = ?'];
  const params = [req.user.id];

  if (status === 'pending' || status === 'done') {
    where.push('status = ?');
    params.push(status);
  }
  if (priority && ['low', 'medium', 'high'].includes(priority)) {
    where.push('priority = ?');
    params.push(priority);
  }
  if (q && q.trim()) {
    where.push('(title LIKE ? OR description LIKE ?)');
    const like = `%${q.trim()}%`;
    params.push(like, like);
  }

  const sql = `
    SELECT id, title, description, priority, due_date, status, created_at, updated_at
    FROM tasks
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE status WHEN 'pending' THEN 0 ELSE 1 END,
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      due_date IS NULL,
      due_date ASC,
      id DESC
  `;
  res.json({ tasks: db.prepare(sql).all(...params) });
});

app.post('/api/tasks', authRequired, (req, res) => {
  const { title, description = '', priority = 'medium', due_date } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '標題必填' });
  }
  if (!['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'priority 必須是 low/medium/high' });
  }
  if (!due_date) {
    return res.status(400).json({ error: '截止日期必填' });
  }
  const info = db.prepare(`
    INSERT INTO tasks (user_id, title, description, priority, due_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, title.trim(), description, priority, due_date);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ task });
});

app.put('/api/tasks/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!taskBelongsToUser(id, req.user.id)) {
    return res.status(404).json({ error: '找不到這筆任務' });
  }

  const { title, description, priority, due_date, status } = req.body || {};
  const fields = [];
  const params = [];

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ error: '標題不可為空' });
    fields.push('title = ?'); params.push(title.trim());
  }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (priority !== undefined) {
    if (!['low','medium','high'].includes(priority)) return res.status(400).json({ error: 'priority 非法' });
    fields.push('priority = ?'); params.push(priority);
  }
  if (due_date !== undefined) {
    if (!due_date) return res.status(400).json({ error: '截止日期必填' });
    fields.push('due_date = ?'); params.push(due_date);
  }
  if (status !== undefined) {
    if (!['pending','done'].includes(status)) return res.status(400).json({ error: 'status 非法' });
    fields.push('status = ?'); params.push(status);
  }
  if (fields.length === 0) return res.status(400).json({ error: '沒有可更新的欄位' });

  fields.push("updated_at = datetime('now','localtime')");
  params.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  res.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) });
});

app.patch('/api/tasks/:id/toggle', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: '找不到這筆任務' });
  }
  const next = row.status === 'done' ? 'pending' : 'done';
  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(next, id);
  res.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) });
});

app.delete('/api/tasks/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!taskBelongsToUser(id, req.user.id)) {
    return res.status(404).json({ error: '找不到這筆任務' });
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/tasks/stats', authRequired, (req, res) => {
  const uid = req.user.id;
  const total = db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?').get(uid).n;
  const done = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND status = 'done'`).get(uid).n;
  const pending = total - done;
  // 本地日期（與前端、種子資料一致）
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const today = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  const todayDue = db.prepare(`
    SELECT COUNT(*) AS n FROM tasks
    WHERE user_id = ? AND status = 'pending' AND due_date = ?
  `).get(uid, today).n;
  const overdue = db.prepare(`
    SELECT COUNT(*) AS n FROM tasks
    WHERE user_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?
  `).get(uid, today).n;
  const completion = total === 0 ? 0 : Math.round((done / total) * 100);
  res.json({ total, done, pending, today_due: todayDue, overdue, completion_rate: completion });
});

/* ─────────────────────── 靜態檔 & Fallback ─────────────────────── */

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// SPA-friendly fallback：任何未命中的 GET 都回 index.html（這樣重新整理不會 404）
app.get(/^\/(?!api).*/, (req, res) => {
  // /app.html 直接送 app.html；其它都送 index.html
  const target = req.path === '/app.html' ? 'app.html' : 'index.html';
  res.sendFile(path.join(FRONTEND_DIR, target));
});

/* ─────────────────────── 啟動 ─────────────────────── */

app.listen(PORT, () => {
  console.log('\n┌──────────────────────────────────────────────┐');
  console.log(`│   Task Demo 已啟動                            │`);
  console.log(`│   → http://localhost:${PORT}                    │`);
  console.log(`│   帳號 demo / 密碼 demo1234                   │`);
  console.log('│   帳號 alice / 密碼 alice1234                  │');
  console.log('└──────────────────────────────────────────────┘\n');
});
