'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/sim.js');
const Wd = require('../src/worlds.js');
const M = require('../src/meta.js');
const T = require('../src/tutorial.js');
const { WORLDS, ORDER, GEAR } = Wd;

const gearBonus = (a, d) => { const tm = Math.pow(GEAR.atkPer, a); return { dmgMul: tm, teamMul: tm, takenMul: Math.pow(1 / GEAR.defPer, d) }; };

function runBot(sim) {
  while (!sim.over) {
    if (sim.choices) sim.choose(sim.choices[0].id);
    const p = sim.player;
    let ax = 0, ay = 0;
    for (const e of sim.enemies) { const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; ax += dx / d; ay += dy / d; } }
    for (const b of sim.ebullets) { const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy; if (d2 < 60 * 60) { const d = Math.sqrt(d2) || 1; ax += dx / d * 1.5; ay += dy / d * 1.5; } }
    for (const h of sim.hazards) if (Math.abs(p.y - h.y) < 60) ay += (p.y > h.y ? 1 : -1) * 3;
    if (ax === 0 && ay === 0 && sim.gems.length) {
      let best = null, bd = Infinity;
      for (const g of sim.gems) { const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = g; } }
      const d = Math.sqrt(bd) || 1; ax += (best.x - p.x) / d; ay += (best.y - p.y) / d;
    }
    ax += (E.W / 2 - p.x) * 0.004; ay += (E.H / 2 - p.y) * 0.004;
    sim.step({ dx: ax, dy: ay }); sim.drainEvents();
  }
  return sim;
}

/* ---------- 단계 · 권장 장비 ---------- */

test('12개 월드: 뒤로 갈수록, 회차가 오를수록 적이 강하고 권장 장비가 많다', () => {
  assert.strictEqual(ORDER.length, 12);
  let prev = null;
  for (let c = 0; c < 3; c++) for (const id of ORDER) {
    const m = Wd.stageMul(id, c), r = Wd.recommendedGear(id, c);
    assert.strictEqual(m.stage, ORDER.indexOf(id) + 12 * c);
    if (prev) { assert.ok(m.hp > prev.m.hp && m.dmg > prev.m.dmg, `${id} c${c}`); assert.ok(r.atk >= prev.r.atk && r.def >= prev.r.def); }
    prev = { m, r };
  }
  assert.deepStrictEqual(Wd.recommendedGear('school', 0), { atk: 0, def: 0 }, '학교는 장비 없이');
  // 회차가 바뀌면 학교로 돌아가도 마지막 월드보다 어렵다 ("조금씩 더 어렵게")
  assert.ok(Wd.stageMul('school', 1).hp > Wd.stageMul('stage', 0).hp);
  assert.ok(Wd.stageMul('school', 1).speed > 1 && Wd.stageMul('school', 1).spawn > 1);
});

test('권장 장비는 그 회차에 살 수 있는 최대치 안에 있다 (끝까지 갈 수 있다)', () => {
  for (let c = 0; c < 5; c++) {
    const available = 12 * Wd.gearMaxLevel(c);
    const r = Wd.recommendedGear('stage', c);
    assert.ok(r.atk <= available && r.def <= available, `c${c}: 권장 ${r.atk}/${r.def} ≤ ${available}`);
  }
  assert.ok(Wd.recommendedGear('stage', 0).atk <= 12 * 5 * 0.6, '1회차는 여유 있게(최대치의 60% 이하)');
});

