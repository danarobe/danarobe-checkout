/* =====================================================================
 * 다나로브 장바구니 꾸미기 — basket.js
 * window.DNRB_PAY_CONFIG (config.js) 의 basket 설정을 읽어 카페24 장바구니 위에
 * 전체 선택 · 금액이 보이는 주문 버튼 하나 · 무료배송 막대(+채우기 추천) · 비회원 혜택 안내를 그린다.
 * 주문·수량·삭제·합계 계산은 전부 카페24 그대로 (우리는 카페24 버튼을 대신 눌러줄 뿐).
 * ===================================================================== */
(function () {
  'use strict';
  var VER = '2026-11-13.3';
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

  /* 사용 기록(track.js): 설정 tracking 이 켜져 있을 때만 비동기로 불러온다. 결제·화면 동작에는 관여하지 않는다 */
  var TK = cfg.tracking || {};
  var TRACK_ON = TK.enabled !== false && !!TK.url && !!TK.key && (/^\/skin-[^/]+/.test(location.pathname) || TK.live === true);
  function track(name, data, now) {
    try {
      if (!TRACK_ON) return;
      if (window.__dnrbTrack) window.__dnrbTrack(name, data || {}, now);
      else (window.__dnrbQ = window.__dnrbQ || []).push([name, data || {}]);
    } catch (e) {}
  }
  function loadTracker() {
    try {
      if (!TRACK_ON || window.__dnrbTrackLoading) return;
      window.__dnrbTrackLoading = true;
      var me = [].slice.call(document.scripts).filter(function (s) { return /\/(checkout|basket)\.js(\?|$)/.test(s.src || ''); })[0];
      var base = me ? me.src.replace(/[^/]*$/, '') : 'https://danarobe.github.io/danarobe-checkout/';
      var s = document.createElement('script');
      s.async = true; s.src = base + 'track.js?v=' + encodeURIComponent(VER);
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }

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
    // 이 스킨은 '총 할인금액' 줄을 숨겨 두지만 결제예정금액에는 기간할인 등이 이미 빠져 있다 → 차이로 할인액을 구한다
    // (예: 상품 74,000 + 배송 3,000 - 결제예정 72,900 = 할인 4,100)
    if (!discount && pay != null && product != null) discount = Math.max(0, product + (fee || 0) - pay);
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
    try { var sm = summary() || {}; track('b_order', { pay: sm.pay, on: on.length, all: all.length }, true); } catch (e) {}
    if (link) link.click();
  }
  var bars = [];
  // 금액 안내: 버튼 아래 문구("쿠폰/적립금 적용 시 …") + 합계에 할인 금액 줄. live 를 켜기 전에는 테스트 스킨 주소에서만
  var pn = bc.priceNote || {};
  var noteOn = pn.visible !== false && (!!PREFIX || pn.live === true);
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
      var inline = el('div', { 'class': 'dnrb-bbar dnrb-bbar-inline' }, '<button type="button" class="dnrb-bbar-btn"></button><span class="dnrb-bbar-ship"></span>' +
        (noteOn && pn.text ? '<p class="dnrb-bbar-note">' + esc(pn.text) + '</p>' : ''));
      fixItem.insertBefore(inline, fixItem.firstChild);
      bars.push(inline);
    }
    bars.forEach(function (b) { $('.dnrb-bbar-btn', b).addEventListener('click', order); });
    doc.documentElement.classList.add('dnrb-bbar-on');
    // 카페24 '할인 적용 금액은 주문서작성…' 안내는 우리 문구와 겹치므로, 우리 문구가 실제로 그려졌을 때만 숨긴다
    if ($('#orderFixItem .dnrb-bbar-note')) doc.documentElement.classList.add('dnrb-pnote');
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

  // 이 스킨은 카페24 '총 할인금액' 줄을 숨겨 두어 74,000 + 3,000 = 72,900 처럼 숫자가 안 맞아 보인다.
  // 결제예정금액에 이미 빠져 있는 할인(기간할인 등)을 '할인 금액' 줄로 보여준다 (금액 계산은 카페24 그대로).
  function paintDiscountLine(sum) {
    if (!noteOn || pn.discountLine === false) return;
    var s = $('.xans-order-totalsummary'); if (!s) return;
    var line = $('.dnrb-disc', s);
    var d = sum && sum.discount > 0 ? sum.discount : 0;
    if (!line) {
      if (!d) return;
      var payTitle = $$('.title, h4', s).filter(function (n) { return /결제\s*예정\s*금액/.test(n.textContent); })[0];
      var payItem = payTitle && (payTitle.closest('.totalSummary__item') || payTitle.closest('.heading') || payTitle.parentNode);
      if (!payItem || !payItem.parentNode) return;
      line = el('div', { 'class': 'totalSummary__item dnrb-disc' },
        '<div class="heading"><h4 class="title"></h4><div class="data"><strong class="dnrb-disc-amt"></strong><span>원</span></div></div>');
      payItem.parentNode.insertBefore(line, payItem);
    }
    line.style.display = d ? '' : 'none';
    var t = $('.title', line), a = $('.dnrb-disc-amt', line);
    var label = pn.discountLabel || '할인 금액', amt = '-' + fmtWon(d);
    if (t.textContent !== label) t.textContent = label;
    if (a.textContent !== amt) a.textContent = amt;
  }

  /* 3) 무료배송 막대 + 채우기 추천 -------------------------------------- */
  var shipBox = null, recoBox = null;
  function freeShipState(sum) {
    var fs = cfg.freeShipping || {}, sb = bc.freeShipBar || {};
    var threshold = parseInt(fs.threshold, 10) || 0;
    if (sb.visible === false || !threshold || !sum || sum.product == null || !checkedBoxes().length) return null;
    var base = fs.basis === 'product' ? sum.product : Math.max(0, sum.product - (sum.discount || 0));
    var gap = threshold - base;
    // 배송비는 카페24 계산이 기준: 배송비가 붙어 있는데 우리 계산으로는 넘었다면(조건이 다른 경우) 틀린 안내를 하지 않도록 숨김
    if (sum.fee > 0 && gap <= 0) return null;
    return { threshold: threshold, base: base, gap: gap, done: sum.fee === 0 || (sum.fee == null && gap <= 0), fee: sum.fee };
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
  var recoCache = null, recoGap = null, recoItems = {};
  // 추천 상품을 장바구니 안에서 바로 담기 (손님 화면은 quickAdd.live 를 켜기 전까지 테스트 스킨 주소에서만)
  var qa = (bc.recommend || {}).quickAdd || {};
  var quickOn = qa.enabled !== false && (!!PREFIX || qa.live === true);
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
      recoItems = {};
      setHtml(recoBox, '<div class="dnrb-reco-title">' + esc(r.title || '함께 담으면 무료배송') + '</div><div class="dnrb-reco-list">' + pick.map(function (it) {
        var href = /^\/[^/]/.test(it.href || '') ? it.href : '/product/detail.html?product_no=' + it.no; // 같은 사이트 주소만
        if (PREFIX && href.indexOf(PREFIX + '/') !== 0) href = PREFIX + href;
        recoItems[it.no] = { no: it.no, name: it.name, price: it.price, img: it.img, href: href };
        var fillTag = it.price >= gap ? esc(r.fillTag || '담으면 무료배송') : '';
        return '<a class="dnrb-reco-item" href="' + esc(href) + '" data-no="' + it.no + '">' +
          (it.img ? '<span class="dnrb-reco-img"><img src="' + esc(it.img) + '" alt="" loading="lazy"></span>' : '') +
          '<span class="dnrb-reco-name">' + esc(it.name) + '</span><b class="dnrb-reco-price">' + fmtWon(it.price) + '원</b>' +
          (quickOn ? '<span class="dnrb-reco-tag dnrb-reco-add">+ ' + (fillTag || '담기') + '</span>'
                   : (fillTag ? '<span class="dnrb-reco-tag">' + fillTag + '</span>' : '')) + '</a>';
      }).join('') + '</div>');
    });
  }

  /* 3-1) 추천 상품 바로 담기 ---------------------------------------------- */
  // 카페24 옵션 선택 페이지(layer_option.html — 상품 목록의 '옵션 선택' 창과 같은 가벼운 페이지)를 화면 밖 iframe 으로 열어
  // 카페24 옵션 상자·장바구니 담기(product_submit)를 그대로 쓴다. 상세 페이지보다 사진이 훨씬 적어 빨리 뜬다.
  // 옵션 조합·재고·품절·중복 확인은 전부 카페24가 한다. 담기에 성공하면 iframe 이 장바구니로 이동하므로 그걸 신호로 새로고침.
  var qaSheet = null, qaFrame = null, qaState = null;
  function qaClose() {
    if (qaFrame) { try { qaFrame.remove(); } catch (e) {} qaFrame = null; }
    if (qaSheet) qaSheet.classList.remove('is-open');
    doc.documentElement.classList.remove('dnrb-qa-lock');
    qaState = null;
  }
  function qaBuildSheet() {
    if (qaSheet) return qaSheet;
    qaSheet = el('div', { 'class': 'dnrb-qa', role: 'dialog', 'aria-modal': 'true', 'aria-label': '옵션 선택' },
      '<div class="dnrb-qa-dim"></div><div class="dnrb-qa-panel">' +
      '<button type="button" class="dnrb-qa-x" aria-label="닫기">×</button>' +
      '<div class="dnrb-qa-head"><span class="dnrb-qa-img"></span><div class="dnrb-qa-info"><span class="dnrb-qa-name"></span><b class="dnrb-qa-price"></b></div></div>' +
      '<div class="dnrb-qa-body"></div><p class="dnrb-qa-msg" aria-live="polite"></p>' +
      '<button type="button" class="dnrb-qa-add" disabled>장바구니 담기</button>' +
      '<a class="dnrb-qa-more" href="#">상품 자세히 보기</a></div>');
    doc.body.appendChild(qaSheet);
    $('.dnrb-qa-dim', qaSheet).addEventListener('click', qaClose);
    $('.dnrb-qa-x', qaSheet).addEventListener('click', qaClose);
    $('.dnrb-qa-add', qaSheet).addEventListener('click', qaSubmit);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && qaState) qaClose(); });
    return qaSheet;
  }
  function qaMsg(t, isErr) { var m = $('.dnrb-qa-msg', qaSheet); m.textContent = t || ''; m.classList.toggle('is-err', !!isErr); }
  function qaBusy(on, label) { var b = $('.dnrb-qa-add', qaSheet); b.disabled = !!on; b.textContent = label || '장바구니 담기'; }
  // 상품 페이지로 넘겨야 하는 경우(옵션 상자를 못 찾음, 글자 입력 옵션 등)
  function qaFallback(text) {
    var it = qaState && qaState.item; if (!it) return;
    $('.dnrb-qa-body', qaSheet).innerHTML = '';
    qaMsg(text || '이 상품은 상품 페이지에서 옵션을 골라 주세요.');
    var b = $('.dnrb-qa-add', qaSheet); b.disabled = false; b.textContent = '상품 페이지에서 고르기';
    qaState.fallback = true;
  }
  function qaSelects(d) { return $$('select[id^="product_option_id"]', d); }
  // 카페24 옵션 창은 고를 때마다 아래 '선택 목록'(#totalProducts)에 한 줄씩 쌓는다(상세 페이지에서 여러 색을 함께 담는 방식).
  // 우리 창은 한 번에 하나만 담으므로, 옵션을 바꿀 때마다 그 목록을 카페24 삭제 버튼으로 비운다.
  // 안 비우면 ① 같은 옵션을 다시 고를 때 "이미 선택된 옵션" 경고 후 '선택해 주세요'로 되돌아가고 ② 다른 색으로 바꾸면 두 색이 함께 담긴다.
  function qaRows(d) { return $$('#totalProducts .option_product', d); }
  function qaClearRows(d, w) {
    var jq = w.EC$ || w.jQuery;
    $$('#totalProducts .option_product .delete', d).forEach(function (a) {
      try { if (jq) jq(a).trigger('click'); else a.click(); } catch (e) { try { a.click(); } catch (x) {} }
    });
  }
  function qaLabel(s) {
    var row = s.closest('tr, li, .ec-base-table, dl, .option'), t = '';
    if (row) { var th = $('th, dt, .title, label', row); if (th) t = th.textContent; }
    return (t || '옵션').replace(/\s+/g, ' ').replace(/\*|필수/g, '').trim();
  }
  // iframe 의 옵션 상자를 우리 창에 그대로 옮겨 그린다 (선택에 따라 다음 상자가 바뀌는 옵션도 다시 읽음)
  function qaRender() {
    if (!qaState || !qaFrame) return;
    var d; try { d = qaFrame.contentDocument; } catch (e) { return qaFallback(); }
    var sels = qaSelects(d);
    var body = $('.dnrb-qa-body', qaSheet);
    body.innerHTML = sels.map(function (s, i) {
      var opts = [].slice.call(s.options).map(function (o) {
        if (/^\*/.test(o.value)) return ''; // "- [필수] 옵션을 선택해 주세요 -" · "-----" 줄
        return '<option value="' + esc(o.value) + '"' + (o.disabled ? ' disabled' : '') + (s.value === o.value ? ' selected' : '') + '>' + esc(o.text) + '</option>';
      }).join('');
      return '<label class="dnrb-qa-opt"><span>' + esc(qaLabel(s)) + '</span><select data-i="' + i + '"' + (s.disabled ? ' disabled' : '') + '>' +
        '<option value="">선택해 주세요</option>' + opts + '</select></label>';
    }).join('');
    $$('select', body).forEach(function (mine) {
      mine.addEventListener('change', function () {
        var fd = qaFrame.contentDocument, fw = qaFrame.contentWindow;
        var src = qaSelects(fd)[+mine.getAttribute('data-i')];
        if (!src) return;
        var jq = fw.EC$ || fw.jQuery;
        qaClearRows(fd, fw);
        setTimeout(function () {
          src.value = mine.value || '*';
          if (jq) jq(src).trigger('change'); else src.dispatchEvent(new Event('change', { bubbles: true }));
          qaMsg('');
          setTimeout(qaRender, 350); // 다음 옵션 상자가 바뀔 수 있음
        }, qaRows(fd).length ? 150 : 0);
      });
    });
    qaBusy(false);
    // 고를 수 있는 값이 하나뿐이면 미리 골라 둔다 (한 번 더 누르는 수고 덜기)
    qaState.auto = qaState.auto || {};
    $$('select', body).forEach(function (mine) {
      var i = mine.getAttribute('data-i');
      var real = [].slice.call(mine.options).filter(function (o) { return o.value && !o.disabled; });
      if (!mine.value && real.length === 1 && !qaState.auto[i]) {
        qaState.auto[i] = 1; mine.value = real[0].value; mine.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  function qaReady() {
    var tries = 0;
    (function wait() {
      if (!qaState || !qaFrame) return;
      var w, d; try { w = qaFrame.contentWindow; d = qaFrame.contentDocument; } catch (e) { return qaFallback(); }
      // 사진이 다 받아질 때까지(load) 기다리지 않고, 옵션 상자와 카페24 담기 기능이 생기면 바로 시작
      var ok = d && typeof w.product_submit === 'function' && (w.EC$ || w.jQuery) &&
        (qaSelects(d).length || d.readyState === 'complete');
      if (!ok) { if (++tries > 100) return qaFallback('상품 정보를 불러오지 못했어요.'); return setTimeout(wait, 120); }
      // 카페24 알림·확인 창은 우리 화면에서 보이게
      w.alert = function (m) { if (qaState) qaState.submitting = false; qaMsg(String(m || ''), true); qaBusy(false); };
      w.confirm = function (m) { return window.confirm(m); };
      // 글자 입력·파일 첨부 같은 옵션은 이 창에서 못 받음 → 상품 페이지로
      var hard = $$('input[name^="option_add"], textarea[name^="option_add"], input[type="file"][name*="option"], [option_style="radio"] input, .ec-product-button', d).filter(function (n) { return n.offsetParent !== null || n.type === 'file'; });
      if (hard.length) return qaFallback();
      qaState.ready = true;
      qaRender();
    })();
  }
  function qaOpen(no) {
    var it = recoItems[no]; if (!it) return false;
    qaBuildSheet();
    qaState = { item: it, ready: false };
    var img = $('.dnrb-qa-img', qaSheet); img.innerHTML = it.img ? '<img src="' + esc(it.img) + '" alt="">' : '';
    $('.dnrb-qa-name', qaSheet).textContent = it.name;
    $('.dnrb-qa-price', qaSheet).textContent = fmtWon(it.price) + '원';
    $('.dnrb-qa-more', qaSheet).setAttribute('href', it.href);
    $('.dnrb-qa-body', qaSheet).innerHTML = '<div class="dnrb-qa-loading">옵션을 불러오는 중…</div>';
    qaMsg(''); qaBusy(true);
    qaSheet.classList.add('is-open');
    doc.documentElement.classList.add('dnrb-qa-lock');
    if (qaFrame) try { qaFrame.remove(); } catch (e) {}
    qaFrame = el('iframe', { 'class': 'dnrb-qa-frame', title: '', 'aria-hidden': 'true', tabindex: '-1',
      src: PREFIX + '/product/layer_option.html?product_no=' + encodeURIComponent(no) + '&cate_no=0&bPrdOptLayer=T' });
    qaFrame.addEventListener('load', function onload() {
      if (!qaState) return;
      var path = ''; try { path = qaFrame.contentWindow.location.pathname; } catch (e) {}
      if (qaState.submitting) {
        // 담기 성공 → 카페24가 iframe 을 장바구니로 보냄
        if (/\/order\/basket/.test(path)) { qaState.done = true; qaMsg('장바구니에 담았어요'); qaBusy(true, '담았어요 ✓'); setTimeout(function () { location.reload(); }, 400); }
        return;
      }
    });
    doc.body.appendChild(qaFrame);
    qaReady();
    return true;
  }
  function qaSubmit() {
    if (!qaState) return;
    var it = qaState.item;
    if (qaState.fallback) { track('b_qa_page', { no: it.no }, true); location.href = it.href; return; }
    if (!qaState.ready) return;
    var w = qaFrame.contentWindow, d = qaFrame.contentDocument;
    var missing = qaSelects(d).filter(function (s) { return !s.disabled && (s.getAttribute('required') === 'true' || s.required) && (!s.value || /^\*/.test(s.value)); });
    if (missing.length) { qaMsg('‘' + qaLabel(missing[0]) + '’ 옵션을 선택해 주세요.', true); return; }
    // 안전장치: 선택 목록에 두 줄 이상이면(여러 옵션이 함께 담길 상황) 담지 않고 다시 고르게 한다
    if (qaRows(d).length > 1) {
      qaClearRows(d, w);
      qaSelects(d).forEach(function (s) { s.value = '*'; });
      qaState.auto = {};
      setTimeout(qaRender, 200);
      qaMsg('옵션을 다시 골라 주세요.', true);
      return;
    }
    qaState.submitting = true;
    qaBusy(true, '담는 중…'); qaMsg('');
    track('b_qa_add', { no: it.no, price: it.price }, true);
    // 담기에 성공하면 카페24가 화면을 바로 새로 열어 기록이 끊길 수 있다 → 다음 장바구니 화면에서 확인해 기록
    if (TRACK_ON) try { sessionStorage.setItem('dnrb_qa_pending', JSON.stringify({ no: String(it.no), price: it.price, at: Date.now() })); } catch (e) {}
    try { w.product_submit(2, '/exec/front/order/basket/', null); }
    catch (e) { qaState.submitting = false; qaBusy(false); qaMsg('담지 못했어요. 상품 페이지에서 다시 시도해 주세요.', true); return; }
    setTimeout(function () {
      if (qaState && qaState.submitting && !qaState.done) { track('b_qa_slow', { no: qaState.item.no }); qaState.submitting = false; qaBusy(false); if (!$('.dnrb-qa-msg', qaSheet).textContent) qaMsg('응답이 늦어요. 잠시 뒤 다시 눌러 주세요.', true); }
    }, 12000);
  }
  function quickAddInit() {
    if (!quickOn) return;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.dnrb-reco-item');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (qaOpen(a.getAttribute('data-no'))) e.preventDefault();
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

  /* 6) 화면 정리 (2단계) --------------------------------------------------- */
  // 손님 화면(대표 스킨)에는 tidy.live 를 켜기 전까지 적용하지 않는다. 테스트 스킨 주소(/skin-…)에서만 켜진다.
  var td = bc.tidy || {};
  var tidyOn = td.enabled !== false && (!!PREFIX || td.live === true);
  function tidyFlags() {
    var html = doc.documentElement;
    html.classList.add('dnrb-tidy');
    var map = { compactTop: 'dnrb-t-top', compactItems: 'dnrb-t-items', autoQuantity: 'dnrb-t-qty', hideGuide: 'dnrb-t-guide', giftBelow: 'dnrb-t-gift' };
    Object.keys(map).forEach(function (k) { if (td[k] !== false) html.classList.add(map[k]); });
  }
  // 카페24가 상품 목록을 다시 그릴 때마다(수량 변경 등) 다시 붙인다
  function tidyItems() {
    var html = doc.documentElement;
    // 해외배송 상품이 0개면 "국내/해외배송상품" 탭 숨김
    if (td.compactTop !== false) {
      var tab = $('.xans-order-tabinfo');
      var over = tab && $$('a, li', tab).filter(function (n) { return /해외배송/.test(n.textContent); })[0];
      html.classList.toggle('dnrb-t-nooversea', !!(over && /\(\s*0\s*\)/.test(over.textContent)));
    }
    if (td.compactItems === false) return;
    // 상품 묶음 아래 "[기본배송]" 만 적힌 회색 칸 숨김 (금액은 스킨이 이미 지워 둠)
    $$('.xans-order-normnormal > .summary').forEach(function (sm) {
      if (/^\s*\[[^\]]*\]\s*$/.test(sm.innerText || '')) sm.classList.add('dnrb-t-off');
    });
    $$('.prdBox').forEach(function (box) {
      // "-0원" (할인 없음) 줄 숨김
      $$('ul.price > li', box).forEach(function (li) {
        if (/^-\s*0\s*원$/.test(li.textContent.replace(/\s+/g, ''))) li.classList.add('dnrb-t-off');
      });
      // 상품 줄의 "배송 : [무료] / 기본배송" 은 실제 배송비와 달라 보일 수 있어 숨김 (배송비는 아래 합계·무료배송 막대가 보여줌), 적립금 "-" 숨김
      $$('ul.info > li', box).forEach(function (li) {
        var t = li.textContent.replace(/\s+/g, ' ').trim();
        if (/^배송\s*:/.test(t) || t === '-' || t === '') li.classList.add('dnrb-t-off');
      });
      // 옵션 변경 버튼 보이기 (카페24가 숨겨 둔 것)
      if (td.optionChange !== false) $$('a[onclick*="showOptionChangeLayer"]', box).forEach(function (a) { a.classList.remove('displaynone'); a.classList.add('dnrb-t-optbtn'); });
      // 수량이 1개면 "주문금액" 줄은 가격과 같으니 숨김
      var q = $('input[id^="quantity_id_"]', box);
      box.classList.toggle('dnrb-t-qty1', !!q && parseInt(q.value, 10) === 1);
      // 상품별 버튼 글자 줄이기
      $$('.buttonGroup a', box).forEach(function (a) { if (/^\s*주문하기\s*$/.test(a.textContent)) a.textContent = '바로 주문'; });
    });
  }
  // 수량 +/- 는 카페24가 이미 바로 반영한다(addQuantityShortcut → modifyQuantity).
  // "변경" 버튼은 숫자를 직접 입력했을 때만 필요하므로, 입력을 마치면(change) 잠시 뒤 대신 누르고 버튼은 숨긴다.
  function autoQuantity() {
    if (td.autoQuantity === false) return;
    var timers = {};
    function schedule(input) {
      var m = (input.id || '').match(/^quantity_id_(\d+)$/); if (!m) return;
      var i = m[1];
      clearTimeout(timers[i]);
      timers[i] = setTimeout(function () {
        var cur = doc.getElementById('quantity_id_' + i); if (!cur) return;
        var data = (window.aBasketProductData || [])[i];
        if (data && String(data.quantity) === String(cur.value)) return; // 바뀐 게 없음
        var q = cur.closest('.quantity') || cur.parentNode.parentNode;
        var btn = q && $('a[onclick*="modifyQuantity"]', q);
        if (btn) { log('auto quantity', i, cur.value); btn.click(); }
      }, 700);
    }
    doc.addEventListener('change', function (e) {
      if (e.target && /^quantity_id_\d+$/.test(e.target.id || '')) schedule(e.target);
    });
  }

  /* 시작 ----------------------------------------------------------------- */
  function paint() {
    var sum = summary();
    var st = freeShipState(sum);
    var ship = paintShip(st);
    paintReco(st);
    paintOrderButtons(sum, ship);
    paintDiscountLine(sum);
  }
  function start() {
    if (window.top !== window) return; // 바로 담기용 iframe 안의 장바구니에서는 아무것도 안 함
    if (!/\/order\/basket/.test(location.pathname)) return;
    var html = doc.documentElement;
    html.classList.add('dnrb-basket');
    var t = cfg.theme || {};
    if (safeColor(t.mainColor)) html.style.setProperty('--dnrb-main', t.mainColor);
    if (!boxes().length) return; // 빈 장바구니
    if (tidyOn) {
      tidyFlags();
      tidyItems();
      autoQuantity();
      var pk = $('.xans-order-basketpackage'); if (pk) watch(pk, tidyItems);
    }
    hideButtons();
    buildShipBox();
    quickAddInit();
    buildGuestBenefit();
    buildOrderButtons();
    paint();
    var s = $('.xans-order-totalsummary'); if (s) watch(s, paint);
    // 체크 상자를 직접 누를 때도 버튼 글자(선택 개수)를 바로 바꾼다
    doc.addEventListener('change', function (e) { if (e.target && /^basket_chk_id_/.test(e.target.id || '')) setTimeout(paint, 50); }, true);
    selectAllOnLoad();
    if (TRACK_ON) {
      loadTracker();
      // 추천 상품 누름(바로 담기 여부와 관계없이). 읽기만 한다
      doc.addEventListener('click', function (e) {
        try {
          var a = e.target.closest && e.target.closest('.dnrb-reco-item'); if (!a) return;
          var no = a.getAttribute('data-no'), it = recoItems[no] || {};
          track('b_reco', { no: no, price: it.price, q: quickOn ? 1 : 0 }, !quickOn);
        } catch (x) {}
      }, { capture: true, passive: true });
      // 바로 담기 결과: 직전에 담기를 눌렀고(1분 안) 그 상품이 지금 장바구니에 있으면 성공
      try {
        var pend = JSON.parse(sessionStorage.getItem('dnrb_qa_pending') || 'null');
        if (pend) {
          sessionStorage.removeItem('dnrb_qa_pending');
          if (Date.now() - pend.at < 60000) {
            var inCartNow = (window.aBasketProductData || []).some(function (x) { return String(x.product_no) === String(pend.no); });
            track(inCartNow ? 'b_qa_ok' : 'b_qa_miss', { no: pend.no, price: pend.price, s: Math.round((Date.now() - pend.at) / 1000) });
          }
        }
      } catch (x) {}
      // 전체 선택·합계 계산이 끝난 뒤 한 번: 장바구니 상태
      setTimeout(function () {
        try {
          var sm = summary() || {}, st = freeShipState(sm);
          track('b_view', { pay: sm.pay, prod: sm.product, fee: sm.fee, disc: sm.discount, n: boxes().length, on: checkedBoxes().length,
            gap: st ? st.gap : null, reco: $$('.dnrb-reco-item').length, mem: isMember() ? 1 : 0 });
        } catch (x) {}
      }, 2500);
    }
    log('ready', VER);
  }
  window.DNRB_BASKET_VER = VER;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
