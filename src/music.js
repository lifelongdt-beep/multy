/* Endless Me — 배경음악 (WebAudio 합성, 외부 에셋 없음)
 *
 * 월드마다 곡 설계(템포·음계·코드 진행·악기·드럼)가 다르고, 멜로디는 시드로 만들어 항상 같은 곡이 나온다.
 * 보스가 나오면 같은 월드의 조를 유지한 채 더 빠르고 어두운(화성 단음계) "보스 곡"으로 바뀐다.
 *
 * compose(worldId, boss) 는 순수 함수(테스트 가능): { bpm, bars, steps, events:[{step, kind, midi?, len?, vol?, wave?}] }
 * Music(재생기)는 브라우저에서만 동작하며 Sfx의 AudioContext를 함께 쓴다.
 */
(function (root) {
  'use strict';

  const SCALES = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    harmonic:   [0, 2, 3, 5, 7, 8, 11],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
  };

  // 드럼 패턴: 16칸(16분음표), x=강하게, o=약하게
  const D = {
    pop:     { k: 'x.......x.o.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    soft:    { k: 'x.........x.....', s: '....o.......o...', h: '..o...o...o...o.' },
    swing:   { k: 'x.....x...x.....', s: '....x.......x..o', h: 'x..ox..ox..ox..o' },
    train:   { k: 'x...x...x...x...', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' },
    lofi:    { k: 'x......x..x.....', s: '....x.......x...', h: '..o...o...o...oo' },
    dance:   { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    box:     { k: 'x...............', s: '................', h: '....o.......o...' },
    tropic:  { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.oxx.oxx.oxx.ox' },
    air:     { k: 'x.......x.......', s: '....o.......o...', h: 'o.o.o.o.o.o.o.o.' },
    gentle:  { k: 'x.......x.......', s: '........o.......', h: '..o...o...o...o.' },
    folk:    { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
    rock:    { k: 'x.x...x.x.x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    boss:    { k: 'x...x...x...x.x.', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' },
    spiral:  { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },   // 소용돌이: 셋잇단 느낌
    march:   { k: 'x.x.x.x.x.x.x.x.', s: '....x..x....x.xx', h: 'x.x.x.x.x.x.x.x.' },   // 돌진: 행진 북
    express: { k: 'x..xx..xx..xx..x', s: '....x.......x...', h: 'xoxxxoxxxoxxxoxx' },   // 열차: 바퀴 리듬
  };

  /* 월드별 곡 설계 (root: MIDI 음 번호, prog: 음계 도수 0~6, 한 마디에 한 코드) */
  const SONGS = {
    school:   { name: '종소리 행진곡', bpm: 112, root: 60, scale: 'major',      prog: [0, 4, 5, 3], lead: { wave: 'square',   oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x...x...x.x.' }, pad: { wave: 'triangle', vol: 0.05 }, drums: 'pop',    seed: 11 },
    academy:  { name: '연필 사각사각',  bpm: 100, root: 57, scale: 'dorian',     prog: [0, 3, 6, 4], lead: { wave: 'triangle', oct: 1, style: 'arp' },    bass: { wave: 'sine',     pat: 'x.....x.x.......' }, pad: { wave: 'sine',     vol: 0.05 }, drums: 'soft',   seed: 23 },
    office:   { name: '야근 재즈',      bpm: 96,  root: 53, scale: 'major',      prog: [1, 4, 0, 5], lead: { wave: 'sine',     oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x...x...x...' }, pad: { wave: 'sawtooth', vol: 0.025 }, drums: 'swing', swing: 0.33, seven: true, seed: 37 },
    subway:   { name: '덜컹덜컹 퇴근길', bpm: 120, root: 52, scale: 'minor',      prog: [0, 5, 2, 6], lead: { wave: 'square',   oct: 1, style: 'arp' },    bass: { wave: 'sawtooth', pat: 'x.xxx.xxx.xxx.xx' }, pad: { wave: 'triangle', vol: 0.04 }, drums: 'train',  seed: 41 },
    home:     { name: '한밤의 로파이',  bpm: 80,  root: 61, scale: 'major',      prog: [3, 2, 1, 4], lead: { wave: 'sine',     oct: 1, style: 'bell' },   bass: { wave: 'sine',     pat: 'x.......x..x....' }, pad: { wave: 'triangle', vol: 0.06 }, drums: 'lofi',   seven: true, seed: 53 },
    gym:      { name: '한 세트 더!',    bpm: 128, root: 55, scale: 'mixolydian', prog: [0, 6, 3, 0], lead: { wave: 'sawtooth', oct: 1, style: 'melody' }, bass: { wave: 'square',   pat: 'x.x.x.x.x.x.x.x.' }, pad: { wave: 'square',   vol: 0.02 }, drums: 'dance',  seed: 67 },
    library:  { name: '조용한 오르골',  bpm: 88,  root: 62, scale: 'major',      prog: [0, 5, 3, 4], lead: { wave: 'sine',     oct: 2, style: 'bell' },   bass: { wave: 'sine',     pat: 'x.......x.......' }, pad: { wave: 'sine',     vol: 0.04 }, drums: 'box',    seed: 71 },
    beach:    { name: '파도 칼립소',    bpm: 104, root: 58, scale: 'major',      prog: [0, 3, 4, 0], lead: { wave: 'triangle', oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x..x..x.x..x..x.' }, pad: { wave: 'sine',     vol: 0.04 }, drums: 'tropic', seed: 83 },
    airport:  { name: '구름 위 산책',   bpm: 110, root: 63, scale: 'lydian',     prog: [0, 1, 4, 0], lead: { wave: 'sine',     oct: 1, style: 'arp' },    bass: { wave: 'sine',     pat: 'x.......x...x...' }, pad: { wave: 'triangle', vol: 0.06 }, drums: 'air',    seed: 97 },
    hospital: { name: '따뜻한 회복',    bpm: 92,  root: 57, scale: 'major',      prog: [0, 2, 3, 4], lead: { wave: 'triangle', oct: 1, style: 'bell' },   bass: { wave: 'sine',     pat: 'x.......x.......' }, pad: { wave: 'sine',     vol: 0.06 }, drums: 'gentle', seed: 101 },
    mountain: { name: '정상을 향해',    bpm: 108, root: 50, scale: 'dorian',     prog: [0, 6, 3, 0], lead: { wave: 'square',   oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x.x.x...x.x.' }, pad: { wave: 'triangle', vol: 0.05 }, drums: 'folk',   seed: 113 },
    stage:    { name: '꿈의 무대',      bpm: 124, root: 64, scale: 'major',      prog: [0, 4, 5, 3], lead: { wave: 'sawtooth', oct: 1, style: 'melody' }, bass: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.x.' }, pad: { wave: 'sawtooth', vol: 0.025 }, drums: 'rock',   seed: 127 },
  };

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** 음계 도수 → MIDI (도수는 7을 넘으면 다음 옥타브) */
  function noteOf(song, deg, oct) {
    const sc = SCALES[song.scale];
    const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return song.root + sc[d] + 12 * (o + oct);
  }

  /** 보스 곡: 같은 조(root)에서 더 빠르고(템포 x1.22) 어두운 화성 단음계, 쉬지 않는 베이스와 16분 하이햇 */
  function bossSong(id) {
    const s = SONGS[id] || SONGS.school;
    return {
      name: s.name + ' (큰 도전)', bpm: Math.min(160, Math.round(s.bpm * 1.22)), root: s.root - (s.root >= 60 ? 12 : 0), scale: 'harmonic',
      prog: [0, 0, 5, 4], lead: { wave: s.lead.wave === 'sine' ? 'square' : s.lead.wave, oct: 2, style: 'alarm' },
      bass: { wave: 'sawtooth', pat: 'xxxxxxxxxxxxxxxx' }, pad: { wave: 'sawtooth', vol: 0.03 }, drums: 'boss', seed: s.seed * 7 + 1, boss: true,
    };
  }

  /* 왕(보스)마다 다른 곡: 공격 방식(pattern)이 장르를, 이름이 세부(조·템포·코드·멜로디·악기)를 정한다 */
  const BOSS_STYLE = {
    exam:   { scale: 'harmonic', drums: 'boss',    lead: 'alarm', bass: 'xxxxxxxxxxxxxxxx', bpm: 1.25, progs: [[0, 0, 5, 4], [0, 3, 4, 4], [0, 5, 3, 4], [0, 1, 0, 4]], tag: '긴장' },
    spiral: { scale: 'phrygian', drums: 'spiral',  lead: 'swirl', bass: 'x..x..x.x..x..x.', bpm: 1.12, progs: [[0, 1, 0, 6], [0, 1, 3, 1], [0, 6, 5, 1], [0, 3, 1, 0]], tag: '소용돌이' },
    charge: { scale: 'minor',    drums: 'march',   lead: 'riff',  bass: 'x.x.x.x.xxx.x.x.', bpm: 1.3,  progs: [[0, 5, 6, 4], [0, 6, 5, 6], [0, 3, 6, 4], [0, 0, 6, 5]], tag: '돌진' },
    lane:   { scale: 'dorian',   drums: 'express', lead: 'arp',   bass: 'x.xxx.xxx.xxx.xx', bpm: 1.28, progs: [[0, 6, 5, 6], [0, 3, 6, 4], [0, 6, 3, 4]], tag: '질주' },
  };
  const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
  /** bossDef: {name, pattern} — 없으면 그 월드의 기본 보스 곡 (예전과 같음) */
  function bossThemeSong(id, bossDef) {
    const s = SONGS[id] || SONGS.school, st = BOSS_STYLE[bossDef.pattern] || BOSS_STYLE.exam, h = hashStr(bossDef.name), r = rng(h);
    const root0 = Math.max(48, Math.min(57, s.root - (s.root >= 60 ? 12 : 0) + [-3, -2, 0, 2, 3, 5][Math.floor(r() * 6)]));   // 베이스가 너무 낮거나 리드가 너무 높지 않게
    const waves = ['square', 'sawtooth', 'triangle'];
    return {
      name: `${bossDef.name}의 테마 (${st.tag})`, bpm: Math.max(110, Math.min(166, Math.round(s.bpm * st.bpm + (r() - 0.5) * 14))),
      root: root0, scale: st.scale, prog: st.progs[Math.floor(r() * st.progs.length)],
      lead: { wave: waves[Math.floor(r() * waves.length)], oct: st.lead === 'riff' ? 1 : 2, style: st.lead },
      bass: { wave: r() < 0.5 ? 'sawtooth' : 'square', pat: st.bass }, pad: { wave: 'sawtooth', vol: 0.03 }, drums: st.drums,
      seed: h % 100000 + 7, boss: true, riff: Math.floor(r() * 4), rot: Math.floor(r() * 7),   // rot: 멜로디 시작 위치 (보스마다 다른 선율)
    };
  }

  /** 곡 한 바퀴(8마디)의 이벤트 목록. boss: true(월드 기본 보스 곡) 또는 보스 정의 {name, pattern} */
  function compose(worldId, boss) {
    const song = boss ? (typeof boss === 'object' && boss.name ? bossThemeSong(worldId, boss) : bossSong(worldId)) : (SONGS[worldId] || SONGS.school);
    const r = rng(song.seed);
    const bars = 8, steps = bars * 16;
    const ev = [];
    const dr = D[song.drums];
    // 리듬 틀(8분음표 8칸, 1=소리): 마디마다 골라 쓰고, 5~6마디는 1~2마디를 되풀이해 귀에 남게
    const RHYTHMS = ['11011010', '10101110', '11101010', '10110110', '11011011', '10101010'];
    const phrase = [];
    let deg = 4;
    for (let bar = 0; bar < bars; bar++) {
      const chord = song.prog[bar % song.prog.length];
      const tones = [chord, chord + 2, chord + 4].concat(song.seven ? [chord + 6] : []);
      // 드럼
      for (let i = 0; i < 16; i++) {
        const st = bar * 16 + i;
        for (const k of ['k', 's', 'h']) {
          const c = dr[k][i];
          if (c === 'x' || c === 'o') ev.push({ step: st, kind: { k: 'kick', s: 'snare', h: 'hat' }[k], vol: c === 'x' ? 1 : 0.55 });
        }
        if (song.boss && bar % 4 === 3 && i >= 12) ev.push({ step: st, kind: 'snare', vol: 0.7 });   // 보스 곡: 4마디마다 스네어 몰아치기
      }
      // 베이스: 코드 근음(가끔 5도)
      for (let i = 0; i < 16; i++) {
        if (song.bass.pat[i] !== 'x') continue;
        const fifth = !song.boss && i % 8 === 6 && r() < 0.5;
        ev.push({ step: bar * 16 + i, kind: 'bass', midi: noteOf(song, fifth ? chord + 4 : chord, -2), len: song.boss ? 1 : 2, wave: song.bass.wave, vol: song.boss ? 0.16 : 0.2 });
      }
      // 패드: 마디 내내 코드
      for (const t of tones.slice(0, 3)) ev.push({ step: bar * 16, kind: 'pad', midi: noteOf(song, t, 0), len: 16, wave: song.pad.wave, vol: song.pad.vol });
      // 리드
      const st = song.lead.style;
      if (st === 'swirl') {   // 소용돌이: 두 옥타브를 오르내리는 16분 아르페지오
        const order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1];
        for (let i = 0; i < 16; i++) { const k = order[(i + (song.rot || 0)) % 16], t = tones[k % 3] + 7 * Math.floor(k / 3); ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, t, song.lead.oct - 1), len: 1, wave: song.lead.wave, vol: 0.045 }); }
      } else if (st === 'riff') {   // 돌진: 근음·5도·옥타브로 만든 힘찬 리프 (보스마다 리듬 다름)
        const RIFFS = ['x.x.xx.x.x.xx.x.', 'xx.x.xx.xx.x.x.x', 'x..xx..xx.x.x.xx', 'x.xx.x.xx.xx.x.x'], rf = RIFFS[song.riff || 0];
        const pick = [0, 4, 7, 4, 0, 7, 4, 2];
        let n = song.rot || 0;
        for (let i = 0; i < 16; i++) if (rf[i] === 'x') ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, chord + pick[n++ % pick.length], song.lead.oct), len: 1, wave: song.lead.wave, vol: 0.055 });
      } else if (st === 'arp' || st === 'alarm') {
        const order = st === 'alarm' ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 1, 2, 3 % tones.length, 2, 1, 0, 1];
        const every = st === 'alarm' ? 1 : 2;   // 보스는 16분, 일반은 8분
        for (let i = 0; i < 16; i += every) {
          const t = tones[order[(i / every + (song.rot || 0)) % order.length] % tones.length] + (st === 'alarm' && bar % 2 ? 1 : 0);
          ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, t, song.lead.oct), len: every, wave: song.lead.wave, vol: st === 'alarm' ? 0.05 : 0.07 });
        }
      } else {
        const src = bar >= 4 && bar < 6 ? phrase[bar - 4] : null;   // 5~6마디는 앞 구절 반복
        const notes = [];
        if (src) notes.push(...src);
        else {
          const rh = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
          for (let j = 0; j < 8; j++) {
            if (rh[j] !== '1' || (st === 'bell' && j % 2)) continue;
            // 강박에는 코드 음, 약박에는 한 칸씩 움직이기
            if (j % 4 === 0) { let best = tones[0], bd = 99; for (const t of tones) { for (const o of [0, 7]) { const dd = Math.abs(t + o - deg); if (dd < bd) { bd = dd; best = t + o; } } } deg = best; }
            else deg += r() < 0.5 ? 1 : -1;
            deg = Math.max(0, Math.min(11, deg));
            notes.push({ j, deg });
          }
          if (bar === bars - 1 && notes.length) notes[notes.length - 1].deg = song.prog[0] + 7;   // 마지막은 으뜸음으로 마무리
        }
        phrase[bar] = notes;
        for (const n of notes) {
          const len = st === 'bell' ? 4 : 2;
          ev.push({ step: bar * 16 + n.j * 2, kind: st === 'bell' ? 'bell' : 'lead', midi: noteOf(song, n.deg, song.lead.oct), len, wave: song.lead.wave, vol: st === 'bell' ? 0.09 : 0.07 });
        }
      }
    }
    return { name: song.name, bpm: song.bpm, swing: song.swing || 0, bars, steps, events: ev };
  }

  /* ================= 재생기 (브라우저) ================= */
  const LOOKAHEAD = 0.15;     // 이만큼 앞까지 미리 예약 (초)
  let cur = null;             // { world, boss, comp, byStep }
  let pending = null;         // 다음 박에 바꿀 곡
  let step = 0, nextT = 0, timer = null, playing = false, paused = false;
  let bus = null, noiseBuf = null;
  const VOLUME = 0.55;

  function ctx() { return root.Sfx && root.Sfx.context ? root.Sfx.context() : null; }
  function out(c) {
    if (!bus) {
      bus = c.createGain(); bus.gain.value = root.Sfx.isMuted() ? 0 : VOLUME;
      bus.connect(root.Sfx.output());
      const n = c.sampleRate; noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return bus;
  }
  function prep(worldId, boss) {
    const comp = compose(worldId, boss);
    const byStep = Array.from({ length: comp.steps }, () => []);
    for (const e of comp.events) byStep[e.step].push(e);
    return { world: worldId, boss: !!boss, bossName: boss && boss.name ? boss.name : null, comp, byStep };
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function voice(c, o, e, t, dur) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = e.wave || 'sine'; osc.frequency.setValueAtTime(hz(e.midi), t);
    let node = osc;
    if (e.kind === 'pad' || e.kind === 'bass') {   // 패드·베이스는 부드럽게
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = e.kind === 'bass' ? 700 : 1400;
      osc.connect(f); node = f;
    }
    const v = e.vol, att = e.kind === 'pad' ? 0.25 : 0.01;
    const rel = e.kind === 'bell' ? dur * 1.6 : e.kind === 'pad' ? dur : dur * 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.02, rel));
    node.connect(g); g.connect(o);
    osc.start(t); osc.stop(t + rel + 0.05);
  }
  function drum(c, o, e, t) {
    if (e.kind === 'kick') {
      const osc = c.createOscillator(), g = c.createGain();
      osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.5 * e.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + 0.2);
      return;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    const snare = e.kind === 'snare', len = snare ? 0.12 : 0.035;
    f.type = 'highpass'; f.frequency.value = snare ? 1500 : 7000;
    g.gain.setValueAtTime((snare ? 0.22 : 0.07) * e.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(o);
    s.start(t, Math.random() * 0.5, len + 0.02);
  }

  function tick() {
    const c = ctx(); if (!c || !cur || !playing || paused) return;
    const o = out(c);
    while (nextT < c.currentTime + LOOKAHEAD) {
      // 곡 바꾸기는 박(4칸) 경계에서 → 박자가 끊기지 않게
      if (pending && step % 4 === 0) { cur = pending; pending = null; step = 0; }
      const sdNow = 60 / cur.comp.bpm / 4;
      const t = nextT + (step % 2 ? cur.comp.swing * sdNow : 0);
      for (const e of cur.byStep[step % cur.comp.steps]) {
        if (e.kind === 'kick' || e.kind === 'snare' || e.kind === 'hat') drum(c, o, e, t);
        else voice(c, o, e, t, e.len * sdNow);
      }
      step = (step + 1) % cur.comp.steps;
      nextT += sdNow;
    }
  }

  root.Music = {
    compose, SONGS, bossSong, bossThemeSong,
    /** 월드 곡 재생 시작 (같은 곡이면 그대로) */
    play(worldId) {
      const c = ctx(); if (!c) return;
      if (playing && cur && cur.world === worldId && !cur.boss && !pending) { this.resume(); return; }
      cur = prep(worldId, false); pending = null; step = 0; nextT = c.currentTime + 0.08;
      playing = true; paused = false;
      if (!timer) timer = setInterval(tick, 25);
      tick();
    },
    /** 보스 곡으로 전환/복귀 (다음 박에서 바뀜) */
    /** bossDef가 있으면 그 왕의 테마로 (왕이 바뀌면 곡도 바뀜). 왕 사이 쉬는 동안(bossDef 없음)은 지금 곡 유지 */
    setBoss(on, bossDef) {
      if (!playing || !cur) return;
      const target = pending || cur;
      if (!on) { if (target.boss) pending = prep(cur.world, false); return; }
      if (!bossDef) { if (!target.boss) pending = prep(cur.world, true); return; }
      if (target.boss && target.bossName === bossDef.name) return;
      pending = prep(cur.world, { name: bossDef.name, pattern: bossDef.pattern });
    },
    pause() { paused = true; },
    resume() { const c = ctx(); if (!c || !playing) return; if (paused) { paused = false; nextT = c.currentTime + 0.05; } },
    stop() { playing = false; paused = false; pending = null; cur = null; if (timer) { clearInterval(timer); timer = null; } },
    setMuted(m) { if (bus) bus.gain.value = m ? 0 : VOLUME; },
    get state() { return { playing, paused, world: cur && cur.world, boss: !!(cur && cur.boss), bossName: (pending || cur || {}).bossName || null, song: cur && cur.comp.name, pending: !!pending }; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { compose, SONGS, bossSong, bossThemeSong, SCALES };
})(typeof window !== 'undefined' ? window : globalThis);
