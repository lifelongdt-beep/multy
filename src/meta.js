/* Echo Rush — 메타 진행 (재화·영구 강화·캐릭터·도전 과제·일일 미션·저장)
 * DOM 의존 없음. 저장소(storage)와 날짜는 인자로 받아 테스트 가능.
 */
(function (root) {
  'use strict';

  const Worlds = (typeof module !== 'undefined' && module.exports) ? require('./worlds.js') : root.EchoWorlds;
  const WORLDS = Worlds.WORLDS, WORLD_ORDER = Worlds.ORDER, GEAR = Worlds.GEAR;

  const SAVE_KEY = 'echo-meta-v1';
  const SAVE_VERSION = 1;

  /* ---------- 캐릭터 ---------- */
  // mods: maxhp(+), dmgMul, speedMul, cooldownMul(<1이 빠름), regen(초당), magnet(+), xpMul, echoPower(+), startStats(시작 아이템 레벨)
  // rarity: common 일반 · rare 희귀 · hero 영웅 · legend 전설. req: 학점 말고도 갖춰야 할 조건 (업적)
  const visited = (w) => (sv) => ((sv.worlds && sv.worlds.clears) || {})[w] >= 1;
  const CHARACTERS = {
    student:  { id: 'student',  emoji: '🧑‍🎓', name: '학생',       rarity: 'common', cost: 0,
                desc: '균형 잡힌 기본 캐릭터 · 레벨마다 체력 +6, 공격 +4%', mods: { maxhp: 6, dmgMul: 1.04 }, lvOnly: true },
    athlete:  { id: 'athlete',  emoji: '🏃',   name: '운동부',     rarity: 'common', cost: 2000,
                desc: '체력 +20, 이동 +15%, 공격 간격 +10% · 운동화 시작', mods: { maxhp: 20, speedMul: 1.15, cooldownMul: 1.1, startStats: { speed: 1 } } },
    genius:   { id: 'genius',   emoji: '🤓',   name: '독서부',     rarity: 'common', cost: 4000,
                desc: '공격 +25%, 체력 -20 · 시험 만점(치명타) 시작', mods: { maxhp: -20, dmgMul: 1.25, startStats: { crit: 1 } } },
    nurse:    { id: 'nurse',    emoji: '🧑‍⚕️', name: '보건 도우미', rarity: 'common', cost: 6500,
                desc: '체력 +10, 초당 재생 +0.7 · 급식 시간 시작', mods: { maxhp: 10, regen: 0.7, startStats: { regen: 1 } } },
    artist:   { id: 'artist',   emoji: '🎨',   name: '미술부',     rarity: 'rare',   cost: 12000,
                desc: '구슬 흡수 범위 +40, 경험치 +15% · 자석 필통 시작', mods: { magnet: 40, xpMul: 1.15, startStats: { magnet: 1 } },
                req: { text: '📖 학원 극복', test: visited('academy') } },
    caster:   { id: 'caster',   emoji: '🎤',   name: '방송부',     rarity: 'rare',   cost: 15000,
                desc: '에코 공격 +20% · 에코 응원 시작', mods: { echoPower: 0.2, startStats: { echo: 1 } },
                req: { text: '💛 선행 점수 40', test: (sv) => deedScore(sv) >= 40 } },
    cook:     { id: 'cook',     emoji: '🧑‍🍳', name: '요리부',     rarity: 'rare',   cost: 18000,
                desc: '체력 +35, 재생 +0.4, 이동 -5%', mods: { maxhp: 35, regen: 0.4, speedMul: 0.95 },
                req: { text: '🎮 30판 플레이', test: (sv) => sv.stats.runs >= 30 } },
    scientist:{ id: 'scientist',emoji: '🧑‍🔬', name: '과학부',     rarity: 'rare',   cost: 22000,
                desc: '공격 간격 -12%, 체력 -10 · 관통 시작', mods: { cooldownMul: 0.88, maxhp: -10, startStats: { pierce: 1 } },
                req: { text: '💼 회사 극복', test: visited('office') } },
    president:{ id: 'president',emoji: '🏅',   name: '학생회장',   rarity: 'hero',   cost: 60000,
                desc: '공격 +15%, 에코 공격 +15%, 체력 +15', mods: { dmgMul: 1.15, echoPower: 0.15, maxhp: 15 },
                req: { text: '🔁 2회차 열기', test: (sv) => topCycle(sv) >= 1 } },
    explorer: { id: 'explorer', emoji: '🧭',   name: '탐험가',     rarity: 'hero',   cost: 80000,
                desc: '이동 +20%, 흡수 범위 +30, 경험치 +10% · 운동화 시작', mods: { speedMul: 1.2, magnet: 30, xpMul: 1.1, startStats: { speed: 1 } },
                req: { text: '🏖️ 바닷가 극복', test: visited('beach') } },
    hero:     { id: 'hero',     emoji: '🦸',   name: '모두의 영웅', rarity: 'legend', cost: 300000,
                desc: '공격 +20%, 체력 +30, 재생 +0.5, 에코 공격 +20%', mods: { dmgMul: 1.2, maxhp: 30, regen: 0.5, echoPower: 0.2 },
                req: { text: '🎭 꿈의 무대 극복 · ☀️ 선행 250', test: (sv) => visited('stage')(sv) && deedScore(sv) >= 250 } },
    star:     { id: 'star',     emoji: '🌟',   name: '전설의 나',   rarity: 'legend', cost: 800000,
                desc: '모든 능력 조금씩 + 공격 간격 -10% · 시험 만점·에코 응원 시작', mods: { dmgMul: 1.15, maxhp: 20, speedMul: 1.1, cooldownMul: 0.9, magnet: 20, xpMul: 1.1, echoPower: 0.15, startStats: { crit: 1, echo: 1 } },
                req: { text: '🔁 3회차 열기', test: (sv) => topCycle(sv) >= 2 } },
  };
  const RARITY = { common: { name: '일반', color: '#9fb3c8' }, rare: { name: '희귀', color: '#4fc3f7' }, hero: { name: '영웅', color: '#b388ff' }, legend: { name: '전설', color: '#ffd54f' } };
  const CHAR_MAX_LV = 5;
  /** 주인공 옷 색 (게임 화면의 신호색과 겹치지 않게: 초록=나 · 빨강/분홍=방해 요소 · 하늘=에코 · 노랑=도와줄 사람 은 뺐다) */
  const KID_COLORS = [
    { id: 'blue',   name: '파랑',   hex: '#4561d6' },
    { id: 'purple', name: '보라',   hex: '#7e57c2' },
    { id: 'orange', name: '주황',   hex: '#ef7d32' },
    { id: 'navy',   name: '남색',   hex: '#2b3a73' },
    { id: 'white',  name: '하양',   hex: '#e6e9f0' },
    { id: 'brown',  name: '갈색',   hex: '#7a5643' },
  ];
  /** 주인공 얼굴(피부) 색 */
  const KID_SKINS = [
    { id: 'peach',  name: '살구',     hex: '#ffd9b8' },
    { id: 'light',  name: '밝은 색',  hex: '#ffe8d6' },
    { id: 'tan',    name: '구릿빛',   hex: '#e5ad7f' },
    { id: 'brown',  name: '갈색',     hex: '#b5774c' },
    { id: 'deep',   name: '진한 갈색', hex: '#7c4d30' },
  ];
  /** 에코(과거의 나) 모습: 사람 유령 대신 귀여운 동료 하나로. 학점을 써서 순서대로 하나씩 연다 (첫 번째는 기본) */
  const ECHO_FORMS = [
    { id: 'star',     name: '기억 별',   desc: '지난 도전이 작은 별이 되어 함께해요' },
    { id: 'bird',     name: '메아리 새', desc: '내 움직임을 메아리처럼 따라 하는 새' },
    { id: 'robot',    name: '기록 로봇', desc: '지난 판을 기록했다가 다시 재생해요' },
    { id: 'firefly',  name: '반딧불',   desc: '지난 노력이 작은 빛이 되어 날아요' },
    { id: 'chick',    name: '병아리',   desc: '삐약삐약, 처음 마음을 잊지 않는 병아리' },
    { id: 'cat',      name: '아기 고양이', desc: '살금살금 곁을 지켜 주는 고양이' },
    { id: 'puppy',    name: '강아지',   desc: '꼬리를 흔들며 끝까지 따라와요' },
    { id: 'bunny',    name: '토끼',     desc: '깡총깡총, 긴 귀로 위험을 먼저 들어요' },
    { id: 'hamster',  name: '햄스터',   desc: '볼 가득 용기를 모아 와요' },
    { id: 'penguin',  name: '아기 펭귄', desc: '뒤뚱뒤뚱해도 포기하지 않아요' },
    { id: 'bear',     name: '아기 곰',   desc: '든든하고 포근한 곰' },
    { id: 'owl',      name: '부엉이',   desc: '지난 판에서 배운 지혜를 알려 줘요' },
    { id: 'squirrel', name: '다람쥐',   desc: '큰 꼬리에 지난 기억을 모아 둬요' },
    { id: 'fox',      name: '아기 여우', desc: '재치 있게 길을 찾아 줘요' },
    { id: 'panda',    name: '판다',     desc: '느긋하지만 힘이 센 판다' },
    { id: 'koala',    name: '코알라',   desc: '꼭 붙어서 응원해 줘요' },
    { id: 'whale',    name: '아기 고래', desc: '물을 뿜으며 둥실둥실 헤엄쳐요' },
    { id: 'dino',     name: '아기 공룡', desc: '작아도 씩씩한 공룡' },
    { id: 'dragon',   name: '꼬마 용',   desc: '작은 날개로 힘껏 날아요' },
    { id: 'ufo',      name: '꼬마 UFO', desc: '먼 미래에서 온 듯한 비행접시' },
  ];
  /** i번째(0부터) 에코 모습을 여는 데 드는 학점 (첫 번째는 무료).
   *  기본 곡선(150i + 40i²)에 배율을 곱한다: 두 번째는 3배에서 시작해 점점 커져 마지막은 100배 (약 173만 학점).
   *  보기 좋게 앞 두 자리만 남겨 반올림 */
  const ECHO_COST_MUL0 = 3, ECHO_COST_MUL1 = 100;
  function echoFormCost(i) {
    if (i <= 0) return 0;
    const last = ECHO_FORMS.length - 1, base = 150 * i + 40 * i * i;
    const mul = ECHO_COST_MUL0 * Math.pow(ECHO_COST_MUL1 / ECHO_COST_MUL0, (Math.min(i, last) - 1) / Math.max(1, last - 1));
    const v = base * mul, unit = Math.pow(10, Math.max(1, Math.floor(Math.log10(v)) - 1));
    return Math.round(v / unit) * unit;
  }
  /** i번째 에코 모습의 힘: 뒤에 열수록 에코 공격력이 조금씩 강해진다 (한 단계 +2%, 마지막 +38%). 월드·회차가 어려워지는 만큼 천천히 */
  const ECHO_FORM_STEP = 0.02;
  function echoFormPower(i) { return Math.max(0, i) * ECHO_FORM_STEP; }
  function echoFormIndex(id) { return Math.max(0, ECHO_FORMS.findIndex((f) => f.id === id)); }
  function echoOwned(save) { return (save.echo && Array.isArray(save.echo.owned)) ? save.echo.owned : ['star']; }
  /** 다음에 열 수 있는 에코 모습 (순서대로 하나씩). 다 열었으면 null */
  function nextEchoForm(save) {
    const own = echoOwned(save);
    for (let i = 0; i < ECHO_FORMS.length; i++) if (own.indexOf(ECHO_FORMS[i].id) < 0) return { form: ECHO_FORMS[i], index: i, cost: echoFormCost(i) };
    return null;
  }
  function buyEchoForm(save) {
    const nx = nextEchoForm(save);
    if (!nx) return { ok: false, reason: 'all' };
    if (save.coins < nx.cost) return { ok: false, reason: 'coins', cost: nx.cost };
    save.coins -= nx.cost; save.echo.owned.push(nx.form.id); save.echo.pick = nx.form.id;   // 열자마자 입혀 보기
    return { ok: true, id: nx.form.id, cost: nx.cost };
  }
  function pickEchoForm(save, id) { if (echoOwned(save).indexOf(id) < 0) return false; save.echo.pick = id; return true; }
  function echoForm(save) { const p = save && save.echo && save.echo.pick; return echoOwned(save).indexOf(p) >= 0 ? p : 'star'; }
  /** 주인공 머리 색 (분홍·초록·하늘처럼 게임 신호색은 뺐다) */
  const KID_HAIRS = [
    { id: 'dark',   name: '흑갈색', hex: '#3b2b25' },
    { id: 'black',  name: '검정',   hex: '#1b1a22' },
    { id: 'brown',  name: '밤색',   hex: '#7a4a2c' },
    { id: 'blond',  name: '금발',   hex: '#e3bd57' },
    { id: 'auburn', name: '적갈색', hex: '#9c4a2a' },
    { id: 'silver', name: '은색',   hex: '#c7ccd6' },
  ];
  function kidHair(save) { const c = KID_HAIRS[save && save.hair]; return c && c.id !== 'dark' ? c.hex : null; }
  function kidSkin(save) { const c = KID_SKINS[save && save.skin]; return c && c.id !== 'peach' ? c.hex : null; }
  function kidColor(save) { const c = KID_COLORS[save && save.color]; return c ? c.hex : null; }
  /** 캐릭터 레벨: 좋은 효과(+)가 레벨마다 25%씩 강해진다 (나쁜 효과는 그대로). Lv3·Lv5에 시작 아이템 +1 */
  function charMods(save, id) {
    const c = CHARACTERS[id] || CHARACTERS.student, lv = charLevel(save, c.id), k = c.lvOnly ? lv - 1 : 1 + 0.25 * (lv - 1), m = c.mods, o = {};   // lvOnly: Lv2부터 레벨마다 효과
    for (const key of ['maxhp', 'regen', 'magnet', 'echoPower']) if (m[key]) o[key] = m[key] > 0 ? m[key] * k : m[key];
    for (const key of ['dmgMul', 'speedMul', 'xpMul']) if (m[key]) o[key] = m[key] > 1 ? 1 + (m[key] - 1) * k : m[key];
    if (m.cooldownMul) o.cooldownMul = m.cooldownMul < 1 ? 1 - (1 - m.cooldownMul) * k : m.cooldownMul;
    const ss = Object.assign({}, m.startStats || {}), extra = (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
    if (extra && !c.lvOnly) { const first = Object.keys(ss)[0] || 'dmg'; ss[first] = (ss[first] || 0) + extra; }
    o.startStats = ss;
    return o;
  }
  function charLevel(save, id) { return save.chars.unlocked.indexOf(id) < 0 ? 0 : Math.max(1, Math.min(CHAR_MAX_LV, (save.chars.levels || {})[id] || 1)); }
  /** 레벨 올리는 값: 캐릭터 값(기본 1500)의 40% x 레벨, 회차가 높을수록 그 회차 수입만큼 비싸짐 */
  function charLevelCost(save, id) {
    const c = CHARACTERS[id], lv = charLevel(save, id);
    return Math.round(Math.max(1500, c.cost) * 0.4 * lv * Worlds.rewardMul('school', topCycle(save)));
  }
  function charReqMet(save, id) { const c = CHARACTERS[id]; return !c.req || !!c.req.test(save); }
  function levelUpCharacter(save, id) {
    const lv = charLevel(save, id);
    if (!lv) return { ok: false, reason: 'locked' };
    if (lv >= CHAR_MAX_LV) return { ok: false, reason: 'max' };
    const cost = charLevelCost(save, id);
    if (save.coins < cost) return { ok: false, reason: 'coins', cost };
    save.coins -= cost; save.chars.levels = save.chars.levels || {}; save.chars.levels[id] = lv + 1;
    return { ok: true, cost, level: lv + 1 };
  }


  /* ---------- 영구 강화 (상점) ---------- */
  const SHOP = [
    { id: 'hp',     icon: '❤️', name: '튼튼한 체력',   max: 5, grow: true, base: 240, per: 7,    fmt: (v) => `체력 +${v}` },
    { id: 'dmg',    icon: '💪', name: '단련된 필기',   max: 5, grow: true, base: 300, per: 0.06, fmt: (v) => `공격력 +${Math.round(v * 100)}%` },
    { id: 'speed',  icon: '👟', name: '가벼운 발걸음', max: 5, base: 240, per: 0.04, fmt: (v) => `이동속도 +${Math.round(v * 100)}%` },
    { id: 'magnet', icon: '🧲', name: '넓은 자석',     max: 5, base: 180, per: 8,    fmt: (v) => `구슬 흡수 범위 +${v}` },
    { id: 'xp',     icon: '📚', name: '빠른 습득',     max: 5, base: 360, per: 0.08, fmt: (v) => `경험치 +${Math.round(v * 100)}%` },
    { id: 'regen',  icon: '🍱', name: '든든한 도시락', max: 5, grow: true, base: 420, per: 0.25,  fmt: (v) => `체력 재생 +${v.toFixed(1)}/초` },
    { id: 'echo',   icon: '👻', name: '에코 단련',     max: 5, grow: true, base: 480, per: 0.05, fmt: (v) => `에코 공격력 +${Math.round(v * 100)}%` },
    { id: 'coin',   icon: '🎓', name: '장학금',        max: 5, base: 540, per: 0.10, fmt: (v) => `학점 획득 +${Math.round(v * 100)}%` },
  ];
  const SHOP_BY_ID = {}; SHOP.forEach((s) => { SHOP_BY_ID[s.id] = s; });

  /** 기본 강화 가격: 회차마다 그 회차 수입만큼 비싸진다 (학교 단계의 학점 배율). 레벨은 5개 묶음마다 다시 기본가부터 */
  /** 가격: Lv5까지는 x1.85씩, 그 뒤로는 x1.15씩 오른다 (Lv30 근처에서 더는 안 오름) · 회차 수입만큼 비싸짐 */
  function shopCost(id, level, cycle) { return Math.round(SHOP_BY_ID[id].base * Math.pow(1.85, Math.min(level, 4)) * Math.pow(1.15, Math.min(25, Math.max(0, level - 4))) * Worlds.rewardMul('school', cycle || 0)); }
  const SHOP_CAP = 30;
  /** 효과: 키울 수 있는 강화(체력·공격·재생·에코)는 레벨마다 그대로, 나머지(이동·자석·경험치·장학금)는 Lv5 뒤로 1/4씩 */
  function shopEffect(id, lv) { const it = SHOP_BY_ID[id]; return it.grow ? it.per * lv : it.per * (Math.min(lv, it.max) + Math.max(0, lv - it.max) * 0.25); }
  /** 최대 레벨: 체력·공격력·재생·에코처럼 계속 키울 수 있는 강화는 회차마다 +5 */
  function shopMax(save, id) { const it = SHOP_BY_ID[id]; return it.grow ? Math.max(SHOP_CAP, it.max * (Math.min(9999, topCycle(save)) + 1)) : SHOP_CAP; }
  /** 지금까지 열린 가장 높은 회차 (장비·강화의 최대 레벨과 가격은 이 기준: 낮은 회차로 돌아가도 그대로) */
  /** 입고 있는 복장의 회차: 골라 입은 복장이 있으면 그것, 아니면 지금 회차 복장 */
  function outfitCycle(save) { const p = save.outfitPick; return isNum(p) && p >= 0 && p <= topCycle(save) ? p : (save.cycle || 0); }
  /** 얻은 복장 중 하나 입기 (null이면 회차 복장 자동) */
  function pickOutfit(save, c) { if (c === null) { save.outfitPick = null; return true; } c = Math.floor(c); if (!(c >= 0 && c <= topCycle(save))) return false; save.outfitPick = c; return true; }
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
    { id: 'survive_60', icon: '⏱️', name: '1분 버티기',    desc: '한 판에서 60초 생존',         reward: 40,  test: (s) => s.bestTime >= 60 },
    { id: 'survive_90', icon: '🕰️', name: '100초의 벽',    desc: '한 판에서 100초 생존 (보스 등장)', reward: 80,  test: (s) => s.bestTime >= 100 },
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
    { id: 'survive', kind: 'max', field: 'seconds', targets: [[60, 30], [90, 55], [120, 90]],   text: (t) => `한 판에서 ${t}초 생존` },
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
  /** 미션 하나를 끝내면 바로 새 미션이 생긴다 (끝없이). 끝낼수록 목표·보상이 조금씩 커진다 */
  function nextMission(save) {
    const made = save.daily.made = (save.daily.made || 0) + 1;
    const r = prng(hashStr('more:' + save.daily.date + ':' + made));
    const active = save.daily.missions.filter((m) => !m.done).map((m) => m.id);
    const pool = MISSION_TEMPLATES.filter((t) => active.indexOf(t.id) < 0);
    const t = pool[Math.floor(r() * pool.length)] || MISSION_TEMPLATES[0];
    const tier = Math.min(t.targets.length - 1, Math.floor(made / 4) + (r() < 0.4 ? 1 : 0));
    const grow = 1 + Math.min(2, made * 0.08);   // 끝낼수록 목표·보상이 커짐 (최대 3배)
    const [target0, reward0] = t.targets[tier];
    const target = t.kind === 'max' || t.id === 'clear' || t.id === 'help' ? target0 : Math.round(target0 * grow);
    return { id: t.id, target, reward: Math.round(reward0 * grow), progress: 0, done: false };
  }
  /** 이미 끝난 미션이 목록에 남아 있으면(예전 저장) 완료 기록으로 옮기고 새 미션으로 바꾼다. 바뀌었으면 true */
  function refillMissions(save) {
    const done = save.daily.missions.filter((m) => m.done);
    if (!done.length) return false;
    save.daily.history = (save.daily.history || []).concat(done.map((m) => ({ id: m.id, target: m.target, reward: m.reward }))).slice(-8);
    save.daily.missions = save.daily.missions.map((m) => (m.done ? nextMission(save) : m));
    return true;
  }
  function missionText(m) { return MISSION_TEMPLATES.find((t) => t.id === m.id).text(m.target); }

  /* ---------- 저장 데이터 ---------- */
  function defaultSave() {
    return {
      v: SAVE_VERSION,
      coins: 0,
      shop: {},                                   // id -> level
      chars: { unlocked: ['student'], selected: 'student', levels: {} },   // levels: 캐릭터 레벨 (1~5)
      stats: { runs: 0, kills: 0, gems: 0, clears: 0, bestTime: 0, bestLevel: 0, totalCoins: 0, helped: 0 },
      ach: {},                                    // id -> true
      daily: { date: '', missions: [] },
      worlds: { selected: 'school', clears: {}, best: {}, cycleClears: {} },   // 월드별 극복 횟수(전체) / 최장 생존(초) / 이번 회차 극복 횟수
      tutorial: false,                            // 튜토리얼(에코 10명과 함께하는 첫 판)을 마쳤거나 건너뛰었는지
      gear: {},                                   // 월드 매점 장비 'world:atk|def' -> level
      cycle: 0,                                   // 지금 플레이하는 회차(0=1회차). 월드 메뉴에서 열린 회차 중 고를 수 있다
      maxCycle: 0,                                // 열린 가장 높은 회차. 12개 월드를 모두 극복하면 +1
      look: 'boy',                                // 주인공 모습: 'boy'(남자) | 'girl'(여자)
      color: null,                                // 옷 색: KID_COLORS 번호. null = 복장 원래 색
      skin: 0,                                    // 얼굴(피부) 색: KID_SKINS 번호
      hair: 0,                                    // 머리 색: KID_HAIRS 번호
      echo: { owned: ['star'], pick: 'star' },     // 에코 모습: 연 것들 · 고른 것
      outfitPick: null,                           // 골라 입은 복장(그 복장을 얻은 회차 번호). null = 지금 회차 복장 자동
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
      if (raw.chars.levels && typeof raw.chars.levels === 'object') for (const id of d.chars.unlocked) { const v = raw.chars.levels[id]; if (isNum(v) && v > 1) d.chars.levels[id] = Math.min(CHAR_MAX_LV, Math.floor(v)); }
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
      if (isNum(raw.daily.made) && raw.daily.made > 0) d.daily.made = Math.floor(raw.daily.made);
      if (Array.isArray(raw.daily.history)) d.daily.history = raw.daily.history.filter((m) => m && MISSION_TEMPLATES.some((t) => t.id === m.id) && isNum(m.target) && isNum(m.reward)).slice(-8).map((m) => ({ id: m.id, target: m.target, reward: m.reward }));
    }
    if (isNum(raw.cycle) && raw.cycle >= 0) d.cycle = Math.min(9999, Math.floor(raw.cycle));
    d.maxCycle = Math.max(d.cycle, isNum(raw.maxCycle) && raw.maxCycle >= 0 ? Math.min(9999, Math.floor(raw.maxCycle)) : 0);
    if (raw.look === 'girl') d.look = 'girl';
    if (raw.echo && typeof raw.echo === 'object') {
      const own = Array.isArray(raw.echo.owned) ? raw.echo.owned : [];
      d.echo.owned = ECHO_FORMS.map((f) => f.id).filter((id) => id === 'star' || own.indexOf(id) >= 0);
      if (d.echo.owned.indexOf(raw.echo.pick) >= 0) d.echo.pick = raw.echo.pick;
    }
    if (isNum(raw.hair) && raw.hair >= 0 && raw.hair < KID_HAIRS.length) d.hair = Math.floor(raw.hair);
    if (isNum(raw.skin) && raw.skin >= 0 && raw.skin < KID_SKINS.length) d.skin = Math.floor(raw.skin);
    if (isNum(raw.color) && raw.color >= 0 && raw.color < KID_COLORS.length) d.color = Math.floor(raw.color);
    if (isNum(raw.outfitPick) && raw.outfitPick >= 0 && raw.outfitPick <= d.maxCycle) d.outfitPick = Math.floor(raw.outfitPick);
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
    const lv = (id) => shopEffect(id, shopLevel(save, id));
    const mods = charMods(save, save.chars.selected);
    const gt = gearTotals(save);
    const teamMul = Math.pow(GEAR.atkPer, gt.atk);
    return {
      maxhp: lv('hp') + (mods.maxhp || 0),
      dmgMul: (1 + lv('dmg')) * (mods.dmgMul || 1) * teamMul,
      teamMul,                                     // 에코에게도 같은 장비 공격력
      takenMul: Math.pow(1 / GEAR.defPer, gt.def),
      speedMul: (1 + lv('speed')) * (mods.speedMul || 1),
      cooldownMul: mods.cooldownMul || 1,
      magnet: lv('magnet') + (mods.magnet || 0),
      xpMul: (1 + lv('xp')) * (mods.xpMul || 1),
      regen: lv('regen') + (mods.regen || 0),
      echoPower: lv('echo') + (mods.echoPower || 0) + echoFormPower(echoFormIndex(echoForm(save))),   // 고른 에코 모습의 힘 포함
      startStats: Object.assign({}, mods.startStats || {}),
    };
  }
  function coinMul(save) { return 1 + shopEffect('coin', shopLevel(save, 'coin')); }
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
    if (!charReqMet(save, id)) return { ok: false, reason: 'req', req: c.req.text };
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
    refillMissions(save);

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
    const base = Math.floor(run.kills * 0.4 + run.seconds * 0.5 + run.level * 3 + (run.result === 'clear' ? 100 : run.seconds >= 144 ? 40 : 0));
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
    // 끝낸 미션은 '완료 기록'으로 옮기고 그 자리에 새 미션 (끊임없이 새로 생김)
    if (missionsDone.length) {
      save.daily.history = (save.daily.history || []).concat(missionsDone.map((m) => ({ id: m.id, target: m.target, reward: m.reward }))).slice(-8);
      save.daily.missions = save.daily.missions.map((m) => (m.done ? nextMission(save) : m));
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
    shopCost, shopMax, shopEffect, shopLevel, dailyMissions, refillMissions, missionText, defaultSave, sanitize, load, persist,
    RARITY, CHAR_MAX_LV, KID_COLORS, kidColor, KID_SKINS, kidSkin, KID_HAIRS, kidHair, ECHO_FORMS, echoFormCost, echoFormPower, echoFormIndex, nextEchoForm, buyEchoForm, pickEchoForm, echoForm, charMods, charLevel, charLevelCost, charReqMet, levelUpCharacter,
    OUTFITS: Worlds.OUTFITS, outfitCycle, pickOutfit, topCycle, selectCycle, deedScore, titleOf, deedBook, takeVisitor, TITLES, DEED_KINDS, DEED_KIND_INFO,
    bonusFor, coinMul, buyUpgrade, unlockCharacter, selectCharacter, recordRun, exportCode, importCode, importBackup, packEcho, unpackEcho,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Meta = api;
})(typeof window !== 'undefined' ? window : globalThis);
