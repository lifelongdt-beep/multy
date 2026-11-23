/* Echo Rush — 월드 데이터 (순수 데이터, DOM/시뮬레이션 의존 없음)
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
 * boss.needEchoes: "겨우 이길 수 있는" 에코 수. 보스 체력은 (나 + 에코 needEchoes명)의 기준 화력으로 정해지고 에코의 화력은 반영되지 않으므로,
 *   에코가 이보다 적으면 사실상 못 잡고 이 수만큼 있으면 아슬아슬하게, 더 많으면 여유 있게 잡는다. (정원 10명 이하)
 * boss.refMul: 기준 화력 배율 = 그 월드에서 보스가 나올 때 "평균적인 내" 화력 / 40 (실측: 학원은 경험치 +30%라 높고, 보스가 일찍 나오는 회사·지하철은 낮음)
 * boss.fightSec: 필요 에코 수가 갖춰졌을 때 한 보스를 상대하는 목표 시간(초)
 * boss.minis: (선택) 마지막 월드 보스 전에 차례로 나오는 이 월드만의 다른 큰 도전들 (모습·패턴·문구만 다르고 체력·피해는 이 월드 기준)
 * boss.lineup: (선택) 마지막 보스 전에 차례로 나올 다른 월드의 보스 id 목록. 2회차부터는 모든 월드의 보스 중 무작위로 나온다(sim.js)
 *
 * enemies 필드: hp, speed, r(반지름), dmg(접촉 피해), xp, ai
 *   ai: chase | zig(지그재그) | dash(돌진) | shoot(원거리) | boss
 *   shoot: fireCd, volley(한 번에 발사 수), spread(부채 각도), bspeed(탄속), bdmg(탄 피해)
 *   dash : dashCd      onDeath: {type, n} 죽을 때 분열
 * helper 필드: name, emoji, t(등장 초), 문구들, boons(조언 카드 이름 heal/power/focus/team)
 * gear: 이 월드의 매점 장비 이름 {atk:{icon,name}, def:{icon,name}} (효과는 아래 GEAR 공통)
 * rules 추가 규칙: atkMul(받는 피해 배율, 첫 월드를 쉽게) · rageMul(보스 격앙 피해 증가 배율) · sight(자동 조준 거리, 기본 260) · wind{amp,period}(좌우 바람) · dropEmoji(회복 아이템 모양) · trains{first,every,emoji,text}
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
      // 첫 월드는 쉽게: 방해 요소가 덜 아프고(atkMul), 조금 덜 단단하고, 덜 몰려온다. 큰 도전도 에코 2명이면 넘을 수 있게
      rules: { hpMul: 0.85, xpMul: 1.0, speedMul: 0.95, spawnMul: 0.85, atkMul: 0.6, rageMul: 0.8, drops: { first: 22, every: 18, n: 1, emoji: '🏀', text: '🏀 빨간 원이 생기면 곧 공이 떨어져요! 원 밖으로 피하세요' } },
      enemies: {
        hw:     { name: '미루기',   emoji: '🐌', hp: 3,  speed: 0.7,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        test:   { name: '걱정',     emoji: '😰', hp: 2,  speed: 1.1,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        alarm:  { name: '딴생각',   emoji: '💭', hp: 14, speed: 0.5,  r: 14, dmg: 10, xp: 4, ai: 'chase' },
        late:   { name: '지각',     emoji: '⏰', hp: 4,  speed: 0.6,  r: 8,  dmg: 7,  xp: 2, ai: 'dash',  dashCd: 110 },
        chalk:  { name: '졸음',     emoji: '😴', hp: 5,  speed: 0.6,  r: 8,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 110 },
        group:  { name: '게으름',   emoji: '🦥', hp: 10, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'hw', n: 2 } },
      },
      helper: {
        name: '담임 선생님', emoji: '👩‍🏫', t: 20,
        arriveText: '👩‍🏫 담임 선생님이 도와주러 오셨어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선생님께 도움을 받았어요',
        leaveText: '선생님은 언제나 기다리고 계세요',
        boons: { heal: '따뜻한 격려', power: '오답 노트 정리', focus: '집중하는 법', team: '친구와 함께' },
      },
      boss: { name: '시험 불안', emoji: '😱', hp: 500, times: [90], needEchoes: 2, fightSec: 11, refMul: 0.6, speed: 0.35, r: 30, dmg: 9, xp: 30, ai: 'boss', pattern: 'exam', warnText: '⚠ 기말고사 D-DAY, 불안이 밀려와요 ⚠', startText: '😱 시험 불안, 극복해 봐요!', summon: 'hw' },
      waves: [
        { from: 0,  to: 20,  interval: 52, n: 1, w: { hw: 6, test: 3 } },
        { from: 20, to: 45,  interval: 40, n: 2, w: { hw: 5, test: 4, alarm: 1, late: 2 } },
        { from: 45, to: 75,  interval: 36, n: 2, w: { hw: 4, test: 3, alarm: 2, late: 2, chalk: 2, group: 2 } },
        { from: 75, to: 121, interval: 30, n: 2, w: { hw: 4, test: 3, alarm: 2, late: 2, chalk: 1, group: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'test', n: 10, text: '걱정이 몰려와요!' },
        { t: 62,  type: 'late', n: 6,  text: '지각 러시!' },
        { t: 100, type: 'hw',   n: 10, text: '미루기 폭탄!' },
      ],
      gear: { atk: { icon: '✏️', name: '잘 깎인 연필' }, def: { icon: '🎒', name: '튼튼한 책가방' } },
    },

    /* ================= 2. 학원 ================= */
    academy: {
      id: 'academy', name: '학원', emoji: '📖', coinMul: 1.3,
      desc: '학교가 끝나도 공부는 계속된다. 마음의 방해가 원거리로 날아오는 대신 경험치가 쑥쑥 오릅니다. 학원 선생님이 코칭해 주세요.',
      ruleText: '빡센 진도: 경험치 +30% · 방해 요소가 더 단단하고 많이 나옴 · 원거리 적 多',
      unlock: { world: 'school' },
      theme: { bg: '#1d1530', grid: 'rgba(190,140,255,.07)', deco: 'ruled' },
      rules: { hpMul: 1.05, xpMul: 1.3, speedMul: 1.0, spawnMul: 1.0, atkMul: 0.65, trains: { first: 30, every: 40, emoji: '📚', text: '📚 책수레 질주! 빨간 줄을 피하세요' } },
      enemies: {
        book:  { name: '조급함',            emoji: '😖', hp: 4,  speed: 0.75, r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        quiz:  { name: '불안',              emoji: '😟', hp: 3,  speed: 1.2,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        memo:  { name: '잡념',              emoji: '🌀', hp: 6,  speed: 0.55, r: 9,  dmg: 4,  xp: 2, ai: 'shoot', fireCd: 150, volley: 3, spread: 0.28, bspeed: 1.9, bdmg: 4 },
        bus:   { name: '미루고 싶은 마음',  emoji: '🛋️', hp: 10, speed: 0.55, r: 13, dmg: 10, xp: 3, ai: 'dash', dashCd: 140 },
        ox:    { name: '포기 충동',         emoji: '🏳️', hp: 9,  speed: 0.6,  r: 11, dmg: 7,  xp: 3, ai: 'chase', onDeath: { type: 'quiz', n: 2 } },
      },
      helper: {
        name: '학원 선생님', emoji: '🧑‍🏫', t: 20,
        arriveText: '🧑‍🏫 학원 선생님이 코칭하러 오셨어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선생님의 코칭을 받았어요',
        leaveText: '질문은 언제든 환영이에요',
        boons: { heal: '마음 다독이기', power: '개념 완성', focus: '시간 관리법', team: '스터디 그룹' },
      },
      boss:  { name: '슬럼프', emoji: '🌧️', hp: 850, times: [85, 125], needEchoes: 4, fightSec: 21, refMul: 1.0, speed: 0.35, r: 30, dmg: 12, xp: 34, ai: 'boss', pattern: 'spiral', warnText: '⚠ 슬럼프가 찾아와요 ⚠', startText: '🌧️ 슬럼프, 함께 이겨내요!', summon: 'memo',
              minis: [{ name: '진도 압박', emoji: '📈', pattern: 'charge', warnText: '⚠ 진도가 훅훅 나가요… 진도 압박 ⚠', startText: '📈 진도 압박, 한 걸음씩 따라가요!' }] },
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
      gear: { atk: { icon: '🖊️', name: '형광 펜 세트' }, def: { icon: '🧣', name: '포근한 목도리' } },
    },

    /* ================= 3. 회사 ================= */
    office: {
      id: 'office', name: '회사', emoji: '🏢', coinMul: 1.6,
      desc: '야근의 연속. 방해 요소를 잡으면 가끔 커피가 떨어져 힘이 납니다. 멘토 선배가 조언해 줍니다.',
      ruleText: '야근 커피: 방해 요소를 잡으면 가끔 ☕ 떨어짐(체력 +12) · 일이 몰려 방해가 많이 나옴 · 방해 요소가 더 단단함',
      unlock: { world: 'academy' },
      theme: { bg: '#172229', grid: 'rgba(140,200,220,.07)', deco: 'tiles' },
      rules: { hpMul: 1.1, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.0, coffeeChance: 0.04, atkMul: 0.7, drops: { first: 18, every: 15, n: 1, emoji: '📦', text: '📦 택배 상자가 떨어져요! 빨간 원을 피하세요' } },
      enemies: {
        doc:     { name: '스트레스',      emoji: '😫', hp: 4,  speed: 0.8,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        mail:    { name: '압박감',        emoji: '💢', hp: 2,  speed: 1.25, r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        call:    { name: '산만함',        emoji: '🔔', hp: 6,  speed: 0.6,  r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        printer: { name: '고장난 프린터', emoji: '🖨️', hp: 14, speed: 0.4, r: 12, dmg: 6, xp: 3, ai: 'shoot', fireCd: 130, volley: 3, spread: 0.3, bspeed: 1.8, bdmg: 4 },
        meeting: { name: '끝없는 걱정',   emoji: '🌫️', hp: 12, speed: 0.55, r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'mail', n: 2 } },
      },
      helper: {
        name: '멘토 선배', emoji: '🧑‍💼', t: 20,
        arriveText: '🧑‍💼 멘토 선배가 조언해 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선배의 조언을 받았어요',
        leaveText: '궁금한 건 언제든 물어보세요',
        boons: { heal: '숨 돌리기', power: '업무 노하우', focus: '우선순위 정리', team: '동료와 협업' },
      },
      boss:  { name: '번아웃', emoji: '🥵', hp: 1000, times: [80, 115, 150], needEchoes: 5, fightSec: 16, refMul: 0.6, speed: 0.35, r: 30, dmg: 14, xp: 38, ai: 'boss', pattern: 'charge', warnText: '⚠ 번아웃이 다가와요 ⚠', startText: '🥵 번아웃, 쉬어가며 극복해요!', summon: 'mail',
              minis: [{ name: '피로 누적', emoji: '😩', pattern: 'spiral', warnText: '⚠ 피로가 차곡차곡 쌓여요 ⚠', startText: '😩 피로 누적, 잠깐 쉬며 극복해요!' }, { name: '완벽 강박', emoji: '🔍', pattern: 'exam', warnText: '⚠ 다 완벽해야 할 것 같아요… ⚠', startText: '🔍 완벽 강박, 적당히도 괜찮아요!' }] },
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
      gear: { atk: { icon: '💻', name: '빠른 노트북' }, def: { icon: '🪑', name: '편안한 의자' } },
    },

    /* ================= 4. 지하철 ================= */
    subway: {
      id: 'subway', name: '지하철', emoji: '🚇', coinMul: 2.0,
      desc: '퇴근길 만원 지하철. 달려오는 열차를 피하세요! 친절한 역무원이 길을 안내해 줍니다.',
      ruleText: '열차 습격: 경고 줄이 뜬 뒤 열차가 가로질러 지나감 (치이면 최대 체력의 40%가 깎임! 방해 요소는 즉사)',
      unlock: { world: 'office' },
      theme: { bg: '#10201f', grid: 'rgba(255,255,255,.03)', deco: 'rails' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.0, coffeeChance: 0.04, trains: { first: 24, every: 36}, atkMul: 0.75 },
      enemies: {
        sleepy:  { name: '졸음',          emoji: '😪', hp: 5,  speed: 0.9,  r: 9,  dmg: 6,  xp: 1, ai: 'zig' },
        bag:     { name: '무거운 가방',   emoji: '🎒', hp: 9,  speed: 0.6,  r: 11, dmg: 8,  xp: 2, ai: 'chase' },
        ad:      { name: '시끄러운 방송', emoji: '📢', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 150, volley: 5, spread: 0.32, bspeed: 1.7, bdmg: 4 },
        phone:   { name: '스마트폰 알림', emoji: '📱', hp: 5,  speed: 0.7,  r: 8,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        fatigue: { name: '쌓인 피로',     emoji: '🥱', hp: 14, speed: 0.5,  r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'sleepy', n: 3 } },
      },
      helper: {
        name: '친절한 역무원', emoji: '🙋', t: 20,
        arriveText: '🙋 역무원이 도와주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 역무원의 안내를 받았어요',
        leaveText: '도움이 필요하면 언제든 말씀하세요',
        boons: { heal: '잠깐 쉬어가기', power: '빠른 환승 길', focus: '졸음 깨우기', team: '함께 가는 길' },
      },
      boss:  { name: '급행열차', emoji: '🚆', hp: 950, times: [75, 110, 145], needEchoes: 6, fightSec: 14, refMul: 0.5, speed: 0.35, r: 30, dmg: 14, xp: 42, ai: 'boss', pattern: 'lane', warnText: '⚠ 급행열차가 들어와요 ⚠', startText: '🚆 급행열차를 피해 집으로!', summon: 'sleepy',
              minis: [{ name: '멀미', emoji: '🤢', pattern: 'spiral', warnText: '⚠ 덜컹덜컹… 멀미가 와요 ⚠', startText: '🤢 멀미, 창밖을 보며 버텨요!' }, { name: '환승 미로', emoji: '🧭', pattern: 'lane', warnText: '⚠ 어디로 가야 하지? 환승 미로 ⚠', startText: '🧭 환승 미로, 표지판을 따라가요!' }, { name: '졸음 쓰나미', emoji: '🌊', pattern: 'charge', warnText: '⚠ 졸음이 파도처럼 밀려와요 ⚠', startText: '🌊 졸음 쓰나미, 정신 차려요!' }] },
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
      gear: { atk: { icon: '🎶', name: '신나는 플레이리스트' }, def: { icon: '☂️', name: '튼튼한 우산' } },
    },

    /* ================= 5. 집 ================= */
    home: {
      id: 'home', name: '집', emoji: '🏠', coinMul: 2.4,
      desc: '드디어 집! 그런데 밤이 깊을수록 야식과 게임의 유혹이 몰려옵니다. 어두워서 가까운 방해 요소만 보여요. 다정한 가족이 챙겨 줍니다.',
      ruleText: '깊은 밤: 어두워서 조준 거리가 짧아짐(가까운 적만 자동 공격) · 방해 요소가 더 단단함',
      unlock: { world: 'subway' },
      theme: { bg: '#0f1224', grid: 'rgba(160,170,255,.05)', deco: 'stars' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.0, sight: 190, atkMul: 0.78, drops: { first: 16, every: 14, n: 1, emoji: '🧺', text: '🧺 빨래 바구니가 떨어져요! 빨간 원을 피하세요' } },
      enemies: {
        snack:  { name: '야식 유혹',     emoji: '🍜', hp: 5,  speed: 0.85, r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        game:   { name: '게임 한 판만',  emoji: '🎮', hp: 6,  speed: 0.65, r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 105 },
        scroll: { name: '무한 스크롤',   emoji: '🔄', hp: 4,  speed: 1.0,  r: 8,  dmg: 5,  xp: 1, ai: 'zig' },
        moon:   { name: '내일 걱정',     emoji: '🌙', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 140, volley: 3, spread: 0.3, bspeed: 1.8, bdmg: 4 },
        sock:   { name: '어질러진 방',   emoji: '🧦', hp: 13, speed: 0.5,  r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'snack', n: 2 } },
      },
      helper: {
        name: '다정한 가족', emoji: '👨‍👩‍👧', t: 20,
        arriveText: '👨‍👩‍👧 가족이 챙겨 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 가족의 응원을 받았어요',
        leaveText: '힘들 땐 언제든 이야기해요',
        boons: { heal: '따뜻한 밥 한 끼', power: '든든한 응원', focus: '일찍 자기', team: '가족과 함께' },
      },
      boss: { name: '불면증', emoji: '😵‍💫', hp: 1000, times: [75, 105, 135], needEchoes: 6, fightSec: 18, refMul: 0.5, speed: 0.35, r: 30, dmg: 14, xp: 40, ai: 'boss', pattern: 'spiral', warnText: '⚠ 잠이 오지 않아요… 불면증이 찾아와요 ⚠', startText: '😵‍💫 불면증, 천천히 숨 쉬며 극복해요!', summon: 'scroll',
              minis: [{ name: '야식 폭주', emoji: '🍕', pattern: 'charge', warnText: '⚠ 냉장고 문이 열려요… 야식 폭주 ⚠', startText: '🍕 야식 폭주, 물 한 잔으로 이겨내요!' }, { name: '무한 영상', emoji: '📺', pattern: 'spiral', warnText: '⚠ 다음 영상이 자동 재생돼요 ⚠', startText: '📺 무한 영상, 화면을 끄고 극복해요!' }, { name: '어질러진 마음', emoji: '🌪️', pattern: 'exam', warnText: '⚠ 마음이 어수선해요 ⚠', startText: '🌪️ 어질러진 마음, 하나씩 정리해요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { snack: 6, scroll: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { snack: 5, scroll: 4, game: 2, moon: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { snack: 4, scroll: 3, game: 2, moon: 2, sock: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { snack: 3, scroll: 3, game: 2, moon: 2, sock: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'scroll', n: 14, text: '스크롤이 멈추지 않아요!' },
        { t: 62,  type: 'game',   n: 8,  text: '딱 한 판만 러시!' },
        { t: 100, type: 'snack',  n: 16, text: '야식 유혹 폭주!' },
      ],
      gear: { atk: { icon: '🕯️', name: '아로마 캔들' }, def: { icon: '🛏️', name: '포근한 이불' } },
    },

    /* ================= 6. 헬스장 ================= */
    gym: {
      id: 'gym', name: '헬스장', emoji: '🏋️', coinMul: 2.8,
      desc: '건강을 위해 등록한 헬스장. 운동한 만큼 쑥쑥 성장하지만 귀찮음과 핑계가 쉬지 않고 몰려옵니다. 트레이너가 자세를 잡아 줍니다.',
      ruleText: '땀 흘린 만큼: 경험치 +15% · 방해 요소가 15% 더 자주 나옴',
      unlock: { world: 'home' },
      theme: { bg: '#22161a', grid: 'rgba(255,150,150,.06)', deco: 'tiles' },
      rules: { hpMul: 1.15, xpMul: 1.15, speedMul: 1.0, spawnMul: 1.15, atkMul: 0.8, trains: { first: 24, every: 34, emoji: '🏐', text: '🏐 공이 굴러와요! 빨간 줄을 피하세요' } },
      enemies: {
        lazy:   { name: '귀찮음',     emoji: '🫠', hp: 5,  speed: 0.8,  r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        ache:   { name: '근육통',     emoji: '💥', hp: 9,  speed: 0.6,  r: 11, dmg: 8,  xp: 2, ai: 'chase' },
        excuse: { name: '핑계',       emoji: '🗯️', hp: 6,  speed: 0.65, r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 95 },
        sweat:  { name: '땀범벅',     emoji: '💦', hp: 4,  speed: 1.0,  r: 8,  dmg: 5,  xp: 1, ai: 'zig' },
        breath: { name: '헉헉 숨참',  emoji: '💨', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 135, volley: 3, spread: 0.26, bspeed: 1.9, bdmg: 4 },
        battery:{ name: '작은 포기',  emoji: '🪫', hp: 13, speed: 0.5,  r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'lazy', n: 2 } },
      },
      helper: {
        name: '친절한 트레이너', emoji: '🧔', t: 20,
        arriveText: '🧔 트레이너가 자세를 봐 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 트레이너의 코칭을 받았어요',
        leaveText: '꾸준함이 최고의 비결이에요',
        boons: { heal: '물 한 모금', power: '바른 자세', focus: '호흡법', team: '운동 메이트' },
      },
      boss: { name: '작심삼일', emoji: '🗓️', hp: 1050, times: [75, 105, 135], needEchoes: 7, fightSec: 18, refMul: 0.55, speed: 0.35, r: 30, dmg: 14, xp: 42, ai: 'boss', pattern: 'charge', warnText: '⚠ 오늘만 쉴까…? 작심삼일이 다가와요 ⚠', startText: '🗓️ 작심삼일, 오늘도 해내요!', summon: 'lazy',
              minis: [{ name: '근육통 대왕', emoji: '💢', pattern: 'charge', warnText: '⚠ 온몸이 쑤셔요… 근육통 대왕 ⚠', startText: '💢 근육통 대왕, 스트레칭으로 극복!' }, { name: '귀차니즘', emoji: '🛋️', pattern: 'spiral', warnText: '⚠ 소파가 나를 부르고 있어요 ⚠', startText: '🛋️ 귀차니즘, 일어나서 움직여요!' }, { name: '정체기', emoji: '🧊', pattern: 'exam', warnText: '⚠ 아무리 해도 그대로인 것 같아요 ⚠', startText: '🧊 정체기, 꾸준함이 답이에요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { lazy: 6, sweat: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { lazy: 5, sweat: 4, excuse: 2, ache: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { lazy: 4, sweat: 3, excuse: 2, ache: 2, breath: 2, battery: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { lazy: 3, sweat: 3, excuse: 2, ache: 2, breath: 2, battery: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'sweat',  n: 14, text: '땀이 비 오듯!' },
        { t: 62,  type: 'excuse', n: 8,  text: '핑계 러시!' },
        { t: 100, type: 'lazy',   n: 18, text: '귀찮음 대폭발!' },
      ],
      gear: { atk: { icon: '🥊', name: '복싱 글러브' }, def: { icon: '🦺', name: '튼튼한 보호대' } },
    },

    /* ================= 7. 도서관 ================= */
    library: {
      id: 'library', name: '도서관', emoji: '📚', coinMul: 3.2,
      desc: '조용한 도서관에서 꿈을 위한 공부. 배움은 즐겁지만 꾸벅꾸벅 졸음과 막막함이 찾아와요. 사서 선생님이 좋은 책을 추천해 줍니다.',
      ruleText: '조용한 집중: 경험치 +20% · 방해 요소를 잡으면 가끔 🍫(체력 +12) · 시야가 조금 좁음',
      unlock: { world: 'gym' },
      theme: { bg: '#1c1a12', grid: 'rgba(255,220,150,.06)', deco: 'ruled' },
      rules: { hpMul: 1.15, xpMul: 1.2, speedMul: 1.0, spawnMul: 1.0, sight: 220, coffeeChance: 0.03, dropEmoji: '🍫', atkMul: 0.76, drops: { first: 14, every: 13, n: 2, emoji: '📚', text: '📚 책이 쏟아져요! 빨간 원을 피하세요' } },
      enemies: {
        nod:    { name: '꾸벅꾸벅',      emoji: '💤', hp: 5,  speed: 0.9,  r: 9,  dmg: 6,  xp: 1, ai: 'zig' },
        tempt:  { name: '스마트폰 유혹', emoji: '📲', hp: 6,  speed: 0.7,  r: 8,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        wall:   { name: '막막함',        emoji: '🧱', hp: 15, speed: 0.45, r: 13, dmg: 9,  xp: 3, ai: 'chase' },
        compare:{ name: '비교하는 마음', emoji: '⚖️', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 140, volley: 3, spread: 0.3, bspeed: 1.9, bdmg: 4 },
        hurry:  { name: '조바심',        emoji: '⌛', hp: 4,  speed: 1.2,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        bubble: { name: '흐트러진 집중', emoji: '🫧', hp: 12, speed: 0.55, r: 12, dmg: 7,  xp: 3, ai: 'chase', onDeath: { type: 'hurry', n: 2 } },
      },
      helper: {
        name: '사서 선생님', emoji: '👩‍💼', t: 20,
        arriveText: '👩‍💼 사서 선생님이 좋은 책을 추천해 주세요! 빛나는 원으로 가 보세요',
        thanksText: '💛 선생님께 추천을 받았어요',
        leaveText: '궁금한 건 언제든 물어보세요',
        boons: { heal: '잠깐 산책', power: '딱 맞는 참고서', focus: '뽀모도로 공부법', team: '스터디 친구' },
      },
      boss: { name: '집중력 저하', emoji: '😵', hp: 1100, times: [75, 105, 135], needEchoes: 7, fightSec: 17, refMul: 0.55, speed: 0.4, r: 30, dmg: 14, xp: 44, ai: 'boss', pattern: 'exam', warnText: '⚠ 글자가 눈에 안 들어와요… 집중력 저하 ⚠', startText: '😵 집중력 저하, 한 줄씩 차근차근!', summon: 'nod',
              minis: [{ name: '잡념 소용돌이', emoji: '🌀', pattern: 'spiral', warnText: '⚠ 생각이 빙글빙글 돌아요 ⚠', startText: '🌀 잡념 소용돌이, 한 줄에 집중해요!' }, { name: '졸음 마왕', emoji: '😪', pattern: 'charge', warnText: '⚠ 눈꺼풀이 천근만근… 졸음 마왕 ⚠', startText: '😪 졸음 마왕, 기지개 켜고 극복!' }, { name: '비교의 늪', emoji: '🕳️', pattern: 'exam', warnText: '⚠ 남과 비교하는 마음이 커져요 ⚠', startText: '🕳️ 비교의 늪, 어제의 나와 비교해요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { nod: 6, hurry: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { nod: 5, hurry: 4, tempt: 2, compare: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { nod: 4, hurry: 3, tempt: 2, compare: 2, wall: 1, bubble: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { nod: 3, hurry: 3, tempt: 2, compare: 2, wall: 2, bubble: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'nod',   n: 14, text: '졸음이 밀려와요!' },
        { t: 62,  type: 'tempt', n: 8,  text: '알림 유혹 러시!' },
        { t: 100, type: 'hurry', n: 18, text: '조바심 폭발!' },
      ],
      gear: { atk: { icon: '📏', name: '반짝이는 자' }, def: { icon: '🎧', name: '소음 차단 헤드폰' } },
    },

    /* ================= 8. 바닷가 ================= */
    beach: {
      id: 'beach', name: '바닷가', emoji: '🏖️', coinMul: 3.6,
      desc: '기다리던 여름휴가! 그런데 바닷바람이 쉬지 않고 불어 몸이 밀려요. 친절한 안전요원이 지켜 줍니다.',
      ruleText: '바닷바람: 바람이 좌우로 번갈아 불어 캐릭터가 밀림 · 방해 요소가 더 단단함',
      unlock: { world: 'library' },
      theme: { bg: '#0f2230', grid: 'rgba(120,220,255,.06)', deco: 'waves' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.05, wind: { amp: 0.75, period: 5}, atkMul: 0.8, trains: { first: 22, every: 32, emoji: '🌊', text: '🌊 큰 파도가 밀려와요! 빨간 줄을 피하세요' } },
      enemies: {
        sun:    { name: '뙤약볕',        emoji: '☀️', hp: 6,  speed: 0.75, r: 10, dmg: 6,  xp: 1, ai: 'chase' },
        mosq:   { name: '모기',          emoji: '🦟', hp: 3,  speed: 1.25, r: 7,  dmg: 5,  xp: 1, ai: 'zig' },
        sand:   { name: '모래바람',      emoji: '🏜️', hp: 8,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 130, volley: 4, spread: 0.3, bspeed: 1.8, bdmg: 4 },
        jelly:  { name: '해파리 걱정',   emoji: '🪼', hp: 6,  speed: 0.7,  r: 9,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 100 },
        wave:   { name: '밀려오는 귀찮음', emoji: '🌊', hp: 14, speed: 0.5,  r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'mosq', n: 3 } },
      },
      helper: {
        name: '친절한 안전요원', emoji: '🙆', t: 20,
        arriveText: '🙆 안전요원이 도와주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 안전요원의 도움을 받았어요',
        leaveText: '안전한 물놀이 되세요',
        boons: { heal: '그늘에서 쉬기', power: '구명조끼', focus: '물 마시기', team: '함께 노는 친구' },
      },
      boss: { name: '태풍', emoji: '⛈️', hp: 1150, times: [75, 105, 135, 165], needEchoes: 8, fightSec: 16, refMul: 0.55, speed: 0.35, r: 30, dmg: 15, xp: 46, ai: 'boss', pattern: 'spiral', warnText: '⚠ 하늘이 어두워져요… 태풍이 다가와요 ⚠', startText: '⛈️ 태풍, 함께 버텨내요!', summon: 'mosq',
              minis: [{ name: '땡볕 대마왕', emoji: '🌞', pattern: 'exam', warnText: '⚠ 햇볕이 너무 뜨거워요 ⚠', startText: '🌞 땡볕 대마왕, 그늘로 피하며 극복!' }, { name: '해파리 떼', emoji: '🪼', pattern: 'spiral', warnText: '⚠ 해파리 떼가 몰려와요 ⚠', startText: '🪼 해파리 떼, 조심조심 피해요!' }, { name: '거대 파도', emoji: '🌊', pattern: 'charge', warnText: '⚠ 커다란 파도가 다가와요 ⚠', startText: '🌊 거대 파도, 함께 버텨요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { sun: 5, mosq: 4 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { sun: 5, mosq: 4, jelly: 2, sand: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { sun: 4, mosq: 3, jelly: 2, sand: 2, wave: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { sun: 3, mosq: 3, jelly: 2, sand: 2, wave: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'mosq',  n: 16, text: '모기떼 습격!' },
        { t: 62,  type: 'jelly', n: 8,  text: '해파리 걱정 러시!' },
        { t: 100, type: 'sun',   n: 16, text: '폭염 경보!' },
      ],
      gear: { atk: { icon: '🪁', name: '바람 연' }, def: { icon: '🧴', name: '자외선 차단제' } },
    },

    /* ================= 9. 공항 ================= */
    airport: {
      id: 'airport', name: '공항', emoji: '✈️', coinMul: 4.0,
      desc: '첫 해외 출장! 넓은 공항에서 수하물 카트가 쌩쌩 달립니다. 친절한 안내원이 길을 알려 줍니다.',
      ruleText: '수하물 카트: 경고 줄이 뜬 뒤 카트가 가로질러 지나감 (치이면 최대 체력의 40%가 깎임! 방해 요소는 즉사)',
      unlock: { world: 'beach' },
      theme: { bg: '#18202c', grid: 'rgba(200,220,255,.06)', deco: 'tiles' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.05, trains: { first: 22, every: 32, emoji: '🛒', text: '🛒 수하물 카트 질주! 빨간 줄을 피하세요'}, atkMul: 0.84 },
      enemies: {
        jet:    { name: '시차 피로',  emoji: '🌗', hp: 6,  speed: 0.85, r: 9,  dmg: 6,  xp: 1, ai: 'zig' },
        lost:   { name: '분실 걱정',  emoji: '❓', hp: 4,  speed: 1.2,  r: 8,  dmg: 5,  xp: 1, ai: 'chase' },
        delay:  { name: '지연 안내',  emoji: '🔊', hp: 9,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 145, volley: 5, spread: 0.32, bspeed: 1.8, bdmg: 4 },
        rush:   { name: '조급증',     emoji: '⚡', hp: 6,  speed: 0.7,  r: 8,  dmg: 8,  xp: 2, ai: 'dash', dashCd: 95 },
        queue:  { name: '긴 대기줄',  emoji: '🐢', hp: 15, speed: 0.45, r: 13, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'lost', n: 3 } },
      },
      helper: {
        name: '친절한 안내원', emoji: '💁', t: 20,
        arriveText: '💁 안내원이 길을 알려 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 안내원의 도움을 받았어요',
        leaveText: '즐거운 여행 되세요',
        boons: { heal: '라운지 휴식', power: '빠른 길 안내', focus: '탑승권 확인', team: '여행 동료' },
      },
      boss: { name: '난기류', emoji: '🌪️', hp: 1200, times: [75, 105, 135, 165], needEchoes: 8, fightSec: 16, refMul: 0.5, speed: 0.35, r: 30, dmg: 15, xp: 48, ai: 'boss', pattern: 'lane', warnText: '⚠ 덜컹! 난기류 구간이에요 ⚠', startText: '🌪️ 난기류, 안전벨트 매고 극복해요!', summon: 'jet',
              minis: [{ name: '시차 대마왕', emoji: '🕰️', pattern: 'spiral', warnText: '⚠ 몸이 시간을 헷갈려요 ⚠', startText: '🕰️ 시차 대마왕, 햇볕 쬐며 적응해요!' }, { name: '분실 공포', emoji: '🧳', pattern: 'charge', warnText: '⚠ 가방이 안 보여요…! ⚠', startText: '🧳 분실 공포, 침착하게 찾아봐요!' }, { name: '지연 폭탄', emoji: '⏰', pattern: 'exam', warnText: '⚠ 출발이 계속 늦어져요 ⚠', startText: '⏰ 지연 폭탄, 느긋하게 기다려요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { jet: 6, lost: 4 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { jet: 5, lost: 4, rush: 2, delay: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { jet: 4, lost: 3, rush: 2, delay: 2, queue: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { jet: 3, lost: 3, rush: 2, delay: 2, queue: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'lost',  n: 16, text: '분실 걱정이 몰려와요!' },
        { t: 62,  type: 'rush',  n: 8,  text: '조급증 러시!' },
        { t: 100, type: 'jet',   n: 16, text: '시차 폭탄!' },
      ],
      gear: { atk: { icon: '🧭', name: '반짝 나침반' }, def: { icon: '🧥', name: '여행용 점퍼' } },
    },

    /* ================= 10. 병원 ================= */
    hospital: {
      id: 'hospital', name: '병원', emoji: '🏥', coinMul: 4.5,
      desc: '바쁘게 살다 건강검진을 받으러 왔어요. 쌓인 무리와 감기 기운이 빠르게 몰려옵니다. 간호사가 건강을 챙겨 줍니다.',
      ruleText: '회복의 힘: 방해 요소를 잡으면 가끔 💊(체력 +12) · 방해 요소가 5% 더 빠름',
      unlock: { world: 'airport' },
      theme: { bg: '#162628', grid: 'rgba(160,255,230,.06)', deco: 'tiles' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.05, spawnMul: 1.05, coffeeChance: 0.05, dropEmoji: '💊', atkMul: 0.88, trains: { first: 22, every: 30, emoji: '🛏️', text: '🛏️ 이동 침대가 지나가요! 빨간 줄을 피하세요' } },
      enemies: {
        germ:   { name: '감기 기운',     emoji: '🦠', hp: 5,  speed: 0.95, r: 8,  dmg: 6,  xp: 1, ai: 'zig' },
        cough:  { name: '콜록콜록',      emoji: '🤧', hp: 7,  speed: 0.7,  r: 9,  dmg: 6,  xp: 2, ai: 'chase' },
        junk:   { name: '불규칙한 식사', emoji: '🍔', hp: 10, speed: 0.55, r: 11, dmg: 8,  xp: 2, ai: 'chase' },
        over:   { name: '무리한 습관',   emoji: '🔥', hp: 6,  speed: 0.7,  r: 9,  dmg: 9,  xp: 2, ai: 'dash', dashCd: 95 },
        xray:   { name: '검사 걱정',     emoji: '🩻', hp: 9,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 135, volley: 4, spread: 0.3, bspeed: 1.9, bdmg: 4 },
        petri:  { name: '면역력 저하',   emoji: '🧫', hp: 14, speed: 0.5,  r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'germ', n: 3 } },
      },
      helper: {
        name: '다정한 간호사', emoji: '👩‍⚕️', t: 20,
        arriveText: '👩‍⚕️ 간호사가 건강을 챙겨 주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 간호사의 돌봄을 받았어요',
        leaveText: '건강이 제일 중요해요',
        boons: { heal: '푹 쉬기', power: '영양 가득 식단', focus: '규칙적인 생활', team: '함께하는 산책' },
      },
      boss: { name: '독감', emoji: '🤒', hp: 1250, times: [75, 105, 135, 165], needEchoes: 9, fightSec: 16, refMul: 0.5, speed: 0.4, r: 30, dmg: 15, xp: 50, ai: 'boss', pattern: 'exam', warnText: '⚠ 으슬으슬… 독감이 찾아와요 ⚠', startText: '🤒 독감, 푹 쉬며 이겨내요!', summon: 'germ',
              minis: [{ name: '감기 군단', emoji: '🦠', pattern: 'spiral', warnText: '⚠ 감기 기운이 군단으로 몰려와요 ⚠', startText: '🦠 감기 군단, 손 씻고 극복해요!' }, { name: '불규칙 대왕', emoji: '🍔', pattern: 'charge', warnText: '⚠ 생활 리듬이 엉망이에요 ⚠', startText: '🍔 불규칙 대왕, 규칙적으로 극복!' }, { name: '무리 대장', emoji: '🔥', pattern: 'exam', warnText: '⚠ 너무 무리하고 있어요 ⚠', startText: '🔥 무리 대장, 쉬어 가요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { germ: 6, cough: 3 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { germ: 5, cough: 4, over: 2, xray: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { germ: 4, cough: 3, over: 2, xray: 2, junk: 2, petri: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { germ: 3, cough: 3, over: 2, xray: 2, junk: 2, petri: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'germ',  n: 16, text: '감기 기운 확산!' },
        { t: 62,  type: 'over',  n: 8,  text: '무리한 습관 러시!' },
        { t: 100, type: 'cough', n: 16, text: '콜록콜록 대유행!' },
      ],
      gear: { atk: { icon: '🍊', name: '비타민 충전' }, def: { icon: '💉', name: '예방 접종' } },
    },

    /* ================= 11. 산 ================= */
    mountain: {
      id: 'mountain', name: '산', emoji: '🏔️', coinMul: 5.0,
      desc: '정상을 향한 등산. 거센 산바람에 몸이 흔들리고 안개 때문에 앞이 잘 안 보여요. 산악 구조대가 안전하게 이끌어 줍니다.',
      ruleText: '산바람 + 안개: 바람이 세게 불어 캐릭터가 밀리고, 시야가 좁아 가까운 적만 조준',
      unlock: { world: 'hospital' },
      theme: { bg: '#1a2420', grid: 'rgba(200,255,200,.05)', deco: 'diag' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.1, wind: { amp: 0.95, period: 4}, atkMul: 0.92, sight: 210, drops: { first: 12, every: 12, n: 2, emoji: '🪨', text: '🪨 낙석 주의! 빨간 원을 피하세요' } },
      enemies: {
        slope:  { name: '가파른 오르막',       emoji: '⛰️', hp: 16, speed: 0.45, r: 13, dmg: 9,  xp: 3, ai: 'chase' },
        rock:   { name: '굴러오는 돌',         emoji: '🪨', hp: 7,  speed: 0.7,  r: 9,  dmg: 9,  xp: 2, ai: 'dash', dashCd: 90 },
        bee:    { name: '벌떼',                emoji: '🐝', hp: 4,  speed: 1.2,  r: 7,  dmg: 5,  xp: 1, ai: 'zig' },
        fog:    { name: '짙은 안개',           emoji: '🌁', hp: 9,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 140, volley: 3, spread: 0.3, bspeed: 2.0, bdmg: 5 },
        wilt:   { name: '포기하고 싶은 마음',  emoji: '🥀', hp: 14, speed: 0.5,  r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'bee', n: 3 } },
      },
      helper: {
        name: '산악 구조대', emoji: '👷', t: 20,
        arriveText: '👷 산악 구조대가 도와주러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 구조대의 도움을 받았어요',
        leaveText: '천천히, 안전하게 올라가요',
        boons: { heal: '따뜻한 차 한 잔', power: '등산 스틱', focus: '페이스 조절', team: '함께 오르는 길' },
      },
      boss: { name: '눈보라', emoji: '🌨️', hp: 1300, times: [75, 105, 135, 165], needEchoes: 9, fightSec: 15, refMul: 0.5, speed: 0.4, r: 30, dmg: 16, xp: 52, ai: 'boss', pattern: 'charge', warnText: '⚠ 정상 직전, 눈보라가 몰아쳐요 ⚠', startText: '🌨️ 눈보라를 뚫고 정상으로!', summon: 'bee',
              minis: [{ name: '낙석 폭풍', emoji: '🪨', pattern: 'charge', warnText: '⚠ 돌이 굴러 내려와요 ⚠', startText: '🪨 낙석 폭풍, 피하며 올라가요!' }, { name: '안개 거인', emoji: '🌫️', pattern: 'spiral', warnText: '⚠ 앞이 하나도 안 보여요 ⚠', startText: '🌫️ 안개 거인, 천천히 길을 찾아요!' }, { name: '고산병', emoji: '😵', pattern: 'exam', warnText: '⚠ 숨이 차고 어지러워요 ⚠', startText: '😵 고산병, 쉬어 가며 극복해요!' }] },
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { bee: 6, rock: 2 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { bee: 5, rock: 3, fog: 1, slope: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { bee: 4, rock: 3, fog: 2, slope: 2, wilt: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { bee: 3, rock: 3, fog: 2, slope: 2, wilt: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'bee',   n: 16, text: '벌떼 출몰!' },
        { t: 62,  type: 'rock',  n: 9,  text: '낙석 주의!' },
        { t: 100, type: 'slope', n: 10, text: '끝없는 오르막!' },
      ],
      gear: { atk: { icon: '🥾', name: '튼튼한 등산화' }, def: { icon: '🧤', name: '따뜻한 장갑' } },
    },

    /* ================= 12. 꿈의 무대 ================= */
    stage: {
      id: 'stage', name: '꿈의 무대', emoji: '🎤', coinMul: 6.0,
      desc: '드디어 꿈꾸던 첫 무대! 조명 장치가 움직이고 긴장과 떨림이 한꺼번에 몰려와요. 함께하는 동료가 곁을 지켜 줍니다. 지금까지 만난 큰 도전들이 다시 찾아오고, 마지막에 무대 공포증이 기다려요.',
      ruleText: '움직이는 조명: 경고 줄 뒤 조명 장치가 지나감(최대 체력의 40%) · 방해 요소가 10% 더 자주 나옴 · 큰 도전 4번',
      unlock: { world: 'mountain' },
      theme: { bg: '#1e0f24', grid: 'rgba(255,170,255,.06)', deco: 'stars' },
      rules: { hpMul: 1.15, xpMul: 1.0, speedMul: 1.0, spawnMul: 1.1, trains: { first: 26, every: 34, emoji: '💡', text: '💡 조명 장치가 움직여요! 빨간 줄을 피하세요'}, atkMul: 0.96 },
      enemies: {
        nerve:  { name: '긴장',       emoji: '😬', hp: 6,  speed: 0.85, r: 9,  dmg: 6,  xp: 1, ai: 'chase' },
        shake:  { name: '떨림',       emoji: '🫨', hp: 5,  speed: 1.0,  r: 8,  dmg: 5,  xp: 1, ai: 'zig' },
        oops:   { name: '실수 걱정',  emoji: '🫣', hp: 7,  speed: 0.7,  r: 9,  dmg: 9,  xp: 2, ai: 'dash', dashCd: 95 },
        mirror: { name: '남과 비교',  emoji: '🪞', hp: 9,  speed: 0.5,  r: 10, dmg: 4,  xp: 3, ai: 'shoot', fireCd: 135, volley: 5, spread: 0.32, bspeed: 1.9, bdmg: 4 },
        heart:  { name: '완벽주의',   emoji: '💎', hp: 15, speed: 0.5,  r: 12, dmg: 8,  xp: 3, ai: 'chase', onDeath: { type: 'shake', n: 3 } },
      },
      helper: {
        name: '함께하는 동료', emoji: '🧑‍🎤', t: 20,
        arriveText: '🧑‍🎤 동료가 응원하러 왔어요! 빛나는 원으로 가 보세요',
        thanksText: '💛 동료의 응원을 받았어요',
        leaveText: '우리는 한 팀이에요',
        boons: { heal: '심호흡', power: '연습한 만큼', focus: '리허설', team: '우리 팀' },
      },
      boss: { name: '무대 공포증', emoji: '🎭', hp: 1400, times: [75, 105, 135, 165], needEchoes: 10, fightSec: 14, refMul: 0.5, speed: 0.4, r: 32, dmg: 16, xp: 56, ai: 'boss', pattern: 'exam', warnText: '⚠ 막이 오르기 직전… 무대 공포증이 찾아와요 ⚠', startText: '🎭 무대 공포증, 지금까지의 나와 함께 극복해요!', summon: 'nerve',
              lineup: ['school', 'office', 'beach'] },   // 피날레: 앞 월드의 큰 도전들이 차례로 찾아오고 마지막에 무대 공포증
      waves: [
        { from: 0,  to: 20,  interval: 46, n: 1, w: { nerve: 6, shake: 4 } },
        { from: 20, to: 45,  interval: 36, n: 2, w: { nerve: 5, shake: 4, oops: 2, mirror: 1 } },
        { from: 45, to: 75,  interval: 28, n: 2, w: { nerve: 4, shake: 3, oops: 2, mirror: 2, heart: 2 } },
        { from: 75, to: 121, interval: 20, n: 3, w: { nerve: 3, shake: 3, oops: 2, mirror: 2, heart: 2 } },
      ],
      swarms: [
        { t: 30,  type: 'shake', n: 16, text: '떨림이 멈추지 않아요!' },
        { t: 62,  type: 'oops',  n: 9,  text: '실수 걱정 러시!' },
        { t: 100, type: 'nerve', n: 18, text: '긴장 최고조!' },
      ],
      gear: { atk: { icon: '🎸', name: '일렉 기타' }, def: { icon: '🎙️', name: '든든한 마이크' } },
    },
  };

  /* 한 판 길이 압축: 월드 데이터의 시각(초)은 2분 판 기준으로 적혀 있고, 실제로는 TIME_SCALE배로 줄여 쓴다 (약 72초 판).
   * 스폰 간격도 같이 줄여 1초당 적 밀도는 그대로 유지한다. */
  const TIME_SCALE = 1.2;   // 한 판 약 144초
  // 월드별 큰 도전 체력 보정 (봇 실측: 필요한 에코 수를 갖추면 5번 중 3~4번 넘도록). 어두운 월드는 조준 거리가 짧아 화력이 낮다
  const BOSS_HP_TUNE = { school: 1.6, office: 0.9, home: 0.68, beach: 0.9, airport: 0.67, mountain: 0.74, stage: 0.85, subway: 1.08, gym: 0.95, hospital: 1.08 };
  for (const id in WORLDS) {
    const w = WORLDS[id], sc = (v) => Math.round(v * TIME_SCALE);
    if (BOSS_HP_TUNE[id]) w.rules.bossHp = BOSS_HP_TUNE[id];
    for (const wv of w.waves) { wv.from = sc(wv.from); wv.to = sc(wv.to); wv.interval = Math.max(10, Math.round(wv.interval * 0.85)); }
    for (const sw of w.swarms) sw.t = sc(sw.t);
    if (w.helper) w.helper.t = sc(w.helper.t);
    // 큰 도전이 여러 번인 월드: 첫 보스 뒤로는 20초 간격 (앞 보스를 극복해야 다음이 나오므로 실제로는 극복 직후 연달아)
    { const n = w.boss.times.length, t0 = Math.max(52, sc(w.boss.times[0]) - 12 * (n - 1)); w.boss.times = w.boss.times.map((_, i) => t0 + i * 20); }
    w.boss.fightSec = Math.max(10, Math.round(w.boss.fightSec * 0.8));
    if (w.rules.drops) { w.rules.drops.first = sc(w.rules.drops.first); }   // 낙하물 간격은 이미 짧은 판 기준
    for (const wv of w.waves) { if (wv.n >= 2) wv.n -= 1; wv.interval = Math.round(wv.interval * (id === 'school' ? 1.25 : 1.55)); }   // 동시에 나오는 적 줄이기
    for (const sw of w.swarms) sw.n = Math.max(4, Math.round(sw.n * 0.6));
    if (w.rules.trains) { w.rules.trains.first = Math.round(w.rules.trains.first * 0.9); w.rules.trains.every = Math.max(12, Math.round(w.rules.trains.every * 0.6)); }
  }
  const ORDER = ['school', 'academy', 'office', 'subway', 'home', 'gym', 'library', 'beach', 'airport', 'hospital', 'mountain', 'stage'];

  /* ================= 성장 구조: 월드가 뒤로 갈수록 강해지는 적 vs 월드별 매점 장비 =================
   * 단계(stage) = 월드 순서(0~11) + 12 x 회차(0부터). 12개 월드를 모두 극복하면 다음 회차로 학교부터 다시 시작한다.
   * 단계가 1 오를 때마다 적 체력(보스 기준 화력 포함) x GEAR.atkPer^levelsPerStage, 적 피해 x GEAR.defPer^levelsPerStage.
   * 매점 장비(월드마다 ⚔ 공격 1개 + 🛡 방어 1개)는 레벨 1당 팀(나+에코) 공격력 x atkPer, 받는 피해 ÷ defPer.
   * → "단계당 ⚔ levelsPerStage레벨 + 🛡 levelsPerStage레벨"을 사면 적이 강해진 만큼 정확히 상쇄된다(권장 장비).
   *   장비가 모자라면 적이 단단하고 아파서 큰 도전을 넘기 어렵고, 넉넉하면 수월하다.
   * 회차가 오를 때마다: 적 체력 x loopHp 추가, 이동 +loopSpeed, 스폰 +loopSpawn, 장비 최대 레벨 +maxPerLoop.
   *
   * 끝없이 이어지는 성장(무한 회차)을 위한 경제:
   *   - 장비 가격 = costBase x atkPer^(지금까지 산 ⚔ 레벨 합) (🛡은 defPer) → 내가 강해지는 만큼 비싸진다
   *   - 학점 = 기본 보상 x 이 단계의 적 체력 배율(rewardMul) → 적이 강해지는 만큼 많이 번다
   *   - 단계 1당 필요한 장비(⚔3+🛡3)의 값과 한 판 수입이 같은 비율로 커지므로, 몇 회차가 되어도
   *     "몇 판 벌어서 장비 사고 다음 단계로" 리듬이 똑같이 유지된다. 최대 레벨도 회차마다 넉넉히 늘어난다.
   */
  const GEAR = {
    atkPer: 1.06,          // 공격 장비 1레벨 = 팀 공격력 x1.06
    defPer: 1.05,          // 방어 장비 1레벨 = 받는 피해 ÷1.05
    levelsPerStage: 3,     // 단계 1당 필요한 장비 레벨 (⚔, 🛡 각각)
    maxBase: 5,            // 1회차 장비 최대 레벨 (월드 장비 하나당)
    maxPerLoop: 5,         // 회차마다 최대 레벨 +5 (필요한 장비보다 항상 넉넉하게)
    costBase: 350,         // 장비 가격 = costBase x atkPer^(산 ⚔ 레벨 합) — 🛡은 defPer^(산 🛡 레벨 합)
    loopHp: 1.1,           // 회차마다 적 체력 추가 x1.1 ("조금씩 더 어렵게")
    loopSpeed: 0.05,       // 회차마다 적 이동 +5%
    loopSpawn: 0.08,       // 회차마다 적 스폰 +8%
  };

  function worldIndex(id) { const i = ORDER.indexOf(id); return i < 0 ? 0 : i; }
  function stageOf(worldId, cycle) { return worldIndex(worldId) + ORDER.length * Math.max(0, cycle | 0); }
  /** 이 단계·회차에서 적에게 곱해지는 배율 */
  function stageMul(worldId, cycle) {
    const c = Math.max(0, cycle | 0), st = stageOf(worldId, c);
    return {
      stage: st,
      hp: Math.pow(GEAR.atkPer, GEAR.levelsPerStage * st) * Math.pow(GEAR.loopHp, c),
      dmg: Math.pow(GEAR.defPer, GEAR.levelsPerStage * st),
      speed: 1 + GEAR.loopSpeed * c,
      spawn: 1 + GEAR.loopSpawn * c,
    };
  }
  /** 권장 장비 레벨 합계 {atk, def}: 이만큼 있으면 적이 강해진 만큼 상쇄된다 */
  function recommendedGear(worldId, cycle) {
    const m = stageMul(worldId, cycle);
    return {
      atk: Math.max(0, Math.ceil(Math.log(m.hp) / Math.log(GEAR.atkPer) - 1e-9)),
      def: Math.max(0, Math.ceil(Math.log(m.dmg) / Math.log(GEAR.defPer) - 1e-9)),
    };
  }
  /** 장비 최대 레벨: 처음부터 30까지 살 수 있고, 회차가 높아지면 그보다 더 (5 + 5x회차) */
  function gearMaxLevel(cycle) { return Math.max(30, GEAR.maxBase + GEAR.maxPerLoop * Math.max(0, cycle | 0)); }
  /** 다음 장비 1레벨의 가격: 그 종류(atk/def)를 지금까지 몇 레벨 샀는지로 정해진다 (어느 월드 장비든 같은 값) */
  function gearCost(kind, ownedTotal) { return Math.round(GEAR.costBase * Math.pow(kind === 'def' ? GEAR.defPer : GEAR.atkPer, Math.max(0, ownedTotal | 0))); }
  /** 학점 배율: 적이 강한 단계일수록 많이 번다 (= 적 체력 배율) */
  function rewardMul(worldId, cycle) { return stageMul(worldId, cycle).hp; }

  /* ================= 회차별 주인공 복장 (끝없는 게임) =================
   * 복장 20종 x 단계 5 = 100회차: 회차마다 같은 복장에 장식이 하나씩 늘고(★1→★5), 5회차마다 새 복장으로 바뀐다.
   * 100회차 뒤에는 같은 순서를 색만 살짝 바꿔 다시(색 변형 10가지) → 1000회차. 그 뒤로는 처음 복장부터 다시 시작.
   * 단계: ★1 기본 옷 · ★2 모자 · ★3 목 장식 · ★4 겉옷(망토·날개 등) · ★5 반짝이는 오라
   */
  const OUTFITS = ['교복', '체육복', '후드티', '정장', '한복', '우주복', '탐정', '마법사', '기사', '해적',
    '요리사', '화가', '탐험가', '아이돌', '닌자', '과학자', '파일럿', '소방관', '산타', '왕실'];
  function outfitOf(cycle) {
    const c = ((Math.max(0, cycle | 0) % 1000) + 1000) % 1000;
    const variant = Math.floor(c / 100), k = c % 100;
    const style = Math.floor(k / 5), tier = k % 5;
    return { style, tier, variant, name: OUTFITS[style], stars: tier + 1, key: `${style}.${tier}.${variant}` };
  }

  /** 도우미가 주는 조언 카드 (공통 효과, 이름만 월드별) */
  const BOONS = {
    heal:  { icon: '💛', desc: '체력을 절반 회복' },
    power: { icon: '📒', desc: '공격력 Lv +1' },
    focus: { icon: '⏳', desc: '발사 속도 Lv +1' },
    team:  { icon: '🤝', desc: '에코 응원 Lv +1' },
  };

  const api = { TIME_SCALE, WORLDS, ORDER, BOONS, GEAR, worldIndex, stageOf, stageMul, recommendedGear, gearMaxLevel, gearCost, rewardMul, OUTFITS, outfitOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoWorlds = api;
})(typeof window !== 'undefined' ? window : globalThis);
