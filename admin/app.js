/* 관리 화면 로직 */
(function () {
  'use strict';
  let META = null;
  let cfg = null;
  let dirty = false;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400); }
  function get(path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), cfg); }
  function set(path, v) { const ks = path.split('.'); let o = cfg; ks.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = v; }
  function markDirty() { dirty = true; $('#dirty').hidden = false; schedulePreview(); }

  /* ----- 단순 바인딩 ----- */
  function bindAll() {
    $$('[data-bind]').forEach(inp => {
      const path = inp.dataset.bind;
      const v = get(path);
      if (inp.type === 'checkbox') inp.checked = !!v;
      else if (inp.type === 'radio') inp.checked = String(v) === inp.value;
      else inp.value = v == null ? '' : v;
      if (!inp._bound) {
        inp._bound = true;
        inp.addEventListener('input', () => onInput(inp));
        inp.addEventListener('change', () => onInput(inp));
      }
    });
    $$('[data-bind-lines]').forEach(ta => {
      ta.value = (get(ta.dataset.bindLines) || []).join('\n');
      if (!ta._bound) { ta._bound = true; ta.addEventListener('input', () => { set(ta.dataset.bindLines, ta.value.split('\n').map(s => s.trim()).filter(Boolean)); markDirty(); }); }
    });
    updateLogoPreview();
    updatePromoVisibility();
  }
  function onInput(inp) {
    const path = inp.dataset.bind;
    let v;
    if (inp.type === 'checkbox') v = inp.checked;
    else if (inp.type === 'radio') { if (!inp.checked) return; v = inp.value; }
    else if (inp.type === 'number') v = inp.value === '' ? '' : Number(inp.value);
    else v = inp.value;
    set(path, v);
    // 같은 경로를 쓰는 다른 입력(색상 picker ↔ 텍스트) 동기화
    $$(`[data-bind="${path}"]`).forEach(o => { if (o !== inp) { if (o.type === 'checkbox') o.checked = !!v; else if (o.type === 'radio') o.checked = String(v) === o.value; else if (o.type === 'color') { if (/^#[0-9a-f]{6}$/i.test(v)) o.value = v; } else o.value = v; } });
    if (path.startsWith('logo')) updateLogoPreview();
    if (path === 'promotion.type') updatePromoVisibility();
    markDirty();
  }
  function updateLogoPreview() {
    const b = $('#logoPreview'); const l = cfg.logo || {};
    b.innerHTML = l.url ? `<img src="${esc(l.url)}" style="height:${Number(l.heightPc) || 24}px" alt="">` : '<span class="empty">로고 주소를 넣으면 여기 보여요</span>';
  }
  function updatePromoVisibility() {
    const t = (cfg.promotion || {}).type || 'text';
    $$('[data-promo]').forEach(c => { c.hidden = c.dataset.promo !== t; });
  }

  /* ----- 목록 편집기 ----- */
  const methodOptions = (sel) => META.PAYMETHODS.map(m => `<option value="${m.code}" ${sel === m.code ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  const posOptions = (sel) => META.NOTICE_POSITIONS.map(p => `<option value="${p.code}" ${sel === p.code ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const audOptions = (sel) => [['all', '전체'], ['member', '회원만'], ['guest', '비회원만']].map(([v, l]) => `<option value="${v}" ${(sel || 'all') === v ? 'selected' : ''}>${l}</option>`).join('');

  const LISTS = {
    badges: {
      path: 'badges', empty: '아직 뱃지가 없어요.',
      blank: () => ({ visible: true, method: 'card', text: '', color: '#267BFF' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label>
          <select data-k="method" class="grow">${methodOptions(it.method)}</select><button class="icon-btn" data-del>✕</button></div>
        <div class="grid2"><div class="f">뱃지 문구<input type="text" data-k="text" value="${esc(it.text)}" placeholder="예: 0.3% 무제한 즉시할인"></div>
          <div class="f">색상<div class="color"><input type="color" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '#267BFF'}"><input type="text" data-k="color" value="${esc(it.color)}" class="w120"></div></div></div>`
    },
    benefitMsgs: {
      path: 'benefitMsgs', empty: '아직 혜택 문구가 없어요.',
      blank: () => ({ visible: true, method: 'card', title: '', body: '' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label>
          <select data-k="method" class="grow">${methodOptions(it.method)}</select><button class="icon-btn" data-del>✕</button></div>
        <div class="f">제목<input type="text" data-k="title" value="${esc(it.title)}" placeholder="예: 신용카드 혜택"></div>
        <div class="f">내용 (HTML 가능)<textarea data-k="body" rows="2">${esc(it.body)}</textarea></div>`
    },
    notices: {
      path: 'notices', empty: '아직 안내문구가 없어요.',
      blank: () => ({ visible: true, position: 'shippingInfo', html: '' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label>
          <select data-k="position" class="grow">${posOptions(it.position)}</select><button class="icon-btn" data-del>✕</button></div>
        <div class="f">내용 (HTML 가능)<textarea data-k="html" rows="3">${esc(it.html)}</textarea></div>`
    },
    installmentItems: {
      path: 'installment.items', empty: '카드사를 추가해 주세요.',
      blank: () => ({ visible: true, card: '', condition: '5만원 이상', months: '2~5개월' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label><span class="grow"></span><button class="icon-btn" data-del>✕</button></div>
        <div class="grid3"><div class="f">카드사<input type="text" data-k="card" value="${esc(it.card)}" placeholder="예: 삼성카드"></div>
          <div class="f">금액 조건<input type="text" data-k="condition" value="${esc(it.condition)}"></div>
          <div class="f">할부 기간<input type="text" data-k="months" value="${esc(it.months)}"></div></div>`
    },
    promoItems: {
      path: 'promotion.items', empty: '아직 배너가 없어요.',
      blank: () => ({ visible: true, icon: '🎁', title: '', body: '', color: '', url: '', audience: 'all' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label>
          <input type="text" data-k="icon" value="${esc(it.icon)}" class="w80" placeholder="아이콘" title="이모지 또는 이미지 URL">
          <input type="text" data-k="title" value="${esc(it.title)}" class="grow" placeholder="제목">
          <select data-k="audience" class="w120">${audOptions(it.audience)}</select><button class="icon-btn" data-del>✕</button></div>
        <div class="f">설명 (HTML 가능)<textarea data-k="body" rows="2">${esc(it.body)}</textarea></div>
        <div class="grid2"><div class="f">연결 링크<input type="text" data-k="url" value="${esc(it.url)}" placeholder="비우면 링크 없음"></div>
          <div class="f">테두리/제목 색 (비우면 메인색)<div class="color"><input type="color" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(it.color) ? it.color : (cfg.theme.mainColor || '#000000')}"><input type="text" data-k="color" value="${esc(it.color)}" class="w120"></div></div></div>`
    },
    promoImages: {
      path: 'promotion.images', empty: '아직 이미지가 없어요.',
      blank: () => ({ visible: true, src: '', url: '', audience: 'all' }),
      row: (it) => `
        <div class="head"><label class="switch"><input type="checkbox" data-k="visible" ${it.visible !== false ? 'checked' : ''}><span></span></label>
          <select data-k="audience" class="w120">${audOptions(it.audience)}</select><span class="grow"></span><button class="icon-btn" data-del>✕</button></div>
        <div class="grid2"><div class="f">이미지 주소<input type="text" data-k="src" value="${esc(it.src)}" placeholder="https://..."></div>
          <div class="f">연결 링크<input type="text" data-k="url" value="${esc(it.url)}"></div></div>`
    },
  };

  function renderList(id) {
    const L = LISTS[id]; const box = $('#' + id);
    const arr = get(L.path) || [];
    if (!Array.isArray(get(L.path))) set(L.path, arr);
    box.innerHTML = arr.length ? '' : `<div class="empty">${L.empty}</div>`;
    arr.forEach((it, i) => {
      const d = document.createElement('div'); d.className = 'item'; d.innerHTML = L.row(it);
      d.addEventListener('input', e => {
        const k = e.target.dataset.k; if (!k) return;
        it[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (e.target.type === 'color') { const t = d.querySelector(`input[type=text][data-k="${k}"]`); if (t) t.value = e.target.value; }
        if (e.target.type === 'text' && /^#[0-9a-f]{6}$/i.test(e.target.value)) { const c = d.querySelector(`input[type=color][data-k="${k}"]`); if (c) c.value = e.target.value; }
        markDirty();
      });
      d.querySelector('[data-del]').addEventListener('click', () => { arr.splice(i, 1); renderList(id); markDirty(); });
      box.appendChild(d);
    });
  }
  function renderLists() { Object.keys(LISTS).forEach(renderList); }
  $$('[data-add]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.add; get(LISTS[id].path).push(LISTS[id].blank()); renderList(id); markDirty(); }));

  /* ----- 결제수단 모양 선택지 ----- */
  function renderModes() {
    $('#pmModes').innerHTML = META.PAYMETHOD_MODES.map(m => `<label class="choice"><input type="radio" name="pmMode" value="${m.code}" data-bind="paymethod.mode"><span><b>${esc(m.label.split(' (')[0])}</b><small>${esc((m.label.match(/\((.*)\)/) || [])[1] || '')}</small></span></label>`).join('');
    $('#promoPosition').innerHTML = META.PROMOTION_POSITIONS.map(p => `<option value="${p.code}">${esc(p.label)}</option>`).join('');
  }

  /* ----- 내비 ----- */
  function showSec(name) {
    $$('.sec').forEach(s => { s.hidden = s.dataset.sec !== name; });
    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.sec === name));
    if (name === 'deploy') loadStatus();
    window.scrollTo(0, 0);
  }
  $$('.nav-item').forEach(a => a.addEventListener('click', e => { e.preventDefault(); location.hash = a.dataset.sec; showSec(a.dataset.sec); }));

  /* ----- 미리보기 ----- */
  let pvTimer = null;
  function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(sendPreview, 350); }
  function sendPreview() { const f = $('#pv'); if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'dnrb-config', config: cfg }, '*'); }
  $('#pv').addEventListener('load', sendPreview);
  const DEVICE_NOTE = {
    iphone: '아이폰(393×852, 사파리 하단 바·홈 표시줄 포함) 기준. 실제 카페24 주문서와 같은 구조의 가짜 페이지에 설정을 입혀 보여줍니다.',
    android: '안드로이드(갤럭시 360×800, 크롬 주소창·하단 내비게이션 포함) 기준. 실제 카페24 주문서와 같은 구조의 가짜 페이지에 설정을 입혀 보여줍니다.',
    pc: 'PC 화면 기준(2단 배치). 실제 카페24 주문서와 같은 구조의 가짜 페이지에 설정을 입혀 보여줍니다.',
  };
  function fitDevice() {
    const dev = $('#device'); const stage = $('.preview-stage');
    const w = dev.offsetWidth, h = dev.offsetHeight;
    const s = Math.min(1, (stage.clientWidth - 8) / w, (stage.clientHeight - 8) / h);
    dev.style.transform = `translateX(-50%) scale(${s.toFixed(3)})`;
  }
  function setDevice(name) {
    const dev = $('#device'); dev.className = 'device ' + name;
    $$('[data-pv]').forEach(x => x.classList.toggle('on', x.dataset.pv === name));
    $('#pvNote').textContent = DEVICE_NOTE[name] || '';
    const f = $('#pv'); const want = 'preview.html?device=' + name;
    if (!f.getAttribute('src').endsWith(want)) f.setAttribute('src', want);
    try { localStorage.setItem('dnrb-admin-device', name); } catch {}
    requestAnimationFrame(fitDevice);
  }
  $$('[data-pv]').forEach(b => b.addEventListener('click', () => setDevice(b.dataset.pv)));
  window.addEventListener('resize', fitDevice);
  try { const d = localStorage.getItem('dnrb-admin-device'); if (d && DEVICE_NOTE[d]) setDevice(d); else fitDevice(); } catch { fitDevice(); }

  /* ----- 저장 / 적용 ----- */
  async function save() {
    const r = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '저장 실패');
    cfg = j.config; dirty = false; $('#dirty').hidden = true;
    return j;
  }
  $('#btnSave').addEventListener('click', async () => { try { await save(); toast('저장했어요 (아직 주문서에는 적용 전)'); } catch (e) { toast('저장 실패: ' + e.message); } });
  $('#btnPublish').addEventListener('click', async () => {
    const b = $('#btnPublish'); b.disabled = true; b.textContent = '적용 중…';
    try {
      await save();
      const r = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '설정 적용' }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || '적용 실패');
      toast(j.message || '적용했어요');
      if (!$('.sec[data-sec=deploy]').hidden) loadStatus();
    } catch (e) { toast('적용 실패: ' + e.message); }
    finally { b.disabled = false; b.textContent = '저장 후 적용'; }
  });

  /* ----- 상태 / 설치 / 히스토리 ----- */
  async function loadStatus() {
    const box = $('#statusBox'); box.textContent = '확인 중…';
    try {
      const s = await (await fetch('/api/status')).json();
      const liveAt = s.live ? '읽힘' : '아직 없음';
      box.innerHTML = `
        <div>GitHub 저장소: ${s.remote ? `<span class="ok">연결됨</span> <code>${esc(s.remote)}</code>` : '<span class="bad">아직 연결 안 됨</span> — README 의 "처음 한 번" 순서를 따라주세요'}</div>
        <div>마지막 적용: ${s.lastCommit ? `<code>${esc(s.lastCommit)}</code>` : '없음'}</div>
        <div>적용 안 된 변경: ${s.pendingChanges ? '<span class="bad">있음</span> — "저장 후 적용"을 눌러주세요' : '<span class="ok">없음</span>'}</div>
        <div>주문서가 읽는 설정 파일: <a href="${esc(s.site)}/config.js" target="_blank"><code>${esc(s.site)}/config.js</code></a> — ${s.live ? '<span class="ok">' + liveAt + '</span>' : '<span class="bad">' + liveAt + '</span>'}</div>`;
    } catch (e) { box.innerHTML = `<span class="bad">상태를 읽지 못했어요: ${esc(e.message)}</span>`; }
    try {
      const src = await (await fetch('/api/skin/orderform')).text();
      $('#orderformSrc').textContent = src;
    } catch {}
    try {
      const h = await (await fetch('/api/history')).json();
      $('#history').innerHTML = h.length ? h.map(x => `<div class="h"><span>${esc(x.at.replace('T', ' ').replace(/-(\d\d)-(\d\d)-\d+Z$/, ':$1:$2'))}</span><button class="btn small" data-restore="${esc(x.file)}">이 시점으로 되돌리기</button></div>`).join('') : '<div class="empty">저장 기록이 없어요.</div>';
      $$('[data-restore]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('이 시점의 설정으로 되돌릴까요? (되돌린 뒤 "저장 후 적용"을 눌러야 주문서에 반영돼요)')) return;
        const r = await fetch('/api/history/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: b.dataset.restore }) });
        const j = await r.json(); if (j.ok) { cfg = j.config; bindAll(); renderLists(); sendPreview(); toast('되돌렸어요'); loadStatus(); }
      }));
    } catch {}
  }
  $('#btnRefreshStatus').addEventListener('click', loadStatus);
  $('#btnCopyOrderform').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#orderformSrc').textContent); toast('복사했어요. 카페24 스킨 편집기의 order/orderform.html 에 붙여넣으세요'); }
    catch { toast('복사가 막혔어요. 아래 내용을 직접 드래그해서 복사해 주세요'); }
  });

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ----- 시작 ----- */
  (async function init() {
    META = await (await fetch('/api/meta')).json();
    cfg = await (await fetch('/api/config')).json();
    renderModes();
    bindAll();
    renderLists();
    showSec((location.hash || '#theme').slice(1));
    sendPreview();
  })();
})();
