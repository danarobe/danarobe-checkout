/* =====================================================================
 * 다나로브 장바구니 꾸미기 — basket.js
 * window.DNRB_PAY_CONFIG (config.js) 의 basket 설정을 읽어 카페24 장바구니 위에
 * 전체 선택 · 금액이 보이는 주문 버튼 하나 · 무료배송 막대(+채우기 추천) · 비회원 혜택 안내를 그린다.
 * 주문·수량·삭제·합계 계산은 전부 카페24 그대로 (우리는 카페24 버튼을 대신 눌러줄 뿐).
 * ===================================================================== */
(function () {
  'use strict';
  var VER = '2026-11-11.4';
  var cfg = window.DNRB_PAY_CONFIG || {};
  var bc = cfg.basket || {};
  if (cfg.enabled === false || bc.enabled === false) return;
  var doc = document;
  var log = function () { if (cfg.debug) try { console.log.apply(console, ['[DNRB basket]'].concat([].slice.call(arguments))); } catch (e) {} };

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || doc).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var e = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : ''; }
  function parseWon(t) { var m = String(t || '').replace(/,/g, '').match(/-?\d+/); return m ? Math.abs(parseInt(m[0], 10)) : 0; }
  function fmtWon(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fill(t, map) { return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  // 문구에서 굵게(<b>)만 허용
  function boldOnly(t) { return esc(String(t || '')).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>'); }
  // 변화 감시: 콜백 안에서 DOM 을 바꿔도 무한 반복되지 않도록 한 박자 뒤에, 한 번에 하나만 실행 (checkout.js 와 같은 방식)
  function watch(target, fn, opts) {
    if (!window.MutationObserver || !target) return;
    var t = null, busy = false;
    new MutationObserver(function () {
      if (busy) return;
      clearTimeout(t); t = setTimeout(function () { busy = true; try { fn(); } finally { busy = false; } }, 120);
    }).observe(target, opts || { childList: true, subtree: true, characterData: true });
  }
  function setHtml(node, html) { if (node.innerHTML !== html) node.innerHTML = html; }
  // 테스트 스킨(/skin-skin15/...) 에서 열면 링크도 그 스킨 안에서 움직이도록 앞부분을 붙인다
  var PREFIX = (location.pathname.match(/^\/skin-[^/]+/) || [''])[0];

  /* 카페24 장바구니 값 읽기 ---------------------------------------------- */
  function boxes() { return $$('input[id^="basket_chk_id_"]'); }
  function checkedBoxes() { return boxes().filter(function (c) { return c.checked; }); }
  function summary() {
    var s = $('.xans-order-totalsummary');
    if (!s) return null;
    function byTitle(re) {
      var h = $$('.title, h4, th', s).filter(function (n) { return re.test(n.textContent); })[0];
      if (!h) return null;
      var box = h.closest('.heading, tr, .totalSummary__item, .total') || h.parentNode;
      var st = $('.data strong, td strong, strong', box);
      return st ? parseWon(st.textContent) : null;
    }
    var product = (function () { var n = $('.total_product_price_display_front', s); return n ? parseWon(n.textContent) : byTitle(/총\s*상품금액/); })();
    var fee = (function () { var n = $('.total_delv_price_front', s); return n ? parseWon(n.textContent) : byTitle(/총\s*배송비/); })();
    var discArea = $('#total_benefit_price_title_area', s);
    var discount = discArea && !discArea.classList.contains('displaynone') ? parseWon(($('#total_product_discount_price_front', s) || {}).textContent) : 0;
    var pay = byTitle(/결제\s*예정\s*금액/);
    if (pay == null && product != null) pay = Math.max(0, product - discount) + (fee || 0);
    return { product: product, fee: fee, discount: discount, pay: pay };
  }
  function isMember() { return !!$('a[href*="logout"], a[href*="Logout"]'); }

  /* 1) 들어오면 상품 전체 선택 ------------------------------------------ */
  // 카페24 "전체선택" 링크를 한 번 눌러 체크와 합계 재계산을 카페24가 하게 한다 (상품마다 누르면 계산 요청이 상품 수만큼 생김)
  // 우리 스크립트는 카페24 장바구니 스크립트가 버튼에 기능을 붙이기 전에 실행되므로, 기능이 붙는 순간(보통 DOMContentLoaded 직후)을 기다렸다 누른다.
  // 광고·추적 스크립트까지 끝나는 load 를 기다리면 느린 인터넷에서 몇 초씩 늦어진다.
  function noneChecked() { var bs = boxes(); return bs.length && !bs.some(function (c) { return c.checked; }); }
  function selectAllBtn() { return $('#product_select_all') || $$('a, button').filter(function (a) { return /^\s*전체선택\s*$/.test(a.textContent); })[0]; }
  function cafeBound(a) {
    var jq = window.EC$ || window.jQuery;
    try { var ev = jq && jq._data && jq._data(a, 'events'); return !!(ev && ev.click); } catch (e) { return false; }
  }
  function selectAllOnLoad() {
    if (bc.selectAll === false) return;
    var done = false, tries = 0;
    function go() {
      if (done) return; done = true;
      if (!noneChecked()) return;
      var all = selectAllBtn();
      if (all) all.click();
      // "전체선택" 이 안 먹었으면 상자를 하나씩 누른다
      setTimeout(function () { if (noneChecked()) boxes().forEach(function (c) { c.click(); }); paint(); }, 1200);
      log('selected all', boxes().length);
    }
    (function wait() {
      var all = selectAllBtn();
      if (all && cafeBound(all)) return go();
      if (++tries > 50) return go(); // 약 7초
      setTimeout(wait, 150);
    })();
    window.addEventListener('load', function () { setTimeout(go, 300); });
  }

  /* 2) 주문 버튼 하나: "59,000원 주문하기" --------------------------------- */
  // 전부 선택이면 카페24 "전체상품주문", 일부만이면 "선택상품주문" 을 대신 누른다
  function cafeOrderLink(kind) {
    var re = kind === 'all' ? /orderAll\(/ : /orderSelectBasket\(/;
    return $$('#orderFixItem a[onclick], #orderFixArea a[onclick]').filter(function (a) { return re.test(a.getAttribute('onclick')); })[0];
  }
  function order() {
    var all = boxes(), on = checkedBoxes();
    if (!on.length) { alert((bc.orderBar || {}).noneText || '주문할 상품을 선택해 주세요.'); return; }
    var link = cafeOrderLink(on.length === all.length ? 'all' : 'select') || cafeOrderLink('all');
    if (link) link.click();
  }
  var bars = [];
  function buildOrderButtons() {
    var ob = bc.orderBar || {};
    if (ob.visible === false || !boxes().length) return;
    // 휴대폰·태블릿: 화면 아래 고정 바 (카페24 #orderFixArea 안에 넣어 보이는 크기 기준을 그대로 따른다)
    var fixArea = $('#orderFixArea');
    if (fixArea) {
      var bar = el('div', { 'class': 'dnrb-bbar' },
        '<div class="dnrb-bbar-info"><span class="dnrb-bbar-label"></span><span class="dnrb-bbar-ship"></span></div>' +
        '<button type="button" class="dnrb-bbar-btn"></button>');
      fixArea.appendChild(bar);
      bars.push(bar);
    }
    // 금액 상자 아래 버튼 (PC 오른쪽, 휴대폰은 금액 바로 아래)
    var fixItem = $('#orderFixItem');
    if (fixItem) {
      var inline = el('div', { 'class': 'dnrb-bbar dnrb-bbar-inline' }, '<button type="button" class="dnrb-bbar-btn"></button><span class="dnrb-bbar-ship"></span>');
      fixItem.insertBefore(inline, fixItem.firstChild);
      bars.push(inline);
    }
    bars.forEach(function (b) { $('.dnrb-bbar-btn', b).addEventListener('click', order); });
    doc.documentElement.classList.add('dnrb-bbar-on');
  }
  function paintOrderButtons(sum, ship) {
    if (!bars.length) return;
    var ob = bc.orderBar || {};
    var all = boxes().length, on = checkedBoxes().length;
    var amount = sum && sum.pay != null ? fmtWon(sum.pay) : '';
    var label = on === all ? fill(ob.allLabel || '전체 {count}개', { count: all }) : fill(ob.selectLabel || '선택 {count}개', { count: on });
    var btnText = !on ? (ob.noneButton || '상품을 선택해 주세요') : fill(ob.text || '{amount}원 주문하기', { amount: amount, count: on });
    bars.forEach(function (b) {
      var btn = $('.dnrb-bbar-btn', b); if (btn.textContent !== btnText) btn.textContent = btnText;
      btn.disabled = !on;
      var lb = $('.dnrb-bbar-label', b); if (lb && lb.textContent !== label) lb.textContent = label;
      var sp = $('.dnrb-bbar-ship', b); if (sp) setHtml(sp, ship || '');
    });
  }

  /* 3) 무료배송 막대 + 채우기 추천 -------------------------------------- */
  var shipBox = null, recoBox = null;
  function freeShipState(sum) {
    var fs = cfg.freeShipping || {}, sb = bc.freeShipBar || {};
    var threshold = parseInt(fs.threshold, 10) || 0;
    if (sb.visible === false || !threshold || !sum || sum.product == null || !checkedBoxes().length) return null;
    var base = fs.basis === 'product' ? sum.product : Math.max(0, sum.product - (sum.discount || 0));
    var gap = threshold - base;
    return { threshold: threshold, base: base, gap: gap, done: gap <= 0 || sum.fee === 0, fee: sum.fee };
  }
  function buildShipBox() {
    var sb = bc.freeShipBar || {};
    if (sb.visible === false || !boxes().length) return;
    var list = $('.xans-order-normtitle') || $('.xans-order-normnormal') || $('.xans-order-list');
    if (!list || !list.parentNode) return;
    shipBox = el('div', { 'class': 'dnrb-ship', role: 'status' });
    list.parentNode.insertBefore(shipBox, list);
    var c = safeColor(sb.color); if (c) shipBox.style.setProperty('--dnrb-ship-color', c);
  }
  function paintShip(st) {
    if (!shipBox) return '';
    var sb = bc.freeShipBar || {};
    if (!st) { shipBox.style.display = 'none'; return ''; }
    shipBox.style.display = '';
    var pct = Math.max(4, Math.min(100, Math.round(st.base / st.threshold * 100)));
    var map = { gap: fmtWon(Math.max(0, st.gap)), threshold: fmtWon(st.threshold), fee: st.fee ? fmtWon(st.fee) + '원' : '배송비' };
    var text = st.done ? boldOnly(fill(sb.doneText || '무료배송 조건을 채웠어요', map)) : boldOnly(fill(sb.text || '<b>{gap}원</b>만 더 담으면 <b>무료배송</b>', map));
    shipBox.className = 'dnrb-ship' + (st.done ? ' dnrb-ship-done' : '');
    setHtml($('.dnrb-ship-head', shipBox) || shipBox.appendChild(el('div', { 'class': 'dnrb-ship-head' })), '<span class="dnrb-ship-icon">' + (st.done ? '✓' : '🚚') + '</span><span class="dnrb-ship-text">' + text + '</span>');
    var track = $('.dnrb-ship-track', shipBox) || shipBox.appendChild(el('div', { 'class': 'dnrb-ship-track' }, '<i></i>'));
    track.firstChild.style.width = (st.done ? 100 : pct) + '%';
    if (!recoBox) { recoBox = el('div', { 'class': 'dnrb-reco' }); shipBox.appendChild(recoBox); }
    // 주문 버튼 옆 작은 안내
    return st.done ? esc(sb.barDoneText || '무료배송') : esc(fill(sb.barText || '무료배송까지 {gap}원', map));
  }

  // 추천: 지정 카테고리 목록에서 부족액을 채울 수 있는 값싼 상품부터 (장바구니에 이미 있는 상품 제외)
  var recoCache = null, recoGap = null;
  function loadRecoItems() {
    var r = bc.recommend || {};
    var cate = parseInt(r.cateNo, 10);
    if (!cate) return Promise.resolve([]);
    if (recoCache) return recoCache;
    var key = 'dnrb-basket-reco:' + cate;
    try {
      var saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (saved && Date.now() - saved.at < 30 * 60 * 1000) return (recoCache = Promise.resolve(saved.items));
    } catch (e) {}
    recoCache = fetch(PREFIX + '/product/list.html?cate_no=' + cate + '&sort_method=3', { credentials: 'same-origin' }).then(function (res) { return res.text(); }).then(function (html) {
      var d = new DOMParser().parseFromString(html, 'text/html');
      var seen = {}, items = [];
      $$('[id^="anchorBoxId_"]', d).forEach(function (li) {
        var no = parseInt(li.id.replace('anchorBoxId_', ''), 10);
        if (!no || seen[no]) return; seen[no] = 1;
        var a = $('.name a', li) || $('a[href*="/product/"]', li);
        var img = $('img[id^="eListPrdImage"]', li) || $('.prdImg img', li);
        // 가격: "할인판매가" 가 있으면 그것, 없으면 "판매가"
        var price = 0, sale = 0;
        $$('li', li).forEach(function (row) {
          var t = $('.title', row); if (!t) return;
          var label = t.textContent.replace(/\s+/g, '');
          var val = parseWon(row.textContent.replace(t.textContent, ''));
          if (/할인판매가/.test(label)) sale = val; else if (/^판매가/.test(label)) price = val;
        });
        if ($('img[alt="품절"], img[src*="soldout"]', li)) return;
        var p = sale || price;
        if (!a || !p) return;
        items.push({ no: no, name: a.textContent.replace(/\s+/g, ' ').trim(), price: p, img: img ? (img.getAttribute('src') || '') : '', href: a.getAttribute('href') });
      });
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), items: items })); } catch (e) {}
      return items;
    }).catch(function (e) { log('reco failed', e); return []; });
    return recoCache;
  }
  function paintReco(st) {
    var r = bc.recommend || {};
    if (!recoBox) return;
    var gapUnder = parseInt((cfg.freeShipping || {}).gapUnder, 10) || 0;
    if (r.visible === false || !st || st.done || (gapUnder && st.gap > gapUnder)) { recoBox.style.display = 'none'; recoGap = null; return; }
    if (recoGap === st.gap) return;
    recoGap = st.gap;
    var gap = st.gap;
    loadRecoItems().then(function (items) {
      if (recoGap !== gap) return;
      var inCart = {};
      (window.aBasketProductData || []).forEach(function (p) { inCart[p.product_no] = 1; });
      var pool = items.filter(function (it) { return !inCart[it.no]; });
      // 부족액 이상인 것 중 싼 순 → 모자라면 부족액보다 싼 것 중 비싼 순
      var fills = pool.filter(function (it) { return it.price >= gap; }).sort(function (a, b) { return a.price - b.price; });
      var rest = pool.filter(function (it) { return it.price < gap; }).sort(function (a, b) { return b.price - a.price; });
      var pick = fills.concat(rest).slice(0, Math.max(1, parseInt(r.max, 10) || 8));
      if (!pick.length) { recoBox.style.display = 'none'; return; }
      recoBox.style.display = '';
      setHtml(recoBox, '<div class="dnrb-reco-title">' + esc(r.title || '함께 담으면 무료배송') + '</div><div class="dnrb-reco-list">' + pick.map(function (it) {
        var href = /^\/[^/]/.test(it.href || '') ? it.href : '/product/detail.html?product_no=' + it.no; // 같은 사이트 주소만
        if (PREFIX && href.indexOf(PREFIX + '/') !== 0) href = PREFIX + href;
        return '<a class="dnrb-reco-item" href="' + esc(href) + '">' +
          (it.img ? '<span class="dnrb-reco-img"><img src="' + esc(it.img) + '" alt="" loading="lazy"></span>' : '') +
          '<span class="dnrb-reco-name">' + esc(it.name) + '</span><b class="dnrb-reco-price">' + fmtWon(it.price) + '원</b>' +
          (it.price >= gap ? '<span class="dnrb-reco-tag">' + esc(r.fillTag || '담으면 무료배송') + '</span>' : '') + '</a>';
      }).join('') + '</div>');
    });
  }

  /* 4) 비회원 혜택 안내 ------------------------------------------------- */
  function buildGuestBenefit() {
    var g = bc.guestBenefit || {};
    if (g.visible === false || isMember() || !boxes().length) return;
    var anchor = shipBox || $('.xans-order-normtitle') || $('.xans-order-normnormal');
    if (!anchor || !anchor.parentNode) return;
    var ret = encodeURIComponent(location.pathname + location.search);
    var box = el('div', { 'class': 'dnrb-gbene' },
      '<div class="dnrb-gbene-txt"><b>' + esc(g.title || '로그인하면 회원 할인가로 주문할 수 있어요') + '</b>' +
      (g.body ? '<span>' + esc(g.body) + '</span>' : '') + '</div>' +
      '<a class="dnrb-gbene-btn" href="' + PREFIX + '/member/login.html?returnUrl=' + ret + '">' + esc(g.linkText || '로그인') + '</a>');
    anchor.parentNode.insertBefore(box, shipBox ? shipBox.nextSibling : anchor);
  }

  /* 5) 쓰지 않는 버튼 숨기기 (견적서출력 · 해외장바구니로 이동) ---------- */
  function hideButtons() {
    var h = bc.hideButtons || {};
    var rules = [];
    if (h.estimate !== false) rules.push(/estimatePrint\(/);
    if (h.oversea !== false) rules.push(/moveOversea\(/);
    if (!rules.length) return;
    $$('a[onclick], button[onclick]').forEach(function (a) {
      var on = a.getAttribute('onclick');
      if (rules.some(function (re) { return re.test(on); })) a.classList.add('dnrb-hide');
    });
  }

  /* 시작 ----------------------------------------------------------------- */
  function paint() {
    var sum = summary();
    var st = freeShipState(sum);
    var ship = paintShip(st);
    paintReco(st);
    paintOrderButtons(sum, ship);
  }
  function start() {
    if (!/\/order\/basket/.test(location.pathname)) return;
    var html = doc.documentElement;
    html.classList.add('dnrb-basket');
    var t = cfg.theme || {};
    if (safeColor(t.mainColor)) html.style.setProperty('--dnrb-main', t.mainColor);
    if (!boxes().length) return; // 빈 장바구니
    hideButtons();
    buildShipBox();
    buildGuestBenefit();
    buildOrderButtons();
    paint();
    var s = $('.xans-order-totalsummary'); if (s) watch(s, paint);
    // 체크 상자를 직접 누를 때도 버튼 글자(선택 개수)를 바로 바꾼다
    doc.addEventListener('change', function (e) { if (e.target && /^basket_chk_id_/.test(e.target.id || '')) setTimeout(paint, 50); }, true);
    selectAllOnLoad();
    log('ready', VER);
  }
  window.DNRB_BASKET_VER = VER;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
