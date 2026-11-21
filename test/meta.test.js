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
  assert.strictEqual(b.maxhp, 2 * 7 + 20);
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

/* ---------- 3단계: 월드 ---------- */

test('월드 해금: 학교만 열려 있고, 앞 월드의 보스를 격파하면 다음 월드가 열린다', () => {
  const s = M.defaultSave();
  assert.deepStrictEqual(M.WORLD_ORDER.filter((w) => M.worldUnlocked(s, w)), ['school']);
  assert.strictEqual(M.selectWorld(s, 'academy'), false);
  const r = M.recordRun(s, run({ result: 'clear', world: 'school' }), '2026-11-20');
  assert.strictEqual(r.newWorld, 'academy');
  assert.strictEqual(M.worldUnlocked(s, 'academy'), true);
  assert.strictEqual(M.worldUnlocked(s, 'office'), false, '건너뛰기 불가');
  assert.strictEqual(M.selectWorld(s, 'academy'), true);
  assert.strictEqual(s.worlds.selected, 'academy');
  // 같은 월드를 또 깨도 새로 열리는 월드는 없음
  assert.strictEqual(M.recordRun(s, run({ result: 'clear', world: 'school' }), '2026-11-20').newWorld, null);
  assert.strictEqual(s.worlds.clears.school, 2);
});

test('월드 해금: 죽거나 시간만 버텨서는 열리지 않는다', () => {
  const s = M.defaultSave();
  M.recordRun(s, run({ result: 'dead', world: 'school' }), '2026-11-20');
  M.recordRun(s, run({ result: 'survive', seconds: 120, world: 'school' }), '2026-11-20');
  assert.strictEqual(M.worldUnlocked(s, 'academy'), false);
});

test('월드 보상 배율: 뒤 월드일수록 같은 성적에 학점을 더 준다', () => {
  const earn = (world) => M.recordRun(M.defaultSave(), run({ world }), '2026-11-20').earned;
  const e = M.WORLD_ORDER.map(earn);
  for (let i = 1; i < e.length; i++) assert.ok(e[i] > e[i - 1], e.join());
  const base = Math.floor(50 * 0.4 + 60 * 0.5 + 8 * 3);
  assert.strictEqual(e[0], base);
  assert.strictEqual(e[3], Math.round(base * M.rewardMul('subway', 0)), '보상 배율 = 그 단계의 적 체력 배율');
});

test('월드별 최장 기록과 격파 횟수가 따로 저장된다', () => {
  const s = M.defaultSave();
  M.recordRun(s, run({ seconds: 70, world: 'school' }), '2026-11-20');
  M.recordRun(s, run({ seconds: 50, world: 'school' }), '2026-11-20');
  M.recordRun(s, run({ seconds: 90, result: 'clear', world: 'academy' }), '2026-11-20');
  assert.strictEqual(s.worlds.best.school, 70);
  assert.strictEqual(s.worlds.best.academy, 90);
  assert.strictEqual(s.worlds.clears.academy, 1);
  assert.strictEqual(s.worlds.clears.school, undefined);
});

test('월드 도전 과제: 해당 월드 보스를 처음 격파하면 달성', () => {
  const s = M.defaultSave();
  const r = M.recordRun(s, run({ result: 'clear', world: 'academy' }), '2026-11-20');
  assert.ok(r.newAch.some((a) => a.id === 'clear_academy'));
  assert.ok(!r.newAch.some((a) => a.id === 'clear_office'));
  assert.ok(!M.recordRun(s, run({ result: 'clear', world: 'academy' }), '2026-11-20').newAch.some((a) => a.id === 'clear_academy'), '한 번만');
});

test('이전 버전 저장(월드 정보 없음)도 문제없이 불러온다', () => {
  const old = { v: 1, coins: 321, shop: { hp: 1 }, chars: { unlocked: ['student'], selected: 'student' }, stats: { runs: 4 }, ach: {}, daily: { date: '', missions: [] } };
  const s = M.sanitize(old);
  assert.strictEqual(s.coins, 321);
  assert.deepStrictEqual(s.worlds, { selected: 'school', clears: {}, best: {}, cycleClears: {} });
  assert.strictEqual(s.cycle, 0); assert.deepStrictEqual(s.gear, {});
  assert.deepStrictEqual(M.importCode(M.exportCode(old)).worlds.selected, 'school');
});

test('월드 저장 정리: 잠긴 월드 선택/이상한 값은 보정된다', () => {
  const s = M.sanitize({ worlds: { selected: 'subway', clears: { school: 2, zzz: 9, academy: -1, office: 'x' }, best: { school: 55.5, academy: 'a' } } });
  assert.strictEqual(s.worlds.selected, 'school', '잠긴 월드는 선택 불가');
  assert.deepStrictEqual(s.worlds.clears, { school: 2 });
  assert.deepStrictEqual(s.worlds.best, { school: 55.5 });
  const t = M.sanitize({ worlds: { selected: 'academy', clears: { school: 1 } } });
  assert.strictEqual(t.worlds.selected, 'academy', '열린 월드는 선택 유지');
});

test('백업 코드 왕복에 월드 진행이 포함된다', () => {
  const s = M.defaultSave();
  M.recordRun(s, run({ result: 'clear', world: 'school' }), '2026-11-20');
  M.selectWorld(s, 'academy');
  const back = M.importCode(M.exportCode(s));
  assert.deepStrictEqual(back.worlds, s.worlds);
});


