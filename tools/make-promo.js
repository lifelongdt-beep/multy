/* Echo Rush — 인스타 릴스 홍보 영상 만들기 (1080×1920, 15초)
 * 실제 게임을 시계를 멈춘 채 한 장씩 돌려 찍고(끊김 없음), 자막을 얹는다.
 *   node tools/make-promo.js keyframes  → docs/promo/keyframe-1~5.png (장면 확인용)
 *   node tools/make-promo.js video      → docs/promo/echo-rush-reels.mp4
 * (Playwright·ffmpeg 필요) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'promo');
const MODE = process.argv[2] || 'keyframes', FPS = 30;
const TOTAL = () => SCENES.reduce((a, x) => a + x.sec, 0);   // 영상 전체 길이(초)
// 장면: [월드, 길이(초), 자막, 준비 함수 이름]
const C1 = ['시험 불안이 왔다!'], C2 = ['혼자선 힘들지?'], C3 = ['한 판 끝나면', '과거의 내가 도와줘!'], C4 = ['착한 일 하면', '더 세져!'], C5 = ['우유 먹고', '힘내!'];
// 빠른 장면 전환: 1~2초짜리 장면을 여러 월드로 (같은 자막이면 자막은 이어서 유지)
const SCENES = [
  { id: 'boss',  world: 'school',   sec: 1.0, cap: C1 },
  { id: 'boss',  world: 'subway',   sec: 1.0, cap: C1 },
  { id: 'boss',  world: 'office',   sec: 1.0, cap: C1 },
  { id: 'alone', world: 'beach',    sec: 1.0, cap: C2 },
  { id: 'milk',  world: 'home',     sec: 1.2, cap: C5 },
  { id: 'echo',  world: 'stage',    sec: 1.1, cap: C3 },
  { id: 'echo',  world: 'mountain', sec: 1.1, cap: C3 },
  { id: 'echo',  world: 'hospital', sec: 1.1, cap: C3 },
  { id: 'echo',  world: 'gym',      sec: 1.1, cap: C3 },
  { id: 'deed',  world: 'academy',  sec: 1.8, cap: C4, who: 'child' },
  { id: 'deed',  world: 'library',  sec: 1.6, cap: C4, who: 'elder' },
  { id: 'end',   world: 'stage',    sec: 3.0, cap: [] },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 5 });   // 확대해도 선명하게
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 시계 멈추기: requestAnimationFrame·performance.now를 직접 한 칸씩 돌림
  await p.addInitScript(() => {
    let now = 0; const q = []; Date.now = () => 1767225600000;   // 매번 같은 판이 나오게
    performance.now = () => now;
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__step = (ms) => { now += ms; const cbs = q.splice(0); for (const cb of cbs) cb(now); };
    localStorage.setItem('echo-gfx', JSON.stringify({ mode: 'high' })); window.ART_SPRITE_SCALE = 5;
  });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => document.fonts.load('80px "Black Han Sans"'));
  await p.evaluate(() => { localStorage.setItem('echo-meta-v1', JSON.stringify({ v: 1, coins: 0, tutorial: true, stats: { runs: 30 }, worlds: { selected: 'school', clears: { school: 1 }, cycleClears: {}, best: {} } })); });
  await p.reload(); await p.evaluate(() => document.fonts.load('80px "Black Han Sans"')); await p.evaluate(() => { for (let i = 0; i < 10; i++) __step(16); });
  await p.evaluate(() => {   // 게임 효과음은 소리 대신 시각만 기록 (나중에 녹음 때 같은 때에 재생)
    window.__T = 0; window.__sfxLog = []; const KEEP = { drink: 1, deed: 1, levelup: 1 };
    Sfx.play = (n) => { if (KEEP[n]) window.__sfxLog.push([n, window.__T]); };
  });
  await p.evaluate(() => {
    // 효과: 글자가 쾅 박힘(튀어나옴·흔들림·빛줄기) + 장면 전환(확대 펀치·휙 넘기기·글리치·사선 와이프)
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    window.__fx = { shake: 0, prev: mk(1080, 1920), cur: mk(1080, 1920), lastCap: null };
    window.__grab = (cap, k, endCard, info) => {
      const F = window.__fx, src = document.getElementById('c');
      const o = window.__o || (window.__o = mk(1080, 1920)), g = o.getContext('2d');
      // 1) 게임 화면을 카메라로 잘라 cur 층에 그림
      const want = window.__camFor(window.__scene, k), c = window.__cam && !window.__camCut ? window.__cam : Object.assign({}, want); window.__camCut = false;
      c.x += (want.x - c.x) * 0.12; c.y += (want.y - c.y) * 0.12; c.z += (want.z - c.z) * 0.12; window.__cam = c;
      const sc = src.width / 360, cw = 360 / c.z, ch = 640 / c.z;
      const x0 = Math.max(0, Math.min(360 - cw, c.x - cw / 2)), y0 = Math.max(105, Math.min(626 - ch, c.y - ch / 2));
      const cg = F.cur.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(src, x0 * sc, y0 * sc, cw * sc, ch * sc, 0, 0, 1080, 1920);
      // 2) 장면 전환 (새 장면 첫 7프레임)
      const TR = 7, f = info.f, tp = info.i > 0 && f < TR ? f / TR : 1, kind = ['zoom', 'whip', 'glitch', 'wipe'][info.i % 4];
      g.save();
      if (F.shake > 0) { g.translate((Math.random() - 0.5) * F.shake * 2, (Math.random() - 0.5) * F.shake * 2); F.shake *= 0.72; if (F.shake < 0.5) F.shake = 0; }
      g.fillStyle = '#000'; g.fillRect(-60, -60, 1200, 2040);
      if (tp >= 1) g.drawImage(F.cur, 0, 0);
      else if (kind === 'zoom') {   // 확대 펀치: 이전 장면이 확 빨려 들어가고 새 장면이 튀어나옴
        const e = ease(tp);
        g.save(); g.translate(540, 960); const s1 = 1 + tp * 0.9; g.scale(s1, s1); g.globalAlpha = 1 - e; g.drawImage(F.prev, -540, -960); g.restore();
        g.save(); g.translate(540, 960); const s2 = 1.35 - 0.35 * e; g.scale(s2, s2); g.globalAlpha = e; g.drawImage(F.cur, -540, -960); g.restore();
        g.fillStyle = `rgba(255,255,255,${(1 - tp) * 0.7})`; g.fillRect(0, 0, 1080, 1920);
      } else if (kind === 'whip') {   // 휙 넘기기: 옆으로 밀리며 잔상
        const e = ease(tp), dx = -1080 * e;
        for (let j = 0; j < 5; j++) { g.globalAlpha = j === 0 ? 1 : 0.18; g.drawImage(F.prev, dx - j * 70 * (1 - tp), 0); g.drawImage(F.cur, dx + 1080 - j * 70 * (1 - tp), 0); }
        g.globalAlpha = 1;
      } else if (kind === 'glitch') {   // 글리치: 가로 조각이 어긋나고 색이 갈라짐
        const im = tp < 0.4 ? F.prev : F.cur;
        g.drawImage(im, 0, 0);
        for (let j = 0; j < 14; j++) { const y = Math.random() * 1920, h = 20 + Math.random() * 120, off = (Math.random() - 0.5) * 220 * (1 - tp); g.drawImage(im, 0, y, 1080, h, off, y, 1080, h); }
        g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.5 * (1 - tp);
        g.fillStyle = '#ff2a6d'; g.fillRect(0, Math.random() * 1920, 1080, 60); g.fillStyle = '#05d9e8'; g.fillRect(0, Math.random() * 1920, 1080, 40);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      } else {   // 사선 와이프: 노란·분홍 띠가 쓸고 지나가며 새 장면
        const e = ease(tp), xs = -800 + e * 2700;
        g.drawImage(F.prev, 0, 0);
        g.save(); g.beginPath(); g.moveTo(xs - 600, 1920); g.lineTo(xs, 0); g.lineTo(-2000, 0); g.lineTo(-2000, 1920); g.closePath(); g.clip(); g.drawImage(F.cur, 0, 0); g.restore();
        const band = (w, col, off) => { g.fillStyle = col; g.beginPath(); g.moveTo(xs - 600 + off, 1920); g.lineTo(xs + off, 0); g.lineTo(xs + off + w, 0); g.lineTo(xs - 600 + off + w, 1920); g.closePath(); g.fill(); };
        band(70, '#ffd54f', 0); band(36, '#ff5fa2', 80);
      }
      if (info.i > 0 && f === TR) F.shake = 14;   // 전환 끝에 쿵
      // 가장자리 어둡게 (집중)
      const vg = g.createRadialGradient(540, 1000, 500, 540, 1000, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,25,.55)'); g.fillStyle = vg; g.fillRect(-60, -60, 1200, 2040);
      // 3) 글자 쾅
      const slam = (t, y, size, fill, delay, i) => {
        const tt = k - delay; if (tt < 0) return;
        const IN = 0.13; let s, rot, a = 1;
        if (tt < IN) { const e = tt / IN; s = 2.6 - 1.75 * e * e; rot = (i % 2 ? 1 : -1) * 0.12 * (1 - e); a = Math.min(1, e * 2.5); }
        else { const u = tt - IN; s = 0.85 + 0.15 * (1 - Math.exp(-u * 18) * Math.cos(u * 40)) + 0.012 * Math.sin(k * 9 + i); rot = (i % 2 ? 1 : -1) * 0.025 * Math.exp(-u * 6) + 0.008 * Math.sin(k * 5 + i); }
        if (tt >= IN && tt - 1 / 30 < IN) F.shake = Math.max(F.shake, 22);   // 박히는 순간 화면 흔들림
        // 빛줄기 (박힌 직후 퍼짐)
        if (tt >= IN && tt < IN + 0.35) { const u = (tt - IN) / 0.35; g.save(); g.translate(540, y); g.globalAlpha = (1 - u) * 0.85; g.fillStyle = '#fff3b0';
          for (let r = 0; r < 18; r++) { const an = r / 18 * Math.PI * 2 + i, r0 = 160 + u * 260, r1 = r0 + 120 + u * 200; g.beginPath(); g.moveTo(Math.cos(an - 0.03) * r0 * 2.2, Math.sin(an - 0.03) * r0 * 0.8); g.lineTo(Math.cos(an) * r1 * 2.2, Math.sin(an) * r1 * 0.8); g.lineTo(Math.cos(an + 0.03) * r0 * 2.2, Math.sin(an + 0.03) * r0 * 0.8); g.fill(); }
          g.restore(); }
        g.save(); g.globalAlpha = a; g.translate(540, y); g.rotate(rot); g.scale(s, s);
        g.font = `${size}px "Black Han Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = size * 0.34; g.strokeStyle = '#ff3d7f'; g.strokeText(t, 7, 11);       // 분홍 입체 그림자
        g.fillStyle = '#ff3d7f'; g.fillText(t, 7, 11);
        g.lineWidth = size * 0.24; g.strokeStyle = '#1b0f2e'; g.strokeText(t, 0, 0);
        const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, fill); gr.addColorStop(1, fill); g.fillStyle = gr; g.fillText(t, 0, 0);
        if (tt < IN + 0.08) { g.globalAlpha = Math.max(0, 1 - (tt - IN) / 0.08) * 0.8; g.fillStyle = '#fff'; g.fillText(t, 0, 0); }   // 박히는 순간 하얗게 번쩍
        g.restore();
      };
      if (endCard) {
        g.fillStyle = 'rgba(10,8,30,.5)'; g.fillRect(-60, -60, 1200, 2040);
        // 로고 뒤 회전하는 빛
        if (k > 0.12) { g.save(); g.translate(540, 480); g.rotate(k * 0.6); g.globalAlpha = Math.min(0.35, (k - 0.12) * 1.5); g.fillStyle = '#ffd54f';
          for (let r = 0; r < 12; r++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, -900); g.lineTo(90, -900); g.fill(); } g.restore(); }
        slam('ECHO RUSH', 480, 140, '#ffd54f', 0, 0); slam('에코 러시', 630, 90, '#ffffff', 0.3, 1);
        slam('구글 플레이 출시 예정', 1480, 92, '#7dffb2', 0.6, 2); slam('테스터 모집 중! DM 줘', 1620, 80, '#ffe58a', 0.9, 3);
        for (let j = 0; j < 14; j++) { const tw = (Math.sin(k * 7 + j * 2.1) + 1) / 2, x = (j * 397) % 1080, y = 250 + ((j * 613) % 1500); g.globalAlpha = tw * 0.9; g.fillStyle = '#fff6c0'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-4, -18 * tw, 8, 36 * tw); g.fillRect(-18 * tw, -4, 36 * tw, 8); g.restore(); }
        g.globalAlpha = 1;
      } else cap.forEach((t, i) => slam(t, 470 + i * 140 - (cap.length - 1) * 70, 118, i === cap.length - 1 ? '#ffe58a' : '#ffffff', 0.05 + i * 0.22, i));
      g.restore();
      // 다음 전환용으로 이번 게임 화면 보관
      F.prev.getContext('2d').drawImage(F.cur, 0, 0);
      return o.toDataURL('image/jpeg', 0.93).split(',')[1];
    };
  });
  await p.evaluate(() => {
    // 장면별 움직임 (프레임마다)
    window.__tick = (id, f) => {
      const s = __echo.sim; if (!s) return;
      if (id === 'milk') {   // 체력이 조금 줄었을 때 우유를 집어 마심
        if (f === 0) s.player.hp = s.player.maxhp * 0.45;
        if (f === 8) s.gems.push({ x: s.player.x + 26, y: s.player.y - 6, v: 12, kind: 'milk' });
        return;
      }
      s.player.hp = Math.max(s.player.hp, s.player.maxhp * 0.8);
      if (id === 'deed') {
        const rs = s.deeds.rescue; if (!rs) return;
        if (f < 24) { s.player.x += (rs.x - 48 - s.player.x) * 0.12; s.player.y += (rs.y + 22 - s.player.y) * 0.12; }   // 친구에게 달려감
        if (f === 16) { for (const e of rs.guards) { if (window.Art) Art.burst(e.x, e.y, '#ffd84d', 12, false); s.fx.push({ x: e.x, y: e.y, t: 20, kind: 'vanish' }); } s.enemies = s.enemies.filter((e) => rs.guards.indexOf(e) < 0); }                                                       // 괴롭히던 감정들을 물리침
        if (rs.state === 'done' && !window.__helped) { window.__helped = true; s._ev({ k: 'helped', x: rs.x, y: rs.y }); s._ev({ k: 'deed', what: 'cheer', x: rs.x, y: rs.y }); }   // 하트 + 힘이 세지는 배지
      }
    };
    // 카메라: 장면의 주인공 쪽을 확대해서 부드럽게 따라감 (위쪽 게임 정보는 화면 밖)
    window.__camFor = (id, k) => {
      const s = __echo.sim, pl = s.player, bs = s.enemies.find((e) => e.type === 'boss');
      if (id === 'boss' && bs) return { x: (pl.x + bs.x) / 2, y: (pl.y + bs.y) / 2 - 40, z: 1.55 + k * 0.08 };
      if (id === 'alone') return { x: pl.x, y: pl.y - 30, z: 1.9 + k * 0.1 };
      if (id === 'echo') return { x: 180, y: 445, z: 1.45 + k * 0.03 };
      if (id === 'deed') { const rs = s.deeds.rescue || { x: pl.x, y: pl.y }; return { x: (pl.x + rs.x) / 2 + 6, y: (pl.y + rs.y) / 2 - 30, z: 2.1 + k * 0.05 }; }
      if (id === 'milk') return { x: pl.x + 8, y: pl.y - 40, z: 2.5 + k * 0.1 };
      return { x: pl.x, y: pl.y - 10, z: 1.8 + k * 0.04 };
    };
    window.__cam = null;
  });
  // 한 장면 준비 (게임 시작 + 상태 맞추기)
  const setup = (sc) => p.evaluate((sc) => {
    const hp = () => { const s = __echo.sim; if (s) s.player.hp = Math.max(s.player.hp, s.player.maxhp * 0.8); };
    const pick = () => { const s = __echo.sim; if (s.choices) s.choose(s.choices[0].id); };
    const run = (n, move) => { const s = __echo.sim; for (let i = 0; i < n; i++) { hp(); pick(); s.step(move ? move(i) : { dx: 0, dy: 0 }); } };
    GameUI.worldId = () => sc.world;
    if (sc.id === 'echo' || sc.id === 'end') GameEchoes.replace({ world: sc.world, echoes: EchoTutorial.makeTutorialEchoes(7) }); else GameEchoes.reset(sc.world);
    document.getElementById('start').classList.add('hidden'); document.getElementById('end').classList.add('hidden');
    document.getElementById('go').click();
    const s = __echo.sim, wig = (i) => ({ dx: Math.sin(i / 40) * 0.6, dy: Math.cos(i / 55) * 0.4 });
    const tough = (e) => { e.hp = e.maxhp = 1e9; };
    const clearTop = () => { s.enemies = s.enemies.filter((e) => e.type === 'boss' || e.guard || e.y > 300); };
    const place = (x, y) => { s.player.x = x; s.player.y = y; };
    // 에코의 앞으로 기록을 (cx,cy) 둘레를 천천히 도는 길로 바꿈
    const orbit = (cx, cy, rad) => { const t = s.tick; s.echoes.forEach((ec, k) => { ec.alive = true; ec.down = 0; ec.hp = 1e9; const a0 = k / s.echoes.length * Math.PI * 2; const path = ec.path.slice(0, t * 2); while (path.length < t * 2) path.push(cx, cy);
      for (let j = 0; j < 60 * 30; j++) { const a = a0 + j * 0.012; path.push(cx + Math.cos(a) * rad * (1 + 0.12 * Math.sin(j / 20 + k)), cy + Math.sin(a) * rad * 0.8); } ec.path = path; }); };
    if (sc.id === 'boss') { let n = 0; while (!s.bossAlive && n++ < 20000) run(1, wig); const bs = s.enemies.find((e) => e.type === 'boss'); clearTop(); if (bs) { bs.x = 180; bs.y = 410; tough(bs); } place(180, 550); }
    if (sc.id === 'alone') { run(60 * 30, wig); s.enemies = []; place(180, 420); const kinds = Object.keys(s.world.enemies).filter((k) => s.world.enemies[k].ai !== 'shoot' && !s.world.enemies[k].boss);
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; s._make(kinds[k % kinds.length], 180 + Math.cos(a) * 78, 420 + Math.sin(a) * 78); const e = s.enemies[s.enemies.length - 1]; tough(e); e.speed *= 0.12; } }
    if (sc.id === 'echo') { let n = 0; while (!s.bossAlive && n++ < 20000) run(1, wig); const bs = s.enemies.find((e) => e.type === 'boss'); clearTop(); if (bs) { bs.x = 180; bs.y = 440; bs.hp = bs.maxhp * 0.35; } place(180, 570); orbit(180, 440, 100); }
    if (sc.id === 'milk') { run(60 * 20, wig); s.enemies = []; place(180, 470); }
    if (sc.id === 'end') { run(60 * 20, wig); s.enemies = []; place(180, 420); orbit(180, 420, 70); }
    if (sc.id === 'deed') { let n = 0; while (!(s.deeds && s.deeds.rescue) && n++ < 20000) run(1, wig); const rs = s.deeds.rescue; clearTop(); s.enemies = s.enemies.filter((e) => e.guard);
      if (rs) { if (sc.who) rs.kind = sc.who; const dx = 180 - rs.x, dy = 430 - rs.y; rs.x += dx; rs.y += dy; for (const e of rs.guards) { e.x += dx; e.y += dy; tough(e); e.speed = 0; } } place(80, 470); }
  }, sc);
  if (MODE === 'keyframes') {
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc); await p.evaluate((id) => { window.__scene = id; window.__camCut = true; }, sc.id);
      await p.evaluate((n) => { for (let j = 0; j < n; j++) __step(1000 / 30); }, Math.round(FPS * sc.sec * 0.5));
      fs.writeFileSync(path.join(OUT, `keyframe-${i + 1}.jpg`), Buffer.from(await p.evaluate(([c, e]) => window.__grab(c, 1, e, { f: 30, i: 0 }), [sc.cap, sc.id === 'end']), 'base64'));
    }
  }
  if (MODE === 'video') {
    // 1) 그림: 30fps로 한 장씩 찍어 ffmpeg에 바로 넘김
    const silent = path.join(OUT, 'video-silent.mp4');
    const { spawn } = require('child_process');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', silent]);
    const ffDone = new Promise((r) => ff.on('close', r));
    let capT = 0, frame = 0; const cues = [['game:boss', 0.05]]; let T0 = 0;   // 첫 장면: 보스 등장 소리
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc);
      T0 = frame / FPS;
      if (i > 0) { cues.push(['tr' + (i % 4), T0]); cues.push(['thud', T0 + 7 / FPS]); }   // 장면 전환 소리 + 쿵
      if (i === 0 || SCENES[i - 1].cap !== sc.cap) { capT = 0; sc.cap.forEach((_, j) => cues.push(['impact', T0 + 0.05 + j * 0.22 + 0.13])); }   // 글자 박히는 소리
      if (sc.id === 'end') { [0, 0.3, 0.6, 0.9].forEach((d) => cues.push(['impact', T0 + d + 0.13])); cues.push(['sparkle', T0 + 1.1]); }
      await p.evaluate((id) => { window.__scene = id; window.__camCut = true; window.__helped = false; __echo.sim.drainEvents(); }, sc.id);   // 준비 중 쌓인 사건(소리)은 버림
      const n = Math.round(FPS * sc.sec);
      for (let f = 0; f < n; f++) {
        await p.evaluate(([id, f, T]) => { window.__T = T; __tick(id, f); __step(1000 / 30); }, [sc.id, f, frame / FPS]); frame++;
        const jpg = await p.evaluate(([cap, k, endCard, info]) => window.__grab(cap, k, endCard, info), [sc.cap, capT, sc.id === 'end', { f, i }]); capT += 1 / FPS;
        if (!ff.stdin.write(Buffer.from(jpg, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
    }
    ff.stdin.end(); await ffDone;
    for (const [n, t] of await p.evaluate(() => window.__sfxLog)) cues.push(['game:' + n, t]);
    const cnt = {}; cues.forEach(([n]) => cnt[n] = (cnt[n] || 0) + 1); console.log('효과음', JSON.stringify(cnt));
    // 2) 소리: 게임 음악을 실제 시간으로 녹음 (0~10초 왕 음악 → 10초부터 메인 테마)
    const ap = await (await b.newContext()).newPage();
    await ap.addInitScript(() => {
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dst, ...a) {
        const r = orig.call(this, dst, ...a);
        if (dst instanceof AudioDestinationNode) { const c = dst.context; if (!c.__tap) { c.__tap = c.createMediaStreamDestination(); } orig.call(this, c.__tap); }
        return r;
      };
    });
    await ap.goto('file://' + path.join(ROOT, 'index.html'));
    const sw = SCENES.slice(0, -1).reduce((a, x) => a + x.sec, 0);   // 끝 화면부터 메인 테마
    const webm = await ap.evaluate(async ([sw, cues, total]) => {
      Sfx.unlock(); Music.stop();
      const c = Sfx.context(); await c.resume();
      Music.play('school'); Music.setBoss(true, EchoWorlds.WORLDS.school.boss);
      const rec = new MediaRecorder(c.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 }), chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start(); const t0 = c.currentTime + 0.02;
      // 효과음 만들기 (WebAudio 합성)
      const out = c.createGain(); out.gain.value = 0.9; out.connect(c.destination);
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
      const noise = (t, dur, type, f0, f1, peak, a) => { const n = c.createBufferSource(); n.buffer = nb; const f = c.createBiquadFilter(); f.type = type; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = c.createGain(); env(g, t, a, peak, dur - a); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05); };
      const tone = (t, dur, type, f0, f1, peak) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = c.createGain(); env(g, t, 0.005, peak, dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); };
      const SND = {
        impact: (t) => { tone(t, 0.45, 'sine', 160, 38, 0.9); noise(t, 0.18, 'lowpass', 2500, 300, 0.5, 0.004); tone(t, 0.05, 'square', 900, 200, 0.12); },
        thud: (t) => { tone(t, 0.25, 'sine', 110, 45, 0.45); },
        tr0: (t) => { noise(t - 0.2, 0.28, 'bandpass', 300, 5000, 0.5, 0.2); tone(t, 0.3, 'sine', 90, 40, 0.5); },   // 확대 펀치: 빨려 드는 소리 + 쿵
        tr1: (t) => { noise(t - 0.05, 0.32, 'bandpass', 600, 4500, 0.7, 0.08); noise(t + 0.05, 0.25, 'bandpass', 4000, 700, 0.35, 0.03); },   // 휙
        tr2: (t) => { for (let j = 0; j < 6; j++) tone(t + j * 0.03, 0.03, 'square', 2400 - j * 300, 300 + j * 80, 0.1); noise(t, 0.2, 'highpass', 3000, 1500, 0.25, 0.005); },   // 지지직
        tr3: (t) => { noise(t - 0.08, 0.35, 'highpass', 1500, 6000, 0.45, 0.15); tone(t + 0.05, 0.18, 'triangle', 1200, 2400, 0.12); },   // 슈욱
        sparkle: (t) => { [1568, 2093, 2637, 3136].forEach((f, j) => tone(t + j * 0.07, 0.35, 'sine', f, f, 0.13)); },
      };
      for (const [n, t] of cues) {
        if (n.startsWith('game:')) setTimeout(() => Sfx.play(n.slice(5)), Math.max(0, (t0 - c.currentTime + t) * 1000));
        else if (SND[n]) SND[n](t0 + Math.max(0.01, t));
      }
      await new Promise((r) => setTimeout(r, sw * 1000));
      Music.stop(); Music.play('menu');
      await new Promise((r) => setTimeout(r, (total + 0.6 - sw) * 1000));
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      const buf = await new Blob(chunks).arrayBuffer(); let bin = ''; const u = new Uint8Array(buf);
      for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
      return btoa(bin);
    }, [sw, cues, TOTAL()]);
    const music = path.join(OUT, 'music.webm'); fs.writeFileSync(music, Buffer.from(webm, 'base64'));
    const final = path.join(OUT, 'echo-rush-reels.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', music, '-filter_complex', `[1:a]atrim=0:${TOTAL()},afade=t=in:d=0.15,afade=t=out:st=${TOTAL() - 1.2}:d=1.2,loudnorm=I=-14:TP=-1.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    await ap.close(); fs.unlinkSync(silent); fs.unlinkSync(music);   // 중간 파일 정리
  }
  console.log(errs.length ? errs : 'done: ' + MODE);
  await b.close();
})();
