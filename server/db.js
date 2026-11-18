import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'signalwrite', waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4'
});

export async function initializeDatabase() {
  const conn = await mysql.createConnection({ host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '' });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${(process.env.MYSQL_DATABASE || 'signalwrite').replace(/[^a-zA-Z0-9_]/g, '')}\``);
  await conn.end();
  await pool.query(`CREATE TABLE IF NOT EXISTS projects (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160) NOT NULL, website VARCHAR(500), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS articles (id INT AUTO_INCREMENT PRIMARY KEY, project_id INT NULL, title VARCHAR(500) NOT NULL, topic VARCHAR(500), keyword VARCHAR(255), related_keywords_json LONGTEXT NULL, status VARCHAR(40) DEFAULT 'Draft', content LONGTEXT, sources_json LONGTEXT NULL, evidence_review_json LONGTEXT NULL, seo_score INT DEFAULT 0, word_count INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL)`);
  const [columns] = await pool.query('SHOW COLUMNS FROM articles');
  const names = new Set(columns.map((column) => column.Field));
  if (!names.has('sources_json')) await pool.query('ALTER TABLE articles ADD COLUMN sources_json LONGTEXT NULL');
  if (!names.has('evidence_review_json')) await pool.query('ALTER TABLE articles ADD COLUMN evidence_review_json LONGTEXT NULL');
  if (!names.has('related_keywords_json')) await pool.query('ALTER TABLE articles ADD COLUMN related_keywords_json LONGTEXT NULL');
  if (!names.has('keyword_strategy_json')) await pool.query('ALTER TABLE articles ADD COLUMN keyword_strategy_json LONGTEXT NULL');
  if (!names.has('meta_data_json')) await pool.query('ALTER TABLE articles ADD COLUMN meta_data_json LONGTEXT NULL');
  if (!names.has('website')) await pool.query('ALTER TABLE articles ADD COLUMN website VARCHAR(500) NULL');
  // Older databases were created as latin1, which rejects curly quotes, special dashes and emoji
  // that AI models write — the article then silently fails to save. Convert to utf8mb4 (lossless).
  await pool.query('ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  const [tables] = await pool.query("SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('projects', 'articles')");
  for (const table of tables) {
    if (!String(table.collation).startsWith('utf8mb4')) await pool.query(`ALTER TABLE \`${table.name}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  }
}
