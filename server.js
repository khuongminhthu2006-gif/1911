const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const FILE = path.join(__dirname, 'data.json');
const KEY = process.env.ADMIN_KEY || 'doi-mat-khau-nay'; // ĐỔI mật khẩu xem kết quả

// Có DATABASE_URL (khi deploy) -> lưu vào Postgres. Không có (chạy trên máy) -> lưu file data.json
const pool = process.env.DATABASE_URL
  ? new (require('pg').Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const s = (v, n) => String(v || '').slice(0, n);
const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } };

async function save(item) {
  if (pool) { await pool.query('INSERT INTO answers (data) VALUES ($1)', [item]); return; }
  const all = readFile();
  all.push(item);
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

async function list() {
  if (pool) {
    const r = await pool.query('SELECT data FROM answers ORDER BY id DESC');
    return r.rows.map(x => x.data);
  }
  return readFile().reverse();
}

app.post('/api/answers', async (req, res) => {
  try {
    const b = req.body || {};
    const item = {
      id: Date.now(),
      time: new Date().toISOString(),
      dates: Array.isArray(b.dates) ? b.dates.slice(0, 10).map(x => s(x, 40)) : [],
      hour: s(b.hour, 20),
      food: s(b.food, 40),
      gift: s(b.gift, 500),
      feedback: s(b.feedback, 1000)
    };
    await save(item);
    console.log('Câu trả lời mới:', item);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/answers', async (req, res) => {
  if (req.get('x-key') !== KEY) return res.status(401).json({ error: 'unauthorized' });
  try { res.json(await list()); }
  catch (e) { console.error(e); res.status(500).json({ error: 'server error' }); }
});

async function start() {
  if (pool) await pool.query('CREATE TABLE IF NOT EXISTS answers (id SERIAL PRIMARY KEY, data JSONB NOT NULL)');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('Chạy tại http://localhost:' + PORT));
}
start().catch(e => { console.error(e); process.exit(1); });
