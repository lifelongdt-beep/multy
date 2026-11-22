/* Endless Me — 메타 진행 (재화·영구 강화·캐릭터·도전 과제·일일 미션·저장)
 * DOM 의존 없음. 저장소(storage)와 날짜는 인자로 받아 테스트 가능.
 */
(function (root) {
  'use strict';

  const Worlds = (typeof module !== 'undefined' && module.exports) ? require('./worlds.js') : root.EchoWorlds;
  const WORLDS = Worlds.WORLDS, WORLD_ORDER = Worlds.ORDER, GEAR = Worlds.GEAR;

  const SAVE_KEY = 'echo-meta-v1';
  const SAVE_VERSION = 1;

  /* ---------- 캐릭터 ---------- */
  // mods: maxhp(+), dmgMul, speedMul, cooldownMul(<1이 빠름), regen(초당), startStats(시작 아이템 레벨)
  const CHARACTERS = {
    student: { id: 'student', emoji: '🧑‍🎓', name: '학생',   cost: 0,   desc: '균형 잡힌 기본 캐릭터', mods: {} },
    athlete: { id: 'athlete', emoji: '🏃',   name: '운동부', cost: 900, desc: '체력 +20, 이동속도 +15%, 공격은 조금 느림 · 운동화 Lv1 시작',
               mods: { maxhp: 20, speedMul: 1.15, cooldownMul: 1.1, startStats: { speed: 1 } } },
    genius:  { id: 'genius',  emoji: '🤓',   name: '전교 1등', cost: 1800, desc: '공격력 +25%, 체력 -20 · 시험 만점 Lv1 시작',
               mods: { maxhp: -20, dmgMul: 1.25, startStats: { crit: 1 } } },
    nurse:   { id: 'nurse',   emoji: '🧑‍⚕️', name: '보건 도우미', cost: 3000, desc: '체력 +10, 초당 체력 재생 +0.7 · 급식 시간 Lv1 시작',
               mods: { maxhp: 10, regen: 0.7, startStats: { regen: 1 } } },
  };

  /* ---------- 영구 강화 (상점) ---------- */
  const SHOP = [
    { id: 'hp',     icon: '❤️', name: '튼튼한 체력',   max: 5, grow: true, base: 120, per: 7,    fmt: (v) => `체력 +${v}` },
    { id: 'dmg',    icon: '💪', name: '단련된 필기',   max: 5, grow: true, base: 150, per: 0.06, fmt: (v) => `공격력 +${Math.round(v * 100)}%` },
    { id: 'speed',  icon: '👟', name: '가벼운 발걸음', max: 5, base: 120, per: 0.04, fmt: (v) => `이동속도 +${Math.round(v * 100)}%` },
    { id: 'magnet', icon: '🧲', name: '넓은 자석',     max: 5, base: 90, per: 8,    fmt: (v) => `구슬 흡수 범위 +${v}` },
    { id: 'xp',     icon: '📚', name: '빠른 습득',     max: 5, base: 180, per: 0.08, fmt: (v) => `경험치 +${Math.round(v * 100)}%` },
    { id: 'regen',  icon: '🍱', name: '든든한 도시락', max: 5, grow: true, base: 210, per: 0.25,  fmt: (v) => `체력 재생 +${v.toFixed(1)}/초` },
    { id: 'echo',   icon: '👻', name: '에코 단련',     max: 5, grow: true, base: 240, per: 0.05, fmt: (v) => `에코 공격력 +${Math.round(v * 100)}%` },
    { id: 'coin',   icon: '🎓', name: '장학금',        max: 5, base: 270, per: 0.10, fmt: (v) => `학점 획득 +${Math.round(v * 100)}%` },
  ];
  const SHOP_BY_ID = {}; SHOP.forEach((s) => { SHOP_BY_ID[s.id] = s; });

  /** 기본 강화 가격: 회차마다 그 회차 수입만큼 비싸진다 (학교 단계의 학점 배율). 레벨은 5개 묶음마다 다시 기본가부터 */
  function shopCost(id, level, cycle) { return Math.round(SHOP_BY_ID[id].base * Math.pow(1.85, level % 5) * Worlds.rewardMul('school', cycle || 0)); }
  /** 최대 레벨: 체력·공격력·재생·에코처럼 계속 키울 수 있는 강화는 회차마다 +5 */
  function shopMax(save, id) { const it = SHOP_BY_ID[id]; return it.grow ? it.max * (Math.min(9999, topCycle(save)) + 1) : it.max; }
  /** 지금까지 열린 가장 높은 회차 (장비·강화의 최대 레벨과 가격은 이 기준: 낮은 회차로 돌아가도 그대로) */
  function topCycle(save) { return Math.max(save.cycle || 0, save.maxCycle || 0); }

  /* ---------- 월드 매점 장비 ----------
   * 월드마다 ⚔ 공격 장비(팀 공격력 x1.06/레벨, 에코 포함) 1개 + 🛡 방어 장비(받는 피해 ÷1.05/레벨) 1개.
   * 그 월드에 도착하면(해금되면) 살 수 있고, 최대 레벨은 회차마다 +3 (1회차 5).
   * 뒤 월드일수록 적이 강해지므로(worlds.js stageMul) 장비를 사 모아야 끝까지 갈 수 있다. */
  const GEAR_ITEMS = [];
  for (const w of WORLD_ORDER) {
    for (const kind of ['atk', 'def']) {
      const g = WORLDS[w].gear[kind];
      GEAR_ITEMS.push({ id: w + ':' + kind, world: w, kind, icon: g.icon, name: g.name });
    }
  }
  const GEAR_BY_ID = {}; GEAR_ITEMS.forEach((g) => { GEAR_BY_ID[g.id] = g; });
  function gearLevel(save, id) { return save.gear[id] || 0; }
  function gearMax(save) { return Worlds.gearMaxLevel(topCycle(save)); }
  /** 다음 1레벨 가격 (같은 종류는 어느 월드 장비든 같은 값, 많이 살수록 비싸짐) */
  function gearCost(save, id) { const k = GEAR_BY_ID[id].kind; return Worlds.gearCost(k, gearTotals(save)[k]); }
  /** 큰 숫자를 짧게: 12,345 → 1.2만, 3억 … (끝없는 회차에서 학점이 커지므로) */
  function fmtNum(n) {
    n = Math.floor(n || 0);
    if (n < 10000) return String(n);
    const units = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
    for (const [v, u] of units) if (n >= v) { const x = n / v; return (x >= 100 ? Math.floor(x) : x.toFixed(1).replace(/\.0$/, '')) + u; }
    return String(n);
  }
  /** 장비 레벨 합계 {atk, def} */
  function gearTotals(save) {
    const t = { atk: 0, def: 0 };
    for (const g of GEAR_ITEMS) t[g.kind] += gearLevel(save, g.id);
    return t;
  }
  /** 그 월드의 장비를 살 수 있는가: 이번 회차에 열린 월드이거나, 이미 한 바퀴 돈 뒤(2회차~)면 모두 */
  function gearAvailable(save, worldId) { return topCycle(save) > 0 || worldUnlocked(save, worldId); }
  function gearText(kind, lv) {
    return kind === 'atk'
      ? `총알 위력 x${Math.pow(GEAR.atkPer, lv).toFixed(2)}`
      : `받는 피해 x${Math.pow(1 / GEAR.defPer, lv).toFixed(2)}`;
  }

  /* ---------- 도전 과제 ---------- */
  // test(stats, run): stats는 이번 판 반영 후 누적 통계
  const ACHIEVEMENTS = [
    { id: 'first_run',  icon: '🎒', name: '첫 등교',       desc: '게임을 1판 플레이',           reward: 20,  test: (s) => s.runs >= 1 },
    { id: 'runs_10',    icon: '📅', name: '개근상',        desc: '10판 플레이',                 reward: 60,  test: (s) => s.runs >= 10 },
    { id: 'kills_100',  icon: '🧹', name: '마음 정리',     desc: '방해 요소를 누적 100개 물리치기',           reward: 40,  test: (s) => s.kills >= 100 },
    { id: 'kills_1000', icon: '✨', name: '마음 대청소',        desc: '방해 요소를 누적 1000개 물리치기',          reward: 150, test: (s) => s.kills >= 1000 },
    { id: 'survive_60', icon: '⏱️', name: '30초 버티기',   desc: '한 판에서 30초 생존',         reward: 40,  test: (s) => s.bestTime >= 30 },
    { id: 'survive_90', icon: '🕰️', name: '55초의 벽',     desc: '한 판에서 55초 생존 (보스 등장)', reward: 80,  test: (s) => s.bestTime >= 55 },
    { id: 'level_10',   icon: '📈', name: '우등생',        desc: '한 판에서 Lv 10 달성',        reward: 50,  test: (s) => s.bestLevel >= 10 },
    { id: 'level_20',   icon: '🏅', name: '수석',          desc: '한 판에서 Lv 20 달성',        reward: 120, test: (s) => s.bestLevel >= 20 },
    { id: 'clear_1',    icon: '🌈', name: '시험 불안 극복', desc: '학교 월드의 “시험 불안”을 극복',        reward: 200, test: (s) => s.clears >= 1 },
    { id: 'clear_5',    icon: '🎖️', name: '졸업 준비',     desc: '큰 도전(보스)을 5번 극복',             reward: 400, test: (s) => s.clears >= 5 },
    { id: 'clear_academy', icon: '☀️', name: '슬럼프 탈출',     desc: '학원 월드의 “슬럼프”를 극복',       reward: 300, test: (s, run, sv) => !!sv && (sv.worlds.clears.academy || 0) >= 1 },
    { id: 'clear_office',  icon: '🌿', name: '번아웃 극복',          desc: '회사 월드의 “번아웃”을 극복',   reward: 500, test: (s, run, sv) => !!sv && (sv.worlds.clears.office || 0) >= 1 },
    { id: 'clear_subway',  icon: '🏠', name: '퇴근 성공!',    desc: '지하철 월드에서 “급행열차”를 피해 무사히 퇴근', reward: 800, test: (s, run, sv) => !!sv && (sv.worlds.clears.subway || 0) >= 1 },
    { id: 'clear_home',    icon: '🌙', name: '꿀잠',          desc: '집 월드의 “불면증”을 극복',            reward: 1000, test: (s, run, sv) => !!sv && (sv.worlds.clears.home || 0) >= 1 },
    { id: 'clear_beach',   icon: '🌤️', name: '태풍이 지나간 뒤', desc: '바닷가 월드의 “태풍”을 극복',      reward: 1500, test: (s, run, sv) => !!sv && (sv.worlds.clears.beach || 0) >= 1 },
    { id: 'clear_stage',   icon: '🌟', name: '꿈의 무대',     desc: '마지막 월드 “꿈의 무대”에서 무대 공포증을 극복', reward: 3000, test: (s, run, sv) => !!sv && (sv.worlds.clears.stage || 0) >= 1 },
    { id: 'cycle_2',       icon: '🔁', name: '두 번째 여정',  desc: '12개 월드를 모두 극복하고 2회차 시작',  reward: 2000, test: (s, run, sv) => !!sv && topCycle(sv) >= 1 },
    { id: 'cycle_3',       icon: '♾️', name: '끝없는 성장',   desc: '3회차 시작',                           reward: 5000, test: (s, run, sv) => !!sv && topCycle(sv) >= 2 },
    { id: 'gear_20',       icon: '🧰', name: '든든한 장비',   desc: '매점 장비 레벨 합계 20',               reward: 300,  test: (s, run, sv) => !!sv && sv.gear && Object.values(sv.gear).reduce((a, b) => a + b, 0) >= 20 },
    { id: 'help_1',     icon: '🙋', name: '도움 요청하기', desc: '선생님·선배께 도움을 청해 조언 받기',  reward: 40,  test: (s) => s.helped >= 1 },
    { id: 'help_10',    icon: '💛', name: '든든한 인연',   desc: '도움을 청해 조언을 10번 받기',        reward: 150, test: (s) => s.helped >= 10 },
    { id: 'echo_5',     icon: '👻', name: '유령 친구들',   desc: '에코 5명과 함께 플레이',      reward: 80,  test: (s, run) => !!run && run.echoes >= 5 },
    { id: 'echo_10',    icon: '👥', name: '유령 반 편성',  desc: '에코 10명과 함께 플레이',     reward: 200, test: (s, run) => !!run && run.echoes >= 10 },
  ];

  /* ---------- 일일 미션 ---------- */
  // kind: sum(누적) | max(한 판 최고) | count(횟수)
  const MISSION_TEMPLATES = [
    { id: 'kills',   kind: 'sum', field: 'kills',   targets: [[60, 30], [120, 55], [200, 90]],  text: (t) => `방해 요소 ${t}개 물리치기` },
    { id: 'gems',    kind: 'sum', field: 'gems',    targets: [[40, 30], [80, 50], [140, 80]],   text: (t) => `구슬 ${t}개 획득` },
    { id: 'survive', kind: 'max', field: 'seconds', targets: [[30, 30], [45, 55], [60, 90]],   text: (t) => `한 판에서 ${t}초 생존` },
    { id: 'level',   kind: 'max', field: 'level',   targets: [[6, 30], [10, 55], [15, 90]],     text: (t) => `한 판에서 Lv ${t} 달성` },
    { id: 'clear',   kind: 'sum', field: 'clear',   targets: [[1, 120]],                        text: () => '큰 도전(보스) 극복하기' },
    { id: 'help',    kind: 'sum', field: 'helped',  targets: [[1, 40], [2, 70]],                text: (t) => t === 1 ? '선생님·선배께 도움 청하기' : `도움을 ${t}번 청하기` },
    { id: 'runs',    kind: 'sum', field: 'runs',    targets: [[3, 30], [5, 50]],                text: (t) => `${t}판 플레이` },
  ];

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function prng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** 날짜(YYYY-MM-DD)로 결정되는 오늘의 미션 3개 */
  function dailyMissions(date) {
    const r = prng(hashStr('daily:' + date));
    const pool = MISSION_TEMPLATES.slice();
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const [target, reward] = t.targets[Math.floor(r() * t.targets.length)];
      out.push({ id: t.id, target, reward, progress: 0, done: false });
    }
    return out;
  }
  function missionText(m) { return MISSION_TEMPLATES.find((t) => t.id === m.id).text(m.target); }

  /* ---------- 저장 데이터 ---------- */
  function defaultSave() {
    return {
      v: SAVE_VERSION,
      coins: 0,
      shop: {},                                   // id -> level
      chars: { unlocked: ['student'], selected: 'student' },
      stats: { runs: 0, kills: 0, gems: 0, clears: 0, bestTime: 0, bestLevel: 0, totalCoins: 0, helped: 0 },
      ach: {},                                    // id -> true
      daily: { date: '', missions: [] },
      worlds: { selected: 'school', clears: {}, best: {}, cycleClears: {} },   // 월드별 극복 횟수(전체) / 최장 생존(초) / 이번 회차 극복 횟수
      tutorial: false,                            // 튜토리얼(에코 10명과 함께하는 첫 판)을 마쳤거나 건너뛰었는지
      gear: {},                                   // 월드 매점 장비 'world:atk|def' -> level
      cycle: 0,                                   // 지금 플레이하는 회차(0=1회차). 월드 메뉴에서 열린 회차 중 고를 수 있다
      maxCycle: 0,                                // 열린 가장 높은 회차. 12개 월드를 모두 극복하면 +1
      deeds: { people: 0, escorts: 0, spots: 0, book: {}, visitor: null },   // 선행 기록: 도운 사람 · 지켜 준 친구 · 작은 선행 · 도감('world:kind' -> 횟수) · 다음 판에 찾아올 사람
    };
  }

  /* ---------- 선행: 점수 · 칭호 · 도감 ---------- */
  const DEED_KINDS = ['child', 'elder', 'friend'];
  const DEED_KIND_INFO = { child: { emoji: '🧒', name: '길 잃은 아이' }, elder: { emoji: '👵', name: '곤란한 어르신' }, friend: { emoji: '🧑', name: '친구' } };
  const TITLES = [
    { at: 0,    icon: '🌱', name: '새싹' },
    { at: 10,   icon: '🙂', name: '친절한 학생' },
    { at: 40,   icon: '🤝', name: '든든한 이웃' },
    { at: 100,  icon: '💛', name: '모두의 친구' },
    { at: 250,  icon: '☀️', name: '마을의 햇살' },
    { at: 600,  icon: '🦸', name: '따뜻한 영웅' },
    { at: 1500, icon: '🌈', name: '전설의 착한 사람' },
    { at: 4000, icon: '👼', name: '세상을 밝히는 사람' },
  ];
  /** 선행 점수: 사람을 돕거나 친구를 지키면 3점, 작은 선행은 1점 */
  function deedScore(save) { const d = save.deeds || {}; return (d.people || 0) * 3 + (d.spots || 0); }
  function titleOf(score) { let t = TITLES[0], next = null; for (let i = 0; i < TITLES.length; i++) { if (score >= TITLES[i].at) { t = TITLES[i]; next = TITLES[i + 1] || null; } } return { title: t, next }; }
  /** 도감: 월드 × 사람 종류 */
  function deedBook(save) {
    const book = (save.deeds && save.deeds.book) || {}, list = [];
    for (const w of WORLD_ORDER) for (const k of DEED_KINDS) list.push({ world: w, kind: k, count: book[w + ':' + k] || 0 });
    return list;
  }
  /** 다음 판 시작 때 찾아올 사람을 꺼낸다 (한 번 찾아오면 사라짐) */
  function takeVisitor(save) { const v = save.deeds && save.deeds.visitor; if (save.deeds) save.deeds.visitor = null; return v || null; }

  const isNum = (x) => typeof x === 'number' && isFinite(x);

  /** 어떤 입력이 와도 안전한 저장 객체로 정리 */
  function sanitize(raw) {
    const d = defaultSave();
    if (!raw || typeof raw !== 'object') return d;
    if (isNum(raw.coins) && raw.coins >= 0) d.coins = Math.floor(raw.coins);
    if (raw.shop && typeof raw.shop === 'object') {
      const cyc = Math.max(isNum(raw.cycle) && raw.cycle >= 0 ? Math.min(9999, Math.floor(raw.cycle)) : 0, isNum(raw.maxCycle) && raw.maxCycle >= 0 ? Math.min(9999, Math.floor(raw.maxCycle)) : 0);
      for (const it of SHOP) { const lv = raw.shop[it.id]; if (isNum(lv)) d.shop[it.id] = Math.max(0, Math.min(shopMax({ cycle: cyc }, it.id), Math.floor(lv))); }
    }
    if (raw.chars && typeof raw.chars === 'object') {
      const un = Array.isArray(raw.chars.unlocked) ? raw.chars.unlocked.filter((id) => CHARACTERS[id]) : [];
      d.chars.unlocked = Array.from(new Set(['student'].concat(un)));
      d.chars.selected = d.chars.unlocked.indexOf(raw.chars.selected) >= 0 ? raw.chars.selected : 'student';
    }
    if (raw.stats && typeof raw.stats === 'object') {
      for (const k in d.stats) if (isNum(raw.stats[k]) && raw.stats[k] >= 0) d.stats[k] = raw.stats[k];
    }
    if (raw.ach && typeof raw.ach === 'object') {
      for (const a of ACHIEVEMENTS) if (raw.ach[a.id] === true) d.ach[a.id] = true;
    }
    if (raw.daily && typeof raw.daily === 'object' && typeof raw.daily.date === 'string' && Array.isArray(raw.daily.missions)) {
      d.daily.date = raw.daily.date;
      d.daily.missions = raw.daily.missions
        .filter((m) => m && MISSION_TEMPLATES.some((t) => t.id === m.id) && isNum(m.target) && isNum(m.reward))
        .slice(0, 3)
        .map((m) => ({ id: m.id, target: m.target, reward: m.reward, progress: isNum(m.progress) ? Math.max(0, m.progress) : 0, done: m.done === true }));
    }
    if (isNum(raw.cycle) && raw.cycle >= 0) d.cycle = Math.min(9999, Math.floor(raw.cycle));
    d.maxCycle = Math.max(d.cycle, isNum(raw.maxCycle) && raw.maxCycle >= 0 ? Math.min(9999, Math.floor(raw.maxCycle)) : 0);
    if (raw.gear && typeof raw.gear === 'object') {
      const max = Worlds.gearMaxLevel(d.maxCycle);
      for (const g of GEAR_ITEMS) { const lv = raw.gear[g.id]; if (isNum(lv) && lv > 0) d.gear[g.id] = Math.min(max, Math.floor(lv)); }
    }
    if (raw.worlds && typeof raw.worlds === 'object') {
      // 회차 기능 이전 저장에는 cycleClears가 없다 → 1회차 진행으로 clears를 그대로 쓴다
      const cc = raw.worlds.cycleClears && typeof raw.worlds.cycleClears === 'object' ? raw.worlds.cycleClears : (d.cycle === 0 ? raw.worlds.clears : null);
      for (const id of WORLD_ORDER) {
        if (raw.worlds.clears && isNum(raw.worlds.clears[id]) && raw.worlds.clears[id] > 0) d.worlds.clears[id] = Math.floor(raw.worlds.clears[id]);
        if (raw.worlds.best && isNum(raw.worlds.best[id]) && raw.worlds.best[id] > 0) d.worlds.best[id] = raw.worlds.best[id];
        if (cc && isNum(cc[id]) && cc[id] > 0) d.worlds.cycleClears[id] = Math.floor(cc[id]);
      }
      if (WORLDS[raw.worlds.selected] && worldUnlocked(d, raw.worlds.selected)) d.worlds.selected = raw.worlds.selected;
    }
    if (raw.deeds && typeof raw.deeds === 'object') {
      for (const k of ['people', 'escorts', 'spots']) if (isNum(raw.deeds[k]) && raw.deeds[k] >= 0) d.deeds[k] = Math.floor(raw.deeds[k]);
      if (raw.deeds.book && typeof raw.deeds.book === 'object') {
        for (const w of WORLD_ORDER) for (const k of DEED_KINDS) { const v = raw.deeds.book[w + ':' + k]; if (isNum(v) && v > 0) d.deeds.book[w + ':' + k] = Math.floor(v); }
      }
      const v = raw.deeds.visitor;
      if (v && DEED_KINDS.indexOf(v.kind) >= 0) d.deeds.visitor = { kind: v.kind, world: WORLDS[v.world] ? v.world : 'school' };
    }
    // 튜토리얼 기능 이전부터 플레이하던 사람은 이미 게임을 아는 것으로 본다
    d.tutorial = raw.tutorial === true || d.stats.runs > 0;
    return d;
  }

  /* ---------- 월드 ---------- */
  /** 학교는 항상 열려 있고, 나머지는 "이번 회차에" 바로 앞 월드의 보스를 한 번 이상 극복하면 열린다 */
  function worldUnlocked(save, id) {
    const w = WORLDS[id];
    if (!w) return false;
    if (!w.unlock) return true;
    if ((save.cycle || 0) < (save.maxCycle || 0)) return true;   // 이미 끝낸 회차를 다시 할 때는 모든 월드가 열려 있다
    return ((save.worlds.cycleClears || {})[w.unlock.world] || 0) >= 1;
  }
  /** 회차 고르기: 열린 회차(0 ~ maxCycle) 중 하나. 고른 월드가 잠겨 있으면 학교로 */
  function selectCycle(save, c) {
    c = Math.floor(c);
    if (!(c >= 0 && c <= topCycle(save)) || c === save.cycle) return false;
    save.cycle = c;
    if (!worldUnlocked(save, save.worlds.selected)) save.worlds.selected = WORLD_ORDER[0];
    return true;
  }
  function selectWorld(save, id) {
    if (!worldUnlocked(save, id)) return false;
    save.worlds.selected = id; return true;
  }

  function load(storage) {
    try { const s = storage && storage.getItem(SAVE_KEY); return sanitize(s ? JSON.parse(s) : null); } catch (e) { return defaultSave(); }
  }
  function persist(storage, save) {
    try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
  }

  /* ---------- 보너스 계산 ---------- */
  function shopLevel(save, id) { return save.shop[id] || 0; }

  /** 상점 + 선택 캐릭터를 합친, 시뮬레이션에 전달할 보너스 */
  function bonusFor(save) {
    const lv = (id) => shopLevel(save, id) * SHOP_BY_ID[id].per;
    const mods = (CHARACTERS[save.chars.selected] || CHARACTERS.student).mods;
    const gt = gearTotals(save);
    const teamMul = Math.pow(GEAR.atkPer, gt.atk);
    return {
      maxhp: lv('hp') + (mods.maxhp || 0),
      dmgMul: (1 + lv('dmg')) * (mods.dmgMul || 1) * teamMul,
      teamMul,                                     // 에코에게도 같은 장비 공격력
      takenMul: Math.pow(1 / GEAR.defPer, gt.def),
      speedMul: (1 + lv('speed')) * (mods.speedMul || 1),
      cooldownMul: mods.cooldownMul || 1,
      magnet: lv('magnet'),
      xpMul: 1 + lv('xp'),
      regen: lv('regen') + (mods.regen || 0),
      echoPower: lv('echo'),
      startStats: Object.assign({}, mods.startStats || {}),
    };
  }
  function coinMul(save) { return 1 + shopLevel(save, 'coin') * SHOP_BY_ID.coin.per; }
  /** 이 월드·회차에서의 학점 배율 (적이 강할수록 많이) */
  function rewardMul(worldId, cycle) { return Worlds.rewardMul(worldId, cycle); }

  /* ---------- 에코 풀 ---------- */
  /** 에코는 쌓은 월드에서만 함께한다. 다른 월드에서 시작하면 빈 풀로 새로 시작한다.
   *  @param pool {world, echoes} (없으면 null)   @returns {{world:string, echoes:Array, cleared:number}} cleared=사라진 에코 수 */
  function echoesForWorld(pool, worldId) {
    const w = WORLDS[worldId] ? worldId : 'school';
    const list = pool && Array.isArray(pool.echoes) ? pool.echoes : [];
    const poolWorld = pool && pool.world ? pool.world : 'school';      // 월드 정보 없는 옛 데이터는 학교 것
    if (poolWorld === w) return { world: w, echoes: list, cleared: 0 };
    return { world: w, echoes: [], cleared: list.length };
  }

  /* ---------- 구매/선택 ---------- */
  function buyUpgrade(save, id) {
    const it = SHOP_BY_ID[id];
    if (!it) return { ok: false, reason: 'unknown' };
    const lv = shopLevel(save, id);
    if (lv >= shopMax(save, id)) return { ok: false, reason: 'max' };
    const cost = shopCost(id, lv, topCycle(save));
    if (save.coins < cost) return { ok: false, reason: 'coins', cost };
    save.coins -= cost; save.shop[id] = lv + 1;
    return { ok: true, cost, level: lv + 1 };
  }
  function unlockCharacter(save, id) {
    const c = CHARACTERS[id];
    if (!c) return { ok: false, reason: 'unknown' };
    if (save.chars.unlocked.indexOf(id) >= 0) return { ok: false, reason: 'owned' };
    if (save.coins < c.cost) return { ok: false, reason: 'coins', cost: c.cost };
    save.coins -= c.cost; save.chars.unlocked.push(id);
    return { ok: true, cost: c.cost };
  }
  function buyGear(save, id) {
    const g = GEAR_BY_ID[id];
    if (!g) return { ok: false, reason: 'unknown' };
    if (!gearAvailable(save, g.world)) return { ok: false, reason: 'locked' };
    const lv = gearLevel(save, id);
    if (lv >= gearMax(save)) return { ok: false, reason: 'max' };
    const cost = gearCost(save, id);
    if (save.coins < cost) return { ok: false, reason: 'coins', cost };
    save.coins -= cost; save.gear[id] = lv + 1;
    return { ok: true, cost, level: lv + 1 };
  }
  function selectCharacter(save, id) {
    if (save.chars.unlocked.indexOf(id) < 0) return false;
    save.chars.selected = id; return true;
  }

  /* ---------- 한 판 결과 반영 ---------- */
  /** run: {kills, seconds, level, result:'dead'|'survive'|'clear', gems, echoes, world, helped}
   *  @returns {{earned:number, base:number, total:number, newAch:Array, missionsDone:Array, newWorld:string|null, newCycle:number|null}}
   *  newCycle: 마지막 월드를 극복해 다음 회차로 넘어갔으면 새 회차 번호(0부터) */
  function recordRun(save, run, today) {
    // 날짜가 바뀌면 오늘의 미션 갱신
    if (save.daily.date !== today) save.daily = { date: today, missions: dailyMissions(today) };

    const worldId = WORLDS[run.world] ? run.world : 'school';
    const unlockedBefore = WORLD_ORDER.filter((w) => worldUnlocked(save, w));
    const st = save.stats;
    st.runs += 1; st.kills += run.kills; st.gems += run.gems || 0; st.helped += run.helped || 0;
    if (run.result === 'clear') st.clears += 1;
    st.bestTime = Math.max(st.bestTime, run.seconds);
    st.bestLevel = Math.max(st.bestLevel, run.level);
    if (run.result === 'clear') {
      save.worlds.clears[worldId] = (save.worlds.clears[worldId] || 0) + 1;
      save.worlds.cycleClears[worldId] = (save.worlds.cycleClears[worldId] || 0) + 1;
    }
    save.worlds.best[worldId] = Math.max(save.worlds.best[worldId] || 0, run.seconds);
    // 선행 기록: 도운 사람은 도감에 남고, 마지막으로 도운 사람이 다음 판에 찾아온다
    const titleBefore = titleOf(deedScore(save)).title;
    const dr = run.deeds;
    if (dr && typeof dr === 'object') {
      const people = Array.isArray(dr.people) ? dr.people.filter((k) => DEED_KINDS.indexOf(k) >= 0) : [];
      save.deeds.people += people.length;
      save.deeds.escorts += isNum(dr.escorts) ? Math.max(0, Math.floor(dr.escorts)) : 0;
      save.deeds.spots += isNum(dr.spots) ? Math.max(0, Math.floor(dr.spots)) : 0;
      for (const k of people) { const key = worldId + ':' + k; save.deeds.book[key] = (save.deeds.book[key] || 0) + 1; }
      if (people.length) save.deeds.visitor = { kind: people[people.length - 1], world: worldId };
    }
    const titleAfter = titleOf(deedScore(save)).title;
    const newTitle = titleAfter !== titleBefore ? titleAfter : null;

    // 기본 보상
    const base = Math.floor(run.kills * 0.4 + run.seconds * 0.9 + run.level * 3 + (run.result === 'clear' ? 100 : run.seconds >= 72 ? 40 : 0));
    const earned = Math.round(base * coinMul(save) * rewardMul(worldId, save.cycle));
    let total = earned;

    // 도전 과제
    const newAch = [];
    for (const a of ACHIEVEMENTS) {
      if (!save.ach[a.id] && a.test(st, run, save)) { save.ach[a.id] = true; newAch.push(a); total += a.reward; }
    }

    // 일일 미션
    const missionsDone = [];
    for (const m of save.daily.missions) {
      if (m.done) continue;
      const t = MISSION_TEMPLATES.find((x) => x.id === m.id);
      const v = t.field === 'clear' ? (run.result === 'clear' ? 1 : 0) : t.field === 'runs' ? 1 : (run[t.field] || 0);
      m.progress = t.kind === 'max' ? Math.max(m.progress, v) : m.progress + v;
      if (m.progress >= m.target) { m.done = true; m.progress = m.target; total += m.reward; missionsDone.push(m); }
    }

    save.coins += total; st.totalCoins += total;
    let newWorld = WORLD_ORDER.find((w) => worldUnlocked(save, w) && unlockedBefore.indexOf(w) < 0) || null;
    // 마지막 월드까지 극복하면 다음 회차: 학교부터 다시, 적은 더 강하고 장비 최대 레벨이 오른다
    let newCycle = null;
    if (run.result === 'clear' && worldId === WORLD_ORDER[WORLD_ORDER.length - 1] && save.cycle >= topCycle(save) && save.cycle < 9999) {
      // 다음 회차가 "열린다" (바로 넘어가지 않음: 결과 화면·월드 메뉴에서 넘어갈 수 있다)
      save.maxCycle = save.cycle + 1;
      save.worlds.cycleClears = {};          // 새 회차의 진행은 처음부터
      newCycle = save.maxCycle; newWorld = null;
      for (const a of ACHIEVEMENTS) {      // 회차 과제는 넘어간 직후에 판정
        if (!save.ach[a.id] && a.test(st, run, save)) { save.ach[a.id] = true; newAch.push(a); save.coins += a.reward; st.totalCoins += a.reward; total += a.reward; }
      }
    }
    return { earned, base, total, newAch, missionsDone, newWorld, newCycle, newTitle };
  }

  /* ---------- 백업 코드 (서버 저장 전까지 기기 이전용) ---------- */
  function b64enc(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64dec(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(str)));
  }
  /* ---------- 에코 백업 압축 ----------
   * 에코 경로는 매 틱 (x,y)라 그대로 넣으면 한 명에 수십 KB가 된다.
   * 백업 코드에는 ECHO_STEP 틱마다 한 점만, 직전 점과의 차이(0.5px 단위, -127..127)를 1바이트로 저장하고
   * 불러올 때 사이를 직선으로 채운다. 차이는 '복원된 위치' 기준으로 계산해 오차가 쌓이지 않는다.
   * 한 명 약 7KB(3분 기준), 10명이어도 백업 코드가 약 70KB 안팎. */
  const ECHO_STEP = 4;
  const ECHO_UNIT = 0.5;
  const ECHO_MAX = 10;                 // 에코 정원 (sim.js의 MAX_ECHOES와 같다)
  const ECHO_MAX_TICKS = 60 * 60 * 10; // 비정상적으로 긴 기록 거부 (10분)
  const ECHO_UP_IDS = ['rate', 'multi', 'dmg', 'speed', 'magnet', 'pierce', 'crit', 'nova', 'orbit', 'regen', 'echo', 'heal'];

  function bytesToB64(u8) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
    let bin = '';
    for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(bin);
  }
  function b64ToBytes(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const bin = atob(str); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  /** 에코 1명 → 백업용 압축 객체 */
  function packEcho(e) {
    const n = Math.floor(e.path.length / 2);
    const idx = [];
    for (let t = 0; t < n; t += ECHO_STEP) idx.push(t);
    if (n > 0 && idx[idx.length - 1] !== n - 1) idx.push(n - 1);   // 마지막 위치는 꼭 남긴다
    const d = new Int8Array(Math.max(0, idx.length - 1) * 2);
    const x0 = n ? Math.round(e.path[0] / ECHO_UNIT) : 0, y0 = n ? Math.round(e.path[1] / ECHO_UNIT) : 0;
    let cx = x0, cy = y0;
    for (let k = 1; k < idx.length; k++) {
      const t = idx[k];
      const dx = Math.max(-127, Math.min(127, Math.round(e.path[t * 2] / ECHO_UNIT) - cx));
      const dy = Math.max(-127, Math.min(127, Math.round(e.path[t * 2 + 1] / ECHO_UNIT) - cy));
      d[(k - 1) * 2] = dx; d[(k - 1) * 2 + 1] = dy; cx += dx; cy += dy;
    }
    return {
      n, x: x0, y: y0, d: bytesToB64(new Uint8Array(d.buffer)),
      u: (e.ups || []).map((up) => [up.t, up.id]),
      k: e.kills || 0, t: e.ticks || n,
    };
  }

  /** 백업용 압축 객체 → 에코 1명. 형식이 틀리면 null */
  function unpackEcho(o) {
    if (!o || typeof o !== 'object') return null;
    const n = o.n;
    if (!Number.isInteger(n) || n < 1 || n > ECHO_MAX_TICKS || !isNum(o.x) || !isNum(o.y) || typeof o.d !== 'string') return null;
    const idx = [];
    for (let t = 0; t < n; t += ECHO_STEP) idx.push(t);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    const raw = b64ToBytes(o.d);
    if (raw.length !== (idx.length - 1) * 2) return null;
    const d = new Int8Array(raw.buffer, raw.byteOffset, raw.length);
    const pts = new Array(idx.length * 2);
    let cx = o.x, cy = o.y;
    pts[0] = cx * ECHO_UNIT; pts[1] = cy * ECHO_UNIT;
    for (let k = 1; k < idx.length; k++) { cx += d[(k - 1) * 2]; cy += d[(k - 1) * 2 + 1]; pts[k * 2] = cx * ECHO_UNIT; pts[k * 2 + 1] = cy * ECHO_UNIT; }
    const path = new Array(n * 2);
    for (let k = 0; k < idx.length; k++) {
      const a = idx[k], b = k + 1 < idx.length ? idx[k + 1] : a;
      for (let t = a; t <= b; t++) {
        const f = b > a ? (t - a) / (b - a) : 0;
        const nx = k + 1 < idx.length ? pts[(k + 1) * 2] : pts[k * 2], ny = k + 1 < idx.length ? pts[(k + 1) * 2 + 1] : pts[k * 2 + 1];
        path[t * 2] = Math.round((pts[k * 2] + (nx - pts[k * 2]) * f) * 10) / 10;
        path[t * 2 + 1] = Math.round((pts[k * 2 + 1] + (ny - pts[k * 2 + 1]) * f) * 10) / 10;
      }
    }
    const ups = Array.isArray(o.u)
      ? o.u.filter((u) => Array.isArray(u) && Number.isInteger(u[0]) && u[0] >= 0 && ECHO_UP_IDS.indexOf(u[1]) >= 0).slice(0, 200).map((u) => ({ t: u[0], id: u[1] }))
      : [];
    return { path, ups, kills: isNum(o.k) && o.k >= 0 ? Math.floor(o.k) : 0, ticks: isNum(o.t) && o.t > 0 ? Math.floor(o.t) : n };
  }

  /* ---------- 백업 코드 (서버 저장 전까지 기기 이전용) ----------
   * ECHO1: 진행 데이터만 (이전 버전, 계속 불러올 수 있음)
   * ECHO2: 진행 데이터 + 에코 풀 {world, echoes} */
  /** @param pool 에코 풀 {world, echoes:[{path,ups,kills,ticks}]} (없으면 ECHO1 형식) */
  function exportCode(save, pool) {
    if (!pool) return 'ECHO1:' + b64enc(JSON.stringify(save));
    const list = (Array.isArray(pool.echoes) ? pool.echoes : []).slice(-ECHO_MAX);
    return 'ECHO2:' + b64enc(JSON.stringify({ save, ep: { w: pool.world, e: list.map(packEcho) } }));
  }
  /** @returns {{save:object, pool:({world:string, echoes:Array}|null)}|null} 형식이 틀리면 null */
  function importBackup(code) {
    try {
      const c = String(code || '').trim();
      const ver = c.slice(0, 6);
      if (ver !== 'ECHO1:' && ver !== 'ECHO2:') return null;
      const raw = JSON.parse(b64dec(c.slice(6)));
      if (!raw || typeof raw !== 'object') return null;
      const s = ver === 'ECHO1:' ? raw : raw.save;
      if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
      let pool = null;
      if (ver === 'ECHO2:') {
        const ep = raw.ep;
        if (!ep || typeof ep !== 'object' || !Array.isArray(ep.e)) return null;
        const echoes = ep.e.slice(-ECHO_MAX).map(unpackEcho);
        if (echoes.some((e) => !e)) return null;
        pool = { world: WORLDS[ep.w] ? ep.w : 'school', echoes };
      }
      return { save: sanitize(s), pool };
    } catch (e) { return null; }
  }
  /** 진행 데이터만 필요할 때 (ECHO1/ECHO2 모두) */
  function importCode(code) {
    const r = importBackup(code);
    return r ? r.save : null;
  }

  const api = {
    SAVE_KEY, CHARACTERS, SHOP, ACHIEVEMENTS, MISSION_TEMPLATES, WORLDS, WORLD_ORDER, worldUnlocked, selectWorld, echoesForWorld,
    GEAR, GEAR_ITEMS, gearLevel, gearMax, gearCost, gearTotals, gearAvailable, gearText, buyGear, rewardMul, fmtNum,
    recommendedGear: Worlds.recommendedGear, stageMul: Worlds.stageMul,
    shopCost, shopMax, shopLevel, dailyMissions, missionText, defaultSave, sanitize, load, persist,
    OUTFITS: Worlds.OUTFITS, topCycle, selectCycle, deedScore, titleOf, deedBook, takeVisitor, TITLES, DEED_KINDS, DEED_KIND_INFO,
    bonusFor, coinMul, buyUpgrade, unlockCharacter, selectCharacter, recordRun, exportCode, importCode, importBackup, packEcho, unpackEcho,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Meta = api;
})(typeof window !== 'undefined' ? window : globalThis);
