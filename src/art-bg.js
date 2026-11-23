/* Echo Rush — 월드 배경 (사실적인 버전)
 * 원칙: 가운데(플레이 영역)는 낮은 대비로 깨끗하게, 소품·벽·조명은 위쪽과 가장자리에.
 * 질감(나뭇결·타일 줄눈·모래 알갱이) + 부드러운 그림자 + 빛 웅덩이로 깊이감을 준다. 한 번 그려 캐시한다.
 */
(function (root) {
  'use strict';
  const Art = root.Art;
  if (!Art) return;
  const { BG, rrect, circle, oval } = Art._kit;

  /* ---------- 공통 도우미 ---------- */
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const lerp = (a, b, t) => a + (b - a) * t;
  function shade(hex, k) {   // k<0 어둡게, k>0 밝게
    const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  /** 자잘한 알갱이 (질감) */
  function grain(g, x, y, w, h, n, alpha, seed, col) {
    const r = rng(seed); g.fillStyle = col || '#000';
    for (let i = 0; i < n; i++) { g.globalAlpha = alpha * (0.3 + r() * 0.7); g.fillRect(x + r() * w, y + r() * h, 1 + r() * 1.4, 1 + r() * 0.8); }
    g.globalAlpha = 1;
  }
  /** 나무 마루: 판자마다 톤이 조금씩 다르고, 나뭇결과 이음매가 있다 */
  function woodFloor(g, x, y, w, h, base, ph, seed) {
    const r = rng(seed);
    for (let yy = y, row = 0; yy < y + h; yy += ph, row++) {
      let xx = x - r() * 120;
      while (xx < x + w) {
        const len = 90 + r() * 110;
        g.fillStyle = shade(base, (r() - 0.5) * 0.16); g.fillRect(xx, yy, len, ph);
        g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 0.8;   // 나뭇결
        for (let k = 0; k < 3; k++) { const gy = yy + 3 + r() * (ph - 6); g.beginPath(); g.moveTo(xx + 4, gy); g.bezierCurveTo(xx + len * 0.3, gy + (r() - 0.5) * 3, xx + len * 0.7, gy + (r() - 0.5) * 3, xx + len - 4, gy); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(xx + len - 1, yy, 1, ph);   // 이음매
        xx += len;
      }
      g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x, yy, w, 1);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, yy + 1, w, 1);
    }
  }
  /** 타일 바닥: 장마다 톤 차이 + 줄눈 + 위쪽 밝은 테 */
  function tileFloor(g, x, y, w, h, size, base, grout, seed, jitter) {
    const r = rng(seed); g.fillStyle = grout; g.fillRect(x, y, w, h);
    for (let yy = y; yy < y + h; yy += size) for (let xx = x; xx < x + w; xx += size) {
      g.fillStyle = shade(base, (r() - 0.5) * (jitter || 0.08)); g.fillRect(xx + 1, yy + 1, size - 2, size - 2);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(xx + 1, yy + 1, size - 2, 1.5);
    }
  }
  /** 위쪽 벽: 그라데이션 + 걸레받이 + 바닥에 드리운 그림자 */
  function wall(g, W, h, top, bottom, trim) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, W, h);
    g.fillStyle = trim || 'rgba(0,0,0,.35)'; g.fillRect(0, h - 5, W, 5);
    const sh = g.createLinearGradient(0, h, 0, h + 26); sh.addColorStop(0, 'rgba(0,0,0,.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(0, h, W, 26);
  }
  /** 부드러운 그림자를 깔고 그리기 */
  function withShadow(g, blur, oy, fn, a) { g.save(); g.shadowColor = `rgba(0,0,0,${a || 0.5})`; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }
  function pool(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function box(g, x, y, w, h, rad, col, top) { g.fillStyle = col; rrect(g, x, y, w, h, rad); g.fill(); if (top) { g.fillStyle = top; rrect(g, x, y, w, Math.min(5, h / 3), rad); g.fill(); } }
  function shelfBooks(g, x, y, w, h, seed) {   // 책 등 (색 다양, 높이 조금씩)
    const r = rng(seed), cols = ['#8e3b46', '#2f5d8a', '#3f7d4e', '#b07a2a', '#5b4a8a', '#7a5230', '#2e6f73'];
    let xx = x;
    while (xx < x + w - 3) { const bw = 3 + r() * 4, bh = h * (0.72 + r() * 0.28); g.fillStyle = shade(cols[Math.floor(r() * cols.length)], -0.25 - r() * 0.15); g.fillRect(xx, y + h - bh, bw - 0.6, bh); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(xx + 0.5, y + h - bh + 3, bw - 1.6, 1); xx += bw; }
  }

  /* ---------- 학교: 저녁 교실 ---------- */
  BG.school = (g, W, H) => {
    // 만화풍 교실 (캔바 시안을 코드로): 세로 판자 마루 · 양옆 책상과 의자 · 위쪽 칠판. 가운데는 비워 싸우기 좋게
    const OLc = '#2b2119', r = rng(11), TOP = 88;
    // 1) 세로 판자 마루: 판자마다 갈색·회갈색이 번갈아, 이음매는 엇갈리게
    const PL = 15, tones = ['#7b5a3e', '#8d6b4a', '#6f5846', '#8b7a64', '#80603f', '#76685a'];
    for (let x = 0, i = 0; x < W; x += PL, i++) {
      let y = TOP - r() * 140;
      while (y < H) {
        const len = 90 + r() * 170, col = tones[Math.floor(r() * tones.length)];
        g.fillStyle = col; g.fillRect(x, y, PL, len);
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1, y, 2, len);          // 판자 왼쪽 밝은 결
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + PL - 4, y, 3, len);           // 오른쪽 그늘
        g.fillStyle = 'rgba(35,24,16,.65)'; g.fillRect(x, y + len - 1, PL, 1.4);     // 이음매
        y += len;
      }
      g.fillStyle = 'rgba(35,24,16,.7)'; g.fillRect(x + PL - 1, TOP, 1.2, H - TOP);    // 판자 사이 선
    }
    // 2) 위쪽 벽 + 칠판 (정보창 바로 아래에 보이게)
    g.fillStyle = '#48503e'; g.fillRect(0, 0, W, TOP);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, TOP - 6, W, 6);
    const sh = g.createLinearGradient(0, TOP, 0, TOP + 18); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, TOP, W, 18);
    const bx = 52, bw = W - 104, by = 30, bh = 44;
    g.fillStyle = '#b89a72'; rrect(g, bx - 4, by - 4, bw + 8, bh + 8, 3); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1.4; g.stroke();   // 나무 틀
    const cb = g.createLinearGradient(0, by, 0, by + bh); cb.addColorStop(0, '#20443a'); cb.addColorStop(1, '#1a3830');
    g.fillStyle = cb; g.fillRect(bx, by, bw, bh); g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(bx, by, bw, 5);
    g.fillStyle = '#9c7f5c'; rrect(g, bx + 6, by + bh + 4, bw - 12, 5, 2); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1; g.stroke();     // 분필 받침
    g.fillStyle = '#f2f2ec'; g.fillRect(bx + 150, by + bh + 4.5, 10, 3); g.fillStyle = '#7fb4e8'; g.fillRect(bx + 166, by + bh + 4.5, 9, 3);
    g.fillStyle = '#26262c'; rrect(g, bx + bw - 44, by + bh + 2.5, 16, 6, 1.5); g.fill();                                                 // 칠판지우개
    // 3) 양옆 책상 + 의자 (화면 끝에 살짝 걸침)
    const DW = 60, DH = 50, rows = [124, 230, 336, 442, 548];
    const desk = (x, y, item) => {
      withShadow(g, 5, 3, () => { g.fillStyle = '#d5995a'; rrect(g, x, y, DW, DH, 2); g.fill(); }, 0.35);
      g.strokeStyle = OLc; g.lineWidth = 1.5; rrect(g, x, y, DW, DH, 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 2, y + 2, DW - 4, 4);                      // 윗면 빛
      g.fillStyle = 'rgba(120,60,20,.18)'; g.fillRect(x + 2, y + DH - 6, DW - 4, 4);                   // 앞쪽 그늘
      g.fillStyle = '#3a3a40'; for (const lx of [x + 2, x + DW - 6]) g.fillRect(lx, y + DH - 1, 4, 5); // 책상 다리 끝
      // 의자 (책상 아래쪽): 금속 틀 + 나무 좌석
      const cx = x + DW / 2, cy = y + DH + 18;
      g.strokeStyle = '#4a4a52'; g.lineWidth = 2; rrect(g, cx - 22, cy - 9, 44, 26, 5); g.stroke();
      g.fillStyle = '#c99254'; rrect(g, cx - 19, cy - 7, 38, 17, 4); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx - 17, cy - 5, 34, 3);
      g.fillStyle = '#2f2f36'; for (const lx of [cx - 21, cx + 18]) g.fillRect(lx, cy + 15, 3.5, 5);
      // 책상 위 소품 (사람 없이 물건만)
      if (item === 'book') { g.fillStyle = '#3f6a46'; rrect(g, x + 32, y + 10, 18, 25, 1.5); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1.1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 34, y + 12, 2, 21); }
      if (item === 'case') { g.save(); g.translate(x + 40, y + 28); g.rotate(-0.35); g.fillStyle = '#26304a'; rrect(g, -11, -4.5, 22, 9, 4); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-8, -3, 14, 1.5); g.restore(); }
      if (item === 'note') { g.fillStyle = '#f1e9d6'; rrect(g, x + 16, y + 11, 20, 26, 1); g.fill(); g.strokeStyle = OLc; g.lineWidth = 1; g.stroke(); g.fillStyle = '#9a9a9a'; for (let k = 0; k < 6; k++) g.fillRect(x + 15, y + 13 + k * 4, 2.2, 1.6); }
      if (item === 'pencil') { g.save(); g.translate(x + 38, y + 26); g.rotate(1.25); g.fillStyle = '#2c3550'; g.fillRect(-11, -1.4, 20, 2.8); g.fillStyle = '#e9cfa0'; g.beginPath(); g.moveTo(9, -1.4); g.lineTo(13, 0); g.lineTo(9, 1.4); g.fill(); g.restore(); }
    };
    const leftItems = ['book', 'case', null, 'note', null], rightItems = [null, null, null, 'note', 'pencil'];
    rows.forEach((y, i) => { desk(-2, y, leftItems[i]); desk(W - DW + 2, y, rightItems[i]); });
    // 4) 살짝 차분하게: 밝은 나무색이 캐릭터·적·구슬보다 튀지 않도록
    g.fillStyle = 'rgba(14,12,30,.22)'; g.fillRect(0, 0, W, H);
  };

  /* ---------- 만화풍 공통 도구 (학교와 같은 그림체: 굵지 않은 갈색 외곽선 · 평평한 색 · 윗면 빛) ---------- */
  const OLC = '#2b2119';
  function obox(g, x, y, w, h, rad, fill, lw, hi) {
    g.fillStyle = fill; rrect(g, x, y, w, h, rad); g.fill(); g.strokeStyle = OLC; g.lineWidth = lw || 1.4; g.stroke();
    if (hi !== false) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 2, y + 2, w - 4, Math.min(4, h / 4)); }
  }
  function vplanks(g, top, W, H, pw, tones, seed) {
    const r = rng(seed);
    for (let x = 0; x < W; x += pw) {
      let y = top - r() * 140;
      while (y < H) { const len = 90 + r() * 170; g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, y, pw, len); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1, y, 2, len); g.fillStyle = 'rgba(35,24,16,.6)'; g.fillRect(x, y + len - 1, pw, 1.4); y += len; }
      g.fillStyle = 'rgba(35,24,16,.65)'; g.fillRect(x + pw - 1, top, 1.2, H - top);
    }
  }
  function hplanks(g, top, W, H, ph, tones, seed) {
    const r = rng(seed);
    for (let y = top; y < H; y += ph) {
      let x = -r() * 140;
      while (x < W) { const len = 90 + r() * 160; g.fillStyle = tones[Math.floor(r() * tones.length)]; g.fillRect(x, y, len, ph); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y + 1, len, 2); g.fillStyle = 'rgba(35,24,16,.6)'; g.fillRect(x + len - 1, y, 1.4, ph); x += len; }
      g.fillStyle = 'rgba(35,24,16,.65)'; g.fillRect(0, y + ph - 1, W, 1.2);
    }
  }
  function tiles(g, top, W, H, sz, a, b, line) {
    for (let y = top, j = 0; y < H; y += sz, j++) for (let x = 0, i = 0; x < W; x += sz, i++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(x, y, sz, sz); }
    g.fillStyle = line; for (let y = top; y < H; y += sz) g.fillRect(0, y, W, 1.2); for (let x = 0; x < W; x += sz) g.fillRect(x, top, 1.2, H - top);
  }
  function topWall(g, W, top, col) {
    g.fillStyle = col; g.fillRect(0, 0, W, top); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, top - 6, W, 6);
    const sh = g.createLinearGradient(0, top, 0, top + 18); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, top, W, 18);
  }
  function calm(g, W, H, a) { g.fillStyle = `rgba(14,12,30,${a})`; g.fillRect(0, 0, W, H); }   // 캐릭터·적이 튀어 보이도록 살짝 어둡게
  function shadowed(g, fn) { withShadow(g, 5, 3, fn, 0.35); }
  const ROWS5 = [124, 230, 336, 442, 548];

  /* ---------- 학원: 밤 자습실 (보라 카펫 · 칸막이 책상 · 스탠드 불빛) ---------- */
  BG.academy = (g, W, H) => {
    const TOP = 88;
    g.fillStyle = '#4a3d63'; g.fillRect(0, TOP, W, H - TOP);
    for (let y = TOP; y < H; y += 8) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(0, y, W, 3); }   // 카펫 줄
    g.fillStyle = 'rgba(30,20,50,.35)'; g.fillRect(W / 2 - 52, TOP, 104, H - TOP); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(W / 2 - 52, TOP, 3, H - TOP); g.fillRect(W / 2 + 49, TOP, 3, H - TOP);   // 가운데 통로 카펫
    topWall(g, W, TOP, '#3a3150');
    for (let i = 0; i < 3; i++) { const x = 30 + i * 104; obox(g, x, 26, 84, 50, 3, '#8a6a4a'); g.fillStyle = '#1c2546'; g.fillRect(x + 5, 31, 74, 40); g.fillStyle = '#ffe9a8'; if (i === 2) { circle(g, x + 60, 44, 7); g.fill(); } for (let k = 0; k < 5; k++) g.fillRect(x + 10 + k * 14, 36 + (k * 7) % 22, 1.6, 1.6); g.fillStyle = '#8a6a4a'; g.fillRect(x + 40, 31, 4, 40); }   // 밤 창문
    const carrel = (x, y, side) => {
      shadowed(g, () => obox(g, x, y, 62, 52, 2, '#7d6aa3'));
      obox(g, side ? x : x + 54, y - 4, 8, 60, 2, '#5d4f80', 1.2, false);                     // 칸막이
      obox(g, x + (side ? 18 : 10), y + 14, 22, 26, 1, '#f1e9d6', 1, false); g.fillStyle = '#b8b0a0'; for (let k = 0; k < 4; k++) g.fillRect(x + (side ? 21 : 13), y + 20 + k * 4, 15, 1.2);   // 공책
      const lx = x + (side ? 48 : 14); pool(g, lx, y + 12, 34, 'rgba(255,214,140,A)', 0.28); circle(g, lx, y + 10, 5); g.fillStyle = '#ffe28a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke();   // 스탠드
      const cx = x + 31, cy = y + 70; g.strokeStyle = '#4a4a52'; g.lineWidth = 2; rrect(g, cx - 20, cy - 8, 40, 24, 5); g.stroke(); obox(g, cx - 17, cy - 6, 34, 15, 4, '#5a4a7a', 1.2);   // 의자
    };
    ROWS5.forEach((y) => { carrel(-4, y, 0); carrel(W - 58, y, 1); });
    calm(g, W, H, 0.24);
  };

  /* ---------- 회사: 밤 사무실 (카펫 타일 · 야경 창 · 모니터 책상) ---------- */
  BG.office = (g, W, H) => {
    const TOP = 88;
    tiles(g, TOP, W, H, 40, '#5b6773', '#56626e', 'rgba(25,30,40,.45)');
    topWall(g, W, TOP, '#2b3444');
    g.fillStyle = '#15203a'; g.fillRect(0, 18, W, 62);                                                // 통유리
    const r = rng(33); for (let i = 0; i < 9; i++) { const bw = 26 + r() * 22, bh = 20 + r() * 38, bx = i * 42 - 6; g.fillStyle = '#22304e'; g.fillRect(bx, 80 - bh, bw, bh); g.fillStyle = '#ffd98a'; for (let k = 0; k < 8; k++) if (r() < 0.5) g.fillRect(bx + 3 + (k % 3) * 8, 80 - bh + 5 + Math.floor(k / 3) * 9, 3, 4); }   // 빌딩 불빛
    g.fillStyle = '#4a5668'; for (let x = 0; x <= W; x += 72) g.fillRect(x, 18, 4, 62); g.fillRect(0, 16, W, 4); g.strokeStyle = OLC; g.lineWidth = 1; g.strokeRect(0, 18, W, 62);
    const desk = (x, y, side) => {
      shadowed(g, () => obox(g, x, y, 64, 50, 2, '#c9cdd3'));
      obox(g, x + (side ? 22 : 8), y + 6, 30, 18, 2, '#2a3240'); g.fillStyle = '#7fc4ff'; g.fillRect(x + (side ? 25 : 11), y + 9, 24, 12); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + (side ? 25 : 11), y + 9, 24, 3);   // 모니터
      pool(g, x + (side ? 37 : 23), y + 16, 30, 'rgba(120,190,255,A)', 0.16);
      obox(g, x + (side ? 22 : 12), y + 30, 26, 8, 2, '#3a4250', 1, false);                    // 키보드
      circle(g, x + (side ? 10 : 54), y + 36, 5); g.fillStyle = '#e8e2d6'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke(); circle(g, x + (side ? 10 : 54), y + 36, 2.6); g.fillStyle = '#6b4a30'; g.fill();   // 머그컵
      const cx = x + 32, cy = y + 70; circle(g, cx, cy, 14); g.fillStyle = '#2f3644'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.4; g.stroke(); circle(g, cx, cy - 1, 9); g.fillStyle = '#3e4758'; g.fill();   // 회전 의자
    };
    ROWS5.forEach((y) => { desk(-4, y, 0); desk(W - 60, y, 1); });
    calm(g, W, H, 0.24);
  };

  /* ---------- 지하철: 승강장 (타일 · 노란 안전선 · 기둥 · 벤치) ---------- */
  BG.subway = (g, W, H) => {
    const TOP = 96;
    tiles(g, TOP, W, H, 36, '#b9b4a8', '#b2ada0', 'rgba(60,55,50,.35)');
    g.fillStyle = '#3a3a42'; g.fillRect(0, 0, W, 70);                                                  // 선로 쪽
    g.fillStyle = '#5a4a3a'; for (let x = 4; x < W; x += 20) g.fillRect(x, 26, 10, 36);                 // 침목
    g.fillStyle = '#c9ced6'; g.fillRect(0, 34, W, 4); g.fillRect(0, 52, W, 4);                         // 레일
    g.fillStyle = '#dcdcd6'; g.fillRect(0, 70, W, 10); g.strokeStyle = OLC; g.lineWidth = 1.2; g.strokeRect(0, 70, W, 10);   // 승강장 끝
    g.fillStyle = '#f2c230'; g.fillRect(0, 80, W, 14); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 3; x < W; x += 9) for (let k = 0; k < 2; k++) { circle(g, x, 84 + k * 6, 1.3); g.fill(); }   // 점자 블록
    const r = rng(41);
    for (const y of [150, 300, 450]) for (const side of [0, 1]) {
      const x = side ? W - 40 : 10;
      shadowed(g, () => obox(g, x, y, 30, 30, 3, '#8a96a8'));                                          // 기둥
      obox(g, side ? W - 46 : 2, y + 54, 44, 18, 3, '#4f7fb8'); g.fillStyle = '#3a5f8c'; for (let k = 0; k < 3; k++) g.fillRect((side ? W - 42 : 6) + k * 13, y + 57, 10, 12);   // 벤치
      if (r() < 0.6) { obox(g, side ? W - 34 : 8, y + 84, 26, 34, 2, '#e0e0da', 1.2); g.fillStyle = ['#e85a5a', '#5ab0e8', '#7bc86c'][Math.floor(r() * 3)]; g.fillRect((side ? W - 31 : 11), y + 88, 20, 14); }   // 광고판
    }
    g.fillStyle = 'rgba(255,255,240,.05)'; for (const y of [200, 380, 560]) g.fillRect(0, y, W, 16);   // 형광등 빛
    calm(g, W, H, 0.22);
  };

  /* ---------- 집: 밤 거실 (가로 마루 · 창문 달빛 · 소파 · 책장 · 러그) ---------- */
  BG.home = (g, W, H) => {
    const TOP = 88;
    hplanks(g, TOP, W, H, 16, ['#7a5a40', '#84624a', '#6f523c', '#7d6650'], 51);
    topWall(g, W, TOP, '#3c4560');
    obox(g, W - 128, 18, 104, 60, 3, '#8a6a4a'); g.fillStyle = '#1c2a54'; g.fillRect(W - 122, 24, 92, 48); circle(g, W - 50, 40, 9); g.fillStyle = '#fff3c4'; g.fill(); g.fillStyle = '#8a6a4a'; g.fillRect(W - 78, 24, 4, 48);   // 창문·달
    obox(g, 18, 30, 110, 46, 10, '#7a5a8a'); obox(g, 24, 50, 48, 22, 6, '#8f6c9f', 1.2); obox(g, 76, 50, 48, 22, 6, '#8f6c9f', 1.2);   // 소파
    oval(g, W / 2, H * 0.52, 120, 84); g.fillStyle = '#7a5f7a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.4; g.stroke(); oval(g, W / 2, H * 0.52, 100, 68); g.strokeStyle = 'rgba(255,230,240,.25)'; g.lineWidth = 3; g.stroke();   // 러그
    shadowed(g, () => obox(g, W - 44, 130, 42, 170, 2, '#6a4a34'));
    for (let sI = 0; sI < 5; sI++) { g.fillStyle = '#4a3324'; g.fillRect(W - 40, 136 + sI * 32, 34, 28); shelfBooks(g, W - 39, 137 + sI * 32, 32, 26, 60 + sI); }   // 책장
    shadowed(g, () => obox(g, 4, 360, 56, 36, 4, '#a07a52')); circle(g, 32, 378, 7); g.fillStyle = '#e8e2d0'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke();   // 작은 탁자 · 접시
    for (const [x, y] of [[26, 300], [W - 26, 470]]) { pool(g, x, y, 60, 'rgba(255,200,120,A)', 0.2); circle(g, x, y, 8); g.fillStyle = '#ffd98a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.2; g.stroke(); }   // 스탠드
    shadowed(g, () => obox(g, W - 70, 540, 64, 40, 4, '#3a3a48')); g.fillStyle = '#5ab0e8'; g.fillRect(W - 64, 546, 52, 26);   // TV
    calm(g, W, H, 0.3);
  };

  /* ---------- 헬스장: 농구 코트 (밝은 세로 마루 · 코트 선 · 관중석 · 벤치) ---------- */
  BG.gym = (g, W, H) => {
    const TOP = 88;
    vplanks(g, TOP, W, H, 14, ['#c79a62', '#bf9058', '#cfa46c', '#b88a52'], 71);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.5;
    g.strokeRect(14, TOP + 14, W - 28, H - TOP - 30); g.beginPath(); g.moveTo(14, H / 2 + 40); g.lineTo(W - 14, H / 2 + 40); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2 + 40, 44, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(210,80,70,.35)'; g.fillRect(W / 2 - 46, TOP + 14, 92, 104); g.strokeRect(W / 2 - 46, TOP + 14, 92, 104);   // 페인트 존
    g.beginPath(); g.arc(W / 2, TOP + 118, 46, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(W / 2, TOP + 14, 140, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#4a5578', '#434d6e', '#3d4664', '#373f5a'][i]; g.fillRect(0, i * 20, W, 20); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, i * 20 + 18, W, 2); }   // 관중석
    const r = rng(72); for (let i = 0; i < 36; i++) { const x = r() * W, y = 8 + Math.floor(r() * 4) * 20; circle(g, x, y, 4.5); g.fillStyle = ['#e8b48a', '#c98a5e', '#f0c8a0'][i % 3]; g.fill(); g.strokeStyle = OLC; g.lineWidth = 0.8; g.stroke(); }
    obox(g, W / 2 - 30, TOP - 6, 60, 12, 2, '#eeeeee'); g.strokeStyle = '#e8603a'; g.lineWidth = 2.5; circle(g, W / 2, TOP + 12, 9); g.stroke();   // 골대
    for (const y of [200, 420]) for (const side of [0, 1]) {
      const x = side ? W - 26 : 2; shadowed(g, () => obox(g, x, y, 24, 96, 3, '#4f7fb8'));          // 벤치
      if (y === 200) { for (let k = 0; k < 3; k++) { circle(g, x + 12, y + 128 + k * 18, 7); g.fillStyle = '#e8803a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.2; g.stroke(); g.beginPath(); g.moveTo(x + 5, y + 128 + k * 18); g.lineTo(x + 19, y + 128 + k * 18); g.stroke(); } }   // 공 바구니
    }
    calm(g, W, H, 0.24);
  };

  /* ---------- 도서관: 열람실 (초록 카펫 · 큰 서가 · 열람 테이블 · 초록 스탠드) ---------- */
  BG.library = (g, W, H) => {
    const TOP = 92;
    g.fillStyle = '#3f5a48'; g.fillRect(0, TOP, W, H - TOP);
    g.strokeStyle = 'rgba(230,210,150,.25)'; g.lineWidth = 3; g.strokeRect(70, TOP + 20, W - 140, H - TOP - 40);   // 카펫 테두리
    for (let y = TOP; y < H; y += 10) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(0, y, W, 4); }
    g.fillStyle = '#5a3d2a'; g.fillRect(0, 0, W, TOP); g.strokeStyle = OLC; g.lineWidth = 1.4; g.strokeRect(0, 0, W, TOP);
    for (let sI = 0; sI < 3; sI++) { g.fillStyle = '#3a2618'; g.fillRect(6, 6 + sI * 27, W - 12, 24); shelfBooks(g, 8, 7 + sI * 27, W - 16, 22, 80 + sI); }   // 큰 서가
    const sh = g.createLinearGradient(0, TOP, 0, TOP + 18); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, TOP, W, 18);
    const table = (x, y, side) => {
      shadowed(g, () => obox(g, x, y, 62, 74, 3, '#a8764a'));
      obox(g, x + (side ? 14 : 22), y + 12, 26, 20, 1, '#f1e9d6', 1, false); g.fillStyle = '#c9c0ae'; g.fillRect(x + (side ? 26 : 34), y + 12, 1.2, 20);   // 펼친 책
      const lx = x + (side ? 48 : 12), ly = y + 50; pool(g, lx, ly, 30, 'rgba(160,255,170,A)', 0.18); obox(g, lx - 8, ly - 5, 16, 10, 5, '#3f8a54', 1.1); circle(g, lx, ly + 7, 3); g.fillStyle = '#d8c070'; g.fill();   // 초록 스탠드
      for (const cy of [y + 10, y + 46]) { const cx = side ? x - 2 : x + 62; obox(g, cx - (side ? 14 : 0), cy, 14, 18, 3, '#7a5236', 1.1); }   // 의자
    };
    for (const y of [140, 280, 420]) { table(-2, y, 0); table(W - 60, y, 1); }
    for (const y of [240, 380, 540]) for (const side of [0, 1]) { const x = side ? W - 22 : 0; shadowed(g, () => obox(g, x, y, 22, 34, 2, '#5a3d2a', 1.2)); g.fillStyle = '#3a2618'; g.fillRect(x + 3, y + 3, 16, 28); shelfBooks(g, x + 3, y + 4, 16, 26, y + side); }   // 낮은 서가
    calm(g, W, H, 0.26);
  };

  /* ---------- 바닷가: 모래사장 (바다 · 파라솔 · 수건 · 조개) ---------- */
  BG.beach = (g, W, H) => {
    const TOP = 120;
    const sd = g.createLinearGradient(0, TOP, 0, H); sd.addColorStop(0, '#c9a874'); sd.addColorStop(1, '#e2c792');
    g.fillStyle = sd; g.fillRect(0, TOP - 20, W, H - TOP + 20);
    const r = rng(81); g.fillStyle = 'rgba(120,90,50,.25)'; for (let i = 0; i < 260; i++) { circle(g, r() * W, TOP + r() * (H - TOP), 0.8 + r() * 0.8); g.fill(); }   // 모래 알갱이
    const sea = g.createLinearGradient(0, 0, 0, TOP); sea.addColorStop(0, '#2f6fa0'); sea.addColorStop(1, '#4fa3c0');
    g.fillStyle = sea; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); for (let x = W; x >= 0; x -= 6) g.lineTo(x, TOP - 8 + Math.sin(x / 26) * 5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, TOP - 8 + Math.sin(x / 26) * 5); g.stroke();   // 거품
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5; for (const y of [26, 56, 84]) { g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / 20 + y) * 3); g.stroke(); }
    const umb = (x, y, a, b) => { g.fillStyle = 'rgba(0,0,0,.18)'; circle(g, x + 6, y + 8, 30); g.fill(); for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(x, y); g.arc(x, y, 28, k * Math.PI / 4, (k + 1) * Math.PI / 4); g.closePath(); g.fillStyle = k % 2 ? a : b; g.fill(); } circle(g, x, y, 28); g.strokeStyle = OLC; g.lineWidth = 1.4; g.stroke(); circle(g, x, y, 3); g.fillStyle = '#eee'; g.fill(); };
    const towel = (x, y, c) => { obox(g, x, y, 30, 52, 3, c, 1.2); g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 3; k++) g.fillRect(x + 2, y + 10 + k * 14, 26, 4); };
    umb(18, 190, '#e85a5a', '#f6f0e6'); towel(30, 230, '#5ab0e8'); umb(W - 18, 330, '#3f8ad8', '#f6f0e6'); towel(W - 58, 360, '#f2c230');
    umb(14, 480, '#f2a23a', '#f6f0e6'); towel(W - 38, 520, '#e870a0');
    for (const [x, y] of [[60, 160], [W - 70, 250], [44, 410], [W - 50, 600], [80, 590]]) { g.fillStyle = '#f2d8c8'; g.beginPath(); g.moveTo(x - 6, y + 4); g.quadraticCurveTo(x, y - 8, x + 6, y + 4); g.closePath(); g.fill(); g.strokeStyle = OLC; g.lineWidth = 0.9; g.stroke(); }   // 조개
    calm(g, W, H, 0.22);
  };

  /* ---------- 공항: 출국장 (광택 타일 · 활주로 창 · 대기 의자 · 짐) ---------- */
  BG.airport = (g, W, H) => {
    const TOP = 92;
    tiles(g, TOP, W, H, 48, '#c8ccd2', '#c0c4cb', 'rgba(70,80,95,.3)');
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(W / 2 - 60, TOP, 120, H - TOP);                 // 바닥 광택
    const sky = g.createLinearGradient(0, 0, 0, 70); sky.addColorStop(0, '#f2a26a'); sky.addColorStop(1, '#f6d08a');
    g.fillStyle = sky; g.fillRect(0, 0, W, 70); g.fillStyle = '#3a3a48'; g.fillRect(0, 70, W, 22);
    g.fillStyle = '#ffd36b'; for (let x = 6; x < W; x += 18) g.fillRect(x, 80, 8, 2);                   // 활주로 불빛
    g.fillStyle = '#4a4a5a'; g.beginPath(); g.moveTo(170, 48); g.lineTo(262, 46); g.lineTo(276, 40); g.lineTo(272, 50); g.lineTo(176, 54); g.closePath(); g.fill(); g.beginPath(); g.moveTo(214, 48); g.lineTo(232, 30); g.lineTo(240, 30); g.lineTo(230, 48); g.fill();   // 비행기
    g.fillStyle = '#5a6272'; for (let x = 0; x <= W; x += 60) g.fillRect(x, 0, 4, 92); g.strokeStyle = OLC; g.lineWidth = 1.2; g.strokeRect(0, 0, W, 92);
    const sh = g.createLinearGradient(0, TOP, 0, TOP + 16); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, TOP, W, 16);
    const seats = (x, y) => { shadowed(g, () => obox(g, x, y, 26, 120, 3, '#9aa2ae')); for (let k = 0; k < 4; k++) obox(g, x + 3, y + 4 + k * 29, 20, 25, 4, '#3f7ad0', 1.1); };
    for (const y of [130, 330]) { seats(4, y); seats(W - 30, y); }
    const bag = (x, y, c) => { obox(g, x, y, 22, 30, 4, c, 1.2); obox(g, x + 6, y - 6, 10, 7, 2, '#2f2f36', 1, false); };
    bag(36, 170, '#e85a5a'); bag(W - 58, 380, '#f2c230'); bag(34, 520, '#5ab0a0'); bag(W - 56, 560, '#8a6ad8');
    for (const y of [270, 480]) for (const side of [0, 1]) { const x = side ? W - 34 : 6; obox(g, x, y, 28, 28, 4, '#6a8a5a', 1.2); circle(g, x + 14, y + 8, 9); g.fillStyle = '#4f8a4a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke(); }   // 잎 화분 (꽃 없음)
    calm(g, W, H, 0.22);
  };

  /* ---------- 병원: 복도 (민트 타일 · 문과 안내판 · 손잡이 레일 · 대기 의자) ---------- */
  BG.hospital = (g, W, H) => {
    const TOP = 88;
    tiles(g, TOP, W, H, 40, '#bcd6d2', '#b4cfcb', 'rgba(60,90,90,.3)');
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(W / 2 - 50, TOP, 100, H - TOP);
    topWall(g, W, TOP, '#dfe8e6');
    for (const x of [24, W - 64]) { obox(g, x, 14, 40, 66, 2, '#7aa8b0'); g.fillStyle = '#bfe6ec'; g.fillRect(x + 8, 22, 24, 18); circle(g, x + 32, 50, 2.2); g.fillStyle = '#e8e2c0'; g.fill(); }   // 문
    obox(g, W / 2 - 46, 20, 92, 34, 4, '#f6fbfa'); g.fillStyle = '#e85a6a'; g.fillRect(W / 2 - 4, 26, 8, 22); g.fillRect(W / 2 - 11, 33, 22, 8);   // 안내판 (빨간 십자)
    g.fillStyle = '#8fb0b4'; g.fillRect(0, 64, W, 5); g.strokeStyle = OLC; g.lineWidth = 0.8; g.strokeRect(0, 64, W, 5);   // 손잡이 레일
    const bench = (x, y) => { shadowed(g, () => obox(g, x, y, 26, 110, 3, '#9ab4b8')); for (let k = 0; k < 4; k++) obox(g, x + 3, y + 4 + k * 26, 20, 22, 4, '#5aa0a8', 1.1); };
    for (const y of [140, 360]) { bench(4, y); bench(W - 30, y); }
    for (const [x, y] of [[8, 290], [W - 40, 520]]) { shadowed(g, () => obox(g, x, y, 32, 40, 3, '#e8eef0')); g.fillStyle = '#7ac0d0'; g.fillRect(x + 6, y + 6, 20, 12); }   // 정수기
    for (const [x, y] of [[W - 36, 290], [6, 520]]) { obox(g, x, y, 30, 30, 4, '#6a8a5a', 1.2); circle(g, x + 15, y + 9, 9); g.fillStyle = '#4f8a4a'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke(); }
    calm(g, W, H, 0.2);
  };

  /* ---------- 산: 정상 가는 길 (풀밭 · 가운데 흙길 · 소나무 · 바위 · 먼 봉우리) ---------- */
  BG.mountain = (g, W, H) => {
    const TOP = 100;
    g.fillStyle = '#5a8a4a'; g.fillRect(0, TOP - 10, W, H - TOP + 10);
    const r = rng(91); g.fillStyle = 'rgba(30,70,30,.35)'; for (let i = 0; i < 220; i++) { const x = r() * W, y = TOP + r() * (H - TOP); g.fillRect(x, y, 1.4, 4); }   // 풀잎
    g.fillStyle = '#a8855a'; g.beginPath(); g.moveTo(W / 2 - 40, H); for (let y = H; y >= TOP; y -= 20) g.lineTo(W / 2 - 46 + Math.sin(y / 70) * 18, y); for (let y = TOP; y <= H; y += 20) g.lineTo(W / 2 + 46 + Math.sin(y / 70) * 18, y); g.closePath(); g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.2; g.stroke();   // 흙길
    g.fillStyle = 'rgba(80,55,30,.35)'; for (let i = 0; i < 60; i++) { circle(g, W / 2 + (r() - 0.5) * 70 + Math.sin(i) * 10, TOP + r() * (H - TOP), 1 + r() * 1.5); g.fill(); }
    const sky = g.createLinearGradient(0, 0, 0, TOP); sky.addColorStop(0, '#9cc8e8'); sky.addColorStop(1, '#d6e8f2'); g.fillStyle = sky; g.fillRect(0, 0, W, TOP - 10);
    const peak = (x, w, h, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x - w, TOP - 10); g.lineTo(x, TOP - 10 - h); g.lineTo(x + w, TOP - 10); g.closePath(); g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#f6f8fa'; g.beginPath(); g.moveTo(x - w * 0.28, TOP - 10 - h * 0.72); g.lineTo(x, TOP - 10 - h); g.lineTo(x + w * 0.28, TOP - 10 - h * 0.72); g.closePath(); g.fill(); };
    peak(90, 110, 70, '#7a8aa8'); peak(260, 120, 84, '#6a7a98');
    const pine = (x, y, s) => { g.fillStyle = 'rgba(0,0,0,.22)'; circle(g, x + 4, y + 6, 18 * s); g.fill(); for (let k = 0; k < 3; k++) { circle(g, x, y, (18 - k * 5) * s); g.fillStyle = ['#2f6a3a', '#3a7a44', '#4a8a50'][k]; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1.1; g.stroke(); } };
    for (const [x, y, s] of [[18, 150, 1.1], [W - 20, 210, 1.2], [24, 300, 1], [W - 16, 380, 1.1], [14, 460, 1.2], [W - 24, 540, 1], [30, 610, 1]]) pine(x, y, s);
    const rock = (x, y, w) => obox(g, x, y, w, w * 0.7, w * 0.3, '#9a9aa4', 1.2);
    rock(54, 220, 24); rock(W - 70, 300, 20); rock(56, 520, 22); rock(W - 64, 600, 26);
    calm(g, W, H, 0.22);
  };

  /* ---------- 꿈의 무대: 무대 (짙은 무대 바닥 · 빨간 커튼 · 조명 · 스피커) ---------- */
  BG.stage = (g, W, H) => {
    const TOP = 92;
    vplanks(g, TOP, W, H, 18, ['#4a3a3a', '#523f3e', '#463636', '#4e3c3a'], 101);
    for (const [x, y] of [[W / 2, 250], [W / 2 - 80, 430], [W / 2 + 80, 430]]) pool(g, x, y, 110, 'rgba(255,240,200,A)', 0.14);   // 조명 웅덩이
    g.fillStyle = '#2a1e2e'; g.fillRect(0, 0, W, TOP);
    for (let i = 0; i < 12; i++) { const x = i * 32; g.fillStyle = i % 2 ? '#b82a3e' : '#a2223a'; g.fillRect(x, 0, 32, TOP - 8); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 24, 0, 8, TOP - 8); }   // 커튼 주름
    g.fillStyle = '#d8a63a'; g.fillRect(0, TOP - 10, W, 6); g.strokeStyle = OLC; g.lineWidth = 1.2; g.strokeRect(0, TOP - 10, W, 6);   // 금색 테
    for (let x = 30; x < W; x += 60) { circle(g, x, 10, 7); g.fillStyle = '#ffe9a8'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke(); }   // 조명
    const sh = g.createLinearGradient(0, TOP, 0, TOP + 18); sh.addColorStop(0, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, TOP, W, 18);
    const speaker = (x, y) => { shadowed(g, () => obox(g, x, y, 34, 48, 3, '#2f2f36')); for (const cy of [y + 14, y + 34]) { circle(g, x + 17, cy, 9); g.fillStyle = '#1a1a20'; g.fill(); g.strokeStyle = '#5a5a66'; g.lineWidth = 1.5; g.stroke(); } };
    for (const y of [130, 330, 530]) { speaker(2, y); speaker(W - 36, y); }
    for (const [x, y] of [[50, 240], [W - 50, 440]]) { g.strokeStyle = '#8a8a96'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x, y); g.stroke(); circle(g, x, y - 4, 5); g.fillStyle = '#3a3a44'; g.fill(); g.strokeStyle = OLC; g.lineWidth = 1; g.stroke(); circle(g, x, y + 28, 8); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill(); }   // 마이크 스탠드
    g.fillStyle = '#d8a63a'; for (let x = 8; x < W; x += 24) { circle(g, x, H - 8, 3); g.fill(); }   // 앞쪽 조명 줄
    calm(g, W, H, 0.2);
  };
})(typeof window !== 'undefined' ? window : globalThis);
