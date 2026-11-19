// node prototype/test.js — 헤드리스 검증: 결정론 + 에코 누적 효과(밸런스 감 잡기)
const { Sim, UPGRADES } = require('./sim.js');
const assert = require('assert');

function bot(sim) {
  const p = sim.player;
  let fx = 0, fy = 0;
  for (const e of sim.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 110) { const w = (110 - d) / 110; fx += (dx / d) * w * (e.type === 'boss' ? 2 : 1); fy += (dy / d) * w; }
  }
  // 벽 회피 + 중앙 유도
  fx += (180 - p.x) / 900; fy += (320 - p.y) / 1400;
  // 구슬 쪽으로 약하게
  let g = sim.gems[0];
  if (g && Math.hypot(fx, fy) < 0.3) { fx += (g.x - p.x) / 300; fy += (g.y - p.y) / 300; }
  return { dx: fx, dy: fy };
}

function run(seed, echoes) {
  const s = new Sim({ seed, echoes });
  let guard = 0;
  while (!s.over && guard++ < 200000) {
    if (s.choices) s.choose(s.choices[(s.tick + s.player.level) % 3].id);
    s.step(bot(s));
  }
  return s;
}

// 1) 같은 시드 + 같은 입력 = 같은 결과
const a = run(42, []), b = run(42, []);
assert.deepStrictEqual([a.kills, a.tick, a.result, a.player.level], [b.kills, b.tick, b.result, b.player.level]);
console.log('결정론 OK', a.kills, a.tick, a.result);

// 2) 에코 누적 효과
let echoes = [];
for (let i = 0; i < 8; i++) {
  const s = run(1000 + i, echoes);
  const sec = (s.tick / 60).toFixed(0);
  console.log(`판 ${i + 1}: 에코 ${String(echoes.length).padStart(2)}명 | 결과 ${s.result.padEnd(7)} | 생존 ${sec}s | 처치 ${String(s.kills).padStart(3)} | Lv ${s.player.level}`);
  echoes = echoes.concat(s.exportEcho()).slice(-10);
}

// 3) 에코 재생 정합성: 에코 경로가 기록된 경로와 틱별로 일치
const rec = run(7, []);
const e = rec.exportEcho();
const replay = new Sim({ seed: 8, echoes: [e] });
for (let t = 0; t < Math.min(600, e.ticks); t++) {
  replay.step({ dx: 0, dy: 0 });
  assert.strictEqual(replay.echoes[0].x, e.path[t * 2]);
}
console.log('에코 재생 정합성 OK');
