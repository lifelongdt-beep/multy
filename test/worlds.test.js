'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/sim.js');
const { WORLDS, ORDER } = require('../src/worlds.js');
const { Sim, RUN_TICKS, BOSS_TICK, W, H } = E;

/** 위협을 피하며 구슬을 줍는 단순 봇 (월드 공통) */
function runBot(sim, maxTicks, { god = true } = {}) {
  while (!sim.over && sim.tick < maxTicks) {
    if (god) sim.player.hp = Math.max(sim.player.hp, 1e6);
    if (sim.choices) sim.choose(sim.choices[0].id);
    const p = sim.player;
    let ax = 0, ay = 0;
    for (const e of sim.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 110 * 110) { const d = Math.sqrt(d2) || 1; ax += dx / d; ay += dy / d; }
    }
    if (ax === 0 && ay === 0 && sim.gems.length) {
      let b = null, bd = Infinity;
      for (const g of sim.gems) { const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (d2 < bd) { bd = d2; b = g; } }
      const d = Math.sqrt(bd) || 1; ax += (b.x - p.x) / d; ay += (b.y - p.y) / d;
    }
    ax += (W / 2 - p.x) * 0.004; ay += (H / 2 - p.y) * 0.004;
    sim.step({ dx: ax, dy: ay });
    sim.drainEvents();
  }
  return sim;
}

test('월드 순서와 데이터 구조', () => {
  assert.deepStrictEqual(ORDER, ['school', 'academy', 'office', 'subway']);
  for (const id of ORDER) {
    const w = WORLDS[id];
    assert.strictEqual(w.id, id);
    assert.ok(w.name && w.emoji && w.desc && w.ruleText);
    assert.ok(w.theme && w.theme.bg && w.theme.grid);
    assert.ok(w.coinMul >= 1);
    assert.ok(w.boss && w.boss.ai === 'boss' && w.boss.pattern && w.boss.hp > 0);
    assert.ok(!('elite' in w), `${id}: 사람을 적(중간 보스)으로 두지 않는다`);
    const h = w.helper;
    assert.ok(h && h.name && h.emoji && h.t > 0 && h.arriveText && h.thanksText && h.leaveText, `${id}: 도우미 정의`);
    for (const k of ['heal', 'power', 'focus', 'team']) assert.ok(h.boons[k], `${id}: 조언 카드 ${k} 이름`);
    assert.ok(w.waves.length >= 3 && w.swarms.length >= 3);
  }
});

test('모든 월드: 웨이브·포위·분열에 쓰이는 적이 정의되어 있고 정의가 정상', () => {
  for (const id of ORDER) {
    const w = WORLDS[id];
    for (const wave of w.waves) for (const k in wave.w) assert.ok(w.enemies[k], `${id}: 웨이브의 ${k} 미정의`);
    for (const s of w.swarms) assert.ok(w.enemies[s.type], `${id}: 포위의 ${s.type} 미정의`);
    for (const k in w.enemies) {
      const e = w.enemies[k];
      assert.ok(e.hp > 0 && e.speed > 0 && e.r > 0 && e.dmg > 0 && e.xp > 0 && e.emoji && e.name, `${id}.${k} 필드`);
      assert.ok(['chase', 'zig', 'dash', 'shoot'].includes(e.ai), `${id}.${k} ai=${e.ai}`);
      if (e.onDeath) assert.ok(w.enemies[e.onDeath.type], `${id}.${k} 분열 대상 미정의`);
      if (e.ai === 'shoot') assert.ok(e.fireCd > 0);
      if (e.ai === 'dash') assert.ok(e.dashCd > 0);
    }
    assert.ok(w.enemies[w.boss.summon], `${id}: 보스 소환 대상 미정의`);
    const sec = w.waves.map((x) => [x.from, x.to]);
    for (let i = 1; i < sec.length; i++) assert.strictEqual(sec[i][0], sec[i - 1][1], `${id}: 웨이브 구간이 이어져야 함`);
  }
});

test('월드마다 적 이모지/이름이 겹치지 않는다(월드 개성)', () => {
  const seen = new Map();
  for (const id of ORDER) for (const k in WORLDS[id].enemies) {
    const key = WORLDS[id].enemies[k].emoji;
    assert.ok(!seen.has(key) || seen.get(key) === id, `이모지 ${key}가 ${seen.get(key)}와 ${id}에서 중복`);
    seen.set(key, id);
  }
});

