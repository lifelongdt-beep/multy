/* 퇴근 에코 — 메타 화면 (상점 / 캐릭터 / 도전 과제·미션 / 백업) */
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
      $('coins').textContent = save.coins; $('pcoins').textContent = save.coins;
      const w = M.WORLDS[save.worlds.selected] || M.WORLDS.school;
      $('bWorld').textContent = `🗺️ 월드: ${w.emoji} ${w.name}`;
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
      const desc = open
        ? `${w.desc}\n✨ ${w.ruleText}\n🏁 큰 도전 ${w.boss.times.length}번 · 👻 권장 에코 ${w.boss.needEchoes}명+ · 🎓 학점 x${w.coinMul} · 극복 ${clears}회 · 최장 ${best}초`
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
    body.appendChild(el('div', 'msg', `※ 에코는 월드를 옮기면 새로 시작해요. (지금 ${M.WORLDS[GameEchoes.world()].name}의 에코 ${GameEchoes.count()}명) 새 월드에서 다시 쌓아 보세요.`));
  }

  /* ---------- 상점 ---------- */
  function renderShop() {
    const body = $('pbody'); body.innerHTML = '';
    for (const it of M.SHOP) {
      const lv = M.shopLevel(save, it.id);
      const maxed = lv >= it.max;
      const cost = maxed ? 0 : M.shopCost(it.id, lv);
      const row = item(it.icon, `${it.name}  Lv ${lv}/${it.max}`,
        `${it.fmt(it.per * lv)} → ${maxed ? '최대' : it.fmt(it.per * (lv + 1))}`, { done: maxed, progress: lv / it.max });
      const b = el('button', '', maxed ? '최대' : `🎓 ${cost}`);
      b.disabled = maxed || save.coins < cost;
      b.onclick = () => { if (M.buyUpgrade(save, it.id).ok) { Sfx.play('levelup'); commit(); rerender(); } };
      row.appendChild(b); body.appendChild(row);
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
    body.appendChild(el('div', 'msg', '서버 저장이 생기기 전까지, 기기를 바꿀 때 이 코드를 옮겨 주세요. (학점·강화·캐릭터·과제 기록. 에코 기록은 포함되지 않습니다)'));
    const out = el('textarea'); out.readOnly = true; out.value = M.exportCode(save);
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
      const data = M.importCode(inp.value);
      if (!data) { msg.textContent = '올바른 백업 코드가 아니에요.'; armed = false; load.textContent = '📥 불러오기'; return; }
      if (!armed) { armed = true; load.textContent = '⚠ 한 번 더 눌러 덮어쓰기'; msg.textContent = `코드 확인됨: 🎓 ${data.coins} 학점. 현재 데이터가 사라집니다.`; return; }
      save = data; commit(); armed = false; load.textContent = '📥 불러오기'; rerender();
      $('pbody').appendChild(el('div', 'msg', '불러오기 완료!'));
    };
    body.appendChild(load);
    body.appendChild(msg);
  }

  /* ---------- 연결 ---------- */
  $('bWorld').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🗺️ 월드 선택', renderWorlds); };
  $('bShop').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🏪 상점', renderShop); };
  $('bChar').onclick = () => { Sfx.unlock(); Sfx.play('click'); openPanel('🧑 캐릭터', renderChars); };
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
    get save() { return save; },
    refresh,
  };
})();
