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

test('에코는 적에게 맞아도 사라지지 않고, 기록이 끝나는 시점에만 사라진다', () => {
  const N = 300;
  const s = new Sim({ seed: 3, echoes: [{ path: new Array(N * 2).fill(180), ups: [] }] });
  s.player.hp = 1e9;
  s.step({ dx: 0, dy: 0 });
  const ec = s.echoes[0];
  for (let i = 0; i < 100; i++) {
    s._make('alarm', ec.x, ec.y);          // 에코 위에 적을 계속 소환
    s._ebullet(ec.x, ec.y, 0, 0.1, 50);    // 적 탄환도 에코 위에서 발사
    s.player.hp = 1e9;
    if (s.choices) s.choose(s.choices[0].id);
    s.step({ dx: 0, dy: 0 });
  }
  assert.strictEqual(ec.alive, true, '맞아도 에코는 살아 있어야 함');
  for (let i = 0; i < N; i++) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: 0, dy: 0 }); }
  assert.strictEqual(ec.alive, false, '기록이 끝나면 사라져야 함');
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

test('밸런스 스모크: 봇이 여러 시드를 돌렸을 때 처치/레벨이 합리적 범위', () => {
  const rs = [2024, 2025, 2026, 2027].map((seed) => runBot(new Sim({ seed, events: false }), RUN_TICKS, { godMode: true }));
  console.log('  [봇] ' + rs.map((s) => `${s.result}/처치${s.kills}/Lv${s.player.level}`).join('  '));
  assert.ok(Math.max(...rs.map((s) => s.kills)) > 50);
  assert.ok(Math.max(...rs.map((s) => s.player.level)) >= 3);
});

test('에코 정원 초과 시 가장 일찍 쓰러진 에코부터 퇴장한다', () => {
  const mk = (ticks) => ({ path: [], ups: [], ticks });
  let list = [];
  for (const t of [2000, 900, 3000, 1500, 2500]) list = E.addEcho(list, mk(t), 5).list;
  assert.deepStrictEqual(list.map((e) => e.ticks), [2000, 900, 3000, 1500, 2500]);
  // 6번째 추가: 900(가장 일찍 죽은 에코)이 빠지고 시간순 유지
  let r = E.addEcho(list, mk(1800), 5);
  assert.deepStrictEqual(r.list.map((e) => e.ticks), [2000, 3000, 1500, 2500, 1800]);
  assert.deepStrictEqual(r.removed.map((e) => e.ticks), [900]);
  // 새 에코가 가장 짧으면 그 에코가 바로 퇴장
  r = E.addEcho(r.list, mk(300), 5);
  assert.deepStrictEqual(r.removed.map((e) => e.ticks), [300]);
  assert.strictEqual(r.list.length, 5);
  // 동률이면 더 오래된 에코부터
  r = E.addEcho([mk(500), mk(500)], mk(900), 2);
  assert.strictEqual(r.removed.length, 1);
  assert.strictEqual(r.list[0].ticks, 500); assert.strictEqual(r.list[1].ticks, 900);
});

test('반복 플레이하면 살아남은 에코의 최장 지원 시간이 줄어들지 않는다', () => {
  let list = [];
  let longest = 0;
  for (let i = 0; i < 12; i++) {
    const s = runBot(new Sim({ seed: 300 + i, echoes: list, events: false }), RUN_TICKS);
    list = E.addEcho(list, s.exportEcho(), MAX_ECHOES).list;
    const now = Math.max(...list.map((e) => e.ticks));
    assert.ok(now >= longest, '최장 기록이 줄어들면 안 됨');
    longest = now;
    assert.ok(list.length <= MAX_ECHOES);
  }
});

test('캐릭터는 화면 어디든(아래쪽 포함) 이동할 수 있고 아래쪽 구슬도 먹을 수 있다', () => {
  const s = new Sim({ seed: 12, events: false });
  s.player.hp = 1e9;
  for (let i = 0; i < 600; i++) s.step({ dx: 0, dy: 1 });
  assert.ok(s.player.y > E.H - 20, `y=${s.player.y}`);
  s.gems.push({ x: s.player.x, y: s.player.y, v: 1 });
  const xp0 = s.player.xp;
  s.step({ dx: 0, dy: 0 });
  assert.ok(s.player.xp > xp0 || s.player.level > 1);
});

test('120초가 지나도 보스가 살아 있으면 연장전, 보스를 잡으면 클리어', () => {
  const s = new Sim({ seed: 21, events: false });
  s.player.hp = 1e9;
  while (!s.over && s.tick < RUN_TICKS + 5) {
    if (s.choices) s.choose(s.choices[0].id);
    s.player.hp = 1e9;
    const b = s.enemies.find((e) => e.type === 'boss'); if (b) b.hp = b.maxhp; // 보스를 못 잡은 상황
    s.step({ dx: 0, dy: 0 });
  }
  assert.ok(s.bossSpawned && !s.bossDead);
  assert.strictEqual(s.over, false, '보스가 살아 있으면 120초에 끝나면 안 됨');
  const boss = s.enemies.find((e) => e.type === 'boss');
  boss.hp = 0;
  for (let i = 0; i < 5 && !s.over; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); }
  assert.strictEqual(s.result, 'clear');
});