test('시뮬레이션: 단계 배율이 적 체력·이동·스폰과 받는 피해에 적용된다', () => {
  const hpOf = (world, cycle) => { const s = new E.Sim({ seed: 1, events: false, world, cycle }); s._make(Object.keys(WORLDS[world].enemies)[0], 0, 0); return s.enemies[0].maxhp; };
  assert.ok(Math.abs(hpOf('school', 1) / hpOf('school', 0) - Wd.stageMul('school', 1).hp) < 1e-9);
  const taken = (world, cycle, bonus) => { const s = new E.Sim({ seed: 2, events: false, world, cycle, bonus }); const hp0 = s.player.hp; s.player.inv = 0; s._hurtPlayer(10); return hp0 - s.player.hp; };
  const base = taken('school', 0);
  const atk = (w) => WORLDS[w].rules.atkMul || 1;   // 월드별 받는 피해 배율(첫 월드는 쉽게)
  assert.ok(Math.abs(taken('stage', 0) / base - Wd.stageMul('stage', 0).dmg * atk('stage') / atk('school')) < 1e-9, '뒤 월드일수록 아프다');
  const rec = Wd.recommendedGear('stage', 0);
  assert.ok(Math.abs(taken('stage', 0, gearBonus(0, rec.def)) / base - atk('stage') / atk('school')) < 0.06 * atk('stage') / atk('school'), '권장 방어 장비면 단계 배율이 상쇄됨');
  // 열차(카트·조명)처럼 막을 수 없는 피해는 그대로
  const s = new E.Sim({ seed: 3, events: false, world: 'stage' }); const hp0 = s.player.hp; s._hurtPlayer(20, true);
  assert.strictEqual(hp0 - s.player.hp, 20);
});

test('장비 공격력은 에코에게도 적용되고, 권장 장비면 보스전 시간이 단계와 무관하게 비슷하다', () => {
  const echoes = Array.from({ length: 10 }, () => ({ path: new Array(9000).fill(100), ups: [{ t: 0, id: 'rate' }], ticks: 4500 }));
  const fp = (bonus) => { const s = new E.Sim({ seed: 4, events: false, echoes, bonus }); return s._firepower(); };
  assert.ok(Math.abs(fp(gearBonus(10, 0)) / fp(gearBonus(0, 0)) - Math.pow(GEAR.atkPer, 10)) < 1e-9, '나+에코 화력이 장비만큼');
  const killTime = (world, cycle, bonus) => {
    const s = new E.Sim({ seed: 5, events: false, world, cycle, echoes: echoes.slice(0, WORLDS[world].boss.needEchoes), bonus });
    s._make('boss', 0, 0, 0); return s.enemies[0].maxhp / s._firepower();
  };
  for (const [w, c] of [['beach', 0], ['stage', 0], ['gym', 1]]) {
    const r = Wd.recommendedGear(w, c);
    const ref = killTime(w, 0, gearBonus(0, 0)) / Wd.stageMul(w, 0).hp * Wd.stageMul(w, 0).hp;   // 같은 월드 정의 기준
    const geared = killTime(w, c, gearBonus(r.atk, r.def));
    const bare = killTime(w, c, gearBonus(0, 0));
    assert.ok(bare > geared * 2, `${w} c${c}: 장비 없으면 훨씬 오래 (${bare.toFixed(0)}s vs ${geared.toFixed(0)}s)`);
    assert.ok(geared < ref * 1.3, `${w} c${c}: 권장 장비면 원래 난이도 근처 (${geared.toFixed(0)}s, 기준 ${ref.toFixed(0)}s)`);
  }
});

test('봇: 뒤 월드·다음 회차는 장비 없이 못 깨고, 권장 장비면 깬다 (에코 10명)', () => {
  for (const [w, c] of [['beach', 0], ['academy', 1]]) {
    const r = Wd.recommendedGear(w, c);
    let bare = 0, geared = 0;
    for (let s = 1; s <= 2; s++) {
      if (runBot(new E.Sim({ seed: s * 131, echoes: T.makeTutorialEchoes(s * 7), world: w, cycle: c, bonus: gearBonus(0, 0) })).result === 'clear') bare++;
      if (runBot(new E.Sim({ seed: s * 131, echoes: T.makeTutorialEchoes(s * 7), world: w, cycle: c, bonus: gearBonus(r.atk, r.def) })).result === 'clear') geared++;
    }
    assert.strictEqual(bare, 0, `${w} c${c}: 장비 없이 ${bare}/2`);
    assert.strictEqual(geared, 2, `${w} c${c}: 권장 장비로 ${geared}/2`);
  }
});

