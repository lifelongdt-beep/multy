/* 퇴근 에코 — 메타 진행 (재화·영구 강화·캐릭터·도전 과제·일일 미션·저장)
 * DOM 의존 없음. 저장소(storage)와 날짜는 인자로 받아 테스트 가능.
 */
(function (root) {
  'use strict';

  const Worlds = (typeof module !== 'undefined' && module.exports) ? require('./worlds.js') : root.EchoWorlds;
  const WORLDS = Worlds.WORLDS, WORLD_ORDER = Worlds.ORDER;

  const SAVE_KEY = 'echo-meta-v1';
  const SAVE_VERSION = 1;

  /* ---------- 캐릭터 ---------- */
  // mods: maxhp(+), dmgMul, speedMul, cooldownMul(<1이 빠름), regen(초당), startStats(시작 아이템 레벨)
  const CHARACTERS = {
    student: { id: 'student', emoji: '🧑‍🎓', name: '학생',   cost: 0,   desc: '균형 잡힌 기본 캐릭터', mods: {} },
    athlete: { id: 'athlete', emoji: '🏃',   name: '운동부', cost: 300, desc: '체력 +30, 이동속도 +15%, 공격은 조금 느림 · 운동화 Lv1 시작',
               mods: { maxhp: 30, speedMul: 1.15, cooldownMul: 1.1, startStats: { speed: 1 } } },
    genius:  { id: 'genius',  emoji: '🤓',   name: '전교 1등', cost: 600, desc: '공격력 +25%, 체력 -20 · 시험 만점 Lv1 시작',
               mods: { maxhp: -20, dmgMul: 1.25, startStats: { crit: 1 } } },
    nurse:   { id: 'nurse',   emoji: '🧑‍⚕️', name: '보건 도우미', cost: 900, desc: '체력 +10, 초당 체력 재생 +1 · 급식 시간 Lv1 시작',
               mods: { maxhp: 10, regen: 1, startStats: { regen: 1 } } },
  };

  /* ---------- 영구 강화 (상점) ---------- */
  const SHOP = [
    { id: 'hp',     icon: '❤️', name: '튼튼한 체력',   max: 5, base: 40, per: 10,   fmt: (v) => `체력 +${v}` },
    { id: 'dmg',    icon: '💪', name: '단련된 필기',   max: 5, base: 50, per: 0.06, fmt: (v) => `공격력 +${Math.round(v * 100)}%` },
    { id: 'speed',  icon: '👟', name: '가벼운 발걸음', max: 5, base: 40, per: 0.04, fmt: (v) => `이동속도 +${Math.round(v * 100)}%` },
    { id: 'magnet', icon: '🧲', name: '넓은 자석',     max: 5, base: 30, per: 8,    fmt: (v) => `구슬 흡수 범위 +${v}` },
    { id: 'xp',     icon: '📚', name: '빠른 습득',     max: 5, base: 60, per: 0.08, fmt: (v) => `경험치 +${Math.round(v * 100)}%` },
    { id: 'regen',  icon: '🍱', name: '든든한 도시락', max: 5, base: 70, per: 0.4,  fmt: (v) => `체력 재생 +${v.toFixed(1)}/초` },
    { id: 'echo',   icon: '👻', name: '에코 단련',     max: 5, base: 80, per: 0.05, fmt: (v) => `에코 공격력 +${Math.round(v * 100)}%` },
    { id: 'coin',   icon: '🎓', name: '장학금',        max: 5, base: 90, per: 0.10, fmt: (v) => `학점 획득 +${Math.round(v * 100)}%` },
  ];
  const SHOP_BY_ID = {}; SHOP.forEach((s) => { SHOP_BY_ID[s.id] = s; });

  function shopCost(id, level) { return Math.round(SHOP_BY_ID[id].base * Math.pow(1.7, level)); }

  /* ---------- 도전 과제 ---------- */
  // test(stats, run): stats는 이번 판 반영 후 누적 통계
  const ACHIEVEMENTS = [
    { id: 'first_run',  icon: '🎒', name: '첫 등교',       desc: '게임을 1판 플레이',           reward: 20,  test: (s) => s.runs >= 1 },
    { id: 'runs_10',    icon: '📅', name: '개근상',        desc: '10판 플레이',                 reward: 60,  test: (s) => s.runs >= 10 },
    { id: 'kills_100',  icon: '🗑️', name: '숙제 정리',     desc: '누적 100마리 처치',           reward: 40,  test: (s) => s.kills >= 100 },
    { id: 'kills_1000', icon: '🧹', name: '대청소',        desc: '누적 1000마리 처치',          reward: 150, test: (s) => s.kills >= 1000 },
    { id: 'survive_60', icon: '⏱️', name: '1분 버티기',    desc: '한 판에서 60초 생존',         reward: 40,  test: (s) => s.bestTime >= 60 },
    { id: 'survive_90', icon: '🕰️', name: '90초의 벽',     desc: '한 판에서 90초 생존 (보스 등장)', reward: 80,  test: (s) => s.bestTime >= 90 },
    { id: 'level_10',   icon: '📈', name: '우등생',        desc: '한 판에서 Lv 10 달성',        reward: 50,  test: (s) => s.bestLevel >= 10 },
    { id: 'level_20',   icon: '🏅', name: '수석',          desc: '한 판에서 Lv 20 달성',        reward: 120, test: (s) => s.bestLevel >= 20 },
    { id: 'clear_1',    icon: '📚', name: '기말고사 격파', desc: '보스 "기말고사" 처치',        reward: 200, test: (s) => s.clears >= 1 },
    { id: 'clear_5',    icon: '🎖️', name: '졸업 준비',     desc: '보스를 5번 처치',             reward: 400, test: (s) => s.clears >= 5 },
    { id: 'clear_academy', icon: '📖', name: '수능 만점',     desc: '학원 월드의 보스 "수능" 처치',       reward: 300, test: (s, run, sv) => !!sv && (sv.worlds.clears.academy || 0) >= 1 },
    { id: 'clear_office',  icon: '🏢', name: '승진',          desc: '회사 월드의 보스 "인사평가" 처치',   reward: 500, test: (s, run, sv) => !!sv && (sv.worlds.clears.office || 0) >= 1 },
    { id: 'clear_subway',  icon: '🚇', name: '퇴근 성공!',    desc: '지하철 월드의 보스 "급행열차" 처치', reward: 800, test: (s, run, sv) => !!sv && (sv.worlds.clears.subway || 0) >= 1 },
    { id: 'echo_5',     icon: '👻', name: '유령 친구들',   desc: '에코 5명과 함께 플레이',      reward: 80,  test: (s, run) => !!run && run.echoes >= 5 },
    { id: 'echo_10',    icon: '👥', name: '유령 반 편성',  desc: '에코 10명과 함께 플레이',     reward: 200, test: (s, run) => !!run && run.echoes >= 10 },
  ];

  /* ---------- 일일 미션 ---------- */
  // kind: sum(누적) | max(한 판 최고) | count(횟수)
  const MISSION_TEMPLATES = [
    { id: 'kills',   kind: 'sum', field: 'kills',   targets: [[60, 30], [120, 55], [200, 90]],  text: (t) => `적 ${t}마리 처치` },
    { id: 'gems',    kind: 'sum', field: 'gems',    targets: [[40, 30], [80, 50], [140, 80]],   text: (t) => `구슬 ${t}개 획득` },
    { id: 'survive', kind: 'max', field: 'seconds', targets: [[45, 30], [75, 55], [100, 90]],   text: (t) => `한 판에서 ${t}초 생존` },
    { id: 'level',   kind: 'max', field: 'level',   targets: [[6, 30], [10, 55], [15, 90]],     text: (t) => `한 판에서 Lv ${t} 달성` },
    { id: 'clear',   kind: 'sum', field: 'clear',   targets: [[1, 120]],                        text: () => '보스 "기말고사" 처치' },
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
      stats: { runs: 0, kills: 0, gems: 0, clears: 0, bestTime: 0, bestLevel: 0, totalCoins: 0 },
      ach: {},                                    // id -> true
      daily: { date: '', missions: [] },
      worlds: { selected: 'school', clears: {}, best: {} },   // 월드별 보스 격파 횟수 / 최장 생존(초)
    };
  }

  const isNum = (x) => typeof x === 'number' && isFinite(x);

  /** 어떤 입력이 와도 안전한 저장 객체로 정리 */
  function sanitize(raw) {
    const d = defaultSave();
    if (!raw || typeof raw !== 'object') return d;
    if (isNum(raw.coins) && raw.coins >= 0) d.coins = Math.floor(raw.coins);
    if (raw.shop && typeof raw.shop === 'object') {
      for (const it of SHOP) { const lv = raw.shop[it.id]; if (isNum(lv)) d.shop[it.id] = Math.max(0, Math.min(it.max, Math.floor(lv))); }
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
    if (raw.worlds && typeof raw.worlds === 'object') {
      for (const id of WORLD_ORDER) {
        if (raw.worlds.clears && isNum(raw.worlds.clears[id]) && raw.worlds.clears[id] > 0) d.worlds.clears[id] = Math.floor(raw.worlds.clears[id]);
        if (raw.worlds.best && isNum(raw.worlds.best[id]) && raw.worlds.best[id] > 0) d.worlds.best[id] = raw.worlds.best[id];
      }
      if (WORLDS[raw.worlds.selected] && worldUnlocked(d, raw.worlds.selected)) d.worlds.selected = raw.worlds.selected;
    }
    return d;
  }

  /* ---------- 월드 ---------- */
  /** 학교는 항상 열려 있고, 나머지는 바로 앞 월드의 보스를 한 번 이상 격파하면 열린다 */
  function worldUnlocked(save, id) {
    const w = WORLDS[id];
    if (!w) return false;
    if (!w.unlock) return true;
    return (save.worlds.clears[w.unlock.world] || 0) >= 1;
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
    return {
      maxhp: lv('hp') + (mods.maxhp || 0),
      dmgMul: (1 + lv('dmg')) * (mods.dmgMul || 1),
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

  /* ---------- 구매/선택 ---------- */
  function buyUpgrade(save, id) {
    const it = SHOP_BY_ID[id];
    if (!it) return { ok: false, reason: 'unknown' };
    const lv = shopLevel(save, id);
    if (lv >= it.max) return { ok: false, reason: 'max' };
    const cost = shopCost(id, lv);
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
  function selectCharacter(save, id) {
    if (save.chars.unlocked.indexOf(id) < 0) return false;
    save.chars.selected = id; return true;
  }

  /* ---------- 한 판 결과 반영 ---------- */
  /** run: {kills, seconds, level, result:'dead'|'survive'|'clear', gems, echoes, world}
   *  @returns {{earned:number, base:number, total:number, newAch:Array, missionsDone:Array, newWorld:string|null}} */
  function recordRun(save, run, today) {
    // 날짜가 바뀌면 오늘의 미션 갱신
    if (save.daily.date !== today) save.daily = { date: today, missions: dailyMissions(today) };

    const worldId = WORLDS[run.world] ? run.world : 'school';
    const unlockedBefore = WORLD_ORDER.filter((w) => worldUnlocked(save, w));
    const st = save.stats;
    st.runs += 1; st.kills += run.kills; st.gems += run.gems || 0;
    if (run.result === 'clear') st.clears += 1;
    st.bestTime = Math.max(st.bestTime, run.seconds);
    st.bestLevel = Math.max(st.bestLevel, run.level);
    if (run.result === 'clear') save.worlds.clears[worldId] = (save.worlds.clears[worldId] || 0) + 1;
    save.worlds.best[worldId] = Math.max(save.worlds.best[worldId] || 0, run.seconds);

    // 기본 보상
    const base = Math.floor(run.kills * 0.4 + run.seconds * 0.5 + run.level * 3 + (run.result === 'clear' ? 100 : run.seconds >= 120 ? 40 : 0));
    const earned = Math.round(base * coinMul(save) * WORLDS[worldId].coinMul);
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
    const newWorld = WORLD_ORDER.find((w) => worldUnlocked(save, w) && unlockedBefore.indexOf(w) < 0) || null;
    return { earned, base, total, newAch, missionsDone, newWorld };
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
  function exportCode(save) { return 'ECHO1:' + b64enc(JSON.stringify(save)); }
  /** @returns {object|null} 정리된 저장 객체. 형식이 틀리면 null */
  function importCode(code) {
    try {
      const c = String(code || '').trim();
      if (c.indexOf('ECHO1:') !== 0) return null;
      const raw = JSON.parse(b64dec(c.slice(6)));
      if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) return null;
      return sanitize(raw);
    } catch (e) { return null; }
  }

  const api = {
    SAVE_KEY, CHARACTERS, SHOP, ACHIEVEMENTS, MISSION_TEMPLATES, WORLDS, WORLD_ORDER, worldUnlocked, selectWorld,
    shopCost, shopLevel, dailyMissions, missionText, defaultSave, sanitize, load, persist,
    bonusFor, coinMul, buyUpgrade, unlockCharacter, selectCharacter, recordRun, exportCode, importCode,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Meta = api;
})(typeof window !== 'undefined' ? window : globalThis);
