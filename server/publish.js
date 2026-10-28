// 설정 → docs/ (GitHub Pages) 빌드 + git push
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SKIN = path.join(ROOT, 'skin');

// GitHub Pages 주소 (저장소: danarobe/danarobe-checkout, docs/ 폴더)
export const SITE_BASE = process.env.DNRB_SITE_BASE || 'https://danarobe.github.io/danarobe-checkout';

export function buildDocs(cfg) {
  fs.mkdirSync(DOCS, { recursive: true });
  const pub = { ...cfg };
  delete pub.updatedAt;
  const js = `/* 다나로브 주문서 설정 — 관리 화면에서 생성됨 (${new Date().toISOString()}) */\nwindow.DNRB_PAY_CONFIG = ${JSON.stringify(pub, null, 2)};\n`;
  fs.writeFileSync(path.join(DOCS, 'config.js'), js);
  fs.writeFileSync(path.join(DOCS, 'config.json'), JSON.stringify(pub, null, 2));
  for (const f of ['checkout.css', 'checkout.js']) fs.copyFileSync(path.join(SKIN, f), path.join(DOCS, f));
  fs.writeFileSync(path.join(DOCS, 'orderform.html'), fs.readFileSync(path.join(SKIN, 'orderform.html'), 'utf8').replace(/__DNRB_BASE__/g, SITE_BASE));
  if (!fs.existsSync(path.join(DOCS, '.nojekyll'))) fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');
  if (!fs.existsSync(path.join(DOCS, 'index.html'))) {
    fs.writeFileSync(path.join(DOCS, 'index.html'), '<!doctype html><meta charset="utf-8"><title>danarobe-checkout</title><p>다나로브 주문서 꾸미기 설정 파일 저장소입니다.</p>');
  }
}

async function git(...args) {
  const { stdout } = await run('git', args, { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

export async function publish(message = '설정 적용') {
  await git('add', '-A', 'docs', 'data/config.json', 'skin');
  const staged = await git('diff', '--cached', '--name-only');
  if (!staged) {
    return { pushed: false, message: '바뀐 내용이 없어서 그대로 두었어요.', site: SITE_BASE };
  }
  await git('commit', '-m', `${message}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`);
  let remote = '';
  try { remote = await git('remote', 'get-url', 'origin'); } catch { /* 없음 */ }
  if (!remote) throw new Error('GitHub 저장소(origin)가 아직 연결되지 않았어요. README 의 "처음 한 번" 순서를 따라주세요.');
  await git('push', 'origin', 'HEAD');
  const sha = await git('rev-parse', '--short', 'HEAD');
  return { pushed: true, sha, message: '적용 완료. 보통 1~3분 안에 주문서에 반영돼요.', site: SITE_BASE };
}

export async function status() {
  let remote = '', branch = '', last = '', dirty = false;
  try { remote = await git('remote', 'get-url', 'origin'); } catch {}
  try { branch = await git('rev-parse', '--abbrev-ref', 'HEAD'); } catch {}
  try { last = await git('log', '-1', '--format=%ci %s'); } catch {}
  try { dirty = !!(await git('status', '--porcelain', 'docs', 'data/config.json', 'skin')); } catch {}
  let live = null;
  try {
    const r = await fetch(`${SITE_BASE}/config.json?t=${Date.now()}`, { cache: 'no-store' });
    live = r.ok ? await r.json() : null;
  } catch {}
  return { remote, branch, lastCommit: last, pendingChanges: dirty, site: SITE_BASE, live };
}
