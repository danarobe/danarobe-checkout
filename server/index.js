// 다나로브 주문서 꾸미기 — 관리 화면 서버 (localhost:3005)
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAYMETHODS, NOTICE_POSITIONS, PROMOTION_POSITIONS, PAYMETHOD_MODES, withDefaults } from './schema.js';
import { buildDocs, publish, status, SITE_BASE } from './publish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CONFIG_FILE = path.join(DATA, 'config.json');
const HISTORY_DIR = path.join(DATA, 'history');
const PORT = Number(process.env.PORT || 3006);

fs.mkdirSync(HISTORY_DIR, { recursive: true });

function readConfig() {
  try { return withDefaults(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch { return withDefaults({}); }
}
function writeConfig(cfg) {
  const clean = withDefaults(cfg);
  clean.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(clean, null, 2));
  // 간단한 되돌리기용 히스토리 (최근 30개)
  const stamp = clean.updatedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(HISTORY_DIR, `${stamp}.json`), JSON.stringify(clean, null, 2));
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();
  files.slice(0, Math.max(0, files.length - 30)).forEach(f => fs.unlinkSync(path.join(HISTORY_DIR, f)));
  return clean;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
// 이 컴퓨터의 브라우저에서 연 관리 화면만 받는다 (다른 사이트/외부에서 보낸 요청 차단)
app.use((req, res, next) => {
  const host = String(req.headers.host || '');
  const okHost = host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`;
  const origin = req.headers.origin;
  const okOrigin = !origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
  if (!okHost || !okOrigin) return res.status(403).send('허용되지 않은 접근');
  next();
});
app.use('/skin', express.static(path.join(ROOT, 'skin')));
app.use(express.static(path.join(ROOT, 'admin')));

app.get('/api/meta', (req, res) => {
  res.json({ PAYMETHODS, NOTICE_POSITIONS, PROMOTION_POSITIONS, PAYMETHOD_MODES, SITE_BASE, port: PORT });
});

app.get('/api/config', (req, res) => res.json(readConfig()));

app.put('/api/config', (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: '설정 형식이 올바르지 않아요.' });
  const saved = writeConfig(req.body);
  buildDocs(saved); // docs/ 는 항상 저장본과 같게
  res.json({ ok: true, config: saved });
});

app.get('/api/history', (req, res) => {
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  res.json(files.map(f => ({ file: f, at: f.replace('.json', '') })));
});
app.post('/api/history/restore', (req, res) => {
  const file = path.basename(String(req.body?.file || ''));
  const p = path.join(HISTORY_DIR, file);
  if (!file.endsWith('.json') || !fs.existsSync(p)) return res.status(404).json({ error: '없는 기록이에요.' });
  const cfg = writeConfig(JSON.parse(fs.readFileSync(p, 'utf8')));
  buildDocs(cfg);
  res.json({ ok: true, config: cfg });
});

app.post('/api/publish', async (req, res) => {
  try {
    const cfg = readConfig();
    buildDocs(cfg);
    const result = await publish(req.body?.message || '설정 적용');
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/api/status', async (req, res) => {
  try { res.json(await status()); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// 스킨에 넣을 파일 (설치 안내용)
app.get('/api/skin/orderform', (req, res) => {
  const src = fs.readFileSync(path.join(ROOT, 'skin', 'orderform.html'), 'utf8').replace(/__DNRB_BASE__/g, SITE_BASE);
  res.type('text/plain').send(src);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[danarobe-checkout] 관리 화면: http://localhost:${PORT}`);
});