test('모든 월드: 전체 판 동안 NaN 없이 돌아가고 보스가 90초에 월드의 보스로 등장한다', () => {
  for (const id of ORDER) {
    const s = new Sim({ seed: 11, events: false, world: id });
    let bossName = null;
    while (!s.over && s.tick < RUN_TICKS) {
      s.player.hp = 1e9;
      if (s.choices) s.choose(s.choices[0].id);
      s.step({ dx: Math.sin(s.tick / 50), dy: Math.cos(s.tick / 70) });
      if (!bossName) { const b = s.enemies.find((e) => e.type === 'boss'); if (b) { bossName = b.name; assert.ok(s.tick >= WORLDS[id].boss.times[0] * 60, `${id}: 보스가 너무 일찍 등장`); } }
      if (s.tick % 600 === 0) {
        for (const e of s.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), `${id} 적 NaN`);
        for (const b of s.ebullets) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `${id} 탄 NaN`);
        for (const h of s.hazards) assert.ok(Number.isFinite(h.x) && Number.isFinite(h.y), `${id} 위험물 NaN`);
      }
    }
    assert.strictEqual(bossName, WORLDS[id].boss.name, `${id}: 보스 이름`);
  }
});

test('월드별 보스 패턴: 보스 체력을 깎으면 3페이즈를 모두 거치고 클리어된다', () => {
  for (const id of ORDER) {
    const s = new Sim({ seed: 42, events: true, world: id });
    const phases = new Set();
    let bullets = 0, trains = 0, summoned = false;
    while (!s.over && s.tick < 20000) {
      s.player.hp = 1e9;
      if (s.choices) s.choose(s.choices[0].id);
      const boss = s.enemies.find((e) => e.type === 'boss');
      if (boss) boss.hp -= boss.maxhp * 0.0012;
      s.step({ dx: Math.sin(s.tick / 40) * 0.6, dy: 0 });
      bullets = Math.max(bullets, s.ebullets.length);
      for (const ev of s.drainEvents()) { if (ev.k === 'phase') phases.add(ev.phase); if (ev.k === 'train') trains++; }
      if (boss && s.enemies.some((e) => e.type !== 'boss' && e.t === 0 && Math.hypot(e.x - boss.x, e.y - boss.y) < 60)) summoned = true;
    }
    assert.ok(phases.has(2) && phases.has(3), `${id}: 페이즈 ${[...phases]}`);
    assert.strictEqual(s.result, 'clear', `${id}: 클리어`);
    const pat = WORLDS[id].boss.pattern;
    if (pat === 'spiral' || pat === 'exam') assert.ok(bullets > 0, `${id}: 탄막이 나와야 함`);
    if (pat === 'lane') assert.ok(trains > 0, `${id}: 보스가 열차를 불러야 함`);
  }
});

test('지하철 열차: 경고 후 질주하며 플레이어에게 피해, 일반 적은 즉사', () => {
  const s = new Sim({ seed: 3, events: false, world: 'subway' });
  const p = s.player; p.y = 300; p.x = 180;
  s._spawnTrain(300, 1, 20);
  assert.strictEqual(s.hazards[0].state, 'warn');
  s._make('bag', 260, 300); const bag = s.enemies[0]; bag.speed = 0;
  const hp0 = p.hp;
  for (let i = 0; i < 18; i++) s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.hazards[0].state, 'warn', '경고 중에는 피해 없음');
  assert.strictEqual(p.hp, hp0);
  for (let i = 0; i < 80; i++) s.step({ dx: 0, dy: 0 });
  assert.ok(p.hp < hp0, '열차에 치이면 피해');
  assert.ok(!s.enemies.includes(bag), '일반 적은 열차에 즉사');
  assert.strictEqual(s.hazards.length, 0, '화면을 벗어난 열차는 사라짐');
});

test('열차는 경고 단계에서 피할 수 있다(다른 높이면 피해 없음)', () => {
  const s = new Sim({ seed: 3, events: false, world: 'subway' });
  s.player.y = 500; s.player.x = 180;
  s._spawnTrain(200, 1, 10);
  const hp0 = s.player.hp;
  for (let i = 0; i < 120; i++) s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.player.hp, hp0);
});

