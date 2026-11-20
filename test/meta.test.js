'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/meta.js');
const E = require('../src/sim.js');

const run = (o) => Object.assign({ kills: 50, seconds: 60, level: 8, result: 'dead', gems: 40, echoes: 0 }, o);

test('기본 저장: 학생만 해금, 재화 0', () => {
  const s = M.defaultSave();
  assert.strictEqual(s.coins, 0);
  assert.deepStrictEqual(s.chars.unlocked, ['student']);
  assert.strictEqual(s.chars.selected, 'student');
});

test('상점: 재화가 부족하면 구매 실패, 충분하면 차감되고 레벨 증가', () => {
  const s = M.defaultSave();
  assert.deepStrictEqual(M.buyUpgrade(s, 'hp'), { ok: false, reason: 'coins', cost: M.shopCost('hp', 0) });
  s.coins = 1000;
  const r = M.buyUpgrade(s, 'hp');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.shop.hp, 1);
  assert.strictEqual(s.coins, 1000 - M.shopCost('hp', 0));
  assert.ok(M.shopCost('hp', 1) > M.shopCost('hp', 0), '레벨이 오를수록 비싸야 함');
});

test('상점: 최대 레벨(5)을 넘어 살 수 없고, 모르는 항목은 거부', () => {
  const s = M.defaultSave(); s.coins = 1e6;
  for (let i = 0; i < 5; i++) assert.strictEqual(M.buyUpgrade(s, 'dmg').ok, true);
  assert.strictEqual(M.buyUpgrade(s, 'dmg').reason, 'max');
  assert.strictEqual(M.buyUpgrade(s, 'nope').reason, 'unknown');
  assert.strictEqual(s.shop.dmg, 5);
});

test('캐릭터: 해금 비용 차감, 중복 해금/미보유 선택 거부', () => {
  const s = M.defaultSave();
  assert.strictEqual(M.unlockCharacter(s, 'athlete').reason, 'coins');
  assert.strictEqual(M.selectCharacter(s, 'athlete'), false);
  s.coins = 500;
  assert.strictEqual(M.unlockCharacter(s, 'athlete').ok, true);
  assert.strictEqual(s.coins, 500 - M.CHARACTERS.athlete.cost);
  assert.strictEqual(M.unlockCharacter(s, 'athlete').reason, 'owned');
  assert.strictEqual(M.selectCharacter(s, 'athlete'), true);
  assert.strictEqual(s.chars.selected, 'athlete');
});

test('보너스 계산: 상점 레벨과 캐릭터 효과가 합쳐진다', () => {
  const s = M.defaultSave();
  assert.deepStrictEqual(M.bonusFor(s).startStats, {});
  s.shop.hp = 2; s.shop.dmg = 3; s.coins = 999;
  s.chars.unlocked.push('athlete'); s.chars.selected = 'athlete';
  const b = M.bonusFor(s);
  assert.strictEqual(b.maxhp, 2 * 10 + 30);
  assert.ok(Math.abs(b.dmgMul - (1 + 3 * 0.06)) < 1e-9);
  assert.ok(Math.abs(b.speedMul - 1.15) < 1e-9);
  assert.ok(Math.abs(b.cooldownMul - 1.1) < 1e-9);
  assert.deepStrictEqual(b.startStats, { speed: 1 });
});

test('한 판 결과: 재화 지급, 통계 누적, 학점 획득 보너스 반영', () => {
  const s = M.defaultSave();
  const r1 = M.recordRun(s, run({}), '2026-11-20');
  const expectedBase = Math.floor(50 * 0.4 + 60 * 0.5 + 8 * 3);
  assert.strictEqual(r1.base, expectedBase);
  assert.strictEqual(r1.earned, expectedBase);
  assert.ok(s.coins >= r1.earned);
  assert.strictEqual(s.stats.runs, 1); assert.strictEqual(s.stats.kills, 50);
  s.shop.coin = 5; // +50%
  const before = s.coins;
  const r2 = M.recordRun(s, run({ kills: 0, seconds: 10, level: 1 }), '2026-11-20');
  assert.strictEqual(r2.base, Math.floor(0 + 5 + 3));
  assert.strictEqual(r2.earned, Math.round(r2.base * 1.5));
  assert.ok(s.coins >= before + r2.earned);
});

test('보스 처치(clear) 보너스가 더해진다', () => {
  const a = M.recordRun(M.defaultSave(), run({ result: 'dead' }), '2026-11-20');
  const b = M.recordRun(M.defaultSave(), run({ result: 'clear' }), '2026-11-20');
  assert.strictEqual(b.base - a.base, 100);
});

