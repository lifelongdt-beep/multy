/* 퇴근 에코 — 월드 데이터 (순수 데이터, DOM/시뮬레이션 의존 없음)
 *
 * 디자인 원칙 (가치):
 *   - 적은 사람이 아니라 마음속/환경의 "방해 요소"다: 미루기, 걱정, 졸음, 산만함, 피로, 알림 …
 *   - 숙제·시험·업무는 나쁜 것이 아니라 배움과 성장의 일부다. 적으로 만들지 않는다.
 *     (괴롭히는 건 "숙제"가 아니라 "미루는 마음", "시험"이 아니라 "시험 불안")
 *   - 선생님·선배·역무원 같은 사람은 적이 아니라 "도와주는 존재"(helper)로 등장한다.
 *     플레이어가 먼저 곁으로 가서 도움을 청하면 조언 카드를 받는다. (도움을 구하는 건 좋은 일!)
 *   - 보스는 사람도, 숙제/시험 자체도 아닌 "극복해야 할 큰 장애물"(시험 불안, 슬럼프, 번아웃, 급행열차)이다.
 *     이기는 것이 아니라 "극복"한다.
 *
 * 월드마다 다른 것: 배경(theme) · 적 · 웨이브 · 포위 이벤트 · 도우미(helper) · 보스(boss+패턴) · 고유 규칙(rules)
 * 보스의 타입 id는 항상 'boss' (월드별로 정의만 다름)
 * boss.times: 보스 등장 시각(초) 목록 = 한 판에서 극복할 큰 도전의 횟수 (월드가 높을수록 많음)
 * boss.fightSec: 한 보스를 상대하는 목표 시간(초). 보스 체력은 이 시간에 맞춰 플레이어+에코의 화력에서 계산된다 (아슬아슬한 승부)
 *
 * enemies 필드: hp, speed, r(반지름), dmg(접촉 피해), xp, ai
 *   ai: chase | zig(지그재그) | dash(돌진) | shoot(원거리) | boss
 *   shoot: fireCd, volley(한 번에 발사 수), spread(부채 각도), bspeed(탄속), bdmg(탄 피해)
 *   dash : dashCd      onDeath: {type, n} 죽을 때 분열
 * helper 필드: name, emoji, t(등장 초), 문구들, boons(조언 카드 이름 heal/power/focus/team)
 */
