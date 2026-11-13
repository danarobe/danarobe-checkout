// 날짜별 방문자·장바구니·주문서·주문완료 페이지 방문과 매출(애널리틱스) 수집 → JSON
// 사용: TK=... node funnel.mjs 2026-10-02 2026-11-12 out.json
import fs from 'fs';
const TK = process.env.TK;
const H = { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' };
const [s, e, out] = process.argv.slice(2);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(path, q) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://ca-api.cafe24data.com' + path + '?mall_id=wnqka5000&' + q, { headers: H });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) throw new Error(path + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.json();
  }
  throw new Error('429 반복');
}
const days = [];
for (let d = new Date(s + 'T00:00:00Z'); d <= new Date(e + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
const URLS = ['/order/basket.html', '/order/orderform.html', '/order/order_result.html', '/product/detail.html'];
const rows = [];
for (const day of days) {
  const q = 'start_date=' + day + '&end_date=' + day;
  const v = (await get('/visitors/view', q)).view?.[0] || {};
  const row = { date: day, visits: v.visit_count || 0 };
  for (const dev of ['total', 'mobile', 'pc']) {
    let pages = [];
    for (let off = 0; off < 5000; off += 1000) {
      const b = await get('/pages/view', q + '&limit=1000&offset=' + off + (dev === 'total' ? '' : '&device_type=' + dev));
      pages.push(...(b.view || []));
      if ((b.view || []).length < 1000) break;
    }
    for (const u of URLS) {
      const m = pages.filter(p => p.url === u || p.url.startsWith(u + '?'));
      row[dev + ':' + u] = { count: m.reduce((t, p) => t + Number(p.count || 0), 0), visits: m.reduce((t, p) => t + Number(p.visit_count || 0), 0) };
    }
  }
  const times = (await get('/sales/times', q + '&limit=100')).times || [];
  row.orders = times.reduce((t, r) => t + Number(r.order_count || 0), 0);
  row.amount = times.reduce((t, r) => t + Number(r.order_amount || 0), 0);
  rows.push(row);
  process.stdout.write(day + ' ');
  await sleep(150);
}
fs.writeFileSync(out, JSON.stringify(rows, null, 1));
console.log('\nsaved', rows.length);
