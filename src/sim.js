/* Echo Rush — 결정론적 시뮬레이션 코어 (DOM 의존 없음)
 * 고정 60Hz 타임스텝 + 시드 난수. 에코는 "이동 경로 + 강화 기록"만 저장하고
 * 매 틱 재생한다. (공격/피격은 현재 판의 적을 대상으로 실시간 계산)
 *
 * 1단계 확장: 적 7종 + 웨이브 표, 업그레이드 12종 + 시너지 4종,
 * 에코 규칙(체력/세대별 약화/난이도 연동), 보스 3페이즈, 이벤트 큐(사운드·연출용).
 */
(function (root) {
  'use strict';

  const Worlds = (typeof module !== 'undefined' && module.exports) ? require('./worlds.js') : root.EchoWorlds;
  const WORLDS = Worlds.WORLDS;

  const W = 360, H = 640;
  const TICK = 60;
  const PLAY_BOTTOM = H - 140;   // UI 전용: 이 아래를 '추천 조작 영역'으로 표시 (캐릭터 이동은 제한하지 않음)
  const RUN_TICKS = 144 * TICK;      // 한 판 144초
  const BOSS_TICK = 108 * TICK;
  const MAX_ECHOES = 10;  // 정원. 넘치면 가장 일찍 쓰러진 에코부터 퇴장
  const MAX_ENEMIES = 260;
  const OVERTIME_TICKS = 30 * TICK;   // 144초가 지나도 보스가 살아 있으면 최대 30초 연장 (에코 없이 버티기만으로는 못 넘게)
  const MAX_LEVEL = 5;

  /* ---- 밸런스 튜닝 값 (여기만 만지면 됨) ---- */
  const TUNING = {
    echoHp: 40,              // 에코 에너지: 적에게 닿거나 적 탄에 맞으면 줄고, 0이 되면 잠깐 사라졌다가 다시 나타남
    echoDownSec: 2,          // 에너지가 다 떨어진 에코가 사라져 있는 시간(초). 그동안 공격하지 않음
    echoInvTicks: 30,        // 에코가 맞은 뒤 다시 맞을 때까지 틱
    echoR: 10,               // 에코 피격 반지름
    echoBasePower: 1.0,      // 에코 기본 공격력 배율 (에코는 맞아도 사라지지 않고, 기록이 끝나는 시점에만 사라짐)
    echoAgeDecay: 0.05,      // 한 세대 오래될수록 공격력 -5%
    echoMinPower: 0.6,       // 최저 배율
    echoHpScale: 0.12,       // 에코 1명당 일반 적 체력 +12% (에코 화력 증가를 따라가도록, 10명이면 +120%)
    bossFloorMul: 0.5,       // 보스 최소 체력 = 정의 체력 x 0.5 (화력이 약해도 너무 물렁하지 않게)
    bossLaterFight: -0.2,    // n번째 보스일수록 목표 전투 시간 -20%씩 (여러 번 나오는 월드도 90초 안팎에 끝나게)
    bossLaterSpeed: 0.08,    // n번째 보스일수록 이동 +8%씩
    bossHitFactor: 0.5,      // 화력 추정 시 실제 명중률 보정
    rageRamp: 0.15,          // 격앙 이후 초당 피해 +15% (전투가 길어질수록 급격히 치명적 → 에코가 부족하면 못 버팀)
    rageMax: 6.0,
    enrageSec: 24,           // 보스전이 이 시간을 넘기면 보스가 거세짐 (피해 +40%, 이동 +25%)
    bossAtkMul: 1.25,        // 보스전 중 받는 피해 배율 (팽팽한 승부)
    refSoloFp: 40,           // [기준값] 보스가 나올 때 "평균적인 나"의 화력 추정치 (실측)
    refEchoFp: 47,           // [기준값] 에코 1명의 화력 추정치 (실측: 에코는 피하느라 쉬지 않고 쏨)
    bossAdaptExp: 0.9,       // 내 화력이 기준보다 세면 보스도 (비율)^0.9 만큼 단단해짐 (아이템만으로는 못 넘게)
    bossAdaptMin: 0.7, bossAdaptMax: 4,     // 상점·아이템으로 강해져도 보스가 거의 따라온다 → 큰 도전은 에코가 있어야 넘는다
    bossDmgExp: 0.8,         // 보스전 피해 배율 = (최대체력/기본체력)^0.8 (체력이 높을수록 한 방이 더 아프다)
    baseHp: 110,             // 기본 최대 체력
    orbDmg: 2.5,             // 형광펜 한 개 피해 (기본 공격 배수)
    orbDmgPer: 0.15,         //   형광펜이 하나 늘 때마다 한 개당 피해 +15%
    orbCd: 12,               //   형광펜 하나가 같은 적을 다시 때리기까지(틱)
    trainMinDmg: 60,         // 열차에 치이면 최소 이만큼, 또는 최대 체력의 trainHpFrac 중 큰 쪽 (치명적!)
    trainHpFrac: 0.6,
    dropMinDmg: 22,          // 떨어지는 물건(낙하물)에 맞으면 최소 이만큼, 또는 최대 체력의 dropHpFrac 중 큰 쪽
    dropHpFrac: 0.2,
    dropR: 34,               //   낙하 범위 반지름
    dropWarn: 66,            //   빨간 원 경고 시간(틱)
    bossHpMul: 1.3,          // 큰 도전(보스) 체력 추가 배율
    boonHealFrac: 0.5,       // 도우미의 "체력 회복" 카드: 최대 체력의 50%
    coffeeHeal: 12,
    bossRegenMul: 0.4,       // 보스전 중 체력 재생 배율
    bossBreatherHeal: 0.25,  // 보스 한 번 극복할 때마다 체력 회복 비율 (마지막 보스 제외)
    bossGapSec: 4,           // 보스 극복 후 다음 보스가 나오기까지 최소 간격(초)
    hpGrowth: 1.6,           // 진행도에 따른 적 체력 증가
    healAmount: 35,
    // ---- 아이템(업그레이드) 1레벨당 효과 ----
    rateMul: 0.80,           // 발사 간격 x0.80 (이전 0.85)
    dmgPer: 0.5,             // 공격력 +50% (이전 35%)
    speedPer: 0.15,          // 이동속도 +15% (이전 12%)
    magnetPer: 30,           // 구슬 흡수 범위 +30 (이전 22)
    critPer: 0.14,           // 치명타 확률 +14% (이전 10%)
    critMul: 2.5,            // 치명타 피해 x2.5 (이전 x2)
    regenPer: 1.0,           // 급식 시간 1레벨당 체력 재생 +1.0/초
    echoBoostPer: 0.25,      // 에코 응원 +25% (이전 15%)
    damageTaken: 0.9,        // 플레이어가 받는 피해 배율 (낮출수록 쉬움)
    hurtInvTicks: 50,        // 피격 후 무적 시간(틱)
    enemySpeedGrowth: 0.15,  // 진행도에 따른 적 속도 증가
    // ---- 도우미(선생님 등) · 나중에 보상형 광고로 바꿀 자리 ----
    helperEvery: 30,         // 첫 등장(월드의 helper.t초) 뒤 이 간격(초)마다 다시 찾아옴 (앞 도우미가 떠난 뒤)
    helperNeed: 70,          // 곁에 이만큼(틱, 60=1초) 머물면 조언 카드 (이전 150틱=2.5초 → 약 1.2초)
    helperDecay: 1,          // 곁을 벗어나면 게이지가 틱당 이만큼 줄어듦 (이전 2: 잠깐 벗어나도 덜 깎임)
    helperStay: 7,           // 도우미가 기다려 주는 시간(초)
    choiceAutoSec: 3,
    // ---- 선행(좋은 일)을 하면 아이템 ----
    enemyLifeSec: 10,        // 일반 방해 요소는 이 시간(초)이 지나면 스르르 사라진다 (화면이 붐비지 않게). 보스·구조 대상 곁의 방해 요소는 제외
    enemyFadeTicks: 30,      //   사라지기 전 흐려지는 시간(틱)
    deedRescueFirst: 36,     // 어려움에 처한 사람: 첫 등장(초)
    deedRescueEvery: 50,     //   이후 간격(초)
    deedRescueGuards: 4,     //   둘러싼 방해 요소 수 (모두 물리치면 "고마워!" + 아이템 카드)
    deedRescueStay: 15,      //   기다려 주는 시간(초) — 못 도와줘도 벌은 없음
    deedEscortFirst: 68,     // 친구 지켜주기: 첫 등장(초)
    deedEscortEvery: 60,     //   이후 간격(초)
    friendHp: 100,           //   친구 체력 (방해 요소에 닿으면 줄어듦)
    friendSpeed: 0.75,       //   친구가 걷는 속도 (내가 곁에 있을 때만 걸음)
    friendWaitDist: 130,     //   이보다 멀면 친구가 무서워서 멈춰 기다림
    deedSpotEvery: 6,        // 작은 선행 거리(쓰레기·쓰러진 화분·떨어진 인형)가 생기는 간격(초)
    deedSpotMax: 2,
    deedSpotLife: 10,        //   사라지기까지(초)
    deedGaugeNeed: 4,        //   이만큼 모으면 아이템 카드
    allySec: 5,              // 도와준 사람이 손을 흔들고 안전한 곳(화면 밖)으로 떠나는 데 걸리는 최대 시간(초)
    allyWave: 95,            //   떠나기 전 제자리에서: 먼저 만세(앞 45틱) → 손 흔들어 인사(뒤 50틱)
    allySpeed: 1.5,          //   걸어서 떠나는 속도
    cheerSec: 12,            // 도와준 사람의 응원: 이 시간(초) 동안 나와 에코의 공격력이 오른다 (사람은 싸우지 않는다)
    cheerDmg: 0.2,           //   응원 공격력 +20%
    warmR: 150,              // 선행 순간 퍼지는 따뜻한 빛 반경
    warmSec: 3,              //   빛을 받은 방해 요소가 순해지는(느려지고 닿아도 아프지 않은) 시간(초)
    visitorSec: 3,           // 지난 판에 도와준 사람이 찾아오는 시각(초)
    visitorHeal: 0.35,       //   선물: 체력 회복 비율
    visitorGems: 8,          //   선물: 구슬 수        // 레벨업·조언 카드는 게임을 멈추지 않고, 이 시간 안에 안 고르면 자동으로 골라 준다
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const UPGRADES = [
    { id: 'rate',   icon: '✏️', name: '샤프 속도↑',  desc: '발사 간격 -20%' },
    { id: 'multi',  icon: '📕', name: '책 +1',        desc: '동시 발사 수 +1' },
    { id: 'dmg',    icon: '📝', name: '필기 강화',    desc: '공격력 +50%' },
    { id: 'speed',  icon: '👟', name: '운동화',        desc: '이동속도 +15%' },
    { id: 'magnet', icon: '🧲', name: '자석 필통',     desc: '구슬 흡수 범위 +' },
    { id: 'pierce', icon: '📍', name: '관통 샤프심',   desc: '관통 +1' },
    { id: 'crit',   icon: '💯', name: '시험 만점',     desc: '치명타 확률 +14% (피해 x2.5)' },
    { id: 'nova',   icon: '🔔', name: '종소리',        desc: '주기적으로 주변에 충격파' },
    { id: 'orbit',  icon: '🖍️', name: '형광펜',        desc: '몸 주위를 도는 형광펜 +1' },
    { id: 'regen',  icon: '🍱', name: '급식 시간',     desc: '체력 재생 +1.0/초' },
    { id: 'echo',   icon: '👻', name: '에코 응원',     desc: '모든 에코의 공격력·속도 +25%' },
    { id: 'heal',   icon: '🩹', name: '보건실',        desc: '체력 35 즉시 회복', instant: true },
  ];

  const SYNERGIES = {
    focus:    { name: '집중 필기',   desc: '샤프 속도 2+ & 필기 강화 2+ → 공격력 +30%' },
    shotgun:  { name: '관통 샷건',   desc: '책 2+ & 관통 1+ → 관통 +1' },
    exam:     { name: '만점 러시',   desc: '시험 만점 2+ & 샤프 속도 2+ → 치명타 +10%' },
    bellring: { name: '타종식',      desc: '형광펜 2+ & 종소리 1+ → 충격파 범위 +30%' },
  };

  // 월드 데이터는 worlds.js. 아래 상수들은 호환용(학교 월드 기준 / 모든 월드의 적 합집합)
  const SCHOOL = WORLDS.school;
  const ENEMY_TYPES = Object.assign({}, ...Object.keys(WORLDS).map((k) => WORLDS[k].enemies), { boss: SCHOOL.boss });
  const WAVES = SCHOOL.waves;
  const SWARMS = SCHOOL.swarms;

  /** 영구 강화·캐릭터 보너스(meta.js가 계산해서 전달). 기본값은 보너스 없음 */
  // teamMul: 매점 장비의 팀 공격력(에코에게도 적용, 플레이어 몫은 dmgMul에 이미 포함) · takenMul: 매점 장비의 받는 피해 배율
  const NO_BONUS = { maxhp: 0, dmgMul: 1, speedMul: 1, cooldownMul: 1, magnet: 0, xpMul: 1, regen: 0, echoPower: 0, teamMul: 1, takenMul: 1, startStats: {} };

  /** 총알 단계: 기본 위력(1) 대비 12% 강해질 때마다 1단계. 모양은 단계 % 30, 30단계마다 한 바퀴 */
  function bulletTier(dmg) { return Math.max(0, Math.floor(Math.log(Math.max(1, dmg)) / Math.log(1.12) + 1e-9)); }
  function derive(st, b) {
    b = b || NO_BONUS;
    const T = TUNING;
    const cooldown = 22 * Math.pow(T.rateMul, st.rate) * b.cooldownMul;
    const base = (1 + T.dmgPer * st.dmg) * b.dmgMul;
    let dmg = base;
    let pierce = st.pierce;
    let crit = T.critPer * st.crit;
    const syn = [];
    if (st.rate >= 2 && st.dmg >= 2) { dmg *= 1.3; syn.push('focus'); }
    if (st.multi >= 2 && st.pierce >= 1) { pierce += 1; syn.push('shotgun'); }
    if (st.crit >= 2 && st.rate >= 2) { crit += 0.1; syn.push('exam'); }
    let novaR = 70 + 14 * st.nova;
    if (st.orbit >= 2 && st.nova >= 1) { novaR *= 1.3; syn.push('bellring'); }
    return {
      cooldown: Math.max(5, Math.round(cooldown)),
      shots: 1 + st.multi,
      dmg,
      speed: 2.1 * (1 + T.speedPer * st.speed) * b.speedMul,
      magnet: 50 + T.magnetPer * st.magnet + b.magnet,
      pierce,
      crit: Math.min(0.9, crit),
      critMul: T.critMul,
      novaInt: st.nova > 0 ? Math.max(90, 280 - 45 * st.nova) : 0,
      novaR,
      novaDmg: (6 + 5 * st.nova) * base,
      orbN: st.orbit,
      orbDmg: TUNING.orbDmg * base * (1 + TUNING.orbDmgPer * Math.max(0, st.orbit - 1)),   // 하나 늘 때마다 한 개당 피해도 +15%
      orbR: 34 + 2.5 * Math.max(0, st.orbit - 1),   // 도는 거리도 34 → 최대 44
      regen: (T.regenPer * st.regen + b.regen) / TICK,
      syn,
    };
  }

  /** 에코 목록에 새 에코를 추가하고, 정원이 넘치면 "가장 일찍 쓰러진(ticks가 가장 작은) 에코"부터 내보낸다.
   *  동률이면 더 오래된 에코부터. 남은 에코는 시간순(오래된 것 → 최근)을 유지한다.
   *  @returns {{list:Array, removed:Array}} */
  function addEcho(list, echo, max) {
    const all = list.concat([echo]);
    const removed = [];
    while (all.length > max) {
      let worst = 0;
      for (let i = 1; i < all.length; i++) if (all[i].ticks < all[worst].ticks) worst = i;
      removed.push(all.splice(worst, 1)[0]);
    }
    return { list: all, removed };
  }

  function newStats() {
    return { rate: 0, multi: 0, dmg: 0, speed: 0, magnet: 0, pierce: 0, crit: 0, nova: 0, orbit: 0, regen: 0, echo: 0, heal: 0 };
  }

  class Sim {
    /** @param {{seed:number, echoes?:Array, events?:boolean, bonus?:object, world?:string, cycle?:number}} opts  echoes: [{path:number[], ups:[{t,id}]}]
     *  cycle: 회차(0부터). 월드 순서와 회차로 단계가 정해지고, 단계가 높을수록 적이 강하다(worlds.js의 stageMul) */
    constructor(opts) {
      this.seed = opts.seed >>> 0;
      this.rng = mulberry32(this.seed);
      this.emitOn = opts.events !== false;
      this.events = [];
      this.tick = 0;
      this.world = WORLDS[opts.world] || WORLDS.school;
      // 튜토리얼 등: 판을 extraSec초 더 길게 (왕·위험 요소 일정도 그만큼 뒤로 미뤄 천천히 배우게)
      const extra = Math.max(0, opts.extraSec | 0);
      this.runTicks = RUN_TICKS + extra * TICK;
      if (extra) this.world = Object.assign({}, this.world, { boss: Object.assign({}, this.world.boss, { times: this.world.boss.times.map((x) => x + extra) }) });
      this.cycle = Math.max(0, opts.cycle | 0);
      this.mul = Worlds.stageMul(this.world.id, this.cycle);   // {stage, hp, dmg, speed, spawn}
      this.helper = null;      // 도우미(선생님 등): {x,y,r,state,prog,need,t,stay,fade}
      this.helped = 0;         // 이번 판에 도움을 받은 횟수
      this.choiceKind = 'levelup';   // 'levelup' | 'helper' (선택창 종류)
      this.hazards = [];       // 지하철 열차 {y,h,x,dir,state,t,warn,speed,dmg}
      this.bonus = Object.assign({}, NO_BONUS, opts.bonus || {});
      const maxhp = Math.max(40, TUNING.baseHp + this.bonus.maxhp);
      this.player = {
        x: W / 2, y: H * 0.45, hp: maxhp, maxhp, r: 7, xp: 0, level: 1, need: 4,
        inv: 0, cd: 0, stats: newStats(), syn: {},
      };
      this.gemCount = 0;
      this.enemies = [];
      this.bullets = [];
      this.ebullets = [];      // 적 탄환
      this.orbs = [];          // 형광펜(렌더용, 매 틱 재계산)
      this.gems = [];
      this.fx = [];            // 렌더용 임시 이펙트 {x,y,t,kind}
      this.kills = 0;
      this.swarmIdx = 0;
      this.bossSpawned = false;
      this.bossDead = false;        // 모든 보스를 극복했을 때 true
      this.bossIdx = 0;             // 지금까지 등장시킨 보스 수
      this.bossAlive = false;
      this.bossDefeated = 0;
      this.bossCount = this.world.boss.times.length;
      this.bossLineup = this._makeLineup(opts.seed >>> 0);
      // 선행: 어려움에 처한 사람(rescue) · 친구 지켜주기(escort) · 작은 선행 거리(spots) + 게이지
      this.deeds = { rescue: null, escort: null, spots: [], gauge: 0, done: 0, people: [], spotCount: 0, escorts: 0, visitor: null, visitorKind: (opts.visitor && opts.visitor.kind) || null };
      this.cheer = 0;        // 응원 남은 시간(틱): 도와준 사람이 떠나며 남긴 응원으로 공격력 +
      this.allies = [];      // 도와준 사람들: 고맙다고 손을 흔들고 안전한 곳으로 떠난다 (싸우지 않음, 적 목록과 별개, 다치지 않음)
      this.drng = mulberry32(((opts.seed >>> 0) ^ 0xDEED5) >>> 0);   // 위치 정하기 전용 난수 (본 흐름과 분리)   // 이번 판에 나올 보스 정의들 (순서대로)
      this.lastBossDeath = 0;
      this.bossRage = 1;            // 보스전이 길어질수록 커지는 피해 배율
      this.over = false;
      this.result = null;      // 'dead' | 'clear' | 'survive'
      this.choices = null;     // 고를 카드(3택1). 게임은 멈추지 않고 계속 진행된다
      this.choiceT = 0;        // 카드가 뜬 뒤 지난 틱 (choiceAutoSec이 지나면 자동 선택)
      this.rec = { path: [], ups: [] };
      // 캐릭터의 시작 아이템: 에코도 똑같이 갖도록 t=0 업그레이드로 기록한다
      for (const id in (this.bonus.startStats || {})) {
        if (!(id in this.player.stats) || id === 'heal') continue;
        for (let k = 0; k < this.bonus.startStats[id]; k++) { this.player.stats[id] += 1; this.rec.ups.push({ t: 0, id }); }
      }
      for (const sid of derive(this.player.stats).syn) this.player.syn[sid] = true;
      const list = (opts.echoes || []).slice(-MAX_ECHOES);
      this.echoes = list.map((e, i) => ({
        path: e.path, ups: e.ups || [],
        x: e.path[0] || 0, y: e.path[1] || 0,
        cd: (i * 5) % 20, stats: newStats(), upIdx: 0, alive: true, id: i,
        hp: TUNING.echoHp, inv: 0, down: 0,   // down>0 이면 에너지가 떨어져 잠깐 사라진 상태
        // 오래된 에코일수록 약해진다 (가장 최근 에코 = 풀 파워)
        power: TUNING.echoBasePower * Math.max(TUNING.echoMinPower, 1 - TUNING.echoAgeDecay * (list.length - 1 - i)),
      }));
    }

    _ev(o) { if (this.emitOn) this.events.push(o); }
    drainEvents() { const e = this.events; this.events = []; return e; }

    choose(id) {
      if (!this.choices) return;
      const p = this.player;
      if (id.indexOf('boon_') === 0) {          // 도우미가 주는 조언 카드
        const k = id.slice(5);
        if (Worlds.BOONS[k]) this._ev({ k: 'gotItem', id, icon: Worlds.BOONS[k].icon });
        if (k === 'heal') { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * TUNING.boonHealFrac); this._ev({ k: 'heal' }); }
        else {
          const stat = { power: 'dmg', focus: 'rate', team: 'echo' }[k];
          if (stat) {
            p.stats[stat] += 1; this.rec.ups.push({ t: this.tick, id: stat });   // 에코도 같은 조언을 받는다
            for (const sid of derive(p.stats).syn) if (!p.syn[sid]) { p.syn[sid] = true; this._ev({ k: 'synergy', id: sid, name: SYNERGIES[sid].name }); }
          }
        }
        this.choices = null; this.choiceKind = 'levelup';
        return;
      }
      if (!this.choices.some((c) => c.id === id)) return;
      this._applyUpgrade(id);
      this.choices = null;
    }

    /** 레벨업 아이템 하나를 적용 (카드 선택·자동 선택 공용) */
    _applyUpgrade(id) {
      const p = this.player;
      const up = UPGRADES.find((u) => u.id === id);
      if (up) this._ev({ k: 'gotItem', id, icon: up.icon });   // 새로 얻은 아이템 (머리 위 반짝임용)
      if (up && up.instant) {
        p.hp = Math.min(p.maxhp, p.hp + TUNING.healAmount);
        this._ev({ k: 'heal' });
      } else {
        p.stats[id] += 1;
        for (const s of derive(p.stats).syn) {
          if (!p.syn[s]) { p.syn[s] = true; this._ev({ k: 'synergy', id: s, name: SYNERGIES[s].name }); }
        }
      }
      this.rec.ups.push({ t: this.tick, id });
    }

    /** 한 번에 여러 레벨이 오르면: 첫 레벨만 카드로 고르고, 나머지는 바로 자동 선택 */
    _levelUpAuto() {
      const picks = this._rollLevel();
      if (!picks.length) return;
      const pick = picks[0];
      this._applyUpgrade(pick.id);
      this._ev({ k: 'autoPick', id: pick.id, icon: pick.icon, name: pick.name });
    }

    _levelUp() {
      const picks = this._rollLevel();
      this._offer(picks, 'levelup');
      this._ev({ k: 'levelup' });
    }

    /** 레벨을 올리고 고를 카드 3장을 뽑는다 */
    _rollLevel() {
      const p = this.player;
      p.level += 1; p.xp -= p.need; p.need = Math.max(2, Math.round((4 + p.level * 2.8) * 0.7));   // 짧은 판에서도 비슷하게 성장
      return this._rollPicks();
    }
    /** 아이템 카드 3장 (레벨업·선행 보상 공용) */
    _rollPicks() {
      const p = this.player;
      const pool = UPGRADES.filter((u) => {
        if (u.instant) return p.hp <= p.maxhp * 0.9;
        return p.stats[u.id] < MAX_LEVEL;
      });
      const picks = [];
      for (let i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
      return picks;
    }

    /** 카드를 띄운다. 이미 떠 있는 카드가 있으면 먼저 자동으로 골라 준다(카드가 겹치지 않게) */
    _offer(list, kind) {
      if (this.choices) this._autoChoose();
      if (!list.length) return;
      this.choices = list; this.choiceKind = kind; this.choiceT = 0;
    }

    /** 시간 안에 안 고르면: 조언 카드는 체력이 절반 아래면 회복, 아니면 첫 카드. 레벨업은 첫 카드 */
    _autoChoose() {
      const c = this.choices;
      if (!c || !c.length) { this.choices = null; return; }
      let pick = c[0];
      if (this.choiceKind === 'helper' && this.player.hp < this.player.maxhp * 0.5) pick = c.find((x) => x.id === 'boon_heal') || pick;
      this.choose(pick.id);
      this._ev({ k: 'autoPick', id: pick.id, icon: pick.icon, name: pick.name });
    }

    /* ---------- 스폰 ---------- */
    /** 이 월드에서의 적 정의 (보스='boss'는 월드마다 다른 정의) */
    _def(type) {
      const w = this.world;
      return type === 'boss' ? w.boss : (w.enemies[type] || ENEMY_TYPES[type]);
    }

    /** 보스 순서: 1회차는 이 월드의 작은 큰 도전들(minis) → 마지막에 월드 보스 (꿈의 무대는 앞 월드 보스들 lineup → 무대 공포증),
     *  2회차부터는 12개 월드의 모든 큰 도전(월드 보스 + minis) 중 무작위(바로 앞과 같은 것은 피함). 난이도 값은 항상 이 월드 기준 */
    _makeLineup(seed) {
      const w = this.world, n = w.boss.times.length;
      let defs;
      if (this.cycle > 0) {
        const pool = Sim.bossPool();
        const r = mulberry32((seed ^ 0xB0551E5) >>> 0);   // 본 난수와 분리 (같은 시드면 같은 순서)
        defs = [];
        for (let i = 0; i < n; i++) {
          let d;
          do { d = pool[Math.floor(r() * pool.length)]; } while (i > 0 && d.name === defs[i - 1].name);
          defs.push(d);
        }
      } else if (w.boss.lineup) defs = w.boss.lineup.slice(0, n - 1).map((id) => WORLDS[id].boss).concat([w.boss]);
      else defs = (w.boss.minis || []).slice(0, n - 1).concat([w.boss]);
      while (defs.length < n) defs.unshift(w.boss);
      return defs.map((d) => this._adaptBoss(d));
    }
    /** 다른 큰 도전을 이 월드에 맞춰 데려온다: 모습·패턴·문구는 그 보스, 체력·피해·소환 등은 이 월드 기준 */
    _adaptBoss(d) {
      const own = this.world.boss;
      if (d === own) return own;
      return Object.assign({}, own, { name: d.name, emoji: d.emoji, pattern: d.pattern, warnText: d.warnText, startText: d.startText, r: d.r || own.r, lineup: undefined, minis: undefined, origin: d.origin || d.name });
    }
    _bossFrom(id) { return WORLDS[id] ? this._adaptBoss(WORLDS[id].boss) : this.world.boss; }
    _bossAt(idx) { return this.bossLineup[Math.max(0, Math.min(this.bossLineup.length - 1, idx | 0))]; }

    _hpScale() {
      const progress = this.tick / this.runTicks;
      return (1 + progress * TUNING.hpGrowth) * (1 + TUNING.echoHpScale * this.echoes.length) * (this.world.rules.hpMul || 1) * this.mul.hp;
    }

    /** 한 스탯 조합의 초당 피해 추정 (보스 체력 산정용) */
    _fp(stats, bonus, pm) {
      const d = derive(stats, bonus);
      const shots = d.shots * d.dmg * (60 / d.cooldown) * (1 + d.crit * (d.critMul - 1)) * (1 + Math.min(d.pierce, 3) * 0.15) * TUNING.bossHitFactor;
      const nova = d.novaInt ? d.novaDmg * (60 / d.novaInt) * 0.4 : 0;
      const orb = d.orbN * d.orbDmg * 5 * 0.3;
      return (shots + nova + orb) * pm;
    }

    /** 지금 플레이어 + 살아 있는 에코들의 화력 합 */
    _firepower() {
      const p = this.player;
      let sum = this._fp(p.stats, this.bonus, 1);
      const boost = (1 + TUNING.echoBoostPer * p.stats.echo) * (1 + this.bonus.echoPower) * this.bonus.teamMul;
      for (const ec of this.echoes) if (ec.alive) sum += this._fp(ec.stats, NO_BONUS, ec.power * boost);
      return sum;
    }

    /** 보스 체력 = (기준 화력: 나 1명 + 에코 needEchoes명) x 목표 전투 시간 x (내 화력/기준)^0.5.
     *  - 기준 화력 대비 에코가 부족하면 전투가 몇 배로 길어져 사실상 못 잡고, needEchoes명이 갖춰지면 목표 시간(fightSec)에 겨우 잡는다.
     *  - 에코의 화력은 체력에 반영되지 않는다(에코가 많을수록 쉬워짐). 내가 강해지면 보스는 절반만 따라서 단단해진다. */
    _bossHp(def, idx) {
      const T = TUNING, mul = (def.refMul || 1) * this.mul.hp;   // 단계가 높을수록 기준 화력(=권장 장비를 갖춘 나)도 높다
      const refSolo = T.refSoloFp * mul, refEcho = T.refEchoFp * mul;
      const base = (refSolo + def.needEchoes * refEcho) * def.fightSec * (1 + T.bossLaterFight * idx);
      const solo = this._fp(this.player.stats, this.bonus, 1);
      const adapt = Math.min(T.bossAdaptMax, Math.max(T.bossAdaptMin, Math.pow(solo / refSolo, T.bossAdaptExp)));
      return T.bossHpMul * (this.world.rules.bossHp || 1) * Math.max(def.hp * this.mul.hp * T.bossFloorMul * (1 + T.bossLaterFight * idx), base * adapt);
    }

    _make(type, x, y, idx) {
      const b = type === 'boss' ? this._bossAt(idx) : this._def(type);
      const progress = this.tick / this.runTicks;
      const hp = type === 'boss' ? this._bossHp(b, idx || 0) : b.hp * this._hpScale();
      const cdBase = b.fireCd || b.dashCd || 150;
      this.enemies.push({
        type, def: b, emoji: b.emoji, name: b.name, idx: idx || 0,
        label: type === 'boss' && this.bossCount > 1 ? `${b.name} ${(idx || 0) + 1}/${this.bossCount}` : b.name,
        x, y, hp, maxhp: hp, r: b.r, speed: b.speed * (1 + progress * TUNING.enemySpeedGrowth) * (this.world.rules.speedMul || 1) * this.mul.speed * (type === 'boss' ? 1 + TUNING.bossLaterSpeed * (idx || 0) : 1), dmg: b.dmg, xp: b.xp,
        flash: 0, cd: Math.round(cdBase * (0.4 + 0.6 * this.rng())), dashT: 0, dvx: 0, dvy: 0, warn: false,
        phase: 1, t: 0, cst: 0, cw: 0,
      });
    }

    _pickType(w) {
      let total = 0;
      for (const k in w) total += w[k];
      let roll = this.rng() * total;
      for (const k in w) { roll -= w[k]; if (roll < 0) return k; }
      return 'hw';
    }

    _spawn(wave) {
      if (this.enemies.length >= MAX_ENEMIES) return;
      const r = this.rng;
      const side = Math.floor(r() * 4);
      let x, y;
      if (side === 0) { x = r() * W; y = -12; }
      else if (side === 1) { x = W + 12; y = r() * H; }
      else if (side === 2) { x = r() * W; y = H + 12; }
      else { x = -12; y = r() * H; }
      this._make(this._pickType(wave.w), x, y);
    }

    _ring(s) {
      const p = this.player;
      for (let i = 0; i < s.n; i++) {
        if (this.enemies.length >= MAX_ENEMIES) break;
        const a = (i / s.n) * Math.PI * 2;
        this._make(s.type, p.x + Math.cos(a) * 360, p.y + Math.sin(a) * 360);
      }
      this._ev({ k: 'banner', text: '⚠ ' + s.text, hint: true }); this._ev({ k: 'swarm' });   // 문구는 튜토리얼에서만, 본 게임은 화면 테두리 번쩍임
    }

    /** 열차 한 대: 경고(warn틱) 후 y 높이의 가로 띠를 가로질러 달린다 */
    _spawnTrain(y, dir, warn) {
      this.hazards.push({ y, h: 46, x: dir > 0 ? -90 : W + 90, dir, state: 'warn', t: 0, warn: warn || 70, speed: 9, dmg: 20, hit: false });
      const tr = this.world.rules.trains;
      this._ev({ k: 'train', text: tr && tr.text });
    }

    _spawnLogic(t) {
      const w = this.world, rules = w.rules;
      const sec = t / TICK;
      const waves = w.waves;
      const wave = waves.find((x) => sec >= x.from && sec < x.to) || waves[waves.length - 1];
      let interval = Math.max(8, Math.round(wave.interval / ((rules.spawnMul || 1) * this.mul.spawn)));
      if (this.bossIdx > 0) interval *= 2;   // 보스전이 시작되면 졸개 스폰을 절반으로
      if (t % interval === 0) for (let i = 0; i < wave.n; i++) this._spawn(wave);
      while (this.swarmIdx < w.swarms.length && t >= w.swarms[this.swarmIdx].t * TICK) this._ring(w.swarms[this.swarmIdx++]);
      // 도우미: 첫 등장 뒤 helperEvery초마다 (앞 도우미가 떠났을 때만)
      if (t >= w.helper.t * TICK && !this.helper && (t - w.helper.t * TICK) % (TUNING.helperEvery * TICK) === 0) this._spawnHelper();
      // 큰 도전(보스): 월드가 높을수록 여러 번. 앞 보스를 극복하면 숨 돌린 뒤 다음 보스가 등장
      const times = w.boss.times;
      if (this.bossIdx < times.length && !this.bossAlive) {
        const due = Math.max(times[this.bossIdx] * TICK, this.bossIdx > 0 ? this.lastBossDeath + TUNING.bossGapSec * TICK : 0);
        if (t === due - 180) this._ev({ k: 'banner', text: this._bossAt(this.bossIdx).warnText });
        if (t >= due) {
          this._make('boss', W / 2, -30, this.bossIdx);
          this.bossIdx += 1; this.bossAlive = true; this.bossSpawned = true;
          this._ev({ k: 'boss', text: this._bossAt(this.bossIdx - 1).startText + (this.bossCount > 1 ? ` (${this.bossIdx}/${this.bossCount})` : '') });
        }
      }
      // 월드 고유 규칙: 떨어지는 물건 (보스 등장 전까지) — 내 근처에 빨간 원이 생기고 잠시 뒤 떨어진다
      const dr = rules.drops;
      if (dr && t >= dr.first * TICK && t < w.boss.times[0] * TICK - 120 && (t - dr.first * TICK) % (dr.every * TICK) === 0) {
        const p = this.player;
        for (let k = 0; k < dr.n; k++) {
          const a = this.rng() * Math.PI * 2, d = k === 0 ? this.rng() * 30 : 50 + this.rng() * 90;
          this.hazards.push({ kind: 'drop', x: Math.max(30, Math.min(W - 30, p.x + Math.cos(a) * d)), y: Math.max(70, Math.min(H - 40, p.y + Math.sin(a) * d)), r: TUNING.dropR, state: 'warn', t: 0, warn: TUNING.dropWarn + k * 10 });
        }
        if (dr.text && this.tick < (dr.first + 1) * TICK) this._ev({ k: 'banner', text: dr.text, hint: true });
        this._ev({ k: 'dropWarn' });
      }
      // 월드 고유 규칙: 지하철 열차 (보스 등장 전까지)
      const tr = rules.trains;
      if (tr && t >= tr.first * TICK && t < w.boss.times[0] * TICK - 240 && (t - tr.first * TICK) % (tr.every * TICK) === 0) {
        const p = this.player;
        this._spawnTrain(Math.max(50, Math.min(H - 60, p.y + (this.rng() - 0.5) * 160)), this.rng() < 0.5 ? 1 : -1);
      }
    }

    /* ---------- 전투 ---------- */
    _nearest(x, y, range) {
      let best = null, bd = range * range;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    _fire(x, y, d, owner, pm) {
      const target = this._nearest(x, y, this.world.rules.sight || 260);   // 밤·안개 월드는 조준 거리가 짧다
      if (!target) return false;
      const base = Math.atan2(target.y - y, target.x - x);
      const n = d.shots;
      const spread = 0.16;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        const crit = d.crit > 0 && this.rng() < d.crit;
        this.bullets.push({
          x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
          dmg: d.dmg * pm * (this.cheer > 0 ? 1 + TUNING.cheerDmg : 1) * (crit ? d.critMul : 1), crit, pierce: d.pierce, life: 46, owner, hit: [],
          tier: owner === 'player' ? bulletTier(d.dmg) : 0,   // 총알 단계: 강해질수록 모양이 바뀐다 (30가지, 30단계마다 처음부터)
        });
      }
      if (owner === 'player') this._ev({ k: 'shoot' });
      return true;
    }

    _hitEnemy(e, dmg, owner, crit) {
      e.hp -= dmg; e.flash = 4;
      this._ev({ k: 'dmg', x: e.x, y: e.y, v: Math.max(1, Math.round(dmg)), crit: !!crit, owner });
    }

    _ebullet(x, y, ang, speed, dmg) {
      this.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg, life: 320, r: 4 });
    }

    /** 보스전 중에는 받는 피해가 내 최대 체력에 (일부) 비례해서 커진다 → 체력 강화만으로 보스전이 시시해지지 않는다 */
    _bossDmgScale() {
      if (!this.bossAlive) return 1;
      return TUNING.bossAtkMul * this.bossRage * Math.max(1, Math.pow(this.player.maxhp / TUNING.baseHp, TUNING.bossDmgExp));
    }

    /** raw=true면 배율 없이 그대로 (열차처럼 막을 수 없는 큰 피해) */
    _hurtPlayer(dmg, raw) {
      const p = this.player;
      // 단계가 높을수록 적이 아프게 때리고(mul.dmg), 매점 방어 장비가 줄여 준다(takenMul)
      const taken = raw ? dmg : dmg * TUNING.damageTaken * this._bossDmgScale() * this.mul.dmg * this.bonus.takenMul * (this.world.rules.atkMul || 1);
      p.hp -= taken; p.inv = TUNING.hurtInvTicks;
      this.fx.push({ x: p.x, y: p.y, t: 10, kind: 'hurt' });
      this._ev({ k: 'hurt', dmg: taken });
    }

    /** 에코 피격: 에너지가 0이 되면 echoDownSec초 동안 사라졌다가 에너지를 채워 다시 나타난다 */
    _hurtEcho(ec, dmg) {
      ec.hp -= dmg; ec.inv = TUNING.echoInvTicks; ec.flash = 6;
      if (ec.hp <= 0) {
        ec.hp = 0; ec.down = TUNING.echoDownSec * TICK;
        this.fx.push({ x: ec.x, y: ec.y, t: 20, kind: 'vanish' });
        this._ev({ k: 'echoDown' });
      }
    }

    /** 충격파·형광펜 (플레이어/에코 공용) */
    _skills(a, d, pm, t, owner) {
      if (d.novaInt) {
        if (a.novaCd === undefined) a.novaCd = d.novaInt;
        a.novaCd -= 1;
        if (a.novaCd <= 0) {
          a.novaCd = d.novaInt;
          for (const e of this.enemies) {
            if ((e.x - a.x) * (e.x - a.x) + (e.y - a.y) * (e.y - a.y) < (d.novaR + e.r) * (d.novaR + e.r)) this._hitEnemy(e, d.novaDmg * pm, owner, false);
          }
          this.fx.push({ x: a.x, y: a.y, t: 18, kind: 'nova', r: d.novaR });
          if (owner === 'player') this._ev({ k: 'nova' });
        }
      } else a.novaCd = undefined;
      // 형광펜: 개수만큼 따로 때린다 (형광펜마다 같은 적을 다시 때리기까지 ORB_CD 틱). 모을수록 같은 적에게도 확실히 세짐
      const who = owner === 'player' ? 'p' : 'e' + a.id;
      for (let k = 0; k < d.orbN; k++) {
        const ang = t * 0.07 + (k * Math.PI * 2) / d.orbN;
        const ox = a.x + Math.cos(ang) * d.orbR, oy = a.y + Math.sin(ang) * d.orbR, key = who + k;
        this.orbs.push({ x: ox, y: oy, owner, ang });
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const last = e.oc && e.oc[key];
          if (last !== undefined && t - last < TUNING.orbCd) continue;
          const rr = e.r + 6;
          if ((e.x - ox) * (e.x - ox) + (e.y - oy) * (e.y - oy) < rr * rr) { this._hitEnemy(e, d.orbDmg * pm, owner, false); (e.oc || (e.oc = {}))[key] = t; }
        }
      }
    }

    _bossPhase(e) {
      const hpR = e.hp / e.maxhp;
      const phase = hpR > 0.66 ? 1 : hpR > 0.33 ? 2 : 3;
      if (phase !== e.phase) {
        e.phase = phase;
        this._ev({ k: 'phase', phase, name: e.name });
        this.fx.push({ x: e.x, y: e.y, t: 24, kind: 'nova', r: 120 });
      }
      return phase;
    }

    _summon(e, type, n) {
      n = Math.max(1, Math.ceil(n * 0.5));   // 화면이 붐비지 않게 소환 수는 절반
      for (let i = 0; i < n; i++) {
        if (this.enemies.length >= MAX_ENEMIES) break;
        const a = (i / n) * Math.PI * 2;
        this._make(type, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
      }
    }

    /** 보스 3페이즈 (월드마다 패턴이 다름). 이동량 {x,y} 반환 */
    _bossAI(e, ux, uy, dist) {
      const phase = this._bossPhase(e);
      e.t += 1;
      this.bossRage = Math.min(TUNING.rageMax, 1 + TUNING.rageRamp * (this.world.rules.rageMul || 1) * Math.max(0, e.t / TICK - TUNING.enrageSec));
      if (!e.enraged && e.t >= TUNING.enrageSec * TICK) {   // 오래 끌면 거세진다 → 시간에 쫓기는 긴장감
        e.enraged = true; e.speed *= 1.25;
        this._ev({ k: 'banner', text: '💢 점점 거세져요! 서둘러요', hint: true });
        this.fx.push({ x: e.x, y: e.y, t: 24, kind: 'nova', r: 140 });
      }
      const p = this.player;
      const summon = e.def.summon;
      switch (e.def.pattern) {
        case 'spiral': {   // 학원 보스: 회전 탄막 (숨 돌릴 틈 있음)
          const cyc = e.t % 240;
          if (cyc < 150 && e.t % 8 === 0) {
            const arms = phase === 1 ? 1 : 2;
            for (let k = 0; k < arms; k++) this._ebullet(e.x, e.y, e.t * (phase === 3 ? 0.2 : 0.15) + k * Math.PI, 1.5, 4);
          }
          if (phase >= 2 && e.t % 260 === 0) {
            const base = Math.atan2(p.y - e.y, p.x - e.x);
            for (let i = -2; i <= 2; i++) this._ebullet(e.x, e.y, base + i * 0.22, 2.0, 5);
          }
          if (phase === 3 && e.t % 420 === 0) this._summon(e, summon, 3);
          const sp = e.speed * (phase === 3 ? 1.3 : 1);
          return { x: ux * sp, y: uy * sp };
        }
        case 'charge': {   // 회사 보스: 예고 후 돌진
          const period = phase === 1 ? 200 : phase === 2 ? 160 : 130;
          if (e.cst === 0) {
            if (e.t % period === 0) { e.cst = 1; e.cw = 45; e.dvx = ux * 5.2; e.dvy = uy * 5.2; e.warn = true; }
            if (phase >= 2 && e.t % 420 === 0) this._summon(e, summon, 4);
            const sp = e.speed;
            return { x: ux * sp, y: uy * sp };
          }
          if (e.cst === 1) {   // 예고: 제자리에서 조준
            e.cw -= 1; e.dvx = ux * 5.2; e.dvy = uy * 5.2;
            if (e.cw <= 0) { e.cst = 2; e.cw = 28; e.warn = false; }
            return { x: 0, y: 0 };
          }
          e.cw -= 1;           // 돌진 중
          if (e.cw <= 0) {
            e.cst = 0;
            const n = phase === 3 ? 10 : 8;
            for (let i = 0; i < n; i++) this._ebullet(e.x, e.y, (i / n) * Math.PI * 2, 1.6, 5);
          }
          return { x: e.dvx, y: e.dvy };
        }
        case 'lane': {     // 지하철 보스: 가로로 달리는 열차 소환
          const period = phase === 1 ? 280 : phase === 2 ? 230 : 190;     // 열차 한 방이 치명적이므로 여유 있는 주기
          if (e.t % period === 0) {
            const lanes = Math.min(2, phase);
            for (let k = 0; k < lanes; k++) {
              const y = k === 0 ? p.y : Math.max(50, Math.min(H - 60, p.y + (this.rng() - 0.5) * 320));
              this._spawnTrain(y, this.rng() < 0.5 ? 1 : -1, 80);
            }
          }
          if (phase >= 2 && e.t % 300 === 0) this._summon(e, summon, 4);
          if (phase === 3 && e.t % 150 === 0) {
            const base = Math.atan2(p.y - e.y, p.x - e.x);
            for (let i = -1; i <= 1; i++) this._ebullet(e.x, e.y, base + i * 0.2, 2.0, 5);
          }
          const sp = e.speed * (phase === 3 ? 1.3 : 1);
          return { x: ux * sp, y: uy * sp };
        }
        default: {         // 학교 보스: 탄막 + 졸개 소환 + 조준 3연발
          if (e.t % 150 === 0) {                                  // 사방으로 퍼지는 불안 (틈이 있어 피할 수 있음)
            const n = phase === 1 ? 8 : 11;
            const off = (e.t / 150) * 0.3;
            for (let i = 0; i < n; i++) this._ebullet(e.x, e.y, off + (i / n) * Math.PI * 2, 1.7, 6);
          }
          if (phase >= 2 && e.t % 240 === 0) {                    // 나를 노리는 걱정 3연발
            const base = Math.atan2(p.y - e.y, p.x - e.x);
            for (let i = -1; i <= 1; i++) this._ebullet(e.x, e.y, base + i * 0.2, 2.2, 6);
          }
          if (phase >= 2 && e.t % 360 === 0) this._summon(e, summon || 'hw', 4);
          if (phase === 3 && e.t % 90 === 0) {
            const base = Math.atan2(p.y - e.y, p.x - e.x);
            for (let i = -2; i <= 2; i++) this._ebullet(e.x, e.y, base + i * 0.2, 2.4, 6);
          }
          const sp = e.speed * (phase === 3 ? 1.4 : 1);
          return { x: ux * sp, y: uy * sp };
        }
      }
    }

    /** 도우미(선생님 등) 등장: 플레이어와 떨어진 곳에 "상담 구역"을 연다 */
    _spawnHelper() {
      const p = this.player, h = this.world.helper;
      let x = W / 2, y = H * 0.35, best = -1;
      for (let i = 0; i < 12; i++) {      // 플레이어에게서 적당히(너무 멀지도 가깝지도 않게) 떨어진 위치
        const cx = 60 + this.rng() * (W - 120), cy = 110 + this.rng() * (H - 300);
        const d = Math.hypot(cx - p.x, cy - p.y);
        const score = d < 90 ? -1 : Math.min(d, 220);
        if (score > best) { best = score; x = cx; y = cy; }
      }
      this.helper = { x, y, r: 46, state: 'wait', prog: 0, need: TUNING.helperNeed, t: 0, stay: TUNING.helperStay * TICK, fade: 0, name: h.name, emoji: h.emoji };
      this._ev({ k: 'banner', text: h.arriveText, hint: true });
      this._ev({ k: 'helper' });
    }

    /* ---------- 선행(좋은 일) ---------- */
    /** 선행 보상: 아이템 카드 3장 (게임은 멈추지 않음, 안 고르면 자동) */
    _deedReward(extraAuto, who) {
      this.deeds.done += 1;
      if (who) {   // 도와준 사람은 고맙다고 손을 흔들고 가까운 화면 밖(안전한 곳)으로 떠나며, 응원을 남긴다
        this.deeds.people.push(who.kind);
        this.allies.push({ x: who.x, y: who.y, kind: who.kind, t: TUNING.allySec * TICK, wave: TUNING.allyWave, dir: who.x < W / 2 ? -1 : 1 });
        this.cheer = Math.max(this.cheer, TUNING.cheerSec * TICK);
        this._ev({ k: 'deed', what: 'cheer', x: who.x, y: who.y });
      }
      this._warm(who ? who.x : this.player.x, who ? who.y : this.player.y);
      if (extraAuto) {   // 친구를 끝까지 지켜 주면 아이템 하나는 바로 얻음
        const bonus = this._rollPicks()[0];
        if (bonus) { this._applyUpgrade(bonus.id); this._ev({ k: 'autoPick', id: bonus.id, icon: bonus.icon, name: bonus.name }); }
      }
      this._offer(this._rollPicks().map((u) => Object.assign({}, u, { deed: true })), 'deed');
    }
    /** 따뜻한 빛: 주변 방해 요소가 잠시 순해진다 (느려지고, 닿아도 아프지 않음) */
    _warm(x, y) {
      const R = TUNING.warmR;
      for (const e of this.enemies) if (e.type !== 'boss' && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < R * R) e.calm = TUNING.warmSec * TICK;
      this._ev({ k: 'warm', x, y, r: R });
    }
    _updateAllies() {
      if (this.cheer > 0) this.cheer -= 1;
      for (let i = this.allies.length - 1; i >= 0; i--) {
        const a = this.allies[i];
        if (a.wave > 0) a.wave -= 1;                       // 먼저 제자리에서 손을 흔들며 인사
        else a.x += a.dir * TUNING.allySpeed;              // 그다음 가까운 화면 밖으로 걸어서 떠남
        const out = a.x < -24 || a.x > W + 24;
        if (--a.t <= 0 || out) { this.allies.splice(i, 1); if (!out) this._ev({ k: 'deed', what: 'allyBye', x: a.x, y: a.y }); }
      }
    }
    _updateDeeds(t) {
      const T = TUNING, d = this.deeds, p = this.player, r = this.drng, sec = t / TICK;
      this._updateAllies();
      // 0) 지난 판에 도와준 사람이 찾아와 작은 선물을 주고 간다 (은혜 갚기)
      if (d.visitorKind && t === T.visitorSec * TICK) {
        d.visitor = { x: p.x < W / 2 ? W - 20 : 20, y: Math.min(PLAY_BOTTOM - 30, Math.max(90, p.y)), kind: d.visitorKind, state: 'come', fade: 0 };
        this._ev({ k: 'deed', what: 'visitStart', kind: d.visitorKind });
      }
      const vs = d.visitor;
      if (vs) {
        if (vs.state === 'come') {
          const dx = p.x - vs.x, dy = p.y - vs.y, dd = Math.hypot(dx, dy) || 1;
          vs.x += dx / dd * 2.2; vs.y += dy / dd * 2.2;
          if (dd < 30) {
            vs.state = 'gift'; vs.fade = 70;
            p.hp = Math.min(p.maxhp, p.hp + p.maxhp * T.visitorHeal); this._ev({ k: 'heal' });
            for (let g = 0; g < T.visitorGems; g++) { const a = (g / T.visitorGems) * Math.PI * 2; this.gems.push({ x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 34, v: 1 }); }
            this._ev({ k: 'deed', what: 'visitGift', x: vs.x, y: vs.y, kind: vs.kind });
          }
        } else if (--vs.fade <= 0) d.visitor = null;
      }
      // 1) 어려움에 처한 사람 돕기
      if (!d.rescue && sec >= T.deedRescueFirst && (t - T.deedRescueFirst * TICK) % (T.deedRescueEvery * TICK) === 0) {
        let x = W / 2, y = H * 0.4, best = -1;
        for (let i = 0; i < 10; i++) { const cx = 50 + r() * (W - 100), cy = 110 + r() * (H - 300), dd = Math.hypot(cx - p.x, cy - p.y); const sc = dd < 120 ? -1 : Math.min(dd, 230); if (sc > best) { best = sc; x = cx; y = cy; } }
        const kinds = ['child', 'elder', 'friend'];
        d.rescue = { x, y, kind: kinds[Math.floor(r() * kinds.length)], t: 0, state: 'wait', fade: 0, guards: [] };
        const types = Object.keys(this.world.enemies).filter((k) => !this.world.enemies[k].onDeath && this.world.enemies[k].ai !== 'shoot');
        for (let i = 0; i < T.deedRescueGuards; i++) {
          const a = (i / T.deedRescueGuards) * Math.PI * 2;
          this._make(types[i % types.length], x + Math.cos(a) * 34, y + Math.sin(a) * 34);
          const e = this.enemies[this.enemies.length - 1]; e.guard = d.rescue; e.gAng = a; e.hp *= 0.6; e.maxhp = e.hp;
          d.rescue.guards.push(e);
        }
        this._ev({ k: 'deed', what: 'rescueStart', x, y });
      }
      const rs = d.rescue;
      if (rs) {
        rs.t += 1;
        if (rs.state === 'wait') {
          if (rs.guards.every((e) => e.hp <= 0 || this.enemies.indexOf(e) < 0)) {
            rs.state = 'done'; rs.fade = 40; this._ev({ k: 'deed', what: 'rescued', x: rs.x, y: rs.y, kind: rs.kind }); this._deedReward(false, rs);
          } else if (rs.t >= T.deedRescueStay * TICK) { rs.state = 'gone'; rs.fade = 60; for (const e of rs.guards) e.guard = null; this._ev({ k: 'deed', what: 'rescueLeft' }); }
        } else if (--rs.fade <= 0) d.rescue = null;
      }
      // 2) 친구 지켜주기 (내가 곁에 있을 때만 걷고, 반대편까지 무사히 가면 아이템 2개)
      if (!d.escort && sec >= T.deedEscortFirst && (t - T.deedEscortFirst * TICK) % (T.deedEscortEvery * TICK) === 0 && !this.bossAlive) {
        const dir = r() < 0.5 ? 1 : -1, y = 170 + r() * 260;
        d.escort = { x: dir > 0 ? 16 : W - 16, y, dir, hp: T.friendHp, maxhp: T.friendHp, inv: 0, state: 'walk', fade: 0, waiting: false, goal: dir > 0 ? W - 16 : 16 };
        this._ev({ k: 'deed', what: 'escortStart', x: d.escort.x, y });
      }
      const es = d.escort;
      if (es) {
        if (es.state === 'walk') {
          if (es.inv > 0) es.inv -= 1;
          es.waiting = Math.hypot(p.x - es.x, p.y - es.y) > T.friendWaitDist;
          if (!es.waiting) es.x += es.dir * T.friendSpeed;
          if ((es.dir > 0 && es.x >= es.goal) || (es.dir < 0 && es.x <= es.goal)) { es.state = 'done'; es.fade = 40; this.deeds.escorts += 1; this._ev({ k: 'deed', what: 'escortDone', x: es.x, y: es.y, kind: 'friend' }); this._deedReward(true, { x: es.x, y: es.y, kind: 'friend' }); }
          else if (es.hp <= 0) { es.state = 'fail'; es.fade = 70; this._ev({ k: 'deed', what: 'escortFail' }); }
        } else if (--es.fade <= 0) d.escort = null;
      }
      // 3) 작은 선행 거리: 지나가면 💛 +1, 다 모으면 아이템 카드
      if (sec >= 8 && t % (T.deedSpotEvery * TICK) === 0 && d.spots.length < T.deedSpotMax) {
        const kinds = ['litter', 'pot', 'toy'];
        d.spots.push({ x: 30 + r() * (W - 60), y: 90 + r() * (H - 260), kind: kinds[Math.floor(r() * kinds.length)], t: T.deedSpotLife * TICK });
      }
      for (let i = d.spots.length - 1; i >= 0; i--) {
        const sp = d.spots[i];
        if (Math.hypot(p.x - sp.x, p.y - sp.y) < p.r + 12) {
          d.spots.splice(i, 1); d.gauge += 1; d.spotCount += 1; this.fx.push({ x: sp.x, y: sp.y, t: 20, kind: 'deed' });
          this._ev({ k: 'deed', what: 'spot', x: sp.x, y: sp.y, kind: sp.kind });
          if (d.gauge >= T.deedGaugeNeed) { d.gauge = 0; this._ev({ k: 'deed', what: 'gaugeFull' }); this._deedReward(false); }
        } else if (--sp.t <= 0) d.spots.splice(i, 1);
      }
    }

    /** 지금 선생님(도우미)의 보호를 받는 중인가: 기다리는 도우미의 상담 구역 안에 내가 있으면 적 탄을 막아 준다 */
    helperShield() {
      const hz = this.helper, p = this.player;
      return !!hz && hz.state === 'wait' && Math.hypot(p.x - hz.x, p.y - hz.y) < hz.r + p.r;
    }

    /** 도우미 곁(상담 구역)에 머무르면 게이지가 차고, 가득 차면 조언 카드를 받는다. 적은 도우미를 건드리지 못한다. */
    _updateHelper() {
      const hp = this.helper;
      if (!hp) return;
      const p = this.player;
      hp.t += 1;
      if (hp.state === 'wait') {
        const inside = Math.hypot(p.x - hp.x, p.y - hp.y) < hp.r + p.r;
        hp.prog = inside ? Math.min(hp.need, hp.prog + 1) : Math.max(0, hp.prog - TUNING.helperDecay);
        if (hp.prog >= hp.need) {
          hp.state = 'done'; hp.fade = 45; this.helped += 1;   // 약 0.75초 동안 웃으며 손을 흔들어 인사하고 금방 사라짐
          const w = this.world.helper;
          const ids = ['heal', 'power', this.echoes.length > 0 ? 'team' : 'focus'];
          this._offer(ids.map((id) => ({ id: 'boon_' + id, icon: Worlds.BOONS[id].icon, name: w.boons[id], desc: Worlds.BOONS[id].desc, instant: true, boon: true })), 'helper');
          this._ev({ k: 'banner', text: w.thanksText, hint: true });
          this._ev({ k: 'helped', x: hp.x, y: hp.y });
        } else if (hp.t >= hp.stay) {
          hp.state = 'gone'; hp.fade = 45;
          this._ev({ k: 'banner', text: this.world.helper.leaveText, hint: true });
        }
      } else if (--hp.fade <= 0) this.helper = null;
    }

    /** 열차 위험물 갱신: 경고 → 질주. 플레이어에겐 큰 피해, 일반 적은 즉사 */
    _updateHazards() {
      const p = this.player;
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const h = this.hazards[i];
        h.t += 1;
        if (h.kind === 'drop') {   // 낙하물: 빨간 원 경고 → 쿵! (범위 안 피해, 방해 요소도 사라짐) → 잠깐 흔적
          if (h.state === 'warn' && h.t >= h.warn) {
            h.state = 'boom'; h.t = 0;
            if (p.inv === 0 && Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r) this._hurtPlayer(Math.max(TUNING.dropMinDmg, p.maxhp * TUNING.dropHpFrac), true);
            for (const e of this.enemies) if (e.def.ai !== 'boss' && e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r) e.hp = 0;
            this._ev({ k: 'dropHit', x: h.x, y: h.y });
          } else if (h.state === 'boom' && h.t >= 18) { this.hazards[i] = this.hazards[this.hazards.length - 1]; this.hazards.pop(); }
          continue;
        }
        if (h.state === 'warn') {
          if (h.t === h.warn - 6) this._ev({ k: 'trainPass', dir: h.dir });   // 소리 지연을 감안해 출발 0.1초 전에 지나가는 소리 시작
          if (h.t >= h.warn) { h.state = 'go'; }
          continue;
        }
        h.x += h.dir * h.speed;
        const half = 70;
        if (!h.hit && p.inv === 0 && Math.abs(p.y - h.y) < h.h / 2 + p.r && Math.abs(p.x - h.x) < half + p.r) { this._hurtPlayer(Math.max(TUNING.trainMinDmg, p.maxhp * TUNING.trainHpFrac), true); h.hit = true; }
        for (const e of this.enemies) {
          const bt = e.def;
          if (bt.ai === 'boss') continue;
          if (e.hp > 0 && Math.abs(e.y - h.y) < h.h / 2 + e.r && Math.abs(e.x - h.x) < half + e.r) e.hp = 0;
        }
        if ((h.dir > 0 && h.x > W + 100) || (h.dir < 0 && h.x < -100)) { this.hazards[i] = this.hazards[this.hazards.length - 1]; this.hazards.pop(); }
      }
    }

    _killEnemy(i) {
      const e = this.enemies[i];
      this.kills += 1;
      const big = e.type === 'boss' ? 12 : 1;
      const v = e.type === 'boss' ? 3 : e.xp;
      for (let g = 0; g < big; g++) this.gems.push({ x: e.x + (this.rng() - 0.5) * 14, y: e.y + (this.rng() - 0.5) * 14, v });
      this.fx.push({ x: e.x, y: e.y, t: 14, kind: 'pop' });
      this._ev({ k: 'kill', x: e.x, y: e.y, type: e.type, name: e.name, r: e.r, emoji: e.emoji, last: e.type === 'boss' && this.bossDefeated + 1 >= this.bossCount });
      if (e.type === 'boss') {
        this.bossDefeated += 1; this.bossAlive = false; this.lastBossDeath = this.tick; this.bossRage = 1;
        if (this.bossDefeated >= this.bossCount) this.bossDead = true;
        else {
          const p = this.player;
          p.hp = Math.min(p.maxhp, p.hp + p.maxhp * TUNING.bossBreatherHeal);
          this._ev({ k: 'heal' });
          this._ev({ k: 'banner', text: `💛 한 고비 넘었어요! (${this.bossDefeated}/${this.bossCount}) 숨 돌리세요`, hint: true });
        }
      }
      // 월드 규칙: 가끔 커피(체력 회복)
      const cc = this.world.rules.coffeeChance;
      if (cc && e.type !== 'boss' && this.rng() < cc) this.gems.push({ x: e.x, y: e.y, v: TUNING.coffeeHeal, kind: 'coffee' });
      this.enemies[i] = this.enemies[this.enemies.length - 1]; this.enemies.pop();
      const od = e.def.onDeath;
      if (od) {
        for (let s = 0; s < od.n; s++) if (this.enemies.length < MAX_ENEMIES) this._make(od.type, e.x + (s - (od.n - 1) / 2) * 10, e.y);
      }
    }

    /** input: {dx,dy} (각 -1..1, 길이 ≤ 1). 종료 시 진행하지 않는다. 카드(레벨업·조언)가 떠 있어도 계속 진행된다. */
    step(input) {
      if (this.over) return;
      // 카드가 떠 있어도 게임은 계속된다. 시간이 지나면 자동 선택
      if (this.choices && ++this.choiceT >= TUNING.choiceAutoSec * TICK) this._autoChoose();
      const p = this.player;
      const t = this.tick;
      this.orbs.length = 0;
      if (p.inv > 0) p.inv -= 1;

      // 이동 + 기록
      const d = derive(p.stats, this.bonus);
      let dx = input.dx || 0, dy = input.dy || 0;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      const wind = this.world.rules.wind;   // 바닷가·산: 좌우로 번갈아 부는 바람
      const wx = wind ? wind.amp * Math.sin((t / (wind.period * TICK)) * Math.PI * 2) : 0;
      p.x = Math.min(W - p.r, Math.max(p.r, p.x + dx * d.speed + wx));
      p.y = Math.min(H - p.r, Math.max(p.r, p.y + dy * d.speed));
      this.rec.path.push(p.x, p.y);

      this._spawnLogic(t);

      // 플레이어 공격/스킬/재생
      p.cd -= 1;
      if (p.cd <= 0 && this._fire(p.x, p.y, d, 'player', 1)) p.cd = d.cooldown;
      this._skills(p, d, 1, t, 'player');
      if (d.regen && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + d.regen * (this.bossAlive ? TUNING.bossRegenMul : 1));

      // 에코 재생
      const boost = 1 + TUNING.echoBoostPer * p.stats.echo;
      for (const ec of this.echoes) {
        if (!ec.alive) continue;
        if (t * 2 + 1 >= ec.path.length) { ec.alive = false; this.fx.push({ x: ec.x, y: ec.y, t: 20, kind: 'vanish' }); continue; }
        ec.x = ec.path[t * 2]; ec.y = ec.path[t * 2 + 1];   // 사라져 있어도 기록은 계속 흘러간다
        if (ec.inv > 0) ec.inv -= 1;
        if (ec.down > 0) {
          if (--ec.down === 0) { ec.hp = TUNING.echoHp; ec.inv = TUNING.echoInvTicks; this.fx.push({ x: ec.x, y: ec.y, t: 20, kind: 'echoUp' }); }
          continue;   // 사라진 동안은 공격·스킬 없음 (성장 기록은 다시 나타난 뒤 따라잡음)
        }
        while (ec.upIdx < ec.ups.length && ec.ups[ec.upIdx].t <= t) {
          const id = ec.ups[ec.upIdx].id;
          if (id in ec.stats && id !== 'heal' && id !== 'echo') ec.stats[id] += 1;
          ec.upIdx++;
        }
        const ed = derive(ec.stats);
        const pm = ec.power * boost * (1 + this.bonus.echoPower) * this.bonus.teamMul;
        ec.cd -= 1;
        if (ec.cd <= 0 && this._fire(ec.x, ec.y, ed, 'echo', pm)) ec.cd = Math.max(6, Math.round(ed.cooldown / boost));
        this._skills(ec, ed, pm, t, 'echo');
      }

      // 탄환 (아군)
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx; b.y += b.vy; b.life -= 1;
        let dead = b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20;
        if (!dead) {
          for (let j = 0; j < this.enemies.length; j++) {
            const e = this.enemies[j];
            if (e.hp <= 0 || b.hit.indexOf(e) !== -1) continue;
            const rr = e.r + 3;
            if ((e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y) < rr * rr) {
              this._hitEnemy(e, b.dmg, b.owner, b.crit);
              b.hit.push(e);
              if (b.pierce <= 0) { dead = true; break; }
              b.pierce -= 1;
            }
          }
        }
        if (dead) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); }
      }

      // 적 탄환
      // 선생님(도우미) 곁의 상담 구역 안에 있으면 날아오는 탄을 구역 테두리에서 막아 준다 (몸으로 부딪히는 건 그대로 아픔)
      const hz = this.helper, shield = this.helperShield();
      for (let i = this.ebullets.length - 1; i >= 0; i--) {
        const b = this.ebullets[i];
        b.x += b.vx; b.y += b.vy; b.life -= 1;
        let dead = b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20;
        if (!dead && shield && (b.x - hz.x) * (b.x - hz.x) + (b.y - hz.y) * (b.y - hz.y) < hz.r * hz.r) {
          dead = true; this.fx.push({ x: b.x, y: b.y, t: 14, kind: 'block' }); this.blocked = (this.blocked || 0) + 1;
        }
        if (!dead && p.inv === 0) {
          const rr = p.r + b.r;
          if ((p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y) < rr * rr) { this._hurtPlayer(b.dmg); dead = true; }
        }
        if (!dead) {   // 에코도 적 탄에 맞는다 (탄은 막아 준 만큼 사라짐)
          const er = TUNING.echoR + b.r;
          for (const ec of this.echoes) {
            if (!ec.alive || ec.down || ec.inv) continue;
            if ((ec.x - b.x) * (ec.x - b.x) + (ec.y - b.y) * (ec.y - b.y) < er * er) { this._hurtEcho(ec, b.dmg); dead = true; break; }
          }
        }
        if (dead) { this.ebullets[i] = this.ebullets[this.ebullets.length - 1]; this.ebullets.pop(); }
      }

      this._updateHazards();
      this._updateHelper();
      this._updateDeeds(t);

      // 적 이동/AI/접촉/사망
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.hp <= 0) { this._killEnemy(i); continue; }
        // 오래된 방해 요소는 그냥 사라진다 (구슬 없음)
        if (e.type !== 'boss' && !(e.guard && e.guard.state === 'wait')) {
          e.age = (e.age || 0) + 1;
          if (e.age >= TUNING.enemyLifeSec * TICK) {
            this.fx.push({ x: e.x, y: e.y, t: 16, kind: 'vanish' });
            this.enemies[i] = this.enemies[this.enemies.length - 1]; this.enemies.pop();
            continue;
          }
        }
        if (e.flash > 0) e.flash -= 1;
        const bt = e.def;
        const ax = p.x - e.x, ay = p.y - e.y;
        const dist = Math.hypot(ax, ay) || 1;
        const ux = ax / dist, uy = ay / dist;
        let mvx = ux * e.speed, mvy = uy * e.speed;

        switch (bt.ai) {
          case 'shoot': {
            const dir = dist > 150 ? 1 : dist < 110 ? -0.8 : 0;
            mvx = ux * e.speed * dir; mvy = uy * e.speed * dir;
            e.cd -= 1;
            if (e.cd <= 0 && dist < 280 && !(e.calm > 0)) {
              const n = bt.volley || 1, base = Math.atan2(ay, ax);
              for (let k = 0; k < n; k++) this._ebullet(e.x, e.y, base + (k - (n - 1) / 2) * (bt.spread || 0.2), bt.bspeed || 2.2, bt.bdmg || 5);
              e.cd = bt.fireCd;
            }
            break;
          }
          case 'zig': {
            e.t += 1;
            const side = Math.sin(e.t * 0.12 + e.maxhp) * 1.1;
            mvx = ux * e.speed - uy * e.speed * side; mvy = uy * e.speed + ux * e.speed * side;
            break;
          }
          case 'dash': {
            if (e.dashT > 0) { e.dashT -= 1; mvx = e.dvx; mvy = e.dvy; }
            else {
              e.cd -= 1;
              e.warn = e.cd <= 18;
              if (e.cd <= 0) { e.dashT = 22; e.dvx = ux * 4.4; e.dvy = uy * 4.4; e.cd = bt.dashCd; e.warn = false; }
            }
            break;
          }
          case 'boss': {
            const m = this._bossAI(e, ux, uy, dist);
            mvx = m.x; mvy = m.y;
            break;
          }
          default: break;
        }

        // 선행: 어려움에 처한 사람을 둘러싼 방해 요소는 내가 다가오기 전까지 그 사람 곁을 맴돈다
        const rs = this.deeds.rescue;
        if (e.guard && rs === e.guard && rs.state === 'wait' && Math.hypot(p.x - rs.x, p.y - rs.y) > 110) {
          e.gAng += 0.025;
          const gx = rs.x + Math.cos(e.gAng) * 34 - e.x, gy = rs.y + Math.sin(e.gAng) * 34 - e.y, gd = Math.hypot(gx, gy) || 1;
          const sp = Math.min(gd, Math.max(0.6, e.speed));
          mvx = gx / gd * sp; mvy = gy / gd * sp;
        }
        // 친구 지켜주기: 친구 가까이 있는 방해 요소는 친구 쪽으로 간다 (보스·원거리 제외)
        const es = this.deeds.escort;
        if (es && es.state === 'walk' && e.type !== 'boss' && bt.ai !== 'shoot') {
          const fx = es.x - e.x, fy = es.y - e.y, fd = Math.hypot(fx, fy) || 1;
          if (fd < 70 && fd < dist) { mvx = fx / fd * e.speed; mvy = fy / fd * e.speed; }
          if (fd < e.r + 8 && es.inv === 0) { es.hp -= es.maxhp * 0.08; es.inv = 40; this._ev({ k: 'deed', what: 'friendHurt' }); }
        }
        if (e.calm > 0) { e.calm -= 1; mvx *= 0.35; mvy *= 0.35; }   // 따뜻한 빛을 받아 순해짐
        e.x += mvx; e.y += mvy;
        if (e.type === 'boss' && e.t > 90 && e.y < 125) e.y = 125;   // 보스는 화면 위 끝(체력 막대·HUD 아래)에 숨지 않게
        if (p.inv === 0 && dist < e.r + p.r && !(e.calm > 0)) this._hurtPlayer(e.dmg);
        for (const ec of this.echoes) {   // 적에게 닿은 에코도 에너지가 준다
          if (!ec.alive || ec.down || ec.inv) continue;
          const ex = ec.x - e.x, ey = ec.y - e.y, rr = e.r + TUNING.echoR;
          if (ex * ex + ey * ey < rr * rr && !(e.calm > 0)) this._hurtEcho(ec, e.dmg);
        }
      }

      // 구슬 흡수
      for (let i = this.gems.length - 1; i >= 0; i--) {
        const g = this.gems[i];
        const ax = p.x - g.x, ay = p.y - g.y;
        const dist = Math.hypot(ax, ay);
        if (dist < d.magnet) { g.x += (ax / (dist || 1)) * 4; g.y += (ay / (dist || 1)) * 4; }
        if (dist < p.r + 5) {
          if (g.kind === 'coffee') { p.hp = Math.min(p.maxhp, p.hp + g.v); this._ev({ k: 'heal' }); }
          else { p.xp += g.v * this.bonus.xpMul * (this.world.rules.xpMul || 1); this.gemCount += 1; this._ev({ k: 'gem' }); }
          this.gems[i] = this.gems[this.gems.length - 1]; this.gems.pop();
        }
      }
      // 레벨업: 카드가 없으면 카드를 띄우고, 이미 고르는 중이거나 여러 레벨이 한꺼번에 오르면 나머지는 바로 자동 선택
      for (let guard = 0; p.xp >= p.need && guard < 50; guard++) {
        if (!this.choices) this._levelUp(); else this._levelUpAuto();
      }

      // 이펙트 수명
      for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t -= 1; if (this.fx[i].t <= 0) { this.fx[i] = this.fx[this.fx.length - 1]; this.fx.pop(); } }

      this.tick += 1;

      if (p.hp <= 0) { this.over = true; this.result = 'dead'; }
      else if (this.bossDead) { this.over = true; this.result = 'clear'; }
      else if (this.tick >= this.runTicks && (!(this.bossIdx < this.bossCount || this.bossAlive) || this.tick >= this.runTicks + OVERTIME_TICKS + (this.bossCount - 1) * 20 * TICK)) { this.over = true; this.result = 'survive'; }
    }

    /** 이번 판을 다음 판의 에코로 내보낸다. */
    exportEcho() { return { path: this.rec.path.slice(), ups: this.rec.ups.slice(), kills: this.kills, ticks: this.tick }; }
  }

  /** 모든 월드의 큰 도전 목록 (월드 보스 + minis) — 2회차부터 무작위 등장 */
  Sim.bossPool = function () {
    if (!Sim._pool) {
      Sim._pool = [];
      for (const id of Worlds.ORDER) {
        const b = WORLDS[id].boss;
        Sim._pool.push(Object.assign({ origin: id }, b));
        for (const m of b.minis || []) Sim._pool.push(Object.assign({ origin: id + ':' + m.name }, m));
      }
    }
    return Sim._pool;
  };
  const api = { bulletTier, Sim, addEcho, mulberry32, derive, NO_BONUS, WORLDS, WORLD_ORDER: Worlds.ORDER, UPGRADES, SYNERGIES, ENEMY_TYPES, WAVES, SWARMS, TUNING, W, H, PLAY_BOTTOM, TICK, RUN_TICKS, OVERTIME_TICKS, BOSS_TICK, MAX_ECHOES, MAX_LEVEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
