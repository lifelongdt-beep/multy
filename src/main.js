/* 퇴근 에코 — 입력 / 렌더 / 저장 / 연출 */
(function () {
  'use strict';
  const { Sim, addEcho, UPGRADES, SYNERGIES, ENEMY_TYPES, W, H, PLAY_BOTTOM, TICK, RUN_TICKS, MAX_ECHOES, MAX_LEVEL } = EchoSim;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);

  /* ---------- 에코 저장 (localStorage, Int16 양자화) ---------- */
  const KEY = 'echo-proto-v2';
  function pack(e) {
    const a = new Int16Array(e.path.length);
    for (let i = 0; i < a.length; i++) a[i] = Math.round(e.path[i] * 10);
    let bin = ''; const u = new Uint8Array(a.buffer);
    for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return { p: btoa(bin), u: e.ups, k: e.kills, t: e.ticks };
  }
  function unpack(o) {
    const bin = atob(o.p); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const a = new Int16Array(u.buffer); const path = new Array(a.length);
    for (let i = 0; i < a.length; i++) path[i] = a[i] / 10;
    return { path, ups: o.u, kills: o.k, ticks: o.t };
  }
  let echoes = [];
  let runCount = 0;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) { echoes = s.echoes.map(unpack); runCount = s.runCount || 0; }
  } catch (e) { echoes = []; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ runCount, echoes: echoes.map(pack) })); } catch (e) { /* 용량 초과 무시 */ }
  }

  /* ---------- 입력: 상대 드래그 + 키보드 ---------- */
  const input = { dx: 0, dy: 0 };
  const keys = {};
  let drag = null;
  function toLogical(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', (ev) => { cv.setPointerCapture(ev.pointerId); const p = toLogical(ev); drag = { ax: p.x, ay: p.y, px: p.x, py: p.y }; });
  cv.addEventListener('pointermove', (ev) => {
    if (!drag) return; const p = toLogical(ev); drag.px = p.x; drag.py = p.y;
    let vx = p.x - drag.ax, vy = p.y - drag.ay; const len = Math.hypot(vx, vy);
    if (len > 46) { drag.ax += vx / len * (len - 46); drag.ay += vy / len * (len - 46); vx = p.x - drag.ax; vy = p.y - drag.ay; }
    input.dx = vx / 46; input.dy = vy / 46;
  });
  const endDrag = () => { drag = null; input.dx = 0; input.dy = 0; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  function currentInput() {
    if (drag) return input;
    const dx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
    const dy = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);
    return { dx, dy };
  }

  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, () => Sfx.unlock()));

  /* ---------- 연출 상태 ---------- */
  let shake = 0;
  let floats = [];
  let banner = { text: '', t: 0 };
  let toast = { text: '', t: 0 };

  function handleEvents() {
    for (const ev of sim.drainEvents()) {
      switch (ev.k) {
        case 'shoot': Sfx.play('shoot'); break;
        case 'dmg':
          if (ev.owner !== 'echo' || ev.crit) { if (floats.length < 40) floats.push({ x: ev.x, y: ev.y, v: ev.v, crit: ev.crit, t: 40 }); }
          Sfx.play('hit'); break;
        case 'kill': Sfx.play('kill'); break;
        case 'gem': Sfx.play('gem'); break;
        case 'levelup': Sfx.play('levelup'); break;
        case 'hurt': shake = Math.max(shake, 7); Sfx.play('hurt'); if (navigator.vibrate) navigator.vibrate(40); break;
        case 'nova': shake = Math.max(shake, 3); Sfx.play('nova'); break;
        case 'echoDown': Sfx.play('echoDown'); break;
        case 'heal': Sfx.play('heal'); break;
        case 'banner': banner = { text: ev.text, t: 150 }; break;
        case 'boss': banner = { text: '📚 기말고사 시작!', t: 150 }; shake = 10; Sfx.play('boss'); break;
        case 'phase': banner = { text: `기말고사 ${ev.phase}페이즈`, t: 120 }; shake = 10; Sfx.play('boss'); break;
        case 'synergy': toast = { text: `✨ 시너지: ${ev.name}`, t: 150 }; Sfx.play('levelup'); break;
        default: break;
      }
    }
  }

  /* ---------- 게임 상태 ---------- */
  let sim = null, state = 'menu';   // menu | play | levelup | end
  let acc = 0, last = 0;

  function resize() {
    const st = $('stage'), k = Math.min(innerWidth / W, innerHeight / H);
    st.style.width = Math.floor(W * k) + 'px'; st.style.height = Math.floor(H * k) + 'px';
    const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  }
  addEventListener('resize', resize); resize();

  function startRun() {
    Sfx.unlock(); Sfx.play('click');
    runCount += 1;
    sim = new Sim({ seed: (Date.now() ^ (runCount * 2654435761)) >>> 0, echoes });
    state = 'play'; acc = 0; last = performance.now();
    shake = 0; floats = []; banner.t = 0; toast.t = 0;
    ['start', 'levelup', 'end'].forEach((id) => $(id).classList.add('hidden'));
  }

  function showLevelUp() {
    state = 'levelup';
    const box = $('choices'); box.innerHTML = '';
    const stats = sim.player.stats;
    sim.choices.forEach((u) => {
      const b = document.createElement('button'); b.className = 'card';
      const lv = u.instant ? '' : `Lv ${stats[u.id]} → ${stats[u.id] + 1}/${MAX_LEVEL} · `;
      b.innerHTML = `${u.icon} ${u.name}<small>${lv}${u.desc}</small>`;
      b.onclick = () => { Sfx.play('click'); sim.choose(u.id); handleEvents(); $('levelup').classList.add('hidden'); state = 'play'; last = performance.now(); acc = 0; };
      box.appendChild(b);
    });
    $('levelup').classList.remove('hidden');
  }

  function showEnd() {
    state = 'end';
    const out = sim.exportEcho();
    const res = addEcho(echoes, out, MAX_ECHOES);
    echoes = res.list;
    save();
    const title = { dead: '쓰러졌다… 하지만!', clear: '기말고사 격파! 🎉', survive: '120초 생존!' }[sim.result];
    Sfx.play(sim.result === 'dead' ? 'lose' : 'win');
    $('endTitle').textContent = title;
    $('endEchoes').textContent = `👻 에코 ${echoes.length}/${MAX_ECHOES}명`;
    const alive = sim.echoes.filter((e) => e.alive).length;
    $('stats').innerHTML = `생존 ${(sim.tick / TICK).toFixed(0)}초 · 처치 ${sim.kills} · Lv ${sim.player.level}<br>` +
      (sim.echoes.length ? `이번 판 에코 ${alive}/${sim.echoes.length}명 생존<br>` : '') +
      (res.removed.length
        ? `가장 일찍 쓰러진 에코(${(res.removed[0].ticks / TICK).toFixed(0)}초)가 퇴장했습니다<br>`
        : '') +
      `가장 오래 버틴 에코 ${(Math.max(...echoes.map((e) => e.ticks)) / TICK).toFixed(0)}초까지 다음 판을 도와줍니다`;
    $('end').classList.remove('hidden');
  }

  $('go').onclick = startRun; $('again').onclick = startRun;
  $('reset').onclick = () => { echoes = []; runCount = 0; save(); $('reset').textContent = '초기화됨'; };
  $('mute').onclick = () => { Sfx.setMuted(!Sfx.isMuted()); $('mute').textContent = Sfx.isMuted() ? '🔇' : '🔊'; };

  /* ---------- 렌더 ---------- */
  function emoji(ch, x, y, size) { ctx.font = `${size}px serif`; ctx.fillText(ch, x, y); }

  function render() {
    const sc = cv.width / W;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(sc, 0, 0, cv.height / H, sx * sc, sy * sc);
    ctx.fillStyle = '#161a2e'; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (!sim) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (const g of sim.gems) { ctx.fillStyle = '#7dffb2'; ctx.beginPath(); ctx.arc(g.x, g.y, 3.2, 0, 7); ctx.fill(); }

    // 에코 (반투명 시안 유령 + 체력 바)
    for (const ec of sim.echoes) {
      if (!ec.alive) continue;
      ctx.globalAlpha = ec.inv > 0 && Math.floor(ec.inv / 4) % 2 ? 0.07 : 0.16;
      ctx.fillStyle = '#6fe8ff'; ctx.beginPath(); ctx.arc(ec.x, ec.y, 11, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.45; emoji('👻', ec.x, ec.y + 1, 17);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#0008'; ctx.fillRect(ec.x - 9, ec.y + 12, 18, 3);
      ctx.fillStyle = '#6fe8ff'; ctx.fillRect(ec.x - 9, ec.y + 12, 18 * Math.max(0, ec.hp / 30), 3);
      ctx.globalAlpha = 1;
    }

    // 적
    for (const e of sim.enemies) {
      const b = ENEMY_TYPES[e.type];
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 7); ctx.fill(); }
      if (e.warn) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.stroke(); }
      emoji(b.emoji, e.x, e.y + 1, e.r * 2);
      if (e.type === 'teacher') {
        ctx.fillStyle = '#000a'; ctx.fillRect(e.x - 18, e.y - e.r - 8, 36, 4);
        ctx.fillStyle = '#ffb454'; ctx.fillRect(e.x - 18, e.y - e.r - 8, 36 * Math.max(0, e.hp / e.maxhp), 4);
      }
      if (e.type === 'boss') {
        ctx.fillStyle = '#000a'; ctx.fillRect(40, 54, W - 80, 7);
        ctx.fillStyle = '#ff5d73'; ctx.fillRect(40, 54, (W - 80) * Math.max(0, e.hp / e.maxhp), 7);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(`기말고사 · ${e.phase}/3`, W / 2, 48);
      }
    }

    // 탄환 / 형광펜 / 적 탄환
    for (const b of sim.bullets) {
      ctx.globalAlpha = b.owner === 'echo' ? 0.4 : 1;
      ctx.fillStyle = b.crit ? '#ffd34d' : b.owner === 'echo' ? '#8fe3ff' : '#ffe27a';
      ctx.beginPath(); ctx.arc(b.x, b.y, (b.owner === 'echo' ? 2.6 : 3.2) + (b.crit ? 1.2 : 0), 0, 7); ctx.fill();
    }
    for (const o of sim.orbs) { ctx.globalAlpha = o.owner === 'echo' ? 0.4 : 1; ctx.fillStyle = o.owner === 'echo' ? '#8fe3ff' : '#e6ff6b'; ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const b of sim.ebullets) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 1; ctx.stroke(); }

    // 플레이어
    const p = sim.player;
    // 내 위치 표시: 몸 아래 초록 링(숨쉬듯 깜빡임) + 머리 위 ▼ (에코의 시안색과 구분)
    {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.fillStyle = `rgba(125,255,178,${0.10 + 0.08 * pulse})`;
      ctx.beginPath(); ctx.arc(p.x, p.y + 1, 17, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(125,255,178,${0.55 + 0.35 * pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y + 1, 15 + 2 * pulse, 0, 7); ctx.stroke();
      const ay = p.y - 24 - 2 * pulse;
      ctx.fillStyle = '#7dffb2';
      ctx.beginPath(); ctx.moveTo(p.x - 5, ay - 5); ctx.lineTo(p.x + 5, ay - 5); ctx.lineTo(p.x, ay + 2); ctx.closePath(); ctx.fill();
    }
    if (p.inv > 0 && Math.floor(p.inv / 4) % 2) ctx.globalAlpha = 0.4;
    emoji('🧑‍🎓', p.x, p.y + 1, 22); ctx.globalAlpha = 1;

    // 이펙트
    for (const f of sim.fx) {
      ctx.globalAlpha = Math.min(1, f.t / 12);
      if (f.kind === 'pop') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y, 14 - f.t, 0, 7); ctx.stroke(); }
      else if (f.kind === 'hurt') { ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(f.x, f.y, 16 - f.t, 0, 7); ctx.fill(); }
      else if (f.kind === 'vanish') { ctx.fillStyle = '#6fe8ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 24 - f.t, 0, 7); ctx.fill(); }
      else if (f.kind === 'nova') { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.t / 24), 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // 데미지 숫자
    ctx.textAlign = 'center';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.t / 20);
      ctx.fillStyle = f.crit ? '#ffd34d' : '#fff';
      ctx.font = f.crit ? 'bold 15px sans-serif' : '11px sans-serif';
      ctx.fillText(f.v, f.x, f.y - (40 - f.t) * 0.6);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#ff5d73'; ctx.fillRect(8, 8, 100 * Math.max(0, p.hp / p.maxhp), 8);
    ctx.strokeStyle = '#fff6'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, 100, 8);
    ctx.fillStyle = '#7dffb2'; ctx.fillRect(8, 20, 100 * Math.min(1, p.xp / p.need), 5);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(`Lv ${p.level}`, 116, 14);
    ctx.textAlign = 'center';
    const left = Math.max(0, Math.ceil((RUN_TICKS - sim.tick) / TICK));
    ctx.font = 'bold 16px sans-serif';
    if (sim.tick >= RUN_TICKS) { ctx.fillStyle = '#ff9aa8'; ctx.fillText('연장전', W / 2, 16); ctx.fillStyle = '#fff'; }
    else ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 16);
    ctx.textAlign = 'right'; ctx.font = '12px sans-serif';
    const alive = sim.echoes.filter((e) => e.alive).length;
    ctx.fillText(`👻 ${alive}/${sim.echoes.length}   ☠ ${sim.kills}`, W - 8, 14);

    // 하단 추천 조작 영역 (이동 제한은 없음. 여기서 드래그하면 손가락이 캐릭터를 덜 가림)
    if (!drag) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(performance.now() / 350);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '13px sans-serif';
      ctx.fillText('👆 여기서 드래그하면 캐릭터가 안 가려져요', W / 2, PLAY_BOTTOM + 76);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, PLAY_BOTTOM + 76, 38, 0, 7); ctx.globalAlpha *= 0.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 보유 업그레이드 (조작 영역 위쪽 가장자리)
    ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
    let ux = 6;
    for (const u of UPGRADES) {
      const lv = p.stats[u.id];
      if (!lv || u.instant) continue;
      const s = `${u.icon}${lv}`;
      ctx.fillText(s, ux, PLAY_BOTTOM + 12); ux += ctx.measureText(s).width + 8;
    }
    // 조이스틱 표시 (드래그 중)
    if (drag) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(drag.ax, drag.ay, 46, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(140,170,255,.85)';
      ctx.beginPath(); ctx.arc(drag.px, drag.py, 18, 0, 7); ctx.fill();
    }

    // 배너 / 시너지 토스트
    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 30);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ff5d73'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(banner.text, W / 2, 100);
      ctx.globalAlpha = 1;
    }
    if (toast.t > 0) {
      ctx.globalAlpha = Math.min(1, toast.t / 30);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(toast.text, W / 2, 130);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 메인 루프 (고정 60Hz) ---------- */
  function frame(now) {
    if (state === 'play') {
      acc += Math.min(100, now - last); last = now;
      const dt = 1000 / TICK;
      while (acc >= dt && state === 'play') {
        acc -= dt; sim.step(currentInput());
        handleEvents();
        if (sim.choices) { showLevelUp(); break; }
        if (sim.over) { showEnd(); break; }
      }
    }
    if (shake > 0) shake = Math.max(0, shake - 0.4);
    for (const f of floats) f.t -= 1;
    floats = floats.filter((f) => f.t > 0);
    if (banner.t > 0) banner.t -= 1;
    if (toast.t > 0) toast.t -= 1;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 테스트/디버그용 훅
  window.__echo = { get sim() { return sim; }, get state() { return state; }, get echoes() { return echoes; } };
})();
