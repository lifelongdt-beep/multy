/* Echo Rush — 배경음악 (WebAudio 합성, 외부 에셋 없음)
 *
 * 월드마다 곡 설계(템포·음계·코드 진행·악기·드럼)가 다르고, 멜로디는 시드로 만들어 항상 같은 곡이 나온다.
 * 월드 곡은 그 장소에 어울리는 악기(마림바·기타·플루트·스틸 드럼…)와 장소의 소리로 16마디(A→B) 동안 이어진다.
 * 왕이 나오면 왕의 특징(이름)에 맞춘 악기·효과음의 왕 곡으로 바뀐다.
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
    soft:    { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
    swing:   { k: 'x.....x...x.....', s: '....x.......x..o', h: 'x..ox..ox..ox..o' },
    train:   { k: 'x...x...x...x...', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' },
    lofi:    { k: 'x......x..x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.oo' },
    dance:   { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
    box:     { k: 'x.......x.......', s: '....o.......o...', h: '..o...o...o...o.' },
    tropic:  { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.oxx.oxx.oxx.ox' },
    air:     { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
    gentle:  { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
    folk:    { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
    rock:    { k: 'x.x...x.x.x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    boss:    { k: 'x...x...x...x.x.', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' },
    spiral:  { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },   // 소용돌이: 셋잇단 느낌
    march:   { k: 'x.x.x.x.x.x.x.x.', s: '....x..x....x.xx', h: 'x.x.x.x.x.x.x.x.' },   // 돌진: 행진 북
    express: { k: 'x..xx..xx..xx..x', s: '....x.......x...', h: 'xoxxxoxxxoxxxoxx' },   // 열차: 바퀴 리듬
  };

  /* 월드별 곡 설계 (root: MIDI 음 번호, prog: 음계 도수 0~6, 한 마디에 한 코드) */
  const SONGS = {
    school:   { name: '종소리 행진곡', bpm: 136, root: 60, scale: 'major',      prog: [0, 4, 5, 3], lead: { wave: 'square',   oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x...x...x.x.' }, pad: { wave: 'triangle', vol: 0.05 }, drums: 'pop',    seed: 11 },
    academy:  { name: '연필 사각사각',  bpm: 126, root: 57, scale: 'dorian',     prog: [0, 3, 6, 4], lead: { wave: 'triangle', oct: 1, style: 'arp' },    bass: { wave: 'sine',     pat: 'x..x..x.x..x..x.' }, pad: { wave: 'sine',     vol: 0.05 }, drums: 'soft',   seed: 23 },
    office:   { name: '야근 재즈',      bpm: 124,  root: 53, scale: 'major',      prog: [1, 4, 0, 5], lead: { wave: 'sine',     oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x...x...x...' }, pad: { wave: 'sawtooth', vol: 0.025 }, drums: 'swing', swing: 0.33, seven: true, seed: 37 },
    subway:   { name: '덜컹덜컹 퇴근길', bpm: 142, root: 52, scale: 'minor',      prog: [0, 5, 2, 6], lead: { wave: 'square',   oct: 1, style: 'arp' },    bass: { wave: 'sawtooth', pat: 'x.xxx.xxx.xxx.xx' }, pad: { wave: 'triangle', vol: 0.04 }, drums: 'train',  seed: 41 },
    home:     { name: '한밤의 로파이',  bpm: 104,  root: 61, scale: 'major',      prog: [3, 2, 1, 4], lead: { wave: 'sine',     oct: 1, style: 'bell' },   bass: { wave: 'sine',     pat: 'x..x....x.xx..x.' }, pad: { wave: 'triangle', vol: 0.06 }, drums: 'lofi',   seven: true, seed: 53 },
    gym:      { name: '한 세트 더!',    bpm: 148, root: 55, scale: 'mixolydian', prog: [0, 6, 3, 0], lead: { wave: 'sawtooth', oct: 1, style: 'melody' }, bass: { wave: 'square',   pat: 'x.x.x.x.x.x.x.x.' }, pad: { wave: 'square',   vol: 0.02 }, drums: 'dance',  seed: 67 },
    library:  { name: '조용한 오르골',  bpm: 116,  root: 62, scale: 'major',      prog: [0, 5, 3, 4], lead: { wave: 'sine',     oct: 1, style: 'bell' },   bass: { wave: 'sine',     pat: 'x...x...x...x.x.' }, pad: { wave: 'sine',     vol: 0.04 }, drums: 'box',    seed: 71 },
    beach:    { name: '파도 칼립소',    bpm: 128, root: 58, scale: 'major',      prog: [0, 3, 4, 0], lead: { wave: 'triangle', oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x..x..x.x..x..x.' }, pad: { wave: 'sine',     vol: 0.04 }, drums: 'tropic', seed: 83 },
    airport:  { name: '구름 위 산책',   bpm: 132, root: 63, scale: 'lydian',     prog: [0, 1, 4, 0], lead: { wave: 'sine',     oct: 1, style: 'arp' },    bass: { wave: 'sine',     pat: 'x...x.x.x...x.x.' }, pad: { wave: 'triangle', vol: 0.06 }, drums: 'air',    seed: 97 },
    hospital: { name: '따뜻한 회복',    bpm: 118,  root: 57, scale: 'major',      prog: [0, 2, 3, 4], lead: { wave: 'triangle', oct: 1, style: 'bell' },   bass: { wave: 'sine',     pat: 'x...x...x..xx...' }, pad: { wave: 'sine',     vol: 0.06 }, drums: 'gentle', seed: 101 },
    mountain: { name: '정상을 향해',    bpm: 134, root: 50, scale: 'dorian',     prog: [0, 6, 3, 0], lead: { wave: 'square',   oct: 1, style: 'melody' }, bass: { wave: 'triangle', pat: 'x...x.x.x...x.x.' }, pad: { wave: 'triangle', vol: 0.05 }, drums: 'folk',   seed: 113 },
    menu:     { name: '에코 러시 메인 테마', bpm: 140, root: 62, scale: 'major', prog: [0, 5, 3, 4], lead: { wave: 'square', oct: 1, style: 'melody' }, bass: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.x.' }, pad: { wave: 'sawtooth', vol: 0.03 }, drums: 'pop', seed: 7 },
    stage:    { name: '꿈의 무대',      bpm: 150, root: 64, scale: 'major',      prog: [0, 4, 5, 3], lead: { wave: 'sawtooth', oct: 1, style: 'melody' }, bass: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.x.' }, pad: { wave: 'sawtooth', vol: 0.025 }, drums: 'rock',   seed: 127 },
  };

  /* 월드마다 어울리는 악기 편성 (코드 음악 업그레이드)
   * lead/bass/pad: 악기 · counter: 두 번째 선율(B 구간) · perc: 손뼉·셰이커 · amb: 그 장소의 소리 · progB: B 구간 코드
   * 곡은 16마디: A(1~8) → B(9~16, 다른 코드 + 두 번째 선율) */
  const ARRANGE = {
    school:   { lead: 'marimba',    bass: 'pluckbass', pad: 'strings', counter: { inst: 'musicbox', style: 'arp8',    oct: 2 }, perc: { kind: 'clap',   pat: '....x.......x...' }, amb: 'chime',    progB: [5, 3, 0, 4] },
    academy:  { lead: 'pluck',      bass: 'upright',   pad: 'strings', counter: { inst: 'flute',    style: 'sustain', oct: 1 }, perc: { kind: 'shaker', pat: 'x.o.x.o.x.o.x.o.' }, amb: 'scribble', progB: [3, 6, 0, 4] },
    office:   { lead: 'epiano',     bass: 'upright',   pad: 'organ',   counter: { inst: 'vibes',    style: 'harm',    oct: 1 }, perc: null,                                    amb: 'typing',   progB: [3, 2, 1, 4] },
    subway:   { lead: 'synthlead',  bass: 'synthbass', pad: 'strings', counter: { inst: 'pluck',    style: 'strum',   oct: 0 }, perc: null,                                    amb: 'rail',     progB: [5, 6, 3, 6] },
    home:     { lead: 'epiano',     bass: 'sub',       pad: 'strings', counter: { inst: 'musicbox', style: 'sustain', oct: 1 }, perc: { kind: 'shaker', pat: '..o...o...o...o.' }, amb: 'vinyl',    progB: [5, 3, 1, 4] },
    gym:      { lead: 'synthlead',  bass: 'synthbass', pad: 'strings', counter: { inst: 'brass',    style: 'stab',    oct: 0 }, perc: { kind: 'clap',   pat: '....x.......x...' }, amb: null,       progB: [3, 0, 6, 4] },
    library:  { lead: 'musicbox',   bass: 'sub',       pad: 'strings', counter: { inst: 'harp',     style: 'arp8',    oct: 1 }, perc: null,                                    amb: 'page',     progB: [3, 0, 1, 4] },
    beach:    { lead: 'steel',      bass: 'pluckbass', pad: 'strings', counter: { inst: 'ukulele',  style: 'strum',   oct: 1 }, perc: { kind: 'shaker', pat: 'x.o.x.o.x.o.x.o.' }, amb: 'wave',     progB: [3, 0, 1, 4] },
    airport:  { lead: 'flute',      bass: 'sub',       pad: 'strings', counter: { inst: 'epiano',   style: 'arp8',    oct: 1 }, perc: { kind: 'shaker', pat: '..o...o...o...o.' }, amb: 'ding',     progB: [5, 1, 0, 4], style: 'melody' },
    hospital: { lead: 'harp',       bass: 'upright',   pad: 'strings', counter: { inst: 'flute',    style: 'sustain', oct: 1 }, perc: null,                                    amb: null,       progB: [5, 3, 0, 4] },
    mountain: { lead: 'flute',      bass: 'upright',   pad: 'strings', counter: { inst: 'pluck',    style: 'strum',   oct: 0 }, perc: null,                                    amb: 'bird',     progB: [3, 0, 6, 4] },
    menu:     { lead: 'synthlead',  bass: 'synthbass', pad: 'strings', counter: { inst: 'marimba',  style: 'arp8',    oct: 1 }, perc: { kind: 'clap',   pat: '....x.......x..x' }, amb: null,       progB: [3, 4, 2, 5] },
    stage:    { lead: 'brass',      bass: 'synthbass', pad: 'strings', counter: { inst: 'synthlead', style: 'arp8',   oct: 1 }, perc: { kind: 'clap',   pat: '....x.......x...' }, amb: 'crowd',    progB: [3, 4, 5, 4] },
  };
  for (const id in ARRANGE) {
    const a = ARRANGE[id], s = SONGS[id];
    s.lead.inst = a.lead; if (a.style) s.lead.style = a.style;
    s.bass.inst = a.bass; s.pad.inst = a.pad; s.pad.vol = Math.max(s.pad.vol, 0.035);
    s.counter = a.counter; s.perc = a.perc; s.amb = a.amb; s.progB = a.progB; s.bars = 16;
  }

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** 음계 도수 → MIDI (도수는 7을 넘으면 다음 옥타브) */
  function noteOf(song, deg, oct) {
    const sc = SCALES[song.scale];
    const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7;
    return song.root + sc[d] + 12 * (o + oct);
  }

  /** 보스 곡: 같은 조(root)에서 무겁고(템포 118~150) 어두운 화성 단음계, 쉬지 않는 베이스와 16분 하이햇 */
  function bossSong(id) {
    const s = SONGS[id] || SONGS.school;
    return {
      name: s.name + ' (큰 도전)', bpm: Math.min(150, Math.max(118, Math.round(s.bpm * 1.05))), root: s.root - (s.root >= 60 ? 12 : 0), scale: 'harmonic',
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
  /* 왕의 특징에 맞춘 소리 (이름에 든 말로 고름). inst: 악기 소리 · style: 선율 방식 · sfx: 효과음 · bpm: 빠르기 배율 */
  const CHAR_PROFILES = [
    { keys: ['시험', '진도', '완벽', '작심'], p: { tag: '째깍째깍 시계', lead: { inst: 'bell', style: 'alarm', oct: 2 }, bass: 'organ', sfx: ['tick', 'heart'] } },
    { keys: ['지연 폭탄'], p: { tag: '시한폭탄', lead: { inst: 'glitch', style: 'alarm', oct: 2 }, bass: 'growl', sfx: ['tick', 'sting'], bpm: 1.15 } },
    { keys: ['무대 공포'], p: { tag: '조명 아래 떨림', lead: { inst: 'wobble', style: 'lullaby', oct: 1 }, bass: 'organ', pad: 'choir', sfx: ['heart', 'gong'], bpm: 0.9 } },
    { keys: ['불안', '공포', '분실'], p: { tag: '두근두근 공포', lead: { inst: 'choir', style: 'lullaby', oct: 1 }, bass: 'growl', pad: 'choir', sfx: ['heart', 'sting'], bpm: 0.9 } },
    { keys: ['졸음', '불면'], p: { tag: '으스스한 자장가', lead: { inst: 'bell', style: 'lullaby', oct: 2 }, bass: 'organ', pad: 'choir', sfx: ['gong'], bpm: 0.72, scale: 'harmonic' } },
    { keys: ['슬럼프', '정체', '귀차', '피로'], p: { tag: '무겁게 짓누름', lead: { inst: 'organ', style: 'stomp', oct: 1 }, bass: 'growl', pad: 'choir', sfx: ['storm'], bpm: 0.75 } },
    { keys: ['번아웃', '땡볕'], p: { tag: '타오르는 열기', lead: { inst: 'brass', style: 'riff', oct: 1 }, bass: 'growl', sfx: ['sting', 'gong'], scale: 'harmonic', bpm: 1.05 } },
    { keys: ['급행', '열차', '환승', '무리'], p: { tag: '질주하는 열차', lead: { inst: 'brass', style: 'riff', oct: 1 }, bass: 'organ', sfx: ['tick'], bpm: 1.12 } },
    { keys: ['멀미', '해파리', '잡념', '어질', '집중', '고산', '시차'], p: { tag: '어질어질 소용돌이', lead: { inst: 'wobble', style: 'swirl', oct: 2 }, bass: 'growl', pad: 'choir', sfx: ['sting'], scale: 'phrygian', swing: 0.22 } },
    { keys: ['태풍', '파도', '난기류', '눈보라', '낙석'], p: { tag: '몰아치는 폭풍', lead: { inst: 'brass', style: 'stomp', oct: 1 }, bass: 'growl', pad: 'choir', sfx: ['storm', 'gong'], bpm: 1.05 } },
    { keys: ['근육통', '거인', '대장'], p: { tag: '쿵쿵 거인의 발걸음', lead: { inst: 'brass', style: 'stomp', oct: 1 }, bass: 'growl', pad: 'organ', sfx: ['gong', 'heart'], bpm: 0.8 } },
    { keys: ['야식', '무한', '불규칙'], p: { tag: '멈출 수 없는 유혹', lead: { inst: 'glitch', style: 'glitch', oct: 2 }, bass: 'organ', sfx: ['sting'], swing: 0.3 } },
    { keys: ['독감', '감기'], p: { tag: '콜록콜록 오한', lead: { inst: 'wobble', style: 'alarm', oct: 2 }, bass: 'growl', pad: 'choir', sfx: ['sting'], bpm: 0.95 } },
    { keys: ['비교'], p: { tag: '빠져드는 늪', lead: { inst: 'choir', style: 'lullaby', oct: 1 }, bass: 'growl', pad: 'choir', sfx: ['storm'], bpm: 0.8, scale: 'phrygian' } },
  ];
  const charProfile = (name) => { for (const c of CHAR_PROFILES) if (c.keys.some((k) => String(name).includes(k))) return c.p; return null; };
  const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
  /** bossDef: {name, pattern} — 없으면 그 월드의 기본 보스 곡 (예전과 같음) */
  function bossThemeSong(id, bossDef) {
    const s = SONGS[id] || SONGS.school, st = BOSS_STYLE[bossDef.pattern] || BOSS_STYLE.exam, h = hashStr(bossDef.name), r = rng(h);
    const root0 = Math.max(48, Math.min(57, s.root - (s.root >= 60 ? 12 : 0) + [-3, -2, 0, 2, 3, 5][Math.floor(r() * 6)]));   // 베이스가 너무 낮거나 리드가 너무 높지 않게
    const waves = ['square', 'sawtooth', 'triangle'];
    return {
      name: `${bossDef.name}의 테마 (${st.tag})`, bpm: Math.max(108, Math.min(150, Math.round(s.bpm * st.bpm * 0.9 + (r() - 0.5) * 14))),
      root: root0, scale: st.scale, prog: st.progs[Math.floor(r() * st.progs.length)],
      lead: { wave: waves[Math.floor(r() * waves.length)], oct: st.lead === 'riff' ? 1 : 2, style: st.lead },
      bass: { wave: r() < 0.5 ? 'sawtooth' : 'square', pat: st.bass }, pad: { wave: 'sawtooth', vol: 0.03 }, drums: st.drums,
      seed: h % 100000 + 7, boss: true, riff: Math.floor(r() * 4), rot: Math.floor(r() * 7),   // rot: 멜로디 시작 위치 (보스마다 다른 선율)
      ...charSong(bossDef.name, s, st, r),
    };
  }
  /** 왕의 특징(이름)에 맞춘 악기·선율·효과음·빠르기 */
  function charSong(name, s, st, r) {
    const p = charProfile(name); if (!p) return {};
    const out = { lead: { wave: 'sawtooth', oct: p.lead.oct, style: p.lead.style, inst: p.lead.inst }, sfx: p.sfx || [], tag: p.tag };
    out.bass = { wave: 'sawtooth', pat: p.lead.style === 'stomp' ? 'x.......x.......' : st.bass, inst: p.bass };
    out.pad = { wave: 'sawtooth', vol: 0.035, inst: p.pad || null };
    if (p.scale) out.scale = p.scale;
    if (p.swing) out.swing = p.swing;
    if (p.bpm) out.bpm = Math.max(78, Math.min(150, Math.round(s.bpm * st.bpm * p.bpm * 0.9 + (r() - 0.5) * 10)));
    out.name = `${name}의 테마 (${p.tag})`;
    return out;
  }

  /** 곡 한 바퀴(8마디)의 이벤트 목록. boss: true(월드 기본 보스 곡) 또는 보스 정의 {name, pattern} */
  function compose(worldId, boss) {
    const song = boss ? (typeof boss === 'object' && boss.name ? bossThemeSong(worldId, boss) : bossSong(worldId)) : (SONGS[worldId] || SONGS.school);
    const r = rng(song.seed);
    const bars = song.bars || 8, steps = bars * 16;
    const ev = [];
    const dr = D[song.drums];
    // 리듬 틀(8분음표 8칸, 1=소리): 마디마다 골라 쓰고, 5~6마디는 1~2마디를 되풀이해 귀에 남게
    const RHYTHMS = ['11011010', '10101110', '11101010', '10110110', '11011011', '10101010'];
    const phrase = [];
    let deg = 4;
    for (let bar = 0; bar < bars; bar++) {
      const prog = bar >= 8 && song.progB ? song.progB : song.prog, chord = prog[bar % prog.length];
      const partB = bar >= 8 && !!song.progB;
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
      if (song.perc) for (let i = 0; i < 16; i++) { const c = song.perc.pat[i]; if (c === 'x' || c === 'o') ev.push({ step: bar * 16 + i, kind: song.perc.kind, vol: c === 'x' ? 1 : 0.6 }); }
      // 두 번째 선율 (B 구간, 기타·우쿨렐레 반주는 처음부터)
      const ct = song.counter;
      if (ct && (partB || ct.style === 'strum')) {
        const cv = (m, step, len, vol) => ev.push({ step, kind: 'lead', midi: m, len, wave: 'triangle', vol, inst: ct.inst });
        if (ct.style === 'arp8') { const ord = [0, 1, 2, 1, 2, 1, 0, 1]; for (let i = 0; i < 8; i++) cv(noteOf(song, tones[ord[i]], ct.oct), bar * 16 + i * 2, 2, 0.04); }
        else if (ct.style === 'strum') { for (const i of [2, 6, 10, 14]) for (const t of tones.slice(0, 3)) cv(noteOf(song, t, ct.oct), bar * 16 + i, 1, partB ? 0.03 : 0.022); }
        else if (ct.style === 'stab') { for (const i of [0, 10]) for (const t of tones.slice(0, 3)) cv(noteOf(song, t, ct.oct), bar * 16 + i, 2, 0.03); }
        else if (ct.style === 'sustain') { const pick = [[2, 1], [0, 2], [1, 0], [2, 2]][bar % 4]; cv(noteOf(song, tones[pick[0]], ct.oct), bar * 16, 7, 0.045); cv(noteOf(song, tones[pick[1]], ct.oct), bar * 16 + 8, 7, 0.04); }
      }
      // 베이스: 코드 근음(가끔 5도)
      for (let i = 0; i < 16; i++) {
        if (song.bass.pat[i] !== 'x') continue;
        const fifth = !song.boss && i % 8 === 6 && r() < 0.5;
        ev.push({ step: bar * 16 + i, kind: 'bass', midi: noteOf(song, fifth ? chord + 4 : chord, -2), len: song.boss ? (song.bass.inst && song.lead.style === 'stomp' ? 6 : 1) : 2, wave: song.bass.wave, vol: song.boss ? 0.16 : 0.2, inst: song.bass.inst });
      }
      // 패드: 마디 내내 코드
      for (const t of tones.slice(0, 3)) ev.push({ step: bar * 16, kind: 'pad', midi: noteOf(song, t, 0), len: 16, wave: song.pad.wave, vol: song.pad.vol, inst: song.pad.inst });
      if (song.boss && song.pad.inst === 'choir' && bar % 2 === 1) ev.push({ step: bar * 16, kind: 'pad', midi: noteOf(song, tones[0], 0) + 1, len: 16, wave: 'sawtooth', vol: song.pad.vol * 0.8, inst: 'choir' });   // 반음 부딪힘: 소름
      // 리드
      const st = song.lead.style;
      if (st === 'lullaby') {   // 으스스한 자장가: 느리게, 가끔 반음 어긋남
        const pat = [0, 2, 1, 2, 0, 2, 1, 4];
        for (let i = 0; i < 8; i += 2) { const t = tones[pat[(i / 2 + bar + (song.rot || 0)) % pat.length] % tones.length]; const m = noteOf(song, t, song.lead.oct) + ((bar % 4 === 3 && i === 6) ? 1 : 0); ev.push({ step: bar * 16 + i * 2, kind: 'lead', midi: m, len: 4, wave: song.lead.wave, vol: 0.07, inst: song.lead.inst }); }
      } else if (st === 'stomp') {   // 쿵-쿵 무거운 발걸음: 2분음표 리프
        const pick = [0, 0, 4, 3]; const m = noteOf(song, chord + pick[(bar + (song.rot || 0)) % 4], song.lead.oct);
        ev.push({ step: bar * 16, kind: 'lead', midi: m, len: 6, wave: song.lead.wave, vol: 0.08, inst: song.lead.inst }); ev.push({ step: bar * 16 + 8, kind: 'lead', midi: m - 1 + (bar % 2), len: 6, wave: song.lead.wave, vol: 0.07, inst: song.lead.inst });
        if (bar % 2) ev.push({ step: bar * 16 + 14, kind: 'lead', midi: m + 3, len: 2, wave: song.lead.wave, vol: 0.06, inst: song.lead.inst });
      } else if (st === 'glitch') {   // 멈출 수 없는 반복: 같은 음을 툭툭 + 갑자기 튀는 음
        for (let i = 0; i < 16; i++) { if (r() < 0.45) continue; const t = tones[(i % 3 === 0 ? 0 : Math.floor(r() * tones.length))]; ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, t, song.lead.oct) + (r() < 0.12 ? 6 : 0), len: 1, wave: 'square', vol: 0.05, inst: song.lead.inst }); }
      } else if (st === 'swirl') {   // 소용돌이: 두 옥타브를 오르내리는 16분 아르페지오
        const order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1];
        for (let i = 0; i < 16; i++) { const k = order[(i + (song.rot || 0)) % 16], t = tones[k % 3] + 7 * Math.floor(k / 3); ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, t, song.lead.oct - 1), len: 1, wave: song.lead.wave, vol: 0.045, inst: song.lead.inst }); }
      } else if (st === 'riff') {   // 돌진: 근음·5도·옥타브로 만든 힘찬 리프 (보스마다 리듬 다름)
        const RIFFS = ['x.x.xx.x.x.xx.x.', 'xx.x.xx.xx.x.x.x', 'x..xx..xx.x.x.xx', 'x.xx.x.xx.xx.x.x'], rf = RIFFS[song.riff || 0];
        const pick = [0, 4, 7, 4, 0, 7, 4, 2];
        let n = song.rot || 0;
        for (let i = 0; i < 16; i++) if (rf[i] === 'x') ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, chord + pick[n++ % pick.length], song.lead.oct), len: 1, wave: song.lead.wave, vol: 0.055, inst: song.lead.inst });
      } else if (st === 'arp' || st === 'alarm') {
        const order = st === 'alarm' ? [0, 1, 2, 1, 0, 2, 1, 2] : partB ? [2, 1, 0, 1, 2, 3 % tones.length, 2, 0] : [0, 1, 2, 3 % tones.length, 2, 1, 0, 1];
        const every = st === 'alarm' ? 1 : 2;   // 보스는 16분, 일반은 8분
        for (let i = 0; i < 16; i += every) {
          const t = tones[order[(i / every + (song.rot || 0)) % order.length] % tones.length] + (st === 'alarm' && bar % 2 ? 1 : 0);
          ev.push({ step: bar * 16 + i, kind: 'lead', midi: noteOf(song, t, song.lead.oct), len: every, wave: song.lead.wave, vol: st === 'alarm' ? 0.05 : 0.07, inst: song.lead.inst });
        }
      } else {
        const src = bar % 8 >= 4 && bar % 8 < 6 ? phrase[bar - 4] : null;   // 구간마다 5~6마디는 앞 구절 반복
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
          else if (bars > 8 && bar === 7 && notes.length) notes[notes.length - 1].deg = song.prog[0] + 4;   // A 구간 끝은 5도에서 살짝 열어 두기
        }
        phrase[bar] = notes;
        notes.forEach((n, k) => {
          const gap = (k + 1 < notes.length ? notes[k + 1].j : 8) - n.j;
          const len = st === 'bell' ? 4 : song.lead.inst ? Math.min(4, gap * 2) : 2;   // 악기 곡은 다음 음까지 이어서
          ev.push({ step: bar * 16 + n.j * 2, kind: st === 'bell' ? 'bell' : 'lead', midi: noteOf(song, n.deg, song.lead.oct), len, wave: song.lead.wave, vol: st === 'bell' ? 0.09 : 0.07, inst: song.lead.inst });
          if (ct && ct.style === 'harm' && partB) ev.push({ step: bar * 16 + n.j * 2, kind: 'lead', midi: noteOf(song, n.deg - 2, ct.oct), len, wave: 'sine', vol: 0.04, inst: ct.inst });   // 3도 아래 화음
        });
      }
    }
    // 왕 곡 공통: 웅장하고 엄습하게 — 큰북(타이코) · 어두운 합창 · 낮은 금관 운명 동기 · 관현악 강타 · 차오르는 소리
    if (song.boss) for (let bar = 0; bar < bars; bar++) {
      const b0 = bar * 16, chord = song.prog[bar % song.prog.length], low = noteOf(song, chord, -1);
      const tk = bar % 4 === 3 ? 'x.x.x.xxx.x.xxxx' : 'x..x..x.x.......';
      for (let i = 0; i < 16; i++) if (tk[i] === 'x') ev.push({ step: b0 + i, kind: 'taiko', vol: i === 0 ? 1 : bar % 4 === 3 ? 0.55 + i / 40 : 0.75 });
      for (const t of [chord, chord + 2, chord + 4]) ev.push({ step: b0, kind: 'pad', midi: noteOf(song, t, 0), len: 16, wave: 'sawtooth', vol: 0.05, inst: 'choir' });
      if (bar % 2 === 1) ev.push({ step: b0, kind: 'pad', midi: noteOf(song, chord, 0) + 1, len: 16, wave: 'sawtooth', vol: 0.035, inst: 'choir' });   // 반음 부딪힘: 소름
      // 운명 동기: 근음-근음-반음 위-근음 … 마디 끝은 증4도(악마의 음정)
      const doom = [[0, 0], [3, 0], [6, 1], [8, 0], [11, 0], [14, bar % 2 ? 6 : 1]];
      for (const [i, o] of doom) ev.push({ step: b0 + i, kind: 'lead', midi: low + o, len: i === 8 ? 3 : 2, wave: 'sawtooth', vol: 0.06, inst: 'brass' });
      if (bar % 2 === 0) ev.push({ step: b0, kind: 'lead', midi: low, len: 6, wave: 'sawtooth', vol: 0.08, inst: 'hit' });   // 관현악 강타
      if (bar === bars - 1) ev.push({ step: b0, kind: 'riser', len: 16, vol: 1 });   // 다시 처음으로: 차오르는 긴장
    }
    // 왕의 효과음: 째깍(시계) · 심장 박동 · 폭풍 · 징 · 찌르는 소리
    for (const fx of song.sfx || []) for (let bar = 0; bar < bars; bar++) {
      const b0 = bar * 16;
      if (fx === 'tick') for (let i = 0; i < 16; i += 2) ev.push({ step: b0 + i, kind: 'tick', vol: i % 4 ? 0.6 : 1 });
      if (fx === 'heart') for (const i of [0, 2, 8, 10]) ev.push({ step: b0 + i, kind: 'heart', vol: i % 8 ? 0.7 : 1 });
      if (fx === 'storm' && bar % 4 === 0) ev.push({ step: b0, kind: 'storm', len: 48, vol: 1 });
      if (fx === 'gong' && bar % 4 === 0) ev.push({ step: b0, kind: 'gong', vol: 1 });
      if (fx === 'sting' && bar % 4 === 3) ev.push({ step: b0 + 12, kind: 'sting', vol: 1 });
    }
    // 그 장소의 소리 (작게): 학교 종 · 연필 · 타자 · 선로 · 레코드 잡음 · 책장 · 파도 · 안내 방송 · 새 · 함성
    const ra = rng(song.seed * 31 + 5), amb = song.amb;
    const chime = (b0, offs, gap) => offs.forEach((o, i) => ev.push({ step: b0 + i * gap, kind: 'amb', midi: song.root + 12 + o, len: gap * 1.5, wave: 'sine', vol: 0.05, inst: 'vibes' }));
    if (amb === 'chime') chime(0, [4, 0, 2, -5], 4);
    if (amb === 'ding') { chime(0, [7, 0], 4); chime(8 * 16, [7, 0], 4); }
    for (let bar = 0; bar < bars; bar++) {
      const b0 = bar * 16;
      if (amb === 'rail') for (const i of [0, 3, 8, 11]) ev.push({ step: b0 + i, kind: 'clack', vol: i % 8 ? 0.6 : 1 });
      if (amb === 'wave' && bar % 4 === 0) ev.push({ step: b0, kind: 'wave', len: 56, vol: 1 });
      if (amb === 'typing') for (let i = 0; i < 16; i++) if (ra() < (bar % 4 === 1 ? 0.45 : 0.12)) ev.push({ step: b0 + i, kind: 'tick', vol: 0.35 + ra() * 0.25 });
      if (amb === 'vinyl') for (let i = 0; i < 16; i++) if (ra() < 0.3) ev.push({ step: b0 + i, kind: 'tick', vol: 0.12 + ra() * 0.12 });
      if (amb === 'scribble' && bar % 4 === 2) ev.push({ step: b0 + 4, kind: 'scribble', vol: 1 });
      if (amb === 'page' && bar % 8 === 3) ev.push({ step: b0 + 8, kind: 'page', vol: 1 });
      if (amb === 'bird' && (bar % 4 === 1 || bar === 10)) ev.push({ step: b0 + 2 + Math.floor(ra() * 10), kind: 'bird', vol: 1 });
      if (amb === 'crowd' && bar % 8 === 0) ev.push({ step: b0, kind: 'crowd', len: 32, vol: 1 });
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
      bus = c.createGain(); bus.gain.value = VOLUME * (root.Sfx.musicLevel ? root.Sfx.musicLevel() : (root.Sfx.isMusicMuted() ? 0 : 1));
      bus.connect(root.Sfx.output());
      const n = c.sampleRate; noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return bus;
  }
  /** 왕 곡은 큰 홀에서 울리듯 (잔향): 소리 → (원음 + 잔향) → 음악 버스 */
  let hall = null;
  function hallOut(c) {
    if (!hall) {
      const o = out(c), n = Math.floor(c.sampleRate * 2.8), ir = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
      const inp = c.createGain(), conv = c.createConvolver(), wet = c.createGain(); conv.buffer = ir; wet.gain.value = 0.32; inp.gain.value = 0.62;   // 층이 두꺼운 만큼 전체는 조금 줄여 월드 곡의 1.5배쯤
      inp.connect(o); inp.connect(conv); conv.connect(wet); wet.connect(o); hall = inp;
    }
    return hall;
  }
  function prep(worldId, boss) {
    const comp = compose(worldId, boss);
    const byStep = Array.from({ length: comp.steps }, () => []);
    for (const e of comp.events) byStep[e.step].push(e);
    return { world: worldId, boss: !!boss, bossName: boss && boss.name ? boss.name : null, comp, byStep };
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** 왕 곡용 악기 소리: 종(bell)·오르간·금관·합창·흔들리는 소리(wobble)·으르렁(growl)·튀는 소리(glitch) */
  function instVoice(c, o, e, t, dur) {
    const f = hz(e.midi), v = e.vol, end = t + dur;
    const env = (g, att, rel, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.03, rel)); };
    const osc = (type, freq, det) => { const x = c.createOscillator(); x.type = type; x.frequency.setValueAtTime(freq, t); if (det) x.detune.setValueAtTime(det, t); return x; };
    const g = c.createGain(); g.connect(o);
    const go = (nodes, stopAt) => nodes.forEach((x) => { x.start(t); x.stop(stopAt + 0.05); });
    switch (e.inst) {
      case 'bell': {   // 맑지만 차가운 종: 기음 + 비화성 배음(2.76배)
        const a = osc('sine', f), b = osc('sine', f * 2.76), gb = c.createGain(); gb.gain.value = 0.35;
        a.connect(g); b.connect(gb); gb.connect(g); env(g, 0.005, dur * 2.2, v * 1.2); go([a, b], t + dur * 2.2); break;
      }
      case 'organ': {  // 낮고 무거운 오르간
        const a = osc('square', f), b = osc('sine', f * 2), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        a.connect(lp); b.connect(lp); lp.connect(g); env(g, 0.04, dur, v * 0.8); go([a, b], end); break;
      }
      case 'brass': {  // 거친 금관: 톱니파 + 열렸다 닫히는 필터
        const a = osc('sawtooth', f), a2 = osc('sawtooth', f, 9), lp = c.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2800, t + 0.06); lp.frequency.exponentialRampToValueAtTime(1100, t + Math.max(0.1, dur));
        a.connect(lp); a2.connect(lp); lp.connect(g); env(g, 0.02, dur, v); go([a, a2], end); break;
      }
      case 'choir': {  // 어두운 합창: 살짝 어긋난 톱니파 둘 + 느린 시작
        const a = osc('sawtooth', f, -10), b = osc('sawtooth', f, 10), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
        a.connect(lp); b.connect(lp); lp.connect(g); env(g, Math.min(0.35, dur * 0.4), dur, v * 0.7); go([a, b], end); break;
      }
      case 'wobble': { // 어질어질: 크게 흔들리는 음높이
        const a = osc('triangle', f), lfo = osc('sine', 5.2), ld = c.createGain(); ld.gain.value = f * 0.035;
        lfo.connect(ld); ld.connect(a.frequency); a.connect(g); env(g, 0.03, dur, v * 1.1); go([a, lfo], end); break;
      }
      case 'growl': {  // 으르렁 베이스: 필터가 꿈틀
        const a = osc('sawtooth', f), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.value = 420;
        const lfo = osc('sine', 3), ld = c.createGain(); ld.gain.value = 260; lfo.connect(ld); ld.connect(lp.frequency);
        a.connect(lp); lp.connect(g); env(g, 0.01, dur, v * 1.2); go([a, lfo], end); break;
      }
      case 'glitch': { // 툭툭 튀는 소리: 중간에 음이 갑자기 바뀜
        const a = osc('square', f); a.frequency.setValueAtTime(f * (Math.random() < 0.5 ? 2 : 0.5), t + dur * 0.5);
        a.connect(g); env(g, 0.003, dur * 0.8, v * 0.8); go([a], end); break;
      }
      case 'hit': {   // 관현악 강타: 근음·5도·옥타브를 한꺼번에 + 낮은 울림
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.7); lp.connect(g);
        const ns = [1, 1.5, 2, 3].map((m, i) => { const x = osc('sawtooth', f * m, i % 2 ? 8 : -8); x.connect(lp); return x; });
        const sub = osc('sine', f / 2); sub.connect(g); ns.push(sub);
        env(g, 0.006, 0.9, v * 0.9); go(ns, t + 0.9); break;
      }
      /* ---- 월드 곡 악기 (밝고 맑게) ---- */
      case 'marimba': case 'vibes': {   // 나무 실로폰 / 비브라폰(떨림)
        const a = osc('sine', f), b = osc('sine', f * 4), gb = c.createGain(); gb.gain.value = e.inst === 'marimba' ? 0.18 : 0.08;
        a.connect(g); b.connect(gb); gb.connect(g);
        const dec = e.inst === 'marimba' ? 0.45 : Math.max(0.8, dur * 1.4); env(g, 0.003, dec, v * 1.3);
        const ns = [a, b];
        if (e.inst === 'vibes') { const lfo = osc('sine', 5.5), lg = c.createGain(); lg.gain.value = v * 0.35; lfo.connect(lg); lg.connect(g.gain); ns.push(lfo); }
        go(ns, t + dec); break;
      }
      case 'musicbox': {   // 오르골: 높고 짧게 반짝
        const a = osc('sine', f), b = osc('sine', f * 3), gb = c.createGain(); gb.gain.value = 0.12;
        a.connect(g); b.connect(gb); gb.connect(g); env(g, 0.002, 0.9, v * 1.1); go([a, b], t + 0.9); break;
      }
      case 'pluck': case 'ukulele': case 'harp': {   // 기타 / 우쿨렐레 / 하프: 튕기고 사라짐
        const a = osc(e.inst === 'harp' ? 'triangle' : 'sawtooth', f), lp = c.createBiquadFilter(); lp.type = 'lowpass';
        const top = e.inst === 'ukulele' ? 3600 : e.inst === 'harp' ? 2400 : 2800, dec = e.inst === 'harp' ? 1.1 : e.inst === 'ukulele' ? 0.3 : 0.5;
        lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(350, t + dec);
        a.connect(lp); lp.connect(g); env(g, 0.003, dec, v * (e.inst === 'harp' ? 1.2 : 0.9)); go([a], t + dec); break;
      }
      case 'epiano': {   // 전자 피아노: 부드러운 종 같은 울림
        const a = osc('sine', f), m = osc('sine', f * 2), mg = c.createGain();
        mg.gain.setValueAtTime(f * 0.9, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.4); m.connect(mg); mg.connect(a.frequency);
        const dec = Math.max(0.6, dur * 1.3); a.connect(g); env(g, 0.004, dec, v * 1.1); go([a, m], t + dec); break;
      }
      case 'flute': {   // 플루트: 숨결처럼 부드럽고 살짝 떨림
        const a = osc('sine', f), b = osc('triangle', f * 2), gb = c.createGain(); gb.gain.value = 0.08;
        const lfo = osc('sine', 5), ld = c.createGain(); ld.gain.setValueAtTime(0, t); ld.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
        lfo.connect(ld); ld.connect(a.frequency); a.connect(g); b.connect(gb); gb.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 1.1, t + 0.06); g.gain.setValueAtTime(v * 1.1, t + Math.max(0.07, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
        go([a, b, lfo], t + dur + 0.12); break;
      }
      case 'steel': {   // 스틸 드럼: 통통 튀는 바닷가 소리
        const a = osc('sine', f), b = osc('sine', f * 2), c3 = osc('sine', f * 3), gb = c.createGain(), gc = c.createGain(); gb.gain.value = 0.35; gc.gain.value = 0.12;
        a.frequency.setValueAtTime(f * 1.02, t); a.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        a.connect(g); b.connect(gb); gb.connect(g); c3.connect(gc); gc.connect(g); env(g, 0.004, 0.6, v * 1.1); go([a, b, c3], t + 0.6); break;
      }
      case 'synthlead': {   // 상큼한 신스: 두 줄을 살짝 어긋나게
        const a = osc('square', f), b = osc('sawtooth', f, 8), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        const lfo = osc('sine', 5.5), ld = c.createGain(); ld.gain.value = f * 0.004; lfo.connect(ld); ld.connect(a.frequency);
        a.connect(lp); b.connect(lp); lp.connect(g); env(g, 0.01, dur, v * 0.6); go([a, b, lfo], end); break;
      }
      case 'strings': {   // 현악 패드: 천천히 차오르는 화음
        const a = osc('sawtooth', f, -7), b = osc('sawtooth', f, 7), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
        a.connect(lp); b.connect(lp); lp.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.5, t + Math.min(0.5, dur * 0.3)); g.gain.setValueAtTime(v * 0.5, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
        go([a, b], t + dur + 0.3); break;
      }
      case 'upright': case 'pluckbass': {   // 콘트라베이스 / 튕기는 베이스
        const a = osc(e.inst === 'upright' ? 'sine' : 'triangle', f), b = osc('triangle', f * 2), gb = c.createGain(); gb.gain.value = e.inst === 'upright' ? 0.25 : 0.15;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
        a.connect(lp); b.connect(gb); gb.connect(lp); lp.connect(g); const dec = Math.min(0.5, dur + 0.15); env(g, 0.005, dec, v * 1.2); go([a, b], t + dec); break;
      }
      case 'sub': {   // 둥근 저음
        const a = osc('sine', f); a.connect(g); env(g, 0.02, dur, v * 1.1); go([a], end); break;
      }
      case 'synthbass': {   // 통통 튀는 신스 베이스
        const a = osc('sawtooth', f), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
        lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
        a.connect(lp); lp.connect(g); env(g, 0.005, Math.max(0.15, dur), v * 0.9); go([a], t + Math.max(0.15, dur)); break;
      }
      default: return false;
    }
    return true;
  }
  function voice(c, o, e, t, dur) {
    if (e.inst && instVoice(c, o, e, t, dur)) return;
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
  /** 짧은 잡음 한 번 (셰이커·손뼉·선로 등) */
  function noise(c, o, t, len, type, freq, vol, q) {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf;
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random() * 0.5, len + 0.02);
  }
  const DRUMS = new Set(['taiko', 'riser', 'kick', 'snare', 'hat', 'heart', 'gong', 'storm', 'tick', 'sting', 'clack', 'shaker', 'clap', 'scribble', 'wave', 'crowd', 'page', 'bird']);
  function drum(c, o, e, t) {
    if (e.kind === 'heart') {   // 쿵-쿵 심장 박동 (아주 낮게)
      const x = c.createOscillator(), g = c.createGain(); x.frequency.setValueAtTime(70, t); x.frequency.exponentialRampToValueAtTime(38, t + 0.14);
      g.gain.setValueAtTime(0.55 * e.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); x.connect(g); g.connect(o); x.start(t); x.stop(t + 0.25); return;
    }
    if (e.kind === 'gong') {    // 징: 낮고 오래 울리는 금속음
      for (const [fr, vv] of [[98, 0.22], [147.5, 0.12], [233, 0.06]]) { const x = c.createOscillator(), g = c.createGain(); x.frequency.setValueAtTime(fr, t); x.frequency.linearRampToValueAtTime(fr * 0.985, t + 3); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vv * e.vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); x.connect(g); g.connect(o); x.start(t); x.stop(t + 3.3); }
      return;
    }
    if (e.kind === 'storm' || e.kind === 'tick' || e.kind === 'sting') {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; s.loop = e.kind === 'storm';
      if (e.kind === 'storm') {   // 휘몰아치는 바람: 필터가 오르내림
        const L = (e.len || 48) * (60 / (cur ? cur.comp.bpm : 120) / 4);
        f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + L * 0.5); f.frequency.exponentialRampToValueAtTime(260, t + L);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * e.vol, t + L * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
        s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + L + 0.05); return;
      }
      if (e.kind === 'tick') { f.type = 'highpass'; f.frequency.value = 5200; g.gain.setValueAtTime(0.12 * e.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025); s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random() * 0.5, 0.04); return; }
      // sting: 확 찌르는 소리 (잡음 + 아래로 떨어지는 음)
      f.type = 'highpass'; f.frequency.value = 2000; g.gain.setValueAtTime(0.14 * e.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); s.connect(f); f.connect(g); g.connect(o); s.start(t, 0, 0.4);
      const x = c.createOscillator(), xg = c.createGain(); x.type = 'sawtooth'; x.frequency.setValueAtTime(880, t); x.frequency.exponentialRampToValueAtTime(110, t + 0.4); xg.gain.setValueAtTime(0.06 * e.vol, t); xg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42); x.connect(xg); xg.connect(o); x.start(t); x.stop(t + 0.45); return;
    }
    if (e.kind === 'taiko') {   // 큰북: 깊게 쿵 + 북 가죽 소리
      const x = c.createOscillator(), xg = c.createGain(); x.frequency.setValueAtTime(95, t); x.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      xg.gain.setValueAtTime(0.6 * e.vol, t); xg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); x.connect(xg); xg.connect(o); x.start(t); x.stop(t + 0.65);
      noise(c, o, t, 0.12, 'lowpass', 900, 0.12 * e.vol, 0.7); return;
    }
    if (e.kind === 'riser') {   // 차오르는 소리: 잡음이 점점 커지며 높아짐 + 올라가는 음
      const L = (e.len || 16) * (60 / (cur ? cur.comp.bpm : 120) / 4);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; s.loop = true;
      f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + L);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 * e.vol, t + L * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + L + 0.05);
      s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + L + 0.1);
      const x = c.createOscillator(), xg = c.createGain(); x.type = 'sawtooth'; x.frequency.setValueAtTime(80, t); x.frequency.exponentialRampToValueAtTime(640, t + L);
      xg.gain.setValueAtTime(0.0001, t); xg.gain.exponentialRampToValueAtTime(0.04 * e.vol, t + L * 0.9); xg.gain.exponentialRampToValueAtTime(0.0001, t + L + 0.05); x.connect(xg); xg.connect(o); x.start(t); x.stop(t + L + 0.1); return;
    }
    if (e.kind === 'clack') {   // 덜컹: 선로 이음매
      const x = c.createOscillator(), xg = c.createGain(); x.frequency.setValueAtTime(110, t); x.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      xg.gain.setValueAtTime(0.12 * e.vol, t); xg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); x.connect(xg); xg.connect(o); x.start(t); x.stop(t + 0.1);
      noise(c, o, t, 0.05, 'bandpass', 1800, 0.06 * e.vol, 2); return;
    }
    if (e.kind === 'shaker') { noise(c, o, t, 0.05, 'bandpass', 6500, 0.035 * e.vol, 1.5); return; }
    if (e.kind === 'clap') { for (const d of [0, 0.012, 0.024]) noise(c, o, t + d, 0.06, 'bandpass', 1300, 0.08 * e.vol, 1); return; }
    if (e.kind === 'scribble') { for (let i = 0; i < 4; i++) noise(c, o, t + i * 0.07, 0.06, 'bandpass', 3200 + i * 300, 0.03 * e.vol, 3); return; }
    if (e.kind === 'wave' || e.kind === 'crowd' || e.kind === 'page') {   // 파도 / 함성 / 책장 넘기는 소리: 차올랐다 잦아드는 잡음
      const sd = 60 / (cur ? cur.comp.bpm : 120) / 4, L = e.kind === 'page' ? 0.35 : (e.len || 32) * sd;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; s.loop = true;
      f.type = e.kind === 'crowd' ? 'bandpass' : 'lowpass'; f.Q.value = 0.7;
      const f0 = e.kind === 'wave' ? 400 : e.kind === 'crowd' ? 700 : 2500, f1 = e.kind === 'wave' ? 1600 : e.kind === 'crowd' ? 1200 : 5000;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + L * 0.35); f.frequency.exponentialRampToValueAtTime(f0, t + L);
      const pk = e.kind === 'wave' ? 0.09 : e.kind === 'crowd' ? 0.06 : 0.05;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk * e.vol, t + L * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
      s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random() * 0.5); s.stop(t + L + 0.05); return;
    }
    if (e.kind === 'bird') {   // 짹짹: 위로 휘는 짧은 소리 두 번
      for (const d of [0, 0.13]) { const x = c.createOscillator(), xg = c.createGain(); x.frequency.setValueAtTime(2600, t + d); x.frequency.exponentialRampToValueAtTime(4000, t + d + 0.07);
        xg.gain.setValueAtTime(0.0001, t + d); xg.gain.exponentialRampToValueAtTime(0.03 * e.vol, t + d + 0.01); xg.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.09); x.connect(xg); xg.connect(o); x.start(t + d); x.stop(t + d + 0.1); }
      return;
    }
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
    const dry = out(c);
    while (nextT < c.currentTime + LOOKAHEAD) {
      // 곡 바꾸기는 박(4칸) 경계에서 → 박자가 끊기지 않게
      if (pending && step % 4 === 0) { cur = pending; pending = null; step = 0; }
      const sdNow = 60 / cur.comp.bpm / 4, o = cur.boss ? hallOut(c) : dry;
      const t = nextT + (step % 2 ? cur.comp.swing * sdNow : 0);
      for (const e of cur.byStep[step % cur.comp.steps]) {
        if (DRUMS.has(e.kind)) drum(c, o, e, t);
        else voice(c, o, e, t, e.len * sdNow);
      }
      step = (step + 1) % cur.comp.steps;
      nextT += sdNow;
    }
  }

  let want = null;   // 지금 나와야 할 곡 {world, boss, bossName, pattern}
  function sync() {
    const w = want; if (!w || !playing) return;
    const c = ctx(); if (!c) return;
    const bossArg = w.boss ? (w.bossName ? { name: w.bossName, pattern: w.pattern } : true) : false;
    if (!cur) { cur = prep(w.world, bossArg); pending = null; step = 0; nextT = c.currentTime + 0.08; if (!timer) timer = setInterval(tick, 25); tick(); return; }
    const target = pending || cur;
    if (target.world === w.world && target.boss === !!w.boss && (target.bossName || null) === (w.bossName || null)) return;
    pending = prep(w.world, bossArg);
  }

  root.Music = {
    compose, SONGS, bossSong, bossThemeSong,
    /** 소리 출처 (테스트·디버그용): 모든 곡은 코드 음악 */
    get source() { return playing && cur ? 'synth' : 'none'; },
    /** 월드 곡 재생 시작 (같은 곡이면 그대로). 메인 화면도 고른 월드의 곡 */
    play(worldId) {
      const c = ctx(); if (!c) return;
      if (playing && want && want.world === worldId && !want.boss) { this.resume(); return; }
      playing = true; paused = false;
      if (cur && cur.world !== worldId) { cur = null; pending = null; }
      want = { world: worldId, boss: false };
      sync();
    },
    /** 왕 곡으로 전환/복귀. bossDef가 있으면 그 왕의 특징에 맞춘 곡. 왕 사이 쉬는 동안(bossDef 없음)은 지금 곡 유지 */
    setBoss(on, bossDef) {
      if (!playing || !want) return;
      const w = want;
      if (!on) { if (w.boss) { want = { world: w.world, boss: false }; sync(); } return; }
      if (!bossDef) { if (!w.boss) { want = { world: w.world, boss: true, pattern: 'exam' }; sync(); } return; }
      if (w.boss && w.bossName === bossDef.name) return;
      want = { world: w.world, boss: true, bossName: bossDef.name, pattern: bossDef.pattern };
      sync();
    },
    pause() { paused = true; },
    resume() {
      const c = ctx(); if (!c || !playing || !paused) return;
      paused = false; nextT = c.currentTime + 0.05; sync();
    },
    stop() { playing = false; paused = false; pending = null; cur = null; want = null; if (timer) { clearInterval(timer); timer = null; } },
    setMuted(m) { if (bus) bus.gain.value = m ? 0 : VOLUME * (root.Sfx.musicLevel ? root.Sfx.musicLevel() || 1 : 1); },
    /** 설정의 음악 크기·꺼짐을 다시 반영 */
    refreshVolume() { if (bus) bus.gain.setTargetAtTime(VOLUME * root.Sfx.musicLevel(), bus.context.currentTime, 0.03); },
    get state() { return { playing, paused, world: want && want.world, boss: !!(want && want.boss), bossName: want ? want.bossName || null : null, song: cur && cur.comp.name, pending: !!pending, source: this.source }; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { compose, SONGS, bossSong, bossThemeSong, SCALES };
})(typeof window !== 'undefined' ? window : globalThis);
