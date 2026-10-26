/**
 * db.js — SQLite 資料庫初始化與種子資料
 *
 * 職責：
 *   1. 開啟 SQLite 檔案（單一檔案，便攜）
 *   2. 建立資料表（users、tasks）
 *   3. 若資料表是空的，匯入模擬測試資料
 *
 * 設計重點：
 *   - 使用 better-sqlite3（同步 API，效能好、語法簡潔、展示好講）
 *   - 外鍵 ON DELETE CASCADE：刪使用者時，連同任務一併刪除
 *   - 啟動時自動 seed，展示時打開就有資料可看
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'tasks.db');

// 確保 data/ 存在
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// 啟用 WAL 模式：寫入更穩定、讀寫不互鎖
db.pragma('journal_mode = WAL');
// 啟用外鍵約束
db.pragma('foreign_keys = ON');

/* ────────────────────────── Schema ────────────────────────── */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority    TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high')),
    due_date    TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','done')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user   ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_due    ON tasks(due_date);
`);

/* ────────────────────────── Seed ─────────────────────────── */

/**
 * 是否需要種子資料
 * 規則：users 表是空的時候才 seed，避免重複啟動一直塞資料
 */
function needsSeed() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  return row.n === 0;
}

function seed() {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name)
    VALUES (?, ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (user_id, title, description, priority, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const today = new Date();
  // 注意：用本地日期（與前端一致），不能用 toISOString（UTC）——跨日會差一天
  const dayOffset = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Demo 使用者：帳號 demo / 密碼 demo1234
  const demoHash = bcrypt.hashSync('demo1234', 10);
  const demoInfo = insertUser.run('demo', demoHash, '示範使用者');
  const demoId = demoInfo.lastInsertRowid;

  // 第二個示範帳號：帳號 alice / 密碼 alice1234（用來展示權限隔離）
  const aliceHash = bcrypt.hashSync('alice1234', 10);
  const aliceInfo = insertUser.run('alice', aliceHash, 'Alice');
  const aliceId = aliceInfo.lastInsertRowid;

  const demoTasks = [
    ['補交上週的專案進度報告', '已經超過截止日了\n今天一定要補完\n附上測試數據', 'high', dayOffset(-2), 'pending'],
    ['完成面試 Demo 專案 README', '把啟動方式、架構圖、API 表都寫清楚', 'high', dayOffset(0), 'pending'],
    ['準備自我介紹 3 分鐘版本', '重點放在最近一個專案的技術細節', 'high', dayOffset(1), 'pending'],
    ['複習 React Hooks 常見題目', 'useEffect 依賴陣列、useMemo vs useCallback', 'medium', dayOffset(2), 'pending'],
    ['更新 LinkedIn 履歷', '把最近三個月負責的模組寫進去', 'low', dayOffset(5), 'pending'],
    ['買面試用的襯衫', '深色、合身、不要皺', 'low', dayOffset(-1), 'done'],
    ['練習 System Design：短網址服務', '一小時畫架構圖並口述', 'medium', dayOffset(-3), 'done'],
    ['看一篇 TCP 三次握手文章', '複雜度高一點的面試會問', 'medium', dayOffset(-2), 'done']
  ];

  const tx = db.transaction((rows, uid) => {
    for (const r of rows) insertTask.run(uid, ...r);
  });
  tx(demoTasks, demoId);

  const aliceTasks = [
    ['練習英文自我介紹', 'About me / Why this role / Why this company', 'high', dayOffset(1), 'pending'],
    ['整理作品集 Github', '挑三個最有代表性的 repo 放上 README', 'medium', dayOffset(3), 'pending']
  ];
  tx(aliceTasks, aliceId);

  console.log(`[db] Seed 完成 — 建立 ${demoTasks.length + aliceTasks.length} 筆任務、2 位使用者`);
}

/* ────────────────────────── 啟動點 ───────────────────────── */

if (needsSeed()) {
  seed();
} else {
  console.log('[db] 已有資料，跳過 seed');
}

console.log(`[db] SQLite 已就緒：${DB_PATH}`);

// 允許直接用 `node db.js --init` 強制重置
if (process.argv.includes('--init')) {
  console.log('[db] --init：刪除所有資料並重新 seed');
  db.exec('DELETE FROM tasks; DELETE FROM users;');
  seed();
}

module.exports = db;
