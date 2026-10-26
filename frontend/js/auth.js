/**
 * auth.js — 登入/註冊頁邏輯
 *
 * 功能：
 *   - 切換 tab（登入 / 註冊）
 *   - 送出表單
 *   - 成功後把 token 存進 localStorage 並跳到 app.html
 */

// 如果已經登入，直接進主畫面
if (API.token()) location.replace('/app.html');

const $ = (sel) => document.querySelector(sel);
const tabLogin = $('#tab-login');
const tabReg   = $('#tab-register');
const formLogin = $('#form-login');
const formReg   = $('#form-register');

function show(which) {
  const isLogin = which === 'login';
  tabLogin.classList.toggle('bg-white', isLogin);
  tabLogin.classList.toggle('shadow',   isLogin);
  tabLogin.classList.toggle('text-slate-900', isLogin);
  tabLogin.classList.toggle('text-slate-500', !isLogin);
  tabReg.classList.toggle('bg-white', !isLogin);
  tabReg.classList.toggle('shadow',   !isLogin);
  tabReg.classList.toggle('text-slate-900', !isLogin);
  tabReg.classList.toggle('text-slate-500', isLogin);
  formLogin.classList.toggle('hidden', !isLogin);
  formReg.classList.toggle('hidden',   isLogin);
}
tabLogin.addEventListener('click', () => show('login'));
tabReg.addEventListener('click',   () => show('register'));

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formLogin);
  try {
    const { token, user } = await API.login({
      username: fd.get('username'),
      password: fd.get('password')
    });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    toast('登入成功');
    setTimeout(() => location.href = '/app.html', 400);
  } catch (err) { toast(err.message, 'error'); }
});

formReg.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(formReg);
  try {
    const { token, user } = await API.register({
      username: fd.get('username'),
      password: fd.get('password'),
      display_name: fd.get('display_name') || fd.get('username')
    });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    toast('註冊成功，歡迎！');
    setTimeout(() => location.href = '/app.html', 400);
  } catch (err) { toast(err.message, 'error'); }
});

renderIcons();
startClock('#clock');
