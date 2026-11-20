/* 퇴근 에코 — 월드 데이터 (순수 데이터, DOM/시뮬레이션 의존 없음)
 *
 * 월드마다 다른 것: 배경(theme) · 적 · 웨이브 · 포위 이벤트 · 중간 보스(elite) · 보스(boss+패턴) · 고유 규칙(rules)
 * 공통 규칙: 중간 보스의 타입 id는 항상 'teacher', 보스는 항상 'boss' (월드별로 정의만 다름)
 *
 * enemies 필드: hp, speed, r(반지름), dmg(접촉 피해), xp, ai
 *   ai: chase | zig(지그재그) | dash(돌진) | shoot(원거리) | elite(부채꼴) | boss
 *   shoot: fireCd, volley(한 번에 발사 수), spread(부채 각도), bspeed(탄속), bdmg(탄 피해)
 *   dash : dashCd      onDeath: {type, n} 죽을 때 분열
 */
(function (root) {
  'use strict';

  const WORLDS = {
    /* ================= 1. 학교 ================= */
    school: {
      id: 'school', name: '학교', emoji: '🏫', coinMul: 1.0,
      desc: '기본 월드. 숙제와 시험을 헤치고 "기말고사"를 격파하세요.',
      ruleText: '특별한 규칙 없음',
      theme: { bg: '#161a2e', grid: 'rgba(255,255,255,.04)', deco: 'none' },
      rules: { hpMul: 1.0, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.0 },
      enemies: {
        hw:     { name: '숙제',     emoji: '📄', hp: 3,  speed: 0.7,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        test:   { name: '쪽지시험', emoji: '📝', hp: 2,  speed: 1.1,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        alarm:  { name: '학원알림', emoji: '🔔', hp: 14, speed: 0.5,  r: 14, dmg: 10, xp: 4, ai: 'chase' },
        late:   { name: '지각',     emoji: '⏰', hp: 4,  speed: 0.6,  r: 8,  dmg: 7,  xp: 2, ai: 'dash',  dashCd: 110 },
        chalk:  { name: '분필',     emoji: '🖍️', hp: 5,  speed: 0.6,  r: 8,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 110 },
        group:  { name: '조별과제', emoji: '👥', hp: 10, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'hw', n: 2 } },
      },
      elite: { name: '담임', emoji: '👨‍🏫', hp: 120, speed: 0.5, r: 20, dmg: 14, xp: 14, ai: 'elite', fireCd: 150, t: 45, text: '⚠ 담임 선생님 등장' },
      boss:  { name: '기말고사', emoji: '📚', hp: 750, speed: 0.4, r: 30, dmg: 12, xp: 30, ai: 'boss', pattern: 'exam', warnText: '⚠ 기말고사 접근 중 ⚠', startText: '📚 기말고사 시작!', summon: 'hw' },
      waves: [
        { from: 0,  to: 20,  interval: 52, n: 1, w: { hw: 6, test: 3 } },
        { from: 20, to: 45,  interval: 40, n: 2, w: { hw: 5, test: 4, alarm: 1, late: 2 } },
        { from: 45, to: 75,  interval: 30, n: 2, w: { hw: 4, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
        { from: 75, to: 121, interval: 22, n: 3, w: { hw: 3, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'test', n: 10, text: '쪽지시험 포위!' },
        { t: 62,  type: 'late', n: 8,  text: '지각 러시!' },
        { t: 100, type: 'hw',   n: 16, text: '숙제 폭탄!' },
      ],
    },

    /* ================= 2. 학원 ================= */
    academy: {
      id: 'academy', name: '학원', emoji: '📖', coinMul: 1.3,
      desc: '학교가 끝나도 끝나지 않는다. 원거리 공격이 많은 대신 경험치가 쑥쑥 오릅니다.',
      ruleText: '빡센 진도: 경험치 +30% · 적이 더 단단하고 많이 나옴 · 원거리 적 多',
      unlock: { world: 'school' },
      theme: { bg: '#1d1530', grid: 'rgba(190,140,255,.07)', deco: 'ruled' },
      rules: { hpMul: 1.1, xpMul: 1.3, speedMul: 1.0, spawnMul: 1.1 },
      enemies: {
        book:  { name: '문제집',     emoji: '📘', hp: 4,  speed: 0.75, r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        quiz:  { name: '모의고사',   emoji: '🧾', hp: 3,  speed: 1.2,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        memo:  { name: '암기카드',   emoji: '📌', hp: 6,  speed: 0.55, r: 9,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 150, volley: 3, spread: 0.28, bspeed: 1.9, bdmg: 4 },
        bus:   { name: '학원버스',   emoji: '🚌', hp: 10, speed: 0.55, r: 13, dmg: 10, xp: 3, ai: 'dash', dashCd: 140 },
        ox:    { name: 'OX퀴즈',     emoji: '⭕', hp: 9,  speed: 0.6,  r: 11, dmg: 7,  xp: 3, ai: 'chase', onDeath: { type: 'quiz', n: 2 } },
      },
      elite: { name: '일타강사', emoji: '🧑‍🏫', hp: 150, speed: 0.5, r: 20, dmg: 14, xp: 16, ai: 'elite', fireCd: 140, t: 45, text: '⚠ 일타강사 등장' },
      boss:  { name: '수능', emoji: '📖', hp: 850, speed: 0.35, r: 30, dmg: 12, xp: 34, ai: 'boss', pattern: 'spiral', warnText: '⚠ 수능 D-DAY 접근 중 ⚠', startText: '📖 수능 시작!', summon: 'memo' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { book: 6, quiz: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { book: 5, quiz: 4, memo: 2, ox: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { book: 4, quiz: 3, memo: 3, bus: 2, ox: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { book: 3, quiz: 3, memo: 3, bus: 2, ox: 2 } },
      ],
      swarms: [
        { t: 28,  type: 'quiz', n: 12, text: '모의고사 폭주!' },
        { t: 60,  type: 'bus',  n: 6,  text: '학원버스 대이동!' },
        { t: 98,  type: 'book', n: 18, text: '문제집 산사태!' },
      ],
    },

    /* ================= 3. 회사 ================= */
    office: {
      id: 'office', name: '회사', emoji: '🏢', coinMul: 1.6,
      desc: '야근의 연속. 적이 쓰러지면 가끔 커피가 떨어져 체력을 회복합니다.',
      ruleText: '야근 커피: 적을 잡으면 가끔 ☕ 떨어짐(체력 +15) · 적이 더 단단함',
      unlock: { world: 'academy' },
      theme: { bg: '#172229', grid: 'rgba(140,200,220,.07)', deco: 'tiles' },
      rules: { hpMul: 1.2, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.1, coffeeChance: 0.05 },
      enemies: {
        doc:     { name: '결재서류', emoji: '📋', hp: 4,  speed: 0.8,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        mail:    { name: '메일',     emoji: '📧', hp: 2,  speed: 1.25, r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        call:    { name: '급한 전화', emoji: '☎️', hp: 6,  speed: 0.6,  r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        printer: { name: '고장난 프린터', emoji: '🖨️', hp: 14, speed: 0.4, r: 12, dmg: 6, xp: 3, ai: 'shoot', fireCd: 130, volley: 3, spread: 0.3, bspeed: 1.8, bdmg: 4 },
        meeting: { name: '회의',     emoji: '🧑‍💼', hp: 12, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'mail', n: 2 } },
      },
      elite: { name: '팀장', emoji: '👔', hp: 170, speed: 0.5, r: 20, dmg: 14, xp: 18, ai: 'elite', fireCd: 140, t: 45, text: '⚠ 팀장님 호출' },
      boss:  { name: '인사평가', emoji: '📊', hp: 900, speed: 0.35, r: 30, dmg: 14, xp: 38, ai: 'boss', pattern: 'charge', warnText: '⚠ 인사평가 시즌 ⚠', startText: '📊 인사평가 시작!', summon: 'mail' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { doc: 6, mail: 4 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { doc: 5, mail: 4, call: 2, meeting: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { doc: 4, mail: 3, call: 2, printer: 2, meeting: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { doc: 3, mail: 3, call: 2, printer: 2, meeting: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'mail', n: 14, text: '메일 폭주!' },
        { t: 62,  type: 'call', n: 8,  text: '전화 폭탄!' },
        { t: 100, type: 'doc',  n: 18, text: '결재 대란!' },
      ],
    },

    /* ================= 4. 지하철 ================= */
    subway: {
      id: 'subway', name: '지하철', emoji: '🚇', coinMul: 2.0,
      desc: '퇴근길 만원 지하철. 달리는 열차가 적도 나도 쓸어버립니다!',
      ruleText: '열차 습격: 경고 선이 뜬 뒤 열차가 가로질러 지나감 (나에게 큰 피해, 적은 즉사)',
      unlock: { world: 'office' },
      theme: { bg: '#10201f', grid: 'rgba(255,255,255,.03)', deco: 'rails' },
      rules: { hpMul: 1.3, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.05, coffeeChance: 0.04, trains: { first: 20, every: 30 } },
      enemies: {
        commuter: { name: '출근길 승객', emoji: '🚶', hp: 5,  speed: 0.9,  r: 9,  dmg: 6,  xp: 1, ai: 'zig' },
        bag:      { name: '큰 배낭',     emoji: '🎒', hp: 9,  speed: 0.6,  r: 11, dmg: 8,  xp: 2, ai: 'chase' },
        ad:       { name: '광고방송',    emoji: '📢', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 150, volley: 5, spread: 0.32, bspeed: 1.7, bdmg: 4 },
        thief:    { name: '소매치기',    emoji: '🥷', hp: 5,  speed: 0.7,  r: 8,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        crowd:    { name: '만원 승객',   emoji: '🧍', hp: 14, speed: 0.5,  r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'commuter', n: 3 } },
      },
      elite: { name: '승무원', emoji: '🧑‍✈️', hp: 190, speed: 0.5, r: 20, dmg: 14, xp: 20, ai: 'elite', fireCd: 140, t: 45, text: '⚠ 승무원 순찰' },
      boss:  { name: '급행열차', emoji: '🚆', hp: 950, speed: 0.35, r: 30, dmg: 14, xp: 42, ai: 'boss', pattern: 'lane', warnText: '⚠ 급행열차 진입 ⚠', startText: '🚆 급행열차 출발!', summon: 'commuter' },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { commuter: 7, bag: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { commuter: 5, bag: 3, thief: 2, ad: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { commuter: 4, bag: 3, thief: 2, ad: 2, crowd: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { commuter: 3, bag: 3, thief: 2, ad: 2, crowd: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'commuter', n: 16, text: '출근 러시!' },
        { t: 62,  type: 'thief',    n: 8,  text: '소매치기 떼!' },
        { t: 100, type: 'bag',      n: 14, text: '만원 지하철!' },
      ],
    },
  };

  const ORDER = ['school', 'academy', 'office', 'subway'];

  const api = { WORLDS, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoWorlds = api;
})(typeof window !== 'undefined' ? window : globalThis);
