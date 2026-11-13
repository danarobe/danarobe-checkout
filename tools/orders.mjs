// 날짜 범위 주문 수집 (주문일 기준, 하루씩) → 필요한 칸만 JSON
// 사용: TK=... node orders.mjs 2026-10-16 2026-11-12 out.json [probe]
import fs from 'fs';
const TK = process.env.TK;
const H = { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' };
const [s, e, out] = process.argv.slice(2);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch('https://wnqka5000.cafe24api.com/api/v2/admin/' + u, { headers: H });
    if (r.status === 429) { await sleep(2000); continue; }
    if (!r.ok) throw new Error(u + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const lim = r.headers.get('x-api-call-limit');
    if (lim) { const [a, b] = lim.split('/').map(Number); if (a > b - 6) await sleep(1500); }
    return r.json();
  }
  throw new Error('429 반복');
}
const days = [];
for (let d = new Date(s + 'T00:00:00Z'); d <= new Date(e + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
const rows = [];
for (const day of days) {
  for (let off = 0; off < 15000; off += 1000) {
    const b = await get('orders?start_date=' + day + '&end_date=' + day + '&date_type=order_date&limit=1000&offset=' + off);
    for (const o of b.orders || []) {
      const a = o.initial_order_amount || o.actual_order_amount || {};
      rows.push({
        id: o.order_id, d: o.order_date, pd: o.payment_date, paid: o.paid, canceled: o.canceled,
        pm: (o.payment_method || []).join('+'), pmn: (o.payment_method_name || []).join('+'), pg: (o.payment_gateway_names || []).join('+'), easy: o.easypay_name || null, fpm: (o.first_payment_methods || []).join('+'),
        place: o.order_place_id, placeName: o.order_place_name, mobile: o.order_from_mobile,
        member: !!o.member_id, first: o.first_order, np: o.naverpay_payment_information || null,
        market: o.market_id || null, amt: Number(o.payment_amount || 0), init: o.initial_order_amount ? Number(o.initial_order_amount.order_price_amount || 0) : null,
        coupon: Number(a.coupon_discount_price || 0), pcoupon: Number(a.coupon_shipping_fee_amount || 0), points: Number(a.points_spent_amount || 0),
        credits: Number(a.credits_spent_amount || 0), memberDisc: Number(a.membership_discount_amount || 0), appDisc: Number(a.app_discount_amount || 0),
        ship: Number(a.shipping_fee || 0), price: Number(a.order_price_amount || 0), total: Number(a.total_amount_due || 0)
      });
    }
    if ((b.orders || []).length < 1000) break;
  }
  process.stdout.write(day + ' ');
}
fs.writeFileSync(out, JSON.stringify(rows));
console.log('\nsaved', rows.length);
