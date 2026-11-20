/* 퇴근 에코 — 효과음 (WebAudio 합성, 외부 에셋 없음) */
(function (root) {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;
  const last = {};

  function ac() {
    if (muted) return null;
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
    kill:     { gap: 30,  fn: () => { tone(320, 90, 0.13, 'square', 0.12); tone(700, 1050, 0.09, 'triangle', 0.1); noise(0.07, 0.1); } },
    gem:      { gap: 20,  fn: () => { tone(1100, 1700, 0.08, 'sine', 0.18); tone(2200, 2200, 0.05, 'sine', 0.05); } },
    levelup:  { gap: 0,   fn: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.07, i * 0.07)) },
    hurt:     { gap: 80,  fn: () => { tone(160, 60, 0.2, 'sawtooth', 0.1); noise(0.12, 0.06); } },
    nova:     { gap: 100, fn: () => { tone(300, 80, 0.3, 'sine', 0.1); noise(0.15, 0.04); } },
    echoDown: { gap: 80,  fn: () => tone(600, 150, 0.25, 'sine', 0.06) },
    boss:     { gap: 0,   fn: () => { tone(110, 70, 0.6, 'sawtooth', 0.1); tone(165, 90, 0.6, 'square', 0.05, 0.1); } },
    heal:     { gap: 100, fn: () => { tone(660, 990, 0.12, 'sine', 0.06); tone(990, 1320, 0.12, 'sine', 0.05, 0.1); } },
    win:      { gap: 0,   fn: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.08, i * 0.1)) },
    lose:     { gap: 0,   fn: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.9, 0.3, 'sine', 0.08, i * 0.18)) },
    train:    { gap: 400, fn: () => { tone(220, 220, 0.25, 'sawtooth', 0.09); tone(277, 277, 0.25, 'sawtooth', 0.07); tone(220, 200, 0.25, 'sawtooth', 0.09, 0.3); tone(277, 250, 0.25, 'sawtooth', 0.07, 0.3); } },
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
    setMuted(m) { muted = !!m; },
    isMuted() { return muted; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
