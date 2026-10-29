/* =====================================================================
 * 다나로브 주문서 꾸미기 — checkout.js
 * window.DNRB_PAY_CONFIG (config.js) 를 읽어 카페24 원터치 주문서 위에
 * 로고·테마·결제수단 모양/순서·뱃지·혜택문구·무이자할부·안내문구·프로모션·
 * 쿠폰 옵션·오늘배송 타이머를 그린다. 카페24 결제 로직은 건드리지 않는다.
 * ===================================================================== */
(function () {
  'use strict';
  var VER = '2026-10-29.4';
  var cfg = window.DNRB_PAY_CONFIG || {};
  var doc = document;
  var log = function () { if (cfg.debug) try { console.log.apply(console, ['[DNRB]'].concat([].slice.call(arguments))); } catch (e) {} };

  var SIMPLE = { naverpay: 1, kakaopay: 1, tosspay: 1, payco: 1, smilepay: 1, samsungpay: 1, applepay: 1, kpay: 1, paynow: 1, cafe24pay: 1, ssgpay: 1, lpay: 1, chaipay: 1 };
  var LABELS = { card: '신용카드', tcash: '계좌이체', cash: '무통장입금', icash: '가상계좌', cell: '휴대폰 결제', deferpay: '후불결제',
    naverpay: '네이버페이', kakaopay: '카카오페이', tosspay: '토스페이', payco: '페이코', smilepay: '스마일페이', samsungpay: '삼성페이', applepay: '애플페이', kpay: 'K페이', paynow: '페이나우' };

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || doc).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var e = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function safeUrl(u) { try { var p = new URL(String(u || ''), location.href); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch (e) { return ''; } }
  function safeColor(c, fallback) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : fallback; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // 변화 감시: 콜백 안에서 DOM 을 바꿔도 무한 반복되지 않도록 한 박자 뒤에, 한 번에 하나만 실행
  function watch(target, fn, opts) {
    if (!window.MutationObserver || !target) return;
    var t = null, busy = false;
    new MutationObserver(function () {
      if (busy) return;
      clearTimeout(t); t = setTimeout(function () { busy = true; try { fn(); } finally { busy = false; } }, 120);
    }).observe(target, opts || { childList: true, subtree: true, characterData: true });
  }
  function setHtml(node, html) { if (node.innerHTML !== html) node.innerHTML = html; }
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function isGuest() { return !!doc.getElementById('order_password'); }
  function isMobile() { return window.matchMedia('(max-width: 899px)').matches; }
  function methodCode(input) {
    var v = String(input.value || input.id || '').toLowerCase();
    // 카페24 value 예: card, tcash, cash, icash, cell, naverpay, kakaopay, tosspay ... (가끔 'tosspay_card' 처럼 접미어가 붙음)
    var keys = Object.keys(LABELS).concat(Object.keys(SIMPLE));
    for (var i = 0; i < keys.length; i++) if (v === keys[i] || v.indexOf(keys[i] + '_') === 0 || v.indexOf(keys[i]) === 0) return keys[i];
    return v;
  }

  /* 1) 테마 --------------------------------------------------------- */
  function applyTheme() {
    var t = cfg.theme || {};
    var html = doc.documentElement;
    html.classList.add('dnrb');
    if (t.round === false) html.classList.add('dnrb-square');
    var st = html.style;
    if (safeColor(t.mainColor)) st.setProperty('--dnrb-main', t.mainColor);
    if (safeColor(t.subColor)) st.setProperty('--dnrb-sub', t.subColor);
    var lg = cfg.logo || {};
    st.setProperty('--dnrb-logo-h', (parseInt(lg.heightMo, 10) || 24) + 'px');
    st.setProperty('--dnrb-logo-h-pc', (parseInt(lg.heightPc, 10) || 24) + 'px');
    var pm = cfg.paymethod || {};
    html.classList.add('dnrb-pm-' + (pm.mode || 'mixed'));
    if (pm.order === 'normal_first') html.classList.add('dnrb-normal-first');
  }

  /* 2) 로고 --------------------------------------------------------- */
  function renderLogo() {
    var lg = cfg.logo || {};
    var h1 = $('#header h1');
    if (!h1) return;
    var logoUrl = safeUrl(lg.url);
    if (!lg.visible || !logoUrl) return;
    var a = $('a', h1) || h1;
    var name = (a.textContent || '').trim();
    a.innerHTML = '';
    a.appendChild(el('img', { 'class': 'dnrb-logo', src: logoUrl, alt: name || 'logo' }));
  }

  /* 3) 결제수단 모양/순서/뱃지 ------------------------------------------ */
  function renderPaymethods() {
    var area = $('#ec-jigsaw-area-paymethod');
    if (!area) return;
    var labels = $$('.ec-paymethod-newArea .ec-base-label', area);
    if (!labels.length) labels = $$('.ec-base-label', area);
    var badges = (cfg.badges || []).filter(function (b) { return b && b.visible !== false && b.text; });
    var mode = (cfg.paymethod || {}).mode || 'mixed';
    var head = null;

    labels.forEach(function (wrap) {
      var input = $('input[type="radio"]', wrap);
      var label = $('label', wrap);
      if (!input || !label) return;
      var code = methodCode(input);
      wrap.setAttribute('data-dnrb-method', code);
      var simple = !!SIMPLE[code];
      wrap.classList.add(simple ? 'dnrb-simple' : 'dnrb-normal');
      // 라디오 줄 모양: 혼합형의 간편결제, 목록형의 전부
      if ((mode === 'mixed' && simple) || mode === 'list') wrap.classList.add('dnrb-row');

      // 이미지 버튼 → 글자 버튼 (pay_name 속성이 있을 때만)
      var img = $('img', label);
      if (img) {
        var name = img.getAttribute('pay_name') || img.getAttribute('alt') || LABELS[code] || '';
        if (name && !SIMPLE[code]) {
          var span = el('span', { 'class': 'dnrb-paylabel' }, esc(name));
          label.appendChild(span);
          wrap.classList.add('dnrb-textonly');
        }
      } else if (!(label.textContent || '').trim() && LABELS[code]) {
        label.appendChild(el('span', { 'class': 'dnrb-paylabel' }, esc(LABELS[code])));
      }

      // 뱃지
      badges.forEach(function (b) {
        if (String(b.method).toLowerCase() !== code) return;
        var badge = el('span', { 'class': 'dnrb-badge' }, esc(b.text));
        badge.style.setProperty('--badge-color', safeColor(b.color, 'var(--dnrb-main)'));
        wrap.appendChild(badge);
      });

      // 선택 상태 클래스 (카페24가 체크 상태를 스크립트로 바꾸는 경우 대비)
      input.addEventListener('change', syncChecked);
      label.addEventListener('click', function () { setTimeout(syncChecked, 0); });
    });

    // 혼합형: 일반결제 묶음 위에 "일반결제" 라디오 제목 줄
    var normals = labels.filter(function (w) { return w.classList.contains('dnrb-normal'); });
    if (mode === 'mixed' && normals.length && labels.some(function (w) { return w.classList.contains('dnrb-simple'); })) {
      head = el('div', { 'class': 'dnrb-normal-head', role: 'button', tabindex: '0' }, esc((cfg.paymethod || {}).normalTitle || '일반결제'));
      normals[0].parentNode.insertBefore(head, normals[0]);
      var pickNormal = function () {
        var checked = normals.filter(function (w) { var i = $('input[type="radio"]', w); return i && i.checked; })[0];
        if (checked) return;
        var first = $('label', normals[0]); if (first) first.click();
        setTimeout(syncChecked, 0);
      };
      head.addEventListener('click', pickNormal);
      head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickNormal(); } });
    }
    function syncChecked() {
      var anyNormal = false;
      labels.forEach(function (w) {
        var i = $('input[type="radio"]', w); var on = !!(i && i.checked);
        w.classList.toggle('dnrb-checked', on);
        if (on && w.classList.contains('dnrb-normal')) anyNormal = true;
      });
      if (head) head.classList.toggle('dnrb-checked', anyNormal);
    }
    syncChecked();
    area.addEventListener('change', syncChecked);
  }

  /* 4) 결제혜택 문구 ----------------------------------------------------- */
  function renderBenefitMsgs() {
    var msgs = (cfg.benefitMsgs || []).filter(function (m) { return m && m.visible !== false && (m.title || m.body); });
    if (!msgs.length) return;
    var area = $('#ec-jigsaw-area-paymethod .ec-paymethod-newArea') || $('#ec-jigsaw-area-paymethod .segment') || $('#ec-jigsaw-area-paymethod .contents');
    if (!area) return;
    var box = el('div', { 'class': 'dnrb-benefit-msgs' });
    msgs.forEach(function (m) {
      var d = el('div', { 'class': 'dnrb-benefit-msg', 'data-dnrb-method': m.method || 'all' });
      if (m.title) d.appendChild(el('strong', null, esc(m.title)));
      if (m.body) d.appendChild(el('div', null, m.body));
      box.appendChild(d);
    });
    area.appendChild(box);
  }

  /* 5) 무이자 할부 ------------------------------------------------------- */
  function renderInstallment() {
    var ins = cfg.installment || {};
    var items = (ins.items || []).filter(function (i) { return i && i.visible !== false && i.card; });
    if (!ins.visible || !items.length) return;
    var contents = $('#ec-jigsaw-area-paymethod .contents');
    if (!contents) return;
    var box = el('div', { 'class': 'dnrb-installment' });
    var btn = el('button', { type: 'button' }, esc(ins.title || '무이자 할부 안내'));
    var ul = el('ul');
    items.forEach(function (i) {
      ul.appendChild(el('li', null, '<b>' + esc(i.card) + '</b><span>' + esc([i.condition, i.months].filter(Boolean).join(' · ')) + '</span>'));
    });
    btn.addEventListener('click', function () { box.classList.toggle('open'); });
    box.appendChild(btn); box.appendChild(ul);
    contents.appendChild(box);
  }

  /* 6) 안내문구 ---------------------------------------------------------- */
  var AREA_ALIAS = { gift: ['#ec-shop-gift_orderform', '#ec-jigsaw-area-gift'], shippingInfo: ['#ec-jigsaw-area-shippingInfo', '#ec-jigsaw-area-billingNshipping'] };
  function findArea(code) {
    var cands = (AREA_ALIAS[code] || []).concat(['#ec-jigsaw-area-' + code]);
    for (var i = 0; i < cands.length; i++) { var n = $(cands[i]); if (n) return n; }
    return null;
  }
  function renderNotices() {
    var list = (cfg.notices || []).filter(function (n) { return n && n.visible !== false && n.html; });
    list.forEach(function (n) {
      var area = findArea(n.position);
      if (!area) { log('notice area not found', n.position); return; }
      var box = el('div', { 'class': 'dnrb-notice dnrb-notice-inside', 'data-dnrb-pos': n.position }, n.html);
      var fold = area.classList.contains('ec-base-fold') ? area : ($('.ec-base-fold', area) || area);
      fold.appendChild(box);
    });
  }

  /* 7) 프로모션 ---------------------------------------------------------- */
  function renderPromotion() {
    var p = cfg.promotion || {};
    var guest = isGuest();
    var items = (p.type === 'image' ? (p.images || []) : (p.items || [])).filter(function (i) {
      if (!i || i.visible === false) return false;
      var aud = i.audience || 'all';
      if (aud === 'member' && guest) return false;
      if (aud === 'guest' && !guest) return false;
      return p.type === 'image' ? !!i.src : !!(i.title || i.body);
    });
    if (!items.length) return;
    var box = el('div', { 'class': 'dnrb-promo dnrb-pos-' + (p.position || 'default') });
    items.forEach(function (i) {
      var inner;
      if (p.type === 'image') {
        inner = el('img', { 'class': 'dnrb-promo-img', src: safeUrl(i.src), alt: i.alt || '' });
      } else {
        inner = el('div', { 'class': 'dnrb-promo-text' });
        inner.style.setProperty('--promo-color', safeColor(i.color, 'var(--dnrb-main)'));
        if (i.icon) inner.appendChild(el('div', { 'class': 'dnrb-promo-icon' }, /^https?:\/\//.test(i.icon) ? '<img src="' + esc(safeUrl(i.icon)) + '" alt="">' : esc(i.icon)));
        var body = el('div');
        if (i.title) body.appendChild(el('strong', null, esc(i.title)));
        if (i.body) body.appendChild(el('p', null, i.body));
        inner.appendChild(body);
      }
      var href = safeUrl(i.url);
      if (href) { var a = el('a', { href: href }); a.appendChild(inner); box.appendChild(a); }
      else { var d = el('div'); d.appendChild(inner); box.appendChild(d); }
    });
    var order = $('#mCafe24Order');
    if (!order) return;
    var pos = p.position || 'default';
    if (pos === 'top') order.insertBefore(box, order.firstElementChild);
    else if (pos === 'bottom') { var side = $('.dnrb-side') || order; var fix = $('#orderFixItem'); if (fix && fix.parentNode === side) side.insertBefore(box, fix); else side.appendChild(box); }
    else { var pm = $('#ec-jigsaw-area-paymethod'); if (pm) pm.parentNode.insertBefore(box, pm); else order.appendChild(box); }
  }

  /* 8) 쿠폰/적립금 ------------------------------------------------------- */
  function parseWon(t) { var m = String(t || '').replace(/,/g, '').match(/-?\d+/); return m ? Math.abs(parseInt(m[0], 10)) : 0; }
  function fmtWon(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function couponAutoOn() {
    var c = cfg.coupon || {};
    if (!c.autoSelect) return false;
    try { if (localStorage.getItem('dnrb-coupon-auto') === 'off') return false; } catch (e) {}
    if (/[?&]dnrb_auto=off/.test(location.search)) return false;
    return true;
  }
  // 쿠폰 줄을 "쿠폰 최대 혜택가 적용" 패널로 바꾼다 (카페24 원래 줄은 숨긴 채 값만 읽는다)
  function renderCouponPanel(discount) {
    var rows = $$('.discountDetail', discount).filter(function (d) { var h = $('.heading', d); return h && /쿠폰/.test(h.textContent); });
    if (!rows.length) return;
    var c = cfg.coupon || {};
    var panel = el('div', { 'class': 'dnrb-coupon' });
    var head = el('div', { 'class': 'dnrb-coupon-head' });
    head.appendChild(el('span', null, esc(c.panelTitle || '쿠폰 최대 혜택가 적용')));
    var sw = el('label', { 'class': 'dnrb-switch' });
    var swInput = el('input', { type: 'checkbox' }); swInput.checked = couponAutoOn();
    sw.appendChild(swInput); sw.appendChild(el('span'));
    if (c.autoSelect) head.appendChild(sw);
    var body = el('div', { 'class': 'dnrb-coupon-body' });
    var applied = el('div', { 'class': 'dnrb-coupon-applied' });
    var amount = el('div', { 'class': 'dnrb-coupon-amount' });
    var btn = el('button', { type: 'button', 'class': 'dnrb-coupon-btn' });
    body.appendChild(applied); body.appendChild(amount); body.appendChild(btn);
    panel.appendChild(head); panel.appendChild(body);
    rows[0].parentNode.insertBefore(panel, rows[0]);
    rows.forEach(function (r) { r.classList.add('dnrb-coupon-src'); });

    function visibleRow() { return rows.filter(function (r) { return !r.classList.contains('displaynone'); })[0] || rows[0]; }
    function srcButton() { var r = visibleRow(); return $('#btn_coupon_select', r) || $('a.btnNormal, button', r); }
    function readState() {
      var r = visibleRow();
      var own = 0, m = (r.textContent || '').match(/보유\s*쿠폰?\s*([\d,]+)\s*[개장]/);
      if (m) own = parseInt(m[1].replace(/,/g, ''), 10) || 0;
      var ac = $('#appliedCouponCount'); var used = ac ? parseWon(ac.textContent) : 0;
      var od = window.CAFE24 && window.CAFE24.SHOP_FRONT_ORDERFORM_DATA && window.CAFE24.SHOP_FRONT_ORDERFORM_DATA.coupon;
      if (od) used = [od.sUsedOrderCoupon, od.sUsedProductCoupon].filter(Boolean).join('|').split('|').filter(Boolean).length;
      if (panel._ownOverride != null) own = panel._ownOverride;
      var amt = 0;
      var a1 = $('#mProductCouponDiscount'), a2 = $('#mDeliveryCouponDiscount');
      if (a1 || a2) amt = parseWon(a1 && a1.textContent) + parseWon(a2 && a2.textContent);
      else { var te = $('.control .txtEm', r); amt = parseWon(te && te.textContent); }
      var list = $('#coupon_use_list, [id*="coupon_use_list"]', discount);
      if (!ac && !od && list) used = $$('li', list).filter(function (li) { return li.offsetParent; }).length;
      if (!ac && !od && !list && amt > 0 && !used) used = 1;
      return { own: own, used: used, amount: amt };
    }
    function paint() {
      var st = readState();
      panel.classList.toggle('dnrb-none', st.own === 0);
      setHtml(applied, '<span>🏷️</span><span>지금 적용된 쿠폰 <b>' + st.used + '장</b></span>');
      setText(amount, '-' + fmtWon(st.amount) + '원');
      setHtml(btn, '<span>할인 쿠폰</span><span class="dnrb-coupon-own">보유 <b>' + st.own + '장</b></span>' +
        (st.own > 0 && st.used === 0 ? '<span class="dnrb-coupon-tip">사용 가능한 쿠폰이 있어요!</span>' : ''));
      panel._state = st;
    }
    btn.addEventListener('click', function () { var b = srcButton(); if (b) b.click(); else window.dnrbToast && window.dnrbToast('사용할 수 있는 쿠폰이 없어요'); });
    swInput.addEventListener('change', function () {
      try { localStorage.setItem('dnrb-coupon-auto', swInput.checked ? 'on' : 'off'); } catch (e) {}
      if (swInput.checked) { try { sessionStorage.removeItem('dnrb-coupon-auto-tried:' + location.pathname + location.search); } catch (e) {} autoApplyCoupon(panel); }
    });
    panel._paint = paint;
    paint();
    watch(discount, paint, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    return panel;
  }
  /* 쿠폰 창 제어 (카페24 /coupon/coupon_select.html 을 숨은 iframe 에 띄워 카페24 자체 계산·적용 함수를 그대로 쓴다)
   * - 2026-10-29 다나로브 실제 주문서에서 검증: 6,000/5,000/3,000원 쿠폰 중 6,000원을 골라 적용.
   * - 주문서 데이터(CAFE24.SHOP_FRONT_ORDERFORM_DATA)가 없는 화면(미리보기·비회원)에서는 아무것도 하지 않는다. */
  var couponCore = {
    hasOrderData: function () { return !!(window.CAFE24 && window.CAFE24.SHOP_FRONT_ORDERFORM_DATA && window.EC$); },
    fetchHtml: function () {
      var fd = new URLSearchParams();
      var o = window.CAFE24.SHOP_FRONT_ORDERFORM_DATA;
      if (o.paymethod && o.paymethod.sSelectedPaymethod) fd.set('addr_paymethod', o.paymethod.sSelectedPaymethod);
      if (o.shipping && o.shipping.sDelvType === 'B') fd.set('delvtype', 'B');
      return fetch('/coupon/coupon_select.html', { method: 'POST', body: fd, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin' }).then(function (r) { return r.text(); });
    },
    // 사용 가능한 쿠폰 수만 센다 (iframe 없이 HTML 만 읽음)
    countAvailable: function () {
      if (!this.hasOrderData()) return Promise.resolve(null);
      return this.fetchHtml().then(function (html) {
        var d = new DOMParser().parseFromString(html, 'text/html');
        var seen = {};
        $$('select[name="cpnOrdSelect"] option, select[name="cpnPrdSelect"] option', d).forEach(function (o) {
          if (o.value && !o.disabled && o.getAttribute('idx') !== '0') seen[o.value] = 1;
        });
        return Object.keys(seen).length;
      }).catch(function () { return null; });
    },
    openHidden: function () {
      var self = this;
      return this.fetchHtml().then(function (html) {
        var f = el('iframe', { 'aria-hidden': 'true', name: 'dnrb_coupon_hidden', style: 'position:fixed;width:1px;height:1px;left:-9999px;top:0;opacity:0;pointer-events:none' });
        doc.body.appendChild(f);
        var w = f.contentWindow;
        try { w.opener = window; } catch (e) {}
        w.alert = function (m) { w.__dnrbAlert = m; };
        w.confirm = function () { return true; };
        w.close = function () {};
        w.document.open(); w.document.write(html); w.document.close();
        return new Promise(function (resolve, reject) {
          var t0 = Date.now();
          (function wait() {
            if (w.couponSelect && w.couponSelect.chkCpnSelect && w.EC$) return setTimeout(function () { resolve({ frame: f, win: w }); }, 300);
            if (Date.now() - t0 > 8000) { f.remove(); return reject(new Error('coupon window not ready')); }
            setTimeout(wait, 100);
          })();
        });
      });
    },
    discountOf: function (w) {
      return (parseFloat(w.EC$('#totalSalePrice').val()) || 0) + (parseFloat(w.EC$('#totalShipPrice').val()) || 0);
    },
    // 슬롯(선택 상자)마다 할인 합계가 가장 많이 늘어나는 쿠폰을 차례로 고른다
    pickBest: function (w) {
      var self = this;
      var selects = $$('select[name="cpnOrdSelect"], select[name="cpnPrdSelect"]', w.document);
      var chosen = [], total = 0;
      selects.forEach(function (sel) {
        var bestOpt = null, bestVal = total;
        [].slice.call(sel.options).forEach(function (opt) {
          if (!opt.value || opt.disabled || opt.hidden || opt.getAttribute('idx') === '0') return;
          if (chosen.some(function (c) { return c.value === opt.value; })) return;
          sel.value = opt.value; w.__dnrbAlert = null;
          try { w.couponSelect.chkCpnSelect(sel); } catch (e) {}
          var v = (sel.value === opt.value && !w.__dnrbAlert) ? self.discountOf(w) : -1;
          if (v > bestVal) { bestVal = v; bestOpt = opt; }
        });
        sel.value = bestOpt ? bestOpt.value : ''; w.__dnrbAlert = null;
        try { w.couponSelect.chkCpnSelect(sel); } catch (e) {}
        if (bestOpt) { chosen.push({ value: bestOpt.value, name: bestOpt.text }); total = bestVal; }
      });
      return { chosen: chosen, total: total };
    },
    applyBest: function () {
      var self = this;
      if (!this.hasOrderData()) return Promise.resolve(null);
      return this.openHidden().then(function (h) {
        var r = null;
        try { r = self.pickBest(h.win); if (r.chosen.length) h.win.couponSelect.setCpnResult('auto'); }
        finally { setTimeout(function () { h.frame.remove(); }, 1500); }
        return r;
      });
    }
  };
  window.dnrbCouponCore = couponCore;

  // 최대 혜택 쿠폰 자동 적용: 보유 쿠폰이 있고 아직 하나도 안 썼을 때 한 번만
  function autoApplyCoupon(panel) {
    if (!couponAutoOn() || !panel || !panel._state || !couponCore.hasOrderData()) return;
    var st = panel._state;
    if (!(st.own > 0 && st.used === 0)) return;
    var key = 'dnrb-coupon-auto-tried:' + location.pathname + location.search;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
    couponCore.applyBest().then(function (r) {
      if (r && r.chosen.length) { log('coupon auto-applied', r); if (window.dnrbToast) window.dnrbToast('가장 할인이 큰 쿠폰을 적용했어요'); }
    }).catch(function (e) { log('coupon auto failed', e); });
  }
  function renderCoupon() {
    var c = cfg.coupon || {};
    var discount = $('#ec-jigsaw-area-discount');
    if (!discount) return;
    // 쿠폰 0개여도 영역 노출
    if (c.showNoCoupon) {
      $$('.discountDetail', discount).forEach(function (d) {
        var heading = $('.heading', d);
        if (heading && /쿠폰/.test(heading.textContent) && d.classList.contains('displaynone')) {
          d.classList.remove('displaynone');
          d.classList.add('dnrb-nocoupon');
        }
      });
      discount.classList.remove('displaynone');
    }
    // 적립금 제목 바꾸기
    var pt = (cfg.points || {}).title;
    if (pt) { var h = $('#ec-jigsaw-title-benefit h2'); if (h) h.textContent = pt; }
    // 쿠폰 안내문구 (쿠폰 영역 아래)
    var cw = cfg.couponWindow || {};
    if (cw.showNotices && (cw.notices || []).length && c.showCouponNoticeOnForm) {
      var ul = el('ul', { 'class': 'ec-base-help dnrb-coupon-notice' });
      cw.notices.filter(Boolean).forEach(function (t) { ul.appendChild(el('li', null, esc(t))); });
      var cd = $$('.discountDetail', discount).filter(function (d) { var h = $('.heading', d); return h && /쿠폰/.test(h.textContent) && !d.classList.contains('displaynone'); })[0];
      if (cd) cd.appendChild(ul);
    }
    // 자동할인 줄 모양
    $$('.discountDetail', discount).forEach(function (d) { var h = $('.heading', d); if (h && /자동\s*할인/.test(h.textContent)) { d.classList.add('dnrb-auto'); d.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) return; var a = $('a.ec-jigsaw-eLayer, a.btnNormal', d); if (a) a.click(); }); } });
    var panel = renderCouponPanel(discount);
    if (panel && couponCore.hasOrderData()) {
      // 실제 사용 가능한 쿠폰 수로 "보유 N장" 보정 후 자동 적용
      couponCore.countAvailable().then(function (n) {
        if (n != null) { panel._ownOverride = n; panel._paint(); }
        if (c.autoSelect) setTimeout(function () { autoApplyCoupon(panel); }, 300);
      });
    }
  }

  /* 9) 오늘배송 타이머 ---------------------------------------------------- */
  function renderTimer() {
    var t = cfg.deliveryTimer || {};
    if (!t.visible || !t.cutoff) return;
    var order = $('#mCafe24Order'); if (!order) return;
    var box = el('div', { 'class': 'dnrb-timer' });
    box.style.setProperty('--timer-color', safeColor(t.accentColor, '#F51A1A'));
    order.insertBefore(box, order.firstElementChild);
    var holidays = (t.holidays || []).map(String);
    var weekly = t.weeklyOff || [0, 6]; // 일(0), 토(6)
    var DAY = ['일', '월', '화', '수', '목', '금', '토'];
    function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function isOff(d) { return weekly.indexOf(d.getDay()) >= 0 || holidays.indexOf(ymd(d)) >= 0; }
    function nextShip(from) { var d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); for (var i = 0; i < 60 && isOff(d); i++) d.setDate(d.getDate() + 1); return d; }
    function pad(n) { return ('0' + n).slice(-2); }
    function tick() {
      var now = new Date();
      var hm = String(t.cutoff).split(':');
      var cut = new Date(now); cut.setHours(parseInt(hm[0], 10) || 0, parseInt(hm[1], 10) || 0, 0, 0);
      if (!isOff(now) && now < cut) {
        var s = Math.floor((cut - now) / 1000);
        var timeStr = '<b>' + pad(Math.floor(s / 3600)) + '시간 ' + pad(Math.floor(s % 3600 / 60)) + '분 ' + pad(s % 60) + '초</b>';
        setHtml(box, '<span>📦</span><span>' + String(t.text || '{time} 안에 결제하면 <b>오늘 출발</b>해요').replace('{time}', timeStr) + '</span>');
      } else if (t.showNextDay !== false) {
        var n = nextShip(now);
        var dateStr = (n.getMonth() + 1) + '/' + n.getDate() + '(' + DAY[n.getDay()] + ')';
        setHtml(box, '<span>📦</span><span>' + String(t.textAfter || '지금 주문하면 <b>{date}</b> 출발해요').replace('{date}', dateStr) + '</span>');
      } else { box.style.display = 'none'; return; }
      setTimeout(tick, 1000);
    }
    tick();
  }

  /* 9.1) 할인코드 입력칸 접기: "할인코드가 있어요" 링크를 누르면 펼침 ---------- */
  function collapseDiscountCode() {
    var dc = cfg.discountCode || {};
    if (!dc.collapse) return;
    var discount = $('#ec-jigsaw-area-discount'); if (!discount) return;
    var rows = $$('.discountDetail', discount).filter(function (d) {
      return $('input[name="ec_discountcode"], #ec_discountcode', d) && !$('#ec_discountcode_clear', d);
    });
    rows.forEach(function (row) {
      if (row.classList.contains('displaynone')) return;
      // 이미 코드가 적용된 상태(초기화 버튼이 보이는 줄)는 접지 않는다
      var applied = $$('.discountDetail', discount).some(function (d) { var c = $('#ec_discountcode_clear', d); return c && !d.classList.contains('displaynone'); });
      if (applied) return;
      var link = el('button', { type: 'button', 'class': 'dnrb-dc-toggle' }, esc(dc.linkText || '할인코드가 있어요') + ' <span>›</span>');
      row.classList.add('dnrb-dc-collapsed');
      row.parentNode.insertBefore(link, row);
      link.addEventListener('click', function () {
        row.classList.remove('dnrb-dc-collapsed'); link.remove();
        var inp = $('input[name="ec_discountcode"]', row); if (inp) inp.focus();
      });
    });
  }

  /* 9.2) 적립 요약: 결제 금액 아래 "이번 주문으로 N원 적립 예정" ---------- */
  function renderPointsSummary() {
    var pt = cfg.points || {};
    if (!pt.summary) return;
    var benefit = $('#ec-jigsaw-area-benefit'); var pay = $('#ec-jigsaw-area-payment');
    if (!benefit || !pay) return;
    var line = el('div', { 'class': 'dnrb-points-summary' });
    var total = $('.totalPay', pay) || $('.contents', pay);
    if (!total) return;
    total.parentNode.insertBefore(line, total.nextSibling);
    function paint() {
      var src = $('#ec-jigsaw-title-benefit .txtStrong, #ec-jigsaw-heading-benefit', benefit) || $('.totalPay .txtEm', benefit);
      var amt = src ? parseWon(src.textContent) : 0;
      var hidden = benefit.classList.contains('displaynone') || benefit.offsetParent === null;
      if (!amt || hidden) { line.style.display = 'none'; return; }
      setHtml(line, '<span>🪙</span><span>' + esc(String(pt.summaryText || '이번 주문으로 {amount} 적립 예정').replace('{amount}', fmtWon(amt) + '원')) + '</span>');
      line.style.display = '';
    }
    paint();
    watch(benefit, paint, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  /* 9.25) 비회원 로그인 유도: 비회원 주문서 맨 위 ---------- */
  function renderGuestNudge() {
    var g = cfg.guestNudge || {};
    if (!g.visible || !isGuest()) return;
    var order = $('#mCafe24Order'); if (!order) return;
    var ret = encodeURIComponent(location.pathname + location.search);
    var box = el('div', { 'class': 'dnrb-guest' });
    var body = el('div', { 'class': 'dnrb-guest-body' });
    if (g.title) body.appendChild(el('strong', null, esc(g.title)));
    if (g.body) body.appendChild(el('p', null, esc(g.body)));
    box.appendChild(el('div', { 'class': 'dnrb-guest-icon' }, '🔑'));
    box.appendChild(body);
    box.appendChild(el('a', { 'class': 'dnrb-guest-link', href: '/member/login.html?returnUrl=' + ret }, esc(g.linkText || '로그인하고 주문하기')));
    var first = $('.dnrb-timer', order);
    order.insertBefore(box, first ? first.nextSibling : order.firstElementChild);
  }

  /* 9.3) 무료배송 안내: "X원만 더 담으면 배송비 무료" / "무료배송 적용됨" ---------- */
  function renderFreeShipping() {
    var fs = cfg.freeShipping || {};
    var threshold = parseInt(fs.threshold, 10) || 0;
    if (!fs.visible || !threshold) return;
    var pay = $('#ec-jigsaw-area-payment'); var order = $('#mCafe24Order');
    if (!pay || !order) return;
    var box = el('div', { 'class': 'dnrb-freeship', role: 'status' });
    var after = $('#ec-jigsaw-area-orderProduct') || $('#ec-jigsaw-area-discount');
    if (after && after.parentNode === order) order.insertBefore(box, after.nextSibling); else order.insertBefore(box, pay);
    function rowAmount(re) {
      var rows = $$('tr', pay).filter(function (tr) { var th = $('th', tr); return th && re.test(th.textContent); });
      return rows.length ? parseWon($('td', rows[0]).textContent) : null;
    }
    function paint() {
      var product = rowAmount(/주문\s*상품|상품\s*금액/);
      if (product == null) { box.style.display = 'none'; return; }
      var discount = rowAmount(/할인\s*\/?\s*부가결제|할인/) || 0;
      var fee = rowAmount(/^\s*배송비/);
      var base = fs.basis === 'product' ? product : Math.max(0, product - discount);
      var gap = threshold - base;
      if (gap <= 0 || fee === 0) {
        if (!fs.doneText) { box.style.display = 'none'; return; }
        box.className = 'dnrb-freeship dnrb-freeship-done';
        setHtml(box, '<span class="dnrb-freeship-icon">✓</span><span>' + esc(fs.doneText) + '</span>');
        box.style.display = '';
        return;
      }
      var gapUnder = parseInt(fs.gapUnder, 10) || 0;
      if (gapUnder && gap > gapUnder) { box.style.display = 'none'; return; }
      var feeText = fee != null && fee > 0 ? fmtWon(fee) + '원' : '배송비';
      var text = esc(String(fs.text || '{gap}원만 더 담으면 배송비 {fee}이 무료예요').replace('{gap}', fmtWon(gap)).replace('{fee}', feeText).replace('{threshold}', fmtWon(threshold)));
      box.className = 'dnrb-freeship';
      setHtml(box, '<span class="dnrb-freeship-icon">🚚</span><span class="dnrb-freeship-text">' + text + '</span>' +
        (fs.linkToCart !== false ? '<a class="dnrb-freeship-link" href="/order/basket.html">' + esc(fs.linkText || '장바구니') + ' ›</a>' : ''));
      box.style.display = '';
    }
    paint();
    watch(pay, paint);
  }

  /* 9.5) 이용약관 동의: 제목 붙이고 "내용보기" → "자세히" --------------------- */
  function styleAgreement() {
    var area = $('#ec-jigsaw-area-agreement');
    if (!area) return;
    if (!$('.title', area) && !area.classList.contains('ec-base-fold')) {
      var t = el('div', { 'class': 'title' }); t.appendChild(el('h2', null, '이용약관동의'));
      area.insertBefore(t, area.firstChild);
    }
    $$('.agree .btnAgree, .agree .btnNormal', area).forEach(function (b) {
      if (/내용보기|보기|자세히/.test(b.textContent)) b.textContent = '자세히';
    });
  }

  /* 10) PC 2단 배치용 묶음 ------------------------------------------------ */
  function wrapSide() {
    var order = $('#mCafe24Order'); if (!order) return;
    var pay = $('#ec-jigsaw-area-payment'), agree = $('#ec-jigsaw-area-agreement'), fix = $('#orderFixItem');
    if (!pay || !fix) return;
    var side = el('div', { 'class': 'dnrb-side' });
    var anchor = $('#ec-jigsaw-area-benefit') || $('#ec-jigsaw-area-paymethod');
    if (anchor && anchor.parentNode === order) order.insertBefore(side, anchor.nextSibling); else order.appendChild(side);
    side.appendChild(pay); if (agree) side.appendChild(agree); side.appendChild(fix);
  }

  /* 11) 토스트 ----------------------------------------------------------- */
  window.dnrbToast = function (msg, ms) {
    var t = $('.dnrb-toast') || doc.body.appendChild(el('div', { 'class': 'dnrb-toast' }));
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  };

  function init() {
    try { applyTheme(); } catch (e) { log(e); }
    var steps = [renderLogo, styleAgreement, wrapSide, renderPaymethods, renderBenefitMsgs, renderInstallment, renderNotices, renderPromotion, renderCoupon, collapseDiscountCode, renderPointsSummary, renderFreeShipping, renderTimer, renderGuestNudge];
    steps.forEach(function (fn) { try { fn(); } catch (e) { log(fn.name, e); } });
    doc.documentElement.classList.add('dnrb-ready');
    log('ready', VER);
  }
  applyTheme(); // 깜빡임 방지: 색/모드 클래스는 가능한 한 빨리
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  window.DNRB_PAY = { version: VER, config: cfg, rerender: init };
})();