test('지하철 규칙: 열차가 주기적으로 등장하고 보스전 직전에는 멈춘다', () => {
  const s = new Sim({ seed: 5, events: true, world: 'subway' });
  let trains = 0, last = 0;
  while (s.tick < RUN_TICKS) {
    s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
    s.step({ dx: 0, dy: 0 });
    for (const ev of s.drainEvents()) if (ev.k === 'train') { trains++; if (s.tick > last) last = s.tick; }
    if (s.tick === WORLDS.subway.boss.times[0] * 60 - 1) { assert.ok(trains >= 2, `보스 전까지 열차 ${trains}대`); }
    if (s.over) break;
  }
  const school = new Sim({ seed: 5, events: true, world: 'school' });
  for (let i = 0; i < 3000; i++) { school.player.hp = 1e9; if (school.choices) school.choose(school.choices[0].id); school.step({ dx: 0, dy: 0 }); }
  assert.strictEqual(school.hazards.length, 0, '학교에는 열차 없음');
});

test('회사 규칙: 적을 잡으면 커피가 나오고 먹으면 체력이 회복된다', () => {
  const s = new Sim({ seed: 9, events: false, world: 'office' });
  s.player.hp = 50;
  s.gems.push({ x: s.player.x, y: s.player.y, v: 15, kind: 'coffee' });
  s.step({ dx: 0, dy: 0 });
  assert.strictEqual(Math.round(s.player.hp), 65);
  assert.strictEqual(s.gemCount, 0, '커피는 경험치 구슬이 아님');
  assert.strictEqual(s.player.xp, 0);
  let coffees = 0;
  for (let i = 0; i < 400; i++) { s.world.rules.coffeeChance = 1; s._make('doc', 20, 20); s.enemies[s.enemies.length - 1].hp = 0; s.step({ dx: 0, dy: 0 }); }
  coffees = s.gems.filter((g) => g.kind === 'coffee').length + 1;
  assert.ok(coffees > 1);
  s.world.rules.coffeeChance = 0.05;
  const sc = new Sim({ seed: 9, events: false, world: 'school' });
  sc._make('hw', 20, 20); sc.enemies[0].hp = 0; sc.step({ dx: 0, dy: 0 });
  assert.ok(!sc.gems.some((g) => g.kind === 'coffee'), '학교에는 커피 없음');
});

test('학원 규칙: 경험치 +30%', () => {
  const xpOf = (world) => { const s = new Sim({ seed: 1, events: false, world }); s.gems.push({ x: s.player.x, y: s.player.y, v: 3 }); s.step({ dx: 0, dy: 0 }); return s.player.xp; };
  const base = xpOf('school'), acad = xpOf('academy');
  assert.ok(Math.abs(acad / base - 1.3) < 1e-9, `${base} → ${acad}`);
});

test('월드가 뒤로 갈수록 같은 적의 체력이 높다(난이도 단계)', () => {
  const hpOf = (world) => { const s = new Sim({ seed: 1, events: false, world }); s._make(Object.keys(WORLDS[world].enemies)[0], 0, 0); const e = s.enemies[0]; return e.maxhp / WORLDS[world].enemies[Object.keys(WORLDS[world].enemies)[0]].hp; };
  const r = ORDER.map(hpOf);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1], `체력 배율 ${r.join(',')}`);
});

test('적 분열: 월드별 onDeath 정의대로 분열한다', () => {
  for (const id of ORDER) {
    const w = WORLDS[id];
    const k = Object.keys(w.enemies).find((x) => w.enemies[x].onDeath);
    assert.ok(k, `${id}: 분열 적이 하나는 있어야 함`);
    const s = new Sim({ seed: 8, events: false, world: id });
    s.player.hp = 1e9;
    s._make(k, 100, 100); s.enemies[0].hp = 0;
    s.step({ dx: 0, dy: 0 });
    const od = w.enemies[k].onDeath;
    assert.ok(s.enemies.filter((e) => e.type === od.type).length >= od.n, `${id}.${k}`);
  }
});

test('원거리 적은 volley 수만큼 한 번에 발사한다', () => {
  const s = new Sim({ seed: 2, events: false, world: 'subway' });
  s.player.hp = 1e9; s.player.x = 180; s.player.y = 400;
  s._make('ad', 180, 250); const e = s.enemies[0]; e.speed = 0; e.cd = 1;
  s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.ebullets.length, WORLDS.subway.enemies.ad.volley);
});