/* ---------- 새 월드 규칙 ---------- */

test('바람: 바닷가·산에서는 가만히 있어도 좌우로 밀린다', () => {
  for (const w of ['beach', 'mountain']) {
    const s = new E.Sim({ seed: 6, events: false, world: w });
    const xs = [];
    for (let i = 0; i < WORLDS[w].rules.wind.period * 60; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); xs.push(s.player.x); }
    assert.ok(Math.max(...xs) - Math.min(...xs) > 20, `${w}: 밀린 폭 ${(Math.max(...xs) - Math.min(...xs)).toFixed(1)}`);
  }
  const s = new E.Sim({ seed: 6, events: false, world: 'school' });
  for (let i = 0; i < 300; i++) s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.player.x, E.W / 2, '바람 없는 월드는 그대로');
});

test('시야: 밤·안개 월드는 자동 조준 거리가 짧다', () => {
  const canHit = (w, dist) => { const s = new E.Sim({ seed: 7, events: false, world: w }); s._make(Object.keys(WORLDS[w].enemies)[0], s.player.x + dist, s.player.y); return s._fire(s.player.x, s.player.y, { shots: 1, dmg: 1, crit: 0, critMul: 2, pierce: 0 }, 'player', 1); };
  assert.strictEqual(canHit('school', 240), true);
  assert.strictEqual(canHit('home', 240), false, '집(밤): 240px 밖은 조준 안 됨');
  assert.strictEqual(canHit('home', 150), true);
});

test('공항·꿈의 무대: 열차 대신 카트·조명이 지나가고 안내 문구가 월드별로 다르다', () => {
  for (const w of ['airport', 'stage']) {
    const tr = WORLDS[w].rules.trains;
    assert.ok(tr.emoji && tr.text);
    const s = new E.Sim({ seed: 8, events: true, world: w });
    let ev = null;
    while (!ev && s.tick < (tr.first + 1) * 60) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: 0, dy: 0 }); ev = s.drainEvents().find((e) => e.k === 'train'); }
    assert.ok(ev, `${w}: 위험물 등장`); assert.strictEqual(ev.text, tr.text);
  }
});

/* ---------- 매점 장비 · 회차 (메타) ---------- */

test('매점 장비: 월드마다 ⚔·🛡 하나씩, 도착한 월드만 살 수 있고 최대 레벨까지', () => {
  assert.strictEqual(M.GEAR_ITEMS.length, 24);
  const s = M.defaultSave(); s.coins = 1e7;
  assert.strictEqual(M.buyGear(s, 'academy:atk').reason, 'locked', '아직 학원에 못 감');
  for (let i = 0; i < 5; i++) assert.strictEqual(M.buyGear(s, 'school:atk').ok, true);
  assert.strictEqual(M.buyGear(s, 'school:atk').reason, 'max');
  assert.strictEqual(M.buyGear(s, 'nope').reason, 'unknown');
  s.worlds.cycleClears.school = 1;
  assert.strictEqual(M.buyGear(s, 'academy:atk').ok, true, '학원이 열리면 학원 장비 입고');
  const before = M.gearCost(s, 'stage:atk');
  M.buyGear(s, 'academy:atk');
  assert.ok(M.gearCost(s, 'stage:atk') > before, '⚔를 살수록 다음 ⚔가 비싸진다 (어느 월드 장비든 같은 값)');
  assert.strictEqual(M.gearCost(s, 'stage:atk'), M.gearCost(s, 'school:atk'));
  assert.strictEqual(M.gearCost(s, 'school:def'), M.GEAR.costBase, '🛡은 🛡 산 만큼만 영향');
  const poor = M.defaultSave();
  assert.strictEqual(M.buyGear(poor, 'school:def').reason, 'coins');
});

