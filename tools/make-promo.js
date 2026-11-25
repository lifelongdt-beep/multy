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
const SCENES = [
  { id: 'boss',  world: 'school',  sec: 2,   cap: ['시험 불안이 왔다!'] },
  { id: 'alone', world: 'beach',   sec: 3,   cap: ['혼자선 힘들지?'] },
  { id: 'echo',  world: 'stage',   sec: 5,   cap: ['한 판 끝나면', '과거의 내가 도와줘!'] },
  { id: 'deed',  world: 'academy', sec: 3,   cap: ['착한 일 하면', '더 세져!'] },
  { id: 'end',   world: null,      sec: 2,   cap: [] },
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 시계 멈추기: requestAnimationFrame·performance.now를 직접 한 칸씩 돌림
  await p.addInitScript(() => {
    let now = 0; const q = []; Date.now = () => 1767225600000;   // 매번 같은 판이 나오게
    performance.now = () => now;
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__step = (ms) => { now += ms; const cbs = q.splice(0); for (const cb of cbs) cb(now); };
    localStorage.setItem('echo-gfx', JSON.stringify({ mode: 'high' }));
  });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.evaluate(() => document.fonts.load('80px "Black Han Sans"'));
  await p.evaluate(() => { localStorage.setItem('echo-meta-v1', JSON.stringify({ v: 1, coins: 0, tutorial: true, stats: { runs: 30 }, worlds: { selected: 'school', clears: { school: 1 }, cycleClears: {}, best: {} } })); });
  await p.reload(); await p.evaluate(() => document.fonts.load('80px "Black Han Sans"')); await p.evaluate(() => { for (let i = 0; i < 10; i++) __step(16); });
  await p.evaluate(() => {
    window.__grab = (cap, k, endCard, flash) => {
      const src = document.getElementById('c'), o = window.__o || (window.__o = document.createElement('canvas')); o.width = 1080; o.height = 1920; const g = o.getContext('2d');
      g.drawImage(src, 0, 0, 1080, 1920);
      const line = (t, y, size, fill, delay) => { const pop = Math.max(0, Math.min(1, (k - delay) * 5)); if (pop <= 0) return; const sc = 0.6 + 0.4 * (1 + 2.7 * Math.pow(pop - 1, 3) + 1.7 * Math.pow(pop - 1, 2));
        g.save(); g.globalAlpha = Math.min(1, pop * 2); g.translate(540, y); g.scale(sc, sc); g.font = `${size}px "Black Han Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = size * 0.22; g.strokeStyle = '#1b0f2e'; g.strokeText(t, 0, 0); g.fillStyle = fill; g.fillText(t, 0, 0); g.restore(); };
      if (endCard) {
        g.fillStyle = 'rgba(10,8,30,.25)'; g.fillRect(0, 0, 1080, 1920);
        line('ECHO RUSH', 520, 140, '#ffd54f', 0); line('에코 러시', 680, 90, '#ffffff', 0.15);
        line('구글 플레이 출시 예정', 1180, 92, '#7dffb2', 0.35); line('테스터 모집 중! DM 줘', 1320, 80, '#ffe58a', 0.55);
      } else cap.forEach((t, i) => line(t, 470 + i * 130 - (cap.length - 1) * 65, 112, i === cap.length - 1 ? '#ffe58a' : '#ffffff', 0.1 + i * 0.25));
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.8})`; g.fillRect(0, 0, 1080, 1920); }
      return o.toDataURL('image/jpeg', 0.93).split(',')[1];
    };
  });
  // 한 장면 준비 (게임 시작 + 상태 맞추기)
  const setup = (sc) => p.evaluate((sc) => {
    const hp = () => { const s = __echo.sim; if (s) s.player.hp = Math.max(s.player.hp, s.player.maxhp * 0.8); };
    const pick = () => { const s = __echo.sim; if (s.choices) s.choose(s.choices[0].id); };
    const run = (n, move) => { const s = __echo.sim; for (let i = 0; i < n; i++) { hp(); pick(); s.step(move ? move(i) : { dx: 0, dy: 0 }); } };
    if (!sc.world) { if (__echo.state !== 'menu') document.getElementById('toMenu').click(); document.getElementById('pause').classList.add('hidden'); return; }
    GameUI.worldId = () => sc.world;
    if (sc.id === 'echo') GameEchoes.replace({ world: 'stage', echoes: EchoTutorial.makeTutorialEchoes(7) }); else GameEchoes.reset(sc.world);
    document.getElementById('start').classList.add('hidden'); document.getElementById('end').classList.add('hidden');
    document.getElementById('go').click();
    const s = __echo.sim, wig = (i) => ({ dx: Math.sin(i / 40) * 0.6, dy: Math.cos(i / 55) * 0.4 });
    const tough = (e) => { e.hp = e.maxhp = 1e9; };
    const clearTop = () => { s.enemies = s.enemies.filter((e) => e.type === 'boss' || e.guard || e.y > 300); };
    const place = (x, y) => { s.player.x = x; s.player.y = y; };
    // 에코의 앞으로 기록을 (cx,cy) 둘레를 천천히 도는 길로 바꿈
    const orbit = (cx, cy, rad) => { const t = s.tick; s.echoes.forEach((ec, k) => { ec.alive = true; ec.down = 0; ec.hp = 1e9; const a0 = k / s.echoes.length * Math.PI * 2; const path = ec.path.slice(0, t * 2); while (path.length < t * 2) path.push(cx, cy);
      for (let j = 0; j < 60 * 30; j++) { const a = a0 + j * 0.012; path.push(cx + Math.cos(a) * rad * (1 + 0.12 * Math.sin(j / 20 + k)), cy + Math.sin(a) * rad * 0.8); } ec.path = path; }); };
    if (sc.id === 'boss') { let n = 0; while (!s.bossAlive && n++ < 9000) run(1, wig); const bs = s.enemies.find((e) => e.type === 'boss'); clearTop(); if (bs) { bs.x = 180; bs.y = 360; tough(bs); } place(180, 520); }
    if (sc.id === 'alone') { run(60 * 30, wig); s.enemies = []; place(180, 420); const kinds = Object.keys(s.world.enemies).filter((k) => s.world.enemies[k].ai !== 'shoot' && !s.world.enemies[k].boss);
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; s._make(kinds[k % kinds.length], 180 + Math.cos(a) * 78, 420 + Math.sin(a) * 78); const e = s.enemies[s.enemies.length - 1]; tough(e); e.speed *= 0.12; } }
    if (sc.id === 'echo') { let n = 0; while (!s.bossAlive && n++ < 9000) run(1, wig); const bs = s.enemies.find((e) => e.type === 'boss'); clearTop(); if (bs) { bs.x = 180; bs.y = 400; bs.hp = bs.maxhp * 0.35; } place(180, 540); orbit(180, 400, 105); }
    if (sc.id === 'deed') { let n = 0; while (!(s.deeds && s.deeds.rescue) && n++ < 9000) run(1, wig); const rs = s.deeds.rescue; clearTop(); s.enemies = s.enemies.filter((e) => e.guard);
      if (rs) { const dx = 180 - rs.x, dy = 430 - rs.y; rs.x += dx; rs.y += dy; for (const e of rs.guards) { e.x += dx; e.y += dy; e.hp = 1; } } place(110, 450); }
  }, sc);
  // 화면 한 장 찍기: 게임 그림 + 자막 (게임 제목 글씨체, 화면 위쪽)
  const grab = (cap, k, endCard) => p.evaluate(([cap, k, endCard]) => {
    const src = document.getElementById('c'), o = document.createElement('canvas'); o.width = 1080; o.height = 1920; const g = o.getContext('2d');
    g.drawImage(src, 0, 0, 1080, 1920);
    const pop = Math.min(1, k * 4), sc = 0.7 + 0.3 * (1 - Math.pow(1 - pop, 3));   // 자막이 톡 커지며 나타남
    const line = (t, y, size, fill) => { g.save(); g.translate(540, y); g.scale(sc, sc); g.font = `${size}px "Black Han Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = size * 0.22; g.strokeStyle = '#1b0f2e'; g.strokeText(t, 0, 0); g.fillStyle = fill; g.fillText(t, 0, 0); g.restore(); };
    if (endCard) {
      g.fillStyle = 'rgba(10,8,30,.25)'; g.fillRect(0, 0, 1080, 1920);
      line('ECHO RUSH', 520, 140, '#ffd54f'); line('에코 러시', 680, 90, '#ffffff');
      line('구글 플레이 출시 예정', 1180, 92, '#7dffb2'); line('테스터 모집 중! DM 줘', 1320, 80, '#ffe58a');
    } else cap.forEach((t, i) => line(t, 470 + i * 130 - (cap.length - 1) * 65, 112, i === cap.length - 1 ? '#ffe58a' : '#ffffff'));
    return o.toDataURL('image/png').split(',')[1];
  }, [cap, k, endCard]);
  if (MODE === 'keyframes') {
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc);
      await p.evaluate((n) => { for (let j = 0; j < n; j++) __step(1000 / 30); }, Math.round(FPS * sc.sec * 0.5));
      fs.writeFileSync(path.join(OUT, `keyframe-${i + 1}.png`), Buffer.from(await grab(sc.cap, 1, sc.id === 'end'), 'base64'));
    }
  }
  if (MODE === 'video') {
    // 1) 그림: 30fps로 한 장씩 찍어 ffmpeg에 바로 넘김
    const silent = path.join(OUT, 'video-silent.mp4');
    const { spawn } = require('child_process');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', silent]);
    const ffDone = new Promise((r) => ff.on('close', r));
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i]; await setup(sc);
      const n = Math.round(FPS * sc.sec);
      for (let f = 0; f < n; f++) {
        await p.evaluate(() => __step(1000 / 30));
        const jpg = await p.evaluate(([cap, k, endCard, flash]) => window.__grab(cap, k, endCard, flash), [sc.cap, f / FPS, sc.id === 'end', i > 0 && f < 6 ? (6 - f) / 6 : 0]);
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
    const webm = await ap.evaluate(async () => {
      Sfx.unlock(); Music.stop();
      const c = Sfx.context(); await c.resume();
      Music.play('school'); Music.setBoss(true, EchoWorlds.WORLDS.school.boss);
      const rec = new MediaRecorder(c.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 }), chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      await new Promise((r) => setTimeout(r, 10000));
      Music.stop(); Music.play('menu');
      await new Promise((r) => setTimeout(r, 5600));
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      const buf = await new Blob(chunks).arrayBuffer(); let bin = ''; const u = new Uint8Array(buf);
      for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
      return btoa(bin);
    });
    const music = path.join(OUT, 'music.webm'); fs.writeFileSync(music, Buffer.from(webm, 'base64'));
    const final = path.join(OUT, 'echo-rush-reels.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', music, '-filter_complex', '[1:a]atrim=0:15,afade=t=in:d=0.15,afade=t=out:st=13.8:d=1.2,loudnorm=I=-14:TP=-1.5[a]', '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    await ap.close(); fs.unlinkSync(silent); fs.unlinkSync(music);   // 중간 파일 정리
  }
  console.log(errs.length ? errs : 'done: ' + MODE);
  await b.close();
})();
