/* 퇴근 에코 — 결정론적 시뮬레이션 코어 (DOM 의존 없음)
 * 고정 60Hz 타임스텝 + 시드 난수. 에코는 "이동 경로 + 강화 기록"만 저장하고
 * 매 틱 재생한다. (공격/피격은 현재 판의 적을 대상으로 실시간 계산)
 *
 * 1단계 확장: 적 7종 + 웨이브 표, 업그레이드 12종 + 시너지 4종,
 * 에코 규칙(체력/세대별 약화/난이도 연동), 보스 3페이즈, 이벤트 큐(사운드·연출용).
 */
(function (root) {
  'use strict';

  const W = 360, H = 640;
  const TICK = 60;
  const PLAY_BOTTOM = H - 140;   // UI 전용: 이 아래를 '추천 조작 영역'으로 표시 (캐릭터 이동은 제한하지 않음)
  const RUN_TICKS = 120 * TICK;
  const ELITE_TICK = 45 * TICK;
  const BOSS_TICK = 90 * TICK;
  const MAX_ECHOES = 20;  // 정원. 넘치면 가장 일찍 쓰러진 에코부터 퇴장
  const MAX_ENEMIES = 260;
  const OVERTIME_TICKS = 60 * TICK;   // 120초가 지나도 보스가 살아 있으면 최대 60초 연장 (보스를 잡을 시간)
  const MAX_LEVEL = 5;

  /* ---- 밸런스 튜닝 값 (여기만 만지면 됨) ---- */
  const TUNING = {
    echoHp: 30,              // 에코 체력
    echoBasePower: 0.9,      // 에코 기본 공격력 배율
    echoAgeDecay: 0.05,      // 한 세대 오래될수록 공격력 -5%
    echoMinPower: 0.6,       // 최저 배율
    echoDamageTaken: 0.5,    // 에코가 받는 피해 배율(본체 대비)
    echoHpScale: 0.04,       // 에코 1명당 일반 적 체력 +4% (난이도 연동, 20명이면 +80%)
    echoBossScale: 0.07,     // 에코 1명당 보스 체력 +7% (20명이면 +140%)
    hpGrowth: 1.6,           // 진행도에 따른 적 체력 증가
    healAmount: 30,
    damageTaken: 0.75,       // 플레이어가 받는 피해 배율 (낮출수록 쉬움)
    hurtInvTicks: 50,        // 피격 후 무적 시간(틱)
    enemySpeedGrowth: 0.15,  // 진행도에 따른 적 속도 증가
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
    { id: 'rate',   icon: '✏️', name: '샤프 속도↑',  desc: '발사 간격 -15%' },
    { id: 'multi',  icon: '🧽', name: '지우개 +1',    desc: '동시 발사 수 +1' },
    { id: 'dmg',    icon: '📝', name: '필기 강화',    desc: '공격력 +35%' },
    { id: 'speed',  icon: '👟', name: '운동화',        desc: '이동속도 +12%' },
    { id: 'magnet', icon: '🧲', name: '자석 필통',     desc: '구슬 흡수 범위 +' },
    { id: 'pierce', icon: '📍', name: '관통 샤프심',   desc: '관통 +1' },
    { id: 'crit',   icon: '💯', name: '시험 만점',     desc: '치명타 확률 +10% (피해 x2)' },
    { id: 'nova',   icon: '🔔', name: '종소리',        desc: '주기적으로 주변에 충격파' },
    { id: 'orbit',  icon: '🖍️', name: '형광펜',        desc: '몸 주위를 도는 형광펜 +1' },
    { id: 'regen',  icon: '🍱', name: '급식 시간',     desc: '체력 재생 +0.8/초' },
    { id: 'echo',   icon: '👻', name: '에코 응원',     desc: '모든 에코의 공격력·속도 +15%' },
    { id: 'heal',   icon: '🩹', name: '보건실',        desc: '체력 30 즉시 회복', instant: true },
  ];

  const SYNERGIES = {
    focus:    { name: '집중 필기',   desc: '샤프 속도 2+ & 필기 강화 2+ → 공격력 +20%' },
    shotgun:  { name: '관통 샷건',   desc: '지우개 2+ & 관통 1+ → 관통 +1' },
    exam:     { name: '만점 러시',   desc: '시험 만점 2+ & 샤프 속도 2+ → 치명타 +10%' },
    bellring: { name: '타종식',      desc: '형광펜 2+ & 종소리 1+ → 충격파 범위 +30%' },
  };

  // 학교 월드 적
  const ENEMY_TYPES = {
    hw:      { name: '숙제',     emoji: '📄', hp: 3,   speed: 0.7,  r: 9,  dmg: 6,  xp: 1,  ai: 'chase' },
    test:    { name: '쪽지시험', emoji: '📝', hp: 2,   speed: 1.1,  r: 8,  dmg: 5,  xp: 1,  ai: 'chase' },
    alarm:   { name: '학원알림', emoji: '🔔', hp: 14,  speed: 0.5,  r: 14, dmg: 10, xp: 4,  ai: 'chase' },
    late:    { name: '지각',     emoji: '⏰', hp: 4,   speed: 0.6,  r: 8,  dmg: 7,  xp: 2,  ai: 'dash',  dashCd: 110 },
    chalk:   { name: '분필',     emoji: '🖍️', hp: 5,   speed: 0.6,  r: 8,  dmg: 4,  xp: 2,  ai: 'shoot', fireCd: 110 },
    group:   { name: '조별과제', emoji: '👥', hp: 10,  speed: 0.55, r: 12, dmg: 8,  xp: 3,  ai: 'chase' },
    teacher: { name: '담임',     emoji: '👨‍🏫', hp: 120, speed: 0.5,  r: 20, dmg: 14, xp: 14, ai: 'elite', fireCd: 150 },
    boss:    { name: '기말고사', emoji: '📚', hp: 520, speed: 0.4,  r: 30, dmg: 12, xp: 30, ai: 'boss' },
  };

  // 시간대별 웨이브 (초). interval은 틱 단위 스폰 간격, n은 한 번에 나오는 수, w는 종류별 가중치
  const WAVES = [
    { from: 0,  to: 20,  interval: 52, n: 1, w: { hw: 6, test: 3 } },
    { from: 20, to: 45,  interval: 40, n: 2, w: { hw: 5, test: 4, alarm: 1, late: 2 } },
    { from: 45, to: 75,  interval: 30, n: 2, w: { hw: 4, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
    { from: 75, to: 121, interval: 22, n: 3, w: { hw: 3, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
  ];

  // 포위 이벤트: 플레이어 주위를 원형으로 둘러싸고 몰려옴
  const SWARMS = [
    { t: 30,  type: 'test', n: 10, text: '쪽지시험 포위!' },
    { t: 62,  type: 'late', n: 8, text: '지각 러시!' },
    { t: 100, type: 'hw',   n: 16, text: '숙제 폭탄!' },
  ];

  function derive(st) {
    let cooldown = 22 * Math.pow(0.85, st.rate);
    let dmg = 1 + 0.35 * st.dmg;
    let pierce = st.pierce;
    let crit = 0.1 * st.crit;
    const syn = [];
    if (st.rate >= 2 && st.dmg >= 2) { dmg *= 1.2; syn.push('focus'); }
    if (st.multi >= 2 && st.pierce >= 1) { pierce += 1; syn.push('shotgun'); }
    if (st.crit >= 2 && st.rate >= 2) { crit += 0.1; syn.push('exam'); }
    let novaR = 60 + 12 * st.nova;
    if (st.orbit >= 2 && st.nova >= 1) { novaR *= 1.3; syn.push('bellring'); }
    const base = 1 + 0.35 * st.dmg;
    return {
      cooldown: Math.max(6, Math.round(cooldown)),
      shots: 1 + st.multi,
      dmg,
      speed: 2.1 * (1 + 0.12 * st.speed),
      magnet: 50 + 22 * st.magnet,
      pierce,
      crit: Math.min(0.9, crit),
      critMul: 2,
      novaInt: st.nova > 0 ? Math.max(100, 300 - 40 * st.nova) : 0,
      novaR,
      novaDmg: (4 + 3 * st.nova) * base,
      orbN: st.orbit,
      orbDmg: 1.5 * base,
      regen: 0.8 * st.regen / TICK,
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
    /** @param {{seed:number, echoes?:Array, events?:boolean}} opts  echoes: [{path:number[], ups:[{t,id}]}] */
    constructor(opts) {
      this.seed = opts.seed >>> 0;
      this.rng = mulberry32(this.seed);
      this.emitOn = opts.events !== false;
      this.events = [];
      this.tick = 0;
      this.player = {
        x: W / 2, y: H * 0.45, hp: 130, maxhp: 130, r: 7, xp: 0, level: 1, need: 4,
        inv: 0, cd: 0, stats: newStats(), syn: {},
      };
      this.enemies = [];
      this.bullets = [];
      this.ebullets = [];      // 적 탄환
      this.orbs = [];          // 형광펜(렌더용, 매 틱 재계산)
      this.gems = [];
      this.fx = [];            // 렌더용 임시 이펙트 {x,y,t,kind}
      this.kills = 0;
      this.swarmIdx = 0;
      this.bossSpawned = false;
      this.bossDead = false;
      this.over = false;
      this.result = null;      // 'dead' | 'clear' | 'survive'
      this.choices = null;     // 레벨업 대기 중이면 3택1 배열
      this.rec = { path: [], ups: [] };
      const list = (opts.echoes || []).slice(-MAX_ECHOES);
      this.echoes = list.map((e, i) => ({
        path: e.path, ups: e.ups || [],
        x: e.path[0] || 0, y: e.path[1] || 0,
        cd: (i * 5) % 20, stats: newStats(), upIdx: 0, alive: true, id: i,
        hp: TUNING.echoHp, inv: 0,
        // 오래된 에코일수록 약해진다 (가장 최근 에코 = 풀 파워)
        power: TUNING.echoBasePower * Math.max(TUNING.echoMinPower, 1 - TUNING.echoAgeDecay * (list.length - 1 - i)),
      }));
    }

    _ev(o) { if (this.emitOn) this.events.push(o); }
    drainEvents() { const e = this.events; this.events = []; return e; }

    choose(id) {
      if (!this.choices) return;
      const p = this.player;
      const up = UPGRADES.find((u) => u.id === id);
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
      this.choices = null;
    }

    _levelUp() {
      const p = this.player;
      p.level += 1; p.xp -= p.need; p.need = Math.round(4 + p.level * 2.8);
      const pool = UPGRADES.filter((u) => {
        if (u.instant) return p.hp <= p.maxhp * 0.9;
        return p.stats[u.id] < MAX_LEVEL;
      });
      const picks = [];
      for (let i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
      this.choices = picks;
      this._ev({ k: 'levelup' });
    }

    /* ---------- 스폰 ---------- */
    _hpScale() {
      const progress = this.tick / RUN_TICKS;
      return (1 + progress * TUNING.hpGrowth) * (1 + TUNING.echoHpScale * this.echoes.length);
    }

    _make(type, x, y) {
      const b = ENEMY_TYPES[type];
      const progress = this.tick / RUN_TICKS;
      const hp = type === 'boss' ? b.hp * (1 + TUNING.echoBossScale * this.echoes.length) : b.hp * this._hpScale();
      const cdBase = b.fireCd || b.dashCd || 150;
      this.enemies.push({
        type, x, y, hp, maxhp: hp, r: b.r, speed: b.speed * (1 + progress * TUNING.enemySpeedGrowth), dmg: b.dmg, xp: b.xp,
        flash: 0, ocd: 0, cd: Math.round(cdBase * (0.4 + 0.6 * this.rng())), dashT: 0, dvx: 0, dvy: 0, warn: false,
        phase: 1, t: 0,
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
      this._ev({ k: 'banner', text: '⚠ ' + s.text });
    }

    _spawnLogic(t) {
      const sec = t / TICK;
      const wave = WAVES.find((w) => sec >= w.from && sec < w.to) || WAVES[WAVES.length - 1];
      const interval = t >= BOSS_TICK ? wave.interval * 2 : wave.interval;   // 보스전 중에는 졸개 스폰을 절반으로
      if (t % interval === 0) for (let i = 0; i < wave.n; i++) this._spawn(wave);
      while (this.swarmIdx < SWARMS.length && t >= SWARMS[this.swarmIdx].t * TICK) this._ring(SWARMS[this.swarmIdx++]);
      if (t === ELITE_TICK) { this._make('teacher', W / 2, -30); this._ev({ k: 'banner', text: '⚠ 담임 선생님 등장' }); }
      if (t === BOSS_TICK - 180) this._ev({ k: 'banner', text: '⚠ 기말고사 접근 중 ⚠' });
      if (t === BOSS_TICK && !this.bossSpawned) { this._make('boss', W / 2, -30); this.bossSpawned = true; this._ev({ k: 'boss' }); }
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
      const target = this._nearest(x, y, 260);
      if (!target) return false;
      const base = Math.atan2(target.y - y, target.x - x);
      const n = d.shots;
      const spread = 0.16;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        const crit = d.crit > 0 && this.rng() < d.crit;
        this.bullets.push({
          x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
          dmg: d.dmg * pm * (crit ? d.critMul : 1), crit, pierce: d.pierce, life: 46, owner, hit: [],
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

    _hurtPlayer(dmg) {
      const p = this.player;
      p.hp -= dmg * TUNING.damageTaken; p.inv = TUNING.hurtInvTicks;
      this.fx.push({ x: p.x, y: p.y, t: 10, kind: 'hurt' });
      this._ev({ k: 'hurt' });
    }

    _hurtEcho(ec, dmg) {
      ec.hp -= dmg * TUNING.echoDamageTaken; ec.inv = 30;
      if (ec.hp <= 0 && ec.alive) {
        ec.alive = false;
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
      for (let k = 0; k < d.orbN; k++) {
        const ang = t * 0.07 + (k * Math.PI * 2) / d.orbN;
        const ox = a.x + Math.cos(ang) * 34, oy = a.y + Math.sin(ang) * 34;
        this.orbs.push({ x: ox, y: oy, owner });
        for (const e of this.enemies) {
          if (e.ocd > 0 || e.hp <= 0) continue;
          const rr = e.r + 6;
          if ((e.x - ox) * (e.x - ox) + (e.y - oy) * (e.y - oy) < rr * rr) { this._hitEnemy(e, d.orbDmg * pm, owner, false); e.ocd = 12; }
        }
      }
    }

    /** 보스 3페이즈. 이동량 {x,y} 반환 */
    _bossAI(e, ux, uy, dist) {
      const hpR = e.hp / e.maxhp;
      const phase = hpR > 0.66 ? 1 : hpR > 0.33 ? 2 : 3;
      if (phase !== e.phase) {
        e.phase = phase;
        this._ev({ k: 'phase', phase });
        this.fx.push({ x: e.x, y: e.y, t: 24, kind: 'nova', r: 120 });
      }
      e.t += 1;
      const p = this.player;
      if (e.t % 200 === 0) {
        const n = phase === 1 ? 6 : 9;
        const off = (e.t / 200) * 0.3;
        for (let i = 0; i < n; i++) this._ebullet(e.x, e.y, off + (i / n) * Math.PI * 2, 1.6, 5);
      }
      if (phase >= 2 && e.t % 420 === 0) {
        for (let i = 0; i < 4; i++) {
          if (this.enemies.length >= MAX_ENEMIES) break;
          const a = (i / 4) * Math.PI * 2;
          this._make('hw', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
        }
      }
      if (phase === 3 && e.t % 110 === 0) {
        const base = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = -1; i <= 1; i++) this._ebullet(e.x, e.y, base + i * 0.2, 2.3, 5);
      }
      const sp = e.speed * (phase === 3 ? 1.4 : 1);
      return { x: ux * sp, y: uy * sp };
    }

    _killEnemy(i) {
      const e = this.enemies[i];
      this.kills += 1;
      const big = e.type === 'boss' ? 12 : e.type === 'teacher' ? 6 : 1;
      const v = e.type === 'boss' ? 3 : e.type === 'teacher' ? Math.ceil(e.xp / 6) : e.xp;
      for (let g = 0; g < big; g++) this.gems.push({ x: e.x + (this.rng() - 0.5) * 14, y: e.y + (this.rng() - 0.5) * 14, v });
      this.fx.push({ x: e.x, y: e.y, t: 14, kind: 'pop' });
      this._ev({ k: 'kill' });
      if (e.type === 'boss') this.bossDead = true;
      if (e.type === 'teacher') {
        const p = this.player;
        p.hp = Math.min(p.maxhp, p.hp + 25);
        this._ev({ k: 'heal' });
        this._ev({ k: 'banner', text: '담임 격파! 체력 +25' });
      }
      this.enemies[i] = this.enemies[this.enemies.length - 1]; this.enemies.pop();
      if (e.type === 'group') {
        for (let s = 0; s < 2; s++) if (this.enemies.length < MAX_ENEMIES) this._make('hw', e.x + (s ? 8 : -8), e.y);
      }
    }

    /** input: {dx,dy} (각 -1..1, 길이 ≤ 1). 레벨업 대기·종료 시 진행하지 않는다. */
    step(input) {
      if (this.over || this.choices) return;
      const p = this.player;
      const t = this.tick;
      this.orbs.length = 0;
      if (p.inv > 0) p.inv -= 1;

      // 이동 + 기록
      const d = derive(p.stats);
      let dx = input.dx || 0, dy = input.dy || 0;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      p.x = Math.min(W - p.r, Math.max(p.r, p.x + dx * d.speed));
      p.y = Math.min(H - p.r, Math.max(p.r, p.y + dy * d.speed));
      this.rec.path.push(p.x, p.y);

      this._spawnLogic(t);

      // 플레이어 공격/스킬/재생
      p.cd -= 1;
      if (p.cd <= 0 && this._fire(p.x, p.y, d, 'player', 1)) p.cd = d.cooldown;
      this._skills(p, d, 1, t, 'player');
      if (d.regen && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + d.regen);

      // 에코 재생
      const boost = 1 + 0.15 * p.stats.echo;
      for (const ec of this.echoes) {
        if (!ec.alive) continue;
        if (t * 2 + 1 >= ec.path.length) { ec.alive = false; this.fx.push({ x: ec.x, y: ec.y, t: 20, kind: 'vanish' }); continue; }
        ec.x = ec.path[t * 2]; ec.y = ec.path[t * 2 + 1];
        if (ec.inv > 0) ec.inv -= 1;
        while (ec.upIdx < ec.ups.length && ec.ups[ec.upIdx].t <= t) {
          const id = ec.ups[ec.upIdx].id;
          if (id in ec.stats && id !== 'heal' && id !== 'echo') ec.stats[id] += 1;
          ec.upIdx++;
        }
        const ed = derive(ec.stats);
        const pm = ec.power * boost;
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
      for (let i = this.ebullets.length - 1; i >= 0; i--) {
        const b = this.ebullets[i];
        b.x += b.vx; b.y += b.vy; b.life -= 1;
        let dead = b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20;
        if (!dead && p.inv === 0) {
          const rr = p.r + b.r;
          if ((p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y) < rr * rr) { this._hurtPlayer(b.dmg); dead = true; }
        }
        if (!dead) {
          for (const ec of this.echoes) {
            if (!ec.alive || ec.inv > 0) continue;
            const rr = 8 + b.r;
            if ((ec.x - b.x) * (ec.x - b.x) + (ec.y - b.y) * (ec.y - b.y) < rr * rr) { this._hurtEcho(ec, b.dmg); dead = true; break; }
          }
        }
        if (dead) { this.ebullets[i] = this.ebullets[this.ebullets.length - 1]; this.ebullets.pop(); }
      }

      // 적 이동/AI/접촉/사망
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.hp <= 0) { this._killEnemy(i); continue; }
        if (e.flash > 0) e.flash -= 1;
        if (e.ocd > 0) e.ocd -= 1;
        const bt = ENEMY_TYPES[e.type];
        const ax = p.x - e.x, ay = p.y - e.y;
        const dist = Math.hypot(ax, ay) || 1;
        const ux = ax / dist, uy = ay / dist;
        let mvx = ux * e.speed, mvy = uy * e.speed;

        switch (bt.ai) {
          case 'shoot': {
            const dir = dist > 150 ? 1 : dist < 110 ? -0.8 : 0;
            mvx = ux * e.speed * dir; mvy = uy * e.speed * dir;
            e.cd -= 1;
            if (e.cd <= 0 && dist < 280) { this._ebullet(e.x, e.y, Math.atan2(ay, ax), 2.2, 5); e.cd = bt.fireCd; }
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
          case 'elite': {
            e.cd -= 1;
            if (e.cd <= 0) {
              const base = Math.atan2(ay, ax);
              for (let k = -2; k <= 2; k++) this._ebullet(e.x, e.y, base + k * 0.22, 2.0, 6);
              e.cd = bt.fireCd;
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

        e.x += mvx; e.y += mvy;
        if (p.inv === 0 && dist < e.r + p.r) this._hurtPlayer(e.dmg);
        for (const ec of this.echoes) {
          if (!ec.alive || ec.inv > 0) continue;
          const ex = ec.x - e.x, ey = ec.y - e.y;
          if (ex * ex + ey * ey < (e.r + 8) * (e.r + 8)) this._hurtEcho(ec, e.dmg);
        }
      }

      // 구슬 흡수
      for (let i = this.gems.length - 1; i >= 0; i--) {
        const g = this.gems[i];
        const ax = p.x - g.x, ay = p.y - g.y;
        const dist = Math.hypot(ax, ay);
        if (dist < d.magnet) { g.x += (ax / (dist || 1)) * 4; g.y += (ay / (dist || 1)) * 4; }
        if (dist < p.r + 5) {
          p.xp += g.v;
          this._ev({ k: 'gem' });
          this.gems[i] = this.gems[this.gems.length - 1]; this.gems.pop();
        }
      }
      if (p.xp >= p.need && !this.choices) this._levelUp();

      // 이펙트 수명
      for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t -= 1; if (this.fx[i].t <= 0) { this.fx[i] = this.fx[this.fx.length - 1]; this.fx.pop(); } }

      this.tick += 1;

      if (p.hp <= 0) { this.over = true; this.result = 'dead'; }
      else if (this.bossDead) { this.over = true; this.result = 'clear'; }
      else if (this.tick >= RUN_TICKS && (!this.bossSpawned || this.tick >= RUN_TICKS + OVERTIME_TICKS)) { this.over = true; this.result = 'survive'; }
    }

    /** 이번 판을 다음 판의 에코로 내보낸다. */
    exportEcho() { return { path: this.rec.path.slice(), ups: this.rec.ups.slice(), kills: this.kills, ticks: this.tick }; }
  }

  const api = { Sim, addEcho, mulberry32, derive, UPGRADES, SYNERGIES, ENEMY_TYPES, WAVES, SWARMS, TUNING, W, H, PLAY_BOTTOM, TICK, RUN_TICKS, OVERTIME_TICKS, BOSS_TICK, ELITE_TICK, MAX_ECHOES, MAX_LEVEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