test('장비는 보너스로 전달된다: 팀 공격력(나+에코)과 받는 피해', () => {
  const s = M.defaultSave(); s.gear = { 'school:atk': 5, 'academy:atk': 2, 'school:def': 4 };
  assert.deepStrictEqual(M.gearTotals(s), { atk: 7, def: 4 });
  const b = M.bonusFor(s);
  assert.ok(Math.abs(b.teamMul - Math.pow(GEAR.atkPer, 7)) < 1e-12);
  assert.ok(Math.abs(b.dmgMul - Math.pow(GEAR.atkPer, 7)) < 1e-12, '플레이어 공격력에도 포함');
  assert.ok(Math.abs(b.takenMul - Math.pow(1 / GEAR.defPer, 4)) < 1e-12);
});

const clearRun = (world) => ({ kills: 300, seconds: 160, level: 15, result: 'clear', gems: 100, echoes: 10, world, helped: 0 });

test('회차: 12번째 월드를 극복하면 2회차 — 학교부터 다시, 장비 최대 레벨 +5, 모든 매점 열림', () => {
  const s = M.defaultSave();
  for (let i = 0; i < ORDER.length - 1; i++) {
    const r = M.recordRun(s, clearRun(ORDER[i]), '2026-11-20');
    assert.strictEqual(r.newWorld, ORDER[i + 1], `${ORDER[i]} 극복 → ${ORDER[i + 1]} 열림`);
    assert.strictEqual(r.newCycle, null);
  }
  s.worlds.selected = 'stage';
  const r = M.recordRun(s, clearRun('stage'), '2026-11-20');
  assert.strictEqual(r.newCycle, 1); assert.strictEqual(s.cycle, 1); assert.strictEqual(r.newWorld, null);
  assert.strictEqual(s.worlds.selected, 'school');
  assert.deepStrictEqual(s.worlds.cycleClears, {}, '이번 회차 진행은 처음부터');
  assert.strictEqual(M.worldUnlocked(s, 'academy'), false, '2회차는 다시 학교부터 차례로');
  assert.strictEqual(s.worlds.clears.stage, 1, '전체 기록은 남는다');
  assert.ok(r.newAch.some((a) => a.id === 'cycle_2') && r.newAch.some((a) => a.id === 'clear_stage'));
  assert.strictEqual(M.gearMax(s), 10);
  assert.strictEqual(M.gearAvailable(s, 'stage'), true, '한 바퀴 돈 뒤에는 모든 월드 장비를 살 수 있다');
});

test('회차가 높을수록 학점을 더 받는다', () => {
  const a = M.defaultSave(), b = M.defaultSave(); b.cycle = 2;
  const run = { kills: 100, seconds: 60, level: 8, result: 'dead', gems: 10, echoes: 0, world: 'school', helped: 0 };
  const ea = M.recordRun(a, run, '2026-11-20').earned, eb = M.recordRun(b, run, '2026-11-20').earned;
  assert.ok(Math.abs(eb / ea - M.rewardMul('school', 2)) < 0.02, `${ea} → ${eb}`);
});

test('저장 정리: 장비 레벨은 회차 최대치로 제한, 옛 저장은 기존 극복 기록으로 이번 회차 진행을 이어간다', () => {
  const s = M.sanitize({ cycle: 0, gear: { 'school:atk': 99, 'zzz:atk': 3, 'gym:def': -1, 'home:def': 2.7 } });
  assert.deepStrictEqual(s.gear, { 'school:atk': 5, 'home:def': 2 });
  const s2 = M.sanitize({ cycle: 1, gear: { 'school:atk': 99 } });
  assert.strictEqual(s2.gear['school:atk'], 10);
  const old = M.sanitize({ stats: { runs: 9 }, worlds: { selected: 'office', clears: { school: 3, academy: 1 } } });
  assert.deepStrictEqual(old.worlds.cycleClears, { school: 3, academy: 1 });
  assert.strictEqual(old.worlds.selected, 'office', '옛 저장도 열려 있던 월드는 그대로');
  assert.strictEqual(M.sanitize({ cycle: -3 }).cycle, 0);
  const back = M.importCode(M.exportCode(Object.assign(M.defaultSave(), { cycle: 2, gear: { 'stage:def': 7 } })));
  assert.strictEqual(back.cycle, 2); assert.strictEqual(back.gear['stage:def'], 7);
});

