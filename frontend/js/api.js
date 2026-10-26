/**
 * api.js — 共用的 fetch wrapper
 *
 * 為什麼要包這層：
 *   - 自動帶 Authorization 標頭
 *   - 統一處理 401（token 過期 → 跳回登入頁）
 *   - 把 JSON 解析、失敗訊息都收斂在一處
 */

const API = {
  token: () => localStorage.getItem('token'),

  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && API.token()) headers['Authorization'] = `Bearer ${API.token()}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let data = null;
    try { data = await res.json(); } catch (_) { /* 可能沒 body */ }

    if (res.status === 401 && auth) {
      // token 失效 → 清掉並導回登入頁
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!location.pathname.endsWith('/index.html') && location.pathname !== '/') {
        location.href = '/index.html';
      }
      throw new Error('請重新登入');
    }

    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  },

  // Auth
  register: (payload) => API.request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login:    (payload) => API.request('/api/auth/login',    { method: 'POST', body: payload, auth: false }),
  me:       ()        => API.request('/api/auth/me'),

  // Tasks
  listTasks:   (query = {}) => {
    const qs = new URLSearchParams(query).toString();
    return API.request('/api/tasks' + (qs ? `?${qs}` : ''));
  },
  createTask:  (payload)    => API.request('/api/tasks',         { method: 'POST',   body: payload }),
  updateTask:  (id, payload)=> API.request(`/api/tasks/${id}`,   { method: 'PUT',    body: payload }),
  toggleTask:  (id)         => API.request(`/api/tasks/${id}/toggle`, { method: 'PATCH' }),
  deleteTask:  (id)         => API.request(`/api/tasks/${id}`,   { method: 'DELETE' }),
  stats:       ()           => API.request('/api/tasks/stats'),
};

/* ── Toast（兩頁共用） ─────────────────────────── */
function toast(msg, kind = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = `fixed top-5 right-5 z-50 ${kind}`;
  el.innerHTML = `<div class="px-4 py-3 rounded-xl shadow-card text-sm font-medium">${msg}</div>`;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ── 圖示重新整理（動態插入 icon 後要呼叫） ─── */
function renderIcons() { window.lucide && window.lucide.createIcons(); }

/* ── 日期 / 星期 / 時間（即時更新） ──────────── */
/**
 * startClock(dateSel, timeSel)
 *   - 兩個元素：date 寫「2026/10/19 星期一」、time 寫「14:32:05」
 *   - 只傳一個：單行顯示「2026/10/19 星期一 14:32:05」
 */
function startClock(dateSel, timeSel) {
  const dateEl = document.querySelector(dateSel);
  const timeEl = timeSel ? document.querySelector(timeSel) : null;
  if (!dateEl) return;
  const WD = '日一二三四五六';
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const n = new Date();
    const d = `${n.getFullYear()}/${pad(n.getMonth() + 1)}/${pad(n.getDate())} 星期${WD[n.getDay()]}`;
    const t = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
    if (timeEl) {
      dateEl.textContent = d;
      timeEl.textContent = t;
    } else {
      dateEl.textContent = `${d}　${t}`;
    }
  }
  tick();
  setInterval(tick, 1000);
}
