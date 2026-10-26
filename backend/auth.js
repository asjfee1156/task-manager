/**
 * auth.js — JWT 驗證中介層
 *
 * 用最直觀的 Bearer Token 流程：
 *   - 登入成功 → 後端簽發 JWT（內含 user.id 與 user.username）
 *   - 前端把 token 存在 localStorage
 *   - 後續每個 API 帶 Authorization: Bearer <token>
 *   - 後端用這支 middleware 驗 token，把 user 資訊掛到 req.user
 */

const jwt = require('jsonwebtoken');

// 注意：真實專案要放進環境變數，這裡為了「解壓即用」寫死並讀 config.js
const SECRET = require('./config').JWT_SECRET;
const EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: '未登入或 token 缺失' });
  }
  try {
    req.user = jwt.verify(token, SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'token 無效或已過期' });
  }
  return next();
}

module.exports = { signToken, authRequired };
