/**
 * config.js — 集中管理設定
 *
 * 為了「解壓即用」，所有設定都給了預設值；正式專案應該用環境變數。
 */

module.exports = {
  PORT: process.env.PORT || 8591,
  JWT_SECRET: process.env.JWT_SECRET || 'task-manager-demo-secret-change-me',
  BCRYPT_ROUNDS: 10
};
