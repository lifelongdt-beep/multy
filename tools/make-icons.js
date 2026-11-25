/* Echo Rush — 앱 아이콘 만들기 (게임 그림 그대로)
 * 디자인: 노을 하늘 + 퍼지는 햇살 · 금빛 후광 고리 안의 주인공(상반신 크게) · 둘레를 도는 웃는 별 에코 · 분홍 하트
 * 실행: node tools/make-icons.js  →  icons/icon-192.png · icon-512.png · maskable-512.png · apple-touch-icon.png
 * 주인공 그림이 바뀌면 다시 실행한다. (Playwright 필요) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'icons');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 600, height: 600 } })).newPage();
  await p.addInitScript(() => { window.ART_SPRITE_SCALE = 12; });   // 크게 그려도 흐리지 않게 고해상도 스프라이트
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(500);
  const make = (size, mask) => p.evaluate(([size, mask]) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const S = 512; g.scale(size / S, size / S);
    g.save(); g.beginPath(); g.roundRect(0, 0, S, S, mask ? 0 : 112); g.clip();   // 마스크용·아이폰용은 꽉 채움 (기기가 모양을 잘라 씀)
    // 배경: 노을 하늘 + 햇살 (가장자리까지)
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#2b2466'); gr.addColorStop(0.55, '#6a3f9e'); gr.addColorStop(1, '#ff9a6b'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) { g.save(); g.translate(256, 300); g.rotate(i * Math.PI / 7); g.fillStyle = 'rgba(255,240,200,.09)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-38, -440); g.lineTo(38, -440); g.fill(); g.restore(); }
    // 마스크용: 안쪽 그림을 82%로 (동그라미로 잘려도 주인공·별이 안 잘리게)
    if (mask) { g.translate(256, 256); g.scale(0.82, 0.82); g.translate(-256, -256); }
    const sparkle = (x, y, s, a) => { g.save(); g.translate(x, y); g.globalAlpha = a; g.fillStyle = '#fff6c8'; g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.36 : s, an = -Math.PI / 2 + i * Math.PI / 4; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill(); g.restore(); };
    const glow = (x, y, r, col) => { const gl = g.createRadialGradient(x, y, 4, x, y, r); gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(-100, -100, S + 200, S + 200); };
    const star5 = (x, y, r, rot) => {   // 웃는 별 에코
      g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.48 : r, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath();
      g.lineJoin = 'round'; g.fillStyle = '#ffe58a'; g.fill(); g.lineWidth = r * 0.09; g.strokeStyle = '#6a4a1a'; g.stroke();
      g.fillStyle = '#6a4a1a'; g.beginPath(); g.arc(-r * 0.2, -r * 0.05, r * 0.07, 0, 7); g.arc(r * 0.2, -r * 0.05, r * 0.07, 0, 7); g.fill();
      g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, r * 0.08, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.restore();
    };
    for (const [x, y, s, a] of [[70, 80, 13, .8], [446, 70, 16, .9], [470, 300, 9, .6], [50, 260, 9, .6]]) sparkle(x, y, s, a);
    glow(256, 270, 220, 'rgba(255,225,140,.7)');
    g.lineWidth = 9; g.strokeStyle = 'rgba(255,215,120,.9)'; g.beginPath(); g.arc(256, 250, 168, 0, 7); g.stroke();   // 금빛 후광
    Art.drawKidPreview(g, 256, 330, '🙂', 0, 11);                                                                      // 주인공 (상반신 크게)
    for (const [x, y, r, rot] of [[86, 400, 44, -.3], [430, 410, 40, .3], [120, 150, 30, .2], [402, 160, 34, -.2]]) star5(x, y, r, rot);
    g.save(); g.translate(352, 120); g.scale(1.4, 1.4); g.beginPath(); g.moveTo(0, 18); g.bezierCurveTo(-30, -2, -20, -26, 0, -12); g.bezierCurveTo(20, -26, 30, -2, 0, 18); g.fillStyle = '#ff6fae'; g.fill(); g.lineWidth = 3 / 1.4; g.strokeStyle = '#fff'; g.stroke(); g.restore();
    g.restore();
    return c.toDataURL('image/png').split(',')[1];
  }, [size, mask]);
  for (const [name, size, mask] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) fs.writeFileSync(path.join(OUT, name), Buffer.from(await make(size, mask), 'base64'));
  console.log(errs.length ? errs : 'icons written');
  await b.close();
})();
