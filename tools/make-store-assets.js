/* Echo Rush — 구글 플레이 등록용 그림 만들기
 * 실행: node tools/make-store-assets.js → docs/store/
 *  - screenshot-1~6.png (1080×1920, 세로 폰)  - feature-graphic.png (1024×500)  - icon-512.png
 * (Playwright 필요) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'store');
const SAVE = (world, extra) => JSON.stringify(Object.assign({ v: 1, coins: 1240, tutorial: true, stats: { runs: 40 }, worlds: { selected: world, clears: { school: 2, academy: 1 }, cycleClears: {}, best: {} } }, extra || {}));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const open = async (world) => { await p.goto('file://' + path.join(ROOT, 'index.html')); await p.evaluate((s) => { localStorage.clear(); localStorage.setItem('echo-meta-v1', s); }, SAVE(world)); await p.reload(); await p.waitForTimeout(700); };
  const shot = async (n) => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(OUT, `screenshot-${n}.png`) }); };
  const run = (sec, input) => p.evaluate(([sec, input]) => { const s = __echo.sim; for (let i = 0; i < 60 * sec; i++) { s.player.hp = Math.max(s.player.hp, s.player.maxhp * 0.7); if (s.choices) s.choose(s.choices[0].id); s.step(input === 'wiggle' ? { dx: Math.sin(i / 45), dy: Math.cos(i / 70) * 0.6 } : { dx: 0, dy: 0 }); } }, [sec, input]);
  // 1) 메인 화면
  await open('school'); await shot(1);
  // 2) 튜토리얼: 과거의 나 10명(에코)과 함께 싸우는 장면
  await p.goto('file://' + path.join(ROOT, 'index.html')); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await p.click('#tStart'); await p.waitForTimeout(400); await run(40, 'wiggle'); await p.evaluate(() => { window.__echo.toast && (window.__echo.toast.t = 0); }); await shot(2);
  // 3) 도와주는 선생님 (말풍선)
  await open('school'); await p.click('#go'); await p.waitForTimeout(300);
  await p.evaluate(() => { const s = __echo.sim; let n = 0; while (!s.helper && n++ < 6000) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: Math.sin(n / 40) * 0.5, dy: 0 }); } const h = s.helper; s.player.x = h.x + 18; s.player.y = h.y + 12; h.prog = Math.floor(h.need * 0.5); });
  await shot(3);
  // 4) 왕(큰 도전) 등장
  await open('school'); await p.click('#go'); await p.waitForTimeout(300);
  await p.evaluate(() => { const s = __echo.sim; let n = 0; while (!s.bossAlive && n++ < 9000) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: Math.sin(n / 40) * 0.7, dy: Math.cos(n / 60) * 0.4 }); } for (let i = 0; i < 200; i++) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: Math.sin(i / 30) * 0.8, dy: 0.2 }); } s.player.hp = s.player.maxhp * 0.75; });
  await p.waitForTimeout(1200); await shot(4);
  // 5) 다른 월드: 바닷가
  await open('beach'); await p.evaluate(() => { GameUI.worldId = () => 'beach'; }); await p.click('#go'); await p.waitForTimeout(300); await run(35, 'wiggle'); await shot(5);
  // 6) 상점
  await open('school'); await p.click('#bShop'); await p.waitForTimeout(500); await shot(6);
  // 아이콘 512
  fs.copyFileSync(path.join(ROOT, 'icons', 'icon-512.png'), path.join(OUT, 'icon-512.png'));
  // 대표 그림 1024×500: 메인 화면의 노을 길 + 게임 제목
  const fp = await (await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })).newPage();
  await fp.goto('file://' + path.join(ROOT, 'index.html')); await fp.waitForTimeout(800);
  await fp.evaluate(() => {
    document.body.innerHTML = '';
    const c = document.createElement('canvas'); c.width = 1024; c.height = 500; c.style.cssText = 'position:fixed;left:0;top:0'; document.body.appendChild(c);
    const g = c.getContext('2d'); Art.drawMenuScene(g, 1024, 500, 4200, { emo: '🙂', cycle: 0 });
    const lg = document.createElement('div'); lg.className = 'logo'; lg.innerHTML = '<span class="lg1">ECHO</span><span class="lg2">RUSH</span><span class="lgk">✨ 에코 러시 ✨</span>';
    lg.style.cssText = 'position:fixed;left:0;right:0;top:34px;transform:scale(1.25);transform-origin:top center'; document.body.appendChild(lg);
  });
  await fp.waitForTimeout(600); await fp.screenshot({ path: path.join(OUT, 'feature-graphic.png') });
  console.log(errs.length ? errs : 'store assets written to docs/store/');
  await b.close();
})();