test('도전 과제는 한 번만 달성/보상된다', () => {
  const s = M.defaultSave();
  const r1 = M.recordRun(s, run({ kills: 120, seconds: 70 }), '2026-11-20');
  const ids1 = r1.newAch.map((a) => a.id);
  assert.ok(ids1.includes('first_run') && ids1.includes('kills_100') && ids1.includes('survive_60'), ids1.join());
  const r2 = M.recordRun(s, run({ kills: 120, seconds: 70 }), '2026-11-20');
  assert.ok(!r2.newAch.some((a) => a.id === 'kills_100'), '이미 달성한 과제는 다시 안 나옴');
  assert.strictEqual(s.ach.kills_100, true);
});

test('에코 과제: 에코 5명/10명과 함께 플레이', () => {
  const s = M.defaultSave();
  assert.ok(!M.recordRun(s, run({ echoes: 4 }), '2026-11-20').newAch.some((a) => a.id === 'echo_5'));
  assert.ok(M.recordRun(s, run({ echoes: 5 }), '2026-11-20').newAch.some((a) => a.id === 'echo_5'));
  assert.ok(M.recordRun(s, run({ echoes: 10 }), '2026-11-20').newAch.some((a) => a.id === 'echo_10'));
});

test('일일 미션: 같은 날짜는 항상 같은 3개, 날짜가 바뀌면 달라질 수 있다', () => {
  const a = M.dailyMissions('2026-11-20'), b = M.dailyMissions('2026-11-20');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 3);
  assert.strictEqual(new Set(a.map((m) => m.id)).size, 3, '서로 다른 종류');
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(M.dailyMissions('2026-12-' + String(d).padStart(2, '0')).map((m) => m.id + m.target).join());
  assert.ok(days.size > 5, '날짜마다 구성이 달라져야 함');
  for (const m of a) assert.ok(M.missionText(m).length > 0);
});

test('일일 미션: 진행도가 쌓이고 완료 시 보상, 날짜가 바뀌면 초기화', () => {
  const s = M.defaultSave();
  s.daily = { date: '2026-11-20', missions: [
    { id: 'kills', target: 100, reward: 50, progress: 0, done: false },
    { id: 'survive', target: 60, reward: 40, progress: 0, done: false },
    { id: 'clear', target: 1, reward: 120, progress: 0, done: false },
  ] };
  const r1 = M.recordRun(s, run({ kills: 60, seconds: 70 }), '2026-11-20');
  assert.deepStrictEqual(r1.missionsDone.map((m) => m.id), ['survive']);
  assert.strictEqual(s.daily.missions[0].progress, 60);
  const coins1 = s.coins;
  const r2 = M.recordRun(s, run({ kills: 60, seconds: 10, level: 1 }), '2026-11-20');
  assert.deepStrictEqual(r2.missionsDone.map((m) => m.id), ['kills']);
  assert.strictEqual(s.daily.missions[0].progress, 100, '목표를 넘겨도 목표값으로 고정');
  assert.ok(s.coins >= coins1 + r2.earned + 50);
  // 완료된 미션은 다시 보상하지 않는다
  const r3 = M.recordRun(s, run({ kills: 60, seconds: 70 }), '2026-11-20');
  assert.strictEqual(r3.missionsDone.length, 0);
  // 다음 날: 새 미션
  M.recordRun(s, run({}), '2026-11-21');
  assert.strictEqual(s.daily.date, '2026-11-21');
  assert.ok(s.daily.missions.length === 3 && s.daily.missions.every((m) => !m.done || m.progress >= m.target));
});

test('저장/불러오기: localStorage 왕복, 깨진 데이터는 기본값으로', () => {
  const store = { d: {}, getItem(k) { return this.d[k] === undefined ? null : this.d[k]; }, setItem(k, v) { this.d[k] = v; } };
  const s = M.defaultSave(); s.coins = 123; s.shop.hp = 2;
  assert.strictEqual(M.persist(store, s), true);
  const l = M.load(store);
  assert.strictEqual(l.coins, 123); assert.strictEqual(l.shop.hp, 2);
  store.d[M.SAVE_KEY] = '{깨진 json';
  assert.strictEqual(M.load(store).coins, 0);
  store.d[M.SAVE_KEY] = JSON.stringify({ coins: -5, shop: { hp: 99, xx: 3 }, chars: { unlocked: ['genius', 'zzz'], selected: 'zzz' }, stats: { runs: 'a' }, ach: { first_run: 1 } });
  const c = M.load(store);
  assert.strictEqual(c.coins, 0);
  assert.strictEqual(c.shop.hp, 5, '최대 레벨로 보정');
  assert.ok(!('xx' in c.shop));
  assert.deepStrictEqual(c.chars.unlocked.sort(), ['genius', 'student']);
  assert.strictEqual(c.chars.selected, 'student');
  assert.strictEqual(c.stats.runs, 0);
  assert.deepStrictEqual(c.ach, {}, 'true가 아닌 값은 무시');
});

