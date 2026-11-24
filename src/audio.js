/* Echo Rush — 효과음 (WebAudio 합성, 외부 에셋 없음) */
(function (root) {
  'use strict';
  let ctx = null;
  let master = null;
  // 배경음악과 효과음을 따로 켜고 끈다 (기기에 저장)
  let sfxOff = false, musicOff = false;
  try { const v = JSON.parse(localStorage.getItem('echo-sound') || '{}'); sfxOff = !!v.sfxOff; musicOff = !!v.musicOff; } catch (e) { /* 무시 */ }
  const saveSound = () => { try { localStorage.setItem('echo-sound', JSON.stringify({ sfxOff, musicOff })); } catch (e) { /* 무시 */ } };
  const last = {};

  function ac() {
    if (sfxOff) return null;
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

  /** 열차(카트·파도 등)가 왼쪽↔오른쪽으로 지나가는 소리: 바람 소리(필터 걸린 잡음)가 다가왔다 멀어지며 좌우로 이동 + 덜컹덜컹 + 낮은 굉음.
   *  dir: 1 = 왼→오, -1 = 오→왼. heavy: 열차처럼 무거운 것(덜컹 소리) */
  function passSound(dir, heavy) {
    const c = ac(); if (!c) return;
    const t = c.currentTime, dur = 1.0;   // 화면을 가로지르는 시간(약 1초)에 맞춤
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.setValueAtTime(-0.9 * dir, t); pan.pan.linearRampToValueAtTime(0.9 * dir, t + dur); pan.connect(master); }
    const out = pan || master;
    // 바람: 잡음 → 대역 필터(가까워질수록 높아졌다 낮아짐 = 도플러 느낌)
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.4); bp.frequency.exponentialRampToValueAtTime(260, t + dur);
    const pk = heavy ? 0.22 : 0.18, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk * 0.6, t + 0.04); g.gain.linearRampToValueAtTime(pk, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);   // 바로 들리게 (늦게 커지지 않게)
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
    if (!heavy) {   // 가벼운 것(돌풍·지친 마음·병균 등): 굴러가는 바퀴 소리를 지나가는 동안 바로 들려줌
      for (let k = 0; k < 7; k++) { const tk = t + 0.02 + k * 0.12, near = 1 - Math.abs(k - 3) / 4; const ko = c.createOscillator(), kg = c.createGain(); ko.type = 'triangle'; ko.frequency.setValueAtTime(520, tk); ko.frequency.exponentialRampToValueAtTime(300, tk + 0.04); kg.gain.setValueAtTime(0.035 * (0.4 + near), tk); kg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.05); ko.connect(kg); kg.connect(out); ko.start(tk); ko.stop(tk + 0.07); }
      return;
    }
    // 낮은 굉음
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(58, t); o.frequency.linearRampToValueAtTime(70, t + dur * 0.45); o.frequency.linearRampToValueAtTime(48, t + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.45); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(og); og.connect(out); o.start(t); o.stop(t + dur + 0.02);
    // 덜컹덜컹 (바퀴가 이음매를 지나는 소리)
    for (let k = 0; k < 6; k++) {
      const tk = t + 0.12 + k * 0.17 + (k % 2) * 0.05, near = 1 - Math.abs(k - 2.5) / 3;
      const ko = c.createOscillator(), kg = c.createGain(); ko.type = 'square';
      ko.frequency.setValueAtTime(140, tk); ko.frequency.exponentialRampToValueAtTime(70, tk + 0.05);
      kg.gain.setValueAtTime(0.05 * (0.4 + near), tk); kg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.06);
      ko.connect(kg); kg.connect(out); ko.start(tk); ko.stop(tk + 0.08);
    }
  }

  /** 필터 잡음 (바람·물·덜컹 소리용): f0→f1로 필터를 움직이고, 천천히 커졌다 작아짐 */
  function fnoise(dur, vol, type, f0, f1, delay, attack) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const a = attack === undefined ? dur * 0.4 : attack;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.01, a)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  /** 옆으로 지나가는 위험물마다 다른 경고음 (열차는 빵빵, 나머지는 그 물건다운 소리) */
  const WARN = {
    '🚆': () => { tone(220, 220, 0.25, 'sawtooth', 0.09); tone(277, 277, 0.25, 'sawtooth', 0.07); tone(220, 200, 0.25, 'sawtooth', 0.09, 0.3); tone(277, 250, 0.25, 'sawtooth', 0.07, 0.3); },   // 빵빵
    '🌊': () => { fnoise(1.1, 0.16, 'lowpass', 260, 1800, 0, 0.75); tone(70, 55, 1.0, 'sine', 0.06); fnoise(0.5, 0.05, 'bandpass', 2400, 900, 0.75, 0.05); },                                   // 쏴아아 (밀려오는 파도)
    '🌪': () => { fnoise(0.9, 0.14, 'bandpass', 500, 2200, 0, 0.3); fnoise(0.6, 0.05, 'highpass', 2500, 5000, 0.2, 0.1); tone(330, 520, 0.5, 'sawtooth', 0.025); },              // 휘이잉 (조급함 돌풍)
    '😩': () => { [0, 0.26, 0.46, 0.6].forEach((d, i) => tone(200 - i * 18, 80, 0.12, 'sine', 0.13 - i * 0.02, d)); tone(300, 180, 0.5, 'triangle', 0.03, 0.1); },                 // 쿵·쿵·쿵 + 한숨 (굴러오는 지친 마음)
    '🛒': () => { tone(1250, 1250, 0.07, 'square', 0.04); tone(1250, 1250, 0.07, 'square', 0.04, 0.11); fnoise(0.45, 0.05, 'bandpass', 900, 600, 0.05, 0.03); },                              // 삐빅 + 덜컹
    '🦠': () => { for (let i = 0; i < 5; i++) tone(500 + (i % 2) * 140, 260, 0.08, 'square', 0.03, i * 0.09); fnoise(0.5, 0.04, 'bandpass', 1500, 700, 0, 0.1); },                    // 꾸물꾸물 (병균 떼)
    '⚡': () => { tone(900, 300, 0.12, 'sawtooth', 0.05); fnoise(0.7, 0.12, 'lowpass', 900, 200, 0.05, 0.4); tone(60, 45, 0.7, 'sine', 0.07, 0.05); },
    '❄': () => { fnoise(1.4, 0.18, 'lowpass', 180, 900, 0, 0.9); tone(55, 40, 1.3, 'sine', 0.09); tone(82, 60, 1.0, 'triangle', 0.04, 0.2); fnoise(0.8, 0.05, 'highpass', 3000, 1800, 0.3, 0.3); },   // 눈사태: 우르르 낮은 울림
    '😨': () => { tone(110, 110, 0.5, 'sawtooth', 0.035); tone(116, 120, 0.5, 'square', 0.02); tone(520, 500, 0.4, 'sine', 0.03, 0.1); tone(554, 530, 0.4, 'sine', 0.025, 0.1); },   // 웅- 불안한 떨림 (긴장 덩어리)
  };

  const DEF = {
    shoot:    { gap: 110, fn: () => tone(700, 420, 0.05, 'square', 0.025) },
    hit:      { gap: 60,  fn: () => tone(220, 130, 0.04, 'sawtooth', 0.02) },
    kill:     { gap: 45,  fn: killSound },
    gem:      { gap: 55,  fn: gemSound },
    deed:     { gap: 80,  fn: () => { tone(1046, 1046, 0.12, 'sine', 0.06); tone(1318, 1318, 0.16, 'sine', 0.05, 0.07); tone(1568, 1568, 0.32, 'triangle', 0.045, 0.14); } },   // 선행: 따뜻한 '띠링~' (구슬 소리와 다르게)
    deedSlot: { gap: 60,  fn: () => { tone(880, 1175, 0.08, 'sine', 0.04); } },   // 하트가 마음 칸에 쏙
    deedFull: { gap: 300, fn: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.05, i * 0.07)); tone(2093, 2093, 0.5, 'sine', 0.03, 0.38); } },   // 마음 4개 가득: 반짝 올라가는 소리   // 한꺼번에 빨아들여도 소리가 겹쳐 시끄럽지 않게
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
    // 귀여운 "말랑": 말랑한 젤리 버튼을 꾹 누른 소리 (낮게 쿵 + 살짝 맑은 음)
    click:    { gap: 40,  fn: () => { tone(260, 150, 0.09, 'sine', 0.14); soft(880, 0.07, 'sine', 0.025, 0.01); } },
    dropWarn: { gap: 300, fn: () => { tone(880, 660, 0.12, 'sine', 0.04); tone(880, 660, 0.12, 'sine', 0.04, 0.16); } },
    dropHit:  { gap: 90,  fn: () => { tone(160, 50, 0.22, 'sine', 0.16); noise(0.12, 0.05); } },
  };

  root.Sfx = {
    play(name) {
      const d = DEF[name];
      if (!d || sfxOff) return;
      const now = (root.performance || Date).now();
      if (last[name] && now - last[name] < d.gap) return;
      last[name] = now;
      d.fn();
    },
    /** 지나가는 소리 (열차는 무겁게, 공·파도·카트 등은 바람 소리만) */
    warn(emoji) { if (sfxOff) return; const now = (root.performance || Date).now(); if (last.warn && now - last.warn < 400) return; last.warn = now; (WARN[emoji] || WARN['🚆'])(); },
    pass(dir, heavy, water) { if (sfxOff) return; const now = (root.performance || Date).now(); if (last.pass && now - last.pass < 250) return; last.pass = now; if (water) { fnoise(1.3, 0.2, 'lowpass', 1400, 300, 0, 0.35); fnoise(0.9, 0.06, 'highpass', 4000, 2500, 0.1, 0.2); return; } passSound(dir >= 0 ? 1 : -1, !!heavy); },
    unlock() { ac(); },
    /** 전체 켜기/끄기 (위쪽 소리 버튼) */
    setMuted(m) { sfxOff = musicOff = !!m; saveSound(); if (root.Music) root.Music.setMuted(musicOff); },
    setSfx(on) { sfxOff = !on; saveSound(); },
    setMusic(on) { musicOff = !on; saveSound(); if (root.Music) root.Music.setMuted(musicOff); },
    sfxOn() { return !sfxOff; },
    musicOn() { return !musicOff; },
    isMusicMuted() { return musicOff; },
    /** 배경음악(music.js)용: 같은 AudioContext와 출력 */
    context() { return ctxAlways(); },
    output() { ctxAlways(); return master; },
    isMuted() { return sfxOff && musicOff; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