(function (root) {
  'use strict';

  const WORLDS = {
    /* ================= 1. 학교 ================= */
    school: {
      id: 'school', name: '학교', emoji: '🏫', coinMul: 1.0,
      desc: '기본 월드. 기말고사 날, 미루는 마음과 걱정이 몰려옵니다. "시험 불안"을 극복해 보세요. 담임 선생님이 응원하러 와 주십니다.',
      ruleText: '특별한 규칙 없음 · 숙제는 미리미리! · 담임 선생님께 도움을 청할 수 있어요',
      theme: { bg: '#161a2e', grid: 'rgba(255,255,255,.04)', deco: 'none' },
      rules: { hpMul: 1.0, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.0 },
      enemies: {
        hw:     { name: '미루기',   emoji: '🐌', hp: 3,  speed: 0.7,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        test:   { name: '걱정',     emoji: '😰', hp: 2,  speed: 1.1,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        alarm:  { name: '딴생각',   emoji: '💭', hp: 14, speed: 0.5,  r: 14, dmg: 10, xp: 4, ai: 'chase' },
        late:   { name: '지각',     emoji: '⏰', hp: 4,  speed: 0.6,  r: 8,  dmg: 7,  xp: 2, ai: 'dash',  dashCd: 110 },
        chalk:  { name: '졸음',     emoji: '😴', hp: 5,  speed: 0.6,  r: 8,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 110 },
        group:  { name: '게으름',   emoji: '🦥', hp: 10, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'hw', n: 2 } },
      },
      helper: {
        name: '담임 선생님', emoji: '👩‍🏫', t: 45,
        arriveText: '👩‍🏫 담임 선생님이 도와주러 오셨어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선생님께 도움을 받았어요',
        leaveText: '선생님은 언제나 기다리고 계세요',
        boons: { heal: '따뜻한 격려', power: '오답 노트 정리', focus: '집중하는 법', team: '친구와 함께' },
      },
      boss: { name: '시험 불안', emoji: '😱', hp: 750, times: [90], fightSec: 40, speed: 0.4, r: 30, dmg: 12, xp: 30, ai: 'boss', pattern: 'exam', warnText: '⚠ 기말고사 D-DAY, 불안이 밀려와요 ⚠', startText: '😱 시험 불안, 극복해 봐요!', summon: 'hw' },
      waves: [
        { from: 0,  to: 20,  interval: 52, n: 1, w: { hw: 6, test: 3 } },
        { from: 20, to: 45,  interval: 40, n: 2, w: { hw: 5, test: 4, alarm: 1, late: 2 } },
        { from: 45, to: 75,  interval: 30, n: 2, w: { hw: 4, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
        { from: 75, to: 121, interval: 22, n: 3, w: { hw: 3, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'test', n: 10, text: '걱정이 몰려와요!' },
        { t: 62,  type: 'late', n: 8,  text: '지각 러시!' },
        { t: 100, type: 'hw',   n: 16, text: '미루기 폭탄!' },
      ],
    },

    /* ================= 2. 학원 ================= */
    academy: {
      id: 'academy', name: '학원', emoji: '📖', coinMul: 1.3,
      desc: '학교가 끝나도 공부는 계속된다. 마음의 방해가 원거리로 날아오는 대신 경험치가 쑥쑥 오릅니다. 학원 선생님이 코칭해 주세요.',
      ruleText: '빡센 진도: 경험치 +30% · 방해 요소가 더 단단하고 많이 나옴 · 원거리 적 多',
      unlock: { world: 'school' },
      theme: { bg: '#1d1530', grid: 'rgba(190,140,255,.07)', deco: 'ruled' },
      rules: { hpMul: 1.1, xpMul: 1.3, speedMul: 1.0, spawnMul: 1.1 },
      enemies: {
        book:  { name: '조급함',            emoji: '😖', hp: 4,  speed: 0.75, r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        quiz:  { name: '불안',              emoji: '😟', hp: 3,  speed: 1.2,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        memo:  { name: '잡념',              emoji: '🌀', hp: 6,  speed: 0.55, r: 9,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 150, volley: 3, spread: 0.28, bspeed: 1.9, bdmg: 4 },
        bus:   { name: '미루고 싶은 마음',  emoji: '🛋️', hp: 10, speed: 0.55, r: 13, dmg: 10, xp: 3, ai: 'dash', dashCd: 140 },
        ox:    { name: '포기 충동',         emoji: '🏳️', hp: 9,  speed: 0.6,  r: 11, dmg: 7,  xp: 3, ai: 'chase', onDeath: { type: 'quiz', n: 2 } },
      },
      helper: {
        name: '학원 선생님', emoji: '🧑‍🏫', t: 45,
        arriveText: '🧑‍🏫 학원 선생님이 코칭하러 오셨어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선생님의 코칭을 받았어요',
        leaveText: '질문은 언제든 환영이에요',
        boons: { heal: '마음 다독이기', power: '개념 완성', focus: '시간 관리법', team: '스터디 그룹' },
      },
      boss:  { name: '슬럼프', emoji: '🌧️', hp: 850, times: [70, 105], fightSec: 34, speed: 0.35, r: 30, dmg: 12, xp: 34, ai: 'boss', pattern: 'spiral', warnText: '⚠ 슬럼프가 찾아와요 ⚠', startText: '🌧️ 슬럼프, 함께 이겨내요!', summon: 'memo' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { book: 6, quiz: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { book: 5, quiz: 4, memo: 2, ox: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { book: 4, quiz: 3, memo: 3, bus: 2, ox: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { book: 3, quiz: 3, memo: 3, bus: 2, ox: 2 } },
      ],
      swarms: [
        { t: 28,  type: 'quiz', n: 12, text: '불안이 폭주해요!' },
        { t: 60,  type: 'bus',  n: 6,  text: '미루고 싶은 마음 러시!' },
        { t: 98,  type: 'book', n: 18, text: '조급함 산사태!' },
      ],
    },

    /* ================= 3. 회사 ================= */
    office: {
      id: 'office', name: '회사', emoji: '🏢', coinMul: 1.6,
      desc: '야근의 연속. 방해 요소를 잡으면 가끔 커피가 떨어져 힘이 납니다. 멘토 선배가 조언해 줍니다.',
      ruleText: '야근 커피: 방해 요소를 잡으면 가끔 ☕ 떨어짐(체력 +15) · 일이 몰려 방해가 많이 나옴 · 방해 요소가 더 단단함',
      unlock: { world: 'academy' },
      theme: { bg: '#172229', grid: 'rgba(140,200,220,.07)', deco: 'tiles' },
      rules: { hpMul: 1.2, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.25, coffeeChance: 0.03 },
      enemies: {
        doc:     { name: '스트레스',      emoji: '😫', hp: 4,  speed: 0.8,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        mail:    { name: '압박감',        emoji: '💢', hp: 2,  speed: 1.25, r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        call:    { name: '산만함',        emoji: '🔔', hp: 6,  speed: 0.6,  r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        printer: { name: '고장난 프린터', emoji: '🖨️', hp: 14, speed: 0.4, r: 12, dmg: 6, xp: 3, ai: 'shoot', fireCd: 130, volley: 3, spread: 0.3, bspeed: 1.8, bdmg: 4 },
        meeting: { name: '끝없는 걱정',   emoji: '🌫️', hp: 12, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'mail', n: 2 } },
      },
      helper: {
        name: '멘토 선배', emoji: '🧑‍💼', t: 45,
        arriveText: '🧑‍💼 멘토 선배가 조언해 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선배의 조언을 받았어요',
        leaveText: '궁금한 건 언제든 물어보세요',
        boons: { heal: '숨 돌리기', power: '업무 노하우', focus: '우선순위 정리', team: '동료와 협업' },
      },
      boss:  { name: '번아웃', emoji: '🥵', hp: 1000, times: [60, 90, 120], fightSec: 33, speed: 0.35, r: 30, dmg: 14, xp: 38, ai: 'boss', pattern: 'charge', warnText: '⚠ 번아웃이 다가와요 ⚠', startText: '🥵 번아웃, 쉬어가며 극복해요!', summon: 'mail' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { doc: 6, mail: 4 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { doc: 5, mail: 4, call: 2, meeting: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { doc: 4, mail: 3, call: 2, printer: 2, meeting: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { doc: 3, mail: 3, call: 2, printer: 2, meeting: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'mail', n: 14, text: '압박감이 몰려와요!' },
        { t: 62,  type: 'call', n: 8,  text: '산만함 폭탄!' },
        { t: 100, type: 'doc',  n: 18, text: '스트레스 대란!' },
      ],
    },

    /* ================= 4. 지하철 ================= */
    subway: {
      id: 'subway', name: '지하철', emoji: '🚇', coinMul: 2.0,
      desc: '퇴근길 만원 지하철. 달려오는 열차를 피하세요! 친절한 역무원이 길을 안내해 줍니다.',
      ruleText: '열차 습격: 경고 줄이 뜬 뒤 열차가 가로질러 지나감 (나에게 큰 피해, 방해 요소는 즉사)',
      unlock: { world: 'office' },
      theme: { bg: '#10201f', grid: 'rgba(255,255,255,.03)', deco: 'rails' },
      rules: { hpMul: 1.3, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.05, coffeeChance: 0.04, trains: { first: 20, every: 30 } },
      enemies: {
        sleepy:  { name: '졸음',          emoji: '😪', hp: 5,  speed: 0.9,  r: 9,  dmg: 6,  xp: 1, ai: 'zig' },
        bag:     { name: '무거운 가방',   emoji: '🎒', hp: 9,  speed: 0.6,  r: 11, dmg: 8,  xp: 2, ai: 'chase' },
        ad:      { name: '시끄러운 방송', emoji: '📢', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 150, volley: 5, spread: 0.32, bspeed: 1.7, bdmg: 4 },
        phone:   { name: '스마트폰 알림', emoji: '📱', hp: 5,  speed: 0.7,  r: 8,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        fatigue: { name: '쌓인 피로',     emoji: '🥱', hp: 14, speed: 0.5,  r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'sleepy', n: 3 } },
      },
      helper: {
        name: '친절한 역무원', emoji: '🙋', t: 45,
        arriveText: '🙋 역무원이 도와주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 역무원의 안내를 받았어요',
        leaveText: '도움이 필요하면 언제든 말씀하세요',
        boons: { heal: '잠깐 쉬어가기', power: '빠른 환승 길', focus: '졸음 깨우기', team: '함께 가는 길' },
      },
      boss:  { name: '급행열차', emoji: '🚆', hp: 950, times: [55, 85, 115, 145], fightSec: 30, speed: 0.35, r: 30, dmg: 14, xp: 42, ai: 'boss', pattern: 'lane', warnText: '⚠ 급행열차가 들어와요 ⚠', startText: '🚆 급행열차를 피해 집으로!', summon: 'sleepy' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { sleepy: 7, bag: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { sleepy: 5, bag: 3, phone: 2, ad: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { sleepy: 4, bag: 3, phone: 2, ad: 2, fatigue: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { sleepy: 3, bag: 3, phone: 2, ad: 2, fatigue: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'sleepy', n: 16, text: '졸음이 쏟아져요!' },
        { t: 62,  type: 'phone',  n: 8,  text: '알림 폭탄!' },
        { t: 100, type: 'bag',    n: 14, text: '짐이 한가득!' },
      ],
    },
  };

  const ORDER = ['school', 'academy', 'office', 'subway'];

  /** 도우미가 주는 조언 카드 (공통 효과, 이름만 월드별) */
  const BOONS = {
    heal:  { icon: '💛', desc: '체력을 모두 회복' },
    power: { icon: '📒', desc: '공격력 Lv +1' },
    focus: { icon: '⏳', desc: '발사 속도 Lv +1' },
    team:  { icon: '🤝', desc: '에코 응원 Lv +1' },
  };

  const api = { WORLDS, ORDER, BOONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoWorlds = api;
})(typeof window !== 'undefined' ? window : globalThis);