test('백업 코드: 내보내기 → 불러오기 왕복, 잘못된 코드는 null', () => {
  const s = M.defaultSave(); s.coins = 777; s.shop.dmg = 3; s.chars.unlocked.push('nurse'); s.chars.selected = 'nurse';
  const code = M.exportCode(s);
  assert.ok(code.startsWith('ECHO1:'));
  const back = M.importCode(code);
  assert.deepStrictEqual(back, s);
  assert.strictEqual(M.importCode('hello'), null);
  assert.strictEqual(M.importCode('ECHO1:@@@@'), null);
  assert.strictEqual(M.importCode(''), null);
  assert.strictEqual(M.importCode(null), null);
  assert.deepStrictEqual(M.importCode('  ' + code + '\n'), s, '앞뒤 공백 허용');
});

/* ---------- 시뮬레이션 연동 ---------- */

test('시뮬레이션: 보너스가 체력/공격 수치에 반영된다', () => {
  const s0 = new E.Sim({ seed: 1, events: false });
  const s1 = new E.Sim({ seed: 1, events: false, bonus: { maxhp: 50, dmgMul: 1.5, speedMul: 1.2, cooldownMul: 0.8, magnet: 20, regen: 3 } });
  assert.strictEqual(s1.player.maxhp, s0.player.maxhp + 50);
  assert.strictEqual(s1.player.hp, s1.player.maxhp);
  const d0 = E.derive(s0.player.stats, s0.bonus), d1 = E.derive(s1.player.stats, s1.bonus);
  assert.ok(Math.abs(d1.dmg - d0.dmg * 1.5) < 1e-9);
  assert.ok(Math.abs(d1.speed - d0.speed * 1.2) < 1e-9);
  assert.ok(d1.cooldown < d0.cooldown);
  assert.strictEqual(d1.magnet, d0.magnet + 20);
  assert.ok(d1.regen > d0.regen);
});

test('시뮬레이션: 체력 보너스가 음수여도 최소 체력(40) 보장', () => {
  assert.strictEqual(new E.Sim({ seed: 1, events: false, bonus: { maxhp: -500 } }).player.maxhp, 40);
});

test('시뮬레이션: 캐릭터 시작 아이템이 적용되고 에코에게도 기록된다', () => {
  const b = M.bonusFor(Object.assign(M.defaultSave(), { chars: { unlocked: ['student', 'genius'], selected: 'genius' } }));
  const s = new E.Sim({ seed: 2, events: false, bonus: b });
  assert.strictEqual(s.player.stats.crit, 1);
  assert.deepStrictEqual(s.rec.ups, [{ t: 0, id: 'crit' }]);
  s.player.hp = 1e9;
  for (let i = 0; i < 30; i++) { if (s.choices) s.choose(s.choices[0].id); s.step({ dx: 0, dy: 0 }); }
  const out = s.exportEcho();
  const s2 = new E.Sim({ seed: 3, events: false, echoes: [out] });
  s2.player.hp = 1e9;
  s2.step({ dx: 0, dy: 0 });
  assert.strictEqual(s2.echoes[0].stats.crit, 1, '에코도 시작 아이템을 가짐');
});

test('시뮬레이션: 경험치 보너스와 구슬 카운트', () => {
  const s = new E.Sim({ seed: 4, events: false, bonus: { xpMul: 2 } });
  s.player.hp = 1e9;
  s.gems.push({ x: s.player.x, y: s.player.y, v: 1 });
  s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.gemCount, 1);
  assert.strictEqual(s.player.xp, 2);
});

test('에코 단련: 에코 공격력 보너스가 에코 탄환 피해에 반영된다', () => {
  const echo = { path: new Array(2000).fill(180), ups: [], ticks: 1000 };
  const dmgOf = (bonus) => {
    const s = new E.Sim({ seed: 5, events: false, echoes: [echo], bonus });
    s.player.hp = 1e9;
    s._make('alarm', 250, 180); s.enemies[0].hp = 1e6; s.enemies[0].maxhp = 1e6; s.enemies[0].speed = 0;
    for (let i = 0; i < 60; i++) {
      s.step({ dx: 0, dy: 0 });
      const b = s.bullets.find((x) => x.owner === 'echo' && !x.crit);   // 발사 직후 탄환을 포착
      if (b) return b.dmg;
    }
    return null;
  };
  const d0 = dmgOf({}), d1 = dmgOf({ echoPower: 0.25 });
  assert.ok(d0 !== null && d1 !== null);
  assert.ok(Math.abs(d1 / d0 - 1.25) < 1e-9);
});
