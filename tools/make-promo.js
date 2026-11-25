/* Echo Rush — 인스타 릴스 홍보 영상 만들기 (1080×1920, 15초)
 * 실제 게임을 시계를 멈춘 채 한 장씩 돌려 찍고(끊김 없음), 자막을 얹는다.
 *   node tools/make-promo.js keyframes  → docs/promo/keyframe-1~5.png (장면 확인용)
 *   node tools/make-promo.js video      → docs/promo/echo-rush-reels.mp4
 * (Playwright·ffmpeg 필요) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'promo');
const MODE = process.argv[2] || 'keyframes', FPS = 30;
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
  { id: 'deed',  world: 'academy',  sec: 1.8, cap: C4 },
  { id: 'deed',  world: 'library',  sec: 1.6, cap: C4 },
  { id: 'end',   world: 'stage',    sec: 2.8, cap: [] },
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
  await p.evaluate(() => {
    window.__grab = (cap, k, endCard, flash) => {
      const src = document.getElementById('c'), o = window.__o || (window.__o = document.createElement('canvas')); o.width = 1080; o.height = 1920; const g = o.getContext('2d');
      const want = window.__camFor(window.__scene, k), c = window.__cam && !window.__camCut ? window.__cam : want; window.__camCut = false;
      c.x += (want.x - c.x) * 0.12; c.y += (want.y - c.y) * 0.12; c.z += (want.z - c.z) * 0.12; window.__cam = c;
      const sc = src.width / 360, cw = 360 / c.z, ch = 640 / c.z;
      const x0 = Math.max(0, Math.min(360 - cw, c.x - cw / 2)), y0 = Math.max(105, Math.min(626 - ch, c.y - ch / 2));
      g.imageSmoothingQuality = 'high'; g.drawImage(src, x0 * sc, y0 * sc, cw * sc, ch * sc, 0, 0, 1080, 1920);
      const line = (t, y, size, fill, delay) => { const pop = Math.max(0, Math.min(1, (k - delay) * 5)); if (pop <= 0) return; const sc = 0.6 + 0.4 * (1 + 2.7 * Math.pow(pop - 1, 3) + 1.7 * Math.pow(pop - 1, 2));
        g.save(); g.globalAlpha = Math.min(1, pop * 2); g.translate(540, y); g.scale(sc, sc); g.font = `${size}px "Black Han Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = size * 0.22; g.strokeStyle = '#1b0f2e'; g.strokeText(t, 0, 0); g.fillStyle = fill; g.fillText(t, 0, 0); g.restore(); };
      if (endCard) {
        g.fillStyle = 'rgba(10,8,30,.5)'; g.fillRect(0, 0, 1080, 1920);
        line('ECHO RUSH', 480, 140, '#ffd54f', 0); line('에코 러시', 630, 90, '#ffffff', 0.15);
        line('구글 플레이 출시 예정', 1480, 92, '#7dffb2', 0.35); line('테스터 모집 중! DM 줘', 1620, 80, '#ffe58a', 0.55);
      } else cap.forEach((t, i) => line(t, 470 + i * 130 - (cap.length - 1) * 65, 112, i === cap.length - 1 ? '#ffe58a' : '#ffffff', 0.1 + i * 0.25));
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.8})`; g.fillRect(0, 0, 1080, 1920); }
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
      if (rs) { const dx = 180 - rs.x, dy = 430 - rs.y; rs.x += dx; rs.y += dy; for (const e of rs.guards) { e.x += dx; e.y += dy; tough(e); e.speed = 0; } } place(80, 470); }
  }, sc);
  if (MODE === 'keyframes') {
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc); await p.evaluate((id) => { window.__scene = id; window.__camCut = true; }, sc.id);
      await p.evaluate((n) => { for (let j = 0; j < n; j++) __step(1000 / 30); }, Math.round(FPS * sc.sec * 0.5));
      fs.writeFileSync(path.join(OUT, `keyframe-${i + 1}.jpg`), Buffer.from(await p.evaluate(([c, e]) => window.__grab(c, 1, e, 0), [sc.cap, sc.id === 'end']), 'base64'));
    }
  }
  if (MODE === 'video') {
    // 1) 그림: 30fps로 한 장씩 찍어 ffmpeg에 바로 넘김
    const silent = path.join(OUT, 'video-silent.mp4');
    const { spawn } = require('child_process');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', silent]);
    const ffDone = new Promise((r) => ff.on('close', r));
    let capT = 0;
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc);
      if (i === 0 || SCENES[i - 1].cap !== sc.cap) capT = 0;
      await p.evaluate((id) => { window.__scene = id; window.__camCut = true; window.__helped = false; }, sc.id);
      const n = Math.round(FPS * sc.sec);
      for (let f = 0; f < n; f++) {
        await p.evaluate(([id, f]) => { __tick(id, f); __step(1000 / 30); }, [sc.id, f]);
        const jpg = await p.evaluate(([cap, k, endCard, flash]) => window.__grab(cap, k, endCard, flash), [sc.cap, capT, sc.id === 'end', i > 0 && f < 3 ? (3 - f) / 5 : 0]); capT += 1 / FPS;
        if (!ff.stdin.write(Buffer.from(jpg, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
    }
    ff.stdin.end(); await ffDone;
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
    const webm = await ap.evaluate(async (sw) => {
      Sfx.unlock(); Music.stop();
      const c = Sfx.context(); await c.resume();
      Music.play('school'); Music.setBoss(true, EchoWorlds.WORLDS.school.boss);
      const rec = new MediaRecorder(c.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 }), chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      await new Promise((r) => setTimeout(r, sw * 1000));
      Music.stop(); Music.play('menu');
      await new Promise((r) => setTimeout(r, (15.6 - sw) * 1000));
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      const buf = await new Blob(chunks).arrayBuffer(); let bin = ''; const u = new Uint8Array(buf);
      for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
      return btoa(bin);
    }, sw);
    const music = path.join(OUT, 'music.webm'); fs.writeFileSync(music, Buffer.from(webm, 'base64'));
    const final = path.join(OUT, 'echo-rush-reels.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', music, '-filter_complex', '[1:a]atrim=0:15,afade=t=in:d=0.15,afade=t=out:st=13.8:d=1.2,loudnorm=I=-14:TP=-1.5[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    await ap.close(); fs.unlinkSync(silent); fs.unlinkSync(music);   // 중간 파일 정리
  }
  console.log(errs.length ? errs : 'done: ' + MODE);
  await b.close();
})();
