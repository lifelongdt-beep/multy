/* Echo Rush — 메뉴 화면 배경 (첫 화면 · 상점 · 내 캐릭터 · 선행 · 과제 · 결과 등 게임 밖 화면)
 * 이야기: 해 질 녘, 주인공이 빛나는 길 위에 서 있고 뒤에는 '과거의 나(에코)'들이 둥실 따라온다.
 * 지평선에는 앞으로 지나갈 12개 월드가 천천히 흘러가고, 길에는 구슬이 반짝인다. 고정된 부분은 한 번 그려 두고 움직이는 것만 매번 그린다 */
(function (root) {
  'use strict';
  const Art = root.Art; if (!Art) return;
  const OL = '#2b2119';
  let still = null, stillKey = '';
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const HORIZON = 0.56;   // 지평선 높이 (화면 비율)

  function paintStill(W, H) {   // 하늘 · 먼 산 · 들판 · 길 (움직이지 않는 부분)
    const c = document.createElement('canvas'), S = 2; c.width = W * S; c.height = H * S;
    const g = c.getContext('2d'); g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round';
    const hy = H * HORIZON;
    const sky = g.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#1b1840'); sky.addColorStop(0.45, '#3a2d6a'); sky.addColorStop(0.8, '#a2557e'); sky.addColorStop(1, '#f2a46a');
    g.fillStyle = sky; g.fillRect(0, 0, W, hy + 2);
    // 지는 해 (지평선 위 반쯤)
    const sun = g.createRadialGradient(W * 0.5, hy, 4, W * 0.5, hy, 120); sun.addColorStop(0, 'rgba(255,230,160,.9)'); sun.addColorStop(0.25, 'rgba(255,190,120,.45)'); sun.addColorStop(1, 'rgba(255,160,110,0)');
    g.fillStyle = sun; g.fillRect(0, hy - 130, W, 140);
    g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(W * 0.5, hy + 4, 26, Math.PI, 0); g.fill();
    // 먼 산 두 겹
    const ridge = (y0, amp, col, seed) => { const r = rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, hy); let x = 0; while (x <= W) { g.lineTo(x, y0 - r() * amp); x += 30 + r() * 30; } g.lineTo(W, hy); g.closePath(); g.fill(); };
    ridge(hy - 6, 34, '#5a3f78', 5); ridge(hy + 2, 20, '#4a3466', 9);
    // 들판
    const fld = g.createLinearGradient(0, hy, 0, H); fld.addColorStop(0, '#3d4d6a'); fld.addColorStop(0.5, '#2f3a55'); fld.addColorStop(1, '#232a42');
    g.fillStyle = fld; g.fillRect(0, hy, W, H - hy);
    const r = rng(17); g.fillStyle = 'rgba(160,190,255,.06)'; for (let i = 0; i < 160; i++) { const y = hy + Math.pow(r(), 0.7) * (H - hy); g.fillRect(r() * W, y, 1 + (y - hy) / 120, 1); }   // 풀 반짝임
    // 빛나는 길: 아래(넓게)에서 지평선 해 쪽으로 (원근)
    const path = (w0, w1, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(W * 0.5 - w0, H + 4); g.bezierCurveTo(W * 0.5 - w0 * 0.6, H * 0.8, W * 0.5 - 40, hy + 50, W * 0.5 - w1, hy); g.lineTo(W * 0.5 + w1, hy); g.bezierCurveTo(W * 0.5 + 40, hy + 50, W * 0.5 + w0 * 0.6, H * 0.8, W * 0.5 + w0, H + 4); g.closePath(); g.fill(); };
    path(150, 6, 'rgba(255,214,150,.12)'); path(110, 4, 'rgba(255,220,160,.2)'); path(72, 3, '#e8c48e');
    const pg = g.createLinearGradient(0, hy, 0, H); pg.addColorStop(0, 'rgba(255,240,200,.65)'); pg.addColorStop(1, 'rgba(120,80,60,.35)');
    path(72, 3, pg);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.beginPath(); g.moveTo(W * 0.5, H); g.bezierCurveTo(W * 0.5, H * 0.8, W * 0.5, hy + 60, W * 0.5, hy + 4); g.stroke(); g.setLineDash([]);   // 가운데 점선
    // 위아래 살짝 어둡게 (글자가 잘 보이게)
    const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(10,8,30,.45)'); vg.addColorStop(0.3, 'rgba(10,8,30,0)'); vg.addColorStop(0.85, 'rgba(10,8,30,0)'); vg.addColorStop(1, 'rgba(10,8,30,.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    c.lw = W; c.lh = H; return c;
  }

  const WORLDS = ['school', 'academy', 'office', 'subway', 'home', 'gym', 'library', 'beach', 'airport', 'hospital', 'mountain', 'stage'];
  /**
   * 메뉴 배경 그리기. o: { emo, cycle, win(결과 화면에서 이겼으면 true/졌으면 false/메뉴는 undefined) }
   */
  const runner = { x: null, dir: 1, moving: false, last: 0, eaten: new Set(), pops: [] };   // 메뉴 배경의 주인공: 구슬을 먹으러 좌우로 걷는다
  Art.drawMenuScene = function (ctx, W, H, now, o) {
    o = o || {};
    const key = W + 'x' + H;
    if (!still || stillKey !== key) { still = paintStill(W, H); stillKey = key; }
    ctx.drawImage(still, 0, 0, W, H);
    const t = now / 1000, hy = H * HORIZON;
    // 별 · 초승달
    const r = rng(3);
    for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * hy * 0.75, tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + r()) + i)); ctx.globalAlpha = tw * (0.4 + 0.6 * (1 - y / hy)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, i % 9 ? 1.2 : 2, i % 9 ? 1.2 : 2); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(W * 0.84, H * 0.1); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(6, -4, 12.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // 지평선을 따라 흘러가는 12개 월드 (앞으로 지나갈 여정)
    const gap = 74, span = WORLDS.length * gap, scroll = (t * 9) % span;
    for (let i = 0; i < WORLDS.length; i++) {
      let x = i * gap - scroll; if (x < -gap) x += span;
      if (x > W + gap) continue;
      const near = 1 - Math.min(1, Math.abs(x - W / 2) / (W * 0.7));
      ctx.globalAlpha = 0.55 + 0.45 * near;
      Art.drawWorld(ctx, WORLDS[i], x, hy - 14 - Math.sin(t * 1.2 + i) * 1.5, 30 + 6 * near);
    }
    ctx.globalAlpha = 1;
    // 길 위 반짝이는 구슬 (아래로 다가옴). 주인공이 좌우로 걸어가 먹는다
    const fy = H * 0.962, kEat = Math.pow(Math.max(0, (fy - hy - 8) / (H - hy)), 1 / 1.6);
    const dt = runner.last ? Math.min(0.1, Math.max(0, t - runner.last)) : 0; runner.last = t;
    if (runner.x === null) runner.x = W / 2;
    let target = null, best = -1;
    for (let i = 0; i < 9; i++) {
      const cyc = t * 0.08 + i / 9, k = cyc % 1, id = i + 9 * Math.floor(cyc), y = hy + 8 + Math.pow(k, 1.6) * (H - hy), x = W / 2 + Math.sin(i * 2.1) * (10 + 60 * k);
      if (runner.eaten.has(id)) continue;
      if (k < kEat && k > best && k > kEat - 0.45) { best = k; target = W / 2 + Math.sin(i * 2.1) * (10 + 60 * kEat); }   // 곧 발 앞에 올 구슬
      if (Math.abs(k - kEat) < 0.025 && Math.abs(x - runner.x) < 18) {   // 먹었다! 반짝 + 사라짐
        runner.eaten.add(id); runner.pops.push({ x, y, t: 0 }); if (runner.eaten.size > 60) runner.eaten = new Set([...runner.eaten].slice(-30)); continue;
      }
      const sz = 1.5 + 4 * k; ctx.globalAlpha = Math.min(1, k * 3) * 0.9;
      ctx.fillStyle = '#7dffb2'; ctx.beginPath(); ctx.moveTo(x, y - sz); ctx.lineTo(x + sz * 0.7, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz * 0.7, y); ctx.closePath(); ctx.fill();
    }
    // 주인공 걸음: 다음 구슬 쪽으로 좌우로 걸어감 (게임 속 걷기 모습 그대로)
    const goal = target === null ? W / 2 : target, diff = goal - runner.x, spd = 70 * dt;
    runner.moving = Math.abs(diff) > 1.5; if (runner.moving) { runner.x += Math.sign(diff) * Math.min(Math.abs(diff), spd); runner.dir = diff < 0 ? -1 : 1; }
    for (let i = runner.pops.length - 1; i >= 0; i--) {   // 먹은 구슬 반짝임
      const q = runner.pops[i]; q.t += dt; if (q.t > 0.45) { runner.pops.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - q.t / 0.45; ctx.strokeStyle = '#7dffb2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 4 + q.t * 40, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 과거의 나(에코)들: 주인공 뒤에서 둥실둥실 (반투명 회색)
    const form = Art.echoForm || 'star', kx = runner.x;
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, dist = 1 + Math.floor(i / 2);
      const x = kx + side * (26 + dist * 22), y = fy - 24 - dist * 26 + Math.sin(t * 1.6 + i) * 3;
      ctx.globalAlpha = 0.34 - dist * 0.06;
      Art.drawEchoForm(ctx, form, x, y, 1.35 - dist * 0.18, t + i);
    }
    ctx.globalAlpha = 1;
    // 주인공 (지금 모습·회차 복장): 춤 대신 게임 속처럼 걸어 다니며 구슬을 먹는다 (이기면 통통 뜀)
    const hop = o.win ? Math.abs(Math.sin(t * 5)) * 6 : 0;
    const gl = ctx.createRadialGradient(kx, fy, 4, kx, fy, 48); gl.addColorStop(0, 'rgba(255,230,170,.35)'); gl.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = gl; ctx.fillRect(kx - 50, fy - 50, 100, 100);
    if (Art.drawPlayer && Art.setOutfit) { Art.setOutfit(o.cycle || 0); Art.drawPlayer(ctx, { x: kx, y: fy - 4 - hop }, o.emo || '🧑‍🎓', runner.moving, runner.dir, now, false, o.win ? { pose: 'cheer' } : null); }
    else if (Art.drawKidPreview) Art.drawKidPreview(ctx, kx, fy - 4 - hop, o.emo || '🧑‍🎓', o.cycle || 0, 1.5);
    // 떠다니는 작은 빛
    for (let i = 0; i < 14; i++) { const k = (t * 0.05 + i / 14) % 1, x = (i * 71 + Math.sin(t * 0.7 + i) * 18) % W, y = H - k * H * 0.9; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.5; ctx.fillStyle = i % 3 ? '#ffe8a8' : '#bfe6ff'; ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (o.win === true) {   // 결과 화면(이김): 색종이
      for (let i = 0; i < 26; i++) { const k = (t * 0.25 + i / 26) % 1, x = (i * 53) % W + Math.sin(t * 2 + i) * 8, y = k * H; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); ctx.fillStyle = ['#ff6fa8', '#ffd84d', '#7dffb2', '#7fc4ff', '#c9a0ff'][i % 5]; ctx.fillRect(-2.5, -1.2, 5, 2.4); ctx.restore(); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
