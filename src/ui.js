/* Echo Rush — 메타 화면 (상점 / 캐릭터 / 도전 과제·미션 / 백업) */
(function () {
  'use strict';
  const M = Meta;
  const $ = (id) => document.getElementById(id);
  let save = M.load(window.localStorage);

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function ensureDaily() {
    const t = today();
    if (save.daily.date !== t) save.daily = { date: t, missions: M.dailyMissions(t) };
    if (M.refillMissions(save)) M.persist(window.localStorage, save);   // 예전에 끝난 미션이 남아 있으면 새 미션으로
  }
  function commit() { M.persist(window.localStorage, save); refresh(); }
  function refresh() {
      $('coins').textContent = M.fmtNum(save.coins); $('pcoins').textContent = M.fmtNum(save.coins);
      const w = M.WORLDS[save.worlds.selected] || M.WORLDS.school;
      $('bWorld').textContent = `🗺️ 월드: ${w.emoji} ${w.name}` + (save.cycle > 0 ? ` · 🔁 ${save.cycle + 1}회차` : '');
      drawOutfit();
      badges();
      // 이번 월드의 큰 도전에 필요한 에코: 지금 몇 명 모였는지 (에코를 모아야 넘는다는 걸 한눈에)
      if (window.GameEchoes) {
        const need = w.boss.needEchoes, have = GameEchoes.world() === w.id ? GameEchoes.count() : 0;
        $('echoLine').textContent = `👻 에코 ${have} / ${need}명` + (have >= need ? ' ✅' : '');
        $('echoLine').style.color = have >= need ? '#7dffb2' : '#9fdcff';
      }
    }

  /** 시작 화면: 이번 회차 복장 미리보기 + 이름 (회차마다 장식이 늘고, 5회차마다 새 복장) */
  function drawOutfit() {
    const cv = $('outfitPv'); if (!cv || !window.Art || !window.EchoWorlds) return;
    const of = EchoWorlds.outfitOf(M.outfitCycle(save));
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    const emo = (M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student).emoji;
    if (Art.setLook) Art.setLook(save.look);
    if (Art.setColor) Art.setColor(M.kidColor(save));
    if (Art.setSkin) Art.setSkin(M.kidSkin(save));
    if (Art.setHair) Art.setHair(M.kidHair(save));
    c.setTransform(2, 0, 0, 2, 0, 0); Art.drawKidPreview(c, 28, 38, emo, M.outfitCycle(save), 1.15);
    $('outfitName').textContent = `${of.name} ${'★'.repeat(of.stars)}${of.variant ? ` · 색 ${of.variant + 1}` : ''}`;
    const t = M.titleOf(M.deedScore(save)).title;
    $('titleLine').textContent = M.deedScore(save) > 0 ? `${t.icon} ${t.name}` : '';
  }

  /* ---------- 내 모습: 지금 캐릭터 크게 + 복장 지도 ---------- */
  /** 캔버스에 회차 cycle의 복장을 그린다. locked면 검은 실루엣 */
  function paintOutfit(cv, cycle, scale, locked, charId, origColor) {
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    if (!window.Art) return;
    const emo = (M.CHARACTERS[charId || save.chars.selected] || M.CHARACTERS.student).emoji;   // 캐릭터 종류(고유 표시)를 고르는 열쇠로만 씀, 화면엔 그림으로
    const k = cv.width / 56;   // 56 x 70 논리 크기 기준
    if (Art.setLook) Art.setLook(save.look);
    if (Art.setColor) Art.setColor(origColor ? null : M.kidColor(save));
    if (Art.setSkin) Art.setSkin(M.kidSkin(save));
    if (Art.setHair) Art.setHair(M.kidHair(save));
    c.setTransform(k, 0, 0, k, 0, 0); Art.drawKidPreview(c, 28, 38, emo, cycle, scale);
    if (locked) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,12,24,.92)'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over'; }
  }
  let lookPreview = null, lookTab = 'outfit';   // 지도에서 눌러 본 회차 (없으면 지금 회차)
  function renderLook() {
    const body = $('pbody'); body.innerHTML = '';
    const top = M.topCycle(save), cur = M.outfitCycle(save), show = lookPreview === null ? cur : lookPreview;
    const of = EchoWorlds.outfitOf(show), ch = M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student;
    // 1) 지금 내 캐릭터 크게
    const box = el('div', 'look');
    const big = el('canvas'); big.width = 320; big.height = 400; box.appendChild(big);
    const ln = el('div', 'ln'); ln.innerHTML = Icons.svg('shirt', 17) + `<span> ${of.name} ${'★'.repeat(of.stars)}</span>`; box.appendChild(ln);
    const t = M.titleOf(M.deedScore(save)).title;
    box.appendChild(el('small', '', `${ch.name} Lv${M.charLevel(save, ch.id)}${of.variant ? ` · 🎨 색 ${of.variant + 1}` : ''}${M.deedScore(save) > 0 ? ` · ${t.icon} ${t.name}` : ''}`));
    if (show !== cur) {
      box.appendChild(el('small', '', `👀 미리보기 중 · ${show + 1}회차 모습 (파란 테두리)`));
      const row = el('div', 'row');
      const wear = el('button', ''); wear.innerHTML = Icons.svg('shirt', 16) + '<span>이 옷 입기</span>'; wear.style.minWidth = '0'; wear.style.padding = '8px 14px'; wear.style.fontSize = '14px';
      wear.onclick = () => { M.pickOutfit(save, show); lookPreview = null; Sfx.play('levelup'); commit(); rerender(); };
      const back = el('button', 'sub', '↩ 돌아가기'); back.onclick = () => { lookPreview = null; Sfx.play('click'); rerender(); };
      row.append(wear, back); box.appendChild(row);
    } else {
      box.appendChild(el('small', '', save.outfitPick === null ? '✓ 입는 중 · 회차 복장 자동' : '✓ 입는 중 · 직접 고른 복장'));
      if (save.outfitPick !== null) {
        const auto = el('button', 'sub', '🔁 회차 복장으로 (자동)');
        auto.onclick = () => { M.pickOutfit(save, null); Sfx.play('click'); commit(); rerender(); };
        box.appendChild(auto);
      }
    }
    // 남자 / 여자 주인공 고르기
    const gRow = el('div', 'row lookSex');
    for (const [id, label] of [['boy', '👦 남자'], ['girl', '👧 여자']]) {
      const b = el('button', (save.look || 'boy') === id ? '' : 'sub', label);
      b.style.minWidth = '0'; b.style.padding = '8px 16px'; b.style.fontSize = '14px';
      b.onclick = () => { if ((save.look || 'boy') === id) return; save.look = id; Sfx.play('click'); commit(); rerender(); };
      gRow.appendChild(b);
    }
    box.insertBefore(gRow, ln);
    // 옷 색 고르기: [원래 색] + 6색 (게임 속 신호색과 겹치지 않는 색만)
    const cRow = el('div', 'kcol');
    const mk = (idx, bg, title) => {
      const b = el('button', 'sw' + ((save.color === undefined ? null : save.color) === idx ? ' on' : ''));
      b.title = title; b.setAttribute('aria-label', '옷 색: ' + title); b.style.background = bg;
      b.onclick = () => { if (save.color === idx) return; save.color = idx; Sfx.play('click'); commit(); rerender(); };
      cRow.appendChild(b);
    };
    const orig = EchoWorlds.outfitOf(show);
    mk(null, 'conic-gradient(#4561d6 0 25%, #e2574c 0 50%, #8e7cc3 0 75%, #f48fb1 0)', '원래 색 (복장마다 달라요)');
    M.KID_COLORS.forEach((c, i) => mk(i, c.hex, c.name));
    box.insertBefore(cRow, ln);
    const cName = save.color === null || save.color === undefined ? `원래 색 (${orig.name})` : M.KID_COLORS[save.color].name;
    box.insertBefore(el('small', '', '🎨 옷 색 · ' + cName), ln);
    // 얼굴(피부) 색 고르기
    const sRow = el('div', 'kcol');
    const curSkin = M.KID_SKINS[save.skin] ? save.skin : 0;
    M.KID_SKINS.forEach((c, i) => {
      const b = el('button', 'sw' + (curSkin === i ? ' on' : '')); b.title = c.name; b.setAttribute('aria-label', '얼굴 색: ' + c.name); b.style.background = c.hex;
      b.onclick = () => { if (curSkin === i) return; save.skin = i; Sfx.play('click'); commit(); rerender(); };
      sRow.appendChild(b);
    });
    box.insertBefore(sRow, ln);
    box.insertBefore(el('small', '', '🙂 얼굴 색 · ' + M.KID_SKINS[curSkin].name), ln);
    // 머리 색 고르기
    const hRow = el('div', 'kcol');
    const curHair = M.KID_HAIRS[save.hair] ? save.hair : 0;
    M.KID_HAIRS.forEach((c, i) => {
      const b = el('button', 'sw' + (curHair === i ? ' on' : '')); b.title = c.name; b.setAttribute('aria-label', '머리 색: ' + c.name); b.style.background = c.hex;
      b.onclick = () => { if (curHair === i) return; save.hair = i; Sfx.play('click'); commit(); rerender(); };
      hRow.appendChild(b);
    });
    box.insertBefore(hRow, ln);
    box.insertBefore(el('small', '', '💇 머리 색 · ' + M.KID_HAIRS[curHair].name), ln);
    body.appendChild(box);
    paintOutfit(big, show, 1.3, false);
    tabs(body, [{ id: 'outfit', html: Icons.svg('shirt', 16) + '<span>복장</span>' }, { id: 'char', html: Icons.svg('person', 16) + '<span>캐릭터</span>' }, { id: 'echo', html: '<span>✨ 에코</span>' }], lookTab, (id) => { lookTab = id; rerender(); });
    if (lookTab === 'char') { renderChars(body); return; }
    if (lookTab === 'echo') { renderEchoForms(body); return; }
    // 2) 나의 업적: 지금까지 얻은 복장만 보여 준다 (앞으로 나올 복장은 비밀)
    const owned = [];
    for (let c = Math.min(top, 999); c >= 0; c--) {   // 복장(스타일·색)별로 가장 많이 꾸민 단계 하나씩
      const o = EchoWorlds.outfitOf(c), id = o.style + '.' + o.variant;
      if (!owned.some((x) => x.id === id)) owned.push({ id, cycle: c, o });
    }
    owned.sort((a, b) => a.cycle - b.cycle);
    body.appendChild(el('div', 'msg', `🏅 지금까지 얻은 복장 ${owned.length}벌`));
    const map = el('div', 'omap');
    for (const it of owned) {
      const isCur = EchoWorlds.outfitOf(cur).style === it.o.style && EchoWorlds.outfitOf(cur).variant === it.o.variant;
      const sv = EchoWorlds.outfitOf(show), isPv = show !== cur && sv.style === it.o.style && sv.variant === it.o.variant;
      const card = el('div', 'oc' + (isCur ? ' cur' : '') + (isPv ? ' pv' : ''));
      const cv = el('canvas'); cv.width = 96; cv.height = 120; card.appendChild(cv);
      card.appendChild(el('div', '', it.o.name + (it.o.variant ? ` 🎨${it.o.variant + 1}` : '')));
      card.appendChild(el('div', 'st', '★'.repeat(it.o.stars)));
      paintOutfit(cv, it.cycle, 1, false, null, true);
      card.onclick = () => { lookPreview = it.cycle === cur ? null : it.cycle; Sfx.play('click'); rerender(); };   // 화면 위치는 그대로
      map.appendChild(card);
    }
    body.appendChild(map);
    // 3) 과거의 나 · 복장 도감: 회차마다 입었던 복장을 장식 단계까지 모두 (복장별 한 줄, 얻은 단계만)
    const upto = Math.min(top, 999), from = Math.max(0, upto - 99);   // 너무 많으면 최근 100회차
    body.appendChild(el('div', 'msg', `📖 과거의 나 · 복장 도감 (1~${upto + 1}회차${from ? ` 중 최근 100` : ''})`));
    const rows = [];
    for (let c = from; c <= upto; c++) { const o = EchoWorlds.outfitOf(c), id = o.style + '.' + o.variant; let row = rows.find((r) => r.id === id); if (!row) rows.push(row = { id, o, cycles: [] }); row.cycles.push(c); }
    for (const row of rows) {
      const line = el('div', 'dex');
      line.appendChild(el('div', 'dn', row.o.name + (row.o.variant ? ` 🎨${row.o.variant + 1}` : '')));
      const cells = el('div', 'dc');
      for (const c of row.cycles) {
        const o = EchoWorlds.outfitOf(c), cell = el('div', 'dx' + (c === cur ? ' cur' : '') + (c === show && show !== cur ? ' pv' : ''));   // 노랑 = 입는 중, 파랑 = 미리보는 중
        const cv = el('canvas'); cv.width = 64; cv.height = 80; cell.appendChild(cv);
        cell.appendChild(el('small', '', `${c + 1}회차`)); cell.appendChild(el('div', 'st', '★'.repeat(o.stars)));
        paintOutfit(cv, c, 1, false, null, true);
        cell.onclick = () => { lookPreview = c === cur ? null : c; Sfx.play('click'); rerender(); };   // 화면 위치는 그대로
        cells.appendChild(cell);
      }
      line.appendChild(cells); body.appendChild(line);
    }
  }

  /* ---------- 선행: 칭호 · 도감 ---------- */
  const TITLE_ART = { '🌱': 'sprout', '🙂': 'smile', '🤝': 'hands', '💛': 'heart', '☀️': 'sun', '🦸': 'hero', '🌈': 'rainbow', '👼': 'angel' };
  /** 캔버스 그림 → 작은 이미지 (선행 소품·사람·칭호) */
  function pic(draw, w, h, dispH, cls) {
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d'); g.scale(2, 2); if (window.Art) draw(g);
    const im = document.createElement('img'); im.src = c.toDataURL(); im.alt = ''; im.className = 'pic' + (cls ? ' ' + cls : ''); im.style.height = dispH + 'px';
    return im;
  }
  const deedPic = (kind, px) => pic((g) => window.Art.drawDeed(g, kind, 14, 14, 24), 28, 28, px);
  const personPic = (kind, px) => pic((g) => window.Art.drawHelper(g, 'npc:' + kind, 18, 30), 36, 60, px);
  const titlePic = (icon, px) => deedPic(TITLE_ART[icon] || 'heart', px);
  /** 글 사이에 그림을 섞어 한 줄로: ['글', node, '글'] */
  function mix(cls, parts) { const d = el('div', cls); for (const p of parts) d.appendChild(typeof p === 'string' ? document.createTextNode(p) : p); return d; }
  function renderDeeds() {
    const body = $('pbody'); body.innerHTML = '';
    const sc = M.deedScore(save), tt = M.titleOf(sc), d = save.deeds;
    const top = item(titlePic(tt.title.icon, 30), tt.title.name, '',
      { progress: tt.next ? (sc - tt.title.at) / (tt.next.at - tt.title.at) : 1, done: !tt.next });
    const sm = top.querySelector('.grow');
    sm.insertBefore(tt.next ? mix('sm', ['다음 ', titlePic(tt.next.icon, 16), ` ${tt.next.name}까지 `, deedPic('heart', 13), ` ${tt.next.at - sc}`]) : el('small', '', '최고 칭호에 도달했어요!'), sm.querySelector('.bar'));
    body.appendChild(top);
    body.appendChild(mix('msg deedline', [personPic('child', 26), ` ${d.people}명 `, personPic('friend', 26), ` ${d.escorts}명 `, deedPic('teddy', 18), ` ${d.spots}개`]));
    const book = M.deedBook(save), got = book.filter((b) => b.count > 0).length;
    body.appendChild(el('div', 'msg', `선행 도감 ${got} / ${book.length}`));
    const grid = el('div', 'book');
    grid.appendChild(el('div', 'wn', ''));
    for (const k of M.DEED_KINDS) { const c = el('div', 'cell head'); c.appendChild(personPic(k, 40)); c.title = M.DEED_KIND_INFO[k].name; grid.appendChild(c); }
    for (const w of M.WORLD_ORDER) {
      const wd = M.WORLDS[w];
      const open = M.worldUnlocked(save, w);
      const wn = el('div', 'wn');
      if (open) wn.appendChild(pic((g) => window.Art.drawWorld(g, w, 14, 14, 24), 28, 28, 22)); else { const lk = el('span', 'lk'); lk.innerHTML = window.Icons ? window.Icons.svg('lock', 18) : ''; wn.appendChild(lk); }
      wn.appendChild(document.createTextNode(open ? ` ${wd.name}` : ' ???'));
      grid.appendChild(wn);
      for (const k of M.DEED_KINDS) {
        const n = (book.find((b) => b.world === w && b.kind === k) || {}).count || 0;
        const c = el('div', 'cell' + (n ? ' got' : ''));
        if (n) { c.appendChild(personPic(k, 30)); c.appendChild(el('small', '', `×${n}`)); } else c.textContent = '?';
        grid.appendChild(c);
      }
    }
    body.appendChild(grid);
    body.appendChild(el('div', 'msg', '칭호'));
    for (const t of M.TITLES) {
      const on = sc >= t.at, ic = on ? titlePic(t.icon, 32) : el('span', 'lk'); if (!on) ic.innerHTML = window.Icons ? window.Icons.svg('lock', 22) : '';
      const row = item(ic, t.name, '', { done: on });
      row.querySelector('.grow').appendChild(mix('sm', [deedPic('heart', 13), ` ${t.at}`]));
      body.appendChild(row);
    }
  }
  /** 탭 줄: [{id, label}] 중 cur 를 강조, 누르면 onPick(id) */
  function tabs(body, list, cur, onPick) {
    const row = el('div', 'tabs');
    for (const t of list) { const b = el('button', cur === t.id ? 'on' : ''); b.innerHTML = t.html || ''; if (!t.html) b.textContent = t.label; b.onclick = () => { if (cur !== t.id) { Sfx.play('click'); onPick(t.id); } }; row.appendChild(b); }
    body.appendChild(row);
  }
  // 새 소식 빨간 점: 마지막으로 본 칭호·도전 과제 수 (기기에 저장)
  let seen = { title: '', ach: 0 };
  try { seen = Object.assign(seen, JSON.parse(localStorage.getItem('echo-seen') || '{}')); } catch (e) { /* 무시 */ }
  const saveSeen = () => { try { localStorage.setItem('echo-seen', JSON.stringify(seen)); } catch (e) { /* 무시 */ } };
  function badges() {
    const top = M.topCycle(save);
    const shopNew = M.SHOP.some((it) => { const lv = M.shopLevel(save, it.id); return lv < M.shopMax(save, it.id) && M.shopCost(it.id, lv, top) <= save.coins; })
      || M.GEAR_ITEMS.some((g) => M.gearAvailable(save, g.world) && M.gearLevel(save, g.id) < M.gearMax(save) && M.gearCost(save, g.id) <= save.coins);
    const charNew = Object.keys(M.CHARACTERS).some((id) => save.chars.unlocked.indexOf(id) < 0 && M.charReqMet(save, id) && M.CHARACTERS[id].cost <= save.coins);
    const titleNow = M.titleOf(M.deedScore(save)).title.name, achNow = M.ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
    if (!seen.title && M.deedScore(save) === 0) seen.title = titleNow;
    const deedNew = titleNow !== seen.title, questNew = achNow > seen.ach;
    const set = (id, on) => { const b = $(id); if (b) b.classList.toggle('badge', !!on); };
    set('bShop', shopNew); set('bLook', charNew); set('bDeed', deedNew); set('bQuest', questNew);
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function item(icon, title, desc, opts) {
    opts = opts || {};
    const row = el('div', 'item' + (opts.done ? ' done' : '') + (opts.sel ? ' sel' : ''));
    const ic = el('div', 'icon'); if (icon && icon.nodeType) ic.appendChild(icon); else ic.textContent = icon; row.appendChild(ic);
    const g = el('div', 'grow'); g.appendChild(document.createTextNode(title));
    if (desc) g.appendChild(el('small', '', desc));
    if (opts.progress !== undefined) { const b = el('div', 'bar'); const i = el('i'); i.style.width = Math.round(opts.progress * 100) + '%'; b.appendChild(i); g.appendChild(b); }
    row.appendChild(g);
    return row;
  }

  /* ---------- 패널 공통 ---------- */
  let currentRender = null;
  function openPanel(title, render) {
    $('start').classList.add('hidden'); $('panel').classList.remove('hidden');
    $('ptitle').textContent = title; currentRender = render; render(); refresh();
    $('panel').scrollTop = 0;
  }
  function rerender() { const top = $('panel').scrollTop; if (currentRender) currentRender(); refresh(); $('panel').scrollTop = top; }
  function closePanel() { $('panel').classList.add('hidden'); $('start').classList.remove('hidden'); currentRender = null; refresh(); }

  /* ---------- 월드 선택 ---------- */
  let armedWorld = null;
  function renderWorlds() {
    const body = $('pbody'); body.innerHTML = '';
    for (const id of M.WORLD_ORDER) {
      const w = M.WORLDS[id];
      const open = M.worldUnlocked(save, id);
      const sel = save.worlds.selected === id;
      const clears = save.worlds.clears[id] || 0, best = Math.floor(save.worlds.best[id] || 0);
      const prev = w.unlock ? M.WORLDS[w.unlock.world] : null;
      const rec = M.recommendedGear(id, save.cycle), gt = M.gearTotals(save);
      // 글은 최소한: 왕 수 · 필요 에코 · 장비 상태 한 줄 (자세한 규칙은 게임 안에서)
      const gearOk = gt.atk >= rec.atk && gt.def >= rec.def;
      const desc = open
        ? `🏁 왕 ${w.boss.times.length} · 👻 ${w.boss.needEchoes}명` + (rec.atk + rec.def ? ` · 🧰${gearOk ? '✅' : '⚠'}` : '') + (clears ? ` · ⭐${clears}` : '')
        : `🔒 ${prev.emoji} ${prev.name} 극복 시 열림`;
      const row = item(open ? w.emoji : '🔒', w.name, desc, { done: open && !sel, sel });
      row.querySelector('small').style.whiteSpace = 'pre-line';
      const b = el('button', '', sel ? '선택됨' : open ? '선택' : '잠김');
      b.disabled = sel || !open;
      b.onclick = () => {
        // 다른 월드로 옮기면 지금까지 쌓은 에코가 사라진다 → 한 번 더 눌러 확인
        const losing = GameEchoes.count() > 0 && GameEchoes.world() !== id;
        if (losing && armedWorld !== id) { armedWorld = id; b.textContent = `⚠ 에코 ${GameEchoes.count()}명 초기화`; return; }
        if (M.selectWorld(save, id)) { if (GameEchoes.world() !== id) GameEchoes.reset(id); armedWorld = null; Sfx.play('click'); commit(); rerender(); }
      };
      row.appendChild(b); body.appendChild(row);
    }
    // 회차 고르기: 열린 회차 중에서 ◀ ▶ 로 고른다. 새로 열린 회차가 있으면 바로 넘어가는 버튼
    const top = M.topCycle(save);
    if (top > 0) {
      const box = el('div', 'cyc');
      const prev = el('button', 'sub', '◀'), next = el('button', 'sub', '▶');
      const cv = el('div', 'cv', `🔁 ${save.cycle + 1}회차`);
      cv.appendChild(el('small', '', save.cycle < top ? `끝낸 회차 · 모든 월드 열림 (열린 회차 1~${top + 1})` : `지금 도전 중인 회차 · 적이 더 강해요`));
      prev.disabled = save.cycle <= 0; next.disabled = save.cycle >= top;
      const go = (c) => { if (M.selectCycle(save, c)) { if (GameEchoes.world() !== save.worlds.selected) GameEchoes.reset(save.worlds.selected); Sfx.play('click'); commit(); rerender(); } };
      prev.onclick = () => go(save.cycle - 1); next.onclick = () => go(save.cycle + 1);
      box.append(prev, cv, next);
      const nodes = [box];
      if (save.cycle < top) { const b = el('button', '', `🆕 ${top + 1}회차로 넘어가기 ▶`); b.style.background = '#ff8c42'; b.onclick = () => go(top); nodes.push(b); }
      nodes.reverse().forEach((n) => body.insertBefore(n, body.firstChild));
    }
    body.appendChild(el('div', 'msg', '※ 월드를 옮기면 에코는 새로 시작해요'));
  }

  /* ---------- 상점 ---------- */
  let shopTab = 'basic';
  function renderShop() {
    const body = $('pbody'); body.innerHTML = '';
    tabs(body, [{ id: 'basic', label: '기본 강화' }, { id: 'gear', label: '🧰 장비' }], shopTab, (id) => { shopTab = id; rerender(); $('panel').scrollTop = 0; });
    if (shopTab === 'gear') { renderGear(body); return; }
    body.appendChild(el('div', 'msg', '모든 월드 공통' + (M.topCycle(save) > 0 ? ` · 🔁 ${M.topCycle(save) + 1}회차 가격` : '')));
    for (const it of M.SHOP) {
      const lv = M.shopLevel(save, it.id);
      const mx = M.shopMax(save, it.id), maxed = lv >= mx;
      const cost = maxed ? 0 : M.shopCost(it.id, lv, M.topCycle(save));
      const row = item(it.icon, `${it.name}  Lv ${lv}/${mx}`,
        `${it.fmt(M.shopEffect(it.id, lv))} → ${maxed ? (it.grow ? '최대 (회차가 오르면 더)' : '최대') : it.fmt(M.shopEffect(it.id, lv + 1))}`, { done: maxed, progress: lv / mx });
      const b = el('button', '', maxed ? '최대' : `🎓 ${M.fmtNum(cost)}`);
      b.disabled = maxed || save.coins < cost;
      b.onclick = () => { if (M.buyUpgrade(save, it.id).ok) { Sfx.play('levelup'); commit(); rerender(); } };
      row.appendChild(b); body.appendChild(row);
    }
  }

  function renderGear(body) {
    const gt = M.gearTotals(save), max = M.gearMax(save);
    const sel = save.worlds.selected, rec = M.recommendedGear(sel, save.cycle);
    body.appendChild(el('div', 'msg', `🧰 월드 매점 · 장비는 에코에게도 적용돼요 (최대 Lv ${max}${save.cycle > 0 ? ` · ${save.cycle + 1}회차` : ''})`));
    body.appendChild(el('div', 'msg', `내 장비 ⚔${gt.atk} 🛡${gt.def} · ${M.WORLDS[sel].emoji} ${M.WORLDS[sel].name} 권장 ⚔${rec.atk} 🛡${rec.def}` + (gt.atk < rec.atk || gt.def < rec.def ? ' ⚠' : ' ✅')));
    let lockedShown = false;
    const order = [sel].concat(M.WORLD_ORDER.filter((x) => x !== sel));   // 지금 월드 장비를 맨 위에
    for (const wid of order) {
      const w = M.WORLDS[wid];
      if (!M.gearAvailable(save, wid)) {
        if (!lockedShown) { body.appendChild(item('🔒', `${w.emoji} ${w.name} 매점`, `${w.name}에 도착하면 새 장비를 살 수 있어요`)); lockedShown = true; }
        continue;
      }
      for (const g of M.GEAR_ITEMS.filter((x) => x.world === wid)) {
        const lv = M.gearLevel(save, g.id), maxed = lv >= max;
        const cost = maxed ? 0 : M.gearCost(save, g.id);
        const row = item(g.icon, `${w.emoji} ${g.name}  ${g.kind === 'atk' ? '⚔' : '🛡'} Lv ${lv}/${max}`,
          `${M.gearText(g.kind, lv)} → ${maxed ? '최대' : M.gearText(g.kind, lv + 1)}`, { done: maxed, progress: lv / max });
        const b = el('button', '', maxed ? '최대' : `🎓 ${M.fmtNum(cost)}`);
        b.disabled = maxed || save.coins < cost;
        b.onclick = () => { if (M.buyGear(save, g.id).ok) { Sfx.play('levelup'); commit(); rerender(); } };
        row.appendChild(b); body.appendChild(row);
      }
    }
  }

  /* ---------- 에코 모습 ---------- */
  /** 에코(과거의 나) 모습 고르기: 학점으로 순서대로 하나씩 열고, 뒤에 열수록 에코가 조금씩 강해진다 */
  function renderEchoForms(body) {
    const own = save.echo.owned, cur = M.echoForm(save), nx = M.nextEchoForm(save);
    body.appendChild(el('div', 'msg', `✨ 에코 모습 ${own.length} / ${M.ECHO_FORMS.length} · 학점으로 순서대로 하나씩 열려요 · 뒤에 열수록 에코 공격력이 강해져요`));
    const curF = M.ECHO_FORMS[M.echoFormIndex(cur)];
    body.appendChild(el('div', 'msg', `지금 함께하는 에코: ${curF.name} · 에코 공격 +${Math.round(M.echoFormPower(M.echoFormIndex(cur)) * 100)}%`));
    const map = el('div', 'omap');
    M.ECHO_FORMS.forEach((f, i) => {
      const has = own.indexOf(f.id) >= 0, isNext = nx && nx.form.id === f.id;
      const card = el('div', 'oc' + (f.id === cur ? ' cur' : '') + (!has && !isNext ? ' lock' : ''));
      const cv = el('canvas'); cv.width = 96; cv.height = 120; card.appendChild(cv);
      card.appendChild(el('div', '', has || isNext ? f.name : '???'));
      card.appendChild(el('small', '', `공격 +${Math.round(M.echoFormPower(i) * 100)}%`));
      if (window.Art && Art.drawEchoForm) {
        const c = cv.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0);
        Art.drawEchoForm(c, f.id, 24, 32, 1.45, 0.4 + i * 0.37);
        if (!has) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = isNext ? 'rgba(20,22,40,.55)' : 'rgba(10,12,24,.92)'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over'; }
      }
      if (has) {
        card.title = f.desc;
        card.onclick = () => { if (f.id === cur) return; M.pickEchoForm(save, f.id); Sfx.play('click'); commit(); rerender(); };
      } else if (isNext) {
        const b = el('button', '', `🎓 ${M.fmtNum(nx.cost)}`); b.style.minWidth = '0'; b.style.padding = '3px 6px'; b.style.fontSize = '11px'; b.style.marginTop = '2px';
        b.disabled = save.coins < nx.cost;
        b.onclick = (e) => { e.stopPropagation(); if (M.buyEchoForm(save).ok) { Sfx.play('levelup'); commit(); rerender(); } };
        card.appendChild(b);
      } else card.appendChild(el('small', '', '🔒'));
      map.appendChild(card);
    });
    body.appendChild(map);
    if (curF) body.appendChild(el('div', 'msg', `💬 ${curF.name}: ${curF.desc}`));
  }

  /* ---------- 캐릭터 ---------- */
  /** 캐릭터 고르기 (내 캐릭터 화면 아래쪽에 붙는다): 등급별로 묶고, 조건(업적)·학점·레벨을 보여 준다 */
  function renderChars(body) {
    const owned = save.chars.unlocked.length, total = Object.keys(M.CHARACTERS).length;
    { const h = el('div', 'msg'); h.innerHTML = Icons.svg('person', 15) + `<span> 캐릭터 ${owned} / ${total} · 학점을 모아 사고, 레벨을 올려 더 강하게 (최대 Lv ${M.CHAR_MAX_LV})</span>`; body.appendChild(h); }
    for (const rk of Object.keys(M.RARITY)) {
      const R = M.RARITY[rk];
      const head = el('div', 'msg', `◆ ${R.name}`); head.style.color = R.color; head.style.alignSelf = 'flex-start'; head.style.fontWeight = '700';
      body.appendChild(head);
      for (const id in M.CHARACTERS) {
        const c = M.CHARACTERS[id]; if (c.rarity !== rk) continue;
        const has = save.chars.unlocked.indexOf(id) >= 0, selected = save.chars.selected === id, lv = M.charLevel(save, id);
        const reqOk = M.charReqMet(save, id);
        // 보이는 정보: 가진 캐릭터는 레벨과 효과, 못 가진 캐릭터는 조건과 값
        const stars = has ? ' ' + '★'.repeat(lv) + '☆'.repeat(M.CHAR_MAX_LV - lv) : '';
        let sub = c.desc;
        if (!has && c.req) sub += `\n${reqOk ? '✓ 조건 충족' : '· 조건'}: ${c.req.text.replace(/^[^\s가-힣]+\s/, '').replace(/ · [^\s가-힣]+\s/g, ' · ')}`;
        if (has && lv < M.CHAR_MAX_LV) sub += c.lvOnly ? '\n다음 레벨: 체력 +6, 공격 +4%' : `\n다음 레벨: 좋은 효과 +25%${lv + 1 === 3 || lv + 1 === 5 ? ' · 시작 아이템 +1' : ''}`;
        // 이모지 대신 실제 게임 속 모습(지금 입은 복장 + 캐릭터 고유 표시)을 그려서 보여 준다
        const pv = el('canvas'); pv.width = 112; pv.height = 140; pv.style.cssText = 'width:52px;height:65px;background:transparent;border-radius:0';
        paintOutfit(pv, M.outfitCycle(save), 1.75, false, id);
        if (!has && !reqOk) pv.style.opacity = '0.45';
        const row = item(pv, `${c.name}${stars}`, sub, { done: has && !selected, sel: selected });
        row.style.borderColor = selected ? '' : (has ? '' : R.color + '88');
        row.querySelector('small').style.whiteSpace = 'pre-line';
        const btns = el('div', ''); btns.style.display = 'flex'; btns.style.flexDirection = 'column'; btns.style.gap = '4px';
        if (!has) {
          const b = el('button', ''); b.innerHTML = reqOk ? Icons.svg('cap', 16) + `<span>${M.fmtNum(c.cost)}</span>` : Icons.svg('lock', 15) + '<span>잠김</span>';
          b.disabled = !reqOk || save.coins < c.cost;
          b.onclick = () => { if (M.unlockCharacter(save, id).ok) { M.selectCharacter(save, id); Sfx.play('levelup'); commit(); rerender(); } };
          btns.appendChild(b);
        } else {
          const sel = el('button', '', selected ? '사용 중' : '선택'); sel.disabled = selected;
          sel.onclick = () => { M.selectCharacter(save, id); Sfx.play('click'); commit(); rerender(); };
          btns.appendChild(sel);
          if (lv < M.CHAR_MAX_LV) {
            const cost = M.charLevelCost(save, id), up = el('button', 'sub'); up.innerHTML = Icons.svg('up', 13) + Icons.svg('cap', 13) + `<span>${M.fmtNum(cost)}</span>`;
            up.disabled = save.coins < cost; up.style.fontSize = '11px'; up.style.padding = '5px 6px';
            up.onclick = () => { if (M.levelUpCharacter(save, id).ok) { Sfx.play('levelup'); commit(); rerender(); } };
            btns.appendChild(up);
          }
        }
        row.appendChild(btns); body.appendChild(row);
      }
    }
    body.appendChild(el('div', 'msg', '※ 시작 아이템은 에코에게도 그대로 전달돼요'));
  }

  /* ---------- 도전 과제 · 일일 미션 ---------- */
  function renderQuests() {
    ensureDaily();
    const body = $('pbody'); body.innerHTML = '';
    // 1) 진행 중인 미션 (끝내면 바로 새 미션이 생김)
    body.appendChild(el('div', 'msg', '🎯 미션 · 하나를 끝내면 바로 새 미션이 생겨요'));
    for (const m of save.daily.missions) {
      body.appendChild(item('🎯', M.missionText(m), `${Math.min(m.progress, m.target)} / ${m.target} · 보상 🎓 ${M.fmtNum(m.reward)}`, { progress: Math.min(1, m.progress / m.target) }));
    }
    // 2) 아직 못 한 도전 과제
    const got = M.ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
    body.appendChild(el('div', 'msg', `🏆 도전 과제 ${got} / ${M.ACHIEVEMENTS.length}`));
    for (const a of M.ACHIEVEMENTS) if (!save.ach[a.id]) body.appendChild(item(a.icon, a.name, `${a.desc} · 보상 🎓 ${a.reward}`));
    // 3) 끝낸 것은 아래로: 오늘 끝낸 미션 · 달성한 도전 과제
    const hist = (save.daily.history || []).slice().reverse();
    if (hist.length || got) body.appendChild(el('div', 'msg', '✅ 완료'));
    for (const m of hist) body.appendChild(item('✅', M.missionText(m), `미션 완료 · 🎓 ${M.fmtNum(m.reward)}`, { done: true }));
    for (const a of M.ACHIEVEMENTS) if (save.ach[a.id]) body.appendChild(item('✅', a.name, `${a.desc} · 🎓 ${a.reward}`, { done: true }));
    const st = save.stats;
    body.appendChild(el('div', 'msg', `통계: ${st.runs}판 · 물리친 방해 ${st.kills} · 보스 극복 ${st.clears} · 도움 ${st.helped || 0}회 · 최장 ${Math.floor(st.bestTime)}초 · 최고 Lv ${st.bestLevel}`));
  }

  /* ---------- 백업 ---------- */
  function renderBackup() {
    const body = $('pbody'); body.innerHTML = '';
    const pool = GameEchoes.pool();
    body.appendChild(el('div', 'msg', `서버 저장이 생기기 전까지, 기기를 바꿀 때 이 코드를 옮겨 주세요. (학점·강화·캐릭터·과제 기록 + 👻 ${M.WORLDS[pool.world] ? M.WORLDS[pool.world].name : ''} 에코 ${pool.echoes.length}명)`));
    const out = el('textarea'); out.readOnly = true; out.value = M.exportCode(save, pool);
    body.appendChild(out);
    const msg = el('div', 'msg');
    const copy = el('button', 'sub', '📋 코드 복사');
    copy.onclick = () => {
      out.focus(); out.select();
      let p = null;
      try { p = navigator.clipboard && navigator.clipboard.writeText(out.value); } catch (e) { p = null; }
      if (p && p.then) p.then(() => { msg.textContent = '복사했어요!'; }, () => { msg.textContent = '자동 복사가 막혀 있어요. 선택된 코드를 길게 눌러 복사하세요.'; });
      else msg.textContent = '자동 복사가 안 돼요. 선택된 코드를 길게 눌러 복사하세요.';
    };
    body.appendChild(copy);
    body.appendChild(el('div', 'msg', '불러오기: 코드를 아래에 붙여넣고 버튼을 누르세요. (지금 데이터는 덮어써집니다)'));
    const inp = el('textarea'); inp.placeholder = 'ECHO1:...';
    body.appendChild(inp);
    let armed = false;
    const load = el('button', 'sub', '📥 불러오기');
    load.onclick = () => {
      const r = M.importBackup(inp.value);
      if (!r) { msg.textContent = '올바른 백업 코드가 아니에요.'; armed = false; load.textContent = '📥 불러오기'; return; }
      const echoNote = r.pool ? ` · 👻 ${M.WORLDS[r.pool.world].name} 에코 ${r.pool.echoes.length}명` : ' · (에코 없는 옛 코드: 지금 에코는 그대로 둬요)';
      if (!armed) { armed = true; load.textContent = '⚠ 한 번 더 눌러 덮어쓰기'; msg.textContent = `코드 확인됨: 🎓 ${r.save.coins} 학점${echoNote}. 현재 데이터가 사라집니다.`; return; }
      save = r.save; if (r.pool) GameEchoes.replace(r.pool);
      commit(); armed = false; load.textContent = '📥 불러오기'; rerender();
      $('pbody').appendChild(el('div', 'msg', '불러오기 완료!'));
    };
    body.appendChild(load);
    body.appendChild(msg);
  }

  /* ---------- 연결 ---------- */
  $('bWorld').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🗺️ 월드 선택', renderWorlds); };
  $('bShop').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🏪 상점', renderShop); };
  const openLook = () => { Sfx.unlock(); Sfx.play('click'); lookPreview = null; lookTab = $('bLook').classList.contains('badge') ? 'char' : 'outfit'; openPanel('내 캐릭터', renderLook); };
  $('bLook').onclick = openLook; $('outfitPv').onclick = openLook; $('outfitPv').style.cursor = 'pointer';
  $('bDeed').onclick = () => { Sfx.unlock(); Sfx.play('click'); seen.title = M.titleOf(M.deedScore(save)).title.name; saveSeen(); openPanel('💛 선행', renderDeeds); };
  $('bQuest').onclick = () => { Sfx.unlock(); Sfx.play('click'); seen.ach = M.ACHIEVEMENTS.filter((a) => save.ach[a.id]).length; saveSeen(); openPanel('🏆 과제 · 미션', renderQuests); };
  $('bBackup').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('💾 백업', renderBackup); };
  $('pback').onclick = () => { Sfx.play('click'); closePanel(); };
  for (const e of document.querySelectorAll('.capi')) e.innerHTML = Icons.svg('cap', 18);   // 학점 표시: 이모지 대신 그린 학사모
  refresh();

  window.GameUI = {
    bonus() { return M.bonusFor(save); },
    worldId() { return save.worlds.selected; },
    emoji() { return (M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student).emoji; },
    /** 한 판 결과를 저장하고 요약({earned,total,newAch,missionsDone})을 돌려준다 */
    recordRun(run) { ensureDaily(); const r = M.recordRun(save, run, today()); commit(); return r; },
    tutorialDone() { return save.tutorial === true; },
    /** 선행 점수 (마을이 밝아지는 정도) */
    deedScore() { return M.deedScore(save); },
    /** 지난 판에 도와준 사람이 이번 판에 찾아온다 (한 번만) */
    takeVisitor() { const v = M.takeVisitor(save); if (v) commit(); return v; },
    cycle() { return save.cycle; },
    /** 월드 고르기 (결과 화면의 "다음 월드" 버튼). 월드가 바뀌면 에코는 그 월드에서 새로 시작 */
    selectWorld(id) { if (!M.selectWorld(save, id)) return false; if (window.GameEchoes && GameEchoes.world() !== id) GameEchoes.reset(id); commit(); return true; },
    /** 입고 있는 복장(회차 번호) */
    outfitCycle() { return M.outfitCycle(save); },
    look() { return save.look === 'girl' ? 'girl' : 'boy'; },
    kidColor() { return M.kidColor(save); },
    kidSkin() { return M.kidSkin(save); },
    kidHair() { return M.kidHair(save); },
    echoForm() { return M.echoForm(save); },
    /** 회차 고르기 (결과 화면의 "다음 회차로" 버튼 등) */
    selectCycle(c) { const ok = M.selectCycle(save, c); if (ok) { if (window.GameEchoes && GameEchoes.world() !== save.worlds.selected) GameEchoes.reset(save.worlds.selected); commit(); } return ok; },
    /** 시작하려는 월드에 장비가 모자라면 {atk, def} 부족분, 충분하면 null */
    gearShort(worldId) {
      const rec = M.recommendedGear(worldId, save.cycle), gt = M.gearTotals(save);
      const a = Math.max(0, rec.atk - gt.atk), d = Math.max(0, rec.def - gt.def);
      return a || d ? { atk: a, def: d } : null;
    },
    finishTutorial() { if (!save.tutorial) { save.tutorial = true; commit(); } },
    get save() { return save; },
    refresh,
  };
})();