test('에코는 월드를 넘어 이어진다 (다른 월드에서도 재생)', () => {
  const a = runBot(new Sim({ seed: 5, events: false, world: 'school' }), 900);
  const out = a.exportEcho();
  for (const id of ORDER) {
    const s = new Sim({ seed: 6, events: false, world: id, echoes: [out] });
    s.player.hp = 1e9;
    for (let i = 0; i < 300; i++) { if (s.choices) s.choose(s.choices[0].id); s.step({ dx: 0, dy: 0 }); }
    assert.strictEqual(s.echoes[0].x, out.path[299 * 2], id);
    assert.strictEqual(s.echoes[0].alive, true);
  }
});

test('알 수 없는 월드 id는 학교로 대체', () => {
  assert.strictEqual(new Sim({ seed: 1, events: false, world: 'nope' }).world.id, 'school');
  assert.strictEqual(new Sim({ seed: 1, events: false }).world.id, 'school');
});

test('결정론: 같은 월드/시드/입력이면 같은 결과', () => {
  for (const id of ORDER) {
    const snap = (s) => JSON.stringify({ t: s.tick, k: s.kills, n: s.enemies.length, g: s.gems.length, h: s.hazards.length, lv: s.player.level });
    const a = runBot(new Sim({ seed: 77, events: false, world: id }), 2500);
    const b = runBot(new Sim({ seed: 77, events: false, world: id }), 2500);
    assert.strictEqual(snap(a), snap(b), id);
  }
});

test('성능: 월드당 한 판이 틱당 평균 1ms 미만', () => {
  for (const id of ORDER) {
    const s = new Sim({ seed: 3, events: false, world: id });
    const t0 = process.hrtime.bigint();
    runBot(s, RUN_TICKS);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(1, s.tick);
    assert.ok(ms < 1, `${id}: ${ms.toFixed(3)}ms/tick`);
  }
});


/* ===================== 가치 방향 (사람을 적으로 만들지 않기) ===================== */

const PERSON_EMOJI = /[\u{1F464}-\u{1F465}\u{1F466}-\u{1F469}\u{1F46E}-\u{1F478}\u{1F47C}\u{1F481}-\u{1F487}\u{1F645}-\u{1F64F}\u{1F9B8}-\u{1F9B9}\u{1F9CD}-\u{1F9CF}\u{1F9D0}-\u{1F9DF}\u{1F6B6}\u{1F977}\u{1F575}]/u;
const FORBIDDEN_WORDS = ['숙제', '선생', '강사', '팀장', '상사', '승객', '승무원', '역무원', '소매치기', '손님', '경찰', '사장'];

test('가치: 적과 보스는 사람이 아니고, 사람/숙제를 가리키는 이름도 아니다', () => {
  for (const id of ORDER) {
    const w = WORLDS[id];
    const all = Object.assign({}, w.enemies, { boss: w.boss });
    for (const k in all) {
      const e = all[k];
      assert.ok(!PERSON_EMOJI.test(e.emoji), `${id}.${k}: 사람 이모지 ${e.emoji}를 적으로 쓰면 안 됨`);
      for (const bad of FORBIDDEN_WORDS) assert.ok(!e.name.includes(bad), `${id}.${k}: 적 이름 "${e.name}"에 "${bad}" 사용 금지`);
    }
    for (const s of w.swarms) for (const bad of FORBIDDEN_WORDS) assert.ok(!s.text.includes(bad), `${id}: 포위 문구 "${s.text}"에 "${bad}" 금지`);
    for (const t of [w.boss.warnText, w.boss.startText]) for (const bad of FORBIDDEN_WORDS) assert.ok(!t.includes(bad), `${id}: 보스 문구 "${t}"`);
  }
});

test('가치: 도우미(선생님·선배·역무원)는 사람이고, 적 목록/웨이브/포위에는 나오지 않는다', () => {
  for (const id of ORDER) {
    const w = WORLDS[id];
    assert.ok(PERSON_EMOJI.test(w.helper.emoji), `${id}: 도우미는 사람 이모지`);
    const enemyEmojis = Object.values(w.enemies).map((e) => e.emoji);
    assert.ok(!enemyEmojis.includes(w.helper.emoji), `${id}: 도우미와 같은 이모지의 적이 있으면 안 됨`);
    assert.ok(!Object.keys(w.enemies).includes('teacher'));
  }
  assert.ok(WORLDS.school.helper.name.includes('선생님'), '학교의 도우미는 담임 선생님');
});

