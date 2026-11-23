/* Echo Rush — 에코(과거의 나) 모습 20가지: 사람 유령 대신 귀여운 동료 하나로.
 * 모두 회색빛 톤(컬러인 나와 한눈에 구분), 둥글고 도톰하게(작게 그려도 잘 보이게), 방해 요소(구름·물방울·젤리 등)와 겹치지 않는 모양.
 * 그리기 함수는 (g, t): 가운데 (0,0), 대략 반지름 12. t = 초 (날갯짓·깜빡임 등 움직임) */
(function (root) {
  'use strict';
  const Art = root.Art; if (!Art) return;
  const OL = '#1c1930', BASE = '#dfe3ec', SHADE = '#b9bfcc', SOFT = '#f5f7fb', DARK = '#8f96a6', PINK = '#efb8c8', BEAK = '#f0d27e';
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const oval = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); };
  const fs = (g, fill, lw) => { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 1.6; g.strokeStyle = OL; g.stroke(); };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const blinkAt = (t, p) => (t % p) < 0.12;
  /** 얼굴: 눈 두 개(가끔 깜빡) + 웃는 입 + 볼터치 */
  function face(g, x, y, s, t, p) {
    s = s || 1; const bl = blinkAt(t || 0, p || 3);
    g.fillStyle = OL; g.strokeStyle = OL;
    if (bl) { g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(x - 3.5 * s, y); g.lineTo(x - 1.7 * s, y); g.moveTo(x + 1.7 * s, y); g.lineTo(x + 3.5 * s, y); g.stroke(); }
    else {
      circle(g, x - 2.6 * s, y, 1.1 * s); g.fill(); circle(g, x + 2.6 * s, y, 1.1 * s); g.fill();
      g.fillStyle = '#fff'; circle(g, x - 2.3 * s, y - 0.4 * s, 0.4 * s); g.fill(); circle(g, x + 2.9 * s, y - 0.4 * s, 0.4 * s); g.fill();
    }
    g.beginPath(); g.arc(x, y + 1.6 * s, 1.2 * s, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 1 * s; g.strokeStyle = OL; g.stroke();
    g.fillStyle = 'rgba(255,140,170,.42)'; oval(g, x - 4.3 * s, y + 1.5 * s, 1.2 * s, 0.7 * s); g.fill(); oval(g, x + 4.3 * s, y + 1.5 * s, 1.2 * s, 0.7 * s); g.fill();
  }
  function glow(g, r, a) { const gr = g.createRadialGradient(0, 0, 1, 0, 0, r); gr.addColorStop(0, `rgba(240,244,255,${a})`); gr.addColorStop(1, 'rgba(240,244,255,0)'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); }
  function sparkle(g, x, y, r, a) { g.save(); g.globalAlpha *= Math.max(0, a); g.fillStyle = SOFT; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.restore(); }
  function feet(g, y, t, sx) { const k = Math.sin(t * 9) * 1.2; oval(g, -3.6 * (sx || 1), y + Math.max(0, k), 2.6, 1.6); fs(g, SHADE, 1.2); oval(g, 3.6 * (sx || 1), y + Math.max(0, -k), 2.6, 1.6); fs(g, SHADE, 1.2); }

  /** 네발 동물(머리 큰 꼬마 체형): 몸 → 꼬리 → 머리 → 귀 → 얼굴. ears: 그리기 함수, extra: 머리 위 장식 */
  function critter(g, t, o) {
    const hop = Math.abs(Math.sin(t * 5)) * 1.2;
    g.save(); g.translate(0, -hop);
    if (o.tail) o.tail(g, t);
    oval(g, 0, 6.5, 7, 5.2); fs(g, o.body || BASE, 1.7);                   // 몸
    if (o.belly) { oval(g, 0, 7.5, 4, 3.2); g.fillStyle = o.belly; g.fill(); }
    feet(g, 11, t);
    if (o.earsBack) o.earsBack(g, t);
    oval(g, 0, -3, o.hw || 9.5, o.hh || 8.2); fs(g, o.head || BASE, 1.8);  // 머리
    if (o.ears) o.ears(g, t);
    if (o.mask) o.mask(g, t);
    face(g, 0, -2.4, 0.85, t, o.blink);
    if (o.nose !== false) { oval(g, 0, -0.9, 0.9, 0.6); g.fillStyle = OL; g.fill(); }
    if (o.extra) o.extra(g, t);
    g.restore();
  }
  const triEar = (sx, x, w, h, inner) => (g) => {
    g.beginPath(); g.moveTo(sx * (x - w), -8); g.quadraticCurveTo(sx * x, -8 - h * 1.25, sx * (x + w * 0.3), -8 - h); g.quadraticCurveTo(sx * (x + w * 0.8), -8 - h * 0.4, sx * (x + w), -6.5); g.closePath(); fs(g, BASE, 1.5);
    if (inner) { g.beginPath(); g.moveTo(sx * (x - w * 0.45), -8.4); g.quadraticCurveTo(sx * x, -8 - h * 0.95, sx * (x + w * 0.25), -8 - h * 0.7); g.quadraticCurveTo(sx * (x + w * 0.5), -8 - h * 0.3, sx * (x + w * 0.5), -7.6); g.closePath(); g.fillStyle = inner; g.fill(); }
  };
  const roundEar = (x, y, r, inner, col) => (g) => { for (const sx of [-1, 1]) { circle(g, sx * x, y, r); fs(g, col || BASE, 1.5); if (inner) { circle(g, sx * x, y, r * 0.5); g.fillStyle = inner; g.fill(); } } };

  const FORMS = {
    /* 1. 기억 별 */
    star(g, t) {
      glow(g, 18, 0.35);
      g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.8 : 12; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.lineJoin = 'round'; fs(g, BASE, 1.9);
      face(g, 0, 0.5, 0.85, t, 3.2);
      sparkle(g, 13, -9, 2.6, 0.5 + 0.5 * Math.sin(t * 5)); sparkle(g, -13, 6, 2, 0.5 + 0.5 * Math.sin(t * 4 + 2));
    },
    /* 2. 메아리 새 */
    bird(g, t) {
      const flap = Math.sin(t * 12);
      g.save(); g.translate(-3, -1); g.rotate(-0.5 - flap * 0.5); oval(g, -4, -2, 6, 3.4, -0.3); fs(g, SHADE, 1.5); g.restore();
      oval(g, 0, 0, 10, 9); fs(g, BASE, 1.8);
      g.beginPath(); g.moveTo(9, -1); g.lineTo(14, 0.5); g.lineTo(9, 2.5); g.closePath(); fs(g, BEAK, 1.3);
      oval(g, 0, 3, 5.5, 4); g.fillStyle = SOFT; g.fill();
      g.save(); g.translate(-1, 1); g.rotate(0.4 + flap * 0.5); oval(g, -4, 0, 6, 3.2, 0.2); fs(g, SHADE, 1.5); g.restore();
      g.beginPath(); g.moveTo(-2, -8.5); g.quadraticCurveTo(0, -13, 3, -9); fs(g, BASE, 1.3);
      face(g, 3.5, -2, 0.7, t, 2.8);
      g.strokeStyle = 'rgba(230,234,245,.7)'; g.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) { const k = ((t * 1.2 + i / 3) % 1); g.globalAlpha = 1 - k; g.beginPath(); g.arc(14, 0.5, 3 + k * 9, -0.6, 0.6); g.stroke(); }
      g.globalAlpha = 1;
    },
    /* 3. 기록 로봇 */
    robot(g, t) {
      g.translate(0, -Math.abs(Math.sin(t * 4)) * 1.2);
      g.beginPath(); g.moveTo(0, -11); g.lineTo(0, -15); g.lineWidth = 1.4; g.strokeStyle = OL; g.stroke();
      circle(g, 0, -16, 2.1); fs(g, Math.sin(t * 6) > 0 ? '#ffe58a' : '#fff3c4', 1.2);
      rr(g, -9, -11, 18, 13, 4); fs(g, BASE, 1.8);
      rr(g, -6.6, -8.6, 13.2, 8.2, 2.6); fs(g, '#3a4466', 1.2);
      g.fillStyle = '#c9f3ff';
      if (blinkAt(t, 3)) { g.fillRect(-4.2, -4.8, 2.6, 0.9); g.fillRect(1.6, -4.8, 2.6, 0.9); } else { g.fillRect(-3.8, -6, 1.8, 2.6); g.fillRect(2, -6, 1.8, 2.6); }
      rr(g, -6.5, 2.5, 13, 9, 3); fs(g, SHADE, 1.6);
      g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 7, 2.6, -0.3, Math.PI * 1.6); g.stroke();
      g.fillStyle = OL; g.beginPath(); g.moveTo(2.6, 4); g.lineTo(3.4, 6.6); g.lineTo(1, 5.8); g.closePath(); g.fill();
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 6.5, 5); g.lineTo(sx * 10, 7 + Math.sin(t * 6 + sx) * 1.5); g.lineWidth = 2.6; g.strokeStyle = OL; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = SHADE; g.stroke(); }
    },
    /* 4. 반딧불 */
    firefly(g, t) {
      glow(g, 20, 0.45 + 0.2 * Math.sin(t * 3));
      const flap = Math.sin(t * 16) * 0.5;
      for (const sx of [-1, 1]) { g.save(); g.rotate(sx * (0.5 + flap)); oval(g, sx * 7, -8, 4, 6.5, sx * 0.4); g.fillStyle = 'rgba(235,240,255,.55)'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = 'rgba(28,25,48,.7)'; g.stroke(); g.restore(); }
      circle(g, 0, 0, 9); fs(g, BASE, 1.8);
      circle(g, 0, 7, 5); fs(g, '#fff6c9', 1.4);
      face(g, 0, -1.5, 0.75, t, 3.4);
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 2, -8); g.quadraticCurveTo(sx * 4, -13, sx * 6, -12); g.lineWidth = 1.1; g.strokeStyle = OL; g.stroke(); }
    },
    /* 5. 병아리 */
    chick(g, t) {
      const hop = Math.abs(Math.sin(t * 6)) * 1.5;
      g.translate(0, -hop);
      feet(g, 10.5, t);
      oval(g, 0, 1, 10, 9.5); fs(g, BASE, 1.8);
      const fl = Math.sin(t * 14) * 0.4;
      for (const sx of [-1, 1]) { g.save(); g.translate(sx * 9, 3); g.rotate(sx * (0.5 + fl)); oval(g, 0, 0, 2.2, 3.8); fs(g, SHADE, 1.3); g.restore(); }
      g.beginPath(); g.moveTo(-1.5, -8); g.quadraticCurveTo(-1, -12.5, 1, -12); g.quadraticCurveTo(0.5, -10, 2, -8.5); fs(g, BASE, 1.2);   // 머리 깃
      face(g, 0, -1, 0.8, t, 2.6);
      g.beginPath(); g.moveTo(-1.8, 1.2); g.lineTo(1.8, 1.2); g.lineTo(0, 3.4); g.closePath(); fs(g, BEAK, 1.1);
    },
    /* 6. 아기 고양이 */
    cat(g, t) {
      critter(g, t, {
        tail: (g2, tt) => { g2.beginPath(); g2.moveTo(5, 8); g2.quadraticCurveTo(13, 6 + Math.sin(tt * 4) * 2, 11, -1 + Math.sin(tt * 4) * 2); g2.lineWidth = 4.2; g2.strokeStyle = OL; g2.stroke(); g2.lineWidth = 2.4; g2.strokeStyle = BASE; g2.stroke(); },
        ears: (g2) => { triEar(-1, 6, 3.4, 5.5, PINK)(g2); triEar(1, 6, 3.4, 5.5, PINK)(g2); },
        extra: (g2) => { g2.strokeStyle = OL; g2.lineWidth = 0.8; for (const sx of [-1, 1]) { g2.beginPath(); g2.moveTo(sx * 6.5, -1); g2.lineTo(sx * 10.5, -2); g2.moveTo(sx * 6.5, 0.3); g2.lineTo(sx * 10.5, 0.8); g2.stroke(); } },
      });
    },
    /* 7. 강아지 */
    puppy(g, t) {
      critter(g, t, {
        tail: (g2, tt) => { g2.save(); g2.translate(6, 6); g2.rotate(-0.6 + Math.sin(tt * 14) * 0.5); oval(g2, 3, 0, 3.6, 1.9); fs(g2, BASE, 1.3); g2.restore(); },
        ears: (g2, tt) => { for (const sx of [-1, 1]) { g2.save(); g2.translate(sx * 8, -7); g2.rotate(sx * (0.35 + Math.sin(tt * 5) * 0.08)); oval(g2, 0, 4, 3, 5.4); fs(g2, DARK, 1.5); g2.restore(); } },
        extra: (g2) => { oval(g2, 3.5, -5.5, 2.6, 2); g2.fillStyle = 'rgba(143,150,166,.55)'; g2.fill(); },
      });
    },
    /* 8. 토끼 */
    bunny(g, t) {
      critter(g, t, {
        tail: (g2) => { circle(g2, -6.5, 9, 2.6); fs(g2, SOFT, 1.3); },
        earsBack: (g2, tt) => { for (const sx of [-1, 1]) { g2.save(); g2.translate(sx * 3.6, -9); g2.rotate(sx * (0.18 + (sx > 0 ? Math.max(0, Math.sin(tt * 2)) * 0.5 : 0))); oval(g2, 0, -7, 2.8, 7.5); fs(g2, BASE, 1.6); oval(g2, 0, -7, 1.3, 5.5); g2.fillStyle = PINK; g2.fill(); g2.restore(); } },
        nose: true,
      });
    },
    /* 9. 햄스터 */
    hamster(g, t) {
      critter(g, t, {
        hw: 10.5, hh: 8.8,
        ears: roundEar(7, -10, 2.6, PINK),
        extra: (g2) => { for (const sx of [-1, 1]) { oval(g2, sx * 6.6, 0.8, 3.2, 2.6); g2.fillStyle = SOFT; g2.fill(); } g2.fillStyle = 'rgba(255,140,170,.42)'; oval(g2, -4.3, -0.9, 1.2, 0.7); g2.fill(); oval(g2, 4.3, -0.9, 1.2, 0.7); g2.fill(); },
        belly: SOFT,
      });
    },
    /* 10. 아기 펭귄 */
    penguin(g, t) {
      const wob = Math.sin(t * 6) * 0.12;
      g.rotate(wob);
      feet(g, 11, t);
      oval(g, 0, 0, 9.5, 11); fs(g, DARK, 1.8);
      oval(g, 0, 2, 6.8, 8.5); g.fillStyle = SOFT; g.fill();
      for (const sx of [-1, 1]) { g.save(); g.translate(sx * 9, 2); g.rotate(sx * (0.35 + Math.sin(t * 6) * 0.25)); oval(g, 0, 2, 2, 5); fs(g, DARK, 1.3); g.restore(); }
      face(g, 0, -3, 0.8, t, 3);
      g.beginPath(); g.moveTo(-1.7, -1.4); g.lineTo(1.7, -1.4); g.lineTo(0, 0.6); g.closePath(); fs(g, BEAK, 1);
    },
    /* 11. 아기 곰 */
    bear(g, t) {
      critter(g, t, {
        ears: roundEar(7, -9.5, 3.2, SHADE),
        extra: (g2) => { oval(g2, 0, -0.4, 3.6, 2.6); g2.fillStyle = SOFT; g2.fill(); oval(g2, 0, -1.2, 1.3, 0.9); g2.fillStyle = OL; g2.fill(); },
        nose: false, belly: SOFT,
      });
    },
    /* 12. 부엉이 */
    owl(g, t) {
      g.translate(0, Math.sin(t * 3) * 0.6);
      feet(g, 11, t);
      oval(g, 0, 1, 10.5, 11); fs(g, SHADE, 1.8);
      oval(g, 0, 4, 6.5, 6.5); g.fillStyle = SOFT; g.fill();
      g.strokeStyle = 'rgba(28,25,48,.35)'; g.lineWidth = 0.9; for (const [x, y] of [[-2.5, 3], [2.5, 3], [0, 6], [-2.5, 8.5], [2.5, 8.5]]) { g.beginPath(); g.arc(x, y, 1.3, 0.2, Math.PI - 0.2); g.stroke(); }
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 4, -8.5); g.lineTo(sx * 8.5, -13); g.lineTo(sx * 9.2, -6.5); g.closePath(); fs(g, SHADE, 1.4); }   // 귀깃
      for (const sx of [-1, 1]) { circle(g, sx * 3.6, -3.5, 3.6); fs(g, SOFT, 1.3); }
      const bl = blinkAt(t, 3.6); g.fillStyle = OL;
      for (const sx of [-1, 1]) { if (bl) { g.fillRect(sx * 3.6 - 1.8, -3.8, 3.6, 0.9); } else { circle(g, sx * 3.6, -3.5, 1.6); g.fill(); g.fillStyle = '#fff'; circle(g, sx * 3.6 + 0.5, -4, 0.5); g.fill(); g.fillStyle = OL; } }
      g.beginPath(); g.moveTo(-1.2, -1); g.lineTo(1.2, -1); g.lineTo(0, 1.4); g.closePath(); fs(g, BEAK, 1);
      for (const sx of [-1, 1]) { g.save(); g.translate(sx * 10, 2); g.rotate(sx * (0.2 + Math.sin(t * 5) * 0.12)); oval(g, 0, 2, 2.2, 5); fs(g, DARK, 1.3); g.restore(); }
    },
    /* 13. 다람쥐 */
    squirrel(g, t) {
      critter(g, t, {
        tail: (g2, tt) => { g2.save(); g2.translate(-6, 4); g2.rotate(-0.25 + Math.sin(tt * 4) * 0.12); g2.beginPath(); g2.moveTo(0, 6); g2.bezierCurveTo(-12, 6, -12, -14, -2, -14); g2.bezierCurveTo(3, -14, 4, -8, 0, -6); g2.bezierCurveTo(-5, -4, -4, 2, 2, 4); g2.closePath(); fs(g2, SHADE, 1.6); g2.restore(); },
        ears: (g2) => { triEar(-1, 5.5, 2.6, 4.6, PINK)(g2); triEar(1, 5.5, 2.6, 4.6, PINK)(g2); },
        belly: SOFT,
        extra: (g2) => { oval(g2, 0, 7.2, 2.2, 1.8); fs(g2, '#c9a98a', 1); },   // 도토리
      });
    },
    /* 14. 아기 여우 */
    fox(g, t) {
      critter(g, t, {
        tail: (g2, tt) => { g2.save(); g2.translate(6, 7); g2.rotate(-0.9 + Math.sin(tt * 4) * 0.2); oval(g2, 5, 0, 6.5, 3.4); fs(g2, SHADE, 1.5); oval(g2, 9.5, 0, 2.4, 2.2); g2.fillStyle = SOFT; g2.fill(); g2.restore(); },
        ears: (g2) => { triEar(-1, 6, 3.6, 6.5, DARK)(g2); triEar(1, 6, 3.6, 6.5, DARK)(g2); },
        head: SHADE,
        mask: (g2) => { g2.beginPath(); g2.moveTo(-8.5, -2); g2.quadraticCurveTo(-4, 4, 0, 4.6); g2.quadraticCurveTo(4, 4, 8.5, -2); g2.quadraticCurveTo(4, 0.6, 0, -0.6); g2.quadraticCurveTo(-4, 0.6, -8.5, -2); g2.fillStyle = SOFT; g2.fill(); },
      });
    },
    /* 15. 판다 */
    panda(g, t) {
      critter(g, t, {
        body: DARK,
        ears: roundEar(7, -9.5, 3, null, DARK),
        mask: (g2) => { for (const sx of [-1, 1]) { oval(g2, sx * 2.8, -2.6, 2.3, 2.9, sx * -0.5); g2.fillStyle = DARK; g2.fill(); } },
        belly: BASE,
      });
    },
    /* 16. 코알라 */
    koala(g, t) {
      critter(g, t, {
        body: SHADE, head: SHADE, hw: 9.5,
        earsBack: roundEar(8.6, -7, 4.6, SOFT, SHADE),
        nose: false,
        extra: (g2) => { oval(g2, 0, -0.6, 2, 2.6); fs(g2, '#5b6170', 1); },
        belly: BASE,
      });
    },
    /* 17. 아기 고래 */
    whale(g, t) {
      const sw = Math.sin(t * 3) * 0.08;
      g.rotate(sw);
      for (let i = 0; i < 3; i++) { const k = (t * 1.1 + i / 3) % 1; g.globalAlpha = 1 - k; circle(g, -2 + (i - 1) * 2.5 * k, -11 - k * 6, 1.4 * (1 - k * 0.5)); g.fillStyle = SOFT; g.fill(); }   // 물 뿜기
      g.globalAlpha = 1;
      g.save(); g.translate(-10, 1); g.rotate(Math.sin(t * 5) * 0.3); g.beginPath(); g.moveTo(1, 0); g.lineTo(-5, -4.5); g.quadraticCurveTo(-4, 0, -5, 4.5); g.closePath(); fs(g, SHADE, 1.4); g.restore();   // 꼬리
      oval(g, 1, 1, 11, 8.5); fs(g, SHADE, 1.8);
      g.beginPath(); g.ellipse(1, 3, 9.5, 5.5, 0, 0.05 * Math.PI, 0.95 * Math.PI); g.fillStyle = SOFT; g.fill();
      oval(g, 2, 5, 3, 1.6, -0.4); fs(g, SHADE, 1.1);
      face(g, 4, -1, 0.75, t, 3.3);
    },
    /* 18. 아기 공룡 */
    dino(g, t) {
      critter(g, t, {
        tail: (g2, tt) => { g2.beginPath(); g2.moveTo(-5, 4); g2.quadraticCurveTo(-13, 8 + Math.sin(tt * 4), -14, 2 + Math.sin(tt * 4) * 1.5); g2.quadraticCurveTo(-10, 6, -4, 9); g2.closePath(); fs(g2, SHADE, 1.4); },
        head: SHADE, body: SHADE, hw: 9.8, hh: 8,
        earsBack: (g2) => { for (const [x, y] of [[-5.6, -9.6], [0, -11.2], [5.6, -9.6]]) { g2.beginPath(); g2.moveTo(x - 3, y + 1.5); g2.quadraticCurveTo(x, y - 6.5, x + 3, y + 1.5); g2.closePath(); fs(g2, BASE, 1.4); } },   // 등의 둥근 돌기
        nose: false, belly: BASE,
      });
    },
    /* 19. 꼬마 용 */
    dragon(g, t) {
      const flap = Math.sin(t * 10) * 0.45;
      for (const sx of [-1, 1]) { g.save(); g.translate(sx * 6, -1); g.rotate(sx * (-0.4 - flap)); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sx * 8, -9, sx * 11, -3); g.quadraticCurveTo(sx * 8, -2, sx * 9, 2); g.quadraticCurveTo(sx * 5, 1, 0, 3); g.closePath(); fs(g, SOFT, 1.4); g.restore(); }
      critter(g, t, {
        head: SHADE, body: SHADE, hw: 9.5, hh: 8,
        tail: (g2, tt) => { g2.beginPath(); g2.moveTo(-4, 7); g2.quadraticCurveTo(-12, 10, -12, 4 + Math.sin(tt * 4) * 2); g2.lineWidth = 4; g2.strokeStyle = OL; g2.stroke(); g2.lineWidth = 2.2; g2.strokeStyle = SHADE; g2.stroke(); },
        earsBack: (g2) => { for (const sx of [-1, 1]) { g2.beginPath(); g2.moveTo(sx * 4, -9); g2.quadraticCurveTo(sx * 6.5, -14, sx * 7.5, -13.5); g2.quadraticCurveTo(sx * 7, -11, sx * 7.4, -8.2); g2.closePath(); fs(g2, BEAK, 1.2); } },   // 작은 뿔
        belly: BASE,
        extra: (g2) => { for (const sx of [-1, 1]) { circle(g2, sx * 1.2, -0.5, 0.5); g2.fillStyle = OL; g2.fill(); } },
        nose: false,
      });
    },
    /* 20. 꼬마 UFO */
    ufo(g, t) {
      g.translate(0, Math.sin(t * 3) * 1.2);
      g.fillStyle = 'rgba(230,236,255,.18)'; g.beginPath(); g.moveTo(-5, 4); g.lineTo(5, 4); g.lineTo(9, 15); g.lineTo(-9, 15); g.closePath(); g.fill();   // 빛줄기
      g.beginPath(); g.ellipse(0, -2, 6.8, 7, 0, Math.PI, 0); g.closePath(); g.fillStyle = 'rgba(220,236,255,.75)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = OL; g.stroke();   // 유리 돔
      face(g, 0, -4.2, 0.75, t, 3);
      oval(g, 0, 0.5, 13, 4.8); fs(g, SHADE, 1.8);
      oval(g, 0, -0.6, 9, 2); g.fillStyle = SOFT; g.fill();
      for (let i = 0; i < 5; i++) { const x = -9 + i * 4.5; circle(g, x, 2.4, 1.1); g.fillStyle = Math.floor(t * 5 + i) % 2 ? '#fff3c4' : '#c9f3ff'; g.fill(); }
    },
  };
  const IDS = Object.keys(FORMS);

  let form = 'star';
  let offEcho = null;
  const ECHO_ALPHA = 0.85;  // main.js가 0.3을 넘기므로 실제 불투명도 약 0.26 (처음 0.63 → 0.39 → 0.26)
  Object.assign(Art, {
    ECHO_FORM_IDS: IDS,
    /** 게임에 쓸 에코 모습 */
    setEchoForm(id) { form = FORMS[id] ? id : 'star'; return form; },
    /** 에코 모습 하나 그리기 (메뉴 미리보기 등). scale: 크기 배율, t: 초 */
    drawEchoForm(ctx, id, x, y, scale, t) {
      const fn = FORMS[id] || FORMS.star;
      ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      fn(ctx, t === undefined ? performance.now() / 1000 : t);
      ctx.restore();
    },
    /** 에코 = 과거의 나: 고른 모습의 회색 동료가 둥실둥실 따라다닌다 (움직이는 쪽을 바라봄) */
    drawEcho(ctx, ec, emo, now, alpha) {
      const t = now / 1000 + ec.id * 0.37, bob = Math.sin(now / 400 + ec.id) * 1.8;
      const dir = ec._lx !== undefined && Math.abs(ec.x - ec._lx) > 0.05 ? (ec.x < ec._lx ? -1 : 1) : (ec._dir || 1); ec._lx = ec.x; ec._dir = dir;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(ec.x, ec.y + 15, 9, 3, 0, 0, Math.PI * 2); ctx.fill();   // 바닥 그림자 (떠 있는 느낌)
      // 반투명: 따로 그린 뒤 한 번에 흐리게 찍는다 (겹친 부분이 진해지지 않고 고르게 비침 → 진한 색의 적과 한눈에 구분)
      const R = 26, Q = 3;
      if (!offEcho) { offEcho = document.createElement('canvas'); offEcho.width = offEcho.height = R * 2 * Q; }
      const g = offEcho.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, offEcho.width, offEcho.height);
      g.setTransform(1.45 * dir * Q, 0, 0, 1.45 * Q, R * Q, R * Q); g.lineCap = 'round'; g.lineJoin = 'round';
      (FORMS[form] || FORMS.star)(g, t);
      ctx.save(); ctx.globalAlpha = Math.min(1, alpha * ECHO_ALPHA);
      ctx.drawImage(offEcho, ec.x - R, ec.y - 2 + bob - R, R * 2, R * 2);
      ctx.restore();
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
