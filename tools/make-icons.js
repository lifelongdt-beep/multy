/* Echo Rush — 앱 아이콘 만들기 (게임 그림 그대로: 노을 하늘 · 주인공 · 뒤따르는 에코)
 * 실행: node tools/make-icons.js  →  icons/icon-192.png · icon-512.png · maskable-512.png · apple-touch-icon.png
 * 주인공 그림이 바뀌면 다시 실행한다. (Playwright 필요) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'icons');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 600, height: 600 } })).newPage();
  await p.addInitScript(() => { window.ART_SPRITE_SCALE = 12; });   // 크게 그려도 흐리지 않게 고해상도 스프라이트
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(500);
  const make = async (size, mask) => p.evaluate(([size, mask]) => {
    const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d');
    const k = size / 512;
    // 배경: 메인 화면처럼 노을 하늘 (마스크용은 꽉 채움, 일반은 둥근 네모)
    const r = mask ? 0 : 112 * k;
    g.save(); g.beginPath(); g.roundRect(0, 0, size, size, r); g.clip();
    const gr = g.createLinearGradient(0, 0, 0, size); gr.addColorStop(0, '#2b2466'); gr.addColorStop(0.55, '#6a3f9e'); gr.addColorStop(1, '#ff9a6b'); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    // 반짝이는 별
    const star = (x, y, s, a) => { g.save(); g.translate(x * k, y * k); g.globalAlpha = a; g.fillStyle = '#fff6c8'; g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.38 : s; const an = -Math.PI / 2 + i * Math.PI / 4; g.lineTo(Math.cos(an) * rr * k, Math.sin(an) * rr * k); } g.closePath(); g.fill(); g.restore(); };
    for (const [x, y, s, a] of [[92, 96, 16, .9], [420, 120, 20, .95], [380, 60, 9, .7], [120, 200, 8, .6], [440, 250, 10, .7], [70, 330, 11, .6]]) star(x, y, s, a);
    // 빛나는 길 (메인 화면의 길)
    g.fillStyle = 'rgba(255,230,160,.35)'; g.beginPath(); g.moveTo(210 * k, size); g.lineTo(250 * k, 300 * k); g.lineTo(262 * k, 300 * k); g.lineTo(302 * k, size); g.closePath(); g.fill();
    // 뒤를 따르는 에코 (반투명)
    const hs = (mask ? 6.2 : 7.4) * k, cx = 256 * k, cy = (mask ? 270 : 262) * k;
    g.globalAlpha = 0.28; Art.drawKidPreview(g, cx - 120 * k, cy + 18 * k, '🙂', 0, hs * 0.7); Art.drawKidPreview(g, cx + 120 * k, cy + 18 * k, '🙂', 0, hs * 0.7); g.globalAlpha = 1;
    // 은은한 빛 + 주인공
    const gl = g.createRadialGradient(cx, cy, 10 * k, cx, cy, 200 * k); gl.addColorStop(0, 'rgba(255,240,180,.55)'); gl.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gl; g.fillRect(0, 0, size, size);
    Art.drawKidPreview(g, cx, cy, '🙂', 0, hs);
    g.restore();
    return c.toDataURL('image/png').split(',')[1];
  }, [size, mask]);
  for (const [name, size, mask] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) fs.writeFileSync(`${OUT}/${name}`, Buffer.from(await make(size, mask), 'base64'));
  console.log(errs); await b.close();
})();