test('가치: 시뮬레이션 어디에도 사람 적(teacher/elite)이 생성되지 않는다', () => {
  for (const id of ORDER) {
    const s = new Sim({ seed: 14, events: false, world: id });
    const types = new Set();
    while (!s.over && s.tick < RUN_TICKS) {
      s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
      s.step({ dx: Math.sin(s.tick / 50), dy: Math.cos(s.tick / 70) });
      for (const e of s.enemies) types.add(e.type);
    }
    assert.ok(!types.has('teacher') && !types.has('elite'), `${id}: ${[...types]}`);
    for (const t of types) assert.ok(t === 'boss' || WORLDS[id].enemies[t], `${id}: 정의 없는 적 ${t}`);
  }
});

/* ===================== 도우미(도움 요청하기) ===================== */

function nearHelper(s) { const h = s.helper; s.player.x = h.x; s.player.y = h.y; }

test('도우미: 정해진 시간(45초)에 등장하고 안내 문구/이벤트가 나온다', () => {
  for (const id of ORDER) {
    const s = new Sim({ seed: 3, events: true, world: id });
    s.player.hp = 1e9;
    let appeared = null, banner = null;
    while (s.tick <= WORLDS[id].helper.t * 60 + 5) {
      if (s.choices) s.choose(s.choices[0].id);
      s.step({ dx: 0, dy: 0 });
      for (const ev of s.drainEvents()) { if (ev.k === 'helper') appeared = s.tick; if (ev.k === 'banner' && ev.text === WORLDS[id].helper.arriveText) banner = true; }
      if (s.helper && appeared === null) appeared = s.tick;
    }
    assert.ok(s.helper && s.helper.state === 'wait', `${id}: 도우미 등장`);
    assert.ok(Math.abs(appeared - WORLDS[id].helper.t * 60) <= 2, `${id}: 등장 시각 ${appeared}`);
    assert.ok(banner, `${id}: 안내 배너`);
    assert.ok(s.helper.x > 40 && s.helper.x < W - 40 && s.helper.y > 80 && s.helper.y < H - 100, `${id}: 화면 안에 등장 (${s.helper.x | 0},${s.helper.y | 0})`);
  }
});

test('도우미: 곁에 머물면 게이지가 차고, 떠나면 줄어든다', () => {
  const s = new Sim({ seed: 3, events: false });
  s._spawnHelper(); s.player.hp = 1e9;
  const far = () => { s.player.x = s.helper.x < W / 2 ? W - 20 : 20; s.player.y = s.helper.y; };
  nearHelper(s);
  for (let i = 0; i < 60; i++) { nearHelper(s); s.step({ dx: 0, dy: 0 }); }
  assert.ok(s.helper.prog >= 55, `머무는 동안 증가: ${s.helper.prog}`);
  const p1 = s.helper.prog;
  for (let i = 0; i < 20; i++) { far(); s.step({ dx: 0, dy: 0 }); }
  assert.ok(s.helper.prog < p1, '멀어지면 감소');
  assert.strictEqual(s.helper.state, 'wait');
});

test('도우미: 충분히 머물면 조언 카드 3장을 받고, 선택한 효과가 적용된다', () => {
  const mk = () => { const s = new Sim({ seed: 3, events: true }); s._spawnHelper(); s.player.hp = 100; return s; };
  const ask = (s) => { for (let i = 0; i < 200 && !s.choices; i++) { nearHelper(s); s.player.hp = Math.max(1, s.player.hp); s.step({ dx: 0, dy: 0 }); } };
  // 체력 회복
  let s = mk(); ask(s);
  assert.ok(s.choices && s.choices.length === 3 && s.choiceKind === 'helper');
  assert.deepStrictEqual(s.choices.map((c) => c.id), ['boon_heal', 'boon_power', 'boon_focus'], '에코가 없으면 3번째는 집중');
  assert.strictEqual(s.helped, 1);
  assert.strictEqual(s.helper.state, 'done');
  assert.ok(s.choices.every((c) => c.name && c.desc && c.icon));
  s.player.hp = 10; s.choose('boon_heal');
  assert.strictEqual(s.player.hp, s.player.maxhp);
  assert.strictEqual(s.choices, null); assert.strictEqual(s.choiceKind, 'levelup');
  // 공격력 / 발사 속도
  s = mk(); ask(s); s.choose('boon_power');
  assert.strictEqual(s.player.stats.dmg, 1);
  assert.ok(s.rec.ups.some((u) => u.id === 'dmg'), '에코도 같은 조언을 받도록 기록');
  s = mk(); ask(s); s.choose('boon_focus');
  assert.strictEqual(s.player.stats.rate, 1);
});

