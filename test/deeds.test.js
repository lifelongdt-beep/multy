'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Sim, TUNING, TICK } = require('../src/sim.js');

function run(sim, ticks, hook) { for (let i = 0; i < ticks && !sim.over; i++) { if (hook) hook(sim); sim.step({ x: 0, y: 0 }); } }
const pick = (s) => { if (s.choices) s.choose(s.choices[0].id); };

test('곤란한 사람이 나타나고 둘러싼 방해 요소를 모두 물리치면 선행 카드가 나온다', () => {
  const s = new Sim({ seed: 7, echoes: [], world: 'school' });
  s.player.hp = 1e9;
  run(s, TUNING.deedRescueFirst * TICK + 2, pick);
  const rs = s.deeds.rescue;
  assert.ok(rs, '곤란한 사람 등장');
  assert.strictEqual(rs.guards.length, TUNING.deedRescueGuards);
  for (const e of rs.guards) e.hp = 0;     // 모두 물리침
  const before = s.deeds.done;
  s.step({ x: 0, y: 0 });
  assert.strictEqual(rs.state, 'done');
  assert.strictEqual(s.deeds.done, before + 1);
  assert.strictEqual(s.choiceKind, 'deed');
  assert.ok(s.choices.every((u) => u.deed));
});

test('사람은 적이 아니다: 곤란한 사람·친구는 적 목록에 없다', () => {
  const s = new Sim({ seed: 3, echoes: [], world: 'school' });
  s.player.hp = 1e9;
  run(s, TUNING.deedEscortFirst * TICK + 2, pick);
  assert.ok(s.deeds.escort, '친구 등장');
  for (const e of s.enemies) { assert.notStrictEqual(e, s.deeds.escort); assert.notStrictEqual(e, s.deeds.rescue); }
});

test('친구는 내가 곁에 있을 때만 걷고, 도착하면 아이템 하나는 바로 얻는다', () => {
  const s = new Sim({ seed: 11, echoes: [], world: 'school' });
  s.player.hp = 1e9;
  run(s, TUNING.deedEscortFirst * TICK + 1, pick);
  const es = s.deeds.escort; assert.ok(es);
  s.player.x = es.x > 180 ? 20 : 340; s.player.y = 600;   // 멀리
  const x0 = es.x; s.step({ x: 0, y: 0 });
  assert.strictEqual(es.x, x0, '멀면 멈춰 기다림');
  let picks = 0; s.events.length = 0;
  for (let i = 0; i < 2000 && es.state === 'walk'; i++) { s.player.x = es.x; s.player.y = es.y + 20; es.hp = es.maxhp; pick(s); s.step({ x: 0, y: 0 }); picks += s.events.filter((e) => e.k === 'autoPick').length; s.events.length = 0; }
  assert.strictEqual(es.state, 'done');
  assert.ok(picks >= 1);
});

test('작은 선행 거리를 5개 모으면 선행 카드', () => {
  const s = new Sim({ seed: 5, echoes: [], world: 'school' });
  s.player.hp = 1e9;
  let got = 0;
  for (let i = 0; i < 60 * 120 && got < TUNING.deedGaugeNeed; i++) {
    const sp = s.deeds.spots[0];
    if (sp && !s.choices) { s.player.x = sp.x; s.player.y = sp.y; }
    const g = s.deeds.gauge; pick(s); s.step({ x: 0, y: 0 });
    if (s.deeds.gauge > g) got++; else if (s.deeds.gauge === 0 && g === TUNING.deedGaugeNeed - 1) { got++; }
  }
  assert.ok(s.deeds.done >= 1, '게이지가 차서 선물을 받음');
});

test('선행 배치는 같은 시드면 같다 (결정적)', () => {
  const a = new Sim({ seed: 9, echoes: [], world: 'office' }), b = new Sim({ seed: 9, echoes: [], world: 'office' });
  run(a, 3000, pick); run(b, 3000, pick);
  assert.deepStrictEqual(a.deeds.spots.map((p) => [p.x, p.y]), b.deeds.spots.map((p) => [p.x, p.y]));
  assert.strictEqual(a.kills, b.kills);
});

test('도와준 사람은 싸우지 않고 손 흔들며 안전한 곳으로 떠나고, 응원(공격력 +)을 남긴다. 주변 방해 요소는 순해진다', () => {
  const s = new Sim({ seed: 7, echoes: [], world: 'school' });
  s.player.hp = 1e9;
  run(s, TUNING.deedRescueFirst * TICK + 2, pick);
  const rs = s.deeds.rescue;
  for (const e of rs.guards) e.hp = 0;
  s._make(Object.keys(s.world.enemies)[0], rs.x + 20, rs.y);
  const near = s.enemies[s.enemies.length - 1];
  s.step({ x: 0, y: 0 });
  assert.strictEqual(s.allies.length, 1);
  assert.deepStrictEqual(s.deeds.people, [rs.kind]);
  assert.ok(near.calm > 0, '따뜻한 빛을 받아 순해짐');
  assert.ok(s.cheer > 0, '응원을 남김');
  const a = s.allies[0], x0 = a.x;
  let thrown = 0;
  for (let i = 0; i < 180; i++) { pick(s); s.step({ x: 0, y: 0 }); thrown = Math.max(thrown, s.bullets.filter((b) => b.owner === 'ally').length); }
  assert.strictEqual(thrown, 0, '도와준 사람은 싸우지 않는다');
  assert.ok(s.allies.length === 0 || Math.abs(s.allies[0].x - x0) > 50, '만세·손 흔들기 뒤 화면 밖으로 걸어 나감');
  run(s, TUNING.allySec * TICK, pick);
  assert.strictEqual(s.allies.length, 0, '안전한 곳으로 떠남');
  assert.strictEqual(s.cheer, 0, '응원은 시간이 지나면 끝');
});

test('지난 판에 도와준 사람이 찾아와 체력·구슬 선물을 준다', () => {
  const s = new Sim({ seed: 2, echoes: [], world: 'school', visitor: { kind: 'elder' } });
  s.player.hp = s.player.maxhp * 0.3;
  const gems0 = s.gems.length; let gift = false;
  for (let i = 0; i < 60 * 8 && !gift; i++) { s.step({ x: 0, y: 0 }); gift = s.events.some((e) => e.k === 'deed' && e.what === 'visitGift'); s.events.length = 0; }
  assert.ok(gift);
  assert.ok(s.player.hp > s.player.maxhp * 0.5);
  assert.ok(s.gems.length >= gems0 + TUNING.visitorGems - 2);
});

test('응원 중에는 내 총알과 에코 총알의 위력이 cheerDmg만큼 오른다', () => {
  const mk = (cheer) => { const s = new Sim({ seed: 3, echoes: [], world: 'school' }); s._make(Object.keys(s.world.enemies)[0], s.player.x + 60, s.player.y); s.cheer = cheer; s._fire(s.player.x, s.player.y, { dmg: 10, shots: 1, crit: 0, critMul: 2, pierce: 0 }, 'player', 1); return s.bullets[s.bullets.length - 1].dmg; };
  assert.ok(Math.abs(mk(100) - mk(0) * (1 + TUNING.cheerDmg)) < 1e-9);
});
