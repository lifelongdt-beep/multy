'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/sim.js');
const T = require('../src/tutorial.js');
const M = require('../src/meta.js');

// 위협을 피하고 구슬을 모으는 간단한 봇 (처음 하는 사람 정도)
function runBot(sim) {
  while (!sim.over) {
    if (sim.choices) sim.choose(sim.choices[0].id);
    const p = sim.player;
    let ax = 0, ay = 0;
    for (const e of sim.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; ax += dx / d; ay += dy / d; }
    }
    if (ax === 0 && ay === 0 && sim.gems.length) {
      let best = null, bd = Infinity;
      for (const g of sim.gems) { const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = g; } }
      const d = Math.sqrt(bd) || 1; ax += (best.x - p.x) / d; ay += (best.y - p.y) / d;
    }
    ax += (E.W / 2 - p.x) * 0.004; ay += (E.H / 2 - p.y) * 0.004;
    sim.step({ dx: ax, dy: ay });
    sim.drainEvents();
  }
  return sim;
}

test('튜토리얼 에코: 10명, 같은 시드면 같은 결과, 화면 안에서 움직이고 판 끝까지 함께한다', () => {
  const a = T.makeTutorialEchoes(42), b = T.makeTutorialEchoes(42);
  assert.strictEqual(a.length, 10);
  assert.deepStrictEqual(a, b);
  const minTicks = E.RUN_TICKS + E.OVERTIME_TICKS;
  for (const e of a) {
    assert.ok(e.path.length / 2 >= minTicks, '연장전까지 사라지지 않아야 함');
    for (let i = 0; i < e.path.length; i += 2) {
      assert.ok(e.path[i] >= 0 && e.path[i] <= E.W && e.path[i + 1] >= 0 && e.path[i + 1] <= E.H);
      if (i >= 2) assert.ok(Math.hypot(e.path[i] - e.path[i - 2], e.path[i + 1] - e.path[i - 1]) <= 3, '사람처럼 걷는 속도');
    }
    const lv = {};
    for (const u of e.ups) { lv[u.id] = (lv[u.id] || 0) + 1; assert.ok(u.id !== 'heal' && u.id !== 'echo'); }
    for (const id in lv) assert.ok(lv[id] <= E.MAX_LEVEL);
    assert.ok(e.ups.length >= 12, '에코도 충분히 성장해 있어야 함');
  }
});

test('튜토리얼: 에코 10명과 함께라면 처음 하는 사람(봇)도 학교 큰 도전을 넘고, 에코 없이는 어렵다', () => {
  let withEchoes = 0, alone = 0;
  for (let s = 1; s <= 4; s++) {
    if (runBot(new E.Sim({ seed: s * 991, echoes: T.makeTutorialEchoes(s * 77), world: T.TUTORIAL_WORLD, extraSec: T.EXTRA_SEC })).result === 'clear') withEchoes++;
    if (runBot(new E.Sim({ seed: s * 991, echoes: [], world: T.TUTORIAL_WORLD })).result === 'clear') alone++;
  }
  assert.ok(withEchoes >= 3, `에코 10명과 함께 클리어 ${withEchoes}/4`);
  assert.ok(alone < withEchoes, `에코 없이 ${alone}/4 < 에코와 함께 ${withEchoes}/4`);
});

test('튜토리얼 안내 문구는 시간 순서이고 큰 도전(90초) 전에 끝난다', () => {
  for (let i = 1; i < T.TIPS.length; i++) assert.ok(T.TIPS[i].sec > T.TIPS[i - 1].sec);
  assert.ok(T.TIPS[T.TIPS.length - 1].sec < 180);
});

test('저장: 새 사람은 튜토리얼 전, 기존에 플레이하던 저장은 튜토리얼을 마친 것으로 본다', () => {
  assert.strictEqual(M.defaultSave().tutorial, false);
  assert.strictEqual(M.sanitize({ stats: { runs: 0 } }).tutorial, false);
  assert.strictEqual(M.sanitize({ stats: { runs: 3 } }).tutorial, true, '옛 저장(필드 없음)인데 플레이 기록이 있으면 건너뜀');
  assert.strictEqual(M.sanitize({ tutorial: true }).tutorial, true);
  assert.strictEqual(M.sanitize({ tutorial: 'yes' }).tutorial, false);
});