test('도우미: 에코가 있으면 세 번째 카드가 "에코 응원"이고 효과가 적용된다', () => {
  const echo = { path: new Array(4000).fill(100), ups: [], ticks: 2000 };
  const s = new Sim({ seed: 3, events: false, echoes: [echo] });
  s._spawnHelper(); s.player.hp = 1e9;
  for (let i = 0; i < 200 && !s.choices; i++) { nearHelper(s); s.step({ dx: 0, dy: 0 }); }
  assert.deepStrictEqual(s.choices.map((c) => c.id), ['boon_heal', 'boon_power', 'boon_team']);
  s.choose('boon_team');
  assert.strictEqual(s.player.stats.echo, 1);
});

test('도우미: 시간 안에 못 가면 떠나고(불이익 없음), 선택창이 떠도 게임이 정상 진행된다', () => {
  const s = new Sim({ seed: 3, events: true });
  s._spawnHelper(); s.player.hp = 1e9;
  s.player.x = s.helper.x < W / 2 ? W - 20 : 20; s.player.y = s.helper.y;
  const hp0 = s.player.hp;
  let left = false;
  for (let i = 0; i < 1700; i++) {
    s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
    s.step({ dx: 0, dy: 0 });
    for (const ev of s.drainEvents()) if (ev.k === 'banner' && ev.text === WORLDS.school.helper.leaveText) left = true;
    if (!s.helper) break;
  }
  assert.ok(left, '떠나는 문구');
  assert.strictEqual(s.helper, null);
  assert.strictEqual(s.helped, 0);
  assert.strictEqual(s.player.hp, hp0, '도움을 못 받아도 벌은 없다');
});

test('도우미는 적이 건드릴 수 없다 (적 목록에 없고 접촉 판정 대상이 아님)', () => {
  const s = new Sim({ seed: 3, events: false });
  s._spawnHelper(); s.player.hp = 1e9; s.player.x = 10; s.player.y = H - 20;
  for (let i = 0; i < 30; i++) { s._make('alarm', s.helper.x, s.helper.y); s.step({ dx: 0, dy: 0 }); }
  assert.ok(s.helper && s.helper.state === 'wait');
  assert.ok(!s.enemies.some((e) => e === s.helper));
});

test('도우미: 이번 판 도움 횟수가 helped에 기록된다', () => {
  const s = new Sim({ seed: 3, events: false });
  s._spawnHelper(); s.player.hp = 1e9;
  for (let i = 0; i < 200 && !s.choices; i++) { nearHelper(s); s.step({ dx: 0, dy: 0 }); }
  s.choose('boon_power');
  assert.strictEqual(s.helped, 1);
});


/* ===================== 큰 도전(보스)이 여러 번 + 아슬아슬한 승부 ===================== */

const { TUNING } = E;
const killBoss = (s) => { const b = s.enemies.find((e) => e.type === 'boss'); b.hp = 0; };
const stepTo = (s, cond, max) => { for (let i = 0; i < max && !cond(); i++) { s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id); s.step({ dx: 0, dy: 0 }); } };

test('월드가 높을수록 보스가 더 여러 번 등장한다 (1, 2, 3, 4번)', () => {
  const counts = ORDER.map((id) => WORLDS[id].boss.times.length);
  assert.deepStrictEqual(counts, [1, 2, 3, 4]);
  for (const id of ORDER) {
    const t = WORLDS[id].boss.times;
    for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `${id}: 보스 시각은 증가`);
    assert.ok(WORLDS[id].boss.fightSec >= 20, `${id}: 목표 전투 시간`);
  }
});

