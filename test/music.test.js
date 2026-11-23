'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Mu = require('../src/music.js');
const { ORDER } = require('../src/worlds.js');

test('배경음악: 12개 월드 모두 곡이 있고, 곡마다 템포·음계·드럼이 다르다', () => {
  for (const id of ORDER) assert.ok(Mu.SONGS[id], `${id} 곡 없음`);
  const sig = new Set(ORDER.map((id) => { const s = Mu.SONGS[id]; return `${s.bpm}|${s.scale}|${s.drums}|${s.root}`; }));
  assert.strictEqual(sig.size, ORDER.length, '월드마다 다른 곡');
  assert.strictEqual(new Set(ORDER.map((id) => Mu.SONGS[id].name)).size, ORDER.length);
});

test('곡 생성: 같은 월드면 항상 같은 곡, 음과 박자가 정상 범위', () => {
  for (const id of ORDER) for (const boss of [false, true]) {
    const a = Mu.compose(id, boss), b = Mu.compose(id, boss);
    assert.deepStrictEqual(a, b, `${id} 결정론`);
    assert.strictEqual(a.steps, a.bars * 16);
    const kinds = new Set(a.events.map((e) => e.kind));
    for (const k of ['kick', 'bass', 'pad']) assert.ok(kinds.has(k), `${id}${boss ? ' 보스' : ''}: ${k} 없음`);
    assert.ok(kinds.has('lead') || kinds.has('bell'), `${id}: 멜로디 없음`);
    for (const e of a.events) {
      assert.ok(e.step >= 0 && e.step < a.steps);
      if (e.midi !== undefined) { assert.ok(Number.isInteger(e.midi) && e.midi >= 24 && e.midi <= 100, `${id} 음 ${e.midi}`); assert.ok(e.len > 0 && e.vol > 0 && e.vol < 0.3); }
    }
  }
});

test('보스 곡: 같은 조에서 더 빠르고, 어두운 화성 단음계에 하이햇·베이스가 더 촘촘하다', () => {
  for (const id of ORDER) {
    const w = Mu.compose(id, false), b = Mu.compose(id, true), bs = Mu.bossSong(id);
    assert.ok(b.bpm > w.bpm, `${id}: 보스 템포 ${b.bpm} > ${w.bpm}`);
    assert.strictEqual(bs.scale, 'harmonic');
    assert.strictEqual(((bs.root - Mu.SONGS[id].root) % 12 + 12) % 12, 0, '같은 조(근음)');
    const count = (c, k) => c.events.filter((e) => e.kind === k).length;
    assert.ok(count(b, 'hat') > count(w, 'hat') || count(w, 'hat') === b.steps, `${id}: 하이햇`);
    assert.ok(count(b, 'bass') >= count(w, 'bass'), `${id}: 베이스`);
  }
});

test('왕마다 다른 배경음악: 39종 보스 모두 곡이 다르고(조·템포·코드·악기·리듬), 같은 왕은 항상 같은 곡', () => {
  const S = require('../src/sim.js');
  const pool = S.Sim.bossPool();
  assert.ok(pool.length >= 39);
  const sigs = new Set();
  for (const b of pool) {
    const a = Mu.compose('school', b), c = Mu.compose('school', b);
    assert.deepStrictEqual(a, c, `${b.name} 결정론`);
    assert.ok(a.name.includes(b.name));
    for (const e of a.events) if (e.midi !== undefined) assert.ok(Number.isInteger(e.midi) && e.midi >= 24 && e.midi <= 100, `${b.name} 음 ${e.midi}`);
    const kinds = new Set(a.events.map((e) => e.kind)); for (const k of ['kick', 'bass', 'pad', 'lead']) assert.ok(kinds.has(k), `${b.name}: ${k}`);
    const lead = a.events.filter((e) => e.kind === 'lead').slice(0, 24).map((e) => `${e.step}:${e.midi}`).join(',');
    sigs.add(`${a.bpm}|${lead}`);
  }
  assert.strictEqual(sigs.size, pool.length, '보스마다 다른 곡');
  // 공격 방식별로 장르(음계·드럼)가 다르다
  const scaleOf = (p) => Mu.bossThemeSong('school', { name: 'x', pattern: p }).scale;
  assert.strictEqual(new Set(['exam', 'spiral', 'charge', 'lane'].map(scaleOf)).size, 4);
});

test('왕 테마는 캐릭터 특징을 따른다 (악기·효과음): 시계·자장가·폭풍·어질어질', () => {
  const kinds = (name) => new Set(Mu.compose('school', { name, pattern: 'exam' }).events.map((e) => e.inst || e.kind));
  const exam = kinds('시험 불안'), sleep = kinds('졸음 마왕'), storm = kinds('태풍'), dizzy = kinds('멀미');
  assert.ok(exam.has('tick') && exam.has('bell'), '시험 불안: 째깍 시계 + 종소리');
  assert.ok(sleep.has('gong') && sleep.has('bell'), '졸음 마왕: 으스스한 자장가');
  assert.ok(storm.has('storm') && storm.has('brass'), '태풍: 폭풍 + 금관');
  assert.ok(dizzy.has('wobble'), '멀미: 흔들리는 소리');
  assert.ok(Mu.compose('school', { name: '졸음 마왕', pattern: 'exam' }).bpm < Mu.compose('school', { name: '급행열차', pattern: 'lane' }).bpm, '졸음은 느리고 열차는 빠르다');
});
