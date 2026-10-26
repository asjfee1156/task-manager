/**
 * app.js — 主畫面邏輯
 *
 * 模組分區：
 *   1. 守門   → 沒 token 跳回登入頁
 *   2. 狀態   → tasks / status / priority / q / modal 編輯物件
 *   3. 載入   → 抓任務列表 + 統計
 *   4. 渲染   → 4 個狀態版塊（已逾期 / 今日到期 / 進行中 / 已完成）
 *   5. 互動   → 篩選 / 搜尋 / 新增 / 編輯 / 刪除 / 切換完成
 *   6. 工具   → escape HTML、日期工具、排序、debounce、時鐘
 */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── 1. 守門 ───────────────────────────────── */
if (!API.token()) location.replace('/index.html');

const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
$('#me-name').textContent = storedUser.display_name || storedUser.username || '使用者';

/* ── 2. 狀態 ───────────────────────────────── */
const state = {
  status: 'all',          // all / overdue / today / active / done → 控制要顯示哪個版塊
  priority: '',           // '' / low / medium / high
  q: '',                  // 搜尋字
  tasks: [],              // 後端拉回的完整清單（篩選在前端做）
  editing: null           // null = 新增；{ id, title, ... } = 編輯
};

/**
 * 版塊定義：由上到下「已逾期 → 今日到期 → 進行中 → 已完成」
 * 每個版塊只放同一種狀態的任務，同一橫行絕不混雜不同狀態。
 */