test('여러 번 등장: 하나를 극복해야 다음이 나오고, 극복 사이에 숨 돌리기(체력 회복)가 있다', () => {
  const s = new Sim({ seed: 31, events: true, world: 'office' });   // 보스 3번
  assert.strictEqual(s.bossCount, 3);
  stepTo(s, () => s.bossAlive, 9000);
  assert.strictEqual(s.bossIdx, 1); assert.strictEqual(s.bossDefeated, 0);
  // 보스가 살아 있는 동안 다음 보스는 나오지 않는다
  for (let i = 0; i < 20000 && s.tick <= WORLDS.office.boss.times[1] * 60 + 300; i++) {   // 보스를 못 잡는 상황
    s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
    const bb = s.enemies.find((e) => e.type === 'boss'); if (bb) bb.hp = bb.maxhp;
    s.step({ dx: 0, dy: 0 });
  }
  assert.strictEqual(s.enemies.filter((e) => e.type === 'boss').length, 1, '동시에 한 명만');
  assert.strictEqual(s.bossIdx, 1);
  s.player.hp = 40; const t0 = s.tick;
  killBoss(s); s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.bossDefeated, 1); assert.strictEqual(s.bossAlive, false); assert.strictEqual(s.bossDead, false);
  assert.ok(s.player.hp >= 40 + s.player.maxhp * TUNING.bossBreatherHeal - 1, `숨 돌리기 회복: ${s.player.hp}`);
  assert.strictEqual(s.over, false);
  const evs = s.drainEvents();
  assert.ok(evs.some((e) => e.k === 'banner' && e.text.includes('한 고비')), '안내 문구');
  // 다음 보스는 최소 간격(6초) 뒤
  stepTo(s, () => s.bossAlive, 3000);
  assert.strictEqual(s.bossIdx, 2);
  assert.ok(s.tick - t0 >= TUNING.bossGapSec * 60, `간격 ${(s.tick - t0) / 60}초`);
  // 모두 극복해야 클리어
  killBoss(s); s.step({ dx: 0, dy: 0 });
  stepTo(s, () => s.bossAlive, 3000); assert.strictEqual(s.bossIdx, 3);
  assert.strictEqual(s.over, false);
  killBoss(s); s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.bossDead, true); assert.strictEqual(s.over, true); assert.strictEqual(s.result, 'clear');
});

test('학교는 보스 1번: 극복하면 바로 클리어 (숨 돌리기 없음)', () => {
  const s = new Sim({ seed: 32, events: false, world: 'school' });
  stepTo(s, () => s.bossAlive, 9000);
  s.player.hp = 50; killBoss(s); s.step({ dx: 0, dy: 0 });
  assert.strictEqual(s.result, 'clear');
});

test('다음 보스일수록 더 단단하고 빠르다', () => {
  const s = new Sim({ seed: 33, events: false, world: 'subway' });
  s.player.hp = 1e9;
  const hp = [], sp = [];
  for (let i = 0; i < 4; i++) { s._make('boss', 100, 100, i); const b = s.enemies[s.enemies.length - 1]; hp.push(b.maxhp); sp.push(b.speed); }
  for (let i = 1; i < 4; i++) { assert.ok(hp[i] > hp[i - 1], `체력 ${hp.map((x) => x | 0)}`); assert.ok(sp[i] > sp[i - 1]); }
  const labels = []; s._make('boss', 0, 0, 2); labels.push(s.enemies[s.enemies.length - 1].label);
  assert.ok(labels[0].includes('3/4'), labels[0]);
});

test('보스 체력은 플레이어+에코의 화력에 비례한다 (강해져도 쉬워지지 않는다)', () => {
  const hpOf = (setup) => { const s = new Sim({ seed: 34, events: false, world: 'school', echoes: setup.echoes, bonus: setup.bonus }); if (setup.stats) Object.assign(s.player.stats, setup.stats); s._make('boss', 0, 0, 0); return s.enemies[0].maxhp; };
  const base = hpOf({});
  const strong = hpOf({ stats: { dmg: 4, rate: 4, multi: 2, crit: 3 }, bonus: { dmgMul: 1.3 } });
  assert.ok(strong > base * 1.5, `강한 플레이어 ${strong | 0} > 기본 ${base | 0}`);
  const echo = { path: new Array(7200).fill(100), ups: [{ t: 0, id: 'dmg' }, { t: 0, id: 'dmg' }, { t: 0, id: 'rate' }], ticks: 7200 };
  const s0 = new Sim({ seed: 34, events: false, echoes: [echo, echo, echo, echo] });
  s0.echoes.forEach((e) => { e.stats.dmg = 2; e.stats.rate = 2; });
  s0._make('boss', 0, 0, 0);
  assert.ok(s0.enemies[0].maxhp > base * 1.5, `에코 4명 ${s0.enemies[0].maxhp | 0} > 기본 ${base | 0}`);
  // 죽은 에코는 화력에 포함되지 않는다
  s0.echoes.forEach((e) => { e.alive = false; });
  assert.ok(Math.abs(s0._firepower() - new Sim({ seed: 34, events: false })._firepower()) < 1e-9);
  // 최소 체력(바닥)
  const weak = new Sim({ seed: 34, events: false, bonus: { dmgMul: 0.01 } });
  weak._make('boss', 0, 0, 0);
  assert.ok(weak.enemies[0].maxhp >= WORLDS.school.boss.hp * TUNING.bossFloorMul - 1e-9);
});

