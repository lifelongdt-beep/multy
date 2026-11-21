/* 퇴근 에코 — 새 그림체 (시안: 학교 월드)
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
  const K_KID = 1.4;              // 주인공·에코·선생님 그림 크기 배율

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
    circle(g, x + s * 0.28 * dir, y - s * 0.05, s * 0.15); g.fillStyle = '#fff'; g.fill();
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
        // 불안한 눈과 악문 이
        oval(g, -r * 0.32, -r * 0.1, r * 0.2, r * 0.24); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = OL; g.stroke();
        oval(g, r * 0.32, -r * 0.1, r * 0.2, r * 0.24); g.fillStyle = '#fff'; g.fill(); g.stroke();
        circle(g, -r * 0.3, -r * 0.05, r * 0.1); g.fillStyle = '#ff3b6b'; g.fill(); circle(g, r * 0.3, -r * 0.05, r * 0.1); g.fill();
        g.beginPath(); g.moveTo(-r * 0.6, -r * 0.45); g.lineTo(-r * 0.12, -r * 0.3); g.moveTo(r * 0.6, -r * 0.45); g.lineTo(r * 0.12, -r * 0.3); g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
        rrect(g, -r * 0.35, r * 0.2, r * 0.7, r * 0.22, r * 0.06); fillStroke(g, '#fff', 2);
        g.beginPath(); for (let i = 1; i < 5; i++) { g.moveTo(-r * 0.35 + i * r * 0.14, r * 0.2); g.lineTo(-r * 0.35 + i * r * 0.14, r * 0.42); } g.lineWidth = 1.2; g.stroke();
      },
      w: 2.4, h: 2.8,
    },
  };

  /* ---------- 주인공 / 에코 / 선생님 ---------- */
  const OUTFIT = {   // 캐릭터별 옷 색 (이모지 → 그림체)
    '🧑‍🎓': { body: '#4561d6', trim: '#2c3f9a', pack: '#e2574c' },
    '🏃':   { body: '#e2574c', trim: '#ffffff', pack: '#2e3a59' },
    '🤓':   { body: '#2fa86b', trim: '#1d6e46', pack: '#f2c14e', glasses: true },
    '🧑‍⚕️': { body: '#f2f4f8', trim: '#e2574c', pack: '#7fb3ff', cross: true },
  };
  function drawKid(g, o, step) {
    // 발 (걷기: step = -1..1)
    oval(g, -3.2 + step * 1.2, 12, 2.6, 1.8); fillStroke(g, '#2a2440', 1.4);
    oval(g, 3.2 - step * 1.2, 12, 2.6, 1.8); fillStroke(g, '#2a2440', 1.4);
    // 가방
    rrect(g, -8.5, -0.5, 4.5, 9, 1.8); fillStroke(g, o.pack, 1.6);
    // 몸
    rrect(g, -5.8, 0, 11.6, 11.5, 4); fillStroke(g, o.body, 1.8);
    g.beginPath(); g.moveTo(-2.5, 0.8); g.lineTo(0, 4); g.lineTo(2.5, 0.8); g.lineWidth = 1.4; g.strokeStyle = o.trim; g.stroke();
    if (o.cross) { g.fillStyle = '#e2574c'; g.fillRect(-1, 5, 2, 5); g.fillRect(-2.5, 6.5, 5, 2); }
    // 머리
    circle(g, 0, -6.5, 7.6); fillStroke(g, '#ffd9b8', 1.8);
    g.beginPath(); g.arc(0, -7.2, 7.7, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(3, -9.5, -1, -8.5); g.quadraticCurveTo(-4, -8, -7.6, -6.5); g.closePath();
    fillStroke(g, '#3b2b25', 1.6);
    eye(g, -2.7, -4.6, 1.5, 'normal'); eye(g, 2.7, -4.6, 1.5, 'normal');
    if (o.glasses) { g.lineWidth = 1; g.strokeStyle = OL; circle(g, -2.7, -4.4, 2.3); g.stroke(); circle(g, 2.7, -4.4, 2.3); g.stroke(); g.beginPath(); g.moveTo(-0.4, -4.4); g.lineTo(0.4, -4.4); g.stroke(); }
    oval(g, -4.8, -2.2, 1.3, 0.8); g.fillStyle = 'rgba(255,120,120,.5)'; g.fill(); oval(g, 4.8, -2.2, 1.3, 0.8); g.fill();
    g.beginPath(); g.arc(0, -2.2, 1.4, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 1.1; g.strokeStyle = OL; g.stroke();
  }
  function kidSprite(emo, step) {
    const o = OUTFIT[emo] || OUTFIT['🧑‍🎓'];
    return sprite(`kid:${emo}:${step}`, 22, 34, (g) => { g.translate(0, -1); drawKid(g, o, step); });
  }
  const TEACHER = (g) => {
    rrect(g, -7, 2, 14, 15, 5); fillStroke(g, '#3fae8a', 1.8);                         // 가디건
    g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 16); g.lineWidth = 1.2; g.strokeStyle = '#2b7d62'; g.stroke();
    rrect(g, -6, 8, 9, 7, 1.5); fillStroke(g, '#f2d06b', 1.5);                       // 책
    g.beginPath(); g.moveTo(-1.5, 8); g.lineTo(-1.5, 15); g.lineWidth = 1; g.strokeStyle = OL; g.stroke();
    circle(g, 0, -6, 8); fillStroke(g, '#ffd9b8', 1.8);
    circle(g, 0, -15.5, 3.8); fillStroke(g, '#4a3030', 1.6);                         // 올림머리
    g.beginPath(); g.arc(0, -6.8, 8.1, Math.PI * 1.0, Math.PI * 2.0); g.quadraticCurveTo(2, -9, -8.1, -6.2); g.closePath(); fillStroke(g, '#4a3030', 1.6);
    g.lineWidth = 1.2; g.strokeStyle = OL; circle(g, -2.9, -4.5, 2.4); g.stroke(); circle(g, 2.9, -4.5, 2.4); g.stroke();
    circle(g, -2.9, -4.3, 0.9); g.fillStyle = OL; g.fill(); circle(g, 2.9, -4.3, 0.9); g.fill();
    g.beginPath(); g.arc(0, -1.3, 1.8, 0.1 * Math.PI, 0.9 * Math.PI); g.lineWidth = 1.2; g.stroke();
  };

  /* ---------- 배경 (월드별) ---------- */
  const BG = {};        // worldId -> (g, W, H) 그리기 함수 (art-worlds.js가 채움)
  const HELPER = {};    // worldId -> (g) 도우미 그리기 함수
  function vignette(g, W, H) {
    const vg = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,6,16,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function background(W, H, worldId) {
    if (worldId && worldId !== 'school' && BG[worldId]) {
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

    /** 발밑 표시: 적은 붉은 고리, 에코는 파란 고리 (한눈에 편 구분) */
    groundMark(ctx, x, y, r, color, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
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
      this.groundMark(ctx, e.x, fy, r * 1.05 * k, '#ff4d6d', boss ? 0.8 : 0.6);
      const flip = !spec.noFlip && e.x > px;   // 주인공 쪽을 바라봄 (글자가 있는 그림은 뒤집지 않음)
      blit(ctx, base, e.x, e.y - hop, sx * k, sy * k, flip);
      if (e.flash > 0) { ctx.globalAlpha = 0.7; blit(ctx, tinted(`enW:${boss ? e.def.name : e.type}:${r}`, base, '#ffffff'), e.x, e.y - hop, sx * k, sy * k, flip); ctx.globalAlpha = 1; }
    },

    drawPlayer(ctx, p, emo, moving, dir, now, blink) {
      const step = moving ? (Math.floor(now / 110) % 2 ? 1 : -1) : 0;
      const bob = moving ? Math.abs(Math.sin(now / 110 * Math.PI / 2)) * 1.6 : Math.sin(now / 500) * 0.5;
      this.shadow(ctx, p.x, p.y + 13 * K_KID, 8 * K_KID);
      if (blink) ctx.globalAlpha = 0.4;
      blit(ctx, kidSprite(emo, step), p.x, p.y - 4 - bob, K_KID, K_KID, dir < 0);
      ctx.globalAlpha = 1;
    },

    /** 에코 = 과거의 나: 주인공과 같은 모습의 반투명 파란 유령 */
    drawEcho(ctx, ec, emo, now, alpha) {
      const base = kidSprite(emo, 0);
      const ghost = tinted(`ghost:${emo}`, base, '#6fd3ff', 0.55);
      const bob = Math.sin(now / 400 + ec.id) * 1.5;
      this.groundMark(ctx, ec.x, ec.y + 13 * K_KID, 9 * K_KID, '#6fd6ff', alpha * 1.4);
      ctx.globalAlpha = alpha * 1.25;
      const dir = ec._lx !== undefined && ec.x < ec._lx ? -1 : 1; ec._lx = ec.x;
      blit(ctx, ghost, ec.x, ec.y - 4 + bob, K_KID, K_KID, dir < 0);
      ctx.globalAlpha = 1;
    },

    drawTeacher(ctx, x, y) { this.drawHelper(ctx, 'school', x, y); },
    drawHelper(ctx, worldId, x, y) {
      const fn = HELPER[worldId] || TEACHER;
      const c = sprite('helper:' + (HELPER[worldId] ? worldId : 'school'), 24, 42, (g) => { g.translate(0, 2); fn(g); });
      this.shadow(ctx, x, y + 19 * K_KID, 9 * K_KID);
      blit(ctx, c, x, y, K_KID, K_KID);
    },

    drawBullet(ctx, b) {
      const echo = b.owner === 'echo';
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.globalAlpha = echo ? 0.35 : 1;
      ctx.fillStyle = echo ? 'rgba(127,220,255,.35)' : 'rgba(255,226,122,.35)';
      ctx.fillRect(-12, -1.6, 10, 3.2);                                     // 꼬리
      ctx.fillStyle = b.crit ? '#ff9f43' : (echo ? '#9fe8ff' : '#ffe27a');
      ctx.beginPath(); ctx.ellipse(0, 0, b.crit ? 5.5 : 4.5, b.crit ? 2.8 : 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = OL; ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    },
    drawEnemyBullet(ctx, b) {
      ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = OL; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
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
    _kit: { ENEMY, BOSS, BG, HELPER, OL, circle, oval, rrect, fillStroke, eye },
  };

  root.Art = Art;
})(typeof window !== 'undefined' ? window : globalThis);
