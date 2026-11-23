/* Endless Me — 새 그림체: 학원 ~ 꿈의 무대 (11개 월드)
 *
 * 학교 월드와 같은 규칙(굵은 외곽선 · 단순한 면 · 큰 눈)으로, 공통 "몸 모양 + 눈 + 입 + 소품" 조합기로 그린다.
 * 적 하나 = { shape, col, eyes, mouth, acc } 한 줄. 새 적을 추가할 때는 아래 표에 한 줄만 넣으면 된다.
 */
(function (root) {
  'use strict';
  const Art = root.Art;
  if (!Art) return;
  const { ENEMY, BOSS, BG, HELPER, OL, circle, oval, rrect, fillStroke, eye } = Art._kit;
  const TAU = Math.PI * 2;

  function shade(hex, k) {   // 색을 밝게(k>0)/어둡게(k<0)
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function line(g, pts, lw, col) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = lw; g.strokeStyle = col || OL; g.stroke(); }
  function star(g, n, r1, r2, sy) { g.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? r2 : r1; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * (sy || 1)); } g.closePath(); }

  /* ---------- 몸 모양: 그린 뒤 얼굴 중심(fx, fy)과 얼굴 크기(fs)를 돌려준다 ---------- */
  const SHAPE = {
    blob(g, r, c) { oval(g, 0, 0, r, r * 0.92); fillStroke(g, c.col, 2); return [0, 0, 1]; },
    round(g, r, c) { oval(g, -r * 0.4, r * 0.95, r * 0.28, r * 0.14); fillStroke(g, shade(c.col, -0.35), 1.4); oval(g, r * 0.4, r * 0.95, r * 0.28, r * 0.14); fillStroke(g, shade(c.col, -0.35), 1.4); circle(g, 0, 0, r); fillStroke(g, c.col, 2); return [0, 0, 1]; },
    drop(g, r, c) {
      g.beginPath(); g.moveTo(0, -r * 1.3); g.bezierCurveTo(r * 0.5, -r * 0.6, r, -r * 0.1, r * 0.95, r * 0.35); g.arc(0, r * 0.35, r * 0.95, 0, Math.PI);
      g.bezierCurveTo(-r, -r * 0.1, -r * 0.5, -r * 0.6, 0, -r * 1.3); g.closePath(); fillStroke(g, c.col, 2); return [0, r * 0.3, 0.95];
    },
    cloud(g, r, c) {
      const C = [[-0.55, 0.1, 0.52], [0, -0.35, 0.62], [0.55, 0.05, 0.52], [-0.22, 0.42, 0.48], [0.3, 0.42, 0.48]];
      g.lineWidth = 4.2; g.strokeStyle = OL; for (const [x, y, s] of C) { circle(g, x * r, y * r, s * r); g.stroke(); }
      g.fillStyle = c.col; for (const [x, y, s] of C) { circle(g, x * r, y * r, s * r); g.fill(); }
      return [0, r * 0.08, 0.95];
    },
    square(g, r, c) { rrect(g, -r, -r * 0.9, r * 2, r * 1.8, r * 0.45); fillStroke(g, c.col, 2); return [0, 0, 1]; },
    spiky(g, r, c) { star(g, 9, r * 1.1, r * 0.78); fillStroke(g, c.col, 2); circle(g, 0, 0, r * 0.7); g.fillStyle = shade(c.col, 0.15); g.fill(); return [0, 0, 0.85]; },
    flat(g, r, c) { oval(g, 0, r * 0.3, r * 1.3, r * 0.62); fillStroke(g, c.col, 2); oval(g, -r * 0.2, r * 0.05, r * 0.7, r * 0.45); g.fillStyle = shade(c.col, 0.12); g.fill(); return [0, r * 0.15, 0.85]; },
    device(g, r, c) {
      rrect(g, -r * 0.85, -r * 1.1, r * 1.7, r * 2.2, r * 0.35); fillStroke(g, c.col, 2);
      rrect(g, -r * 0.62, -r * 0.85, r * 1.24, r * 1.4, r * 0.18); g.fillStyle = c.col2 || '#9be7ff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OL; g.stroke();
      circle(g, 0, r * 0.82, r * 0.12); g.fillStyle = OL; g.fill(); return [0, -r * 0.15, 0.85];
    },
    wide(g, r, c) {   // 프린터·확성기처럼 넓은 기계
      rrect(g, -r * 1.1, -r * 0.55, r * 2.2, r * 1.3, r * 0.3); fillStroke(g, c.col, 2);
      rrect(g, -r * 0.7, -r * 0.95, r * 1.4, r * 0.45, r * 0.12); fillStroke(g, '#ffffff', 1.5);
      rrect(g, -r * 0.8, r * 0.4, r * 1.6, r * 0.18, r * 0.08); g.fillStyle = OL; g.fill(); return [0, -r * 0.05, 0.85];
    },
    bug(g, r, c) {
      g.globalAlpha = 0.55; oval(g, -r * 0.55, -r * 0.75, r * 0.55, r * 0.35); fillStroke(g, '#e8f6ff', 1.2); oval(g, r * 0.55, -r * 0.75, r * 0.55, r * 0.35); fillStroke(g, '#e8f6ff', 1.2); g.globalAlpha = 1;
      oval(g, 0, 0, r * 0.95, r * 0.8); fillStroke(g, c.col, 2);
      if (c.stripes) { g.save(); oval(g, 0, 0, r * 0.95, r * 0.8); g.clip(); g.fillStyle = OL; g.fillRect(-r * 0.15, -r, r * 0.22, r * 2); g.fillRect(r * 0.4, -r, r * 0.22, r * 2); g.restore(); }
      return [-r * 0.05, 0, 0.8];
    },
    bowl(g, r, c) {   // 라면 그릇
      for (let i = -1; i <= 1; i++) line(g, [i * r * 0.35, -r * 0.2, i * r * 0.45 + r * 0.1, -r * 1.0, i * r * 0.35 + r * 0.2, -r * 1.25], 1.4, 'rgba(255,255,255,.7)');
      g.beginPath(); g.ellipse(0, -r * 0.1, r * 1.15, r * 0.35, 0, 0, TAU); g.fillStyle = '#ffe08a'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke();
      g.beginPath(); g.moveTo(-r * 1.15, -r * 0.1); g.quadraticCurveTo(-r * 1.0, r * 1.0, 0, r * 1.0); g.quadraticCurveTo(r * 1.0, r * 1.0, r * 1.15, -r * 0.1); g.closePath(); fillStroke(g, c.col, 2);
      line(g, [-r * 0.6, -r * 0.6, r * 0.9, -r * 1.3], 1.6); line(g, [-r * 0.3, -r * 0.55, r * 1.1, -r * 1.15], 1.6);
      return [0, r * 0.4, 0.8];
    },
    pad(g, r, c) {   // 게임패드
      g.beginPath(); g.moveTo(-r * 1.2, -r * 0.2); g.quadraticCurveTo(-r * 1.25, -r * 0.7, -r * 0.6, -r * 0.65); g.lineTo(r * 0.6, -r * 0.65); g.quadraticCurveTo(r * 1.25, -r * 0.7, r * 1.2, -r * 0.2);
      g.quadraticCurveTo(r * 1.35, r * 0.9, r * 0.7, r * 0.7); g.lineTo(-r * 0.7, r * 0.7); g.quadraticCurveTo(-r * 1.35, r * 0.9, -r * 1.2, -r * 0.2); g.closePath(); fillStroke(g, c.col, 2);
      g.fillStyle = OL; g.fillRect(-r * 0.95, -r * 0.08, r * 0.45, r * 0.15); g.fillRect(-r * 0.8, -r * 0.24, r * 0.15, r * 0.47);
      circle(g, r * 0.75, -r * 0.15, r * 0.12); g.fillStyle = '#ff5c8a'; g.fill(); circle(g, r * 0.95, r * 0.05, r * 0.12); g.fillStyle = '#5cd1ff'; g.fill();
      return [0, r * 0.05, 0.7];
    },
    moon(g, r, c) {
      g.beginPath(); g.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false); g.arc(r * 0.45, 0, r * 0.75, Math.PI * 1.45, Math.PI * 0.55, true); g.closePath(); fillStroke(g, c.col, 2);
      return [-r * 0.45, r * 0.05, 0.65];
    },
    sun(g, r, c) { star(g, 10, r * 1.2, r * 0.85); fillStroke(g, shade(c.col, 0.1), 1.8); circle(g, 0, 0, r * 0.8); fillStroke(g, c.col, 2); return [0, 0, 0.85]; },
    sock(g, r, c) {
      g.beginPath(); g.moveTo(-r * 0.45, -r * 1.1); g.lineTo(r * 0.45, -r * 1.1); g.lineTo(r * 0.45, r * 0.25); g.quadraticCurveTo(r * 0.5, r * 0.95, -r * 0.2, r * 0.95); g.lineTo(-r * 0.95, r * 0.95);
      g.quadraticCurveTo(-r * 1.25, r * 0.55, -r * 0.6, r * 0.3); g.lineTo(-r * 0.45, r * 0.15); g.closePath(); fillStroke(g, c.col, 2);
      g.fillStyle = '#ffffff'; g.fillRect(-r * 0.45, -r * 1.1, r * 0.9, r * 0.3); line(g, [-r * 0.45, -r * 0.8, r * 0.45, -r * 0.8], 1.4);
      return [0, -r * 0.3, 0.6];
    },
    sofa(g, r, c) {
      rrect(g, -r * 1.25, -r * 0.5, r * 0.5, r * 1.3, r * 0.2); fillStroke(g, shade(c.col, -0.15), 1.8); rrect(g, r * 0.75, -r * 0.5, r * 0.5, r * 1.3, r * 0.2); fillStroke(g, shade(c.col, -0.15), 1.8);
      rrect(g, -r * 0.85, -r * 0.95, r * 1.7, r * 1.0, r * 0.3); fillStroke(g, c.col, 2);
      rrect(g, -r * 0.85, r * 0.1, r * 1.7, r * 0.6, r * 0.2); fillStroke(g, shade(c.col, 0.12), 1.8);
      return [0, -r * 0.45, 0.75];
    },
    flag(g, r, c) {
      line(g, [-r * 0.8, -r * 1.2, -r * 0.8, r * 1.2], 2.4, '#8d6e63');
      g.beginPath(); g.moveTo(-r * 0.8, -r * 1.1); g.quadraticCurveTo(0, -r * 1.4, r * 1.1, -r * 0.95); g.quadraticCurveTo(r * 0.8, -r * 0.2, r * 1.15, r * 0.4); g.quadraticCurveTo(0, r * 0.15, -r * 0.8, r * 0.4); g.closePath(); fillStroke(g, c.col, 2);
      return [r * 0.15, -r * 0.35, 0.75];
    },
    bag(g, r, c) {
      rrect(g, -r * 0.35, -r * 1.25, r * 0.7, r * 0.45, r * 0.2); g.lineWidth = 2; g.strokeStyle = OL; g.stroke();
      rrect(g, -r * 0.95, -r * 0.95, r * 1.9, r * 2.0, r * 0.5); fillStroke(g, c.col, 2);
      rrect(g, -r * 0.6, r * 0.25, r * 1.2, r * 0.6, r * 0.2); fillStroke(g, shade(c.col, -0.12), 1.6);
      return [0, -r * 0.3, 0.8];
    },
    battery(g, r, c) {
      rrect(g, -r * 0.3, -r * 1.25, r * 0.6, r * 0.25, r * 0.08); g.fillStyle = OL; g.fill();
      rrect(g, -r * 0.75, -r * 1.05, r * 1.5, r * 2.1, r * 0.25); fillStroke(g, '#eeeeee', 2);
      rrect(g, -r * 0.55, r * 0.55, r * 1.1, r * 0.3, r * 0.08); g.fillStyle = '#ff5252'; g.fill();
      return [0, -r * 0.2, 0.75];
    },
    brick(g, r, c) {
      rrect(g, -r * 1.1, -r * 0.85, r * 2.2, r * 1.7, r * 0.15); fillStroke(g, c.col, 2);
      g.strokeStyle = shade(c.col, -0.35); g.lineWidth = 1.3; g.beginPath();
      for (let i = 1; i < 3; i++) { g.moveTo(-r * 1.1, -r * 0.85 + i * r * 0.57); g.lineTo(r * 1.1, -r * 0.85 + i * r * 0.57); }
      g.moveTo(0, -r * 0.85); g.lineTo(0, -r * 0.28); g.moveTo(-r * 0.55, -r * 0.28); g.lineTo(-r * 0.55, r * 0.29); g.moveTo(r * 0.55, -r * 0.28); g.lineTo(r * 0.55, r * 0.29); g.stroke();
      return [0, 0, 0.85];
    },
    scale(g, r, c) {
      line(g, [0, -r * 0.9, 0, r * 0.7], 2.2); line(g, [-r * 1.1, -r * 0.7, r * 1.1, -r * 0.55], 2.2);
      g.beginPath(); g.arc(-r * 1.0, -r * 0.25, r * 0.4, 0, Math.PI); fillStroke(g, shade(c.col, 0.2), 1.6); g.beginPath(); g.arc(r * 1.0, -r * 0.05, r * 0.4, 0, Math.PI); fillStroke(g, shade(c.col, 0.2), 1.6);
      circle(g, 0, r * 0.35, r * 0.6); fillStroke(g, c.col, 2); oval(g, 0, r * 0.95, r * 0.6, r * 0.15); fillStroke(g, shade(c.col, -0.2), 1.6);
      return [0, r * 0.35, 0.55];
    },
    hourglass(g, r, c) {
      g.fillStyle = '#8d6e63'; rrect(g, -r * 0.8, -r * 1.2, r * 1.6, r * 0.25, r * 0.08); g.fill(); g.stroke(); rrect(g, -r * 0.8, r * 0.95, r * 1.6, r * 0.25, r * 0.08); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.65, -r * 0.95); g.lineTo(r * 0.65, -r * 0.95); g.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.12, 0); g.quadraticCurveTo(r * 0.6, r * 0.2, r * 0.65, r * 0.95); g.lineTo(-r * 0.65, r * 0.95); g.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 0.12, 0); g.quadraticCurveTo(-r * 0.6, -r * 0.2, -r * 0.65, -r * 0.95); g.closePath();
      fillStroke(g, 'rgba(220,240,255,.9)', 2);
      g.beginPath(); g.moveTo(-r * 0.45, r * 0.9); g.lineTo(r * 0.45, r * 0.9); g.lineTo(0, r * 0.45); g.closePath(); g.fillStyle = c.col; g.fill();
      return [0, -r * 0.5, 0.55];
    },
    jelly(g, r, c) {
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * r * 0.32, r * 0.2); g.quadraticCurveTo(i * r * 0.32 + r * 0.25, r * 0.7, i * r * 0.32, r * 1.25); g.lineWidth = 3.6; g.strokeStyle = OL; g.stroke(); g.lineWidth = 2; g.strokeStyle = shade(c.col, 0.2); g.stroke(); }
      g.beginPath(); g.arc(0, r * 0.2, r, Math.PI, 0); g.quadraticCurveTo(0, r * 0.45, -r, r * 0.2); g.closePath(); fillStroke(g, c.col, 2);
      return [0, -r * 0.2, 0.75];
    },
    wave(g, r, c) {
      g.beginPath(); g.moveTo(-r * 1.2, r * 0.9); g.quadraticCurveTo(-r * 1.2, -r * 1.1, r * 0.3, -r * 1.0); g.quadraticCurveTo(r * 1.25, -r * 0.9, r * 1.0, -r * 0.1); g.quadraticCurveTo(r * 0.6, -r * 0.6, r * 0.1, -r * 0.3);
      g.quadraticCurveTo(r * 0.6, r * 0.3, r * 1.2, r * 0.9); g.closePath(); fillStroke(g, c.col, 2);
      line(g, [-r * 0.9, r * 0.55, r * 0.9, r * 0.55], 1.4, 'rgba(255,255,255,.6)');
      return [-r * 0.35, r * 0.1, 0.7];
    },
    turtle(g, r, c) {
      oval(g, r * 1.0, r * 0.15, r * 0.38, r * 0.32); fillStroke(g, '#c5e1a5', 1.6);
      for (const [x, y] of [[-0.7, 0.75], [0.6, 0.75]]) { oval(g, x * r, y * r, r * 0.25, r * 0.18); fillStroke(g, '#c5e1a5', 1.4); }
      g.beginPath(); g.arc(-r * 0.05, r * 0.45, r * 0.95, Math.PI, 0); g.closePath(); fillStroke(g, c.col, 2);
      g.strokeStyle = shade(c.col, -0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-r * 0.5, r * 0.45); g.lineTo(-r * 0.3, -r * 0.1); g.lineTo(r * 0.2, -r * 0.1); g.lineTo(r * 0.4, r * 0.45); g.stroke();
      return [r * 1.0, r * 0.12, 0.35];
    },
    virus(g, r, c) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; line(g, [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2], 2); circle(g, Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22, r * 0.16); fillStroke(g, shade(c.col, 0.2), 1.2); }
      circle(g, 0, 0, r * 0.9); fillStroke(g, c.col, 2); return [0, 0, 0.85];
    },
    burger(g, r, c) {
      g.beginPath(); g.arc(0, -r * 0.1, r, Math.PI, 0); g.closePath(); fillStroke(g, '#f4a742', 2);
      rrect(g, -r * 1.05, -r * 0.1, r * 2.1, r * 0.25, r * 0.1); fillStroke(g, '#7ccf5c', 1.5);
      rrect(g, -r, r * 0.15, r * 2.0, r * 0.35, r * 0.15); fillStroke(g, '#8d4b2a', 1.6);
      rrect(g, -r, r * 0.5, r * 2.0, r * 0.45, r * 0.2); fillStroke(g, '#f4a742', 2);
      for (const [x, y] of [[-0.4, -0.6], [0.1, -0.75], [0.5, -0.5]]) { oval(g, x * r, y * r, r * 0.08, r * 0.05); g.fillStyle = '#fff3c4'; g.fill(); }
      return [0, -r * 0.4, 0.6];
    },
    flame(g, r, c) {
      g.beginPath(); g.moveTo(0, -r * 1.35); g.quadraticCurveTo(r * 0.4, -r * 0.8, r * 0.95, -r * 0.3); g.quadraticCurveTo(r * 1.2, r * 0.8, 0, r * 1.0); g.quadraticCurveTo(-r * 1.2, r * 0.8, -r * 0.95, -r * 0.2);
      g.quadraticCurveTo(-r * 0.6, -r * 0.4, -r * 0.4, -r * 0.9); g.quadraticCurveTo(-r * 0.15, -r * 0.5, 0, -r * 1.35); g.closePath(); fillStroke(g, c.col, 2);
      g.beginPath(); g.moveTo(0, -r * 0.4); g.quadraticCurveTo(r * 0.6, r * 0.2, 0, r * 0.75); g.quadraticCurveTo(-r * 0.6, r * 0.2, 0, -r * 0.4); g.fillStyle = '#ffe082'; g.fill();
      return [0, r * 0.25, 0.75];
    },
    tri(g, r, c) {
      g.beginPath(); g.moveTo(0, -r * 1.2); g.quadraticCurveTo(r * 0.15, -r * 1.3, r * 0.3, -r * 1.05); g.lineTo(r * 1.25, r * 0.85); g.quadraticCurveTo(r * 1.3, r * 1.0, r * 1.1, r * 1.0); g.lineTo(-r * 1.1, r * 1.0); g.quadraticCurveTo(-r * 1.3, r * 1.0, -r * 1.25, r * 0.85); g.lineTo(-r * 0.3, -r * 1.05); g.quadraticCurveTo(-r * 0.15, -r * 1.3, 0, -r * 1.2); g.closePath();
      fillStroke(g, c.col, 2);
      g.beginPath(); g.moveTo(-r * 0.32, -r * 0.6); g.lineTo(0, -r * 1.15); g.lineTo(r * 0.32, -r * 0.6); g.quadraticCurveTo(0, -r * 0.45, -r * 0.32, -r * 0.6); g.fillStyle = '#ffffff'; g.fill();
      return [0, r * 0.3, 0.85];
    },
    flower(g, r, c) {
      line(g, [0, -r * 0.2, -r * 0.2, r * 1.2], 2.4, '#7cb342'); oval(g, -r * 0.45, r * 0.75, r * 0.3, r * 0.14); fillStroke(g, '#9ccc65', 1.2);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.6; oval(g, Math.cos(a) * r * 0.55, -r * 0.35 + Math.sin(a) * r * 0.55 + r * 0.15, r * 0.42, r * 0.32); fillStroke(g, c.col, 1.6); }
      circle(g, 0, -r * 0.25, r * 0.45); fillStroke(g, '#ffd54f', 1.6); return [0, -r * 0.25, 0.45];
    },
    mirror(g, r, c) { oval(g, 0, 0, r * 0.9, r * 1.15); fillStroke(g, '#c49a6c', 2.4); oval(g, 0, 0, r * 0.68, r * 0.92); g.fillStyle = c.col; g.fill(); line(g, [-r * 0.35, -r * 0.5, -r * 0.1, -r * 0.75], 2, 'rgba(255,255,255,.8)'); return [0, r * 0.1, 0.65]; },
    gem(g, r, c) {
      g.beginPath(); g.moveTo(-r * 0.6, -r * 0.8); g.lineTo(r * 0.6, -r * 0.8); g.lineTo(r * 1.1, -r * 0.2); g.lineTo(0, r * 1.15); g.lineTo(-r * 1.1, -r * 0.2); g.closePath(); fillStroke(g, c.col, 2);
      g.beginPath(); g.moveTo(-r * 1.1, -r * 0.2); g.lineTo(r * 1.1, -r * 0.2); g.lineWidth = 1.2; g.strokeStyle = shade(c.col, -0.3); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.6, -r * 0.8); g.lineTo(-r * 0.25, -r * 0.2); g.lineTo(r * 0.25, -r * 0.2); g.lineTo(r * 0.6, -r * 0.8); g.fillStyle = shade(c.col, 0.35); g.fill();
      return [0, r * 0.2, 0.65];
    },
    speech(g, r, c) {
      g.beginPath(); g.moveTo(-r * 0.2, r * 0.7); g.lineTo(-r * 0.75, r * 1.25); g.lineTo(-r * 0.6, r * 0.6); fillStroke(g, c.col, 2);
      oval(g, 0, 0, r * 1.15, r * 0.85); fillStroke(g, c.col, 2); return [0, 0, 0.85];
    },
    bell(g, r, c) {
      circle(g, 0, r * 0.95, r * 0.2); fillStroke(g, shade(c.col, -0.3), 1.4);
      g.beginPath(); g.moveTo(-r, r * 0.8); g.quadraticCurveTo(-r * 0.8, r * 0.6, -r * 0.75, 0); g.quadraticCurveTo(-r * 0.7, -r * 1.05, 0, -r * 1.05); g.quadraticCurveTo(r * 0.7, -r * 1.05, r * 0.75, 0); g.quadraticCurveTo(r * 0.8, r * 0.6, r, r * 0.8); g.closePath(); fillStroke(g, c.col, 2);
      return [0, -r * 0.15, 0.8];
    },
    // ---- 보스 전용 ----
    train(g, r, c) {
      rrect(g, -r * 0.95, -r * 1.05, r * 1.9, r * 2.0, r * 0.5); fillStroke(g, c.col, 2.6);
      rrect(g, -r * 0.7, -r * 0.8, r * 1.4, r * 0.75, r * 0.2); fillStroke(g, '#bdeefc', 2);
      circle(g, -r * 0.55, r * 0.55, r * 0.17); fillStroke(g, '#fff59d', 1.6); circle(g, r * 0.55, r * 0.55, r * 0.17); fillStroke(g, '#fff59d', 1.6);
      rrect(g, -r * 0.8, r * 0.85, r * 1.6, r * 0.2, r * 0.08); g.fillStyle = OL; g.fill();
      return [0, -r * 0.45, 0.6];
    },
    calendar(g, r, c) {
      rrect(g, -r, -r * 0.95, r * 2, r * 1.95, r * 0.25); fillStroke(g, '#ffffff', 2.4);
      g.save(); rrect(g, -r, -r * 0.95, r * 2, r * 0.55, r * 0.25); g.clip(); g.fillStyle = c.col; g.fillRect(-r, -r, r * 2, r * 0.6); g.restore();
      line(g, [-r, -r * 0.4, r, -r * 0.4], 2);
      for (const x of [-0.5, 0.5]) { rrect(g, x * r - r * 0.08, -r * 1.15, r * 0.16, r * 0.4, r * 0.08); fillStroke(g, '#bdbdbd', 1.4); }
      g.font = `bold ${r * 0.55}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e53935'; g.fillText('3', r * 0.62, r * 0.6);
      return [-r * 0.1, r * 0.2, 0.75];
    },
    tornado(g, r, c) {
      const rows = [[0, -0.95, 1.1], [0.1, -0.5, 0.85], [-0.05, -0.05, 0.62], [0.12, 0.38, 0.42], [0, 0.75, 0.25]];
      for (const [x, y, w] of rows) { oval(g, x * r, y * r, w * r, r * 0.25); fillStroke(g, c.col, 2); }
      return [0, -r * 0.55, 0.75];
    },
    mask(g, r, c) {
      g.beginPath(); g.moveTo(-r, -r * 0.7); g.quadraticCurveTo(0, -r * 1.05, r, -r * 0.7); g.quadraticCurveTo(r * 1.05, r * 0.6, 0, r * 1.05); g.quadraticCurveTo(-r * 1.05, r * 0.6, -r, -r * 0.7); g.closePath(); fillStroke(g, c.col, 2.6);
      line(g, [-r * 0.95, -r * 0.65, -r * 1.25, -r * 0.2], 2, '#ffd54f'); line(g, [r * 0.95, -r * 0.65, r * 1.25, -r * 0.2], 2, '#ffd54f');
      return [0, 0, 0.9];
    },
  };

  /* ---------- 입 ---------- */
  function mouth(g, x, y, s, kind) {
    g.lineWidth = Math.max(1.1, s * 0.12); g.strokeStyle = OL; g.lineCap = 'round';
    switch (kind) {
      case 'smile': g.beginPath(); g.arc(x, y - s * 0.15, s * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); break;
      case 'grin': g.beginPath(); g.arc(x, y - s * 0.12, s * 0.32, 0, Math.PI); g.closePath(); g.fillStyle = '#7a2b3a'; g.fill(); g.stroke(); break;
      case 'frown': g.beginPath(); g.arc(x, y + s * 0.25, s * 0.26, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); break;
      case 'wavy': g.beginPath(); g.moveTo(x - s * 0.32, y); g.quadraticCurveTo(x - s * 0.16, y - s * 0.14, x, y); g.quadraticCurveTo(x + s * 0.16, y + s * 0.14, x + s * 0.32, y); g.stroke(); break;
      case 'o': oval(g, x, y, s * 0.14, s * 0.18); g.fillStyle = '#7a2b3a'; g.fill(); g.stroke(); break;
      case 'teeth': rrect(g, x - s * 0.36, y - s * 0.12, s * 0.72, s * 0.26, s * 0.06); g.fillStyle = '#fff'; g.fill(); g.stroke(); g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(x - s * 0.36 + i * s * 0.18, y - s * 0.12); g.lineTo(x - s * 0.36 + i * s * 0.18, y + s * 0.14); } g.lineWidth = s * 0.06; g.stroke(); break;
      case 'flat': g.beginPath(); g.moveTo(x - s * 0.22, y); g.lineTo(x + s * 0.22, y); g.stroke(); break;
      default: break;
    }
  }

  /* ---------- 소품 ---------- */
  function acc(g, r, kind, c) {
    switch (kind) {
      case 'sweat': g.beginPath(); g.moveTo(r * 1.0, -r * 0.6); g.quadraticCurveTo(r * 1.3, -r * 0.15, r * 1.0, -r * 0.05); g.quadraticCurveTo(r * 0.8, -r * 0.25, r * 1.0, -r * 0.6); fillStroke(g, '#d6efff', 1.2); break;
      case 'zzz': g.font = `bold ${r * 0.6}px sans-serif`; g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.5; g.strokeText('z', r * 0.75, -r * 0.85); g.fillText('z', r * 0.75, -r * 0.85); g.font = `bold ${r * 0.42}px sans-serif`; g.strokeText('z', r * 1.15, -r * 1.25); g.fillText('z', r * 1.15, -r * 1.25); break;
      case 'steam': for (const x of [-0.45, 0, 0.45]) { g.beginPath(); g.moveTo(x * r, -r * 1.05); g.quadraticCurveTo(x * r + r * 0.2, -r * 1.3, x * r, -r * 1.55); g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke(); } break;
      case 'swirl': g.beginPath(); for (let a = 0; a < 10; a += 0.3) { const rr = r * 0.05 * a; g.lineTo(r * 0.9 + Math.cos(a) * rr, -r * 0.9 + Math.sin(a) * rr); } g.lineWidth = 1.4; g.strokeStyle = '#ffffff'; g.stroke(); break;
      case 'vein': g.beginPath(); for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) { g.moveTo(r * 0.7, -r * 0.7); g.quadraticCurveTo(r * 0.7 + dx * r * 0.08, -r * 0.7 + dy * r * 0.08, r * 0.7 + dx * r * 0.25, -r * 0.7 + dy * r * 0.25); } g.lineWidth = 2; g.strokeStyle = '#ff1744'; g.stroke(); break;
      case 'ring': for (const s of [1, -1]) { g.beginPath(); g.arc(s * r * 1.05, -r * 0.2, r * 0.3, -0.6 + (s < 0 ? Math.PI : 0), 0.6 + (s < 0 ? Math.PI : 0)); g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.stroke(); g.beginPath(); g.arc(s * r * 1.05, -r * 0.2, r * 0.5, -0.6 + (s < 0 ? Math.PI : 0), 0.6 + (s < 0 ? Math.PI : 0)); g.stroke(); } break;
      case 'smoke': for (const [x, y, s] of [[0.6, -1.1, 0.22], [0.9, -1.4, 0.16]]) { circle(g, x * r, y * r, s * r); fillStroke(g, '#cfd8dc', 1.2); } break;
      case 'drip': g.beginPath(); g.moveTo(-r * 0.6, r * 0.7); g.quadraticCurveTo(-r * 0.45, r * 1.15, -r * 0.6, r * 1.25); g.quadraticCurveTo(-r * 0.75, r * 1.15, -r * 0.6, r * 0.7); fillStroke(g, shade(c.col, 0.2), 1.2); break;
      case 'badge': circle(g, r * 0.75, -r * 1.0, r * 0.28); fillStroke(g, '#ff1744', 1.4); g.font = `bold ${r * 0.34}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('9', r * 0.75, -r * 0.98); break;
      case 'notes': g.font = `bold ${r * 0.6}px sans-serif`; g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.4; g.strokeText('♪', r * 1.0, -r * 0.7); g.fillText('♪', r * 1.0, -r * 0.7); g.strokeText('♫', r * 1.3, -r * 1.2); g.fillText('♫', r * 1.3, -r * 1.2); break;
      case 'heart': g.save(); g.translate(r * 0.85, -r * 1.05); g.scale(r * 0.022, r * 0.022); g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(-14, -4, -6, -14, 0, -6); g.bezierCurveTo(6, -14, 14, -4, 0, 6); g.restore(); fillStroke(g, '#ff4f8b', 1.2); break;
      case 'bubbles': for (const [x, y, s] of [[-1.0, -0.7, 0.2], [1.05, -0.4, 0.15], [0.7, -1.1, 0.12]]) { circle(g, x * r, y * r, s * r); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = OL; g.stroke(); } break;
      case 'dust': for (const [x, y] of [[-1.1, 0.5], [1.15, 0.3], [-0.9, -0.6], [1.0, -0.7]]) { circle(g, x * r, y * r, r * 0.08); g.fillStyle = shade(c.col, -0.3); g.fill(); } break;
      case 'question': g.font = `bold ${r * 0.85}px sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 1.8; g.strokeText('?', r * 0.95, -r * 0.75); g.fillText('?', r * 0.95, -r * 0.75); break;
      case 'bolt': g.beginPath(); g.moveTo(r * 0.85, -r * 1.25); g.lineTo(r * 0.55, -r * 0.6); g.lineTo(r * 0.8, -r * 0.6); g.lineTo(r * 0.55, -r * 0.05); g.lineTo(r * 1.15, -r * 0.8); g.lineTo(r * 0.9, -r * 0.8); g.lineTo(r * 1.1, -r * 1.25); g.closePath(); fillStroke(g, '#ffe14d', 1.4); break;
      case 'bandage': g.save(); g.rotate(-0.5); rrect(g, -r * 0.55, -r * 0.75, r * 1.1, r * 0.3, r * 0.1); fillStroke(g, '#ffe0b2', 1.2); g.restore(); break;
      case 'crack': line(g, [-r * 0.2, -r * 0.95, 0, -r * 0.55, -r * 0.25, -r * 0.3, r * 0.05, 0], 1.6); break;
      case 'bones': line(g, [-r * 0.5, -r * 0.55, r * 0.5, -r * 0.55], 1.6, 'rgba(255,255,255,.85)'); line(g, [-r * 0.5, r * 0.55, r * 0.5, r * 0.55], 1.6, 'rgba(255,255,255,.85)'); break;
      case 'dots': for (const [x, y] of [[-0.6, 0.45], [0.55, 0.5], [0.15, 0.7], [-0.25, 0.65]]) { circle(g, x * r, y * r, r * 0.09); g.fillStyle = '#7b1fa2'; g.fill(); } break;
      case 'shake': for (const s of [-1, 1]) { line(g, [s * r * 1.15, -r * 0.4, s * r * 1.3, -r * 0.1, s * r * 1.15, r * 0.2], 1.6, '#fff'); } break;
      case 'hands': for (const s of [-1, 1]) { oval(g, s * r * 0.38, -r * 0.05, r * 0.36, r * 0.28); fillStroke(g, '#ffd9b8', 1.6); } break;
      case 'rain': for (const [x, y] of [[-0.6, 1.0], [0, 1.2], [0.6, 1.0], [-0.3, 1.45], [0.35, 1.45]]) line(g, [x * r, y * r, x * r - r * 0.08, y * r + r * 0.22], 2, '#64b5f6'); break;
      case 'snow': for (const [x, y] of [[-0.7, 1.05], [0, 1.25], [0.7, 1.05], [-0.35, 1.5], [0.4, 1.5]]) { g.font = `bold ${r * 0.32}px sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('❄', x * r, y * r); } break;
      case 'stars': for (const [x, y] of [[-1.1, -0.9], [1.1, -0.85], [0, -1.3]]) { g.save(); g.translate(x * r, y * r); star(g, 5, r * 0.18, r * 0.08); fillStroke(g, '#fff59d', 1.1); g.restore(); } break;
      case 'thermo': g.save(); g.rotate(0.5); rrect(g, r * 0.25, -r * 0.15, r * 0.9, r * 0.18, r * 0.09); fillStroke(g, '#ffffff', 1.3); circle(g, r * 1.15, -r * 0.06, r * 0.14); g.fillStyle = '#e53935'; g.fill(); g.restore(); break;
      case 'flameTop': g.beginPath(); g.moveTo(-r * 0.5, -r * 0.85); g.quadraticCurveTo(-r * 0.4, -r * 1.5, 0, -r * 1.35); g.quadraticCurveTo(r * 0.15, -r * 1.75, r * 0.45, -r * 1.25); g.quadraticCurveTo(r * 0.6, -r * 1.05, r * 0.5, -r * 0.85); g.closePath(); fillStroke(g, '#ffb300', 1.6); break;
      default: break;
    }
  }

  /** 몸 + 눈 + 입 + 소품을 조합해 그린다 */
  function creature(g, r, c, boss) {
    if (boss) {   // 보스: 뒤에 어두운 가시 후광
      star(g, 14, r * 1.32, r * 1.08); g.fillStyle = shade(c.col, -0.55); g.fill();
    }
    const [fx, fy, fs] = (SHAPE[c.shape] || SHAPE.blob)(g, r, c);
    // 입체감: 몸 전체에 빛(왼쪽 위)과 그림자(오른쪽 아래) — 이미 그린 부분에만 입힘
    g.save(); g.globalCompositeOperation = 'source-atop';
    const lg = g.createRadialGradient(-r * 0.45, -r * 0.55, r * 0.05, -r * 0.2, -r * 0.2, r * 1.5);
    lg.addColorStop(0, 'rgba(255,255,255,.38)'); lg.addColorStop(0.45, 'rgba(255,255,255,.06)'); lg.addColorStop(1, 'rgba(20,10,40,.32)');
    g.fillStyle = lg; g.fillRect(-r * 3, -r * 3, r * 6, r * 6);
    g.restore();
    // 작은 팔과 발 (몸 뒤에): 이모지 같은 '얼굴'이 아니라 움직이는 캐릭터처럼
    if (!c.noLimbs) {
      g.save(); g.globalCompositeOperation = 'destination-over';
      const lc = shade(c.col, -0.3);
      for (const sx of [-1, 1]) {
        oval(g, sx * r * 0.42, r * 0.92, r * 0.3, r * 0.17); fillStroke(g, lc, 1.5);                   // 발
        g.save(); g.translate(sx * r * 0.88, r * 0.15); g.rotate(sx * 0.5); oval(g, 0, 0, r * 0.2, r * 0.3); fillStroke(g, lc, 1.5); g.restore();   // 팔
      }
      g.restore();
    }
    g.__lid = shade(c.col, -0.1);
    const es = r * 0.25 * fs, gap = r * 0.36 * fs;   // 눈을 조금 크게, 반짝임은 eye()에서
    if (c.eyes !== 'none' && c.acc !== 'hands') {
      const mood = boss && (c.eyes === 'normal' || !c.eyes) ? 'angry' : (c.eyes || 'normal');
      eye(g, fx - gap, fy - es * 0.3, es, mood); eye(g, fx + gap, fy - es * 0.3, es, mood, -1);
    }
    // 볼 터치
    g.fillStyle = 'rgba(255,120,140,.35)'; oval(g, fx - gap * 1.55, fy + es * 0.9, es * 0.55, es * 0.32); g.fill(); oval(g, fx + gap * 1.55, fy + es * 0.9, es * 0.55, es * 0.32); g.fill();
    mouth(g, fx, fy + es * 1.6, es * 2.6, c.mouth || 'smile');
    if (c.acc) acc(g, r, c.acc, c);
    if (c.acc2) acc(g, r, c.acc2, c);
  }

  const TEXTY = new Set(['zzz', 'question', 'notes', 'badge']);   // 글자가 있는 소품: 좌우로 뒤집지 않음
  /* ---------- 적 표: 월드별 방해 요소 ---------- */
  const E = {
    // 학원
    book:    { shape: 'round',  col: '#ff8a65', eyes: 'worried', mouth: 'wavy', acc: 'steam' },
    quiz:    { shape: 'drop',   col: '#9fa8ff', eyes: 'worried', mouth: 'wavy', acc: 'sweat' },
    memo:    { shape: 'cloud',  col: '#c5a3ff', eyes: 'dizzy', mouth: 'o', acc: 'swirl' },
    bus:     { shape: 'sofa',   col: '#e07a5f', eyes: 'sleepy', mouth: 'smile' },
    ox:      { shape: 'flag',   col: '#f5f5f5', eyes: 'droopy', mouth: 'frown' },
    // 회사
    doc:     { shape: 'spiky',  col: '#ff7043', eyes: 'angry', mouth: 'teeth' },
    mail:    { shape: 'square', col: '#ef5350', eyes: 'angry', mouth: 'frown', acc: 'vein' },
    call:    { shape: 'bell',   col: '#ffd54f', eyes: 'dizzy', mouth: 'o', acc: 'ring' },
    printer: { shape: 'wide',   col: '#b0bec5', eyes: 'angry', mouth: 'teeth', acc: 'smoke' },
    meeting: { shape: 'cloud',  col: '#90a4ae', eyes: 'worried', mouth: 'wavy', acc: 'drip' },
    // 지하철
    sleepy:  { shape: 'blob',   col: '#b39ddb', eyes: 'sleepy', mouth: 'o', acc: 'zzz' },
    bag:     { shape: 'bag',    col: '#8d6e63', eyes: 'droopy', mouth: 'frown' },
    ad:      { shape: 'wide',   col: '#ffb74d', eyes: 'angry', mouth: 'o', acc: 'notes' },
    phone:   { shape: 'device', col: '#424242', col2: '#80deea', eyes: 'angry', mouth: 'grin', acc: 'badge' },
    fatigue: { shape: 'blob',   col: '#a1887f', eyes: 'droopy', mouth: 'o' },
    // 집
    snack:   { shape: 'bowl',   col: '#ef6c57', eyes: 'normal', mouth: 'grin' },
    game:    { shape: 'pad',    col: '#7e57c2', eyes: 'normal', mouth: 'grin' },
    scroll:  { shape: 'round',  col: '#4fc3f7', eyes: 'dizzy', mouth: 'wavy', acc: 'swirl' },
    moon:    { shape: 'moon',   col: '#fff59d', eyes: 'worried', mouth: 'wavy' },
    sock:    { shape: 'sock',   col: '#ef9a9a', eyes: 'droopy', mouth: 'wavy' },
    // 헬스장
    lazy:    { shape: 'flat',   col: '#ffcc80', eyes: 'droopy', mouth: 'wavy', acc: 'drip' },
    ache:    { shape: 'spiky',  col: '#ff8a65', eyes: 'angry', mouth: 'teeth', acc: 'bandage' },
    excuse:  { shape: 'speech', col: '#eceff1', eyes: 'angry', mouth: 'teeth' },
    sweat:   { shape: 'drop',   col: '#4fc3f7', eyes: 'normal', mouth: 'grin', acc: 'sweat' },
    breath:  { shape: 'cloud',  col: '#cfd8dc', eyes: 'sleepy', mouth: 'o', acc: 'steam' },
    battery: { shape: 'battery', col: '#a5d6a7', eyes: 'droopy', mouth: 'frown' },
    // 도서관
    nod:     { shape: 'blob',   col: '#9fa8da', eyes: 'sleepy', mouth: 'o', acc: 'zzz' },
    tempt:   { shape: 'device', col: '#5c6bc0', col2: '#ff80ab', eyes: 'normal', mouth: 'grin', acc: 'heart' },
    wall:    { shape: 'brick',  col: '#bf6b4e', eyes: 'droopy', mouth: 'flat' },
    compare: { shape: 'scale',  col: '#b0bec5', eyes: 'worried', mouth: 'frown' },
    hurry:   { shape: 'hourglass', col: '#ffca28', eyes: 'worried', mouth: 'wavy' },
    bubble:  { shape: 'round',  col: '#b3e5fc', eyes: 'dizzy', mouth: 'o', acc: 'bubbles' },
    // 바닷가
    sun:     { shape: 'sun',    col: '#ffca28', eyes: 'angry', mouth: 'grin' },
    mosq:    { shape: 'bug',    col: '#8d6e63', eyes: 'angry', mouth: 'teeth' },
    sand:    { shape: 'cloud',  col: '#d7b98e', eyes: 'dizzy', mouth: 'wavy', acc: 'dust' },
    jelly:   { shape: 'jelly',  col: '#f48fb1', eyes: 'worried', mouth: 'wavy' },
    wave:    { shape: 'wave',   col: '#4fc3f7', eyes: 'droopy', mouth: 'wavy' },
    // 공항
    jet:     { shape: 'moon',   col: '#9fa8da', eyes: 'sleepy', mouth: 'o' },
    lost:    { shape: 'round',  col: '#ffab91', eyes: 'worried', mouth: 'wavy', acc: 'question' },
    delay:   { shape: 'wide',   col: '#90a4ae', eyes: 'sleepy', mouth: 'o', acc: 'notes' },
    rush:    { shape: 'spiky',  col: '#ffee58', eyes: 'angry', mouth: 'teeth', acc: 'bolt' },
    queue:   { shape: 'turtle', col: '#66bb6a', eyes: 'sleepy', mouth: 'flat' },
    // 병원
    germ:    { shape: 'virus',  col: '#9ccc65', eyes: 'angry', mouth: 'grin' },
    cough:   { shape: 'blob',   col: '#ffcdd2', eyes: 'sleepy', mouth: 'o', acc: 'steam' },
    junk:    { shape: 'burger', col: '#f4a742', eyes: 'normal', mouth: 'grin' },
    over:    { shape: 'flame',  col: '#ff7043', eyes: 'angry', mouth: 'teeth' },
    xray:    { shape: 'square', col: '#64b5f6', eyes: 'worried', mouth: 'wavy', acc: 'bones' },
    petri:   { shape: 'flat',   col: '#ce93d8', eyes: 'droopy', mouth: 'wavy', acc: 'dots' },
    // 산
    slope:   { shape: 'tri',    col: '#8d9b7a', eyes: 'angry', mouth: 'frown' },
    rock:    { shape: 'round',  col: '#9e9e9e', eyes: 'angry', mouth: 'teeth', acc: 'crack' },
    bee:     { shape: 'bug',    col: '#ffd54f', stripes: true, eyes: 'angry', mouth: 'teeth' },
    fog:     { shape: 'cloud',  col: '#cfd8dc', eyes: 'sleepy', mouth: 'flat' },
    wilt:    { shape: 'flower', col: '#e57373', eyes: 'droopy', mouth: 'frown' },
    // 꿈의 무대
    nerve:   { shape: 'round',  col: '#ffcc80', eyes: 'worried', mouth: 'teeth' },
    shake:   { shape: 'blob',   col: '#ce93d8', eyes: 'dizzy', mouth: 'wavy', acc: 'shake' },
    oops:    { shape: 'round',  col: '#ffab91', eyes: 'none', mouth: 'wavy', acc: 'hands' },
    mirror:  { shape: 'mirror', col: '#b3e5fc', eyes: 'worried', mouth: 'frown' },
    heart:   { shape: 'gem',    col: '#80deea', eyes: 'angry', mouth: 'flat' },
  };
  for (const k in E) {
    const c = E[k];
    ENEMY[k] = { color: c.col, w: 3.0, h: 3.2, draw: (g, r) => creature(g, r, c, false), noFlip: TEXTY.has(c.acc) || TEXTY.has(c.acc2) };
  }

  /* ---------- 보스 표 ---------- */
  const B = {
    '슬럼프':     { shape: 'cloud',    col: '#78909c', eyes: 'droopy', mouth: 'frown', acc: 'rain' },
    '번아웃':     { shape: 'round',    col: '#ff5722', eyes: 'dizzy', mouth: 'o', acc: 'flameTop', acc2: 'sweat' },
    '급행열차':   { shape: 'train',    col: '#26a69a', eyes: 'angry', mouth: 'flat' },
    '불면증':     { shape: 'round',    col: '#5c6bc0', eyes: 'dizzy', mouth: 'wavy', acc: 'stars' },
    '작심삼일':   { shape: 'calendar', col: '#e53935', eyes: 'angry', mouth: 'teeth' },
    '집중력 저하': { shape: 'blob',    col: '#9e9e9e', eyes: 'dizzy', mouth: 'o', acc: 'swirl' },
    '태풍':       { shape: 'cloud',    col: '#455a64', eyes: 'angry', mouth: 'teeth', acc: 'bolt', acc2: 'rain' },
    '난기류':     { shape: 'tornado',  col: '#b0bec5', eyes: 'angry', mouth: 'teeth' },
    '독감':       { shape: 'round',    col: '#aed581', eyes: 'sleepy', mouth: 'o', acc: 'thermo', acc2: 'sweat' },
    '눈보라':     { shape: 'cloud',    col: '#e3f2fd', eyes: 'angry', mouth: 'teeth', acc: 'snow' },
    '무대 공포증': { shape: 'mask',    col: '#ab47bc', eyes: 'angry', mouth: 'teeth' },
    // 월드별 작은 큰 도전들 (minis)
    '진도 압박':   { shape: 'square',  col: '#7e57c2', eyes: 'angry', mouth: 'teeth', acc: 'vein' },
    '피로 누적':   { shape: 'blob',    col: '#8d6e63', eyes: 'droopy', mouth: 'frown', acc: 'sweat' },
    '완벽 강박':   { shape: 'gem',     col: '#26c6da', eyes: 'angry', mouth: 'flat', acc: 'vein' },
    '멀미':       { shape: 'blob',    col: '#9ccc65', eyes: 'dizzy', mouth: 'wavy', acc: 'swirl' },
    '환승 미로':   { shape: 'round',   col: '#ffb74d', eyes: 'dizzy', mouth: 'o', acc: 'question' },
    '졸음 쓰나미': { shape: 'wave',    col: '#5c6bc0', eyes: 'sleepy', mouth: 'o', acc: 'zzz' },
    '야식 폭주':   { shape: 'bowl',    col: '#ff7043', eyes: 'angry', mouth: 'grin', acc: 'steam' },
    '무한 영상':   { shape: 'wide',    col: '#455a64', eyes: 'dizzy', mouth: 'grin', acc: 'notes' },
    '어질러진 마음': { shape: 'tornado', col: '#ce93d8', eyes: 'dizzy', mouth: 'wavy' },
    '근육통 대왕': { shape: 'spiky',   col: '#e53935', eyes: 'angry', mouth: 'teeth', acc: 'bandage' },
    '귀차니즘':   { shape: 'sofa',    col: '#8d6e63', eyes: 'sleepy', mouth: 'smile', acc: 'zzz' },
    '정체기':     { shape: 'square',  col: '#81d4fa', eyes: 'droopy', mouth: 'flat', acc: 'crack' },
    '잡념 소용돌이': { shape: 'cloud', col: '#9575cd', eyes: 'dizzy', mouth: 'o', acc: 'swirl' },
    '졸음 마왕':   { shape: 'blob',    col: '#7986cb', eyes: 'sleepy', mouth: 'o', acc: 'zzz' },
    '비교의 늪':   { shape: 'flat',    col: '#6d4c41', eyes: 'worried', mouth: 'frown', acc: 'drip' },
    '땡볕 대마왕': { shape: 'sun',     col: '#ffa000', eyes: 'angry', mouth: 'grin' },
    '해파리 떼':   { shape: 'jelly',   col: '#ba68c8', eyes: 'angry', mouth: 'teeth' },
    '거대 파도':   { shape: 'wave',    col: '#0288d1', eyes: 'angry', mouth: 'teeth' },
    '시차 대마왕': { shape: 'moon',    col: '#7986cb', eyes: 'sleepy', mouth: 'o', acc: 'stars' },
    '분실 공포':   { shape: 'bag',     col: '#5d4037', eyes: 'worried', mouth: 'wavy', acc: 'question' },
    '지연 폭탄':   { shape: 'round',   col: '#ff7043', eyes: 'angry', mouth: 'teeth', acc: 'bolt' },
    '감기 군단':   { shape: 'virus',   col: '#7cb342', eyes: 'angry', mouth: 'grin' },
    '불규칙 대왕': { shape: 'burger',  col: '#f4a742', eyes: 'angry', mouth: 'teeth' },
    '무리 대장':   { shape: 'flame',   col: '#f4511e', eyes: 'angry', mouth: 'teeth' },
    '낙석 폭풍':   { shape: 'round',   col: '#757575', eyes: 'angry', mouth: 'teeth', acc: 'crack' },
    '안개 거인':   { shape: 'cloud',   col: '#b0bec5', eyes: 'sleepy', mouth: 'flat' },
    '고산병':     { shape: 'tri',     col: '#90a4ae', eyes: 'dizzy', mouth: 'o', acc: 'snow' },
  };
  for (const name in B) {
    const c = B[name];
    BOSS[name] = { color: c.col, w: 3.0, h: 3.4, draw: (g, r) => creature(g, r, c, true), noFlip: c.shape === 'calendar' || TEXTY.has(c.acc) };
  }

  /* ---------- 도우미 (사람) ---------- */
  function person(g, o) {
    const skin = o.skin || '#ffd9b8';
    rrect(g, -7, 2, 14, 15, 5); fillStroke(g, o.outfit, 1.8);                                  // 몸
    if (o.vest) { rrect(g, -7, 2, 14, 15, 5); g.save(); g.clip(); g.fillStyle = o.vest; g.fillRect(-7, 2, 4.5, 15); g.fillRect(2.5, 2, 4.5, 15); g.restore(); }
    if (o.tie) { g.beginPath(); g.moveTo(0, 3); g.lineTo(1.6, 6); g.lineTo(0, 12); g.lineTo(-1.6, 6); g.closePath(); fillStroke(g, o.tie, 1); }
    if (o.apron) { rrect(g, -4.5, 6, 9, 10, 2); fillStroke(g, o.apron, 1.2); }
    if (o.book) { rrect(g, -6, 8, 9, 7, 1.5); fillStroke(g, o.book, 1.5); }
    if (o.cross) { g.fillStyle = '#e53935'; g.fillRect(-1, 5, 2, 6); g.fillRect(-3, 7, 6, 2); }
    if (o.whistle) { line(g, [-3, 2, 0, 8, 3, 2], 1, '#333'); circle(g, 0, 9, 1.4); fillStroke(g, '#ffd54f', 0.8); }
    if (o.scarf) { rrect(g, -6, 1, 12, 3, 1.5); fillStroke(g, o.scarf, 1.2); }
    circle(g, 0, -6, 8); fillStroke(g, skin, 1.8);                                          // 머리
    const hc = o.hairCol || '#3b2b25';
    if (o.hair === 'bun') { circle(g, 0, -15.5, 3.8); fillStroke(g, hc, 1.6); }
    if (o.hair === 'long') { rrect(g, -9, -10, 18, 15, 6); g.save(); g.globalCompositeOperation = 'destination-over'; g.fillStyle = hc; g.fill(); g.restore(); }
    if (o.hair !== 'helmet' && o.hair !== 'cap') { g.beginPath(); g.arc(0, -6.8, 8.1, Math.PI, Math.PI * 2); g.quadraticCurveTo(2, -9, -8.1, -6.2); g.closePath(); fillStroke(g, hc, 1.6); }
    if (o.hair === 'cap') { g.beginPath(); g.arc(0, -7.5, 8.2, Math.PI, Math.PI * 2); g.closePath(); fillStroke(g, o.capCol || '#283593', 1.6); rrect(g, -1, -9, 11, 3, 1.5); fillStroke(g, o.capCol || '#283593', 1.4); }
    if (o.hair === 'helmet') { g.beginPath(); g.arc(0, -7, 8.8, Math.PI, Math.PI * 2); g.closePath(); fillStroke(g, '#ffca28', 1.8); rrect(g, -10, -8, 20, 2.6, 1.2); fillStroke(g, '#ffb300', 1.2); }
    if (o.nurseCap) { rrect(g, -5, -15.5, 10, 4.5, 1.5); fillStroke(g, '#ffffff', 1.4); g.fillStyle = '#e53935'; g.fillRect(-0.6, -14.8, 1.2, 3); g.fillRect(-1.5, -13.9, 3, 1.2); }
    if (o.sunhat) { oval(g, 0, -11, 12, 3); fillStroke(g, '#ffe082', 1.4); g.beginPath(); g.arc(0, -11, 6.5, Math.PI, Math.PI * 2); fillStroke(g, '#ffe082', 1.4); }
    if (o.headset) { g.beginPath(); g.arc(0, -6, 9.2, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 1.6; g.strokeStyle = OL; g.stroke(); line(g, [-8.5, -3, -5, 1], 1.2); circle(g, -4.5, 1.3, 1.2); g.fillStyle = OL; g.fill(); }
    // 얼굴
    if (o.glasses) { g.lineWidth = 1.2; g.strokeStyle = OL; circle(g, -2.9, -4.5, 2.4); g.stroke(); circle(g, 2.9, -4.5, 2.4); g.stroke(); }
    circle(g, -2.9, -4.3, 0.95); g.fillStyle = OL; g.fill(); circle(g, 2.9, -4.3, 0.95); g.fill();
    if (o.beard) { g.beginPath(); g.arc(0, -3, 6.5, 0.1 * Math.PI, 0.9 * Math.PI); g.lineTo(-5.5, -1); g.closePath(); fillStroke(g, hc, 1.2); }
    else { g.beginPath(); g.arc(0, -1.3, 1.8, 0.1 * Math.PI, 0.9 * Math.PI); g.lineWidth = 1.2; g.strokeStyle = OL; g.stroke(); }
    oval(g, -5, -2, 1.3, 0.8); g.fillStyle = 'rgba(255,120,120,.45)'; g.fill(); oval(g, 5, -2, 1.3, 0.8); g.fill();
  }
  const H = {
    academy:  { hair: 'short', hairCol: '#2d2d3a', outfit: '#5c7cfa', glasses: true, book: '#ffd54f' },
    office:   { hair: 'short', hairCol: '#3e2723', outfit: '#546e7a', tie: '#e53935' },
    subway:   { hair: 'cap', capCol: '#1a237e', outfit: '#283593', vest: '#ffb300' },
    home:     { hair: 'long', hairCol: '#5d4037', outfit: '#f48fb1', apron: '#ffffff' },
    gym:      { hair: 'short', hairCol: '#4e342e', outfit: '#e53935', beard: true, whistle: true },
    library:  { hair: 'long', hairCol: '#4a3030', outfit: '#8e7cc3', glasses: true, book: '#a5d6a7' },
    beach:    { hair: 'short', hairCol: '#6d4c41', outfit: '#ef5350', sunhat: true, whistle: true },
    airport:  { hair: 'bun', hairCol: '#3b2b25', outfit: '#1e3a6e', scarf: '#ffca28' },
    hospital: { hair: 'bun', hairCol: '#4e342e', outfit: '#f5f5f5', nurseCap: true, cross: true },
    mountain: { hair: 'helmet', outfit: '#ff7043', vest: '#ffe082' },
    stage:    { hair: 'short', hairCol: '#7b1fa2', outfit: '#6a1b9a', headset: true },
  };
  for (const id in H) HELPER[id] = (g) => person(g, H[id]);
  // 선행: 도움이 필요한 사람들 (아이·할머니·친구)
  const NPC = {
    child:  { s: 0.78, o: { hair: 'short', hairCol: '#5d4037', outfit: '#ffb74d', scarf: '#4fc3f7' } },
    elder:  { s: 0.95, o: { hair: 'bun', hairCol: '#e0e0e0', outfit: '#a1887f', glasses: true } },
    friend: { s: 0.9,  o: { hair: 'long', hairCol: '#3b2b25', outfit: '#81c784', book: '#ffd54f' } },
  };
  for (const k in NPC) HELPER['npc:' + k] = (g) => { g.translate(0, 17 * (1 - NPC[k].s)); g.scale(NPC[k].s, NPC[k].s); person(g, NPC[k].o); };

  /* ---------- 배경 ---------- */
  function floorPlanks(g, W, H2, base, step) { g.fillStyle = base; g.fillRect(0, 0, W, H2); for (let y = 0, i = 0; y < H2; y += step, i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.05)'; g.fillRect(0, y, W, step); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 1); } }
  function tiles(g, W, H2, base, size, line2) { g.fillStyle = base; g.fillRect(0, 0, W, H2); g.strokeStyle = line2; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x += size) { g.moveTo(x, 0); g.lineTo(x, H2); } for (let y = 0; y <= H2; y += size) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); }
  function rr(g, x, y, w, h, r2, col) { g.fillStyle = col; rrect(g, x, y, w, h, r2); g.fill(); }
  BG.academy = (g, W, H2) => {
    g.fillStyle = '#211a35'; g.fillRect(0, 0, W, H2);
    g.strokeStyle = 'rgba(190,150,255,.08)'; g.lineWidth = 1; g.beginPath(); for (let y = 70; y < H2; y += 22) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
    g.strokeStyle = 'rgba(255,100,140,.14)'; g.beginPath(); g.moveTo(34, 0); g.lineTo(34, H2); g.stroke();
    for (let r2 = 0; r2 < 5; r2++) for (let c = 0; c < 2; c++) { const x = 95 + c * 170, y = 140 + r2 * 85; rr(g, x - 60, y - 14, 120, 28, 6, '#2d2548'); circle(g, x - 45, y - 2, 6); g.fillStyle = 'rgba(255,230,150,.35)'; g.fill(); const lg = g.createRadialGradient(x - 45, y, 2, x - 45, y, 40); lg.addColorStop(0, 'rgba(255,230,150,.12)'); lg.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = lg; g.fillRect(x - 90, y - 40, 90, 80); }
  };
  BG.office = (g, W, H2) => {
    tiles(g, W, H2, '#18232b', 40, 'rgba(140,200,220,.06)');
    for (let r2 = 0; r2 < 4; r2++) for (let c = 0; c < 2; c++) { const x = 30 + c * 180, y = 120 + r2 * 115; g.fillStyle = '#22323d'; g.fillRect(x, y, 120, 6); g.fillRect(x, y, 6, 70); rr(g, x + 14, y + 14, 60, 22, 4, '#273a46'); rr(g, x + 24, y + 6, 26, 12, 2, '#3c5866'); g.fillStyle = 'rgba(120,220,255,.25)'; g.fillRect(x + 26, y + 8, 22, 8); }
  };
  BG.subway = (g, W, H2) => {
    g.fillStyle = '#10201f'; g.fillRect(0, 0, W, H2);
    for (let y = 60; y <= H2; y += 100) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y - 16, W, 32); g.strokeStyle = 'rgba(190,200,210,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y - 6); g.lineTo(W, y - 6); g.moveTo(0, y + 6); g.lineTo(W, y + 6); g.stroke(); g.fillStyle = 'rgba(150,120,90,.18)'; for (let x = 8; x < W; x += 22) g.fillRect(x, y - 11, 4, 22); }
    g.fillStyle = 'rgba(255,210,60,.25)'; for (let y = 105; y < H2; y += 100) g.fillRect(0, y, W, 3);
  };
  BG.home = (g, W, H2) => {
    floorPlanks(g, W, H2, '#1a1730', 30);
    oval(g, W / 2, H2 * 0.55, 130, 90); g.fillStyle = 'rgba(160,120,200,.12)'; g.fill();
    rr(g, 20, 90, 110, 70, 10, '#2a2645'); rr(g, 26, 96, 34, 20, 6, '#3b3660'); rr(g, 20, 120, 110, 40, 8, '#352f5a');
    rr(g, W - 120, 84, 90, 54, 6, '#1d2040'); g.fillStyle = 'rgba(200,210,255,.18)'; g.fillRect(W - 112, 90, 74, 42); circle(g, W - 60, 104, 9); g.fillStyle = 'rgba(255,250,200,.5)'; g.fill();
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect((i * 97) % W, (i * 193) % H2, 1.5, 1.5); }
  };
  BG.gym = (g, W, H2) => {
    tiles(g, W, H2, '#20161a', 40, 'rgba(255,150,150,.05)');
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let x = 60; x < W; x += 120) g.fillRect(x, 0, 3, H2);
    for (const [x, y] of [[50, 150], [W - 70, 260], [70, 420], [W - 60, 520]]) { g.fillStyle = '#2e2226'; g.fillRect(x - 18, y - 2, 36, 4); rr(g, x - 24, y - 9, 8, 18, 2, '#3b2c31'); rr(g, x + 16, y - 9, 8, 18, 2, '#3b2c31'); }
  };
  BG.library = (g, W, H2) => {
    g.fillStyle = '#1c1a12'; g.fillRect(0, 0, W, H2);
    const cols = ['#5c3d2e', '#2e4a3a', '#3a3a5c', '#5c2e3a', '#4a4a2e'];
    for (let r2 = 0; r2 < 5; r2++) { const y = 105 + r2 * 105; g.fillStyle = '#2b2416'; g.fillRect(0, y, W, 34); for (let x = 4, i = 0; x < W - 6; i++) { const w = 6 + ((i * 7) % 5); g.fillStyle = cols[(i + r2) % cols.length]; g.fillRect(x, y + 4 + ((i * 3) % 5), w, 26 - ((i * 3) % 5)); x += w + 1; } g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 30, W, 4); }
  };
  BG.beach = (g, W, H2) => {
    const sg = g.createLinearGradient(0, 0, 0, H2); sg.addColorStop(0, '#0f3a55'); sg.addColorStop(0.35, '#145c78'); sg.addColorStop(0.37, '#c9a86a'); sg.addColorStop(1, '#a8874f');
    g.fillStyle = sg; g.fillRect(0, 0, W, H2);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let y = 60; y < H2 * 0.35; y += 30) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const yy = y + Math.sin(x / 20 + y) * 3; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, H2 * 0.36 + Math.sin(x / 15) * 4); g.lineTo(W, H2 * 0.36 + 8); g.lineTo(0, H2 * 0.36 + 8); g.fill();
    for (const [x, y, col] of [[70, 380, '#ef5350'], [W - 80, 520, '#42a5f5']]) { g.beginPath(); g.arc(x, y, 30, Math.PI, 0); g.fillStyle = col; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1; }
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 80; i++) g.fillRect((i * 71) % W, H2 * 0.4 + ((i * 131) % (H2 * 0.6)), 2, 2);
  };
  BG.airport = (g, W, H2) => {
    tiles(g, W, H2, '#18202c', 48, 'rgba(200,220,255,.06)');
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let x = 0; x < W; x += 96) for (let y = 0; y < H2; y += 96) g.fillRect(x, y, 48, 48);
    g.fillStyle = '#222c3a'; g.fillRect(0, 300, W, 40); g.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < W; x += 18) g.fillRect(x, 302, 10, 36);
    rr(g, W / 2 - 70, 90, 140, 26, 5, '#203048'); g.fillStyle = 'rgba(255,214,0,.6)'; g.fillRect(W / 2 - 60, 98, 40, 10); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(W / 2 - 10, 99, 66, 8);
  };
  BG.hospital = (g, W, H2) => {
    tiles(g, W, H2, '#162628', 36, 'rgba(160,255,230,.06)');
    for (let i = 0; i < 3; i++) { const y = 130 + i * 160; rr(g, 16, y, 70, 110, 8, '#1e3335'); rr(g, 20, y + 4, 62, 26, 6, '#2b4a4c'); rr(g, W - 86, y + 40, 70, 110, 8, '#1e3335'); rr(g, W - 82, y + 44, 62, 26, 6, '#2b4a4c'); }
    g.fillStyle = 'rgba(255,90,90,.35)'; g.fillRect(W / 2 - 4, 88, 8, 24); g.fillRect(W / 2 - 12, 96, 24, 8);
  };
  BG.mountain = (g, W, H2) => {
    const sg = g.createLinearGradient(0, 0, 0, H2); sg.addColorStop(0, '#1a2a26'); sg.addColorStop(1, '#14201a'); g.fillStyle = sg; g.fillRect(0, 0, W, H2);
    g.fillStyle = 'rgba(90,70,50,.25)'; g.beginPath(); g.moveTo(W * 0.35, H2); g.quadraticCurveTo(W * 0.6, H2 * 0.6, W * 0.45, H2 * 0.35); g.quadraticCurveTo(W * 0.35, H2 * 0.2, W * 0.55, 60); g.lineTo(W * 0.7, 60); g.quadraticCurveTo(W * 0.5, H2 * 0.2, W * 0.6, H2 * 0.35); g.quadraticCurveTo(W * 0.75, H2 * 0.6, W * 0.55, H2); g.fill();
    for (const [x, y, s] of [[40, 160, 1], [W - 40, 230, 1.2], [60, 380, 1.1], [W - 60, 470, 0.9], [30, 560, 1.2], [W - 30, 120, 0.8]]) { g.fillStyle = '#1f3a2a'; g.beginPath(); g.moveTo(x, y - 34 * s); g.lineTo(x + 18 * s, y); g.lineTo(x - 18 * s, y); g.fill(); g.fillStyle = '#244634'; g.beginPath(); g.moveTo(x, y - 48 * s); g.lineTo(x + 13 * s, y - 20 * s); g.lineTo(x - 13 * s, y - 20 * s); g.fill(); }
    for (const [x, y] of [[120, 300], [250, 420], [200, 200]]) { oval(g, x, y, 12, 7); g.fillStyle = 'rgba(160,160,160,.18)'; g.fill(); }
  };
  BG.stage = (g, W, H2) => {
    floorPlanks(g, W, H2, '#1e0f24', 34);
    g.fillStyle = '#5a1030'; g.fillRect(0, 52, W, 36); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < W; x += 24) g.fillRect(x, 52, 10, 36);
    for (const [x, col] of [[80, 'rgba(255,200,255,.08)'], [W / 2, 'rgba(255,240,180,.09)'], [W - 80, 'rgba(180,220,255,.08)']]) { g.fillStyle = col; g.beginPath(); g.moveTo(x - 10, 88); g.lineTo(x + 10, 88); g.lineTo(x + 70, H2); g.lineTo(x - 70, H2); g.fill(); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect((i * 97) % W, 100 + (i * 193) % (H2 - 100), 1.5, 1.5); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