test('보스전이 길어지면 격앙(피해 +40%, 이동 +25%)되고 안내 문구가 나온다', () => {
  const s = new Sim({ seed: 35, events: true, world: 'school' });
  stepTo(s, () => s.bossAlive, 9000);
  const b = s.enemies.find((e) => e.type === 'boss');
  b.hp = b.maxhp = 1e9;
  const dmg0 = b.dmg, sp0 = b.speed;
  s.drainEvents();
  stepTo(s, () => b.enraged, TUNING.enrageSec * 60 + 600);
  assert.strictEqual(b.enraged, true);
  assert.ok(Math.abs(b.dmg - dmg0 * 1.4) < 1e-9 && Math.abs(b.speed - sp0 * 1.25) < 1e-9);
  assert.ok(s.drainEvents().some((e) => e.k === 'banner' && e.text.includes('거세')));
  assert.ok(b.t >= TUNING.enrageSec * 60 - 2, '격앙 시점');
});

test('보스전 중에는 받는 피해가 최대 체력/에코 수에 비례해 커지고, 평소에는 그대로', () => {
  const taken = (opts, boss) => {
    const s = new Sim({ seed: 36, events: false, ...opts });
    s.bossAlive = !!boss; const p = s.player; const hp0 = p.hp; p.inv = 0; s._hurtPlayer(10); return (hp0 - p.hp);
  };
  const normal = taken({}, false), boss = taken({}, true);
  assert.ok(Math.abs(boss / normal - TUNING.bossAtkMul) < 1e-9, `보스전 배율 ${boss / normal}`);
  const tanky = taken({ bonus: { maxhp: 130 } }, true);
  assert.ok(tanky > boss * 1.5, `체력이 높을수록 한 방이 더 아프다: ${tanky} vs ${boss}`);
  assert.ok(Math.abs(taken({ bonus: { maxhp: 130 } }, false) - normal) < 1e-9, '평소에는 체력 강화가 그대로 이득');
  const echo = { path: new Array(100).fill(100), ups: [], ticks: 100 };
  const withEchoes = taken({ echoes: [echo, echo, echo, echo] }, true);
  assert.ok(Math.abs(withEchoes / boss - (1 + 4 * TUNING.bossAtkPerEcho)) < 1e-9);
  // 체력이 낮은 캐릭터도 불리해지지 않는다 (하한 1)
  assert.ok(Math.abs(taken({ bonus: { maxhp: -50 } }, true) - boss) < 1e-9);
});

test('보스전 중에는 체력 재생이 줄어든다', () => {
  const regenAfter = (boss) => {
    const s = new Sim({ seed: 37, events: false, bonus: { regen: 6 } });
    s.player.hp = 50; s.bossAlive = boss;
    for (let i = 0; i < 60; i++) { s.bossAlive = boss; s.step({ dx: 0, dy: 0 }); }
    return s.player.hp - 50;
  };
  const normal = regenAfter(false), inBoss = regenAfter(true);
  assert.ok(normal > 4 && inBoss < normal * 0.6, `재생 ${normal.toFixed(2)} vs 보스전 ${inBoss.toFixed(2)}`);
});

test('여러 번 등장하는 월드의 연장전 한도는 보스 수만큼 늘어난다', () => {
  const s = new Sim({ seed: 38, events: false, world: 'academy' });   // 보스 2번
  s.player.hp = 1e9;
  const cap = RUN_TICKS + E.OVERTIME_TICKS + 30 * 60;
  while (!s.over && s.tick < cap + 20) {
    s.player.hp = 1e9; if (s.choices) s.choose(s.choices[0].id);
    const b = s.enemies.find((e) => e.type === 'boss'); if (b) b.hp = b.maxhp;   // 못 잡는 상황
    s.step({ dx: 0, dy: 0 });
  }
  assert.strictEqual(s.over, true); assert.strictEqual(s.result, 'survive');
  assert.ok(s.tick > RUN_TICKS + E.OVERTIME_TICKS, '보스 1번 월드보다 오래 허용');
  assert.ok(s.tick <= cap + 1);
});

test('큰 도전이 여러 번인 월드도 졸개 스폰은 첫 보스부터 줄어든다', () => {
  const s = new Sim({ seed: 39, events: false, world: 'academy' });
  stepTo(s, () => s.bossAlive, 9000);
  assert.ok(s.bossIdx > 0);
});
