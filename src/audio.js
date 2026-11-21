/* 퇴근 에코 — 효과음 (WebAudio 합성, 외부 에셋 없음) */
(function (root) {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;
  const last = {};

  function ac() {
    if (muted) return null;
    return ctxAlways();
  }
  /** 음소거여도 컨텍스트는 만든다 (배경음악은 음량 0으로 계속 박자를 유지) */
  function ctxAlways() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try {
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        master = ctx.createDynamicsCompressor();
        const g = ctx.createGain(); g.gain.value = 1.4;
        master.connect(g); g.connect(ctx.destination);
      } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(f0, f1, dur, type, vol, delay) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** 부드럽게 시작하는 음 (딱 소리 없이): 짧게 올라갔다가 자연스럽게 사라짐 */
  function soft(f, dur, type, vol, delay) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.025);   // 살짝 미끄러져 올라가는 "뿅"
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // 구슬을 연달아 먹으면 짧은 선율을 따라 오르내린다 (도 레 미 솔 라 솔 미 레 → 반복)
  // 계속 올라가기만 하면 높은 음이 쌓여 소음이 되므로, 가운데 음역에서 물결처럼 돈다
  const GEM_MELODY = [0, 2, 4, 7, 9, 7, 4, 2];
  let gemStep = 0, gemLast = 0;
  function gemSound() {
    const now = (root.performance || Date).now();
    gemStep = now - gemLast < 450 ? (gemStep + 1) % GEM_MELODY.length : 0;
    gemLast = now;
    const f = 784 * Math.pow(2, GEM_MELODY[gemStep] / 12);   // 솔(784Hz)에서 시작
    soft(f, 0.12, 'sine', 0.075);                // 맑은 몸통 (이전보다 작게)
    soft(f * 2, 0.07, 'triangle', 0.018, 0.025); // 살짝 반짝이는 윗소리
  }

  // 적 처치: 거친 잡음 대신 "톡" 터지는 방울 + 맑은 한 음 (펜타토닉에서 무작위라 반복돼도 덜 지루함)
  const POP_NOTES = [523, 587, 659, 784, 880];
  function killSound() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.08);   // 방울이 톡 터지는 느낌
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12);
    soft(POP_NOTES[Math.floor(Math.random() * POP_NOTES.length)] * 2, 0.1, 'triangle', 0.045, 0.01);
  }

  // 레벨업: 딱 소리 없이 시작하는 맑은 "띠리링" 상승 아르페지오 + 마지막 음은 살짝 반짝이며 길게
  function levelupSound() {
    const notes = [784, 988, 1175, 1568];   // 솔 시 레 솔 (밝은 장조)
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      soft(f, last ? 0.42 : 0.16, 'sine', last ? 0.07 : 0.06, i * 0.065);
      soft(f * 2, last ? 0.3 : 0.08, 'triangle', 0.012, i * 0.065 + 0.01);   // 은은한 윗소리
    });
    soft(1568 * 1.005, 0.42, 'sine', 0.03, 3 * 0.065 + 0.02);   // 살짝 어긋난 음으로 반짝임(코러스)
  }

  // 피격: 거친 잡음 대신 "뿌잉" 하고 내려가는 말랑한 소리 (아픈 건 알 수 있게, 귀는 편하게)
  function hurtSound() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.16);   // 아래로 미끄러지는 "뿌잉"
    f.type = 'lowpass'; f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
    // 몸에 닿는 느낌의 부드러운 '통' (낮은 사인)
    const b = c.createOscillator(), bg = c.createGain();
    b.type = 'sine'; b.frequency.setValueAtTime(180, t); b.frequency.exponentialRampToValueAtTime(90, t + 0.1);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.12, t + 0.006); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    b.connect(bg); bg.connect(master); b.start(t); b.stop(t + 0.14);
  }

  // 보스 극복: 낮게 '쿵' 터지고 → 반짝이는 상승 팡파르
  function bossDownSound() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.75);
    noise(0.35, 0.09);
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => soft(f, i === 5 ? 0.6 : 0.2, 'triangle', 0.06, 0.35 + i * 0.07));
    soft(2093, 0.5, 'sine', 0.025, 0.35 + 5 * 0.07 + 0.03);
  }

  function noise(dur, vol) {
    const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol;
    s.connect(g); g.connect(master); s.start();
  }

  const DEF = {
    shoot:    { gap: 110, fn: () => tone(700, 420, 0.05, 'square', 0.025) },
    hit:      { gap: 60,  fn: () => tone(220, 130, 0.04, 'sawtooth', 0.02) },
    kill:     { gap: 45,  fn: killSound },
    gem:      { gap: 55,  fn: gemSound },   // 한꺼번에 빨아들여도 소리가 겹쳐 시끄럽지 않게
    levelup:  { gap: 120, fn: levelupSound },
    hurt:     { gap: 120, fn: hurtSound },
    nova:     { gap: 100, fn: () => { tone(300, 80, 0.3, 'sine', 0.1); noise(0.15, 0.04); } },
    echoDown: { gap: 80,  fn: () => tone(600, 150, 0.25, 'sine', 0.06) },
    boss:     { gap: 0,   fn: () => { tone(110, 70, 0.6, 'sawtooth', 0.1); tone(165, 90, 0.6, 'square', 0.05, 0.1); } },
    heal:     { gap: 100, fn: () => { tone(660, 990, 0.12, 'sine', 0.06); tone(990, 1320, 0.12, 'sine', 0.05, 0.1); } },
    win:      { gap: 0,   fn: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.08, i * 0.1)) },
    lose:     { gap: 0,   fn: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.9, 0.3, 'sine', 0.08, i * 0.18)) },
    train:    { gap: 400, fn: () => { tone(220, 220, 0.25, 'sawtooth', 0.09); tone(277, 277, 0.25, 'sawtooth', 0.07); tone(220, 200, 0.25, 'sawtooth', 0.09, 0.3); tone(277, 250, 0.25, 'sawtooth', 0.07, 0.3); } },
    bossDown: { gap: 300, fn: bossDownSound },
    click:    { gap: 0,   fn: () => tone(500, 700, 0.06, 'triangle', 0.05) },
  };

  root.Sfx = {
    play(name) {
      const d = DEF[name];
      if (!d || muted) return;
      const now = (root.performance || Date).now();
      if (last[name] && now - last[name] < d.gap) return;
      last[name] = now;
      d.fn();
    },
    unlock() { ac(); },
    setMuted(m) { muted = !!m; if (root.Music) root.Music.setMuted(muted); },
    /** 배경음악(music.js)용: 같은 AudioContext와 출력 */
    context() { return ctxAlways(); },
    output() { ctxAlways(); return master; },
    isMuted() { return muted; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
