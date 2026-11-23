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

  /* ---------- 학원: 밤 자습실 ---------- */
  BG.academy = (g, W, H) => {
    g.fillStyle = '#231c33'; g.fillRect(0, 0, W, H);
    const r = rng(21); for (let y = 0; y < H; y += 4) { g.fillStyle = `rgba(255,255,255,${0.008 + r() * 0.01})`; g.fillRect(0, y, W, 2); }   // 카펫 결
    grain(g, 0, 0, W, H, 1600, 0.12, 22, '#000');
    wall(g, W, 92, '#2c2440', '#241d36');
    for (let i = 0; i < 3; i++) { const x = 18 + i * ((W - 36) / 3); withShadow(g, 6, 3, () => box(g, x, 14, (W - 36) / 3 - 8, 66, 2, '#3a2a22')); for (let s = 0; s < 3; s++) { g.fillStyle = '#2a1e18'; g.fillRect(x + 3, 16 + s * 21, (W - 36) / 3 - 14, 19); shelfBooks(g, x + 4, 17 + s * 21, (W - 36) / 3 - 16, 17, 30 + i * 3 + s); } }
    // 양옆 칸막이 책상 + 스탠드 불빛
    for (let i = 0; i < 5; i++) for (const side of [0, 1]) {
      const x = side ? W - 60 : 8, y = 140 + i * 92;
      withShadow(g, 7, 4, () => box(g, x, y, 52, 50, 3, '#3a3050', '#46395e'));
      g.fillStyle = '#2a2240'; g.fillRect(side ? x : x + 46, y, 6, 50);
      g.fillStyle = '#e8e2d0'; g.fillRect(x + 10, y + 18, 18, 13); g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) g.fillRect(x + 12, y + 21 + k * 2.6, 13, 0.7);   // 공책
      pool(g, x + (side ? 38 : 14), y + 14, 46, 'rgba(255,214,140,A)', 0.22);
      circle(g, x + (side ? 38 : 14), y + 10, 3); g.fillStyle = '#ffe9a8'; g.fill();
    }
    g.strokeStyle = 'rgba(255,110,150,.10)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, 96); g.lineTo(W / 2, H); g.stroke();
  };

  /* ---------- 회사: 밤 사무실 ---------- */
  BG.office = (g, W, H) => {
    tileFloor(g, 0, 0, W, H, 40, '#273640', '#1d2a33', 31, 0.12);                       // 카펫 타일
    grain(g, 0, 0, W, H, 1800, 0.12, 32, '#000');
    // 위: 통유리 너머 도시 야경
    const sky = g.createLinearGradient(0, 0, 0, 92); sky.addColorStop(0, '#0e1630'); sky.addColorStop(1, '#22305a');
    g.fillStyle = sky; g.fillRect(0, 0, W, 92);
    const r = rng(33);
    for (let x = 0; x < W;) { const bw = 18 + r() * 30, bh = 20 + r() * 60; g.fillStyle = shade('#16203c', r() * 0.2); g.fillRect(x, 92 - bh, bw, bh); for (let wy = 92 - bh + 4; wy < 88; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r() < 0.35) { g.fillStyle = `rgba(255,220,140,${0.4 + r() * 0.4})`; g.fillRect(wx, wy, 2, 2.4); } x += bw + 2; }
    g.fillStyle = '#3a4a56'; for (let x = 0; x <= W; x += 72) g.fillRect(x, 0, 4, 92);   // 창틀
    g.fillStyle = '#2b3944'; g.fillRect(0, 88, W, 8);
    const sh = g.createLinearGradient(0, 96, 0, 120); sh.addColorStop(0, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 96, W, 24);
    // 양옆 칸막이 책상 + 모니터 빛
    for (let i = 0; i < 4; i++) for (const side of [0, 1]) {
      const x = side ? W - 74 : 6, y = 132 + i * 112;
      withShadow(g, 8, 4, () => box(g, x, y, 68, 40, 3, '#3a4752', '#47566a'));
      g.fillStyle = '#5d6d7a'; g.fillRect(side ? x : x + 64, y - 6, 4, 52);              // 칸막이
      withShadow(g, 4, 2, () => box(g, x + 18, y + 6, 30, 18, 2, '#1b252e'));
      g.fillStyle = 'rgba(110,210,255,.55)'; g.fillRect(x + 20, y + 8, 26, 14);
      pool(g, x + 33, y + 16, 40, 'rgba(110,210,255,A)', 0.14);
      g.fillStyle = '#2a333c'; rrect(g, x + 22, y + 28, 22, 6, 2); g.fill();               // 키보드
      if (i % 2 === 0) { circle(g, x + (side ? 10 : 58), y + 10, 6); g.fillStyle = '#3d6b45'; g.fill(); }   // 작은 화분 (드물게)
    }
  };

  /* ---------- 지하철: 승강장 ---------- */
  BG.subway = (g, W, H) => {
    tileFloor(g, 0, 0, W, H, 32, '#3b3f48', '#2a2e36', 41, 0.1);
    // 위: 선로 (자갈·침목·레일)
    g.fillStyle = '#1b1c20'; g.fillRect(0, 0, W, 78); grain(g, 0, 0, W, 78, 900, 0.5, 42, '#4a4a50');
    for (let x = -6; x < W; x += 22) { g.fillStyle = '#3a2e26'; g.fillRect(x, 10, 12, 58); }
    for (const y of [22, 54]) { g.fillStyle = '#8a8f99'; g.fillRect(0, y, W, 4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y, W, 1); }
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 78, W, 8);                                    // 승강장 끝
    g.fillStyle = '#f2c230'; g.fillRect(0, 86, W, 12);                                   // 노란 안전선 (점자 블록)
    for (let x = 4; x < W; x += 8) for (const y of [89, 94]) { circle(g, x, y, 1.4); g.fillStyle = '#d8a920'; g.fill(); }
    const sh = g.createLinearGradient(0, 98, 0, 116); sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 98, W, 18);
    // 양옆 기둥 + 광고판
    for (let i = 0; i < 3; i++) for (const x of [6, W - 34]) {
      const y = 150 + i * 160;
      withShadow(g, 10, 5, () => box(g, x, y, 28, 70, 2, '#5a606b', '#6b717d'));
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 3, y, 3, 70);
    }
    for (let i = 0; i < 2; i++) { const y = 225 + i * 160; for (const x of [4, W - 36]) { withShadow(g, 6, 3, () => box(g, x, y, 32, 46, 2, '#e8ecf2')); g.fillStyle = ['#ff8a65', '#4fc3f7', '#aed581', '#ba68c8'][i * 2 + (x > 100 ? 1 : 0)]; g.fillRect(x + 3, y + 3, 26, 26); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, y + 33, 22, 2); g.fillRect(x + 4, y + 38, 15, 2); } }
    // 형광등 빛 줄
    for (let y = 130; y < H; y += 120) pool(g, W / 2, y, 150, 'rgba(220,240,255,A)', 0.06);
  };

  /* ---------- 집: 밤 거실 ---------- */
  BG.home = (g, W, H) => {
    woodFloor(g, 0, 0, W, H, '#4a3a34', 20, 51);
    g.fillStyle = 'rgba(14,16,40,.28)'; g.fillRect(0, 0, W, H);
    wall(g, W, 92, '#232a48', '#1d2340');
    // 창문과 달빛
    withShadow(g, 6, 3, () => box(g, W - 130, 12, 104, 66, 3, '#4a3b30'));
    const win = g.createLinearGradient(0, 16, 0, 74); win.addColorStop(0, '#16224a'); win.addColorStop(1, '#2c3d74');
    g.fillStyle = win; g.fillRect(W - 126, 16, 96, 58);
    circle(g, W - 56, 34, 9); g.fillStyle = '#fff3c4'; g.fill(); pool(g, W - 56, 34, 26, 'rgba(255,243,196,A)', 0.35);
    g.fillStyle = '#4a3b30'; g.fillRect(W - 80, 16, 4, 58); g.fillRect(W - 126, 43, 96, 3);
    g.fillStyle = 'rgba(170,190,255,.05)'; g.beginPath(); g.moveTo(W - 126, 96); g.lineTo(W - 30, 96); g.lineTo(W - 150, H * 0.7); g.lineTo(W - 280, H * 0.7); g.closePath(); g.fill();   // 바닥 달빛
    // 왼쪽 위 소파, 책장
    withShadow(g, 8, 4, () => box(g, 16, 30, 120, 50, 10, '#5a3d5c', '#6b4a6e'));
    box(g, 22, 52, 52, 24, 7, '#6e4c70'); box(g, 78, 52, 52, 24, 7, '#6e4c70');
    // 가운데 둥근 러그 (낮은 대비)
    oval(g, W / 2, H * 0.5, 130, 90); g.fillStyle = 'rgba(120,90,140,.16)'; g.fill();
    oval(g, W / 2, H * 0.5, 112, 76); g.strokeStyle = 'rgba(200,170,220,.10)'; g.lineWidth = 3; g.stroke();
    // 양옆 스탠드 불빛
    for (const [x, y] of [[26, 300], [W - 26, 470]]) { pool(g, x, y, 70, 'rgba(255,200,120,A)', 0.18); circle(g, x, y, 8); g.fillStyle = '#e8c27a'; g.fill(); }
    withShadow(g, 6, 4, () => box(g, W - 46, 140, 40, 120, 2, '#3e2f28'));
    for (let s = 0; s < 4; s++) { g.fillStyle = '#2b201b'; g.fillRect(W - 43, 144 + s * 29, 34, 26); shelfBooks(g, W - 42, 145 + s * 29, 32, 24, 60 + s); }
  };

  /* ---------- 체육관: 농구 코트 ---------- */
  BG.gym = (g, W, H) => {
    // 세로 판자 (밝은 메이플) + 광택
    const r = rng(71);
    for (let x = 0; x < W; x += 14) { g.fillStyle = shade('#7a5434', (r() - 0.5) * 0.14); g.fillRect(x, 0, 14, H); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 1, H); for (let y = r() * 160; y < H; y += 120 + r() * 120) g.fillRect(x, y, 14, 1); }
    g.fillStyle = 'rgba(24,12,10,.5)'; g.fillRect(0, 0, W, H);
    for (const y of [180, 470]) pool(g, W / 2, y, 200, 'rgba(255,240,210,A)', 0.09);   // 천장 조명 반사
    // 코트 선
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2.5;
    g.strokeRect(12, 100, W - 24, H - 120);
    g.beginPath(); g.moveTo(12, H / 2 + 40); g.lineTo(W - 12, H / 2 + 40); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2 + 40, 46, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(200,60,60,.18)'; g.fillRect(W / 2 - 50, 100, 100, 110); g.strokeRect(W / 2 - 50, 100, 100, 110);   // 페인트 존
    g.beginPath(); g.arc(W / 2, 210, 50, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(W / 2, 100, 150, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();      // 3점 라인
    // 위: 관중석 계단
    for (let i = 0; i < 4; i++) { g.fillStyle = shade('#3d4660', -i * 0.08); g.fillRect(0, i * 22, W, 22); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, i * 22 + 20, W, 2); }
    const r2 = rng(72); for (let i = 0; i < 40; i++) { const x = r2() * W, y = 6 + Math.floor(r2() * 4) * 22; circle(g, x, y + 6, 4); g.fillStyle = `rgba(${150 + r2() * 80},${120 + r2() * 80},${130 + r2() * 90},.35)`; g.fill(); }
    withShadow(g, 6, 4, () => box(g, W / 2 - 30, 88, 60, 12, 2, '#e8e8e8'));             // 골대 백보드
    g.strokeStyle = '#ff6d3a'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(W / 2, 106, 10, 4, 0, 0, Math.PI * 2); g.stroke();
  };

  /* ---------- 도서관: 서가 사이 열람실 ---------- */
  BG.library = (g, W, H) => {
    g.fillStyle = '#3a1f22'; g.fillRect(0, 0, W, H);
    const r = rng(81); for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; const y = r() * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (r() - 0.5) * 10); g.stroke(); }
    grain(g, 0, 0, W, H, 2200, 0.15, 82, '#000');
    // 카펫 무늬 테두리
    g.strokeStyle = 'rgba(214,170,90,.12)'; g.lineWidth = 3; g.strokeRect(60, 120, W - 120, H - 180); g.lineWidth = 1; g.strokeRect(68, 128, W - 136, H - 196);
    // 위: 큰 서가
    g.fillStyle = '#2a1a14'; g.fillRect(0, 0, W, 96);
    for (let s = 0; s < 4; s++) { g.fillStyle = '#4a2f22'; g.fillRect(0, 2 + s * 23, W, 3); shelfBooks(g, 2, 5 + s * 23, W - 4, 19, 83 + s); }
    const sh = g.createLinearGradient(0, 96, 0, 122); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 96, W, 26);
    // 양옆 낮은 서가
    for (const x of [0, W - 30]) {
      withShadow(g, 8, 0, () => box(g, x, 120, 30, H - 170, 2, '#3e2619'));
      for (let s = 0; s < 12; s++) { g.fillStyle = '#2a1a12'; g.fillRect(x + 3, 124 + s * 37, 24, 34); shelfBooks(g, x + 4, 125 + s * 37, 22, 32, 90 + s + x); }
    }
    // 열람 테이블 + 초록 스탠드 불빛 (가장자리 쪽)
    for (const [x, y] of [[70, 200], [W - 70, 330], [70, 460]]) {
      pool(g, x, y, 80, 'rgba(255,220,150,A)', 0.2);
      withShadow(g, 7, 4, () => box(g, x - 30, y - 14, 60, 30, 3, '#5a3a28', '#6b4630'));
      circle(g, x + 14, y - 4, 5); g.fillStyle = '#2e7d4f'; g.fill(); g.fillStyle = '#ffe9a8'; g.fillRect(x + 11, y - 1, 6, 2);
    }
  };

  /* ---------- 바닷가 ---------- */
  BG.beach = (g, W, H) => {
    // 모래 (위쪽은 젖은 모래, 아래로 갈수록 밝고 마른 모래)
    const sand = g.createLinearGradient(0, 110, 0, H); sand.addColorStop(0, '#8a6f4e'); sand.addColorStop(0.25, '#b8976a'); sand.addColorStop(1, '#a88a60');
    g.fillStyle = sand; g.fillRect(0, 0, W, H);
    grain(g, 0, 100, W, H - 100, 4200, 0.18, 91, '#5a4530'); grain(g, 0, 100, W, H - 100, 1800, 0.18, 92, '#fff3d8');
    g.fillStyle = 'rgba(30,20,40,.32)'; g.fillRect(0, 0, W, H);                          // 해 질 녘 톤
    // 바다: 깊이 그라데이션 + 물결 + 밀려오는 거품
    const sea = g.createLinearGradient(0, 0, 0, 120); sea.addColorStop(0, '#0f2e4f'); sea.addColorStop(0.7, '#1f5c7a'); sea.addColorStop(1, '#3d8a96');
    g.fillStyle = sea; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 108);
    for (let x = W; x >= 0; x -= 8) g.lineTo(x, 108 + Math.sin(x / 26) * 6 + Math.sin(x / 9) * 2); g.closePath(); g.fill();
    const r = rng(93); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { const x = r() * W, y = 10 + r() * 85; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 2, x + 16, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2.4; g.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = 108 + Math.sin(x / 26) * 6 + Math.sin(x / 9) * 2; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    g.fillStyle = 'rgba(80,60,40,.22)'; g.beginPath(); for (let x = 0; x <= W; x += 6) g.lineTo(x, 118 + Math.sin(x / 30) * 5); g.lineTo(W, 136); g.lineTo(0, 136); g.closePath(); g.fill();   // 젖은 모래 띠
    // 가장자리: 파라솔 그림자 · 조개 · 발자국
    for (const [x, y, col] of [[30, 320, '#e5534b'], [W - 34, 500, '#4fa3e0']]) {
      oval(g, x + 10, y + 16, 40, 14); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill();
      withShadow(g, 6, 3, () => { g.beginPath(); g.arc(x, y, 30, Math.PI, 0); g.closePath(); g.fillStyle = col; g.fill(); });
      g.fillStyle = 'rgba(255,255,255,.75)'; for (let k = -2; k <= 2; k += 2) { g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + k * 10, y); g.lineTo(x + (k + 1) * 10, y); g.closePath(); g.fill(); }
      g.fillStyle = '#ddd'; g.fillRect(x - 1, y, 2, 26);
    }
    const r2 = rng(94); for (let i = 0; i < 10; i++) { const x = r2() < 0.5 ? 10 + r2() * 50 : W - 60 + r2() * 50, y = 160 + r2() * (H - 220); oval(g, x, y, 3, 2); g.fillStyle = ['#f3d9c6', '#e9b9a5', '#fff'][i % 3]; g.fill(); }
    for (let i = 0; i < 9; i++) { const x = W * 0.72 + Math.sin(i) * 8 + (i % 2) * 7, y = 170 + i * 30; oval(g, x, y, 2.5, 4); g.fillStyle = 'rgba(80,55,35,.25)'; g.fill(); }
  };

  /* ---------- 공항: 출국장 ---------- */
  BG.airport = (g, W, H) => {
    // 광택 테라조 바닥 + 반사
    tileFloor(g, 0, 0, W, H, 60, '#3a4250', '#30363f', 101, 0.06);
    grain(g, 0, 0, W, H, 2400, 0.25, 102, '#c7cfda'); grain(g, 0, 0, W, H, 1600, 0.2, 103, '#000');
    for (let x = 30; x < W; x += 80) { const gr = g.createLinearGradient(x, 100, x + 20, H); gr.addColorStop(0, 'rgba(180,210,255,.10)'); gr.addColorStop(1, 'rgba(180,210,255,0)'); g.fillStyle = gr; g.fillRect(x, 100, 18, H); }
    // 위: 활주로가 보이는 통유리 (노을)
    const sky = g.createLinearGradient(0, 0, 0, 92); sky.addColorStop(0, '#2a2650'); sky.addColorStop(0.6, '#a85a5e'); sky.addColorStop(1, '#e09a6a');
    g.fillStyle = sky; g.fillRect(0, 0, W, 92);
    g.fillStyle = '#2d2a3a'; g.fillRect(0, 70, W, 22); g.fillStyle = '#ffd36b'; for (let x = 6; x < W; x += 18) g.fillRect(x, 80, 8, 1.6);   // 활주로 불빛
    g.fillStyle = 'rgba(30,26,46,.85)'; g.beginPath(); g.moveTo(180, 58); g.lineTo(260, 56); g.lineTo(272, 52); g.lineTo(268, 60); g.lineTo(186, 64); g.closePath(); g.fill();   // 비행기 실루엣
    g.beginPath(); g.moveTo(222, 58); g.lineTo(236, 44); g.lineTo(244, 44); g.lineTo(236, 58); g.closePath(); g.fill();
    g.fillStyle = '#4a5260'; for (let x = 0; x <= W; x += 60) g.fillRect(x, 0, 3, 92); g.fillRect(0, 90, W, 6);
    // 출발 안내판
    withShadow(g, 6, 3, () => box(g, W / 2 - 54, 104, 108, 26, 3, '#14181f'));
    for (let k = 0; k < 3; k++) { g.fillStyle = k === 0 ? '#ffd36b' : 'rgba(255,211,107,.6)'; g.fillRect(W / 2 - 48, 109 + k * 6.5, 50, 3); g.fillStyle = '#7dffb2'; g.fillRect(W / 2 + 22, 109 + k * 6.5, 20, 3); }
    // 양옆 대기 의자 줄
    for (let i = 0; i < 4; i++) for (const x of [10, W - 34]) {
      const y = 170 + i * 110;
      withShadow(g, 6, 4, () => box(g, x, y, 24, 70, 4, '#2b4f7a', '#3a6393'));
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 1; k < 4; k++) g.fillRect(x + 2, y + k * 17.5, 20, 1.5);
    }
  };

  /* ---------- 병원: 복도 ---------- */
  BG.hospital = (g, W, H) => {
    tileFloor(g, 0, 0, W, H, 36, '#2f4844', '#27403c', 111, 0.08);
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(W / 2 - 50, 0, 100, H);              // 복도 반사광
    wall(g, W, 92, '#3e5a62', '#34505a');
    g.fillStyle = '#8fb0b4'; g.fillRect(0, 62, W, 5); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 62, W, 1.5);   // 손잡이 레일
    withShadow(g, 6, 3, () => box(g, W / 2 - 46, 14, 92, 30, 4, '#e8f1ef'));                // 안내판
    g.fillStyle = '#e53935'; g.fillRect(W / 2 - 38, 24, 4, 12); g.fillRect(W / 2 - 42, 28, 12, 4);
    g.fillStyle = '#5a7a80'; for (let k = 0; k < 3; k++) g.fillRect(W / 2 - 22, 21 + k * 6, 56 - k * 12, 3);
    for (const x of [28, W - 64]) { withShadow(g, 5, 3, () => box(g, x, 12, 36, 50, 2, '#6b8f96')); g.fillStyle = '#8fd0d8'; g.fillRect(x + 6, 18, 24, 16); }   // 문
    // 양옆 침대 + 커튼
    for (let i = 0; i < 3; i++) for (const side of [0, 1]) {
      const x = side ? W - 62 : 6, y = 150 + i * 150;
      g.fillStyle = 'rgba(150,200,210,.18)'; g.fillRect(side ? x - 6 : x + 56, y - 20, 6, 110);   // 커튼
      withShadow(g, 8, 4, () => box(g, x, y, 56, 84, 5, '#a9bcbf', '#bccdd0'));
      box(g, x + 8, y + 6, 40, 16, 6, '#cfdcde'); box(g, x + 2, y + 34, 52, 46, 4, '#5a8d99');   // 베개 · 이불
    }
    for (let y = 120; y < H; y += 140) pool(g, W / 2, y, 120, 'rgba(220,255,250,A)', 0.07);
  };

  /* ---------- 산: 정상 가는 길 ---------- */
  BG.mountain = (g, W, H) => {
    // 땅: 흙길(가운데) + 풀 + 바위
    g.fillStyle = '#3a4434'; g.fillRect(0, 0, W, H);
    grain(g, 0, 0, W, H, 3000, 0.2, 121, '#1e2a1c'); grain(g, 0, 0, W, H, 1400, 0.16, 122, '#6f8a5a');
    g.fillStyle = 'rgba(120,96,70,.35)'; g.beginPath(); g.moveTo(W / 2 - 40, 110); g.bezierCurveTo(W / 2 + 60, 260, W / 2 - 80, 420, W / 2 + 10, H); g.lineTo(W / 2 + 110, H); g.bezierCurveTo(W / 2 + 20, 420, W / 2 + 160, 260, W / 2 + 40, 110); g.closePath(); g.fill();
    grain(g, W / 2 - 80, 110, 200, H - 110, 900, 0.22, 123, '#2a2018');
    // 위: 하늘 + 눈 덮인 봉우리
    const sky = g.createLinearGradient(0, 0, 0, 110); sky.addColorStop(0, '#2a3a5e'); sky.addColorStop(1, '#6c7fa0');
    g.fillStyle = sky; g.fillRect(0, 0, W, 110);
    const peak = (pts, col, snow) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 110); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(W, 110); g.closePath(); g.fill(); if (snow) { g.fillStyle = 'rgba(240,246,255,.85)'; pts.forEach(([x, y], i) => { if (y < 60) { g.beginPath(); g.moveTo(x - 14, y + 16); g.lineTo(x, y); g.lineTo(x + 14, y + 16); g.lineTo(x + 5, y + 12); g.lineTo(x, y + 18); g.lineTo(x - 6, y + 12); g.closePath(); g.fill(); } }); } };
    peak([[0, 70], [60, 40], [120, 76], [190, 28], [260, 70], [320, 44], [W, 62]], '#4a5878', true);
    peak([[0, 96], [70, 74], [140, 98], [220, 80], [300, 100], [W, 86]], '#35445e', false);
    g.fillStyle = 'rgba(220,230,255,.18)'; g.fillRect(0, 96, W, 14);                      // 안개 띠
    // 양옆 소나무 + 바위
    const tree = (x, y, s) => { oval(g, x + 4, y + 22 * s, 14 * s, 5 * s); g.fillStyle = 'rgba(0,0,0,.3)'; g.fill(); for (let k = 0; k < 3; k++) { g.fillStyle = shade('#2f5a3a', -k * 0.1); g.beginPath(); g.moveTo(x, y - 22 * s + k * 10 * s); g.lineTo(x + (12 + k * 3) * s, y + k * 9 * s); g.lineTo(x - (12 + k * 3) * s, y + k * 9 * s); g.closePath(); g.fill(); } g.fillStyle = '#4a3326'; g.fillRect(x - 2 * s, y + 18 * s, 4 * s, 6 * s); };
    const r = rng(124);
    for (let i = 0; i < 7; i++) { tree(14 + r() * 26, 150 + i * 72, 0.9 + r() * 0.3); tree(W - 14 - r() * 26, 190 + i * 70, 0.9 + r() * 0.3); }
    for (let i = 0; i < 6; i++) { const x = r() < 0.5 ? 50 + r() * 30 : W - 80 + r() * 30, y = 160 + r() * (H - 220); withShadow(g, 5, 3, () => { oval(g, x, y, 9 + r() * 6, 6 + r() * 3); g.fillStyle = '#6b6f78'; g.fill(); }); }
  };

  /* ---------- 꿈의 무대 ---------- */
  BG.stage = (g, W, H) => {
    woodFloor(g, 0, 0, W, H, '#3a2418', 18, 131);
    g.fillStyle = 'rgba(30,8,30,.45)'; g.fillRect(0, 0, W, H);
    // 위: 붉은 벨벳 커튼 (주름 그라데이션) + 금색 테
    for (let x = 0; x < W; x += 24) { const gr = g.createLinearGradient(x, 0, x + 24, 0); gr.addColorStop(0, '#5a0f22'); gr.addColorStop(0.5, '#9a1e3a'); gr.addColorStop(1, '#5a0f22'); g.fillStyle = gr; g.fillRect(x, 0, 24, 84); }
    g.fillStyle = '#c99a3a'; g.fillRect(0, 84, W, 5); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, 84, W, 1);
    for (let x = 0; x < W; x += 24) { g.fillStyle = '#7a1630'; g.beginPath(); g.arc(x + 12, 89, 12, 0, Math.PI); g.fill(); }   // 술 장식
    // 양옆 커튼 자락
    for (const side of [0, 1]) { const gr = g.createLinearGradient(side ? W : 0, 0, side ? W - 30 : 30, 0); gr.addColorStop(0, '#4a0c1c'); gr.addColorStop(1, 'rgba(120,20,46,0)'); g.fillStyle = gr; g.fillRect(side ? W - 30 : 0, 0, 30, H); }
    // 스포트라이트 원뿔과 바닥 빛
    for (const [x, col] of [[90, 'rgba(255,200,255,A)'], [W / 2, 'rgba(255,240,190,A)'], [W - 90, 'rgba(180,220,255,A)']]) {
      g.fillStyle = col.replace('A', 0.06); g.beginPath(); g.moveTo(x - 10, 92); g.lineTo(x + 10, 92); g.lineTo(x + 80, H * 0.75); g.lineTo(x - 80, H * 0.75); g.closePath(); g.fill();
      oval(g, x, H * 0.75, 80, 26); g.fillStyle = col.replace('A', 0.08); g.fill();
    }
    // 아래 앞쪽 조명 줄
    for (let x = 20; x < W; x += 40) { circle(g, x, H - 8, 4); g.fillStyle = '#ffd36b'; g.fill(); pool(g, x, H - 8, 22, 'rgba(255,211,107,A)', 0.25); }
    const r = rng(132); for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(40 + r() * (W - 80), 110 + r() * (H - 160), 1.5, 1.5); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
