/* Echo Rush — 내 총알 30가지 모양 (강해질수록 바뀜, 30단계마다 처음부터)
 * 모두 오른쪽(+x)을 향하게 그리고, 날아가는 방향으로 돌려서 찍는다. 한 번 그려 캐시.
 * 한 바퀴 넘으면(30단계 이상) 같은 모양에 금빛 테두리 · 두 바퀴 넘으면 무지개빛 테두리.
 */
(function (root) {
  'use strict';
  const Art = root.Art;
  if (!Art) return;
  const OL = '#2a2440';
  const cache = new Map();
  const S = 2;   // 선명하게 2배로 그려 둠

  function star(g, x, y, n, ro, ri, rot) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath();
  }
  function fs(g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 1; g.strokeStyle = OL; g.stroke(); }
  function glow(g, col, r) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); }
  function tail(g, col, len, w) { const gr = g.createLinearGradient(-len, 0, 0, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -w); g.lineTo(0, w); g.closePath(); g.fill(); }

  // 단계 0~29: 처음엔 학용품, 갈수록 반짝이고 화려하게
  const SHAPES = [
    (g) => { tail(g, 'rgba(255,226,122,.5)', 10, 1.6); g.beginPath(); g.ellipse(0, 0, 4.5, 2.2, 0, 0, 7); fs(g, '#ffe27a'); },                                      // 0 기본 탄
    (g) => { tail(g, 'rgba(255,200,90,.4)', 8, 1.5); g.beginPath(); g.moveTo(6, 0); g.lineTo(2, -2.2); g.lineTo(-5, -2.2); g.lineTo(-5, 2.2); g.lineTo(2, 2.2); g.closePath(); fs(g, '#ffca28'); g.beginPath(); g.moveTo(6, 0); g.lineTo(3.4, -1.1); g.lineTo(3.4, 1.1); g.closePath(); g.fillStyle = '#5d4037'; g.fill(); },   // 1 연필
    (g) => { tail(g, 'rgba(255,170,190,.4)', 8, 2); g.beginPath(); g.rect(-4.5, -2.8, 9, 5.6); fs(g, '#ff9fb5'); g.fillStyle = '#5c8dd6'; g.fillRect(-4.5, -2.8, 3.2, 5.6); },   // 2 지우개
    (g) => { g.beginPath(); g.moveTo(6.5, 0); g.lineTo(-5, -4.5); g.lineTo(-2.5, 0); g.lineTo(-5, 4.5); g.closePath(); fs(g, '#f5f7ff'); g.beginPath(); g.moveTo(6.5, 0); g.lineTo(-2.5, 0); g.strokeStyle = '#9fb3d6'; g.stroke(); },   // 3 종이비행기
    (g) => { tail(g, 'rgba(255,230,120,.45)', 10, 2.4); star(g, 0, 0, 5, 4.6, 2, 0); fs(g, '#ffe066'); },                                                                // 4 별
    (g) => { tail(g, 'rgba(120,200,255,.45)', 9, 2); g.beginPath(); g.moveTo(6, 0); g.lineTo(3, -2.4); g.lineTo(-5, -2.4); g.lineTo(-5, 2.4); g.lineTo(3, 2.4); g.closePath(); fs(g, '#4fc3f7'); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-4, -1.6, 6, 1); },   // 5 크레파스
    (g) => { tail(g, 'rgba(140,220,180,.45)', 9, 2.6); g.beginPath(); g.arc(0, 0, 3.8, 0, 7); fs(g, '#66d9a3'); g.beginPath(); g.arc(-1.2, -1.2, 1.2, 0, 7); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); },   // 6 구슬
    (g) => { tail(g, 'rgba(200,160,255,.45)', 9, 2); g.beginPath(); g.ellipse(-1.5, 2, 3, 2.2, -0.4, 0, 7); fs(g, '#b39ddb'); g.beginPath(); g.moveTo(1.3, 1.5); g.lineTo(1.3, -5); g.quadraticCurveTo(4, -4, 5, -2); g.lineWidth = 1.4; g.strokeStyle = OL; g.stroke(); },   // 7 음표
    (g) => { tail(g, 'rgba(255,140,180,.5)', 10, 2.6); g.beginPath(); g.moveTo(5, 0); g.bezierCurveTo(1, -6, -5, -3, -3, 0); g.bezierCurveTo(-5, 3, 1, 6, 5, 0); fs(g, '#ff6f9f'); },   // 8 하트
    (g) => { tail(g, 'rgba(120,230,255,.5)', 11, 2.6); g.beginPath(); g.moveTo(6, 0); g.lineTo(0, -3.6); g.lineTo(-4.5, 0); g.lineTo(0, 3.6); g.closePath(); fs(g, '#7ee8fa'); g.beginPath(); g.moveTo(0, -3.6); g.lineTo(1, 0); g.lineTo(0, 3.6); g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(); },   // 9 보석
    (g) => { tail(g, 'rgba(140,220,110,.45)', 10, 2.2); g.beginPath(); g.moveTo(6, 0); g.quadraticCurveTo(0, -5, -5, 0); g.quadraticCurveTo(0, 5, 6, 0); fs(g, '#7cc95a'); g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.strokeStyle = '#3f7d2a'; g.stroke(); },   // 10 잎
    (g) => { glow(g, 'rgba(255,240,120,.5)', 8); g.beginPath(); g.moveTo(6, -1); g.lineTo(0, -1); g.lineTo(2, -4.5); g.lineTo(-5.5, 1); g.lineTo(0, 1); g.lineTo(-2, 4.5); g.closePath(); fs(g, '#fff176'); },   // 11 번개
    (g) => { glow(g, 'rgba(255,240,180,.45)', 8); g.save(); g.beginPath(); g.arc(0, 0, 4.6, 0, 7); g.fillStyle = '#fff3b0'; g.fill(); g.lineWidth = 1; g.strokeStyle = OL; g.stroke(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(-2.4, -0.6, 3.9, 0, 7); g.fill(); g.restore(); },   // 12 초승달
    (g) => { tail(g, 'rgba(255,220,120,.5)', 12, 3); star(g, 1.5, -1.5, 5, 3.6, 1.5, 0); fs(g, '#ffd54f'); star(g, -2.5, 2, 5, 2.4, 1, 0.5); fs(g, '#fff59d'); },   // 13 쌍둥이별
    (g) => { glow(g, 'rgba(255,140,60,.5)', 9); g.beginPath(); g.moveTo(6, 0); g.quadraticCurveTo(0, -5, -5, -1); g.quadraticCurveTo(-3, 0, -5, 1); g.quadraticCurveTo(0, 5, 6, 0); fs(g, '#ff8a3d'); g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(0, -2.4, -2, 0); g.quadraticCurveTo(0, 2.4, 4, 0); g.fillStyle = '#ffe082'; g.fill(); },   // 14 불꽃
    (g) => { glow(g, 'rgba(180,230,255,.5)', 9); g.strokeStyle = '#e3f6ff'; g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; g.beginPath(); g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); g.lineTo(-Math.cos(a) * 5, -Math.sin(a) * 5); g.stroke(); } g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fillStyle = '#fff'; g.fill(); },   // 15 눈송이
    (g) => { tail(g, 'rgba(255,180,120,.4)', 10, 2.6); g.beginPath(); g.arc(0, 0, 3.4, 0, 7); fs(g, '#ffb74d'); g.beginPath(); g.ellipse(0, 0, 6.5, 1.8, -0.4, 0, 7); g.lineWidth = 1.3; g.strokeStyle = '#fff3e0'; g.stroke(); },   // 16 행성
    (g) => { g.beginPath(); g.moveTo(-5, 0); g.lineTo(4, 0); g.lineWidth = 1.6; g.strokeStyle = '#8d6e63'; g.stroke(); g.beginPath(); g.moveTo(7, 0); g.lineTo(3, -2.6); g.lineTo(3, 2.6); g.closePath(); fs(g, '#cfd8dc'); g.beginPath(); g.moveTo(-5, 0); g.lineTo(-7, -2.6); g.lineTo(-3.5, 0); g.lineTo(-7, 2.6); g.closePath(); fs(g, '#ef5350'); },   // 17 화살
    (g) => { tail(g, 'rgba(160,220,255,.6)', 18, 3.4); g.beginPath(); g.arc(1, 0, 3.4, 0, 7); fs(g, '#e1f5fe'); },   // 18 혜성
    (g) => { glow(g, 'rgba(255,255,200,.55)', 9); star(g, 0, 0, 4, 6, 1.4, 0); fs(g, '#fffde7'); },   // 19 반짝임
    (g) => { const c = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5']; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-3, 0, 6.5 - i * 1.1, -1.2, 1.2); g.lineWidth = 1.2; g.strokeStyle = c[i]; g.stroke(); } },   // 20 무지개
    (g) => { glow(g, 'rgba(255,200,240,.45)', 8); for (let i = 0; i < 4; i++) { g.save(); g.rotate((i * Math.PI) / 2); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4, -1, 5, -4); g.quadraticCurveTo(1, -3, 0, 0); fs(g, ['#f48fb1', '#81d4fa', '#fff176', '#a5d6a7'][i], 0.8); g.restore(); } },   // 21 바람개비
    (g) => { glow(g, 'rgba(255,190,220,.45)', 8); for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5; g.beginPath(); g.ellipse(Math.cos(a) * 2.8, Math.sin(a) * 2.8, 2.4, 1.6, a, 0, 7); fs(g, '#f8bbd0', 0.8); } g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fillStyle = '#ffd54f'; g.fill(); },   // 22 꽃
    (g) => { glow(g, 'rgba(170,140,255,.5)', 9); for (const [x, y, s] of [[2, 0, 1], [-2.5, -2.2, 0.7], [-2.5, 2.2, 0.7]]) { g.beginPath(); g.moveTo(x + 4 * s, y); g.lineTo(x, y - 2 * s); g.lineTo(x - 3 * s, y); g.lineTo(x, y + 2 * s); g.closePath(); fs(g, '#b388ff', 0.8); } },   // 23 수정 조각
    (g) => { glow(g, 'rgba(255,200,80,.6)', 10); star(g, 0, 0, 10, 6, 3.4, 0); g.fillStyle = '#ffb300'; g.fill(); g.beginPath(); g.arc(0, 0, 3.4, 0, 7); fs(g, '#ffe082'); },   // 24 태양
    (g) => { tail(g, 'rgba(255,120,160,.45)', 12, 2.4); g.beginPath(); g.moveTo(5, 0); g.lineTo(0, -3.5); g.lineTo(0, 3.5); g.closePath(); fs(g, '#ff5c8a'); g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, -3.5); g.lineTo(0, 3.5); g.closePath(); fs(g, '#ff8fb0'); g.beginPath(); g.arc(0, 0, 1.4, 0, 7); fs(g, '#ffd6e2', 0.8); },   // 25 리본
    (g) => { glow(g, 'rgba(255,215,64,.55)', 10); g.beginPath(); g.moveTo(-4.5, 3); g.lineTo(-5, -3.5); g.lineTo(-2, -0.5); g.lineTo(0, -4.5); g.lineTo(2, -0.5); g.lineTo(5, -3.5); g.lineTo(4.5, 3); g.closePath(); fs(g, '#ffd740'); g.fillStyle = '#e53935'; g.beginPath(); g.arc(0, 1, 1, 0, 7); g.fill(); },   // 26 왕관
    (g) => { glow(g, 'rgba(255,120,60,.55)', 11); g.beginPath(); g.moveTo(7, 0); g.quadraticCurveTo(0, -6, -7, -3); g.quadraticCurveTo(-2, -1, -6, 0); g.quadraticCurveTo(-2, 1, -7, 3); g.quadraticCurveTo(0, 6, 7, 0); fs(g, '#ff7043'); g.beginPath(); g.moveTo(6, 0); g.lineTo(-5, 0); g.strokeStyle = '#ffe082'; g.lineWidth = 1; g.stroke(); },   // 27 불사조 깃털
    (g) => { glow(g, 'rgba(150,120,255,.6)', 11); g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); for (let k = 0; k < 20; k++) { const a = k * 0.35 + (i * Math.PI * 2) / 3, r = k * 0.32; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.strokeStyle = ['#b388ff', '#82b1ff', '#ff80ab'][i]; g.stroke(); } g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fillStyle = '#fff'; g.fill(); },   // 28 은하 소용돌이
    (g) => { glow(g, 'rgba(255,230,120,.75)', 13); star(g, 0, 0, 8, 7.5, 2.6, 0); fs(g, '#fff176'); star(g, 0, 0, 4, 4, 1.4, Math.PI / 4); g.fillStyle = '#fff'; g.fill(); },   // 29 황금 별폭발
  ];
  const NAMES = ['기본 탄', '연필', '지우개', '종이비행기', '별', '크레파스', '구슬', '음표', '하트', '보석', '잎', '번개', '초승달', '쌍둥이별', '불꽃', '눈송이', '행성', '화살', '혜성', '반짝임', '무지개', '바람개비', '꽃', '수정 조각', '태양', '리본', '왕관', '불사조 깃털', '은하 소용돌이', '황금 별폭발'];

  function sprite(tier, crit) {
    const shape = tier % 30, lap = Math.floor(tier / 30), key = shape + ':' + Math.min(lap, 2) + ':' + (crit ? 1 : 0);
    let c = cache.get(key);
    if (c) return c;
    const R = 16; c = document.createElement('canvas'); c.width = c.height = R * 2 * S;
    const g = c.getContext('2d'); g.scale(S, S); g.translate(R, R); g.lineJoin = 'round'; g.lineCap = 'round';
    const k = 1 + shape * 0.012 + (crit ? 0.25 : 0); g.scale(k, k);   // 단계가 오를수록 아주 조금씩 커짐, 치명타는 더 크게
    if (lap >= 1) { g.save(); g.shadowColor = lap >= 2 ? '#ff80ff' : '#ffd54f'; g.shadowBlur = 6; }   // 한 바퀴 넘으면 금빛, 두 바퀴 넘으면 분홍빛 후광
    SHAPES[shape](g);
    if (lap >= 1) g.restore();
    if (crit) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,120,40,.35)'; g.fillRect(-R, -R, R * 2, R * 2); }
    c.R = R; cache.set(key, c);
    return c;
  }

  const prevDraw = Art.drawBullet.bind(Art);
  Art.drawBullet = function (ctx, b) {
    if (b.owner !== 'player') return prevDraw(ctx, b);   // 에코 총알은 그대로 (흐린 파란색)
    const c = sprite(b.tier || 0, b.crit);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    const z = 1.3; ctx.drawImage(c, -c.R * z, -c.R * z, c.R * 2 * z, c.R * 2 * z);   // 모양이 잘 보이게 조금 크게
    ctx.restore();
  };
  Art.bulletShapeName = (tier) => NAMES[(tier | 0) % 30];
  Art.bulletSprite = sprite;
})(typeof window !== 'undefined' ? window : globalThis);
