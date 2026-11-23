/* Echo Rush — 튜토리얼: 처음 하는 사람이 "에코 10명과 함께 싸우는 느낌"을 먼저 경험하게 한다.
 * 실제 기록 대신, 시드로 만든 '그럴듯한 과거의 나' 10명의 이동 경로와 성장 기록을 만든다.
 * DOM 의존 없음 (테스트 가능).
 */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./sim.js') : root.EchoSim;
  const { W, H, PLAY_BOTTOM, TICK, RUN_TICKS, OVERTIME_TICKS, MAX_ECHOES, MAX_LEVEL, mulberry32 } = E;

  const TUTORIAL_ECHOES = MAX_ECHOES;     // 10명
  const TUTORIAL_WORLD = 'school';
  // 에코마다 선호하는 성장 방향(공격 계열 위주). 에코는 heal/echo 업그레이드를 쓰지 않는다.
  const BUILDS = [
    ['rate', 'dmg', 'multi', 'crit'],
    ['dmg', 'pierce', 'rate', 'orbit'],
    ['multi', 'rate', 'nova', 'dmg'],
    ['crit', 'dmg', 'rate', 'magnet'],
    ['orbit', 'dmg', 'rate', 'multi'],
    ['nova', 'rate', 'dmg', 'pierce'],
    ['rate', 'multi', 'pierce', 'speed'],
    ['dmg', 'crit', 'orbit', 'rate'],
    ['multi', 'dmg', 'nova', 'crit'],
    ['pierce', 'rate', 'dmg', 'regen'],
  ];
  const UPS_PER_ECHO = 18;      // 한 판 동안 성장 횟수 (보통 플레이어가 보스전까지 도달하는 정도)
  const UPS_BY_SEC = 120;       // 이 시점까지 성장을 마친다

  /** 그럴듯하게 돌아다니는 경로: 목표 지점을 골라 걸어가고, 도착하거나 시간이 지나면 새 목표를 고른다 */
  function makePath(rng, i, ticks) {
    const ang = (i / TUTORIAL_ECHOES) * Math.PI * 2;
    let x = W / 2 + Math.cos(ang) * 70, y = H * 0.45 + Math.sin(ang) * 70;   // 시작부터 주인공을 둘러싸서 잘 보이게
    const speed = 1.9 + rng() * 0.7;
    const top = 50, bottom = PLAY_BOTTOM - 10, margin = 24;
    let tx = x, ty = y, left = 0;
    const path = new Array(ticks * 2);
    for (let t = 0; t < ticks; t++) {
      if (left <= 0 || Math.hypot(tx - x, ty - y) < 4) {
        // 화면 중앙 쪽을 조금 더 자주 고른다 (주인공 곁에서 싸우는 느낌)
        const c = rng() < 0.5;
        tx = c ? W / 2 + (rng() - 0.5) * 180 : margin + rng() * (W - margin * 2);
        ty = c ? H * 0.45 + (rng() - 0.5) * 200 : top + rng() * (bottom - top);
        left = 40 + Math.floor(rng() * 120);
      }
      left--;
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      const s = Math.min(speed, d);
      x = Math.min(W - 8, Math.max(8, x + dx / d * s));
      y = Math.min(H - 8, Math.max(8, y + dy / d * s));
      path[t * 2] = Math.round(x * 10) / 10; path[t * 2 + 1] = Math.round(y * 10) / 10;
    }
    return path;
  }

  /** 선호 방향을 따라 성장 기록을 만든다 (각 능력 최대 MAX_LEVEL) */
  function makeUps(rng, i) {
    const build = BUILDS[i % BUILDS.length];
    const lv = {};
    const ups = [];
    for (let k = 0; k < UPS_PER_ECHO; k++) {
      const t = Math.round(TICK * UPS_BY_SEC * Math.pow((k + 1) / UPS_PER_ECHO, 1.3));
      // 앞쪽 선호일수록 자주 고른다. 가득 찬 능력은 건너뛴다.
      const open = build.filter((id) => (lv[id] || 0) < MAX_LEVEL);
      if (!open.length) break;
      let r = rng() * open.reduce((a, _, j) => a + (open.length - j), 0), id = open[0];
      for (let j = 0; j < open.length; j++) { r -= open.length - j; if (r <= 0) { id = open[j]; break; } }
      lv[id] = (lv[id] || 0) + 1;
      ups.push({ t, id });
    }
    return ups;
  }

  /** 튜토리얼용 에코 10명. 오래된 것 → 최근 순. 판이 끝날 때(연장전 포함)까지 함께한다. */
  function makeTutorialEchoes(seed) {
    const rng = mulberry32((seed >>> 0) || 1);
    const ticks = RUN_TICKS + OVERTIME_TICKS + 10 * TICK;
    const list = [];
    for (let i = 0; i < TUTORIAL_ECHOES; i++) {
      list.push({ path: makePath(rng, i, ticks), ups: makeUps(rng, i), kills: 0, ticks, tutorial: true });
    }
    return list;
  }

  /** 튜토리얼 중 시간에 맞춰 보여줄 안내 (초 → 문구) */
  const TIPS = [   // 학교 월드 실제 일정에 맞춤 (144초 판 · 선생님 24초 · 낙하물 26초 · 곤란한 사람 36초 · 친구 68초 · 왕 108초)
    { sec: 1,  text: '👆 화면을 드래그해서 움직여요 · 공격은 자동!' },
    { sec: 10,  text: '✨ 회색 동료 = 에코(과거의 나, 내 편) · 🔴 빨간 원 = 방해 요소' },
    { sec: 18,  text: '💎 구슬을 모아 레벨업하면 아래에 아이템 카드 3장 · 톡 눌러 골라요 (3초 지나면 자동)' },
    { sec: 24, text: '🙋 선생님의 노란 원 안에 머물면 조언 카드! 원 안에선 날아오는 탄도 막아 줘요 (부딪히는 건 아파요)' },
    { sec: 40, text: '❗ 곤란한 사람 주변의 방해 요소를 물리치면 선물 카드 + 고마운 응원(잠깐 공격력 UP)' },
    { sec: 52, text: '💛 쓰레기·화분·인형 위를 지나가면 작은 선행! 4개 모으면 선물 카드' },
    { sec: 68, text: '🤝 노란 원의 친구 곁에 있어 주면 깃발까지 걸어가요 · 끝까지 지키면 선물 2개' },
    { sec: 84, text: '👻 진짜 게임에선 한 판이 끝날 때마다 그 판의 내가 에코가 되어 1명씩 늘어요' },
    { sec: 98, text: '😱 곧 큰 도전(왕)! 왕은 에코가 충분히 모여야 넘을 수 있어요' },
    { sec: 124, text: '🎓 판이 끝나면 학점을 받아요 · 상점에서 강화와 장비를 살 수 있어요' },
  ];

  const api = { makeTutorialEchoes, TIPS, TUTORIAL_ECHOES, TUTORIAL_WORLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