const SECTIONS = {
  overdue: { title: '已逾期',   icon: 'alarm-clock',    dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700',      empty: '目前沒有逾期任務' },
  today:   { title: '今日到期', icon: 'calendar-clock', dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700',   empty: '今天沒有到期任務' },
  active:  { title: '進行中',   icon: 'list-todo',      dot: 'bg-brand-500',   badge: 'bg-brand-100 text-brand-700',   empty: '沒有進行中的任務' },
  done:    { title: '已完成',   icon: 'check-circle-2', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', empty: '還沒有已完成的任務' }
};
const SECTION_ORDER = ['overdue', 'today', 'active', 'done'];

/* ── 3. 載入 ───────────────────────────────── */
async function loadAll() {
  showLoading(true);
  try {
    // 一次抓全部回來，分版塊與篩選都在前端做（資料量小，省 API 往返）
    const [list, stats] = await Promise.all([API.listTasks(), API.stats()]);
    state.tasks = list.tasks;
    renderStats(stats);
    renderTasks();
  } catch (err) { toast(err.message, 'error'); }
  showLoading(false);
}

async function loadMe() {
  try {
    const { user } = await API.me();
    localStorage.setItem('user', JSON.stringify(user));
    $('#me-name').textContent = user.display_name || user.username;
  } catch (_) { /* 靜默失敗，初始資料即可 */ }
}

/* ── 4. 渲染 ───────────────────────────────── */
function renderStats(s) {
  $('#stat-total').textContent   = s.total;
  $('#stat-done').textContent    = s.done;
  $('#stat-pending').textContent = s.pending;
  $('#stat-today').textContent   = s.today_due;
  $('#stat-overdue').textContent = s.overdue;
  $('#stat-rate').textContent    = s.completion_rate + '%';
  $('#stat-rate-bar').style.width = s.completion_rate + '%';
}

/** 依搜尋 / 優先級過濾後，把任務分到 4 個版塊 */
function bucketize(tasks) {
  const today = todayStr();
  const buckets = { overdue: [], today: [], active: [], done: [] };
  for (const t of tasks) {
    if (t.status === 'done')  { buckets.done.push(t); continue; }
    if (!t.due_date)          { buckets.active.push(t); continue; }  // 沒日期的視為進行中
    if (t.due_date < today)   { buckets.overdue.push(t); continue; }
    if (t.due_date === today) { buckets.today.push(t); continue; }
    buckets.active.push(t);
  }
  for (const k of SECTION_ORDER) buckets[k].sort(compareTasks);
  return buckets;
}

/** 排序：優先級（高→中→低）→ 截止時間（早→晚）→ 建立時間（新→舊） */
function compareTasks(a, b) {
  const P = { high: 0, medium: 1, low: 2 };
  if (P[a.priority] !== P[b.priority]) return P[a.priority] - P[b.priority];
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return b.id - a.id;
}

function renderTasks() {
  const root = $('#sections');

  // 前端過濾：搜尋 + 優先級
  const q = state.q.trim().toLowerCase();
  const filtered = state.tasks.filter(t => {
    if (state.priority && t.priority !== state.priority) return false;
    if (q && !(t.title + ' ' + t.description).toLowerCase().includes(q)) return false;
    return true;
  });

  const buckets = bucketize(filtered);
  const visible = state.status === 'all' ? SECTION_ORDER : [state.status];

  root.innerHTML = visible
    .map(key => sectionHTML(key, buckets[key]))
    .join('');

  bindTaskEvents();
  renderIcons();
}

function sectionHTML(key, tasks) {
  const s = SECTIONS[key];
  const cards = tasks.length
    ? tasks.map(taskCardHTML).join('')
    : `<div class="col-span-full text-center py-8 text-sm text-slate-400 rounded-2xl border border-dashed border-slate-200">${s.empty}</div>`;

  return `
  <section class="animate-fadeUp">
    <div class="flex items-center gap-2.5 mb-3">
      <span class="w-2.5 h-2.5 rounded-full ${s.dot}"></span>
      <i data-lucide="${s.icon}" class="w-4 h-4 text-slate-500"></i>
      <h2 class="text-base font-bold text-slate-800">${s.title}</h2>
      <span class="px-2 py-0.5 rounded-full text-xs font-bold ${s.badge}">${tasks.length}</span>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
  </section>`;
}

function taskCardHTML(t) {
  // 已完成的任務不標「逾期」（語意不對），只秀日期
  const due = t.status === 'done' ? { label: dueText(t.due_date), state: 'ok' }
                                      : formatDue(t.due_date);
  const dueClass = due.state;  // overdue / today / soon / ok / none
  const priorityLabel = { high: '高', medium: '中', low: '低' }[t.priority] || t.priority;

  return `
  <article class="task-card cursor-pointer relative bg-white border border-slate-200/70 rounded-2xl p-5 pl-6 shadow-card ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
    <div class="priority-stripe ${t.priority}"></div>

    <div class="flex items-start gap-3">
      <span class="cb ${t.status === 'done' ? 'checked' : ''}" data-act="toggle" title="${t.status === 'done' ? '標為未完成' : '標為完成'}">
        ${t.status === 'done' ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}
      </span>

      <div class="flex-1 min-w-0">
        <div class="task-title font-semibold text-slate-900 truncate-2">${escapeHTML(t.title)}</div>
        ${t.description ? `<p class="mt-1 text-sm text-slate-500 whitespace-pre-line truncate-2">${escapeHTML(t.description)}</p>` : ''}

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="priority-badge priority-${t.priority}">
            <i data-lucide="${priorityIcon(t.priority)}" class="w-3 h-3"></i>${priorityLabel}
          </span>
          ${due.label ? `<span class="due-badge due-${dueClass}"><i data-lucide="calendar" class="w-3 h-3"></i>${due.label}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
      <button data-act="edit" class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center gap-1">
        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>編輯
      </button>
      <button data-act="delete" class="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition flex items-center gap-1">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>刪除
      </button>
    </div>
  </article>`;
}

function bindTaskEvents() {
  $$('#sections .task-card').forEach(card => {
    const id = Number(card.dataset.id);
    // 點卡片本身 → 放大檢視（按鈕區已 stopPropagation，不會誤觸）
    card.addEventListener('click', () => onCardClick(id));
    card.querySelector('[data-act="toggle"]').addEventListener('click', (e) => { e.stopPropagation(); onToggle(id); });
    card.querySelector('[data-act="edit"]'  ).addEventListener('click', (e) => { e.stopPropagation(); onEdit(id); });
    card.querySelector('[data-act="delete"]').addEventListener('click', (e) => { e.stopPropagation(); onDelete(id); });
  });
}

/* ── 5. 互動 ───────────────────────────────── */

$('#btn-logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '/index.html';
});

// 狀態篩選下拉（只切換顯示哪個版塊，不重新拉資料）
$('#filter-status').addEventListener('change', (e) => {
  state.status = e.target.value;
  renderTasks();
});

// 優先級篩選（前端過濾）
$('#filter-priority').addEventListener('change', (e) => {
  state.priority = e.target.value;
  renderTasks();
});

// 搜尋（前端過濾 + debounce）
const debouncedSearch = debounce(() => renderTasks(), 250);
$('#search').addEventListener('input', (e) => {
  state.q = e.target.value;
  debouncedSearch();
});

/* Modal */
const modal = $('#modal');
$('#btn-new').addEventListener('click', () => openModal(null));
$$('[data-close]').forEach(el => el.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.classList.contains('hidden')) closeModal();
  if (!cardOverlay.classList.contains('hidden')) closeCardDetail();
});

function openModal(task) {
  state.editing = task;
  $('#modal-title').textContent = task ? '編輯任務' : '新增任務';
  $('#f-title').value    = task ? task.title       : '';
  $('#f-desc').value     = task ? task.description : '';
  $('#f-priority').value = task ? task.priority    : 'medium';
  $('#f-due').value      = task && task.due_date ? task.due_date.slice(0, 10) : '';
  modal.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#f-title').focus(), 50);
}
function closeModal() {
  modal.classList.add('hidden');
  document.body.classList.remove('no-scroll');
  state.editing = null;
}

/* ── 任務放大檢視 ──────────────────────────── */
const cardOverlay = $('#card-overlay');

// 事件代理：點背景遮罩或 ✕ 鈕（data-card-close）都關閉；內容重 render 後依然有效
cardOverlay.addEventListener('click', (e) => {
  if (e.target.closest('[data-card-close]')) closeCardDetail();
});

function onCardClick(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) openCardDetail(t);
}

/** 這筆任務屬於哪個版塊（放大檢視要顯示狀態標籤） */
function sectionKeyOf(t) {
  if (t.status === 'done') return 'done';
  const today = todayStr();
  if (!t.due_date || t.due_date > today) return 'active';
  if (t.due_date === today) return 'today';
  return 'overdue';
}

function openCardDetail(t) {
  const sec = SECTIONS[sectionKeyOf(t)];
  const done = t.status === 'done';
  const due = done ? { label: dueText(t.due_date), state: 'ok' } : formatDue(t.due_date);
  const priorityLabel = { high: '高', medium: '中', low: '低' }[t.priority] || t.priority;

  $('#card-large').innerHTML = `
  <div class="relative p-7">
    <button data-card-close class="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100" title="關閉">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <span class="px-2 py-0.5 rounded-full text-xs font-bold ${sec.badge}">${sec.title}</span>
      <span class="priority-badge priority-${t.priority}">
        <i data-lucide="${priorityIcon(t.priority)}" class="w-3 h-3"></i>${priorityLabel}優先
      </span>
      ${due.label ? `<span class="due-badge due-${due.state}"><i data-lucide="calendar" class="w-3 h-3"></i>${due.label}</span>` : ''}
    </div>
    <h3 class="text-xl font-bold text-slate-900 ${done ? 'line-through text-slate-400' : ''}">${escapeHTML(t.title)}</h3>
    ${t.description
      ? `<p class="mt-3 text-slate-600 whitespace-pre-line leading-relaxed">${escapeHTML(t.description)}</p>`
      : `<p class="mt-3 text-slate-300 text-sm">（沒有描述）</p>`}
    <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
      <span>建立於 ${t.created_at || '-'}</span>
      <span>更新於 ${t.updated_at || '-'}</span>
    </div>
    <div class="mt-4 flex gap-2">
      <button data-card-act="toggle" class="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
        ${done ? '標為未完成' : '標為完成'}
      </button>
      <button data-card-act="edit" class="flex-1 py-2 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 text-sm font-medium transition">編輯</button>
      <button data-card-act="delete" class="flex-1 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-medium transition">刪除</button>
    </div>
  </div>`;

  const root = $('#card-large');
  root.querySelector('[data-card-act="toggle"]').addEventListener('click', async () => {
    try { await API.toggleTask(t.id); closeCardDetail(); loadAll(); }
    catch (err) { toast(err.message, 'error'); }
  });
  root.querySelector('[data-card-act="edit"]').addEventListener('click', () => {
    closeCardDetail();
    openModal(t);
  });
  root.querySelector('[data-card-act="delete"]').addEventListener('click', () => {
    closeCardDetail();
    onDelete(t.id);
  });

  cardOverlay.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  renderIcons();
}

function closeCardDetail() {
  cardOverlay.classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  // 截止日期必填（前後端都擋）
  if (!$('#f-due').value) {
    toast('請選擇截止日期', 'error');
    $('#f-due').focus();
    return;
  }
  const payload = {
    title: $('#f-title').value.trim(),
    description: $('#f-desc').value,
    priority: $('#f-priority').value,
    due_date: $('#f-due').value
  };
  try {
    if (state.editing) {
      await API.updateTask(state.editing.id, payload);
      toast('已更新');
    } else {
      await API.createTask(payload);
      toast('已新增');
    }
    closeModal();
    loadAll();
  } catch (err) { toast(err.message, 'error'); }
});

async function onToggle(id) {
  try { await API.toggleTask(id); loadAll(); }
  catch (err) { toast(err.message, 'error'); }
}

function onEdit(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) openModal(t);
}

async function onDelete(id) {
  if (!confirm('確定刪除這筆任務？')) return;
  try { await API.deleteTask(id); toast('已刪除'); loadAll(); }
  catch (err) { toast(err.message, 'error'); }
}

/* ── 6. 工具 ───────────────────────────────── */
function showLoading(on) { $('#loading').classList.toggle('hidden', !on); }

function escapeHTML(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function priorityIcon(p) {
  return { high: 'flame', medium: 'equal', low: 'minus' }[p] || 'minus';
}

/** 本地日期字串 YYYY-MM-DD（與後端種子資料一致） */
function todayStr() {
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/** 日期顯示字串（DD/MM） */
function dueText(d) {
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '';   // 25/10
}

function formatDue(d) {
  if (!d) return { label: '', state: 'none' };
  const today = todayStr();
  const ymd = dueText(d);                              // 18/10
  if (d < today)   return { label: `${ymd} · 逾期 ${daysBetween(today, d)} 天`, state: 'overdue' };
  if (d === today) return { label: `${ymd} · 今天到期`, state: 'today' };
  const diff = daysBetween(d, today);
  if (diff <= 3)   return { label: `${ymd} · ${diff} 天後`, state: 'soon' };
  return { label: ymd, state: 'ok' };
}

/** 相隔天數 */
function daysBetween(later, earlier) {
  const a = new Date(later + 'T00:00:00');
  const b = new Date(earlier + 'T00:00:00');
  return Math.round((a - b) / 86400000);
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ── 啟動 ──────────────────────────────────── */
loadMe();
loadAll();
renderIcons();
startClock('#clock-date', '#clock-time');
