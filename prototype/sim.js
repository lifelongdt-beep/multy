/* 퇴근 에코 — 결정론적 시뮬레이션 코어 (DOM 의존 없음)
 * 고정 60Hz 타임스텝 + 시드 난수. 에코는 "이동 경로 + 강화 기록"만 저장하고
 * 매 틱 재생한다. (공격/피격은 현재 판의 적을 대상으로 실시간 계산) */
(function (root) {
  'use strict';

  const W = 360, H = 640;
  const TICK = 60;
  const RUN_TICKS = 120 * TICK;
  const BOSS_TICK = 90 * TICK;
  const MAX_ECHOES = 10;
  const MAX_ENEMIES = 260;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const UPGRADES = [
    { id: 'rate',   name: '샤프 속도↑',   desc: '발사 간격 -15%' },
    { id: 'multi',  name: '지우개 +1',     desc: '동시 발사 수 +1' },
    { id: 'dmg',    name: '필기 강화',     desc: '공격력 +35%' },
    { id: 'speed',  name: '운동화',         desc: '이동속도 +12%' },
    { id: 'magnet', name: '자석 필통',      desc: '구슬 흡수 범위 +' },
    { id: 'pierce', name: '관통 샤프심',    desc: '관통 +1' },
  ];

  // 학교 월드 적
  const ENEMY_TYPES = {
    hw:    { name: '숙제',     emoji: '📄', hp: 3,  speed: 0.7, r: 9,  dmg: 6,  xp: 1 },
    test:  { name: '쪽지시험', emoji: '📝', hp: 2,  speed: 1.1, r: 8,  dmg: 5,  xp: 1 },
    alarm: { name: '학원알림', emoji: '🔔', hp: 14, speed: 0.5,  r: 14, dmg: 10, xp: 4 },
    boss:  { name: '기말고사', emoji: '📚', hp: 700, speed: 0.45, r: 30, dmg: 18, xp: 30 },
  };

  function derive(stats) {
    return {
      cooldown: Math.max(6, Math.round(26 * Math.pow(0.85, stats.rate))),
      shots: 1 + stats.multi,
      dmg: 1 + 0.35 * stats.dmg,
      speed: 2.1 * (1 + 0.12 * stats.speed),
      magnet: 38 + 22 * stats.magnet,
      pierce: stats.pierce,
    };
  }

  function newStats() { return { rate: 0, multi: 0, dmg: 0, speed: 0, magnet: 0, pierce: 0 }; }

  class Sim {
    /** @param {{seed:number, echoes?:Array}} opts  echoes: [{path:number[], ups:[{t,id}]}] */
    constructor(opts) {
      this.seed = opts.seed >>> 0;
      this.rng = mulberry32(this.seed);
      this.tick = 0;
      this.player = { x: W / 2, y: H * 0.65, hp: 100, maxhp: 100, r: 7, xp: 0, level: 1, need: 5, inv: 0, cd: 0, stats: newStats() };
      this.enemies = [];
      this.bullets = [];
      this.gems = [];
      this.fx = [];            // 렌더용 임시 이펙트 {x,y,t,kind}
      this.kills = 0;
      this.bossSpawned = false;
      this.bossDead = false;
      this.over = false;
      this.result = null;      // 'dead' | 'clear' | 'survive'
      this.choices = null;     // 레벨업 대기 중이면 3택1 배열
      this.rec = { path: [], ups: [] };
      this.echoes = (opts.echoes || []).slice(-MAX_ECHOES).map((e, i) => ({
        path: e.path, ups: e.ups, x: 0, y: 0, cd: (i * 5) % 20, stats: newStats(), upIdx: 0, alive: true, id: i,
      }));
    }

    choose(id) {
      if (!this.choices) return;
      const p = this.player;
      p.stats[id] += 1;
      this.rec.ups.push({ t: this.tick, id });
      this.choices = null;
    }

    _levelUp() {
      const p = this.player;
      p.level += 1; p.xp -= p.need; p.need = Math.round(5 + p.level * 3.2);
      const pool = UPGRADES.slice();
      const picks = [];
      for (let i = 0; i < 3; i++) picks.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
      this.choices = picks;
    }

    _spawn() {
      if (this.enemies.length >= MAX_ENEMIES) return;
      const t = this.tick;
      const r = this.rng;
      const side = Math.floor(r() * 4);
      let x, y;
      if (side === 0) { x = r() * W; y = -12; }
      else if (side === 1) { x = W + 12; y = r() * H; }
      else if (side === 2) { x = r() * W; y = H + 12; }
      else { x = -12; y = r() * H; }
      const roll = r();
      const progress = t / RUN_TICKS;
      let type = 'hw';
      if (roll < 0.28) type = 'test';
      if (roll > 0.9 - 0.08 * progress) type = 'alarm';
      const b = ENEMY_TYPES[type];
      const hpScale = 1 + progress * 2.0;
      this.enemies.push({ type, x, y, hp: b.hp * hpScale, maxhp: b.hp * hpScale, r: b.r, speed: b.speed * (1 + progress * 0.25), dmg: b.dmg, xp: b.xp, flash: 0 });
    }

    _spawnBoss() {
      const b = ENEMY_TYPES.boss;
      this.enemies.push({ type: 'boss', x: W / 2, y: -30, hp: b.hp, maxhp: b.hp, r: b.r, speed: b.speed, dmg: b.dmg, xp: b.xp, flash: 0 });
      this.bossSpawned = true;
    }

    _nearest(x, y, range) {
      let best = null, bd = range * range;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    _fire(x, y, d, owner) {
      const target = this._nearest(x, y, 260);
      if (!target) return false;
      const base = Math.atan2(target.y - y, target.x - x);
      const n = d.shots;
      const spread = 0.16;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        this.bullets.push({ x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dmg: d.dmg * (owner === 'echo' ? 0.9 : 1), pierce: d.pierce, life: 46, owner, hit: [] });
      }
      return true;
    }

    _hitEnemy(e, dmg) {
      e.hp -= dmg; e.flash = 4;
    }

    /** input: {dx,dy} (각 -1..1, 길이 ≤ 1). 레벨업 대기·종료 시 진행하지 않는다. */
    step(input) {
      if (this.over || this.choices) return;
      const p = this.player;
      const t = this.tick;

      // 이동 + 기록
      const d = derive(p.stats);
      let dx = input.dx || 0, dy = input.dy || 0;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      p.x = Math.min(W - p.r, Math.max(p.r, p.x + dx * d.speed));
      p.y = Math.min(H - p.r, Math.max(p.r, p.y + dy * d.speed));
      this.rec.path.push(p.x, p.y);

      // 스폰
      const progress = t / RUN_TICKS;
      const interval = Math.max(8, Math.round(46 - 36 * progress));
      if (t % interval === 0) {
        const n = 1 + Math.floor(progress * 3.5);
        for (let i = 0; i < n; i++) this._spawn();
      }
      if (t === BOSS_TICK && !this.bossSpawned) this._spawnBoss();

      // 플레이어 공격
      p.cd -= 1;
      if (p.cd <= 0 && this._fire(p.x, p.y, d, 'player')) p.cd = d.cooldown;

      // 에코 재생
      for (const ec of this.echoes) {
        if (!ec.alive) continue;
        if (t * 2 + 1 >= ec.path.length) { ec.alive = false; this.fx.push({ x: ec.x, y: ec.y, t: 20, kind: 'vanish' }); continue; }
        ec.x = ec.path[t * 2]; ec.y = ec.path[t * 2 + 1];
        while (ec.upIdx < ec.ups.length && ec.ups[ec.upIdx].t <= t) { ec.stats[ec.ups[ec.upIdx].id] += 1; ec.upIdx++; }
        ec.cd -= 1;
        if (ec.cd <= 0) {
          const ed = derive(ec.stats);
          if (this._fire(ec.x, ec.y, ed, 'echo')) ec.cd = ed.cooldown;
        }
      }

      // 탄환
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
              this._hitEnemy(e, b.dmg);
              b.hit.push(e);
              if (b.pierce <= 0) { dead = true; break; }
              b.pierce -= 1;
            }
          }
        }
        if (dead) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); }
      }

      // 적 이동/접촉/사망
      if (p.inv > 0) p.inv -= 1;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.hp <= 0) {
          this.kills += 1;
          const gems = e.type === 'boss' ? 12 : 1;
          for (let g = 0; g < gems; g++) this.gems.push({ x: e.x + (this.rng() - 0.5) * 14, y: e.y + (this.rng() - 0.5) * 14, v: e.type === 'boss' ? 3 : e.xp });
          this.fx.push({ x: e.x, y: e.y, t: 14, kind: 'pop' });
          if (e.type === 'boss') this.bossDead = true;
          this.enemies[i] = this.enemies[this.enemies.length - 1]; this.enemies.pop();
          continue;
        }
        if (e.flash > 0) e.flash -= 1;
        const ax = p.x - e.x, ay = p.y - e.y;
        const dist = Math.hypot(ax, ay) || 1;
        e.x += (ax / dist) * e.speed; e.y += (ay / dist) * e.speed;
        if (p.inv === 0 && dist < e.r + p.r) {
          p.hp -= e.dmg; p.inv = 40;
          this.fx.push({ x: p.x, y: p.y, t: 10, kind: 'hurt' });
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
          this.gems[i] = this.gems[this.gems.length - 1]; this.gems.pop();
        }
      }
      if (p.xp >= p.need && !this.choices) this._levelUp();

      // 이펙트 수명
      for (let i = this.fx.length - 1; i >= 0; i--) { this.fx[i].t -= 1; if (this.fx[i].t <= 0) { this.fx[i] = this.fx[this.fx.length - 1]; this.fx.pop(); } }

      this.tick += 1;

      if (p.hp <= 0) { this.over = true; this.result = 'dead'; }
      else if (this.bossDead) { this.over = true; this.result = 'clear'; }
      else if (this.tick >= RUN_TICKS) { this.over = true; this.result = 'survive'; }
    }

    /** 이번 판을 다음 판의 에코로 내보낸다. */
    exportEcho() { return { path: this.rec.path.slice(), ups: this.rec.ups.slice(), kills: this.kills, ticks: this.tick }; }
  }

  const api = { Sim, mulberry32, derive, UPGRADES, ENEMY_TYPES, W, H, TICK, RUN_TICKS, BOSS_TICK, MAX_ECHOES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