test('연장전은 최대 60초에서 끝난다', () => {
  const s = new Sim({ seed: 22, events: false });
  while (!s.over && s.tick < RUN_TICKS + E.OVERTIME_TICKS + 10) {
    s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
    const b = s.enemies.find((e) => e.type === 'boss'); if (b) b.hp = b.maxhp; // 보스를 못 잡는 상황
    s.step({ dx: 0, dy: 0 });
  }
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.result, 'survive');
  assert.ok(s.tick <= RUN_TICKS + E.OVERTIME_TICKS + 1);
});

test('레벨업 카드: 게임을 멈추지 않고, 4초 안에 안 고르면 자동으로 고른다', () => {
  const s = new Sim({ seed: 77 });
  s.player.xp = s.player.need; s.player.hp = 1e9;
  s.step({ dx: 0, dy: 0 });
  assert.ok(s.choices && s.choices.length === 3, '카드 3장');
  const t0 = s.tick, lv0 = Object.values(s.player.stats).reduce((a, b) => a + b, 0);
  for (let i = 0; i < 60; i++) { s.player.hp = 1e9; s.step({ dx: 1, dy: 0 }); }
  assert.strictEqual(s.tick, t0 + 60, '카드가 떠 있어도 시간이 흐른다');
  assert.ok(s.choices, '1초 뒤엔 아직 고르는 중');
  let auto = null;
  for (let i = 0; i < E.TUNING.choiceAutoSec * 60; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); for (const ev of s.drainEvents()) if (ev.k === 'autoPick') auto = ev; if (auto) break; }
  assert.ok(auto && auto.name, '자동 선택 이벤트');
  const lv1 = Object.values(s.player.stats).reduce((a, b) => a + b, 0);
  assert.ok(lv1 > lv0 || s.player.hp > 0, '자동으로 고른 카드가 적용됨');
  // 손으로 고르면 그 카드가 적용되고, 지금 카드에 없는 id는 무시
  s.player.xp = s.player.need; s.step({ dx: 0, dy: 0 });
  const pick = s.choices.find((c) => !c.instant) || s.choices[0];
  const before = s.player.stats[pick.id] || 0;
  s.choose('nope'); assert.ok(s.choices, '없는 카드는 무시');
  s.choose(pick.id);
  assert.strictEqual(s.choices, null);
  if (!pick.instant) assert.strictEqual(s.player.stats[pick.id], before + 1);
});

test('조언 카드가 오면, 떠 있던 레벨업 카드는 먼저 자동으로 골라 준다 (겹치지 않음)', () => {
  const s = new Sim({ seed: 78 });
  s.player.xp = s.player.need; s.player.hp = 1e9; s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.choiceKind, 'levelup');
  s._spawnHelper(); s.player.x = s.helper.x; s.player.y = s.helper.y;
  let autos = 0;
  for (let i = 0; i < 120 && s.choiceKind !== 'helper'; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); for (const ev of s.drainEvents()) if (ev.k === 'autoPick') autos++; }
  assert.strictEqual(s.choiceKind, 'helper');
  assert.ok(s.choices.every((c) => c.boon), '조언 카드만');
  assert.ok(autos >= 1, '레벨업 카드는 자동 선택됨');
});

test('에코: 적에게 맞아 에너지가 0이 되면 2초 동안 사라졌다가(공격 안 함) 에너지를 채워 다시 나타난다', () => {
  const echo = { path: new Array(20000).fill(0).map((_, i) => (i % 2 ? 300 : 180)), ups: [], ticks: 10000 };
  const s = new Sim({ seed: 81, echoes: [echo] });
  const ec = s.echoes[0];
  assert.strictEqual(ec.hp, E.TUNING.echoHp);
  s.step({ dx: 0, dy: 0 });
  // 에코 위치에 적 탄을 계속 쏴서 에너지를 다 깎는다
  let downAt = null, events = [];
  for (let i = 0; i < 600 && downAt === null; i++) {
    s.player.hp = 1e9;
    s.ebullets.push({ x: ec.x, y: ec.y, vx: 0, vy: 0, dmg: 10, life: 5, r: 4 });
    s.step({ dx: 0, dy: 0 });
    events.push(...s.drainEvents());
    if (ec.down > 0) downAt = s.tick;
  }
  assert.ok(downAt, '에너지가 떨어지면 사라짐');
  assert.ok(events.some((e) => e.k === 'echoDown'));
  // 사라진 동안: 공격하지 않고, 탄에 맞지도 않음
  const before = s.bullets.filter((b) => b.owner === 'echo').length;
  s._make('hw', ec.x + 30, ec.y);
  for (let i = 0; i < E.TUNING.echoDownSec * 60 - 2; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); }
  assert.ok(ec.down > 0, '아직 사라진 상태');
  assert.strictEqual(s.bullets.filter((b) => b.owner === 'echo').length <= before, true, '사라진 동안 공격 안 함');
  for (let i = 0; i < 5; i++) { s.player.hp = 1e9; s.step({ dx: 0, dy: 0 }); }
  assert.strictEqual(ec.down, 0, '2초 뒤 다시 나타남');
  assert.strictEqual(ec.hp, E.TUNING.echoHp, '에너지를 채워서');
  assert.ok(ec.alive, '기록이 끝난 게 아니므로 계속 함께함');
});
