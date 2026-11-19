'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/sim.js');
const { Sim, UPGRADES, MAX_LEVEL, RUN_TICKS, BOSS_TICK, MAX_ECHOES } = E;

/** 가장 가까운 적에게서 도망가는 단순 봇 + 레벨업 시 첫 번째 선택지 */
function runBot(sim, maxTicks, { godMode = false } = {}) {
  const limit = maxTicks || RUN_TICKS;
  while (!sim.over && sim.tick < limit) {
    if (godMode) sim.player.hp = 1e9;
    if (sim.choices) sim.choose(sim.choices[0].id);
    const p = sim.player;
    let ax = 0, ay = 0;
    for (const e of sim.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; ax += dx / d; ay += dy / d; }
    }
    // 위협이 없으면 가장 가까운 구슬로, 아니면 화면 중앙으로 약하게 복귀
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

function snapshot(s) {
  return JSON.stringify({ t: s.tick, k: s.kills, hp: s.player.hp, lv: s.player.level, n: s.enemies.length, g: s.gems.length, r: s.result });
}

test('같은 시드 + 같은 입력 = 같은 결과 (결정론)', () => {
  const a = runBot(new Sim({ seed: 1234 }), 3000);
  const b = runBot(new Sim({ seed: 1234 }), 3000);
  assert.strictEqual(snapshot(a), snapshot(b));
});

test('7200틱 시뮬레이션 동안 NaN/비정상 좌표가 없다', () => {
  const s = runBot(new Sim({ seed: 7 }), RUN_TICKS, { godMode: true });
  for (const e of s.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy NaN');
  for (const b of s.bullets) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'bullet NaN');
  for (const b of s.ebullets) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'ebullet NaN');
  assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.hp));
  assert.ok(s.enemies.length <= 260 + 12);
});

test('보스가 90초에 등장하고 3페이즈를 모두 거친다', () => {
  const s = new Sim({ seed: 42 });
  const phases = new Set();
  let bossSeen = false;
  while (!s.over && s.tick < RUN_TICKS) {
    s.player.hp = 1e9;
    if (s.choices) s.choose(s.choices[0].id);
    // 보스에게 피해를 직접 주어 페이즈 전환을 검증
    const boss = s.enemies.find((e) => e.type === 'boss');
    if (boss) { bossSeen = true; boss.hp -= boss.maxhp * 0.002; }
    s.step({ dx: 0, dy: 0 });
    for (const ev of s.drainEvents()) if (ev.k === 'phase') phases.add(ev.phase);
  }
  assert.ok(bossSeen, '보스 미등장');
  assert.ok(s.tick >= BOSS_TICK);
  assert.ok(phases.has(2) && phases.has(3), `페이즈 전환: ${[...phases]}`);
  assert.strictEqual(s.result, 'clear');
});

test('에코는 기록된 경로를 그대로 재생한다', () => {
  const first = runBot(new Sim({ seed: 5 }), 600, { godMode: true });
  const out = first.exportEcho();
  const second = new Sim({ seed: 6, echoes: [out] });
  second.player.hp = 1e9;
  for (let i = 0; i < 300; i++) {
    if (second.choices) second.choose(second.choices[0].id);
    second.step({ dx: 0, dy: 0 });
  }
  const ec = second.echoes[0];
  assert.strictEqual(ec.x, out.path[299 * 2]);
  assert.strictEqual(ec.y, out.path[299 * 2 + 1]);
});

test('에코는 기록이 끝나면 사라지고, 오래된 에코일수록 약하다', () => {
  const mk = (n) => ({ path: new Array(n * 2).fill(100), ups: [] });
  const s = new Sim({ seed: 9, echoes: [mk(5), mk(50), mk(50)] });
  assert.ok(s.echoes[0].power < s.echoes[2].power, '오래된 에코가 더 약해야 함');
  s.player.hp = 1e9;
  for (let i = 0; i < 10; i++) s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.echoes[0].alive, false);
  assert.strictEqual(s.echoes[2].alive, true);
});

test('에코가 많을수록 적 체력이 늘어난다 (난이도 연동)', () => {
  const mk = () => ({ path: new Array(200).fill(100), ups: [] });
  const a = new Sim({ seed: 1 });
  const b = new Sim({ seed: 1, echoes: Array.from({ length: MAX_ECHOES }, mk) });
  a._make('hw', 0, 0); b._make('hw', 0, 0);
  assert.ok(b.enemies[0].maxhp > a.enemies[0].maxhp);
});

test('에코는 적에게 맞으면 체력이 깎이고 0이면 사라진다', () => {
  const s = new Sim({ seed: 3, echoes: [{ path: new Array(2000).fill(180), ups: [] }] });
  s.player.hp = 1e9;
  s.step({ dx: 0, dy: 0 });
  const ec = s.echoes[0];
  for (let i = 0; i < 20 && ec.alive; i++) {
    s._make('alarm', ec.x, ec.y);
    ec.inv = 0;
    s.step({ dx: 0, dy: 0 });
  }
  assert.strictEqual(ec.alive, false);
});

test('레벨업 선택지는 3개, 중복 없음, 만렙 항목은 제외된다', () => {
  const s = new Sim({ seed: 11 });
  s.player.stats.rate = MAX_LEVEL;
  s.player.hp = 50; // heal 후보 허용
  s.player.xp = 999;
  s.step({ dx: 0, dy: 0 });
  assert.ok(s.choices && s.choices.length === 3);
  const ids = s.choices.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, 3);
  assert.ok(!ids.includes('rate'));
});

test('업그레이드 시너지가 발동한다', () => {
  const s = new Sim({ seed: 2 });
  s.player.stats.rate = 1; s.player.stats.dmg = 2;
  s.choices = [UPGRADES.find((u) => u.id === 'rate')];
  s.choose('rate');
  assert.ok(E.derive(s.player.stats).syn.includes('focus'));
  assert.ok(s.drainEvents().some((e) => e.k === 'synergy' && e.id === 'focus'));
});

test('종소리/형광펜이 적에게 피해를 준다', () => {
  const s = new Sim({ seed: 4 });
  s.player.hp = 1e9;
  s.player.stats.nova = 3; s.player.stats.orbit = 3;
  s._make('alarm', s.player.x + 30, s.player.y);
  const e = s.enemies[0]; const hp0 = e.hp;
  for (let i = 0; i < 200; i++) { s.step({ dx: 0, dy: 0 }); if (s.enemies.indexOf(e) === -1) break; }
  assert.ok(e.hp < hp0 || s.enemies.indexOf(e) === -1);
});

test('조별과제는 죽으면 숙제 2개로 분열한다', () => {
  const s = new Sim({ seed: 8 });
  s.player.hp = 1e9;
  s._make('group', 40, 40);
  s.enemies[0].hp = 0;
  s.step({ dx: 0, dy: 0 });
  assert.ok(s.enemies.filter((e) => e.type === 'hw').length >= 2);
});

test('밸런스 스모크: 봇이 한 판을 돌렸을 때 처치/레벨이 합리적 범위', () => {
  const s = runBot(new Sim({ seed: 2024 }), RUN_TICKS, { godMode: true });
  console.log(`  [봇] 결과=${s.result} 처치=${s.kills} 레벨=${s.player.level} 틱=${s.tick}`);
  assert.ok(s.kills > 50);
  assert.ok(s.player.level >= 3);
});