test('끝없는 회차: 몇 회차가 되어도 권장 장비를 살 수 있고, 장비값 대비 수입 비율이 일정하다', () => {
  let prevRatio = null;
  for (let c = 0; c <= 40; c++) {
    for (const w of ['school', 'stage']) {
      const rec = Wd.recommendedGear(w, c);
      const cap = 12 * Wd.gearMaxLevel(c);
      assert.ok(rec.atk <= cap * 0.9 && rec.def <= cap * 0.9, `c${c} ${w}: 권장 ${rec.atk}/${rec.def} ≤ 최대 ${cap}의 90%`);
      // 이 단계에 필요한 다음 장비 한 레벨 값 ÷ 이 단계 한 판 수입(같은 성적 기준)
      const cost = Wd.gearCost('atk', rec.atk) + Wd.gearCost('def', rec.def);
      const income = 200 * Wd.rewardMul(w, c);
      const ratio = cost / income;
      assert.ok(Number.isFinite(ratio) && ratio > 0.3 && ratio < 3, `c${c} ${w}: 장비값/수입 ${ratio.toFixed(2)}`);
      if (prevRatio !== null) assert.ok(Math.abs(ratio / prevRatio - 1) < 0.6, '비율이 갑자기 튀지 않음');
      prevRatio = ratio;
    }
  }
  // 적은 계속 강해지고(체력·피해), 장비로 산 총알 위력도 계속 커진다
  assert.ok(Wd.stageMul('stage', 40).hp > Wd.stageMul('stage', 20).hp * 100);
  assert.ok(Math.pow(GEAR.atkPer, Wd.recommendedGear('stage', 40).atk) >= Wd.stageMul('stage', 40).hp * 0.99);
});

test('큰 숫자는 짧게 표시된다 (만·억·조)', () => {
  assert.strictEqual(M.fmtNum(9999), '9999');
  assert.strictEqual(M.fmtNum(12345), '1.2만');
  assert.strictEqual(M.fmtNum(300000000), '3억');
  assert.strictEqual(M.fmtNum(4.5e12), '4.5조');
});

test('회차별 복장: 5회차마다 새 복장(20종) · 그 사이엔 장식이 늘고 · 100회차 뒤 색 변형 · 1000회차 뒤 처음으로', () => {
  assert.strictEqual(Wd.OUTFITS.length, 20);
  const o = Wd.outfitOf;
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((c) => o(c).style), [0, 0, 0, 0, 0]);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((c) => o(c).stars), [1, 2, 3, 4, 5], '같은 복장에 장식이 하나씩');
  assert.strictEqual(o(5).style, 1); assert.strictEqual(o(5).stars, 1, '5회차마다 새 복장');
  assert.strictEqual(o(99).style, 19); assert.strictEqual(o(99).variant, 0);
  assert.strictEqual(o(100).style, 0); assert.strictEqual(o(100).variant, 1, '100회차 뒤에는 색만 바꿔 처음 복장부터');
  assert.strictEqual(o(999).variant, 9);
  assert.deepStrictEqual(o(1000), o(0), '1000회차 뒤에는 처음 복장으로');
  assert.deepStrictEqual(o(2345), o(345));
  const keys = new Set(); for (let c = 0; c < 1000; c++) keys.add(o(c).key);
  assert.strictEqual(keys.size, 1000, '1000회차 동안 모두 다른 모습');
});
