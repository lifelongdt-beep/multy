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
    const ticks = RUN_TICKS + (EXTRA_SEC + 10) * TICK + OVERTIME_TICKS;
    const list = [];
    for (let i = 0; i < TUTORIAL_ECHOES; i++) {
      list.push({ path: makePath(rng, i, ticks), ups: makeUps(rng, i), kills: 0, ticks, tutorial: true });
    }
    return list;
  }

  /** 튜토리얼 판은 보통 판보다 이만큼(초) 길다: 왕과 위험 요소가 뒤로 밀려 하나씩 천천히 배운다 */
  const EXTRA_SEC = 36;

  /** 시간에 맞춰 보여줄 안내 (일반 설명만). 화면에 무언가 나타나는 설명은 아래 EVENT_TIPS로, 실제로 나타날 때 띄운다. ' · ' 에서 줄이 나뉜다 */
  const TIPS = [
    { sec: 1,   target: 'player', text: '👆 화면을 드래그해서 움직여요 · 공격은 자동! · 아래 빈 곳에서 드래그하면 손가락이 안 가려요' },
    { sec: 6,   target: 'hp', text: '❤️ 왼쪽 위 빨간 막대 = 내 에너지 · 방해 요소에 부딪히거나 탄에 맞으면 줄어요' },
    { sec: 11,  target: 'echo', text: '✨ 반투명한 회색 동료 = 에코(과거의 나, 내 편) · 나처럼 자동으로 싸워 줘요 · 🔴 빨간 원 = 방해 요소' },
    { sec: 17,  target: 'xp', text: '💎 방해 요소를 물리치면 초록 구슬이 나와요 · 모으면 위쪽 초록 막대가 차고 레벨업!' },
    { sec: 116, target: 'echoCount', text: '✨ 진짜 게임에선 한 판이 끝날 때마다 · 그 판의 내가 에코가 되어 1명씩 늘어요' },
  ];
  /** 상황 안내가 가리키는 곳 (화면에서 실제로 그 자리를 반짝이는 고리 + 화살표로 표시). 없으면 표시 안 함 */
  const EVENT_TARGET = {
    cards: 'cards', helped: 'cards', item: 'items', synergy: 'items',
    drop: 'drop', shot: 'shot', helper: 'helper', shield: 'helper',
    rescueStart: 'rescue', rescued: 'player', escortDone: 'player',
    spotSeen: 'spot', spot: 'gauge', gaugeFull: 'gauge',
    escortStart: 'escort', friendHurt: 'escort', boss: 'boss',
  };
  const targetOf = (key) => EVENT_TARGET[key] || (String(key).startsWith('up:') ? 'items' : null);
  /** 왕이 나오기 이만큼(초) 전에 왕 안내, 왕이 나오고 이만큼 뒤에 마무리 안내 */
  const BOSS_SOON = 10, END_AFTER = 18;
  const BOSS_TIP = '😱 곧 큰 도전(왕)! · 왕은 에코가 충분히 모여야 넘을 수 있어요 · 왕의 공격은 계속 움직이며 피해요';
  const END_TIPS = [
    '🎓 판이 끝나면 학점을 받아요 · 상점 강화·장비, 캐릭터, 에코 모습을 살 수 있어요',
    '💛 선행을 할수록 선행 점수가 쌓여요 · 칭호가 오르고 새 캐릭터가 열려요',
  ];

  /** 그 일이 실제로 처음 생겼을 때 한 번 보여 주는 안내: 무엇인지 + 왜 하는지 + 하면 무엇을 받는지 (설명과 화면이 어긋나지 않게) */
  const EVENT_TIPS = {
    cards:   '🃏 카드가 떴어요! · 아래 3장 중 하나를 톡 눌러 골라요 · 고민하면 3초 뒤 자동으로 골라져요',
    item:    '🎒 고른 아이템은 화면 위 왼쪽에 쌓여요 · 같은 아이템을 또 고르면 최대 5단계까지 더 세져요',
    'up:rate':   '✏️ 샤프 속도: 총알이 더 빨리 나가요 (단계마다 발사 간격 -20%)',
    'up:multi':  '📕 책 +1: 한 번에 쏘는 총알이 1개씩 늘어요 · 여러 적을 한꺼번에 맞혀요',
    'up:dmg':    '📝 필기 강화: 총알 하나하나가 더 아파요 (단계마다 공격력 +50%) · 강해질수록 총알 모양도 바뀌어요',
    'up:speed':  '👟 운동화: 더 빨리 움직여요 · 떨어지거나 지나가는 위험을 피하기 쉬워져요',
    'up:magnet': '🧲 자석 필통: 멀리 있는 구슬도 끌려와요 · 레벨업이 빨라져요',
    'up:pierce': '📍 관통 샤프심: 총알이 적을 뚫고 지나가 · 뒤에 있는 적도 맞혀요',
    'up:crit':   '💯 시험 만점: 가끔 2.5배로 세게 맞혀요 (단계마다 확률 +14%)',
    'up:nova':   '🔔 종소리: 몇 초마다 내 주변으로 충격파가 퍼져 · 가까운 적을 한꺼번에 때려요',
    'up:orbit':  '🖍️ 형광펜: 몸 주위를 도는 형광펜이 닿는 적을 때려요 · 모을수록 개수·힘·도는 거리가 늘어요',
    'up:regen':  '🍱 급식 시간: 가만히 있어도 체력이 조금씩 차올라요',
    'up:echo':   '✨ 에코 응원: 에코들의 공격력과 속도가 함께 올라요 · 에코가 많을수록 효과가 커요',
    'up:heal':   '🩹 보건실: 체력을 바로 35 회복해요 (쌓이지 않는 즉시 회복)',
    synergy:     '✨ 시너지! · 정해진 아이템 두 가지를 함께 모으면 추가 효과가 생겨요',
    drop:        '⚠️ 바닥에 빨간 원이 생기면 곧 짜증 폭탄이 떨어져요 · 원이 좁아지기 전에 밖으로 피하세요!',
    shot:        '🔴 방해 요소가 탄을 쏴요 · 피하거나, 선생님이 계시면 노란 원 안으로!',
    helper:      '🙋 선생님이 오셨어요 · 노란 원 안에 잠시 머물면 조언을 들어요 · 보상: 조언 카드 (회복, 공격력 등)',
    shield:      '🛡️ 선생님 원 안에선 날아오는 탄을 막아 줘요 · 하지만 방해 요소와 몸으로 부딪히면 아파요!',
    helped:      '🙌 조언을 들었어요! · 카드 3장 중 하나를 골라요',
    rescueStart: '❗ 방해 요소에 둘러싸여 곤란한 사람이 있어요 · 다가가서 주변 방해 요소를 물리쳐 주세요 · 발밑 고리가 다 줄면 떠나요',
    rescued:     '💛 도와줬어요! · 보상 ① 선물 카드 3장 · 보상 ② 응원 배지: 머리 위에 있는 동안 공격력 +20% (깜빡이면 곧 끝) · 주변 방해 요소도 잠시 순해져요',
    spotSeen:    '🥤 반짝이는 쓰레기·화분·인형이 떨어져 있어요 · 지나가며 주우면 학교가 깨끗해져요 (작은 선행)',
    spot:        '💛 작은 선행 +1! (오른쪽 위 하트 숫자) · 4개를 모으면 선물 카드!',
    gaugeFull:   '🎁 작은 선행 4개! · 선물 카드 3장 중 하나를 골라요',
    escortStart: '🤝 친구가 노란 깃발까지 가고 싶어 해요 · 곁에 있으면 함께 걷고, 멀어지면 기다려요 · 방해 요소로부터 친구를 지켜 주세요',
    friendHurt:  '💥 친구가 다쳤어요! · 친구 곁의 방해 요소를 먼저 물리쳐요',
    escortDone:  '🏁 무사히 도착! · 보상: 아이템 1개 바로 + 선물 카드 + 응원',
    boss:        '👑 왕 등장! · 에코와 함께 힘을 모아 공격해요 · 몸으로 부딪히지 않게 조심!',
  };
  /** 안내를 보여 줄 시간(밀리초): 글이 길수록 오래 멈추고 오래 보여 준다. 긴 글은 3초 넘게 보임 */
  function tipTiming(text) {
    const n = [...String(text)].length;
    const freeze = Math.round(Math.min(2500, Math.max(1000, n * 45)));
    return { freeze, show: freeze + 1800 };
  }

  const api = { makeTutorialEchoes, TIPS, EVENT_TIPS, EVENT_TARGET, targetOf, BOSS_SOON, BOSS_TIP, END_AFTER, END_TIPS, EXTRA_SEC, tipTiming, TUTORIAL_ECHOES, TUTORIAL_WORLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoTutorial = api;
})(typeof window !== 'undefined' ? window : globalThis);
