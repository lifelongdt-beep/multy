/* Echo Rush — 새 그림체 (시안: 학교 월드)
 *
 * 이모지 대신 직접 그린 통일된 그림체: 굵은 외곽선 + 단순한 면 + 큰 눈, 발밑 그림자, 통통 튀는 움직임, 처치 파편.
 * 모든 스프라이트는 처음 한 번 오프스크린 캔버스에 그려 두고(3배 해상도) 매 프레임 복사만 한다 → 적이 많아도 가볍다.
 * 그림이 없는 대상(다른 월드의 적·보스)은 has*()가 false → main.js가 기존 이모지로 그린다.
 */
(function (root) {
  'use strict';
  const OL = '#1c1930';           // 공통 외곽선 색
  const S = 3;                    // 스프라이트 해상도 배율
  const cache = new Map();
  const K_EN = 1.3;               // 적 그림 크기 배율 (충돌 판정은 그대로)
  const K_KID = 1.4;
  const ECHO_GRAY = '#b9bfcc', ECHO_RING = '#c9ced8';   // 에코(과거의 나)는 회색 스타일로 통일              // 주인공·에코·선생님 그림 크기 배율

  /* ---------- 스프라이트 캐시 ---------- */
  function sprite(key, w, h, draw) {
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const g = c.getContext('2d');
    g.scale(S, S); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    c.lw = w; c.lh = h;
    cache.set(key, c);
    return c;
  }
  /** 같은 모양을 한 가지 색으로 덮은 판 (맞았을 때 흰색 번쩍임, 에코의 유령 색) */
  function tinted(key, base, color, amount) {
    return sprite(key, base.lw, base.lh, (g) => {
      g.translate(-base.lw / 2, -base.lh / 2);
      g.drawImage(base, 0, 0, base.lw, base.lh);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = amount === undefined ? 1 : amount;   // 1이면 완전히 덮고, 작으면 얼굴·옷 무늬가 비쳐 보임
      g.fillStyle = color; g.fillRect(0, 0, base.lw, base.lh);
    });
  }
  function blit(ctx, c, x, y, sx, sy, flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale((flip ? -1 : 1) * (sx || 1), sy || 1);
    ctx.drawImage(c, -c.lw / 2, -c.lh / 2, c.lw, c.lh);
    ctx.restore();
  }

  /* ---------- 그리기 도우미 ---------- */
  /* ---------- 선행 소품 (24x24 기준, 가운데 0,0) ---------- */
  function heartPath(g, r) {
    g.beginPath(); g.moveTo(0, r * 0.95);
    g.bezierCurveTo(-r * 1.25, r * 0.1, -r * 1.05, -r * 1.0, 0, -r * 0.42);
    g.bezierCurveTo(r * 1.05, -r * 1.0, r * 1.25, r * 0.1, 0, r * 0.95); g.closePath();
  }
  function heartArt(col, hi) {
    return (g) => {
      heartPath(g, 10); fillStroke(g, col, 1.8);
      g.save(); heartPath(g, 10); g.clip();
      const gr = g.createLinearGradient(-8, -8, 8, 9); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(80,0,40,.25)');
      g.fillStyle = gr; g.fillRect(-12, -12, 24, 24); g.restore();
      g.fillStyle = hi; oval(g, -4.6, -4.2, 2.6, 1.7); g.fill(); circle(g, -1.4, -5.6, 0.9); g.fill();
    };
  }
  /* 부정적인 마음이 위험 요소로: 짜증·조급함·스트레스·귀찮음·지침·잡념·병균·긴장 (40x40 기준, 가운데 0,0)
   * 좋은 것(책·공·침대·조명)이 공격으로 오지 않게, 피해야 할 것은 모두 '부정적인 것'으로 그린다 */
  function gloomFace(g, x, y, s, mood) {
    const ew = s * 0.22;
    for (const sx of [-1, 1]) {
      g.fillStyle = '#fff'; oval(g, x + sx * s * 0.34, y, ew, ew * 1.1); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OL; g.stroke();
      g.fillStyle = OL; circle(g, x + sx * s * 0.34 + sx * ew * 0.15, y + ew * 0.2, ew * 0.55); g.fill();
      g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath();
      if (mood === 'angry') { g.moveTo(x + sx * s * 0.6, y - ew * 1.5); g.lineTo(x + sx * s * 0.14, y - ew * 0.9); }
      else if (mood === 'tired') { g.moveTo(x + sx * s * 0.58, y - ew * 0.9); g.lineTo(x + sx * s * 0.12, y - ew * 1.2); }
      else if (mood === 'scared') { g.moveTo(x + sx * s * 0.56, y - ew * 1.1); g.quadraticCurveTo(x + sx * s * 0.34, y - ew * 1.9, x + sx * s * 0.12, y - ew * 1.5); }
      g.stroke();
      if (mood === 'tired' || mood === 'meh') { g.fillStyle = g.__lid || '#888'; g.fillRect(x + sx * s * 0.34 - ew - 1, y - ew * 1.2, ew * 2 + 2, ew * 1.1); g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + sx * s * 0.34 - ew, y - ew * 0.1); g.lineTo(x + sx * s * 0.34 + ew, y - ew * 0.1); g.stroke(); }
    }
    g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath();
    const my = y + s * 0.42;
    if (mood === 'angry') { g.moveTo(x - s * 0.2, my + 2); g.lineTo(x - s * 0.07, my - 1); g.lineTo(x + s * 0.07, my + 2); g.lineTo(x + s * 0.2, my - 1); }
    else if (mood === 'scared') { g.moveTo(x - s * 0.2, my); for (let i = 1; i <= 4; i++) g.lineTo(x - s * 0.2 + i * s * 0.1, my + (i % 2 ? -2 : 1)); }
    else if (mood === 'meh') { g.moveTo(x - s * 0.16, my); g.lineTo(x + s * 0.16, my); }
    else g.arc(x, my + s * 0.14, s * 0.17, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  function shine(g, x, y, r) { g.fillStyle = 'rgba(255,255,255,.35)'; oval(g, x, y, r, r * 0.6); g.fill(); }
  const GLOOM = {
    '💢'(g) {   // 짜증 폭탄: 빨간 가시 공
      g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = i % 2 ? 11 : 15; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); fillStroke(g, '#ff5a4a', 2);
      shine(g, -5, -6, 4); gloomFace(g, 0, -1, 14, 'angry');
      g.strokeStyle = '#ffe14d'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, -14); g.lineTo(13, -18); g.moveTo(13, -13); g.lineTo(17, -15); g.stroke();
    },
    '🌪'(g) {   // 조급함 돌풍: 회색 회오리
      const cols = ['#9aa6c8', '#b4bdd9', '#c9d0e6'];
      for (let i = 0; i < 4; i++) { oval(g, (i % 2 ? 2 : -2), -12 + i * 7, 15 - i * 3, 4.6); fillStroke(g, cols[i % 3], 1.8); }
      oval(g, 0, 13, 3.4, 3); fillStroke(g, '#9aa6c8', 1.6);
      g.__lid = '#b4bdd9'; gloomFace(g, 0, -4, 13, 'angry');
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-18, -8); g.lineTo(-24, -8); g.moveTo(-17, 0); g.lineTo(-25, 0); g.stroke();
    },
    '⚡'(g) {   // 스트레스 번개구름
      g.beginPath(); g.moveTo(2, 4); g.lineTo(-5, 17); g.lineTo(1, 14); g.lineTo(-2, 22); g.lineTo(8, 9); g.lineTo(3, 11); g.lineTo(6, 4); g.closePath(); fillStroke(g, '#ffd23f', 1.6);
      for (const [x, y, r] of [[-9, -2, 8], [0, -7, 10], [10, -1, 8], [0, 2, 9]]) { circle(g, x, y, r); g.fillStyle = '#5a5f7a'; g.fill(); }
      g.lineWidth = 2; g.strokeStyle = OL; for (const [x, y, r] of [[-9, -2, 8], [0, -7, 10], [10, -1, 8]]) { g.beginPath(); g.arc(x, y, r, Math.PI * 0.85, Math.PI * 2.15); g.stroke(); }
      g.beginPath(); g.moveTo(-17, 1); g.quadraticCurveTo(0, 14, 18, 1); g.stroke();
      shine(g, -4, -10, 3.5); g.__lid = '#5a5f7a'; gloomFace(g, 0, -2, 12, 'angry');
    },
    '😑'(g) {   // 귀찮음 덩어리: 무겁고 축 처진 회색 덩어리
      g.beginPath(); g.moveTo(-15, 12); g.quadraticCurveTo(-17, -8, -4, -12); g.quadraticCurveTo(10, -15, 15, -2); g.quadraticCurveTo(18, 10, 14, 12); g.closePath(); fillStroke(g, '#8c8fa6', 2);
      shine(g, -6, -6, 4); g.__lid = '#8c8fa6'; gloomFace(g, 0, 0, 14, 'meh');
      g.fillStyle = '#6f7287'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('z', 13, -12); g.font = 'bold 6px sans-serif'; g.fillText('z', 17, -16);
    },
    '😩'(g) {   // 지친 마음: 보라색으로 축 늘어진 덩어리 (굴러옴)
      circle(g, 0, 0, 14); fillStroke(g, '#9b7fd1', 2);
      g.fillStyle = 'rgba(80,50,140,.35)'; oval(g, 4, 6, 9, 6); g.fill(); shine(g, -5, -6, 4);
      g.__lid = '#9b7fd1'; gloomFace(g, 0, -1, 13, 'tired');
      g.fillStyle = '#7fd3ff'; g.beginPath(); g.moveTo(11, -6); g.quadraticCurveTo(14, -1, 11, 0); g.quadraticCurveTo(8, -1, 11, -6); g.fill();   // 땀방울
    },
    '💭'(g) {   // 잡념 구름: 연보라 생각 구름 + 소용돌이
      for (const [x, y, r] of [[-8, 2, 8], [0, -5, 10], [9, 1, 8], [0, 5, 8]]) { circle(g, x, y, r); g.fillStyle = '#c7b5f0'; g.fill(); }
      g.lineWidth = 2; g.strokeStyle = OL; for (const [x, y, r] of [[-8, 2, 8], [0, -5, 10], [9, 1, 8], [0, 5, 8]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
      for (const [x, y, r] of [[-8, 2, 8], [0, -5, 10], [9, 1, 8], [0, 5, 8]]) { circle(g, x, y, r - 1); g.fillStyle = '#c7b5f0'; g.fill(); }
      g.strokeStyle = '#7a5cc4'; g.lineWidth = 1.4; for (const sx of [-1, 1]) { g.beginPath(); for (let k = 0; k < 14; k++) { const a = k * 0.55, r = k * 0.32; g.lineTo(sx * 5 + Math.cos(a) * r, -2 + Math.sin(a) * r); } g.stroke(); }
      g.strokeStyle = OL; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-3, 6); g.quadraticCurveTo(0, 4, 3, 6); g.stroke();
      circle(g, 13, 13, 2.6); fillStroke(g, '#c7b5f0', 1.4); circle(g, 17, 17, 1.6); fillStroke(g, '#c7b5f0', 1.2);
    },
    '🦠'(g) {   // 병균: 초록 돌기 덩어리
      g.strokeStyle = OL; g.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); g.stroke(); circle(g, Math.cos(a) * 16.5, Math.sin(a) * 16.5, 2.4); fillStroke(g, '#7fcf4f', 1.4); }
      circle(g, 0, 0, 12); fillStroke(g, '#8bd85a', 2);
      g.fillStyle = 'rgba(40,110,30,.35)'; circle(g, 6, 5, 2.4); g.fill(); circle(g, -6, 6, 1.8); g.fill(); shine(g, -5, -6, 3.5);
      g.__lid = '#8bd85a'; gloomFace(g, 0, -1, 12, 'angry');
    },
    '😨'(g) {   // 긴장 그림자: 어두운 보라 그림자, 떨리는 눈
      g.beginPath(); g.moveTo(-14, 14); g.quadraticCurveTo(-16, -6, -6, -13); g.quadraticCurveTo(0, -17, 6, -13); g.quadraticCurveTo(16, -6, 14, 14);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(10.5 - i * 7, 9, 7 - i * 7, 14);
      g.closePath(); fillStroke(g, '#4a3b6e', 2);
      shine(g, -6, -7, 3.5); gloomFace(g, 0, -2, 13, 'scared');
      g.strokeStyle = 'rgba(200,180,255,.6)'; g.lineWidth = 1.4; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 17, -6); g.lineTo(sx * 20, -3); g.lineTo(sx * 17, 0); g.stroke(); }
    },
  };

  /* 월드 엠블럼 (24x24, 가운데 0,0) */
  function rect(g, x, y, w, h, col, lw) { g.beginPath(); g.rect(x, y, w, h); fillStroke(g, col, lw || 1.6); }
  function wins(g, xs, ys, w, h, col) { g.fillStyle = col; for (const x of xs) for (const y of ys) g.fillRect(x, y, w, h); }
  const WORLD_ART = {
    school(g) {
      rect(g, -10, -2, 20, 12, '#f2d9a8'); g.beginPath(); g.moveTo(-11.5, -2); g.lineTo(0, -9); g.lineTo(11.5, -2); g.closePath(); fillStroke(g, '#e8604c', 1.6);
      rect(g, -2.5, 3, 5, 7, '#9b6a43', 1.3); wins(g, [-8, 4.5], [1], 3.5, 3.5, '#7fc8ff');
      circle(g, 0, -4, 1.8); fillStroke(g, '#fff', 1.2);
      g.strokeStyle = OL; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, -12.5); g.stroke(); g.fillStyle = '#ff4d6d'; g.fillRect(0, -12.5, 3.5, 2);
    },
    academy(g) {   // 펼친 책
      g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(-5, -8, -11, -6); g.lineTo(-11, 8); g.quadraticCurveTo(-5, 6, 0, 9); g.closePath(); fillStroke(g, '#fdfaf0', 1.6);
      g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(5, -8, 11, -6); g.lineTo(11, 8); g.quadraticCurveTo(5, 6, 0, 9); g.closePath(); fillStroke(g, '#f1ead6', 1.6);
      g.strokeStyle = '#9aa6c8'; g.lineWidth = 1; for (const y of [-2, 1, 4]) { g.beginPath(); g.moveTo(-8.5, y - 1); g.lineTo(-2.5, y); g.moveTo(2.5, y); g.lineTo(8.5, y - 1); g.stroke(); }
      g.fillStyle = '#ff6f91'; g.beginPath(); g.moveTo(5, -6.3); g.lineTo(5, -1); g.lineTo(6.5, -2.4); g.lineTo(8, -1); g.lineTo(8, -6.6); g.fill();
    },
    office(g) {
      rect(g, -7, -11, 14, 21, '#8fb3d9'); rect(g, 5, -3, 6, 13, '#6f93bd');
      wins(g, [-5, -1, 3], [-9, -5.5, -2, 1.5], 2.2, 2.2, '#e8f6ff'); rect(g, -2, 5, 4, 5, '#3b4e78', 1.2);
    },
    subway(g) {
      g.beginPath(); g.roundRect(-8, -10, 16, 17, 4); fillStroke(g, '#5ca8ff', 1.7);
      rect(g, -6, -7, 12, 6, '#dff3ff', 1.3); g.fillStyle = '#ffe14d'; circle(g, -4, 3, 1.5); g.fill(); circle(g, 4, 3, 1.5); g.fill();
      g.strokeStyle = OL; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-5, 7); g.lineTo(-8, 11); g.moveTo(5, 7); g.lineTo(8, 11); g.moveTo(-9, 11); g.lineTo(9, 11); g.stroke();
    },
    home(g) {
      rect(g, -8, -2, 16, 12, '#fff1d6'); g.beginPath(); g.moveTo(-11, -1); g.lineTo(0, -10); g.lineTo(11, -1); g.closePath(); fillStroke(g, '#ff7a59', 1.7);
      rect(g, -2.5, 3, 5, 7, '#c0814f', 1.3); rect(g, 3.5, 1, 3.5, 3.5, '#9fd8ff', 1.1); rect(g, 5, -9, 3, 5, '#a86b4b', 1.3);
      g.fillStyle = '#ff6fa8'; heartPathAt(g, -5, 2.5, 2.2); g.fill();
    },
    gym(g) {   // 아령
      rect(g, -7, -1.2, 14, 2.4, '#c3cbe8', 1.3);
      for (const sx of [-1, 1]) { g.beginPath(); g.roundRect(sx * 7 - 2.5, -6.5, 5, 13, 1.6); fillStroke(g, '#4a5580', 1.6); g.beginPath(); g.roundRect(sx * 10.5 - 1.5, -4, 3, 8, 1.2); fillStroke(g, '#6b78a8', 1.4); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-8.5, -5.5, 1, 6); g.fillRect(5.5, -5.5, 1, 6);
    },
    library(g) {   // 책 더미
      g.beginPath(); g.roundRect(-10, 5, 20, 5, 1); fillStroke(g, '#4da3ff', 1.5);
      g.beginPath(); g.roundRect(-8, 0, 17, 5, 1); fillStroke(g, '#ff6f61', 1.5);
      g.beginPath(); g.roundRect(-9, -5, 16, 5, 1); fillStroke(g, '#5ccf62', 1.5);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(6, 6.3, 2.5, 2.4); g.fillRect(5.6, 1.3, 2.4, 2.4); g.fillRect(4.6, -3.7, 1.6, 2.4);
      g.save(); g.translate(1, -9); g.rotate(-0.25); g.beginPath(); g.roundRect(-6, -2, 12, 4, 1); fillStroke(g, '#ffd84d', 1.4); g.restore();
    },
    beach(g) {   // 파라솔 + 모래 + 물결
      g.beginPath(); g.moveTo(-12, 8); g.quadraticCurveTo(0, 3, 12, 8); g.lineTo(12, 11); g.lineTo(-12, 11); g.closePath(); fillStroke(g, '#f4d38a', 1.4);
      g.strokeStyle = OL; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-1, 7); g.lineTo(2, -6); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
      g.save(); g.translate(2, -6); g.rotate(0.2);
      g.beginPath(); g.moveTo(-10, 2); g.quadraticCurveTo(0, -12, 10, 2); g.closePath(); fillStroke(g, '#ff5a6e', 1.6);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-3.5, 2); g.quadraticCurveTo(0, -9, 3.5, 2); g.closePath(); g.fill(); g.restore();
    },
    airport(g) {   // 비행기
      g.save(); g.rotate(-0.6);
      g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(2.4, -10, 2.4, -6); g.lineTo(2.4, 6); g.quadraticCurveTo(0, 10, -2.4, 6); g.lineTo(-2.4, -6); g.quadraticCurveTo(-2.4, -10, 0, -12); fillStroke(g, '#f2f5ff', 1.6);
      g.beginPath(); g.moveTo(2, -2); g.lineTo(11, 3); g.lineTo(11, 5); g.lineTo(2, 3); g.moveTo(-2, -2); g.lineTo(-11, 3); g.lineTo(-11, 5); g.lineTo(-2, 3); fillStroke(g, '#5ca8ff', 1.5);
      g.beginPath(); g.moveTo(1.6, 6); g.lineTo(5.5, 9.5); g.lineTo(5.5, 11); g.lineTo(0, 9); g.lineTo(-5.5, 11); g.lineTo(-5.5, 9.5); g.lineTo(-1.6, 6); fillStroke(g, '#5ca8ff', 1.4);
      g.fillStyle = '#5ca8ff'; oval(g, 0, -8.5, 1.2, 1.6); g.fill();
      g.restore();
    },
    hospital(g) {
      rect(g, -9, -8, 18, 18, '#f2f5ff'); g.fillStyle = '#ff4d6d'; g.fillRect(-2, -6, 4, 10); g.fillRect(-5, -3, 10, 4);
      rect(g, -2.5, 5, 5, 5, '#9fd8ff', 1.2); wins(g, [-7.5, 5], [-6, 0], 2.5, 2.5, '#9fd8ff');
    },
    mountain(g) {
      g.beginPath(); g.moveTo(-12, 10); g.lineTo(-3, -9); g.lineTo(6, 10); g.closePath(); fillStroke(g, '#7d8fb3', 1.6);
      g.beginPath(); g.moveTo(-1, 10); g.lineTo(6, -3); g.lineTo(12, 10); g.closePath(); fillStroke(g, '#5c6f96', 1.6);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-3, -9); g.lineTo(-6.2, -2.4); g.lineTo(-4.4, -3.6); g.lineTo(-3, -2); g.lineTo(-1.4, -3.6); g.lineTo(0.2, -2.4); g.closePath(); g.fill();
      g.fillStyle = '#5ccf62'; g.fillRect(-11, 8.5, 22, 1.6);
    },
    stage(g) {   // 무대 커튼 + 별 조명
      g.beginPath(); g.roundRect(-11, -10, 22, 20, 2); fillStroke(g, '#3a2a55', 1.6);
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 10, -9); g.lineTo(sx * 3, -9); g.quadraticCurveTo(sx * 5, 0, sx * 10, 4); g.closePath(); fillStroke(g, '#d63a5a', 1.3); }
      g.fillStyle = '#ffd84d'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.6 : 3.8; g.lineTo(Math.cos(a) * rr, 1 + Math.sin(a) * rr); } g.closePath(); g.fill();
      rect(g, -11, 6, 22, 4, '#b07a4a', 1.4);
    },
  };
  function heartPathAt(g, x, y, r) { g.save(); g.translate(x, y); heartPath(g, r); g.restore(); }
  const DEED_ART = {
    atkUp(g) {   // 응원 = 공격력 업: 분홍 방패 배지 + 위로 선 칼 + 위쪽 화살표
      g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(8, -9, 10, -7); g.quadraticCurveTo(10, 5, 0, 11); g.quadraticCurveTo(-10, 5, -10, -7); g.quadraticCurveTo(-8, -9, 0, -11); g.closePath(); fillStroke(g, '#ff6fa8', 1.8);
      g.save(); g.clip(); const gr = g.createLinearGradient(-8, -10, 8, 10); gr.addColorStop(0, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(120,0,60,.25)'); g.fillStyle = gr; g.fillRect(-12, -12, 24, 24); g.restore();
      g.save(); g.rotate(-0.15);
      g.beginPath(); g.moveTo(0, -8); g.lineTo(2, -5.5); g.lineTo(2, 3); g.lineTo(-2, 3); g.lineTo(-2, -5.5); g.closePath(); fillStroke(g, '#eef3ff', 1.3);   // 칼날
      g.beginPath(); g.rect(-4.5, 3, 9, 2); fillStroke(g, '#ffd84d', 1.2);   // 손잡이 가드
      g.beginPath(); g.rect(-1.2, 5, 2.4, 3.6); fillStroke(g, '#a0643c', 1.1);
      g.restore();
      g.beginPath(); g.moveTo(7, -2); g.lineTo(10.5, -6.5); g.lineTo(14, -2); g.lineTo(11.6, -2); g.lineTo(11.6, 2); g.lineTo(9.4, 2); g.lineTo(9.4, -2); g.closePath(); fillStroke(g, '#7dffb2', 1.2);   // 위 화살표
    },
    sprout(g) {
      oval(g, 0, 9, 8, 2.4); g.fillStyle = '#8a5a3a'; g.fill();
      g.strokeStyle = OL; g.lineWidth = 3.4; g.beginPath(); g.moveTo(0, 9); g.quadraticCurveTo(-1, 2, 0, -3); g.stroke();
      g.strokeStyle = '#5ccf62'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, 9); g.quadraticCurveTo(-1, 2, 0, -3); g.stroke();
      for (const sx of [-1, 1]) { g.save(); g.translate(0, -3); g.rotate(sx * 0.9); oval(g, 0, -5, 3.4, 5.4); fillStroke(g, sx < 0 ? '#7ee07f' : '#5ccf62', 1.6); g.restore(); }
      g.fillStyle = 'rgba(255,255,255,.5)'; oval(g, -5, -7, 1, 2); g.fill();
    },
    smile(g) {
      circle(g, 0, 0, 10); fillStroke(g, '#ffd84d', 1.8);
      g.save(); circle(g, 0, 0, 10); g.clip(); const gr = g.createRadialGradient(-4, -5, 1, 0, 0, 12); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(200,110,0,.25)'); g.fillStyle = gr; g.fillRect(-12, -12, 24, 24); g.restore();
      g.fillStyle = OL; oval(g, -3.4, -2.6, 1.3, 1.9); g.fill(); oval(g, 3.4, -2.6, 1.3, 1.9); g.fill();
      g.strokeStyle = OL; g.lineWidth = 1.7; g.beginPath(); g.arc(0, 1, 5, 0.25, Math.PI - 0.25); g.stroke();
      g.fillStyle = 'rgba(255,110,130,.45)'; oval(g, -6, 2.4, 2, 1.2); g.fill(); oval(g, 6, 2.4, 2, 1.2); g.fill();
    },
    hands(g) {   // 두 손을 맞잡음
      for (const [sx, col] of [[-1, '#f2c094'], [1, '#d99a6c']]) {
        g.save(); g.scale(sx, 1);
        g.beginPath(); g.moveTo(-11, 2); g.lineTo(-5, -3); g.quadraticCurveTo(0, -6, 4, -2); g.lineTo(7, 2); g.quadraticCurveTo(4, 6, -1, 6); g.lineTo(-11, 7); g.closePath(); fillStroke(g, col, 1.6);
        g.strokeStyle = 'rgba(80,40,20,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, 0); g.lineTo(2, 3); g.stroke();
        g.beginPath(); g.rect(-12.5, 0.5, 3, 8); fillStroke(g, sx < 0 ? '#5c8dff' : '#ff8a5c', 1.4);
        g.restore();
      }
    },
    sun(g) {
      g.fillStyle = '#ffb21f'; g.strokeStyle = OL; g.lineWidth = 1.4;
      for (let i = 0; i < 10; i++) { g.save(); g.rotate(i * Math.PI / 5); g.beginPath(); g.moveTo(-2.4, -8); g.lineTo(0, -12.2); g.lineTo(2.4, -8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      circle(g, 0, 0, 7.6); fillStroke(g, '#ffd84d', 1.7);
      g.fillStyle = 'rgba(255,255,255,.55)'; oval(g, -2.8, -3, 2.2, 1.4); g.fill();
      g.fillStyle = OL; circle(g, -2.4, 0, 0.9); g.fill(); circle(g, 2.4, 0, 0.9); g.fill();
      g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 1.6, 2.4, 0.3, Math.PI - 0.3); g.stroke();
    },
    hero(g) {   // 망토 + 별 배지
      g.beginPath(); g.moveTo(-5, -6); g.lineTo(5, -6); g.lineTo(11, 11); g.quadraticCurveTo(0, 7, -11, 11); g.closePath(); fillStroke(g, '#ff4d6d', 1.7);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.moveTo(0, -6); g.lineTo(5, -6); g.lineTo(11, 11); g.quadraticCurveTo(5, 8.5, 0, 8.5); g.closePath(); g.fill();
      circle(g, 0, -4, 6); fillStroke(g, '#ffd84d', 1.7);
      g.fillStyle = '#ff9f1c'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.8 : 4.2; g.lineTo(Math.cos(a) * rr, -4 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    },
    rainbow(g) {
      const cols = ['#ff5a5a', '#ffa53d', '#ffe14d', '#5ccf62', '#4da3ff', '#9b6bff'];
      g.lineCap = 'butt';
      g.strokeStyle = OL; g.lineWidth = 15; g.beginPath(); g.arc(0, 7, 8.5, Math.PI, 0); g.stroke();
      cols.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 7, 13.5 - i * 2 - 1.1 - 1.5, Math.PI, 0); g.stroke(); });
      g.lineCap = 'round';
      for (const sx of [-1, 1]) { g.fillStyle = '#fff'; oval(g, sx * 8.5, 8, 4.6, 3); fillStroke(g, '#fff', 1.5); oval(g, sx * 6, 9, 3.4, 2.4); g.fillStyle = '#fff'; g.fill(); }
    },
    angel(g) {
      g.strokeStyle = OL; g.lineWidth = 3.6; oval(g, 0, -10, 6, 2); g.stroke(); g.strokeStyle = '#ffe14d'; g.lineWidth = 2; oval(g, 0, -10, 6, 2); g.stroke();
      for (const sx of [-1, 1]) { g.save(); g.scale(sx, 1); g.beginPath(); g.moveTo(4, 2); g.quadraticCurveTo(13, -6, 12, 3); g.quadraticCurveTo(10, 9, 4, 6); g.closePath(); fillStroke(g, '#f2f5ff', 1.5); g.strokeStyle = 'rgba(60,70,120,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, 3); g.lineTo(10, 1); g.moveTo(6, 5); g.lineTo(10, 4.5); g.stroke(); g.restore(); }
      g.beginPath(); g.moveTo(-4.5, 10); g.lineTo(-3, 1); g.lineTo(3, 1); g.lineTo(4.5, 10); g.closePath(); fillStroke(g, '#bfe3ff', 1.6);
      circle(g, 0, -3, 4.6); fillStroke(g, '#f6d2b0', 1.6);
      g.fillStyle = OL; circle(g, -1.6, -3.2, 0.7); g.fill(); circle(g, 1.6, -3.2, 0.7); g.fill();
      g.strokeStyle = OL; g.lineWidth = 1; g.beginPath(); g.arc(0, -2.2, 1.6, 0.4, Math.PI - 0.4); g.stroke();
    },
    heart: heartArt('#ffcf3f', 'rgba(255,255,240,.9)'),
    heartPink: heartArt('#ff6fa8', 'rgba(255,240,248,.9)'),
    cup(g) {   // 버려진 컵 → 줍기
      g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -6); g.lineTo(4.4, 10); g.lineTo(-4.4, 10); g.closePath(); fillStroke(g, '#f4f1ea', 1.8);
      g.fillStyle = '#ff7a7a'; g.fillRect(-5.3, 0, 10.4, 4.2);
      g.beginPath(); g.moveTo(-7.5, -9); g.lineTo(7.5, -9); g.lineTo(7, -5.6); g.lineTo(-7, -5.6); g.closePath(); fillStroke(g, '#5cc6ff', 1.6);
      g.strokeStyle = OL; g.lineWidth = 1.8; g.beginPath(); g.moveTo(1.5, -9); g.lineTo(4, -13); g.lineTo(7.5, -13); g.stroke();
      g.strokeStyle = '#ffe14d'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1.5, -9); g.lineTo(4, -13); g.lineTo(7.5, -13); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-3.8, -4, 1.3, 9);
    },
    pot(g) {   // 쓰러진 화분 → 세우기
      g.fillStyle = '#4caf50';
      for (const [a, l] of [[-0.6, 9], [0, 11], [0.6, 9]]) { g.save(); g.translate(0, -3); g.rotate(a); oval(g, 0, -l / 2, 3, l / 2); fillStroke(g, '#5ccf62', 1.5); g.restore(); }
      g.strokeStyle = '#2e7d32'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, -12); g.stroke();
      g.beginPath(); g.moveTo(-7, -3); g.lineTo(7, -3); g.lineTo(5, 10); g.lineTo(-5, 10); g.closePath(); fillStroke(g, '#d9744a', 1.8);
      g.beginPath(); g.rect(-8, -4.5, 16, 3.6); fillStroke(g, '#e88a5e', 1.6);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-4.5, 0, 1.4, 8);
    },
    teddy(g) {   // 잃어버린 인형 → 돌려주기
      const br = '#c98a52', lt = '#efc79a';
      for (const sx of [-1, 1]) { circle(g, sx * 6, -8, 3.2); fillStroke(g, br, 1.6); circle(g, sx * 6, -8, 1.5); g.fillStyle = lt; g.fill(); }
      for (const sx of [-1, 1]) { oval(g, sx * 4.5, 9, 3.4, 2.6); fillStroke(g, br, 1.6); oval(g, sx * 7.5, 3, 2.3, 3.4); fillStroke(g, br, 1.6); }
      oval(g, 0, 4.5, 6, 6); fillStroke(g, br, 1.7); oval(g, 0, 5.5, 3.4, 3.4); g.fillStyle = lt; g.fill();
      circle(g, 0, -4, 7); fillStroke(g, br, 1.8);
      oval(g, 0, -1.8, 3.2, 2.4); g.fillStyle = lt; g.fill();
      g.fillStyle = OL; circle(g, -2.6, -5.2, 1.1); g.fill(); circle(g, 2.6, -5.2, 1.1); g.fill(); oval(g, 0, -2.6, 1.2, 0.8); g.fill();
      g.fillStyle = '#fff'; circle(g, -2.2, -5.6, 0.4); g.fill(); circle(g, 3, -5.6, 0.4); g.fill();
      g.fillStyle = '#ff6fa8'; g.beginPath(); g.moveTo(0, 2.4); g.lineTo(-3.4, 0.8); g.lineTo(-3.4, 4); g.closePath(); g.moveTo(0, 2.4); g.lineTo(3.4, 0.8); g.lineTo(3.4, 4); g.closePath(); g.fill();
    },
    gift(g) {
      g.beginPath(); g.rect(-8, -2, 16, 11); fillStroke(g, '#ff6f91', 1.8);
      g.beginPath(); g.rect(-9.5, -6, 19, 4.5); fillStroke(g, '#ff8fab', 1.7);
      g.fillStyle = '#ffe14d'; g.fillRect(-1.8, -6, 3.6, 15);
      g.strokeStyle = OL; g.lineWidth = 1.6;
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 3.6, -8.4, 3.6, 2.2, sx * -0.5, 0, Math.PI * 2); g.fillStyle = '#ffe14d'; g.fill(); g.stroke(); }
      circle(g, 0, -7, 1.6); g.fillStyle = '#ffd000'; g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-6.5, -1, 2, 8);
    },
    flag(g) {   // 도착 깃발
      g.strokeStyle = OL; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-6, 11); g.lineTo(-6, -11); g.stroke();
      g.strokeStyle = '#e6e9f5'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, 11); g.lineTo(-6, -11); g.stroke();
      g.beginPath(); g.moveTo(-5, -10); g.quadraticCurveTo(1, -12.5, 8, -9.5); g.lineTo(6, -5); g.lineTo(8, -0.5); g.quadraticCurveTo(1, -3, -5, -1); g.closePath(); fillStroke(g, '#ffd84d', 1.7);
      g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(-5, -5.5); g.quadraticCurveTo(1, -7.5, 6.6, -5.2); g.lineTo(7.2, -3.4); g.quadraticCurveTo(1, -5.2, -5, -3.6); g.closePath(); g.fill();
      oval(g, -6, 11, 4.5, 1.6); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
    },
  };

  function fillStroke(g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 2; g.strokeStyle = OL; g.stroke(); }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
  function oval(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  /** 눈: normal | worried | angry | sleepy | dizzy | droopy */
  function eye(g, x, y, s, mood, dir) {
    dir = dir || 1;
    if (mood === 'sleepy') { g.beginPath(); g.arc(x, y - s * 0.2, s * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = s * 0.45; g.strokeStyle = OL; g.stroke(); return; }
    if (mood === 'dizzy') {
      g.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = s * 0.12 * a; g.lineTo(x + Math.cos(a * 1.6) * rr, y + Math.sin(a * 1.6) * rr); }
      g.lineWidth = s * 0.3; g.strokeStyle = OL; g.stroke(); return;
    }
    oval(g, x, y, s * 0.78, s); g.fillStyle = '#fff'; g.fill(); g.lineWidth = s * 0.32; g.strokeStyle = OL; g.stroke();
    circle(g, x + s * 0.12 * dir, y + s * 0.18, s * 0.45); g.fillStyle = OL; g.fill();
    circle(g, x + s * 0.28 * dir, y - s * 0.05, s * 0.17); g.fillStyle = '#fff'; g.fill();
    circle(g, x - s * 0.02 * dir, y + s * 0.38, s * 0.08); g.fill();   // 작은 반짝임 하나 더
    if (mood === 'droopy') { g.beginPath(); g.ellipse(x, y - s * 0.35, s * 0.85, s * 0.6, 0, Math.PI, 0); g.fillStyle = g.__lid || '#8b7155'; g.fill(); g.lineWidth = s * 0.3; g.strokeStyle = OL; g.stroke(); }
    if (mood === 'worried' || mood === 'angry') {
      const up = mood === 'worried' ? -1 : 1;
      g.beginPath(); g.moveTo(x - s * 0.8 * dir, y - s * 1.35 + up * s * 0.35); g.lineTo(x + s * 0.8 * dir, y - s * 1.35 - up * s * 0.35);
      g.lineWidth = s * 0.38; g.strokeStyle = OL; g.stroke();
    }
  }

  /* ---------- 학교 월드의 방해 요소 ---------- */
  // 색: 파편·발밑 표시에 쓴다
  const ENEMY = {
    hw: {   // 미루기: 느릿느릿 졸린 달팽이
      color: '#b48cff',
      draw(g, r) {
        oval(g, r * 0.15, r * 0.55, r * 1.35, r * 0.5); fillStroke(g, '#b48cff', 2);
        g.beginPath(); g.moveTo(r * 0.95, r * 0.3); g.lineTo(r * 1.15, -r * 0.55); g.moveTo(r * 1.3, r * 0.3); g.lineTo(r * 1.6, -r * 0.45); g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke();
        circle(g, r * 1.15, -r * 0.6, r * 0.24); fillStroke(g, '#d9c4ff', 1.2); circle(g, r * 1.6, -r * 0.5, r * 0.24); fillStroke(g, '#d9c4ff', 1.2);
        circle(g, -r * 0.2, -r * 0.05, r * 0.85); fillStroke(g, '#f2a65a', 2);
        g.beginPath(); for (let a = 0; a < 11; a += 0.3) { const rr = r * 0.06 * a; g.lineTo(-r * 0.2 + Math.cos(a) * rr, -r * 0.05 + Math.sin(a) * rr); }
        g.lineWidth = 1.5; g.strokeStyle = '#a5602a'; g.stroke();
        eye(g, r * 0.95, r * 0.45, r * 0.16, 'sleepy');
      },
      w: 3.4, h: 2.8,
    },
    test: {  // 걱정: 땀 흘리는 물방울
      color: '#8cc4ff',
      draw(g, r) {
        g.beginPath(); g.moveTo(0, -r * 1.3);
        g.bezierCurveTo(r * 0.5, -r * 0.6, r * 1.0, -r * 0.1, r * 0.95, r * 0.35);
        g.arc(0, r * 0.35, r * 0.95, 0, Math.PI);
        g.bezierCurveTo(-r * 1.0, -r * 0.1, -r * 0.5, -r * 0.6, 0, -r * 1.3); g.closePath();
        fillStroke(g, '#8cc4ff', 2);
        oval(g, -r * 0.35, -r * 0.2, r * 0.18, r * 0.3); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
        eye(g, -r * 0.35, r * 0.25, r * 0.28, 'worried'); eye(g, r * 0.35, r * 0.25, r * 0.28, 'worried', -1);
        g.beginPath(); g.moveTo(-r * 0.3, r * 0.85); g.quadraticCurveTo(-r * 0.15, r * 0.7, 0, r * 0.85); g.quadraticCurveTo(r * 0.15, r * 1.0, r * 0.3, r * 0.85); g.lineWidth = 1.3; g.strokeStyle = OL; g.stroke();
        g.beginPath(); g.moveTo(r * 1.05, -r * 0.55); g.quadraticCurveTo(r * 1.35, -r * 0.1, r * 1.05, 0); g.quadraticCurveTo(r * 0.85, -r * 0.2, r * 1.05, -r * 0.55); fillStroke(g, '#d6efff', 1.2);
      },
      w: 2.9, h: 3.0,
    },
    alarm: { // 딴생각: 빙글빙글 생각 구름
      color: '#ff9fd6',
      draw(g, r) {
        const C = [[-0.55, 0.1, 0.52], [0, -0.35, 0.62], [0.55, 0.05, 0.52], [-0.22, 0.42, 0.48], [0.3, 0.42, 0.48]];
        g.lineWidth = 4.4; g.strokeStyle = OL;
        for (const [x, y, s] of C) { circle(g, x * r, y * r, s * r); g.stroke(); }
        g.fillStyle = '#ff9fd6';
        for (const [x, y, s] of C) { circle(g, x * r, y * r, s * r); g.fill(); }
        circle(g, -r * 0.25, -r * 0.55, r * 0.22); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
        eye(g, -r * 0.3, r * 0.05, r * 0.22, 'dizzy'); eye(g, r * 0.3, r * 0.05, r * 0.22, 'dizzy');
        circle(g, -r * 0.95, r * 0.85, r * 0.16); fillStroke(g, '#ffc6e8', 1.4);
        circle(g, -r * 1.2, r * 1.1, r * 0.1); fillStroke(g, '#ffc6e8', 1.2);
      },
      w: 2.7, h: 2.6,
    },
    late: {  // 지각: 화난 자명종
      color: '#ffb04a',
      draw(g, r) {
        g.beginPath(); g.moveTo(-r * 0.55, r * 0.75); g.lineTo(-r * 0.8, r * 1.15); g.moveTo(r * 0.55, r * 0.75); g.lineTo(r * 0.8, r * 1.15); g.lineWidth = 2; g.strokeStyle = OL; g.stroke();
        circle(g, -r * 0.65, -r * 0.8, r * 0.38); fillStroke(g, '#ffd36a', 1.8);
        circle(g, r * 0.65, -r * 0.8, r * 0.38); fillStroke(g, '#ffd36a', 1.8);
        circle(g, 0, 0, r); fillStroke(g, '#ffb04a', 2.2);
        circle(g, 0, r * 0.05, r * 0.72); g.fillStyle = '#fff4dc'; g.fill();
        eye(g, -r * 0.28, -r * 0.12, r * 0.2, 'angry'); eye(g, r * 0.28, -r * 0.12, r * 0.2, 'angry', -1);
        g.beginPath(); g.moveTo(0, r * 0.3); g.lineTo(0, r * 0.55); g.moveTo(0, r * 0.3); g.lineTo(r * 0.25, r * 0.3); g.lineWidth = 1.5; g.strokeStyle = OL; g.stroke();
      },
      w: 2.6, h: 2.9,
    },
    chalk: { // 졸음: 꾸벅꾸벅 베개 유령 (원거리)
      color: '#c9b8ff',
      noFlip: true,
      draw(g, r) {
        rrect(g, -r * 1.0, -r * 0.8, r * 2.0, r * 1.6, r * 0.65); fillStroke(g, '#c9b8ff', 2);
        rrect(g, -r * 0.7, -r * 0.6, r * 0.7, r * 0.35, r * 0.15); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
        eye(g, -r * 0.38, r * 0.05, r * 0.24, 'sleepy'); eye(g, r * 0.38, r * 0.05, r * 0.24, 'sleepy');
        oval(g, 0, r * 0.45, r * 0.12, r * 0.09); g.fillStyle = OL; g.fill();
        g.font = `bold ${r * 0.75}px sans-serif`; g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.6; g.strokeText('z', r * 0.7, -r * 0.85); g.fillText('z', r * 0.7, -r * 0.85);
      },
      w: 2.6, h: 2.4,
    },
    group: { // 게으름: 축 늘어진 나무늘보 덩어리 (죽으면 미루기로 분열)
      color: '#a68b6b',
      draw(g, r) {
        g.beginPath(); g.moveTo(-r * 0.9, r * 0.1); g.quadraticCurveTo(-r * 1.25, r * 0.6, -r * 1.05, r * 0.95); g.moveTo(r * 0.9, r * 0.1); g.quadraticCurveTo(r * 1.25, r * 0.6, r * 1.05, r * 0.95);
        g.lineWidth = 4.2; g.strokeStyle = OL; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = '#a68b6b'; g.stroke();
        oval(g, 0, 0, r, r * 0.95); fillStroke(g, '#a68b6b', 2.2);
        oval(g, 0, r * 0.05, r * 0.72, r * 0.55); g.fillStyle = '#e1cba9'; g.fill();
        g.__lid = '#a68b6b';
        eye(g, -r * 0.3, 0, r * 0.2, 'droopy'); eye(g, r * 0.3, 0, r * 0.2, 'droopy');
        g.beginPath(); g.arc(0, r * 0.38, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); g.lineWidth = 1.4; g.strokeStyle = OL; g.stroke();
      },
      w: 2.8, h: 2.4,
    },
  };

  /* ---------- 보스: 시험 불안 (번개 치는 먹구름) ---------- */
  const BOSS = {
    '시험 불안': {
      color: '#6a42a8',
      draw(g, r) {
        g.beginPath();
        const n = 16;
        for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (i % 2 ? 0.86 : 1.06); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.88); }
        g.closePath(); fillStroke(g, '#4b2d7a', 3);
        oval(g, 0, -r * 0.05, r * 0.78, r * 0.62); g.fillStyle = '#6a42a8'; g.fill();
        oval(g, -r * 0.35, -r * 0.4, r * 0.25, r * 0.12); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
        // 번개
        g.beginPath(); g.moveTo(r * 0.1, r * 0.55); g.lineTo(-r * 0.12, r * 0.95); g.lineTo(r * 0.08, r * 0.92); g.lineTo(-r * 0.1, r * 1.3); g.lineTo(r * 0.3, r * 0.8); g.lineTo(r * 0.1, r * 0.82); g.lineTo(r * 0.28, r * 0.55); g.closePath();
        fillStroke(g, '#ffe14d', 2);
        g.canvas.face = { fx: 0, fy: -r * 0.04, es: r * 0.22, gap: r * 0.32, mood: 'angry', col: '#6a42a8' };   // 얼굴은 실시간 (Art.drawEnemy)
      },
      w: 2.4, h: 2.8,
    },
  };

  /* ---------- 왕 표정 (실시간): 평소엔 주인공을 노려보며 씩 웃고, 맞으면 질끈·찡그림, 체력이 적으면 화나서 이를 악물고 땀, 돌진 직전엔 눈을 부릅뜸 ---------- */
  function bossFace(ctx, f, mode, t, look, seed) {
    const es = f.es, gap = f.gap, ey = f.fy - es * 0.3, my = f.fy + es * 1.6;
    const blink = mode === 'menace' && ((t + seed) % 4.2) < 0.14;
    const shake = mode === 'rage' ? Math.sin(t * 60) * es * 0.06 : 0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const sx of [-1, 1]) {
      const x = f.fx + sx * gap + shake, y = ey;
      if (mode === 'hurt') { ctx.strokeStyle = OL; ctx.lineWidth = es * 0.32; ctx.beginPath(); ctx.moveTo(x - sx * es * 0.9, y - es * 0.7); ctx.lineTo(x + sx * es * 0.6, y); ctx.lineTo(x - sx * es * 0.9, y + es * 0.7); ctx.stroke(); continue; }   // >< 질끈
      if (blink) { ctx.strokeStyle = OL; ctx.lineWidth = es * 0.28; ctx.beginPath(); ctx.moveTo(x - es * 0.9, y); ctx.lineTo(x + es * 0.9, y); ctx.stroke(); continue; }
      const wide = mode === 'charge' ? 1.15 : 1, sleepy = f.mood === 'droopy' && mode === 'menace';
      oval(ctx, x, y, es * 0.95 * wide, es * 1.1 * wide); fillStroke(ctx, '#ffffff', es * 0.2);
      const pr = es * (mode === 'charge' ? 0.32 : mode === 'rage' ? 0.38 : 0.5);
      const px = x + look * es * 0.35, py = y + es * 0.12;
      if (f.mood === 'dizzy' && mode === 'menace') { ctx.strokeStyle = OL; ctx.lineWidth = es * 0.16; ctx.beginPath(); for (let k = 0; k < 18; k++) { const a = k * 0.6 + t * 4 * sx, rr = k * es * 0.045; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.stroke(); }   // 빙글빙글
      else { circle(ctx, px, py, pr); ctx.fillStyle = mode === 'rage' ? '#ff3b4b' : '#2a1838'; ctx.fill(); circle(ctx, px - pr * 0.3, py - pr * 0.35, pr * 0.32); ctx.fillStyle = '#fff'; ctx.fill(); }
      if (sleepy) { ctx.save(); oval(ctx, x, y, es * 0.95, es * 1.1); ctx.clip(); ctx.fillStyle = shade(f.col || '#888888', -0.1); ctx.fillRect(x - es, y - es * 1.2, es * 2, es * 1.05); ctx.restore(); oval(ctx, x, y, es * 0.95, es * 1.1); ctx.lineWidth = es * 0.2; ctx.strokeStyle = OL; ctx.stroke(); }
    }
    // 눈썹: 평소에도 찌푸림, 화나면 더 가파르게
    if (mode !== 'hurt') {
      const tilt = mode === 'rage' ? 0.75 : mode === 'charge' ? 0.6 : f.mood === 'droopy' ? -0.25 : 0.45;
      ctx.strokeStyle = OL; ctx.lineWidth = es * 0.34;
      for (const sx of [-1, 1]) { const x = f.fx + sx * gap + shake; ctx.beginPath(); ctx.moveTo(x + sx * es * 1.05, ey - es * 1.25 - tilt * es * 0.5); ctx.lineTo(x - sx * es * 0.9, ey - es * 1.25 + tilt * es * 0.5); ctx.stroke(); }
    }
    // 입
    const w = es * 2.4;
    if (mode === 'hurt') { ctx.beginPath(); ctx.moveTo(f.fx - w / 2, my); for (let i = 1; i <= 6; i++) ctx.lineTo(f.fx - w / 2 + i * w / 6, my + (i % 2 ? -es * 0.35 : es * 0.15)); ctx.strokeStyle = OL; ctx.lineWidth = es * 0.25; ctx.stroke(); }
    else if (mode === 'charge') { oval(ctx, f.fx, my + es * 0.2, w * 0.32, es * 0.75); fillStroke(ctx, '#3a1020', es * 0.2); }   // 크아앙
    else {
      const h = mode === 'rage' ? es * 0.85 : es * 0.6, grin = mode === 'menace' ? Math.sin(t * 1.3 + seed) * es * 0.08 : 0;
      ctx.beginPath(); ctx.moveTo(f.fx - w / 2, my - h * 0.2 + grin); ctx.quadraticCurveTo(f.fx, my + h * 1.1, f.fx + w / 2, my - h * 0.2 - grin); ctx.quadraticCurveTo(f.fx, my + h * 0.15, f.fx - w / 2, my - h * 0.2 + grin); ctx.closePath(); fillStroke(ctx, '#ffffff', es * 0.2);   // 씩 웃는 이빨
      ctx.strokeStyle = OL; ctx.lineWidth = es * 0.12; for (let i = 1; i < 5; i++) { const x = f.fx - w / 2 + i * w / 5; ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + h * 0.6); ctx.stroke(); }
    }
    if (mode === 'rage') { const k = (t * 1.4 + seed) % 1; ctx.save(); ctx.globalAlpha *= 1 - k; ctx.fillStyle = '#7fd3ff'; const x = f.fx + gap * 1.9, y = ey - es + k * es * 1.5; ctx.beginPath(); ctx.moveTo(x, y - es * 0.6); ctx.quadraticCurveTo(x + es * 0.45, y + es * 0.2, x, y + es * 0.35); ctx.quadraticCurveTo(x - es * 0.45, y + es * 0.2, x, y - es * 0.6); ctx.fill(); ctx.restore(); }   // 식은땀
  }

  /* ---------- 주인공 / 에코 / 선생님 ---------- */
  /* ---------- 주인공 복장 (회차마다 바뀜: worlds.js outfitOf) ---------- */
  // 캐릭터 고유 표시 (복장 위에 얹힘)
  // 캐릭터 고유 표시: 복장 장식(모자·목·겉옷·오라)과 겹치지 않는 자리에 그려서 어떤 복장을 입어도 구분된다
  const CHAR = { '🏃': { shoe: '#2ee88a', bands: true, spiky: true }, '🤓': { glasses: true, book: true }, '🧑‍⚕️': { armband: true },
    '🎨': { hand: 'brush' }, '🎤': { hand: 'mic' }, '🧑‍🍳': { hand: 'ladle' }, '🧑‍🔬': { goggles: true }, '🏅': { sash: true },
    '🧭': { hand: 'compass' }, '🦸': { cape: true }, '🌟': { stars: true, shoe: '#ffd54f' } };
  // 복장 20종: 몸·장식 색, 무늬, ★2 모자 · ★3 목 장식 · ★4 겉옷
  const STYLES = [
    { body: '#4561d6', trim: '#2c3f9a', pack: '#e2574c', pat: 'vneck',   head: 'cap',      hc: '#2c3f9a', neck: 'tie',    nc: '#e53935', outer: 'bag',     oc: '#e2574c' },   // 교복
    { body: '#e2574c', trim: '#ffffff', pack: '#2e3a59', pat: 'stripe',  head: 'headband', hc: '#ffffff', neck: 'medal',  nc: '#ffd54f', outer: 'bag',     oc: '#2e3a59' },   // 체육복
    { body: '#8e7cc3', trim: '#6a5aa5', pack: '#26a69a', pat: 'pocket',  head: 'hood',     hc: '#8e7cc3', neck: 'scarf',  nc: '#ffca28', outer: 'bag',     oc: '#26a69a' },   // 후드티
    { body: '#37474f', trim: '#eceff1', pack: '#212121', pat: 'lapel',   head: 'tophat',   hc: '#212121', neck: 'bow',    nc: '#e53935', outer: 'cape',    oc: '#212121' },   // 정장
    { body: '#f48fb1', trim: '#4fc3f7', pack: '#7e57c2', pat: 'hanbok',  head: 'gat',      hc: '#212121', neck: 'bow',    nc: '#7e57c2', outer: 'cape',    oc: '#81d4fa' },   // 한복
    { body: '#eceff1', trim: '#ff7043', pack: '#90a4ae', pat: 'belt',    head: 'space',    hc: '#b3e5fc', neck: 'collar', nc: '#ff7043', outer: 'jetpack', oc: '#90a4ae' },   // 우주복
    { body: '#8d6e63', trim: '#5d4037', pack: '#6d4c41', pat: 'lapel',   head: 'detective',hc: '#795548', neck: 'scarf',  nc: '#c62828', outer: 'cape',    oc: '#6d4c41' },   // 탐정
    { body: '#5e35b1', trim: '#ffd54f', pack: '#311b92', pat: 'stars',   head: 'wizard',   hc: '#4527a0', neck: 'bow',    nc: '#ffd54f', outer: 'cape',    oc: '#311b92' },   // 마법사
    { body: '#b0bec5', trim: '#ffd54f', pack: '#78909c', pat: 'plate',   head: 'knight',   hc: '#90a4ae', neck: 'medal',  nc: '#ffd54f', outer: 'cape',    oc: '#c62828' },   // 기사
    { body: '#fafafa', trim: '#c62828', pack: '#5d4037', pat: 'stripe',  head: 'pirate',   hc: '#212121', neck: 'scarf',  nc: '#c62828', outer: 'sword',   oc: '#cfd8dc' },   // 해적
    { body: '#ffffff', trim: '#e0e0e0', pack: '#ef5350', pat: 'buttons', head: 'chef',     hc: '#ffffff', neck: 'scarf',  nc: '#e53935', outer: 'apron',   oc: '#ffecb3' },   // 요리사
    { body: '#ffcc80', trim: '#8d6e63', pack: '#42a5f5', pat: 'none',    head: 'beret',    hc: '#c62828', neck: 'scarf',  nc: '#42a5f5', outer: 'apron',   oc: '#ffffff' },   // 화가
    { body: '#a1887f', trim: '#5d4037', pack: '#795548', pat: 'pocket',  head: 'explorer', hc: '#d7ccc8', neck: 'scarf',  nc: '#ff7043', outer: 'bag',     oc: '#795548' },   // 탐험가
    { body: '#ec407a', trim: '#ffffff', pack: '#7b1fa2', pat: 'stars',   head: 'headset',  hc: '#212121', neck: 'bow',    nc: '#ffffff', outer: 'jacket',  oc: '#7b1fa2' },   // 아이돌
    { body: '#263238', trim: '#c62828', pack: '#37474f', pat: 'belt',    head: 'ninja',    hc: '#c62828', neck: 'scarf',  nc: '#c62828', outer: 'sword',   oc: '#b0bec5' },   // 닌자
    { body: '#ffffff', trim: '#4fc3f7', pack: '#4fc3f7', pat: 'lapel',   head: 'goggles',  hc: '#4fc3f7', neck: 'tie',    nc: '#1e88e5', outer: 'tank',    oc: '#81c784' },   // 과학자
    { body: '#455a64', trim: '#ffd54f', pack: '#37474f', pat: 'pocket',  head: 'pilot',    hc: '#6d4c41', neck: 'scarf',  nc: '#ffffff', outer: 'wings',   oc: '#eceff1' },   // 파일럿
    { body: '#ff7043', trim: '#ffeb3b', pack: '#455a64', pat: 'stripe',  head: 'fire',     hc: '#d32f2f', neck: 'collar', nc: '#ffeb3b', outer: 'tank',    oc: '#e53935' },   // 소방관
    { body: '#d32f2f', trim: '#ffffff', pack: '#8d6e63', pat: 'belt',    head: 'santa',    hc: '#d32f2f', neck: 'collar', nc: '#ffffff', outer: 'sack',    oc: '#8d6e63' },   // 산타
    { body: '#7b1fa2', trim: '#ffd54f', pack: '#4a148c', pat: 'buttons', head: 'crown',    hc: '#ffd54f', neck: 'medal',  nc: '#ffd54f', outer: 'cape',    oc: '#c62828' },   // 왕실
  ];

  /** 색을 살짝 바꾼다 (100회차 뒤 색 변형): 색상 회전 + 밝기 */
  function variantColor(hex, v) {
    if (!v || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) / 255, g2 = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); let h = 0, sat = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g2 - b) / d + (g2 < b ? 6 : 0) : mx === g2 ? (b - r) / d + 2 : (r - g2) / d + 4; h /= 6; }
    h = (h + v * 0.1) % 1;                                        // 변형마다 색상 36°씩
    const l2 = Math.min(0.92, Math.max(0.12, l + (v % 2 ? 0.05 : -0.04)));
    const q = l2 < 0.5 ? l2 * (1 + sat) : l2 + sat - l2 * sat, p2 = 2 * l2 - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q - p2) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p2 + (q - p2) * (2 / 3 - t) * 6 : p2; };
    const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
    return '#' + to(sat ? f(h + 1 / 3) : l2) + to(sat ? f(h) : l2) + to(sat ? f(h - 1 / 3) : l2);
  }
  function lineK(g, pts, lw, col) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = lw; g.strokeStyle = col || OL; g.stroke(); }
  function star5(g, x, y, r1, r2) { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r2 : r1; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }

  // ★4 겉옷: 몸 뒤에 그리는 것
  function outerBack(g, o) {
    switch (o.outer) {
      case 'cape': g.beginPath(); g.moveTo(-6, 0.5); g.quadraticCurveTo(-11, 9, -9, 15); g.lineTo(9, 15); g.quadraticCurveTo(11, 9, 6, 0.5); g.closePath(); fillStroke(g, o.oc, 1.6); break;
      case 'wings': for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, 3); g.quadraticCurveTo(s * 15, -4, s * 14.5, 6); g.quadraticCurveTo(s * 12, 7, s * 13, 10); g.quadraticCurveTo(s * 8, 9, s * 4, 8); g.closePath(); fillStroke(g, o.oc, 1.4); } break;
      case 'jetpack': case 'tank': for (const s of [-1, 1]) { rrect(g, s * 4.5 - 2.5, -0.5, 5, 11, 2.2); fillStroke(g, o.oc, 1.4); } if (o.outer === 'jetpack') { g.fillStyle = '#ffb74d'; g.beginPath(); g.moveTo(-4.5, 10.5); g.lineTo(-2.5, 14); g.lineTo(-6.5, 14); g.closePath(); g.fill(); g.beginPath(); g.moveTo(4.5, 10.5); g.lineTo(6.5, 14); g.lineTo(2.5, 14); g.closePath(); g.fill(); } break;
      case 'sword': lineK(g, [-9, -1, 7, 14], 2.6, OL); lineK(g, [-9, -1, 7, 14], 1.4, o.oc); lineK(g, [-10.5, 1.5, -6.5, -2.5], 2.2, '#8d6e63'); break;
      case 'sack': circle(g, -8.5, 4, 5.5); fillStroke(g, o.oc, 1.6); lineK(g, [-10, -0.5, -7, -1.5], 1.4); break;
      default: break;
    }
  }
  // ★4 겉옷: 몸 앞에 그리는 것
  function outerFront(g, o) {
    switch (o.outer) {
      case 'apron': rrect(g, -4, 3, 8, 8.5, 2); fillStroke(g, o.oc, 1.2); if (o.pat === 'none') { for (const [x, y, c] of [[-1.5, 6, '#e53935'], [1.5, 8, '#42a5f5'], [-0.5, 9.5, '#ffca28']]) { circle(g, x, y, 0.9); g.fillStyle = c; g.fill(); } } break;
      case 'jacket': for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5.8, 0.5); g.lineTo(s * 1.8, 0.5); g.lineTo(s * 2.5, 11.5); g.lineTo(s * 5.8, 11.5); g.closePath(); fillStroke(g, o.oc, 1.2); } break;
      default: break;
    }
  }
  function neckItem(g, o) {
    switch (o.neck) {
      case 'tie': g.beginPath(); g.moveTo(0, 1); g.lineTo(1.4, 3); g.lineTo(0.6, 8); g.lineTo(0, 9); g.lineTo(-0.6, 8); g.lineTo(-1.4, 3); g.closePath(); fillStroke(g, o.nc, 0.9); break;
      case 'bow': for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 1.6); g.lineTo(s * 3, 0); g.lineTo(s * 3, 3.2); g.closePath(); fillStroke(g, o.nc, 0.9); } circle(g, 0, 1.6, 0.8); g.fillStyle = OL; g.fill(); break;
      case 'scarf': rrect(g, -5, -0.6, 10, 2.8, 1.3); fillStroke(g, o.nc, 1); rrect(g, 1.5, 1.5, 2.4, 5.5, 1); fillStroke(g, o.nc, 1); break;
      case 'medal': lineK(g, [-2.5, 0.5, 0, 4.5, 2.5, 0.5], 1.4, '#1e88e5'); circle(g, 0, 5.6, 1.9); fillStroke(g, o.nc, 0.9); break;
      case 'collar': rrect(g, -6, -0.8, 12, 2.6, 1.3); fillStroke(g, o.nc, 1); break;
      default: break;
    }
  }
  function bodyPattern(g, o) {
    g.save(); rrect(g, -5.8, 0, 11.6, 11.5, 4); g.clip();
    switch (o.pat) {
      case 'vneck': lineK(g, [-2.5, 0.8, 0, 4, 2.5, 0.8], 1.4, o.trim); break;
      case 'stripe': g.fillStyle = o.trim; g.fillRect(-6, 4, 12, 1.6); g.fillRect(-6, 7.5, 12, 1.6); break;
      case 'pocket': rrect(g, -3.5, 6, 7, 4, 1.5); g.lineWidth = 1; g.strokeStyle = o.trim; g.stroke(); break;
      case 'lapel': g.fillStyle = o.trim; g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(0, 5); g.lineTo(1.5, 0); g.closePath(); g.fill(); lineK(g, [-1.5, 0, -3, 6], 1, o.trim); lineK(g, [1.5, 0, 3, 6], 1, o.trim); break;
      case 'hanbok': g.fillStyle = o.trim; g.fillRect(-6, 6.5, 12, 6); lineK(g, [-4, 0.5, 1.5, 5], 1.4, '#ffffff'); break;
      case 'belt': g.fillStyle = o.trim; g.fillRect(-6, 7, 12, 1.8); g.fillStyle = '#ffd54f'; g.fillRect(-1, 6.8, 2, 2.2); break;
      case 'stars': g.fillStyle = o.trim; for (const [x, y] of [[-3, 4], [2.5, 6], [-1, 9]]) { star5(g, x, y, 1.3, 0.55); g.fill(); } break;
      case 'plate': g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-4, 1.5, 3, 4); lineK(g, [-5.8, 6, 5.8, 6], 1, '#78909c'); break;
      case 'buttons': g.fillStyle = o.trim; for (const y of [3, 6, 9]) { circle(g, 0, y, 0.8); g.fill(); } break;
      default: break;
    }
    g.restore();
  }
  function hoodBack(g, o) { circle(g, 0, -6, 9.4); fillStroke(g, o.hc, 1.6); }
  function headwear(g, o) {
    const hc = o.hc;
    switch (o.head) {
      case 'cap': g.beginPath(); g.arc(0, -8, 7.8, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.4); rrect(g, -1, -9.2, 10.5, 2.6, 1.3); fillStroke(g, hc, 1.2); break;
      case 'headband': rrect(g, -7.8, -10.5, 15.6, 2.6, 1.2); fillStroke(g, hc, 1.1); lineK(g, [6.5, -9.5, 10, -7, 9, -11], 1.3, hc); break;
      case 'hood': g.beginPath(); g.arc(0, -6, 9.4, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 2.6; g.strokeStyle = variantColor(o.trim, 0); g.stroke(); break;
      case 'tophat': rrect(g, -9, -12.5, 18, 2.4, 1.2); fillStroke(g, hc, 1.3); rrect(g, -5.5, -23, 11, 11, 1.5); fillStroke(g, hc, 1.4); g.fillStyle = '#e53935'; g.fillRect(-5.5, -15, 11, 2); break;
      case 'gat': g.globalAlpha = 0.85; oval(g, 0, -12, 13, 2.6); fillStroke(g, hc, 1.2); rrect(g, -4.5, -19, 9, 7.5, 2); fillStroke(g, hc, 1.2); g.globalAlpha = 1; lineK(g, [-6, -11, -5, -2], 0.8, '#212121'); break;
      case 'space': circle(g, 0, -6.5, 10.5); g.fillStyle = 'rgba(180,230,255,.22)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke(); lineK(g, [-5, -13, -2, -15], 1.4, 'rgba(255,255,255,.8)'); circle(g, 0, -18, 1.4); g.fillStyle = '#ff7043'; g.fill(); lineK(g, [0, -17, 0, -16.6], 1); break;
      case 'detective': g.beginPath(); g.arc(0, -8.5, 7.9, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.4); g.beginPath(); g.ellipse(6.5, -8.6, 4, 1.6, 0, 0, Math.PI * 2); fillStroke(g, hc, 1.1); g.beginPath(); g.ellipse(-6.5, -8.6, 4, 1.6, 0, 0, Math.PI * 2); fillStroke(g, hc, 1.1); lineK(g, [-5, -12, 5, -12], 0.8, '#5d4037'); break;
      case 'wizard': g.beginPath(); g.moveTo(-9, -11); g.quadraticCurveTo(0, -13.5, 9, -11); g.lineTo(2, -14); g.quadraticCurveTo(4, -22, 7, -27); g.quadraticCurveTo(-2, -22, -3, -14); g.closePath(); fillStroke(g, hc, 1.4); star5(g, 0.5, -17.5, 2.2, 0.9); g.fillStyle = '#ffd54f'; g.fill(); break;
      case 'knight': g.beginPath(); g.arc(0, -7.5, 8.3, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.5); g.beginPath(); g.moveTo(0, -15.5); g.quadraticCurveTo(-6, -22, -9, -15); g.quadraticCurveTo(-4, -18, 0, -15.5); fillStroke(g, '#e53935', 1.1); lineK(g, [0, -15.5, 0, -8], 1, '#78909c'); break;
      case 'pirate': g.beginPath(); g.moveTo(-10, -9.5); g.quadraticCurveTo(-6, -18, 0, -15.5); g.quadraticCurveTo(6, -18, 10, -9.5); g.quadraticCurveTo(0, -12, -10, -9.5); fillStroke(g, hc, 1.4); circle(g, 0, -12.5, 1.4); g.fillStyle = '#fff'; g.fill(); break;
      case 'chef': for (const [x, y, r] of [[-4, -16, 4], [0, -18.5, 4.5], [4, -16, 4]]) { circle(g, x, y, r); fillStroke(g, hc, 1.2); } rrect(g, -6, -15, 12, 5, 1.5); fillStroke(g, hc, 1.2); break;
      case 'beret': g.save(); g.rotate(-0.2); oval(g, 0, -12.2, 8.5, 3.2); fillStroke(g, hc, 1.3); lineK(g, [0, -15.4, 0.5, -17], 1.4); g.restore(); break;
      case 'explorer': g.beginPath(); g.arc(0, -9, 7.5, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.4); oval(g, 0, -9, 11, 2.2); fillStroke(g, hc, 1.2); g.fillStyle = '#8d6e63'; g.fillRect(-7.4, -11.2, 14.8, 1.6); break;
      case 'headset': g.beginPath(); g.arc(0, -6.5, 9, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 1.8; g.strokeStyle = OL; g.stroke(); rrect(g, -10, -8, 3, 5, 1.2); fillStroke(g, '#ec407a', 1); lineK(g, [-8.5, -3, -4.5, 0], 1.1); circle(g, -4, 0.2, 1.1); g.fillStyle = OL; g.fill(); break;
      case 'ninja': rrect(g, -7.8, -10.5, 15.6, 2.6, 1.2); fillStroke(g, hc, 1.1); lineK(g, [7, -9.5, 11, -7, 10.5, -10], 1.4, hc); g.save(); g.beginPath(); g.arc(0, -6.5, 7.6, 0.05 * Math.PI, 0.95 * Math.PI); g.lineTo(-7.5, -3.5); g.lineTo(7.5, -3.5); g.closePath(); g.fillStyle = '#263238'; g.fill(); g.restore(); break;
      case 'goggles': rrect(g, -7.8, -11.5, 15.6, 2, 1); g.fillStyle = OL; g.fill(); for (const x of [-3, 3]) { circle(g, x, -11, 2.6); fillStroke(g, hc, 1.2); circle(g, x - 0.6, -11.6, 0.8); g.fillStyle = '#fff'; g.fill(); } break;
      case 'pilot': g.beginPath(); g.arc(0, -7.2, 8, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.4); for (const x of [-3, 3]) { circle(g, x, -11.3, 2.3); fillStroke(g, '#80deea', 1.1); } break;
      case 'fire': g.beginPath(); g.arc(0, -8, 8.4, Math.PI, 0); g.closePath(); fillStroke(g, hc, 1.5); oval(g, 0, -8, 11, 2); fillStroke(g, hc, 1.2); rrect(g, -2, -15, 4, 5, 1); fillStroke(g, '#ffd54f', 1); break;
      case 'santa': g.beginPath(); g.moveTo(-8, -10); g.quadraticCurveTo(0, -22, 9, -17); g.quadraticCurveTo(4, -15, 8, -10); g.closePath(); fillStroke(g, hc, 1.4); rrect(g, -8.5, -11.5, 17, 3.2, 1.6); fillStroke(g, '#ffffff', 1.1); circle(g, 9.5, -17, 2); fillStroke(g, '#ffffff', 1); break;
      case 'crown': g.beginPath(); g.moveTo(-6, -11); g.lineTo(-6.5, -17); g.lineTo(-3, -13.5); g.lineTo(0, -18.5); g.lineTo(3, -13.5); g.lineTo(6.5, -17); g.lineTo(6, -11); g.closePath(); fillStroke(g, hc, 1.3); for (const [x, c] of [[-3.5, '#e53935'], [0, '#42a5f5'], [3.5, '#66bb6a']]) { circle(g, x, -12.3, 0.9); g.fillStyle = c; g.fill(); } break;
      default: break;
    }
  }
  /* ---------- 주인공 (새 그림체: 2등신 · 짧은 머리 · 큰 눈 · 활짝 웃는 입 · 팔·다리 · 백팩) ----------
   * 새 몸은 'N 좌표'(머리 중심 0,-11 반지름 10.4 · 몸 -6.4..6.4 × 0..10.5 · 발 21)로 그리고 전체를 KID_S배로 줄인다.
   * 모자·안경·목도리·망토 같은 기존 장식(옛 좌표: 머리 0,-6.5 r7.6 · 몸 11.6×11.5)은 새 머리·몸 위치로 옮겨 그린다 */
  const KID_S = 0.75, KSK = '#ffdcbf';
  const onHead = (g, fn) => { g.save(); g.translate(0, -11); g.scale(1.37, 1.37); g.translate(0, 6.5); fn(); g.restore(); };
  const onBody = (g, fn) => { g.save(); g.scale(1.1, 0.91); fn(); g.restore(); };
  function drawKid(g, o, step) {
    if (o.aura) {   // ★5 오라: 뒤에 은은한 금빛
      const gl = g.createRadialGradient(0, -2, 2, 0, -2, 17); gl.addColorStop(0, 'rgba(255,230,120,.45)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
      g.fillStyle = gl; g.fillRect(-17, -22, 34, 38);
    }
    if (o.stars) { const gl = g.createRadialGradient(0, -4, 2, 0, -4, 18); gl.addColorStop(0, 'rgba(255,170,230,.35)'); gl.addColorStop(1, 'rgba(255,170,230,0)'); g.fillStyle = gl; g.fillRect(-18, -24, 36, 38); }
    g.save(); g.scale(KID_S, KID_S);
    const skin = o.skin || KSK, hair = o.hair || '#2a2220', st = step || 0;
    const fsN = (fill, lw) => fillStroke(g, fill, lw);
    // 뒤: 망토 등 · 백팩 · 여자 주인공 뒷머리
    if (o.cape) onBody(g, () => { g.beginPath(); g.moveTo(-6, 0.5); g.quadraticCurveTo(-10.5, 8, -8.5, 14.5); g.lineTo(8.5, 14.5); g.quadraticCurveTo(10.5, 8, 6, 0.5); g.closePath(); fillStroke(g, '#e53935', 1.5); });
    if (o.outer) onBody(g, () => outerBack(g, o));
    const backpack = !o.outer || o.outer === 'apron' || o.outer === 'jacket';
    if (backpack) { rrect(g, -9.6, -0.5, 19.2, 14, 5); fsN(o.pack, 1.4); }
    if (o.girl && o.head !== 'hood') { rrect(g, -11.4, -15, 22.8, 16, 7); fsN(hair, 1.4); }
    // 다리 (바지) + 운동화
    for (const sx of [-1, 1]) {
      const k = sx * st;
      rrect(g, sx * 3.3 - 2.3, 10.5 + k * 0.4, 4.6, 9.2, 1.6); fsN(o.pants || '#3c4560', 1.2);
      oval(g, sx * 3.6, 21 + k * 0.8, 3.4, 2.1); fsN(o.shoe || '#eeeeee', 1.3);
      oval(g, sx * 3.6 - 0.9, 20.4 + k * 0.8, 1.2, 0.5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    }
    // 팔 (소매 = 옷 색) + 손
    if (!o.noArms) for (const sx of [-1, 1]) { g.save(); g.translate(sx * 6.8, 1.5); g.rotate(sx * (0.3 - st * 0.12 * sx)); rrect(g, -2, -1, 4, 8.3, 2); fsN(o.body, 1.3); circle(g, 0, 8.4, 2); fsN(skin, 1.1); g.restore(); }
    // 몸통
    rrect(g, -6.4, 0, 12.8, 10.5, 4); fsN(o.body, 1.5);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-5.2, 1.4, 2.6, 7.5);
    onBody(g, () => {
      bodyPattern(g, o);
      if (o.gold) { g.fillStyle = '#ffd54f'; g.fillRect(-5, 10, 10, 1.3); }
      if (o.outer) outerFront(g, o);
      if (o.cross) { g.fillStyle = '#e2574c'; g.fillRect(-1, 5, 2, 5); g.fillRect(-2.5, 6.5, 5, 2); }
      if (o.neck) neckItem(g, o);
      if (o.bands) { for (const x of [-7.3, 5.3]) { rrect(g, x, 6.2, 2, 2.8, 0.8); fillStroke(g, '#ffffff', 1); g.fillStyle = '#2ee88a'; g.fillRect(x + 0.3, 7.2, 1.4, 0.8); } }
      if (o.book) { rrect(g, 3.6, 4.6, 5.2, 6.4, 1); fillStroke(g, '#43a047', 1.3); g.fillStyle = '#fff8e1'; g.fillRect(4.4, 5.4, 0.9, 4.8); }
      if (o.sash) { g.save(); rrect(g, -5.8, 0, 11.6, 11.5, 4); g.clip(); g.beginPath(); g.moveTo(-6, -0.5); g.lineTo(-2.5, -0.5); g.lineTo(7, 11); g.lineTo(3.5, 11); g.closePath(); fillStroke(g, '#ffd54f', 1); g.restore(); }
      if (o.hand === 'brush') { line(g, [5.5, 10, 8.5, 2.5], 1.6, '#8d6e63'); circle(g, 8.8, 1.6, 1.5); fillStroke(g, '#e91e63', 0.9); }
      if (o.hand === 'mic') { line(g, [6.5, 10.5, 7.8, 4.5], 1.8, '#455a64'); circle(g, 8, 3.4, 2.1); fillStroke(g, '#b0bec5', 1.1); }
      if (o.hand === 'ladle') { line(g, [6, 10.5, 8, 1.5], 1.5, '#bdbdbd'); oval(g, 8.4, 1.2, 2.4, 1.6); fillStroke(g, '#e0e0e0', 1.1); }
      if (o.hand === 'compass') { circle(g, 7.2, 7.5, 2.8); fillStroke(g, '#ffca28', 1.2); g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(7.2, 5.4); g.lineTo(8, 7.5); g.lineTo(6.4, 7.5); g.closePath(); g.fill(); }
      if (o.armband) { rrect(g, 4.4, 1.2, 3.2, 4.2, 0.8); fillStroke(g, '#ffffff', 1.1); g.fillStyle = '#e53935'; g.fillRect(5.6, 1.9, 0.9, 2.8); g.fillRect(4.9, 2.85, 2.3, 0.9); }
    });
    if (backpack) for (const sx of [-1, 1]) { g.strokeStyle = shade(o.pack, -0.3); g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx * 4.6, -0.2); g.lineTo(sx * 5.4, 7); g.stroke(); }   // 가방끈
    if (o.outer === 'bag') onBody(g, () => { rrect(g, -9.5, -1, 5.5, 10.5, 2); fillStroke(g, o.oc, 1.6); g.fillStyle = '#ffd54f'; g.fillRect(-8.2, 3, 3, 1.4); });
    // 머리
    if (o.head === 'hood') onHead(g, () => hoodBack(g, o));
    if (o.girl) for (const sx of [-1, 1]) { oval(g, sx * 11.6, -5, 3, 5); fsN(hair, 1.3); circle(g, sx * 10.8, -9.4, 1.7); fsN('#ff7eb6', 1); }   // 양갈래 + 분홍 머리끈
    circle(g, -10, -10.5, 2.1); fsN(shade(skin, -0.06), 1.1); circle(g, 10, -10.5, 2.1); fsN(shade(skin, -0.06), 1.1);   // 귀
    oval(g, 0, -11, 10.4, 10); fsN(skin, 1.6);
    const hidesHair = ['cap', 'detective', 'knight', 'explorer', 'pilot', 'fire'].indexOf(o.head) >= 0;
    if (!hidesHair) {
      g.beginPath();
      if (o.girl) { g.moveTo(-11.2, -6); g.quadraticCurveTo(-12.6, -21, 0, -22); g.quadraticCurveTo(12.6, -21, 11.2, -6); g.lineTo(9.4, -7); g.quadraticCurveTo(9.2, -11.5, 6.6, -12.8); g.quadraticCurveTo(3, -12, 0, -13); g.quadraticCurveTo(-3, -12, -6.6, -12.8); g.quadraticCurveTo(-9.2, -11.5, -9.4, -7); g.closePath(); }
      else { g.moveTo(-10.6, -10); g.quadraticCurveTo(-11.5, -20, -3, -21.8); g.quadraticCurveTo(6, -23, 10.6, -15); g.lineTo(10.6, -10); g.lineTo(8, -13.5); g.lineTo(6, -12.2); g.lineTo(4, -14.2); g.lineTo(1.5, -12.4); g.lineTo(-1, -14.4); g.lineTo(-3.5, -12.6); g.lineTo(-6, -14.2); g.lineTo(-8.4, -12.4); g.closePath(); }
      fsN(hair, 1.5);
      g.strokeStyle = 'rgba(255,240,220,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(-1.5, -14, 7.2, Math.PI * 1.15, Math.PI * 1.5); g.stroke();   // 머릿결 빛
      if (o.spiky && !o.head) onHead(g, () => { g.beginPath(); g.moveTo(-5, -12.6); g.lineTo(-3.6, -16.2); g.lineTo(-1.6, -13.6); g.lineTo(0.2, -16.8); g.lineTo(2, -13.6); g.lineTo(4.2, -15.8); g.lineTo(5.4, -12.4); g.closePath(); fillStroke(g, hair, 1.3); });
    }
    // 얼굴: 큰 눈(반짝임 2개) · 눈썹 · 볼 · 활짝 웃는 입
    for (const sx of [-1, 1]) { oval(g, sx * 3.9, -8.4, 2.1, 2.7); g.fillStyle = '#2b1d14'; g.fill(); oval(g, sx * 3.9, -7.8, 1.5, 1.6); g.fillStyle = '#6a4228'; g.fill(); circle(g, sx * 3.9 + 0.7, -9.4, 0.9); g.fillStyle = '#fff'; g.fill(); circle(g, sx * 3.9 - 0.6, -7.4, 0.4); g.fill(); }
    if (o.girl) { g.lineWidth = 1; g.strokeStyle = OL; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 5.6, -10.2); g.lineTo(sx * 6.9, -11); g.stroke(); } }
    g.strokeStyle = shade(hair, -0.1); g.lineWidth = 1; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 2.6, -12); g.quadraticCurveTo(sx * 4, -12.6, sx * 5.4, -12); g.stroke(); }
    oval(g, -6.4, -5.4, 1.9, 1.1); g.fillStyle = 'rgba(255,110,110,.5)'; g.fill(); oval(g, 6.4, -5.4, 1.9, 1.1); g.fill();
    if (o.head !== 'ninja') { g.beginPath(); g.moveTo(-2.4, -5); g.quadraticCurveTo(0, -1.8, 2.4, -5); g.closePath(); fsN('#c8403e', 1); g.fillStyle = '#fff'; g.fillRect(-1.6, -5, 3.2, 0.9); }
    onHead(g, () => {
      if (o.girl && !hidesHair && !o.head) { g.beginPath(); g.moveTo(4.6, -12); g.lineTo(1.8, -14.4); g.lineTo(1.8, -9.8); g.closePath(); g.moveTo(4.6, -12); g.lineTo(7.4, -14.4); g.lineTo(7.4, -9.8); g.closePath(); fillStroke(g, '#ff7eb6', 1); }   // 분홍 리본
      if (o.goggles) { g.lineWidth = 1.6; g.strokeStyle = '#26c6da'; circle(g, -2.7, -4.4, 2.5); g.stroke(); circle(g, 2.7, -4.4, 2.5); g.stroke(); }
      if (o.glasses) { g.lineWidth = 0.9; g.strokeStyle = OL; circle(g, -2.7, -4.4, 2.3); g.stroke(); circle(g, 2.7, -4.4, 2.3); g.stroke(); g.beginPath(); g.moveTo(-0.4, -4.4); g.lineTo(0.4, -4.4); g.stroke(); }
      if (o.head) headwear(g, o);
    });
    g.restore();
    if (o.stars) { for (const [x, y, r] of [[-12, -14, 2], [12, -11, 1.6], [-13, 3, 1.4]]) { star5(g, x, y, r, r * 0.42); fillStroke(g, '#ffb3e6', 0.8); } }   // 전설의 나: 분홍 별
    if (o.aura) { for (const [x, y, r] of [[-13, -12, 1.8], [13, -6, 1.5], [-12, 6, 1.3], [12, 9, 1.7]]) { star5(g, x, y, r, r * 0.42); fillStroke(g, '#fff59d', 0.8); } }
  }
  let outfit = { style: 0, tier: 0, variant: 0, key: '0.0.0' };
  let kidLook = 'boy';   // 주인공 모습: 'boy' | 'girl'
  let kidColor = null;   // 직접 고른 옷 색 (#hex). null = 복장 원래 색
  let kidSkin = null;    // 직접 고른 얼굴(피부) 색 (#hex). null = 기본
  let kidHair = null;    // 직접 고른 머리 색 (#hex). null = 기본
  function shade(hex, k) {   // k<0 어둡게, k>0 밝게
    const n = parseInt(hex.slice(1), 16), f = (x) => Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }
  /** 지금 회차의 복장 + 캐릭터 고유 표시를 합친 그리기 옵션 */
  function outfitOpts(emo, of) {
    const st = STYLES[of.style] || STYLES[0], v = of.variant, t = of.tier;
    const c = (x) => variantColor(x, v);
    const o = { body: c(st.body), trim: c(st.trim), pack: c(st.pack), pat: st.pat };
    if (t >= 1) { o.head = st.head; o.hc = c(st.hc); }
    if (t >= 2) { o.neck = st.neck; o.nc = c(st.nc); }
    if (t >= 3) { o.outer = st.outer; o.oc = c(st.oc); }
    if (t >= 4) { o.aura = true; o.gold = true; }
    if (kidColor) {   // 직접 고른 옷 색: 몸통(교복·후드티는 테두리·모자까지 같은 계열로)
      o.body = kidColor;
      const light = parseInt(kidColor.slice(1, 3), 16) > 200;
      if (of.style === 0 || of.style === 2) o.trim = shade(kidColor, light ? -0.3 : -0.35);
      if (of.style === 2 && o.hc) o.hc = kidColor;
      if (of.style === 0 && o.hc) o.hc = shade(kidColor, -0.35);
    }
    if (kidLook === 'girl') o.girl = true;
    if (kidSkin) o.skin = kidSkin;
    if (kidHair) o.hair = kidHair;
    return Object.assign(o, CHAR[emo] || {});
  }
  /** noArms: 게임 속 주인공은 팔을 따로(줍기·손 내밀기·만세) 그리므로 그림에는 팔을 넣지 않는다 */
  function kidSprite(emo, step, of, noArms) {
    of = of || outfit;
    return sprite(`kid:${kidLook}:${kidColor}:${kidSkin}:${kidHair}:${emo}:${step}:${of.key}:${noArms ? 1 : 0}`, 36, 66, (g) => { g.translate(0, -1); drawKid(g, Object.assign(outfitOpts(emo, of), noArms ? { noArms: true } : {}), step); });
  }
  const TEACHER = (g) => {   // 담임 선생님 (2등신: 머리 크게 · 몸 짧게, 사람 그림과 같은 비율)
    rrect(g, -6.6, 4, 13.2, 11.2, 4.5); fillStroke(g, '#3fae8a', 1.8);                           // 가디건
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-5.4, 5.4, 2.6, 7.5);
    g.beginPath(); g.moveTo(0, 4); g.lineTo(0, 15); g.lineWidth = 1.1; g.strokeStyle = '#2b7d62'; g.stroke();
    rrect(g, -5.6, 9, 8.4, 5.6, 1.4); fillStroke(g, '#f2d06b', 1.4);                             // 책
    g.save(); g.translate(0, -8); g.scale(1.3, 1.3); g.translate(0, 6);
    for (const sx of [-1, 1]) { circle(g, sx * 7.9, -5.2, 1.5); fillStroke(g, '#ffd9b8', 1.1); }
    circle(g, 0, -6, 8); fillStroke(g, '#ffd9b8', 1.6);
    circle(g, 0, -15.5, 3.8); fillStroke(g, '#4a3030', 1.5);                                      // 올림머리
    g.beginPath(); g.arc(0, -6.8, 8.1, Math.PI * 1.0, Math.PI * 2.0); g.quadraticCurveTo(2, -9, -8.1, -6.2); g.closePath(); fillStroke(g, '#4a3030', 1.5);
    g.strokeStyle = 'rgba(255,240,220,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(-1, -8.5, 5.4, Math.PI * 1.15, Math.PI * 1.5); g.stroke();
    g.lineWidth = 1.1; g.strokeStyle = OL; circle(g, -2.9, -4.5, 2.4); g.stroke(); circle(g, 2.9, -4.5, 2.4); g.stroke();   // 안경 (눈·입은 실시간)
    g.restore();
  };


  /* ---------- 배경 (월드별) ---------- */
  const BG = {};        // worldId -> (g, W, H) 그리기 함수 (art-worlds.js가 채움)
  const HELPER = {};    // worldId -> (g) 도우미 그리기 함수
  const LOOK = { school: { sleeve: '#3fae8a', s: 1, face: { brow: '#4a3030' } } };   // 사람별 소매 색·크기 (art-worlds.js가 채움)

  /* ---------- 팔·다리와 몸짓: 행동을 보고 어떤 도움이 필요한지/주고받는지 알 수 있게 ---------- */
  const SKIN = '#ffd9b8', PANTS = '#454a63';
  function limb(g, x0, y0, x1, y1, col, w) {
    g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
    g.strokeStyle = OL; g.lineWidth = w + 2; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  }
  function palm(g, x, y, r, skin) { circle(g, x, y, r || 1.9); fillStroke(g, skin || SKIN, 1.1); }
  /** 사람(선생님·도우미·선행 인물) 포즈. 좌표는 사람 그림 기준(어깨 ±6.3,4.5 · 엉덩이 ±3.3,16), 오른쪽(+x)을 바라봄.
   *  돌려주는 값: L/R 손 위치, lf/rf 발 위치, prop(손에 든 소품) */
  function personPose(name, t, ang) {
    const SL = [-6.3, 4.5], SR = [6.3, 4.5];
    const at = (S, a, len) => [S[0] + Math.cos(a) * len, S[1] + Math.sin(a) * len];
    const sw = Math.sin(t * 2.2) * 0.5;
    const P = { L: [-8.6, 13 + sw], R: [8.6, 13 - sw], lf: [-3.6, 20.5], rf: [3.6, 20.5], prop: null };
    switch (name) {
      case 'wave':        // 손을 흔들어 부른다 (이리 와 줘!)
        P.R = at(SR, -0.85 + 0.35 * Math.sin(t * 10), 12.5); break;   // 큰 머리를 가리지 않게 바깥쪽으로
      case 'beckon':      // 손짓으로 부른다 (이리 오렴) – 팔을 앞으로 뻗었다 당겼다
        P.R = at(SR, -0.35, 7.5 + 3.5 * Math.abs(Math.sin(t * 5))); break;
      case 'cower': {     // 무서워서 두 손으로 얼굴을 가리고 무릎을 모은다. 가끔 한 손을 내려 살짝 내다본다
        const peek = Math.sin(t * 1.7) > 0.55;
        P.L = [-3.8, -5.6]; P.R = peek ? [7.5, 8] : [3.8, -5.6];
        P.lf = [-1.8, 20.5]; P.rf = [1.8, 20.5]; break;
      }
      case 'carry': {     // 무거운 짐을 양손에 들고 힘겨워한다 (팔이 아래로 축 처짐)
        const k = Math.sin(t * 3) * 0.8;
        P.L = [-8.2, 17.5 + k]; P.R = [8.2, 17.5 - k]; P.prop = 'bags';
        P.lf = [-4.6, 20.5]; P.rf = [4.6, 20.5]; break;
      }
      case 'lost':        // 길을 잃음: 한 손으로 머리를 긁적이고 한 손엔 지도
        P.R = [9.6 + Math.sin(t * 14) * 1.2, -14]; P.L = [-9, 8]; P.prop = 'map'; break;
      case 'reach':       // 손을 뻗는다 (ang 방향: 도움을 청하거나 도와준다)
        P.R = at(SR, ang || 0, 11.5); break;
      case 'teach': {     // 가르치기: 한 손엔 펼친 책, 다른 손으로 책을 짚었다가 위로 들어 설명
        const k = (Math.sin(t * 3.2) + 1) / 2;
        P.L = [-7.5, 12]; P.R = [1 + 9 * k, 9 - 17 * k]; P.prop = 'openbook'; break;
      }
      case 'pat':         // 머리를 쓰다듬듯 손을 뻗어 토닥토닥 (선생님이 도와준다)
        P.R = at(SR, (ang || 0) - 0.25 + Math.sin(t * 9) * 0.22, 12); break;
      case 'cheer': {     // 만세! (도움을 받아 기뻐함)
        const k = Math.sin(t * 9) * 1.5;
        P.L = [-11.5, -13 + k]; P.R = [11.5, -13 - k]; break;
      }
      case 'walk': {      // 걷기: 팔다리를 번갈아
        const k = Math.sin(t * 10);
        P.L = [-8 + k * 1.8, 13 + k]; P.R = [8 + k * 1.8, 13 - k];
        P.lf = [-3.6 + k * 2.2, 20.5 - Math.max(0, k) * 1.2]; P.rf = [3.6 - k * 2.2, 20.5 - Math.max(0, -k) * 1.2]; break;
      }
      case 'walkHold': {  // 걸으면서 한 손은 나를 향해 (손잡고 함께 가기)
        const k = Math.sin(t * 10);
        P.L = [-8 + k * 1.8, 13 + k]; P.R = at(SR, ang || 0, 11.5);
        P.lf = [-3.6 + k * 2.2, 20.5 - Math.max(0, k) * 1.2]; P.rf = [3.6 - k * 2.2, 20.5 - Math.max(0, -k) * 1.2]; break;
      }
      case 'hurt':        // 맞아서 머리를 감싼다
        P.L = [-10.4, -8]; P.R = [10.4, -8]; P.lf = [-2.5, 20.5]; P.rf = [2.5, 20.5]; break;
      case 'give':        // 두 손으로 선물을 내민다
        P.L = [6, 10]; P.R = [11, 9]; P.prop = 'gift'; break;
      case 'throw': {     // 하트를 던지며 응원
        const k = (t * 1.6) % 1;
        P.R = at(SR, -2.4 + k * 2.6, 11); P.L = [-11.5, -12 + Math.sin(t * 9)]; break;
      }
      default: break;     // idle
    }
    return P;
  }
  function drawPersonProp(g, P, t) {
    if (P.prop === 'bags') {          // 양손의 무거운 장바구니
      for (const h of [P.L, P.R]) { rrect(g, h[0] - 3.4, h[1] + 0.5, 6.8, 6.5, 1.5); fillStroke(g, '#8d6e63', 1.3); g.fillStyle = '#a5d6a7'; g.fillRect(h[0] - 2.4, h[1] + 0.2, 2, 1.6); }
    } else if (P.prop === 'map') {    // 펼친 지도 (물음표)
      const h = P.L; rrect(g, h[0] - 4, h[1] - 3.5, 7, 6, 0.8); fillStroke(g, '#fff3c4', 1.1);
      g.fillStyle = '#e57373'; g.font = 'bold 5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', h[0] - 0.5, h[1] - 0.4);
    } else if (P.prop === 'openbook') {   // 펼친 책 (몸에 그려진 책을 가리며 앞으로 펼쳐 듦)
      rrect(g, -7.6, 6.2, 12.4, 8.4, 1.2); fillStroke(g, '#fffdf2', 1.2); line(g, [-1.4, 6.4, -1.4, 14.4], 0.9);
      g.fillStyle = '#9fb4d8'; for (const y of [8.4, 10.4, 12.4]) { g.fillRect(-6.4, y, 4, 0.7); g.fillRect(-0.2, y, 4, 0.7); }
    } else if (P.prop === 'teach') {  // 다른 손엔 펼친 책 (가르쳐 줌)
      const h = P.L; rrect(g, h[0] - 4.5, h[1] - 4, 9, 6, 1); fillStroke(g, '#fffde7', 1.1); line(g, [h[0], h[1] - 4, h[0], h[1] + 2], 0.8);
    }
  }
  /** 사람 몸짓 그리기: 다리(몸 뒤) → 몸 그림 → 팔·손·소품(몸 앞). 화면 좌표 손 위치를 돌려준다 */
  /* ---------- 사람 표정 (실시간): 하는 일에 따라 표정이 바뀌고, 가끔 눈을 깜빡인다. 좌표는 사람 그림 기준 (머리 0,-6 · 눈 ±2.9,-4.4) ---------- */
  function personExpr(pose, sad) {
    switch (pose && pose.name) {
      case 'cheer': return 'joy';
      case 'wave': case 'beckon': return sad ? 'worried' : 'open';
      case 'teach': return 'talk';
      case 'pat': return 'warm';
      case 'reach': return sad ? 'worried' : 'warm';
      case 'cower': return 'scared';
      case 'lost': case 'carry': return 'worried';
      default: return sad ? 'worried' : 'smile';
    }
  }
  function personFace(ctx, expr, t, f, seed) {
    f = f || {};
    const blink = expr !== 'joy' && expr !== 'warm' && expr !== 'scared' && ((t + seed) % 3.6) < 0.13;
    const ex = 2.9, ey = -4.4;
    ctx.lineCap = 'round'; ctx.strokeStyle = OL;
    // 눈
    for (const sx of [-1, 1]) {
      const x = sx * ex;
      if (expr === 'joy' || expr === 'warm') { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, ey + 0.6, 1.35, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }   // ^^ 웃는 눈
      else if (expr === 'scared') { ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x - sx * 1.3, ey - 1); ctx.lineTo(x + sx * 0.9, ey); ctx.lineTo(x - sx * 1.3, ey + 1); ctx.stroke(); }   // >< 질끈
      else if (blink) { ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x - 1.2, ey); ctx.quadraticCurveTo(x, ey + 0.7, x + 1.2, ey); ctx.stroke(); }
      else { oval(ctx, x, ey, 1.15, 1.5); ctx.fillStyle = '#2b1d14'; ctx.fill(); circle(ctx, x + 0.4, ey - 0.55, 0.45); ctx.fillStyle = '#fff'; ctx.fill(); }
    }
    // 눈썹: 걱정·무서움이면 안쪽이 올라감
    ctx.strokeStyle = f.brow || '#3b2b25'; ctx.lineWidth = 0.9;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      if (expr === 'worried' || expr === 'scared') { ctx.moveTo(sx * 4.3, ey - 1.9); ctx.lineTo(sx * 1.6, ey - 2.9); }
      else { ctx.moveTo(sx * 4.2, ey - 2.4); ctx.quadraticCurveTo(sx * 2.9, ey - 3.1, sx * 1.6, ey - 2.5); }
      ctx.stroke();
    }
    // 볼
    oval(ctx, -5, -2, 1.3, 0.8); ctx.fillStyle = expr === 'joy' ? 'rgba(255,100,110,.6)' : 'rgba(255,120,120,.45)'; ctx.fill(); oval(ctx, 5, -2, 1.3, 0.8); ctx.fill();
    // 입
    const my = -1.5; ctx.strokeStyle = OL; ctx.lineWidth = 1.1;
    if (f.beard && expr !== 'joy' && expr !== 'talk') { ctx.beginPath(); ctx.arc(0, my - 0.4, 1.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = '#fff3e0'; ctx.stroke(); return; }
    if (expr === 'joy') { ctx.beginPath(); ctx.moveTo(-2.1, my - 0.6); ctx.quadraticCurveTo(0, my + 3.4, 2.1, my - 0.6); ctx.closePath(); fillStroke(ctx, '#c8403e', 1); oval(ctx, 0, my + 1.4, 1, 0.6); ctx.fillStyle = '#ff9a9a'; ctx.fill(); }
    else if (expr === 'open') { ctx.beginPath(); ctx.moveTo(-1.6, my - 0.3); ctx.quadraticCurveTo(0, my + 2.2, 1.6, my - 0.3); ctx.closePath(); fillStroke(ctx, '#c8403e', 1); }
    else if (expr === 'talk') { const k = (Math.sin(t * 13) + 1) / 2; oval(ctx, 0, my + 0.4, 1.2, 0.35 + k * 1.1); fillStroke(ctx, '#c8403e', 1); }
    else if (expr === 'worried') { ctx.beginPath(); ctx.moveTo(-1.6, my + 0.8); ctx.quadraticCurveTo(-0.8, my + 0.1, 0, my + 0.7); ctx.quadraticCurveTo(0.8, my + 1.3, 1.6, my + 0.6); ctx.stroke();
      const k = (t * 0.9 + seed) % 1; ctx.save(); ctx.globalAlpha *= 1 - k; ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); const sx = 6.2, sy = -8 + k * 3; ctx.moveTo(sx, sy - 1.6); ctx.quadraticCurveTo(sx + 1.2, sy + 0.4, sx, sy + 0.8); ctx.quadraticCurveTo(sx - 1.2, sy + 0.4, sx, sy - 1.6); ctx.fill(); ctx.restore(); }   // 식은땀
    else if (expr === 'scared') { ctx.beginPath(); ctx.moveTo(-1.6, my + 0.6); for (let i = 1; i <= 4; i++) ctx.lineTo(-1.6 + i * 0.8, my + (i % 2 ? 0 : 0.6)); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, my - 0.2, 1.8, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); }   // 미소
  }
  const seedOf = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h / 97; };
  function drawPersonPosed(ctx, c, look, x, y, pose, t) {
    const s = look.s || 1, dir = pose.dir < 0 ? -1 : 1;
    const P = personPose(pose.name, t, pose.ang);
    const enter = () => { ctx.save(); ctx.translate(x, y); ctx.scale(K_KID * dir, K_KID); ctx.translate(0, 2 + 17 * (1 - s)); ctx.scale(s, s); };
    enter();
    limb(ctx, -3.3, 15, P.lf[0], P.lf[1] - 1, PANTS, 3.2); limb(ctx, 3.3, 15, P.rf[0], P.rf[1] - 1, PANTS, 3.2);
    oval(ctx, P.lf[0] - 0.6, P.lf[1], 2.6, 1.6); fillStroke(ctx, '#2a2440', 1.2); oval(ctx, P.rf[0] + 0.6, P.rf[1], 2.6, 1.6); fillStroke(ctx, '#2a2440', 1.2);
    ctx.restore();
    blit(ctx, c, x, y, K_KID, K_KID, dir < 0);
    enter(); ctx.translate(0, -8); ctx.scale(1.3, 1.3); ctx.translate(0, 6); personFace(ctx, personExpr(pose, look.sad || pose.sad), t, look.face, look.seed || 0); ctx.restore();   // 실시간 표정 (팔보다 먼저: 무서워 얼굴을 가리면 손이 위에)
    enter();
    limb(ctx, -6.3, 4.5, P.L[0], P.L[1], look.sleeve, 3); limb(ctx, 6.3, 4.5, P.R[0], P.R[1], look.sleeve, 3);
    if (P.prop === 'bags' || P.prop === 'gift') drawPersonProp(ctx, P, t);
    palm(ctx, P.L[0], P.L[1]); palm(ctx, P.R[0], P.R[1]);
    if (P.prop === 'openbook') { drawPersonProp(ctx, P, t); palm(ctx, P.L[0], P.L[1]); }   // 책을 든 손은 책 위에
    if (P.prop === 'map' || P.prop === 'teach') drawPersonProp(ctx, P, t);
    ctx.restore();
    const toScreen = (q) => [x + dir * K_KID * s * q[0], y + K_KID * (2 + 17 * (1 - s) + s * q[1])];
    return { L: toScreen(P.L), R: toScreen(P.R), feetY: y + K_KID * (2 + 17 * (1 - s) + s * 21.5) };
  }
  function vignette(g, W, H) {
    const vg = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,6,16,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function background(W, H, worldId) {
    if (worldId && BG[worldId]) {   // art-bg.js 의 사실적인 배경 (학교 포함). 없으면 아래 기본 학교 배경
      return sprite(`bg:${worldId}:${W}x${H}`, W, H, (g) => { g.translate(-W / 2, -H / 2); BG[worldId](g, W, H); vignette(g, W, H); });
    }
    return sprite(`bg:school:${W}x${H}`, W, H, (g) => {
      g.translate(-W / 2, -H / 2);
      g.fillStyle = '#1f2539'; g.fillRect(0, 0, W, H);
      // 마룻바닥 판자
      for (let y = 0, row = 0; y < H; y += 26, row++) {
        g.fillStyle = row % 2 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, 26);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 1);
        for (let x = (row % 3) * 47; x < W; x += 140) { g.fillRect(x, y, 1, 26); }
      }
      // 칠판
      g.fillStyle = '#4d3b2c'; g.fillRect(30, 54, W - 60, 32);
      g.fillStyle = '#1f3d31'; g.fillRect(34, 57, W - 68, 26);
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(52, 66); g.quadraticCurveTo(70, 60, 90, 68); g.moveTo(54, 74); g.lineTo(110, 72); g.moveTo(W - 120, 64); g.lineTo(W - 70, 66); g.moveTo(W - 110, 73); g.quadraticCurveTo(W - 90, 78, W - 64, 72); g.stroke();
      // 책상과 의자 (낮은 대비)
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
        const x = 60 + c * 120, y = 132 + r * 66;
        g.fillStyle = 'rgba(0,0,0,.22)'; rrect(g, x - 27, y - 11, 56, 26, 5); g.fill();
        g.fillStyle = '#2b3352'; rrect(g, x - 28, y - 14, 56, 24, 5); g.fill();
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x - 25, y - 12, 50, 4);
        g.fillStyle = '#262d48'; rrect(g, x - 11, y + 14, 22, 11, 4); g.fill();
      }
      // 창문으로 들어오는 노을빛
      g.fillStyle = 'rgba(255,214,150,.045)';
      for (let i = 0; i < 4; i++) { const x0 = -40 + i * 95; g.beginPath(); g.moveTo(x0, 90); g.lineTo(x0 + 50, 90); g.lineTo(x0 + 230, H); g.lineTo(x0 + 140, H); g.closePath(); g.fill(); }
      // 가장자리 어둡게
      const vg = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,6,16,.55)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    });
  }

  /* ---------- 위험물 (오른쪽을 보는 모습으로 그림, 왼쪽으로 가면 뒤집음) ---------- */
  const HAZARD = {
    train(g) {
      rrect(g, -80, -22, 160, 40, 12); fillStroke(g, '#d9e2ea', 2.4);                   // 차체
      g.beginPath(); g.moveTo(52, -22); g.quadraticCurveTo(82, -20, 82, 4); g.lineTo(82, 18); g.lineTo(52, 18); g.closePath(); fillStroke(g, '#26a69a', 2.4);   // 앞부분
      rrect(g, 58, -16, 18, 13, 4); fillStroke(g, '#bdeefc', 1.6);                      // 앞 유리
      circle(g, 74, 8, 3.2); fillStroke(g, '#fff59d', 1.4);                               // 전조등
      for (let i = 0; i < 4; i++) { rrect(g, -70 + i * 30, -15, 20, 13, 3); fillStroke(g, '#2c3e50', 1.4); g.fillStyle = 'rgba(160,230,255,.35)'; g.fillRect(-68 + i * 30, -13, 7, 9); }
      g.fillStyle = '#e53950'; g.fillRect(-79, 3, 131, 6); g.fillStyle = '#26a69a'; g.fillRect(-79, 9, 131, 3);
      for (const x of [-60, -30, 20, 50]) { circle(g, x, 20, 5); fillStroke(g, '#37474f', 1.6); }
    },
    cart(g) {
      line(g, [-70, -6, -78, -24], 3, '#6d4c41'); line(g, [-78, -24, -70, -24], 3, '#6d4c41');   // 손잡이
      rrect(g, -70, 2, 145, 10, 3); fillStroke(g, '#78909c', 2);                                  // 짐칸
      const bags = [[-62, -22, 34, 24, '#ef5350'], [-24, -30, 30, 32, '#42a5f5'], [10, -18, 36, 20, '#ffca28'], [10, -34, 26, 16, '#ab47bc'], [50, -24, 24, 26, '#66bb6a']];
      for (const [x, y, w, h, col] of bags) { rrect(g, x, y, w, h, 4); fillStroke(g, col, 1.8); rrect(g, x + w / 2 - 5, y - 4, 10, 5, 2); g.lineWidth = 1.4; g.strokeStyle = OL; g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 3, y + 3, 3, h - 6); }
      for (const x of [-55, 60]) { circle(g, x, 17, 6); fillStroke(g, '#37474f', 1.8); circle(g, x, 17, 2); g.fillStyle = '#cfd8dc'; g.fill(); }
    },
    light(g) {
      rrect(g, -80, -26, 160, 10, 3); fillStroke(g, '#546e7a', 2);                                // 트러스
      g.strokeStyle = '#37474f'; g.lineWidth = 1.4; g.beginPath(); for (let x = -76; x < 76; x += 12) { g.moveTo(x, -25); g.lineTo(x + 6, -17); g.lineTo(x + 12, -25); } g.stroke();
      for (const [x, col] of [[-55, '#ff80ab'], [-15, '#fff59d'], [25, '#80deea'], [62, '#b388ff']]) {
        g.globalAlpha = 0.28; g.fillStyle = col; g.beginPath(); g.moveTo(x - 6, -6); g.lineTo(x + 6, -6); g.lineTo(x + 20, 24); g.lineTo(x - 20, 24); g.closePath(); g.fill(); g.globalAlpha = 1;   // 빛줄기
        line(g, [x, -16, x, -12], 2);
        rrect(g, x - 9, -13, 18, 12, 4); fillStroke(g, '#263238', 1.8); circle(g, x, -3, 5); fillStroke(g, col, 1.4);
      }
    },
  };
  function line(g, pts, lw, col) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = lw; g.strokeStyle = col || OL; g.stroke(); }

  /* ---------- 회복 아이템 ---------- */
  const DROP = {
    coffee(g) {
      for (const x of [-3, 2]) { g.beginPath(); g.moveTo(x, -6); g.quadraticCurveTo(x + 3, -9, x, -12); g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); }
      g.beginPath(); g.arc(7, 1, 3.5, -Math.PI / 2, Math.PI / 2); g.lineWidth = 2.2; g.strokeStyle = OL; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
      g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -5); g.lineTo(5.5, 7); g.quadraticCurveTo(0, 9, -5.5, 7); g.closePath(); fillStroke(g, '#ffffff', 1.8);
      g.fillStyle = '#8d5a3c'; g.fillRect(-6.3, -4.2, 12.6, 3);
      g.fillStyle = '#ff7a59'; g.fillRect(-6, 0, 11.6, 3);
    },
    choco(g) {
      g.save(); g.rotate(-0.25);
      rrect(g, -8, -6, 16, 12, 2); fillStroke(g, '#6d3b22', 1.8);
      g.strokeStyle = '#4e2715'; g.lineWidth = 1; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.moveTo(-2.7, -6); g.lineTo(-2.7, 6); g.moveTo(2.7, -6); g.lineTo(2.7, 6); g.stroke();
      g.beginPath(); g.moveTo(-8, 1); g.lineTo(8, 4); g.lineTo(8, 6); g.lineTo(-8, 6); g.closePath(); fillStroke(g, '#e53935', 1.6);   // 포장지
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-6.5, -4.5, 3, 2);
      g.restore();
    },
    pill(g) {
      g.save(); g.rotate(-0.6);
      rrect(g, -9, -4.5, 18, 9, 4.5); fillStroke(g, '#ffffff', 1.8);
      g.save(); rrect(g, -9, -4.5, 18, 9, 4.5); g.clip(); g.fillStyle = '#26c6da'; g.fillRect(0, -5, 10, 10); g.restore();
      rrect(g, -9, -4.5, 18, 9, 4.5); g.lineWidth = 1.8; g.strokeStyle = OL; g.stroke();
      line(g, [0, -4.5, 0, 4.5], 1.2);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-6, -2.8, 4, 1.4);
      g.restore();
    },
  };

  /* ---------- 파편 (처치 연출) ---------- */
  let parts = [];
  function burst(x, y, color, n, big) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (big ? 2.2 : 1.4) + Math.random() * (big ? 3 : 2);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, t: 22 + Math.random() * 10, r: (big ? 3.2 : 2.2) + Math.random() * 1.6, c: Math.random() < 0.25 ? '#ffffff' : color, rot: Math.random() * 6 });
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  }

  /* ---------- 공개 API ---------- */
  const phase = new WeakMap();
  function ph(o) { let v = phase.get(o); if (v === undefined) { v = Math.random() * 6.28; phase.set(o, v); } return v; }

  const Art = {
    /** 이 월드에 새 그림체가 있는가 (시안: 학교만) */
    supports(world) { return !!world && (world.id === 'school' || !!BG[world.id]); },
    hasEnemy(e) { return e.type === 'boss' ? !!BOSS[e.name] || !!BOSS[e.def && e.def.name] : !!ENEMY[e.type]; },
    enemyColor(type, name) { return type === 'boss' ? ((BOSS[name] || {}).color || '#ffffff') : ((ENEMY[type] || {}).color || '#ffffff'); },

    drawBackground(ctx, W, H, worldId) { blit(ctx, background(W, H, worldId), W / 2, H / 2); },

    drawGem(ctx, g, now) {
      const bob = Math.sin(now / 220 + g.x * 0.1) * 1.2;
      const c = sprite('gem', 12, 14, (q) => {
        q.beginPath(); q.moveTo(0, -5.5); q.lineTo(4.4, -1); q.lineTo(0, 5.5); q.lineTo(-4.4, -1); q.closePath();
        q.fillStyle = '#5ff2a8'; q.fill(); q.lineWidth = 1.3; q.strokeStyle = '#17553c'; q.stroke();
        q.beginPath(); q.moveTo(0, -5.5); q.lineTo(4.4, -1); q.lineTo(0, 0.6); q.lineTo(-4.4, -1); q.closePath(); q.fillStyle = '#c9ffe5'; q.fill();
        circle(q, -1.4, -2.2, 0.8); q.fillStyle = '#fff'; q.fill();
      });
      blit(ctx, c, g.x, g.y + bob);
    },

    /** 발밑 표시: 적은 붉은 고리 (에코는 머리 위 회색 고리) */
    groundMark(ctx, x, y, r, color, alpha) {
      const a0 = ctx.globalAlpha;   // 사라지는 중이면 그 흐림을 그대로 이어받음
      ctx.globalAlpha = a0 * alpha; ctx.strokeStyle = color; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = a0;
    },
    shadow(ctx, x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill(); },

    drawEnemy(ctx, e, now, px) {
      const boss = e.type === 'boss';
      const spec = boss ? (BOSS[e.name] || BOSS[e.def && e.def.name]) : ENEMY[e.type];
      const r = e.r;
      const base = sprite(`en:${boss ? e.def.name : e.type}:${r}`, r * spec.w, r * spec.h, (g) => spec.draw(g, r));
      const t = now / 1000 * (boss ? 3 : 7) + ph(e);
      const hop = Math.abs(Math.sin(t)) * (boss ? 2 : 1.6);
      let sx = 1 + Math.sin(t * 2) * 0.04, sy = 1 - Math.sin(t * 2) * 0.04;
      if (e.flash > 0) { sx *= 1.14; sy *= 0.86; }                  // 맞으면 찌그러짐
      if (e.warn) { sx *= 1 + Math.sin(now / 30) * 0.06; }          // 돌진 직전 부르르
      const k = boss ? 1.1 : K_EN, fy = e.y + r * 0.95 * k;
      this.shadow(ctx, e.x, fy, r * 0.85 * k);
      const flip = !spec.noFlip && e.x > px;   // 주인공 쪽을 바라봄 (글자가 있는 그림은 뒤집지 않음)
      // 빨간 테두리: 모양을 따라 빨간 윤곽을 둘러 회색·반투명한 에코와 한눈에 구분 (밝은 배경·어두운 배경 모두)
      const rim = tinted(`enR:${boss ? e.def.name : e.type}:${r}`, base, '#ff2f55'), d = boss ? 2.2 : 1.6;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; blit(ctx, rim, e.x + Math.cos(a) * d, e.y - hop + Math.sin(a) * d, sx * k, sy * k, flip); }
      blit(ctx, base, e.x, e.y - hop, sx * k, sy * k, flip);
      if (e.flash > 0) { ctx.globalAlpha = 0.7; blit(ctx, tinted(`enW:${boss ? e.def.name : e.type}:${r}`, base, '#ffffff'), e.x, e.y - hop, sx * k, sy * k, flip); ctx.globalAlpha = 1; }
      if (boss && base.face) {   // 왕의 실시간 표정
        const hpR = e.maxhp ? e.hp / e.maxhp : 1;
        const mode = e.flash > 0 ? 'hurt' : e.warn ? 'charge' : hpR < 0.34 ? 'rage' : 'menace';
        const look = Math.max(-1, Math.min(1, (px - e.x) / 80)) * (flip ? -1 : 1);
        ctx.save(); ctx.translate(e.x, e.y - hop); ctx.scale((flip ? -1 : 1) * sx * k, sy * k);
        bossFace(ctx, base.face, mode, now / 1000, look, ph(e)); ctx.restore();
      }
    },

    /** 주인공. act(선택): {pose:'pick', k:0~1} 줍기 · {pose:'reach', tx, ty} 돕기(손 내밀기) · {pose:'learn'} 손 들고 배우기.
     *  오른손의 화면 위치를 돌려준다 (주운 물건을 손에 들려 그릴 때) */
    drawPlayer(ctx, p, emo, moving, dir, now, blink, act) {
      const pose = act && act.pose;
      if (pose === 'reach' || pose === 'learn') { if (Math.abs(act.tx - p.x) > 3) dir = act.tx < p.x ? -1 : 1; }   // 돕는 사람 쪽을 바라봄
      const step = moving && pose !== 'pick' ? (Math.floor(now / 110) % 2 ? 1 : -1) : 0;
      const bob = moving ? Math.abs(Math.sin(now / 110 * Math.PI / 2)) * 1.6 : Math.sin(now / 500) * 0.5;
      this.shadow(ctx, p.x, p.y + 13 * K_KID, 8 * K_KID);
      if (blink) ctx.globalAlpha = 0.4;
      // 줍기: 무릎을 굽혀 몸을 낮췄다가 일어선다 (발 위치는 그대로)
      const crouch = pose === 'pick' ? Math.sin(Math.min(1, act.k) * Math.PI) : 0;
      const sy = K_KID * (1 - 0.2 * crouch), feet = p.y - 4 - bob + 13 * K_KID;
      const cheerHop = pose === 'cheer' ? Math.abs(Math.sin(now / 150)) * 4 : 0, nod = pose === 'learn' ? Math.abs(Math.sin(now / 260)) * 1.2 : 0;
      const cy = feet - 13 * sy - cheerHop + nod;
      blit(ctx, kidSprite(emo, step, null, true), p.x, cy, K_KID, sy, dir < 0);
      // 팔 (몸 앞)
      const f = dir < 0 ? -1 : 1, sleeve = outfitOpts(emo, outfit).body, t = now / 1000;
      const sw = moving ? Math.sin(now / 110 * Math.PI / 2) * 1.6 : Math.sin(t * 2) * 0.3;
      let L = [-7.4, 9.2 - sw], R = [7.4, 9.2 + sw];
      if (pose === 'pick') {
        const k = act.k;
        R = k < 0.45 ? [6.5 + k * 4, 9 + k * 12] : [8.5 - (k - 0.45) * 4, 14.4 - (k - 0.45) * 40];   // 손을 바닥까지 뻗어 집고 → 번쩍 들어 올림
        L = [-6.5, 10];
      } else if (pose === 'reach') {
        const a = Math.atan2(act.ty - p.y, Math.abs(act.tx - p.x) || 1);
        const ca = Math.max(-1.1, Math.min(1.1, a));
        R = [5.4 + Math.cos(ca) * 10, 2.6 + Math.sin(ca) * 10];          // 그 사람 쪽으로 손을 내민다
      } else if (pose === 'learn') {                                       // 배우는 중: 공책을 들고 고개를 끄덕이며 받아 적기
        L = [-3.8, 8.6]; R = [1.2 + Math.sin(t * 14) * 1.3, 7.4 + Math.abs(Math.sin(t * 7)) * 1.2];
      } else if (pose === 'cheer') {                                       // 만세!
        const k = Math.sin(t * 10) * 1.4; L = [-8, -9.5 + k]; R = [8, -9.5 - k];
      }
      ctx.save(); ctx.translate(p.x, cy); ctx.scale(K_KID * f, sy); ctx.translate(0, -1);
      limb(ctx, -5.4, 2.6, L[0], L[1], sleeve, 2.8); limb(ctx, 5.4, 2.6, R[0], R[1], sleeve, 2.8);
      if (pose === 'learn') {   // 작은 공책 + 연필
        rrect(ctx, -5.6, 5.2, 7.4, 6.4, 1); fillStroke(ctx, '#fffdf2', 1.1);
        ctx.fillStyle = '#9fb4d8'; for (const y of [7.2, 9.2]) ctx.fillRect(-4.6, y, 5.4, 0.6);
        line(ctx, [R[0], R[1], R[0] + 2.2, R[1] - 4.2], 1.6, '#f4b400');
      }
      palm(ctx, L[0], L[1], 1.8, kidSkin); palm(ctx, R[0], R[1], 1.8, kidSkin);
      ctx.restore();
      ctx.globalAlpha = 1;
      return [p.x + f * K_KID * R[0], cy + sy * (R[1] - 1)];
    },

    /** 에코 = 과거의 나: 주인공과 같은 모습의 반투명 회색 유령 (옷·머리·얼굴 색과 상관없이 모두 같은 회색 톤) */
    drawEcho(ctx, ec, emo, now, alpha) {
      const base = kidSprite(emo, 0);
      const ghost = tinted(`ghost:${kidLook}:${kidColor}:${kidSkin}:${kidHair}:${emo}:${outfit.key}`, base, ECHO_GRAY, 0.82);
      const bob = Math.sin(now / 400 + ec.id) * 1.5;
      ctx.globalAlpha = alpha * 1.25;
      const dir = ec._lx !== undefined && ec.x < ec._lx ? -1 : 1; ec._lx = ec.x;
      blit(ctx, ghost, ec.x, ec.y - 4 + bob, K_KID, K_KID, dir < 0);
      // 영혼의 고리: 발밑 대신 머리 위에 떠 있는 회색 고리 (살짝 빛나며 머리보다 조금 더 출렁임)
      const hy = ec.y - 4 + bob - 17.5 * K_KID + Math.sin(now / 300 + ec.id) * 0.8, hr = 6.2 * K_KID;
      ctx.globalAlpha = Math.min(1, alpha * 0.9); ctx.strokeStyle = ECHO_RING; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.ellipse(ec.x, hy, hr, hr * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = Math.min(1, alpha * 2.6); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(ec.x, hy, hr, hr * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /** 회차를 알려 주면 그 회차의 복장으로 주인공·에코를 그린다 */
    /** 주인공 모습(남자 'boy' / 여자 'girl') */
    setLook(look) { kidLook = look === 'girl' ? 'girl' : 'boy'; return kidLook; },
    /** 옷 색 (#hex, null이면 복장 원래 색) */
    /** 얼굴(피부) 색 (#hex, null이면 기본) */
    /** 머리 색 (#hex, null이면 기본) */
    setHair(hex) { kidHair = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null; return kidHair; },
    setSkin(hex) { kidSkin = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null; return kidSkin; },
    setColor(hex) { kidColor = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null; return kidColor; },
    setOutfit(cycle) { const W = root.EchoWorlds; outfit = W && W.outfitOf ? W.outfitOf(cycle) : outfit; return outfit; },
    /** 메뉴 미리보기 등: 원하는 회차 복장으로 주인공을 그린다 */
    drawKidPreview(ctx, x, y, emo, cycle, scale) {
      const W = root.EchoWorlds, of = W.outfitOf(cycle);
      blit(ctx, kidSprite(emo, 0, of), x, y, scale || 2, scale || 2);
    },
    /** 선행 소품 그림: cup·pot·teddy·heart·heartPink·gift·flag (size = 화면 크기 px) */
    drawDeed(ctx, kind, x, y, size) {
      const fn = DEED_ART[kind]; if (!fn) return;
      const c = sprite('deed:' + kind, 28, 28, fn);
      const k = (size || 18) / 24; blit(ctx, c, x, y, k, k);
    },
    /** 부정적인 마음 위험 요소 그림이 있는지 / 그리기 (size: 화면 크기 px, spin: 굴러가는 각도) */
    hasGloom(key) { return !!GLOOM[key]; },
    drawGloom(ctx, key, x, y, size, spin) {
      const fn = GLOOM[key]; if (!fn) return false;
      const c = sprite('gloom:' + key, 44, 44, fn), k = (size || 30) / 40;
      if (spin) { ctx.save(); ctx.translate(x, y); ctx.rotate(spin); blit(ctx, c, 0, 0, k, k); ctx.restore(); } else blit(ctx, c, x, y, k, k);
      return true;
    },
    /** 월드 엠블럼 그림 (메뉴용) */
    drawWorld(ctx, id, x, y, size) {
      const fn = WORLD_ART[id]; if (!fn) return false;
      const c = sprite('world:' + id, 28, 28, fn);
      const k = (size || 18) / 24; blit(ctx, c, x, y, k, k); return true;
    },
    drawTeacher(ctx, x, y) { this.drawHelper(ctx, 'school', x, y); },
    /** 팔다리와 몸짓이 있는 사람: id = 월드 id(도우미) 또는 'npc:child|elder|friend'.
     *  pose = {name:'idle|wave|beckon|cower|carry|lost|reach|pat|cheer|walk|walkHold|hurt|give|throw', dir:±1, ang} */
    drawPerson(ctx, id, x, y, pose, now) {
      const key = HELPER[id] ? id : 'school', fn = HELPER[id] || TEACHER;
      const c = sprite('helper:' + key, 34, 60, (g) => { g.translate(0, 2); fn(g); });
      const look0 = LOOK[key] || LOOK.school, look = look0.seed === undefined ? Object.assign(look0, { seed: seedOf(key) }) : look0, s = look.s || 1;
      this.shadow(ctx, x, y + K_KID * (2 + 17 * (1 - s) + s * 21), 9 * K_KID * s);
      return drawPersonPosed(ctx, c, look, x, y, pose || { name: 'idle' }, (now || performance.now()) / 1000);
    },
    drawHelper(ctx, worldId, x, y) {
      const fn = HELPER[worldId] || TEACHER;
      const c = sprite('helper:' + (HELPER[worldId] ? worldId : 'school'), 34, 60, (g) => { g.translate(0, 2); fn(g); });
      this.shadow(ctx, x, y + 19 * K_KID, 9 * K_KID);
      blit(ctx, c, x, y, K_KID, K_KID);
      const look = LOOK[HELPER[worldId] ? worldId : 'school'] || LOOK.school, s = look.s || 1;   // 멈춘 그림: 웃는 얼굴 (도움이 필요하면 걱정 얼굴)
      ctx.save(); ctx.translate(x, y); ctx.scale(K_KID, K_KID); ctx.translate(0, 2 + 17 * (1 - s)); ctx.scale(s, s); ctx.translate(0, -8); ctx.scale(1.3, 1.3); ctx.translate(0, 6); personFace(ctx, look.sad ? 'worried' : 'smile', 0.5, look.face, 0); ctx.restore();
    },

    drawBullet(ctx, b) {
      const echo = b.owner === 'echo';
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.globalAlpha = echo ? 0.35 : 1;
      ctx.fillStyle = echo ? 'rgba(200,205,216,.35)' : 'rgba(255,226,122,.35)';
      ctx.fillRect(-12, -1.6, 10, 3.2);                                     // 꼬리
      ctx.fillStyle = b.crit ? '#ff9f43' : (echo ? '#d4d8e2' : '#ffe27a');
      ctx.beginPath(); ctx.ellipse(0, 0, b.crit ? 5.5 : 4.5, b.crit ? 2.8 : 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = OL; ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    },
    drawEnemyBullet(ctx, b) {
      ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = OL; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
    },

    /** 질주하는 위험물: 🚆 열차(지하철·보스) · 🛒 수하물 카트(공항) · 💡 조명 장치(꿈의 무대). 앞쪽이 진행 방향(dir) */
    drawHazard(ctx, h, kind, now) {
      if (kind !== '🚆' && kind !== '🛒' && kind !== '💡') {   // 부정적인 마음(돌풍·지친 마음·병균·긴장)·파도: 큰 그림 + 속도선
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { const bx = h.x - h.dir * (60 + (now / 8 + i * 17) % 30); ctx.beginPath(); ctx.moveTo(bx, h.y + i * 12); ctx.lineTo(bx - h.dir * 26, h.y + i * 12); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 20, 60, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '40px sans-serif';
        const spin = kind === '😩' ? now / 60 * h.dir : 0;   // 지친 마음은 데굴데굴 굴러옴
        for (let k = -1; k <= 1; k++) {
          const hx = h.x + k * 42, hy = h.y + Math.sin(now / 90 + k) * 2 + (kind === '😨' ? Math.sin(now / 30 + k) * 1.5 : 0);
          if (GLOOM[kind]) { this.drawGloom(ctx, kind, hx, hy, 44, spin); continue; }
          ctx.save(); ctx.translate(hx, hy); if (spin) ctx.rotate(spin); ctx.fillText(kind, 0, 0); ctx.restore();
        }
        return;
      }
      const key = kind === '🛒' ? 'cart' : kind === '💡' ? 'light' : 'train';
      const c = sprite('hz:' + key, 168, 56, (g) => HAZARD[key](g));
      const shake = Math.sin(now / 25) * 0.8;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 22, 76, 7, 0, 0, Math.PI * 2); ctx.fill();
      // 속도감: 뒤쪽 바람 줄
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { const bx = h.x - h.dir * (90 + (now / 8 + i * 17) % 30); ctx.beginPath(); ctx.moveTo(bx, h.y + i * 11); ctx.lineTo(bx - h.dir * 22, h.y + i * 11); ctx.stroke(); }
      blit(ctx, c, h.x, h.y + shake, 1, 1, h.dir < 0);
    },
    /** 회복 아이템: ☕ 커피 · 🍫 초콜릿 · 💊 비타민 (살짝 둥실거리며 반짝) */
    drawDrop(ctx, g, kind, now) {
      const key = kind === '🍫' ? 'choco' : kind === '💊' ? 'pill' : 'coffee';
      const c = sprite('drop:' + key, 22, 24, (q) => DROP[key](q));
      const bob = Math.sin(now / 260 + g.x * 0.1) * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 8, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(now / 200 + g.y); ctx.fillStyle = '#fff4b0';
      ctx.beginPath(); ctx.arc(g.x, g.y - 1 + bob, 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;   // 은은한 빛
      blit(ctx, c, g.x, g.y - 1 + bob, 0.95, 0.95);
    },
    burst,
    drawParticles(ctx) {
      for (const q of parts) {
        q.x += q.vx; q.y += q.vy; q.vx *= 0.92; q.vy = q.vy * 0.92 + 0.08; q.t -= 1; q.rot += 0.2;
        ctx.globalAlpha = Math.min(1, q.t / 12);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.c; ctx.fillRect(-q.r / 2, -q.r / 2, q.r, q.r);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      parts = parts.filter((q) => q.t > 0);
    },
    clearParticles() { parts = []; },
    // art-worlds.js가 나머지 월드의 그림을 등록할 때 쓰는 도구
    _kit: { ENEMY, BOSS, BG, HELPER, LOOK, OL, circle, oval, rrect, fillStroke, eye },
  };

  root.Art = Art;
  // 월드 이모지는 어디서든(메뉴·일시정지·배너) 직접 그린 월드 엠블럼으로
  if (root.Glyphs && root.Glyphs.picture && root.document) {
    const WE = { school: '🏫', academy: '📖', office: '🏢', subway: '🚇', home: '🏠', gym: '🏋️', library: '📚', beach: '🏖️', airport: '✈️', hospital: '🏥', mountain: '🏔️', stage: '🎤' };
    for (const id in WE) root.Glyphs.picture(WE[id], (ctx, x, y, size) => Art.drawWorld(ctx, id, x, y, size));
    root.Glyphs.picture('⛰️', (ctx, x, y, size) => Art.drawWorld(ctx, 'mountain', x, y, size));
    root.Glyphs.picture('🎭', (ctx, x, y, size) => Art.drawWorld(ctx, 'stage', x, y, size));
  }
})(typeof window !== 'undefined' ? window : globalThis);
