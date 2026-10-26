# Task Manager · 便攜式全端展示專案

> 一個「解壓即用、不裝環境、免連網」的全端任務管理系統。
> 為了展示打造：乾淨、專業、好講、好改。

---

## 目錄

- [1. 專案簡介](#1-專案簡介)
- [2. 為什麼這樣設計](#2-為什麼這樣設計)
- [3. 系統需求](#3-系統需求)
- [4. 快速啟動](#4-快速啟動)
- [5. 專案結構](#5-專案結構)
- [6. 整體架構](#6-整體架構)
- [7. 資料庫設計](#7-資料庫設計)
- [8. 後端 API 一覽](#8-後端-api-一覽)
- [9. 前端流程](#9-前端流程)
- [10. 認證與權限](#10-認證與權限)
- [11. 模擬測試資料](#11-模擬測試資料)
- [12. 展示講解重點](#12-展示講解重點)
- [13. 開發與調整](#13-開發與調整)
- [14. 故障排除](#14-故障排除)

---

## 1. 專案簡介

這是一個**個人任務管理系統**（Task Manager），用來展示全端開發基本功：

| 模組 | 內容 |
| --- | --- |
| 使用者系統 | 註冊、登入、登出、JWT 驗證 |
| 任務 CRUD | 新增、查詢、編輯、刪除、切換完成 |
| 版塊排版 | 已逾期 / 今日到期 / 進行中 / 已完成 4 個獨立版塊，各自按優先級與時間排序 |
| 篩選 / 搜尋 | 狀態下拉（全部 / 已逾期 / 今日到期 / 進行中 / 已完成）、優先級、關鍵字 |
| 卡片放大 | 點一下卡片放大看詳情（點背景 / ✕ / Esc 關閉） |
| 統計 | 總數、已完成、進行中、今日到期、已逾期、完成率 |
| 權限隔離 | 每個使用者只能看到並操作「自己的」任務 |

技術選擇刻意走**主流且易講**的路線：

- **Frontend**：HTML + Tailwind CSS（CDN，無 build）+ Vanilla JS
- **Backend**：Node.js + Express
- **Database**：SQLite（單一 `.db` 檔案，真正便攜）
- **Auth**：JWT（HS256）
- **打包**：內含可攜式 Node.js 24 LTS，**主機不需安裝 Node**

---

## 2. 為什麼這樣設計

| 設計決定 | 原因 |
| --- | --- |
| SQLite 單一檔案 | 沒有額外服務，資料夾拷貝就走；展示時 demo 失敗風險低 |
| JWT 而非 Session | 前端無狀態、好橫向擴展；localStorage 存取、不依賴 Cookie |
| Tailwind（本地打包） | 免 build、免連網；任何人雙擊就能看 UI |
| 內含可攜式 Node | 主機環境完全不被改動；展示場景不會被「要先裝 Node」卡住 |
| better-sqlite3（同步 API） | 程式碼直覺（不用 await callback），效能好，展示時好解釋 |
| Vanilla JS（不引入框架） | 結構單純，展示時直接讀 js 檔就能講資料流 |

---

## 3. 系統需求

- **作業系統**：Windows 10 / 11（64-bit）
- **硬碟空間**：約 150 MB（含 Node runtime 與前端資源）
- **其他**：本機 8591 port 需可用；**運行時完全不需要網路**（Tailwind、Lucide 圖示都已打包在 `frontend/vendor/`，字型用系統字型）

> 不需要安裝：Node.js、Python、資料庫、任何 IDE。

---

## 4. 快速啟動

### 4.1 一鍵啟動

1. 把整個專案資料夾放到任何位置（桌面上、隨身碟都行）
2. 雙擊 **`start.bat`**
3. 視窗會顯示：
   ```
   ============================================================
     Task Manager Demo  v1.0
     Bundled Node.js v24 LTS + Express + SQLite + Vanilla JS
     http://localhost:8591 - fully offline, zero dependencies
   ============================================================

   [INFO] Node: ...\runtime\node\node.exe
   [INFO] Mode: bundled portable runtime - no machine Node needed
   [INFO] Starting server on http://localhost:8591 ...
   [INFO] Test accounts: demo / demo1234 , alice / alice1234
   [INFO] Press Ctrl + C or double-click stop.bat to stop the service.
   ```
4. 約 5 秒後會自動用預設瀏覽器打開 [http://localhost:8591](http://localhost:8591)
5. 登入後即可使用

> **關於視窗行為**：`start.bat` 把 server 放在前景執行，這個 cmd 視窗本身就是伺服器——服務運行期間視窗會一直留著，可以即時看到 `[db]`、請求等輸出；關掉視窗等於停止服務。`stop.bat` / `reset.bat` 則在顯示結果數秒後自動關閉。所有腳本在任何錯誤路徑都會先 `pause` 等你看清訊息，不會一閃即逝。

### 4.2 停止服務

- 在啟動視窗按 **Ctrl + C**（或直接關掉那個視窗）
- 或執行 **`stop.bat`**（強制釋放 port 8591，顯示結果後數秒自動關閉）

### 4.3 啟動流程細節

`start.bat` 會自動依序判斷：

- **Node 來源**：優先用隨附的 `runtime\node\node.exe`（可攜式、免安裝）；若 runtime 資料夾不小心遺失，才退回使用本機已安裝的 Node。
- **套件**：`backend\node_modules` 不存在才執行 `npm install`（自動下載 express、better-sqlite3、jsonwebtoken、bcryptjs、cors）；已存在則略過。原封複製整個資料夾到別台電腦時，通常已含 node_modules，不需要安裝、也不需要網路。
- **Port**：啟動前檢查 8591 是否已被佔用，被佔用時顯示提示並暫停（不會一閃關閉）。

之後每次啟動都是直接跑 server，不會重複安裝。

### 4.4 重置資料庫為預設狀態

雙擊 **`reset.bat`**，它會自動依序執行：

1. 停止運行中的 server（SQLite 正在使用時無法刪除檔案）
2. 刪除 `data\tasks.db` 及相關的 `-wal` / `-shm` 檔
3. 執行 `backend\db.js` 重建 Schema 並匯入預設模擬資料

完成後執行 `start.bat` 即可回到全新狀態。

也可手動操作：刪掉 `data\tasks.db` 後重新啟動（啟動時偵測到 users 表為空就會自動 seed），
或進 `backend\` 執行：

```bat
runtime\node\node.exe db.js --init
```

---

## 5. 專案結構

```
task-manager/
├── start.bat              ← Windows 一鍵啟動
├── stop.bat               ← 強制停止 server
├── reset.bat              ← 重置資料庫為預設狀態
├── README.md              ← 本文件
├── 測試報告.md            ← 模擬操作（登出/登入/註冊/新增任務）的測試紀錄
├── .gitignore
│
├── runtime/               ← 可攜式 Node.js（不需安裝）
│   └── node/
│       ├── node.exe
│       ├── npm.cmd
│       └── ...
│
├── backend/               ← Express + SQLite
│   ├── package.json
│   ├── config.js          ← 集中設定（PORT / JWT_SECRET）
│   ├── db.js              ← SQLite 初始化 + Schema + 種子資料
│   ├── auth.js            ← JWT 簽發 / 驗證中介層
│   ├── server.js          ← Express 主程式 + 所有 API 路由
│   └── node_modules/      ← 首次啟動自動建立
│
├── frontend/              ← 純前端（無 build，資源全部本地打包）
│   ├── index.html         ← 登入 / 註冊頁
│   ├── app.html           ← 主畫面（任務管理）
│   ├── vendor/            ← 離線資源（不連網也能跑）
│   │   ├── tailwind.js    ← Tailwind CSS v3 原始檔
│   │   └── lucide.js      ← Lucide 圖示庫
│   ├── css/
│   │   └── style.css      ← 細部樣式（badge、卡片、捲軸）
│   └── js/
│       ├── api.js         ← fetch wrapper + toast + 401 跳轉 + 時鐘
│       ├── auth.js        ← 登入/註冊頁邏輯
│       └── app.js         ← 主畫面邏輯（4 版塊渲染、篩選、CRUD、modal）
│
└── data/                  ← 已附預先 seed 好的 tasks.db（亦可刪除重置）
    └── tasks.db           ← SQLite 單一檔案（解壓即帶 10 筆示範任務）
```

---

## 6. 整體架構

```
┌────────────────────────────────────────────────────────┐
│                     Browser (前端)                      │
│                                                        │
│   index.html ── 登入/註冊 ──┐                            │
│                            │                            │
│   app.html    ── 任務管理 ─┤  fetch + Authorization: JWT │
│   (SPA 邏輯全在 js/)      │                            │
└────────────────────────────┼────────────────────────────┘
                             │  HTTP
                             ▼
┌────────────────────────────────────────────────────────┐
│                  Express Server (後端)                  │
│                                                        │
│   server.js                                              │
│   ├─ /api/auth/*     註冊 / 登入 / me                   │
│   ├─ /api/tasks/*    CRUD / toggle / stats              │
│   ├─ static files    前端 HTML / CSS / JS              │
│   └─ SPA fallback    非 /api/* 路徑 → index.html        │
│                       │                                │
│   auth.js (中介層) ───┘                                │
│       │ 驗 JWT，掛 req.user                              │
│                                                        │
│   db.js ──→ better-sqlite3 ──→ data/tasks.db            │
└────────────────────────────────────────────────────────┘
```

### 請求生命週期（範例：載入任務）

```
1. 前端 fetch('/api/tasks', { headers: { Authorization: 'Bearer <jwt>' } })
2. Express 進入 authRequired 中介層
     → 拆 Bearer token，jwt.verify() 驗簽章與有效期
     → 成功：把 { id, username } 寫進 req.user
     → 失敗：回 401
3. server.js 的 GET /api/tasks 路由接手
     → 用 req.user.id 組 WHERE user_id = ?
     → 套用 query string 的篩選（status / priority / q）
     → 回傳 JSON
4. 前端拿到 tasks，render 到 DOM
```

---

## 7. 資料庫設計

SQLite 兩個資料表（建在 `data/tasks.db`）。

### 7.1 ER 圖

```
┌────────────────────────┐         ┌──────────────────────────────┐
│  users                 │         │  tasks                        │
├────────────────────────┤         ├──────────────────────────────┤
│ id            INTEGER  │ 1     * │ id            INTEGER PK      │
│ username      TEXT     │─────────│ user_id       INTEGER FK      │
│ password_hash TEXT     │         │ title         TEXT            │
│ display_name  TEXT     │         │ description   TEXT            │
│ created_at    TEXT     │         │ priority      TEXT (low/med/high) │
└────────────────────────┘         │ due_date      TEXT (YYYY-MM-DD)  │
                                   │ status        TEXT (pending/done) │
                                   │ created_at    TEXT            │
                                   │ updated_at    TEXT            │
                                   └──────────────────────────────┘
                                       ON DELETE CASCADE
```

### 7.2 users 資料表

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | INTEGER PK AUTOINCREMENT | 主鍵 |
| `username` | TEXT UNIQUE NOT NULL | 登入帳號，唯一 |
| `password_hash` | TEXT NOT NULL | bcrypt 雜湊（salt rounds = 10） |
| `display_name` | TEXT | 顯示名稱（預設等於 username） |
| `created_at` | TEXT | 本地時間字串 |

### 7.3 tasks 資料表

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | INTEGER PK AUTOINCREMENT | 主鍵 |
| `user_id` | INTEGER NOT NULL, FK → users(id) | 所屬使用者 |
| `title` | TEXT NOT NULL | 標題 |
| `description` | TEXT | 描述 |
| `priority` | TEXT NOT NULL CHECK | `low` / `medium` / `high`，預設 `medium` |
| `due_date` | TEXT | 截止日，格式 `YYYY-MM-DD`，可空 |
| `status` | TEXT NOT NULL CHECK | `pending` / `done`，預設 `pending` |
| `created_at` / `updated_at` | TEXT | 本地時間 |

外鍵設定 `ON DELETE CASCADE`：刪除使用者時，連同任務一併刪除。
已建索引：`idx_tasks_user`、`idx_tasks_status`、`idx_tasks_due`。

### 7.4 為什麼選 SQLite + better-sqlite3

- **單一檔案**：整個 DB 就是 `data/tasks.db`，隨身碟帶著走
- **同步 API**：`db.prepare(...).all(...)` 直接回陣列，比 `await` callback 直覺
- **速度快**：比 `node-sqlite3` 快很多，對單機 demo 已經過剩
- **N-API 預編譯**：v13 之後原生支援跨 Node 版本，免 compile

---

## 8. 後端 API 一覽

Base URL：`http://localhost:8591`

所有 `/api/tasks/*` 與 `/api/auth/me` 都需要 `Authorization: Bearer <jwt>` 標頭。

### 8.1 Auth

#### POST `/api/auth/register`

```http
POST /api/auth/register
Content-Type: application/json

{ "username": "bob", "password": "bob1234", "display_name": "Bob" }
```

成功（201）：

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 3, "username": "bob", "display_name": "Bob" }
}
```

錯誤：

- `400` 帳號或密碼長度不足
- `409` 帳號已被註冊

#### POST `/api/auth/login`

```http
POST /api/auth/login
{ "username": "demo", "password": "demo1234" }
```

成功（200）：與 register 同格式。  
錯誤：`401` 帳號或密碼錯誤。

#### GET `/api/auth/me`

驗證 token 是否還有效，並回傳當前使用者資料。

### 8.2 Tasks

#### GET `/api/tasks`

Query 參數（可疊加）：

| 參數 | 值 | 說明 |
| --- | --- | --- |
| `status` | `pending` / `done` | 不傳 = 全部 |
| `priority` | `low` / `medium` / `high` | 不傳 = 全部優先級 |
| `q` | 字串 | 模糊搜尋 title 與 description |

排序規則：先依 `status`（pending 排前面）、再依 `priority`（高→中→低）、再依 `due_date`（NULL 排後面、愈近愈前）、最後依 id。

```json
{ "tasks": [
  { "id": 1, "user_id": 1, "title": "...", "description": "...",
    "priority": "high", "due_date": "2026-10-19", "status": "pending",
    "created_at": "...", "updated_at": "..." }
]}
```

#### POST `/api/tasks`

```json
{
  "title": "新任務",
  "description": "細節",
  "priority": "high",
  "due_date": "2026-10-25"
}
```

> **注意**：`title` 與 `due_date`（截止日期）都是**必填**；缺 due_date 會回 `400 截止日期必填`。
> `description` 可包含換行（`\n`），前端會以 `whitespace-pre-line` 原樣分行顯示。

成功（201）回傳新增的 task 物件。

#### PUT `/api/tasks/:id`

更新部分欄位（只傳要改的）。欄位：`title`、`description`、`priority`、`due_date`、`status`。

```json
{ "title": "新標題", "status": "done" }
```

#### PATCH `/api/tasks/:id/toggle`

快速切換完成 / 未完成（前端「打勾」用這個比較直覺）。

#### DELETE `/api/tasks/:id`

刪除任務。

#### GET `/api/tasks/stats`

```json
{
  "total": 7,
  "done": 3,
  "pending": 4,
  "today_due": 1,
  "overdue": 0,
  "completion_rate": 43
}
```

### 8.3 權限怎麼守

- 所有 `/api/tasks/*` 都先經 `authRequired` 中介層
- SQL 永遠帶 `WHERE user_id = ?`，用 `req.user.id` 綁死
- 即使前端傳別人的 `taskId`，刪 / 改時也只會回 `404 找不到這筆任務`

### 8.4 用 curl 測

```bash
# 登入拿 token
TOKEN=$(curl -s -X POST http://localhost:8591/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo1234"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# 拿任務列表
curl -s http://localhost:8591/api/tasks -H "Authorization: Bearer ***"

# 新增
curl -s -X POST http://localhost:8591/api/tasks \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"title":"買晚餐","priority":"low"}'

# 統計
curl -s http://localhost:8591/api/tasks/stats -H "Authorization: Bearer ***"
```

---

## 9. 前端流程

### 9.1 檔案分工

| 檔案 | 職責 |
| --- | --- |
| `index.html` | 登入 / 註冊頁 UI（兩個 tab） |
| `app.html` | 主畫面 UI（navbar / 統計 / 篩選 / 卡片網格 / Modal） |
| `css/style.css` | 細修樣式（badge 配色、捲軸、checkbox、modal 動畫） |
| `js/api.js` | 共用 `fetch` wrapper、自動帶 token、`401` 自動跳回登入頁、toast 工具 |
| `js/auth.js` | 登入 / 註冊頁的 tab 切換、表單送出 |
| `js/app.js` | 主畫面全部互動邏輯 |

### 9.2 API wrapper（`js/api.js`）

所有 API 呼叫都透過 `API.xxx()`：

```js
const { tasks } = await API.listTasks({ status: 'pending', priority: 'high', q: '規劃' });
const { task }  = await API.createTask({ title: '...', priority: 'high' });
await API.toggleTask(id);
```

好處：

- **統一帶 token**：`Authorization: Bearer <localStorage.token>`
- **統一處理 401**：token 過期自動清掉並跳回登入頁
- **統一拋錯**：錯誤訊息一律從 `data.error` 拿

### 9.3 主畫面狀態

```js
const state = {
  status: 'all',       // all / overdue / today / active / done → 顯示哪個版塊
  priority: '',        // '' / low / medium / high
  q: '',               // 搜尋字
  tasks: [],           // 從後端拉的最新資料
  editing: null        // null = 新增；{ id, ... } = 編輯
};
```

`loadAll()` 啟動時**並行**抓列表與統計；之後篩選、搜尋、切 tab 都直接用 `state.tasks`
在前端過濾，不再打 API（資料量小，省往返）。

### 9.4 四個狀態版塊（核心排版）

由上到下共 4 個獨立版塊，**每個版塊只放同一種狀態的任務，同一橫行絕不混雜不同狀態**：

| 版塊 | 收納條件 | 標題色 |
| --- | --- | --- |
| 已逾期 | `pending` 且 `due_date < 今天` | 紅 |
| 今日到期 | `pending` 且 `due_date == 今天` | 橘 |
| 進行中 | `pending` 且 `due_date > 今天`（或沒日期） | 靛 |
| 已完成 | `status == 'done'` | 綠 |

每個版塊內的排序規則（`compareTasks`）：

1. **優先級**：高 → 中 → 低
2. **截止時間**：早 → 晚（沒日期的最後）
3. **建立時間**：新 → 舊（id 大的在前）

上方的「狀態」下拉選單（`#filter-status`）控制要顯示哪個版塊：
`全部狀態` → 4 個版塊全顯示；選單一狀態（已逾期 / 今日到期 / 進行中 / 已完成）→ 只顯示該版塊。

### 9.5 渲染流程

```
loadAll()
   ├─ API.listTasks()                  → state.tasks（一次抓全部）
   ├─ API.stats()                      → renderStats()
   └─ renderTasks()
         ├─ 前端過濾（priority + q）
         ├─ bucketize()                → 分到 4 個版塊，各自排序
         ├─ sectionHTML() × N          → 組 section 標題 + 卡片網格
         ├─ bindTaskEvents()           ← 每張卡片的按鈕事件
         └─ renderIcons()              ← lucide 重新掃描 <i data-lucide>
```

為什麼每次 render 完要 `renderIcons()`？  
Lucide 用 `<i data-lucide="check">` 當 placeholder，需要呼叫 `createIcons()` 才會替換成真正的 SVG。

### 9.6 截止日徽章（`formatDue`）

卡片上的截止日 badge **一定顯示日期（DD/MM）**，就近日期再附上相對描述：

| 距今天 | 顯示 | 顏色 |
| --- | --- | --- |
| 過期 N 天 | 「18/10 · 逾期 2 天」 | 紅 |
| 當天 | 「20/10 · 今天到期」 | 橘 |
| 1–3 天後 | 「22/10 · 2 天後」 | 藍 |
| 4 天以上 | 「25/10」 | 灰 |
| 已完成的任務 | 只顯示「17/10」日期，不標逾期 | 灰 |

### 9.7 日期 / 星期 / 時間（時鐘）

`api.js` 的 `startClock(dateSel, timeSel)` 每秒更新，**同一行顯示**：

- 主畫面頂部旗標（header）回應式排位：
  - **PC（寬度 ≥ 640px）**：三欄式 — 左側為標題（logo + 「Task Manager」），中間為日期時間（絕對定位 `absolute left-1/2 -translate-x-1/2` 精確置中），右側為使用者名稱 + 登出鈕。
  - **手機（寬度 < 640px）**：兩行 — 第一行為標題 + 使用者名稱 + 登出（副標題「個人任務管理系統」與使用者圖示在窄屏隱藏、名稱過長時 `truncate` 截斷，確保三元素擠得下），第二行為日期時間置中。
  - **實作陷阱**：置中的時鐘 wrapper 在 PC 需加 `sm:w-auto`，否則 `w-full`（width:100%）會讓絕對定位的 wrapper 形成 1152 × 28 px 的隱形可點擊區塊，從 header 中央一路蓋住右側的登出鈕（真實滑鼠點擊會被攔截，程式化 `.click()` 卻正常——曾因此在桌面版點登出無反應）。
- 登入頁頁尾：單行合併顯示

星期用中文（`'日一二三四五六'[getDay()]`），時間 24 小時制。

### 9.8 任務放大檢視

點一下任務卡片 → 開啟 `#card-large` overlay 放大顯示完整資訊（狀態、優先級、截止日、
完整描述含換行、建立 / 更新時間），並提供「標為完成 / 編輯 / 刪除」三個操作。

關閉方式（事件代理綁在 `#card-overlay`，重 render 後依然有效）：

- 點背景半透明遮罩（`data-card-close`）
- 點右上角 ✕ 鈕（`data-card-close`）
- 鍵盤 **Esc**（與編輯 modal 共用同一個 keydown 處理）

卡片上的勾選 / 編輯 / 刪除按鈕有 `stopPropagation`，點它們不會誤觸放大。

### 9.9 Modal

新增與編輯共用同一個 `<form>`：

- 按右上「＋ 新增任務」→ `state.editing = null`
- 點卡片「編輯」→ `state.editing = <task>` 並把欄位填好
- 提交時依 `state.editing` 決定走 `POST` 或 `PUT`

---

## 10. 認證與權限

### 10.1 流程

```
[登入]                 [之後每次 API]
瀏覽器 ──POST /login──►  後端驗 bcrypt → 簽 JWT
瀏覽器 ◄──{ token, user }──┘
存 localStorage           瀏覽器 ──GET /api/tasks──►  authRequired
                         Authorization: Bearer <token>
                         後端 jwt.verify → req.user
```

### 10.2 JWT 內容

```json
{ "id": 1, "username": "demo", "iat": ..., "exp": ... }
```

- 演算法：HS256
- 有效期：7 天（`auth.js` 的 `EXPIRES_IN`）
- Secret：`backend/config.js` 的 `JWT_SECRET`（demo 用，正式專案應放環境變數）

### 10.3 密碼

用 `bcryptjs` 雜湊（salt rounds = 10）。DB 只存雜湊，不存明碼。

### 10.4 權限隔離（重點）

```js
// server.js 的關鍵一行（GET /api/tasks）
db.prepare('SELECT * FROM tasks WHERE user_id = ? ...').all(req.user.id);
```

- 每個查詢都用 `req.user.id` 過濾，沒有「看全部任務」的端點
- 用戶 A 拿用戶 B 的 task id 來刪，後端只回 `404 找不到這筆任務`（避免透露存在性）

---

## 11. 模擬測試資料

啟動時若 users 表是空的，會自動 seed：

### 11.1 帳號

| 帳號 | 密碼 | 暱稱 |
| --- | --- | --- |
| `demo` | `demo1234` | 示範使用者 |
| `alice` | `alice1234` | Alice |

### 11.2 任務

`demo` 有 **8 筆**任務（三種優先級都覆蓋：1 筆已逾期、1 筆今天到期、3 筆進行中、3 筆已完成；
其中逾期那筆的描述刻意含換行，用來展示多行描述），`alice` 有 **2 筆**（用來展示權限隔離），共 10 筆。

---

## 12. 展示講解重點

### 12.1 三分鐘導覽可以這樣帶

1. **Demo 啟動**（30 秒）：雙擊 start.bat → 開瀏覽器 → 登入
2. **架構**（30 秒）：畫上面那張架構圖，講前後端分離、JWT、SQLite 單檔
3. **走一輪 CRUD**（60 秒）：新增 → 標完成 → 篩選 → 刪除
4. **講權限**（30 秒）：登出、改登 alice，示範看不到 demo 的任務
5. **講資安細節**（30 秒）：bcrypt、JWT 過期、SQL 永遠綁 user_id

### 12.2 常見 Q&A 速查

**Q：為什麼不用 MySQL / Postgres？**  
A：這是 demo，重點在展示全端流程而不是 DBA 功力；SQLite 單檔、零設定，
   展示場景最穩。production 換掉 driver 即可。

**Q：為什麼 JWT 不用 refresh token？**  
A：demo 規模不需要；真要做可以加 `/api/auth/refresh` + 短 access + 長 refresh。

**Q：為什麼前端 Vanilla JS 不用 React？**  
A：兩個原因 — (1) 結構單純，展示時直接讀 js 就講得完；
   (2) 沒 build 流程，雙擊就能看，不用先解釋 webpack/vite。

**Q：bcrypt rounds 為什麼 10？**  
A：常用平衡點。調高更安全但慢，調低反之；可改 `backend/config.js` 的 `BCRYPT_ROUNDS`。

**Q：怎麼做 rate limit？**  
A：可加 `express-rate-limit` middleware 在 `/api/auth/*` 限制每分鐘 10 次。
   沒做是因為 demo 不對外，但被問到時可以馬上講方向。

**Q：怎麼做測試？**  
A：後端可加 `node:test` + `supertest`，把每個 API 寫一條 happy path + 一條 401。
   前端若日後改框架，再加 vitest / playwright。

**Q：CSS 怎麼不用 SCSS / CSS-in-JS？**  
A：Tailwind utility + 一支 style.css 收尾，規模這麼小不需要預處理器。
   真的要拆可以用 `@apply` 把 badge 樣式收成 component class。

### 12.3 可以現場改的小作業

有興趣的話，可以現場動手展示：

- 把「完成率」顏色依區間變色（≥80% 綠、≥50% 橘、<50% 紅）
- 加「排序」下拉（依建立時間 / 截止日 / 優先級）
- 加「批次刪除已完成」
- 把任務加上 tag / 標籤

---

## 13. 開發與調整

### 13.1 想用自己電腦的 Node 開發

可以，不影響 demo。直接：

```bash
cd backend
npm install
node server.js
```

`start.bat` 只是把 `runtime/node` 放到 PATH 最前面；本機有裝 Node 也可以用本機的。

### 13.2 改 Port

編輯 `backend/config.js`：

```js
module.exports = { PORT: 8080, ... };
```

### 13.3 改 JWT 有效期

編輯 `backend/auth.js`：

```js
const EXPIRES_IN = '1h';   // 改成你要的
```

### 13.4 加新 API 欄位

1. `backend/db.js` 加 `ALTER TABLE tasks ADD COLUMN ...`（或直接 `db.js --init` 重置）
2. `backend/server.js` 對應的路由組 SQL 時帶上這個欄位
3. `frontend/js/app.js` 的 `taskCardHTML` 與 `state` 補上欄位

### 13.5 加新的前端頁面

1. `frontend/` 加一支 `xxx.html`
2. 在 `backend/server.js` 的 SPA fallback 維持即可（任何非 `/api/*` 都回 index.html，
   若要直接送 `xxx.html`，在 fallback 路由加判斷）
3. `frontend/js/` 加一支對應的 js 檔

---

## 14. 故障排除

| 狀況 | 解法 |
| --- | --- |
| 雙擊 `start.bat` 視窗立刻關閉 | 正常情況不會發生（錯誤路徑都有 `pause`）；若仍發生，用 cmd 手動開啟看錯誤訊息——通常是 `runtime\node` 缺檔或 port 已被佔 |
| port 8591 已被佔用 | 執行 `stop.bat`；或改 `backend/config.js` 的 `PORT` |
| 瀏覽器開起來畫面空白 | F12 看 console；通常是 CDN 沒載到（沒網路） |
| 中文顯示亂碼 | 三個 .bat 開頭都已執行 `chcp 65001`；若是其他終端機（如 Git Bash）啟動才會亂碼，請用雙擊或 cmd 執行 |
| 登入失敗 / 401 | 確認密碼沒打錯；或刪掉 `data\tasks.db` 重 seed |
| `npm install` 卡住 | 檢查網路；或 `npm config set registry https://registry.npmmirror.com` 換鏡像 |
| 想完全重置 | 執行 `reset.bat`；或刪 `data\tasks.db*` 後重跑 `start.bat` |
| better-sqlite3 編譯錯誤 | 已用 v13（N-API），應免編譯；若仍報錯代表 runtime 損毀，重新下載 Node ZIP 即可 |

---

## 附錄：環境資訊

- Node.js：**v24.22.0 LTS（Krypton）**（隨專案打包於 `runtime/node/`）
- npm：**11.19.1**
- 主要依賴：express 4、better-sqlite3 13、jsonwebtoken 9、bcryptjs 2、cors 2
- Tailwind CSS：**v3（原始檔打包於 `frontend/vendor/tailwind.js`，離線可用）**
- 圖示：**Lucide（打包於 `frontend/vendor/lucide.js`，離線可用）**
- 字型：系統字型（Microsoft JhengHei / PingFang TC / Noto Sans TC…，不連線下載）

---

> 所有程式碼都在 `backend/` 與 `frontend/`，
> 每個檔案開頭都有註解說明它的職責。
> 祝使用順利 🎯
