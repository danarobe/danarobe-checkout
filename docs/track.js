/* =====================================================================
 * 다나로브 장바구니·주문서 사용 기록 — track.js
 * checkout.js / basket.js 가 설정(tracking)이 켜져 있을 때만 비동기로 불러온다.
 *
 * 안전 원칙 (결제에 절대 영향 없음)
 *  - 화면을 읽기만 한다: 버튼·입력·결제 흐름을 바꾸거나 막지 않는다(preventDefault·stopPropagation 없음).
 *  - 보내기는 navigator.sendBeacon(브라우저가 뒤에서 보냄, 기다리지 않음). 실패해도 조용히 버림.
 *  - 모든 코드는 try/catch 안. 오류가 나도 페이지에는 아무 일도 없다.
 *  - 개인정보(이름·연락처·주소·아이디)는 읽지 않는다. 금액·버튼·기기 종류만.
 * ===================================================================== */
(function () {
  'use strict';
  try {
    var VER = '2026-11-13.2';
    var cfg = (window.DNRB_PAY_CONFIG || {}).tracking || {};
    if (!cfg.url || !cfg.key || window.__dnrbTrackOn) return;
    window.__dnrbTrackOn = true;
    var doc = document, path = location.pathname;
    var PAGE = /\/order\/orderform/.test(path) ? 'orderform' : (/\/order\/basket/.test(path) ? 'basket' : '');
    if (!PAGE || window.top !== window) return;
    var LIVE = !/^\/skin-[^/]+/.test(path);
    var T0 = Date.now();

    /* 방문 묶음 번호: 무작위, 1시간 동안 같은 값(장바구니 → 주문서 흐름을 잇기 위해) */
    function rnd() { var s = ''; while (s.length < 16) s += Math.random().toString(36).slice(2); return s.slice(0, 16); }
    var sid = '';
    try {
      var raw = JSON.parse(localStorage.getItem('dnrb_sid') || 'null');
      if (raw && /^[a-z0-9]{16}$/.test(raw.id) && Date.now() - raw.at < 3600e3) sid = raw.id;
      if (!sid) sid = rnd();
      localStorage.setItem('dnrb_sid', JSON.stringify({ id: sid, at: Date.now() }));
    } catch (e) { sid = sid || rnd(); }

    var ua = navigator.userAgent || '';
    var dev = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : (/Android/i.test(ua) ? 'and' : 'pc');
    var ia = /Instagram/i.test(ua) ? 'ig' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'fb' : /KAKAOTALK/i.test(ua) ? 'kakao' : /NAVER\(inapp/i.test(ua) ? 'naver' : /CAFE24|cafe24app|; wv\)/i.test(ua) ? 'app' : '';

    var url = cfg.url + (cfg.url.indexOf('?') < 0 ? '?' : '&') + 'apikey=' + encodeURIComponent(cfg.key);
    var q = [], timer = null;
    function send() {
      timer = null;
      if (!q.length) return;
      var batch = q.splice(0, 40);
      try {
        var body = JSON.stringify({ sid: sid, p: PAGE, v: VER, dv: dev, ia: ia, lv: LIVE ? '1' : '0', ev: batch });
        var ok = false;
        if (navigator.sendBeacon) ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        if (!ok && window.fetch) fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body }).catch(function () {});
      } catch (e) {}
      if (q.length) send();
    }
    function ev(name, data) {
      try {
        var d = data || {}; d.ms = Date.now() - T0;
        q.push({ e: name, d: d });
        if (q.length > 200) q.splice(0, q.length - 200);
        if (!timer) timer = setTimeout(send, 2000);
      } catch (e) {}
    }
    function flushNow() { try { if (timer) clearTimeout(timer); send(); } catch (e) {} }
    // basket.js / checkout.js 가 이 파일보다 먼저 쌓아 둔 기록
    window.__dnrbTrack = function (name, data, now) { ev(name, data); if (now) flushNow(); };
    (window.__dnrbQ || []).forEach(function (x) { try { ev(x[0], x[1]); } catch (e) {} });
    window.__dnrbQ = [];

    /* 공통: 머문 시간·가장 많이 내린 위치 */
    var maxScroll = 0, left = false;
    window.addEventListener('scroll', function () {
      try { var h = doc.documentElement.scrollHeight - innerHeight; if (h > 0) maxScroll = Math.max(maxScroll, Math.round(scrollY / h * 100)); } catch (e) {}
    }, { passive: true });
    function leave() {
      if (left) return; left = true;
      ev('leave', { s: Math.round((Date.now() - T0) / 1000), sc: Math.min(100, maxScroll) });
      flushNow();
    }
    window.addEventListener('pagehide', leave);
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') { if (q.length) flushNow(); } });

    function $(s, r) { return (r || doc).querySelector(s); }
    function $$(s, r) { return [].slice.call((r || doc).querySelectorAll(s)); }
    function won(t) { var m = String(t || '').replace(/[^\d-]/g, ''); return m ? parseInt(m, 10) : null; }
    function member() { return $('a[href*="logout"], a[href*="Logout"]') ? 1 : 0; }

    /* 장바구니: 카페24 원래 주문 버튼을 직접 누른 경우만 여기서(나머지는 basket.js 가 기록) */
    if (PAGE === 'basket') {
      doc.addEventListener('click', function (e) {
        try {
          var a = e.target.closest && e.target.closest('a[onclick*="Basket.order"]');
          if (a && e.isTrusted) ev('b_order_native', { k: /orderAll/.test(a.getAttribute('onclick')) ? 'all' : 'sel' });
        } catch (x) {}
      }, { capture: true, passive: true });
      return;
    }

    /* 주문서 ------------------------------------------------------------ */
    function amounts() {
      var o = {};
      try {
        $$('#ec-jigsaw-area-payment tr').forEach(function (tr) {
          var th = $('th', tr), td = $('td', tr); if (!th || !td) return;
          var k = th.textContent.replace(/\s+/g, ' ').trim(), v = won(td.textContent);
          if (v == null || !k) return;
          if (/^주문\s*상품|상품\s*금액/.test(k)) o.prod = Math.abs(v);
          else if (/^배송비/.test(k)) o.fee = Math.abs(v);
          else if (/할인\s*\/?\s*부가결제/.test(k)) o.disc = Math.abs(v);
          else if (/쿠폰/.test(k)) o.cpn = (o.cpn || 0) + Math.abs(v);
          else if (/적립금/.test(k)) o.pts = (o.pts || 0) + Math.abs(v);
          else if (/예치금/.test(k)) o.dep = Math.abs(v);
        });
        var p = $('#total_order_sale_price_view'); if (p) o.pay = won(p.textContent);
      } catch (e) {}
      return o;
    }
    function payMethod() { var r = $('input[name="addr_paymethod"]:checked'); return r ? r.value : ''; }
    function freeShipGap() {
      var b = $('.dnrb-freeship'); if (!b || b.style.display === 'none') return null;
      if (/dnrb-freeship-done/.test(b.className)) return 0;
      return won(($('.dnrb-freeship-text', b) || {}).textContent);
    }
    function snapshot(extra) {
      var o = amounts(); o.m = payMethod(); o.mem = member();
      var g = freeShipGap(); if (g != null) o.fs = g;
      if (extra) for (var k in extra) o[k] = extra[k];
      return o;
    }
    // 들어온 직후는 쿠폰 자동 적용·금액 계산이 진행 중이라 3초 뒤에 한 번
    setTimeout(function () { try { ev('o_view', snapshot()); } catch (e) {} }, 3000);
    // 결제수단 바꿈
    doc.addEventListener('change', function (e) {
      try { if (e.target && e.target.name === 'addr_paymethod' && e.target.checked) ev('o_pm', { m: e.target.value }); } catch (x) {}
    }, { capture: true, passive: true });
    var payClicks = 0;
    doc.addEventListener('click', function (e) {
      try {
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('#btn_payment')) { payClicks++; ev('o_pay', snapshot({ n: payClicks })); flushNow(); return; }
        if (t.closest('.dnrb-freeship-link')) { ev('o_fs_click', { fs: freeShipGap() }); flushNow(); return; }
        if (t.closest('.dnrb-coupon-open, .dnrb-coupon-btn, [data-dnrb-coupon]')) { ev('o_cpn_open', {}); return; }
        if (t.closest('.dnrb-normal-head')) { ev('o_normal_head', {}); return; }
        if (t.closest('.dnrb-guest-link')) { ev('o_guest_login', {}); flushNow(); return; }
      } catch (x) {}
    }, { capture: true, passive: true });
    // 카페24 가 띄우는 경고(필수 입력 누락 등)는 결제 실패 원인을 알려준다: 글자만 앞부분 기록, 동작은 그대로
    try {
      var origAlert = window.alert;
      if (typeof origAlert === 'function' && !origAlert.__dnrb) {
        var wrapped = function (msg) {
          try {
            // 개인정보가 섞이지 않게: 숫자·이메일·영문 단어를 지우고, 카페24 입력 확인 문구 모양일 때만 앞 50자
            var t = String(msg == null ? '' : msg).replace(/\S+@\S+/g, '').replace(/[0-9A-Za-z]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
            if (!/필수|입력|선택|동의|확인|올바|형식|불가|초과|부족|없습니다|주세요|하세요|실패|오류/.test(t)) t = '(기타)';
            ev('o_alert', { t: t }); flushNow();
          } catch (e) {}
          return origAlert.apply(this, arguments);
        };
        wrapped.__dnrb = true;
        window.alert = wrapped;
      }
    } catch (e) {}
  } catch (e) { /* 기록은 실패해도 아무 일 없음 */ }
})();