/* ---------- 백업 코드에 에코 포함 ---------- */

function realEchoes(n) {
  const out = [];
  for (let s = 1; s <= n; s++) out.push(runBot(new E.Sim({ seed: s * 31, world: 'school' })).exportEcho());
  return out;
}

test('에코 압축: 복원한 경로는 원래 경로와 거의 같고(최대 6px·평균 1px 미만), 길이와 성장 기록이 그대로다', () => {
  const echoes = realEchoes(2).concat(T.makeTutorialEchoes(5).slice(0, 2));
  for (const e of echoes) {
    const back = M.unpackEcho(JSON.parse(JSON.stringify(M.packEcho(e))));
    assert.strictEqual(back.path.length, e.path.length, '길이가 같아야 에코가 같은 시점에 사라짐');
    let maxErr = 0, sum = 0;
    for (let i = 0; i < e.path.length; i++) { const d = Math.abs(back.path[i] - e.path[i]); maxErr = Math.max(maxErr, d); sum += d; }
    // 샘플 사이에서 U턴한 곳에서만 조금 벌어진다 (캐릭터 반지름 7px보다 작음)
    assert.ok(maxErr <= 6, `최대 오차 ${maxErr}px`);
    assert.ok(sum / e.path.length < 1, `평균 오차 ${sum / e.path.length}px`);
    assert.deepStrictEqual(back.ups, e.ups);
    assert.strictEqual(back.ticks, e.ticks);
  }
});

test('백업 코드(ECHO2): 진행 데이터 + 에코 10명 왕복, 크기는 적당하다', () => {
  const s = M.defaultSave(); s.coins = 321; s.tutorial = true; s.worlds.clears.school = 1;
  const echoes = T.makeTutorialEchoes(9);
  const code = M.exportCode(s, { world: 'academy', echoes });
  assert.ok(code.startsWith('ECHO2:'));
  assert.ok(code.length < 150000, `코드 길이 ${code.length}`);
  const r = M.importBackup(code);
  assert.deepStrictEqual(r.save, s);
  assert.strictEqual(r.pool.world, 'academy');
  assert.strictEqual(r.pool.echoes.length, 10);
  assert.deepStrictEqual(M.importCode(code), s, 'importCode는 진행 데이터만 돌려줌');
  // 복원한 에코로 실제 판이 돌아간다
  const sim = new E.Sim({ seed: 1, echoes: r.pool.echoes, world: 'school' });
  for (let i = 0; i < 600; i++) sim.step({ dx: 0, dy: 0 });
  assert.strictEqual(sim.echoes.filter((e) => e.alive).length, 10);
});

test('백업 코드: 옛 ECHO1 코드도 불러오고(에코 없음), 에코가 0명이어도 된다', () => {
  const s = M.defaultSave(); s.coins = 50;
  const r1 = M.importBackup(M.exportCode(s));
  assert.deepStrictEqual(r1.save, s); assert.strictEqual(r1.pool, null);
  const r2 = M.importBackup(M.exportCode(s, { world: 'school', echoes: [] }));
  assert.deepStrictEqual(r2.pool, { world: 'school', echoes: [] });
});

test('백업 코드: 손상되거나 이상한 에코 데이터는 거부한다', () => {
  const s = M.defaultSave();
  const enc = (o) => 'ECHO2:' + Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
  const good = M.packEcho(T.makeTutorialEchoes(1)[0]);
  assert.ok(M.importBackup(enc({ save: s, ep: { w: 'school', e: [good] } })));
  assert.strictEqual(M.importBackup(enc({ save: s, ep: { w: 'school', e: [Object.assign({}, good, { d: 'AAAA' })] } })), null, '길이가 맞지 않음');
  assert.strictEqual(M.importBackup(enc({ save: s, ep: { w: 'school', e: [Object.assign({}, good, { n: 1e9 })] } })), null, '너무 긴 기록');
  assert.strictEqual(M.importBackup(enc({ save: s, ep: { w: 'school', e: [null] } })), null);
  assert.strictEqual(M.importBackup(enc({ save: s })), null, '에코 풀 없음');
  assert.strictEqual(M.importBackup(enc({ ep: { w: 'school', e: [] } })), null, '진행 데이터 없음');
  assert.strictEqual(M.importBackup('ECHO2:@@@'), null);
  // 모르는 성장 기록은 버리고, 모르는 월드는 학교로
  const r = M.importBackup(enc({ save: s, ep: { w: 'mars', e: [Object.assign({}, good, { u: [[10, 'rate'], [20, 'hack'], ['x', 'dmg']] })] } }));
  assert.strictEqual(r.pool.world, 'school');
  assert.deepStrictEqual(r.pool.echoes[0].ups, [{ t: 10, id: 'rate' }]);
});

