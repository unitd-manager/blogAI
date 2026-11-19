import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'signalwrite', waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4',
  timezone: 'Z' // all dates in UTC, so trial/subscription dates are right even if the app and MySQL servers use different time zones
});
pool.on('connection', (connection) => { connection.query("SET time_zone = '+00:00'"); });

export async function initializeDatabase() {
  const conn = await mysql.createConnection({ host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '' });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${(process.env.MYSQL_DATABASE || 'signalwrite').replace(/[^a-zA-Z0-9_]/g, '')}\``);
  await conn.end();
  await pool.query(`CREATE TABLE IF NOT EXISTS projects (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160) NOT NULL, website VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS articles (id INT AUTO_INCREMENT PRIMARY KEY, project_id INT NULL, title VARCHAR(500) NOT NULL, topic VARCHAR(500), keyword VARCHAR(255), related_keywords_json LONGTEXT NULL, status VARCHAR(40) DEFAULT 'Draft', content LONGTEXT, sources_json LONGTEXT NULL, evidence_review_json LONGTEXT NULL, seo_score INT DEFAULT 0, word_count INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL)`);
  // App-wide values (e.g. the session signing secret). Per-user writing settings live in user_settings.
  await pool.query('CREATE TABLE IF NOT EXISTS settings (name VARCHAR(64) PRIMARY KEY, value TEXT)');
  // Customer accounts: 14-day trial from signup, then a subscription the admin activates.
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    name VARCHAR(120) NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at DATETIME NOT NULL,
    subscription_until DATETIME NULL,
    disabled TINYINT(1) NOT NULL DEFAULT 0,
    session_version INT NOT NULL DEFAULT 1
  )`);
  await pool.query('CREATE TABLE IF NOT EXISTS user_settings (user_id INT NOT NULL, name VARCHAR(64) NOT NULL, value TEXT, PRIMARY KEY (user_id, name))');
  const [columns] = await pool.query('SHOW COLUMNS FROM articles');
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has('sources_json')) await pool.query('ALTER TABLE articles ADD COLUMN sources_json LONGTEXT NULL');
  if (!names.has('evidence_review_json')) await pool.query('ALTER TABLE articles ADD COLUMN evidence_review_json LONGTEXT NULL');
  if (!names.has('related_keywords_json')) await pool.query('ALTER TABLE articles ADD COLUMN related_keywords_json LONGTEXT NULL');
  if (!names.has('keyword_strategy_json')) await pool.query('ALTER TABLE articles ADD COLUMN keyword_strategy_json LONGTEXT NULL');
  if (!names.has('meta_data_json')) await pool.query('ALTER TABLE articles ADD COLUMN meta_data_json LONGTEXT NULL');
  if (!names.has('website')) await pool.query('ALTER TABLE articles ADD COLUMN website VARCHAR(500) NULL');
  // Owner of each article. Articles written before accounts existed have NULL and are shown to admins.
  if (!names.has('user_id')) {
    await pool.query('ALTER TABLE articles ADD COLUMN user_id INT NULL');
    await pool.query('ALTER TABLE articles ADD INDEX idx_articles_user (user_id, updated_at)');
  }
  // Older databases were created as latin1, which rejects curly quotes, special dashes and emoji
  // that AI models write — the article then silently fails to save. Convert to utf8mb4 (lossless).
  await pool.query('ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  const [tables] = await pool.query("SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('projects', 'articles', 'settings', 'users', 'user_settings')");
  for (const table of tables) {
    if (!String(table.collation).startsWith('utf8mb4')) await pool.query(`ALTER TABLE \`${table.name}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  }
}
