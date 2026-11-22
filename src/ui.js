/* Endless Me — 메타 화면 (상점 / 캐릭터 / 도전 과제·미션 / 백업) */
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
  }
  function commit() { M.persist(window.localStorage, save); refresh(); }
  function refresh() {
      $('coins').textContent = M.fmtNum(save.coins); $('pcoins').textContent = M.fmtNum(save.coins);
      const w = M.WORLDS[save.worlds.selected] || M.WORLDS.school;
      $('bWorld').textContent = `🗺️ 월드: ${w.emoji} ${w.name}` + (save.cycle > 0 ? ` · 🔁 ${save.cycle + 1}회차` : '');
      drawOutfit();
    }

  /** 시작 화면: 이번 회차 복장 미리보기 + 이름 (회차마다 장식이 늘고, 5회차마다 새 복장) */
  function drawOutfit() {
    const cv = $('outfitPv'); if (!cv || !window.Art || !window.EchoWorlds) return;
    const of = EchoWorlds.outfitOf(save.cycle);
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    const emo = (M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student).emoji;
    c.setTransform(2, 0, 0, 2, 0, 0); Art.drawKidPreview(c, 28, 38, emo, save.cycle, 1.15);
    $('outfitName').textContent = `👕 ${of.name} ${'★'.repeat(of.stars)}${of.variant ? ` · 색 ${of.variant + 1}` : ''}`;
    const t = M.titleOf(M.deedScore(save)).title;
    $('titleLine').textContent = M.deedScore(save) > 0 ? `${t.icon} ${t.name}` : '';
  }

  /* ---------- 내 모습: 지금 캐릭터 크게 + 복장 지도 ---------- */
  /** 캔버스에 회차 cycle의 복장을 그린다. locked면 검은 실루엣 */
  function paintOutfit(cv, cycle, scale, locked) {
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    if (!window.Art) return;
    const emo = (M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student).emoji;
    const k = cv.width / 56;   // 56 x 70 논리 크기 기준
    c.setTransform(k, 0, 0, k, 0, 0); Art.drawKidPreview(c, 28, 38, emo, cycle, scale);
    if (locked) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,12,24,.92)'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over'; }
  }
  let lookPreview = null;   // 지도에서 눌러 본 회차 (없으면 지금 회차)
  function renderLook() {
    const body = $('pbody'); body.innerHTML = '';
    const top = M.topCycle(save), cur = save.cycle, show = lookPreview === null ? cur : lookPreview;
    const of = EchoWorlds.outfitOf(show), ch = M.CHARACTERS[save.chars.selected] || M.CHARACTERS.student;
    // 1) 지금 내 캐릭터 크게
    const box = el('div', 'look');
    const big = el('canvas'); big.width = 320; big.height = 400; box.appendChild(big);
    box.appendChild(el('div', 'ln', `👕 ${of.name} ${'★'.repeat(of.stars)}${'☆'.repeat(5 - of.stars)}`));
    const t = M.titleOf(M.deedScore(save)).title;
    box.appendChild(el('small', '', `${ch.emoji} ${ch.name} · 🔁 ${show + 1}회차${of.variant ? ` · 🎨 색 ${of.variant + 1}` : ''}${M.deedScore(save) > 0 ? ` · ${t.icon} ${t.name}` : ''}`));
    if (show !== cur) {
      box.appendChild(el('small', '', '👀 미리보기 중'));
      const back = el('button', 'sub', '↩ 지금 내 모습'); back.onclick = () => { lookPreview = null; Sfx.play('click'); rerender(); }; box.appendChild(back);
    }
    body.appendChild(box);
    paintOutfit(big, show, 1.3, false);
    // 2) 복장 지도: 복장 20종 × 장식 5단계 = 100회차 (그 뒤로는 색만 바뀌어 다시)
    const lap = Math.floor(top / 100), base = lap * 100;
    const got = Math.min(100, top - base + 1);
    body.appendChild(el('div', 'msg', `🗺️ 복장 지도 ${got} / 100${lap ? ` · 🎨 색 변형 ${lap + 1}/10` : ''} · 회차마다 장식 ★ 하나, 5회차마다 새 복장`));
    const map = el('div', 'omap');
    for (let s = 0; s < M.OUTFITS.length; s++) {
      const first = base + s * 5, stars = Math.max(0, Math.min(5, top - first + 1)), locked = stars === 0;
      const isCur = Math.floor((cur % 100) / 5) === s && Math.floor(cur / 100) === lap;
      const card = el('div', 'oc' + (isCur ? ' cur' : '') + (locked ? ' lock' : ''));
      const cv = el('canvas'); cv.width = 96; cv.height = 120; card.appendChild(cv);
      card.appendChild(el('div', '', locked ? '❔ ???' : M.OUTFITS[s]));
      card.appendChild(el('div', 'st', '★'.repeat(stars) + '☆'.repeat(5 - stars)));
      card.appendChild(el('small', '', `${first + 1}~${first + 5}회차`));
      paintOutfit(cv, locked ? first : first + stars - 1, 1, locked);
      if (!locked) card.onclick = () => { lookPreview = first + stars - 1 === cur ? null : first + stars - 1; Sfx.play('click'); rerender(); $('panel').scrollTop = 0; };
      map.appendChild(card);
    }
    body.appendChild(map);
    body.appendChild(el('div', 'msg', '100회차 뒤에는 같은 복장이 색만 바뀌어 다시 나와요 (1000회차까지)'));
  }

  /* ---------- 선행: 칭호 · 도감 ---------- */
  function renderDeeds() {
    const body = $('pbody'); body.innerHTML = '';
    const sc = M.deedScore(save), tt = M.titleOf(sc), d = save.deeds;
    body.appendChild(item(tt.title.icon, tt.title.name,
      tt.next ? `다음 칭호 ${tt.next.icon} ${tt.next.name}까지 💛 ${tt.next.at - sc}` : '최고 칭호에 도달했어요!',
      { progress: tt.next ? (sc - tt.title.at) / (tt.next.at - tt.title.at) : 1, done: !tt.next }));
    body.appendChild(el('div', 'msg', `🙋 도운 사람 ${d.people}명 · 🤝 지켜 준 친구 ${d.escorts}명 · 💛 작은 선행 ${d.spots}개`));
    const book = M.deedBook(save), got = book.filter((b) => b.count > 0).length;
    body.appendChild(el('div', 'msg', `📖 선행 도감 ${got} / ${book.length}`));
    const grid = el('div', 'book');
    grid.appendChild(el('div', 'wn', ''));
    for (const k of M.DEED_KINDS) grid.appendChild(el('div', 'cell', M.DEED_KIND_INFO[k].emoji));
    for (const w of M.WORLD_ORDER) {
      const wd = M.WORLDS[w];
      const open = M.worldUnlocked(save, w);
      grid.appendChild(el('div', 'wn', open ? `${wd.emoji} ${wd.name}` : '🔒 ???'));
      for (const k of M.DEED_KINDS) {
        const n = (book.find((b) => b.world === w && b.kind === k) || {}).count || 0;
        const c = el('div', 'cell' + (n ? ' got' : ''), n ? M.DEED_KIND_INFO[k].emoji : '❔');
        if (n) c.appendChild(el('small', '', `×${n}`));
        grid.appendChild(c);
      }
    }
    body.appendChild(grid);
    body.appendChild(el('div', 'msg', '칭호'));
    for (const t of M.TITLES) body.appendChild(item(sc >= t.at ? t.icon : '🔒', t.name, `💛 ${t.at}`, { done: sc >= t.at }));
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function item(icon, title, desc, opts) {
    opts = opts || {};
    const row = el('div', 'item' + (opts.done ? ' done' : '') + (opts.sel ? ' sel' : ''));
    row.appendChild(el('div', 'icon', icon));
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
      const gearLine = rec.atk + rec.def === 0 ? '🧰 장비 없이도 OK'
        : `🧰 권장 장비 ⚔${rec.atk} 🛡${rec.def} (내 장비 ⚔${gt.atk} 🛡${gt.def})` + (gt.atk < rec.atk || gt.def < rec.def ? ' ⚠ 매점에서 장비를 더 사야 해요' : ' ✅');
      const desc = open
        ? `${w.desc}\n✨ ${w.ruleText}\n🏁 큰 도전 ${w.boss.times.length}번${save.cycle > 0 ? ' (🎲 무작위)' : ''} · 👻 권장 에코 ${w.boss.needEchoes}명+ · 🎓 학점 x${(() => { const rm = M.rewardMul(id, save.cycle); return rm >= 1000 ? M.fmtNum(rm) : rm.toFixed(1); })()} · 극복 ${clears}회 · 최장 ${best}초\n${gearLine}`
        : `🔒 ${prev.emoji} ${prev.name}의 큰 도전 "${prev.boss.name}"을(를) 극복하면 열립니다`;
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
    body.appendChild(el('div', 'msg', `※ 에코는 월드를 옮기면 새로 시작해요. (지금 ${M.WORLDS[GameEchoes.world()].name}의 에코 ${GameEchoes.count()}명) 새 월드에서 다시 쌓아 보세요.`));
  }

  /* ---------- 상점 ---------- */
  function renderShop() {
    const body = $('pbody'); body.innerHTML = '';
    body.appendChild(el('div', 'msg', '🏪 기본 강화 (모든 월드 공통)' + (M.topCycle(save) > 0 ? ` · 🔁 ${M.topCycle(save) + 1}회차 가격` : '')));
    for (const it of M.SHOP) {
      const lv = M.shopLevel(save, it.id);
      const mx = M.shopMax(save, it.id), maxed = lv >= mx;
      const cost = maxed ? 0 : M.shopCost(it.id, lv, M.topCycle(save));
      const row = item(it.icon, `${it.name}  Lv ${lv}/${mx}`,
        `${it.fmt(it.per * lv)} → ${maxed ? (it.grow ? '최대 (다음 회차에 +5)' : '최대') : it.fmt(it.per * (lv + 1))}`, { done: maxed, progress: lv / mx });
      const b = el('button', '', maxed ? '최대' : `🎓 ${M.fmtNum(cost)}`);
      b.disabled = maxed || save.coins < cost;
      b.onclick = () => { if (M.buyUpgrade(save, it.id).ok) { Sfx.play('levelup'); commit(); rerender(); } };
      row.appendChild(b); body.appendChild(row);
    }
    renderGear(body);
  }

  function renderGear(body) {
    const gt = M.gearTotals(save), max = M.gearMax(save);
    const sel = save.worlds.selected, rec = M.recommendedGear(sel, save.cycle);
    body.appendChild(el('div', 'msg', `🧰 월드 매점 · 장비는 에코에게도 적용돼요 (최대 Lv ${max}${save.cycle > 0 ? ` · ${save.cycle + 1}회차` : ''})`));
    body.appendChild(el('div', 'msg', `내 장비 ⚔${gt.atk} 🛡${gt.def} · ${M.WORLDS[sel].emoji} ${M.WORLDS[sel].name} 권장 ⚔${rec.atk} 🛡${rec.def}` + (gt.atk < rec.atk || gt.def < rec.def ? ' ⚠' : ' ✅')));
    let lockedShown = false;
    for (const wid of M.WORLD_ORDER) {
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

  /* ---------- 캐릭터 ---------- */
  function renderChars() {
    const body = $('pbody'); body.innerHTML = '';
    for (const id in M.CHARACTERS) {
      const c = M.CHARACTERS[id];
      const owned = save.chars.unlocked.indexOf(id) >= 0;
      const selected = save.chars.selected === id;
      const row = item(c.emoji, c.name, c.desc, { done: owned && !selected, sel: selected });
      const b = el('button', '', selected ? '사용 중' : owned ? '선택' : `🎓 ${c.cost}`);
      b.disabled = selected || (!owned && save.coins < c.cost);
      b.onclick = () => {
        if (!owned) { if (!M.unlockCharacter(save, id).ok) return; Sfx.play('levelup'); }
        M.selectCharacter(save, id); Sfx.play('click'); commit(); rerender();
      };
      row.appendChild(b); body.appendChild(row);
    }
    body.appendChild(el('div', 'msg', '※ 시작 아이템은 에코에게도 그대로 전달됩니다.'));
  }

  /* ---------- 도전 과제 · 일일 미션 ---------- */
  function renderQuests() {
    ensureDaily();
    const body = $('pbody'); body.innerHTML = '';
    body.appendChild(el('div', 'msg', `📅 오늘의 미션 (${save.daily.date})`));
    for (const m of save.daily.missions) {
      body.appendChild(item(m.done ? '✅' : '🎯', M.missionText(m),
        `${Math.min(m.progress, m.target)} / ${m.target} · 보상 🎓 ${m.reward}`, { done: m.done, progress: Math.min(1, m.progress / m.target) }));
    }
    const got = M.ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
    body.appendChild(el('div', 'msg', `🏆 도전 과제 ${got} / ${M.ACHIEVEMENTS.length}`));
    for (const a of M.ACHIEVEMENTS) {
      const done = !!save.ach[a.id];
      body.appendChild(item(done ? '✅' : a.icon, a.name, `${a.desc} · 보상 🎓 ${a.reward}`, { done }));
    }
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
  $('bChar').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🧑 캐릭터', renderChars); };
  const openLook = () => { Sfx.unlock(); Sfx.play('click'); lookPreview = null; openPanel('👕 내 모습', renderLook); };
  $('bLook').onclick = openLook; $('outfitPv').onclick = openLook; $('outfitPv').style.cursor = 'pointer';
  $('bDeed').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('💛 선행', renderDeeds); };
  $('bQuest').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🏆 과제 · 미션', renderQuests); };
  $('bBackup').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('💾 백업', renderBackup); };
  $('pback').onclick = () => { Sfx.play('click'); closePanel(); };
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