test('튜토리얼 안내: 긴 글은 3초 넘게 보이고, 멈춤도 글 길이에 맞춰(1~2.5초) 늘어난다', () => {
  const short = T.tipTiming('짧은 안내'), long = T.tipTiming(T.EVENT_TIPS.helper);
  assert.ok(long.show >= 3000, `긴 글 ${long.show}ms`);
  assert.ok(long.freeze > short.freeze && long.freeze <= 2500 && short.freeze >= 1000);
  assert.ok(long.show > long.freeze, '멈춘 뒤에도 조금 더 보여 줌');
});

test('튜토리얼 판은 더 길고 왕도 그만큼 늦게 나온다 · 모든 아이템에 자세한 설명이 있다', () => {
  const a = new E.Sim({ seed: 1, world: T.TUTORIAL_WORLD }), b = new E.Sim({ seed: 1, world: T.TUTORIAL_WORLD, extraSec: T.EXTRA_SEC });
  assert.strictEqual(b.runTicks - a.runTicks, T.EXTRA_SEC * E.TICK);
  assert.strictEqual(b.world.boss.times[0] - a.world.boss.times[0], T.EXTRA_SEC);
  assert.strictEqual(E.WORLDS[T.TUTORIAL_WORLD].boss.times[0], a.world.boss.times[0], '원래 월드 데이터는 그대로');
  for (const u of E.UPGRADES) assert.ok(T.EVENT_TIPS['up:' + u.id], `${u.name} 설명`);
  const last = T.TIPS[T.TIPS.length - 1].sec;
  assert.ok(last < b.world.boss.times[0] - T.BOSS_SOON, '일반 안내는 왕 안내 전에 끝남');
});

test('튜토리얼 상황 안내: 원 안 탄 방어·쓰레기를 줍는 이유·사람을 돕는 이유와 보상을 모두 설명한다', () => {
  const E = T.EVENT_TIPS;
  for (const k of ['shield', 'spotSeen', 'spot', 'gaugeFull', 'rescueStart', 'rescued', 'escortStart', 'escortDone', 'helper', 'shot', 'drop', 'boss']) assert.ok(E[k], '안내 있음: ' + k);
  assert.match(E.shield, /탄/); assert.match(E.shield, /부딪히면/);
  assert.match(E.spotSeen, /깨끗/);
  assert.match(E.rescued, /보상/); assert.match(E.rescued, /응원/);
  assert.match(E.escortDone, /보상/);
  assert.match(E.helper, /보상/);
});

test('튜토리얼 안내의 숫자는 실제 규칙과 같다 (작은 선행 개수·응원 공격력)', () => {
  const { TUNING } = require('../src/sim.js');
  assert.ok(T.EVENT_TIPS.spot.includes(TUNING.deedGaugeNeed + '개'));
  assert.ok(T.EVENT_TIPS.gaugeFull.includes(TUNING.deedGaugeNeed + '개'));
  assert.ok(T.EVENT_TIPS.rescued.includes('+' + Math.round(TUNING.cheerDmg * 100) + '%'));
});

test('튜토리얼 안내가 말하는 곳을 화면에서 가리킨다 (하트 숫자·에너지 막대·선생님 원 등)', () => {
  assert.strictEqual(T.targetOf('spot'), 'gauge', '작은 선행 하트 숫자');
  assert.strictEqual(T.targetOf('gaugeFull'), 'gauge');
  assert.strictEqual(T.targetOf('shield'), 'helper');
  assert.strictEqual(T.targetOf('up:rate'), 'items');
  for (const k of ['drop', 'shot', 'helper', 'rescueStart', 'spotSeen', 'escortStart', 'boss', 'cards']) assert.ok(T.targetOf(k), '가리킬 곳 있음: ' + k);
  assert.strictEqual(T.TIPS.find((x) => x.text.includes('에너지')).target, 'hp');
});