/* ---------- 가치 방향: 도움 요청, 에코 월드 초기화 ---------- */

test('도움 통계: helped가 누적되고 "도움 요청하기" 과제가 달성된다', () => {
  const s = M.defaultSave();
  const r1 = M.recordRun(s, run({ helped: 0 }), '2026-11-20');
  assert.ok(!r1.newAch.some((a) => a.id === 'help_1'));
  const r2 = M.recordRun(s, run({ helped: 1 }), '2026-11-20');
  assert.ok(r2.newAch.some((a) => a.id === 'help_1'));
  assert.strictEqual(s.stats.helped, 1);
  for (let i = 0; i < 9; i++) M.recordRun(s, run({ helped: 1 }), '2026-11-20');
  assert.strictEqual(s.stats.helped, 10);
  assert.strictEqual(s.ach.help_10, true);
});

test('일일 미션: "도움 청하기" 미션이 있고 도움을 받으면 진행된다', () => {
  assert.ok(M.MISSION_TEMPLATES.some((t) => t.id === 'help'));
  const s = M.defaultSave();
  s.daily = { date: '2026-11-20', missions: [{ id: 'help', target: 1, reward: 40, progress: 0, done: false }, { id: 'runs', target: 5, reward: 50, progress: 0, done: false }, { id: 'kills', target: 999, reward: 99, progress: 0, done: false }] };
  assert.strictEqual(M.missionText(s.daily.missions[0]), '선생님·선배께 도움 청하기');
  assert.strictEqual(M.recordRun(s, run({ helped: 0 }), '2026-11-20').missionsDone.length, 0);
  assert.deepStrictEqual(M.recordRun(s, run({ helped: 1 }), '2026-11-20').missionsDone.map((x) => x.id), ['help']);
});

test('과제/미션 문구에 숙제·시험을 적으로 보는 표현이 없다', () => {
  const texts = M.ACHIEVEMENTS.map((a) => a.name + ' ' + a.desc).concat(M.MISSION_TEMPLATES.map((t) => t.text(5)));
  for (const t of texts) {
    assert.ok(!/숙제 정리|기말고사 격파|수능 만점|처치|격파/.test(t), `문구: ${t}`);
  }
});

test('에코 풀: 같은 월드에서는 유지, 다른 월드로 가면 모두 사라진다', () => {
  const pool = { world: 'school', echoes: [{ ticks: 1 }, { ticks: 2 }, { ticks: 3 }] };
  const same = M.echoesForWorld(pool, 'school');
  assert.strictEqual(same.echoes.length, 3); assert.strictEqual(same.cleared, 0);
  const moved = M.echoesForWorld(pool, 'academy');
  assert.deepStrictEqual(moved, { world: 'academy', echoes: [], cleared: 3 });
  // 되돌아가도 사라진 에코는 돌아오지 않는다 (풀은 하나)
  const back = M.echoesForWorld({ world: moved.world, echoes: moved.echoes }, 'school');
  assert.strictEqual(back.echoes.length, 0); assert.strictEqual(back.cleared, 0);
});

test('에코 풀: 월드 정보가 없는 옛 데이터는 학교의 에코로 취급, 빈 풀은 문제없음', () => {
  assert.strictEqual(M.echoesForWorld({ echoes: [{}, {}] }, 'school').echoes.length, 2);
  assert.strictEqual(M.echoesForWorld({ echoes: [{}, {}] }, 'office').cleared, 2);
  assert.deepStrictEqual(M.echoesForWorld(null, 'subway'), { world: 'subway', echoes: [], cleared: 0 });
  assert.strictEqual(M.echoesForWorld({ world: 'school', echoes: [] }, 'zzz').world, 'school', '모르는 월드는 학교');
});

test('선행 기록: 도감·찾아올 사람·칭호', () => {
  const Mt = require('../src/meta.js');
  const save = Mt.sanitize({});
  const base = { kills: 10, seconds: 60, level: 5, result: 'dead', gems: 10, echoes: 0, world: 'school', helped: 0 };
  let r = Mt.recordRun(save, Object.assign({}, base, { deeds: { people: ['child', 'elder', 'bogus'], escorts: 1, spots: 7 } }), '2026-11-21');
  assert.strictEqual(save.deeds.people, 2);
  assert.strictEqual(save.deeds.spots, 7);
  assert.strictEqual(save.deeds.book['school:child'], 1);
  assert.deepStrictEqual(save.deeds.visitor, { kind: 'elder', world: 'school' });
  assert.strictEqual(Mt.deedScore(save), 13);
  assert.strictEqual(r.newTitle.name, '친절한 학생');
  // 저장·불러오기 후에도 유지, 찾아올 사람은 한 번만
  const s2 = Mt.sanitize(JSON.parse(JSON.stringify(save)));
  assert.deepStrictEqual(s2.deeds, save.deeds);
  assert.strictEqual(Mt.takeVisitor(s2).kind, 'elder');
  assert.strictEqual(Mt.takeVisitor(s2), null);
  r = Mt.recordRun(save, base, '2026-11-21');
  assert.strictEqual(r.newTitle, null);
  assert.strictEqual(Mt.deedBook(save).length, 36);
});
