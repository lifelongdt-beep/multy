/* Echo Rush — 입력 / 렌더 / 저장 / 연출 */
(function () {
  'use strict';
  const { Sim, addEcho, UPGRADES, SYNERGIES, W, H, PLAY_BOTTOM, TICK, RUN_TICKS, MAX_ECHOES, MAX_LEVEL } = EchoSim;
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);

  /* ---------- 에코 저장 (localStorage, Int16 양자화) ---------- */
  const KEY = 'echo-proto-v2';
  function pack(e) {
    const a = new Int16Array(e.path.length);
    for (let i = 0; i < a.length; i++) a[i] = Math.round(e.path[i] * 10);
    let bin = ''; const u = new Uint8Array(a.buffer);
    for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    return { p: btoa(bin), u: e.ups, k: e.kills, t: e.ticks };
  }
  function unpack(o) {
    const bin = atob(o.p); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const a = new Int16Array(u.buffer); const path = new Array(a.length);
    for (let i = 0; i < a.length; i++) path[i] = a[i] / 10;
    return { path, ups: o.u, kills: o.k, ticks: o.t };
  }
  let echoes = [];
  let echoWorld = 'school';   // 에코를 쌓은 월드 (월드를 옮기면 에코는 새로 시작)
  let runCount = 0;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) { echoes = s.echoes.map(unpack); runCount = s.runCount || 0; echoWorld = s.world || 'school'; }
  } catch (e) { echoes = []; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ runCount, world: echoWorld, echoes: echoes.map(pack) })); } catch (e) { /* 용량 초과 무시 */ }
  }
  /** 시작하려는 월드가 에코 풀의 월드와 다르면 에코를 비운다. 사라진 에코 수를 돌려준다. */
  function syncEchoes(worldId) {
    const r = Meta.echoesForWorld({ world: echoWorld, echoes }, worldId);
    echoWorld = r.world;
    if (r.cleared) { echoes = r.echoes; save(); }
    return r.cleared;
  }
  window.GameEchoes = {
    count() { return echoes.length; },
    world() { return echoWorld; },
    reset(worldId) { echoes = []; echoWorld = worldId || echoWorld; save(); },
    /** 백업 코드용: 지금 에코 풀 */
    pool() { return { world: echoWorld, echoes: echoes.slice() }; },
    /** 백업 코드 불러오기: 에코 풀을 통째로 바꾼다 */
    replace(pool) { echoes = (pool.echoes || []).slice(-MAX_ECHOES); echoWorld = pool.world || 'school'; save(); },
  };

  /* ---------- 입력: 상대 드래그 + 키보드 ---------- */
  const input = { dx: 0, dy: 0 };
  const keys = {};
  let drag = null;
  function toLogical(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', (ev) => { cv.setPointerCapture(ev.pointerId); const p = toLogical(ev); drag = { ax: p.x, ay: p.y, px: p.x, py: p.y }; });
  cv.addEventListener('pointermove', (ev) => dragMove(ev));
  function dragMove(ev) {
    if (!drag) return; const p = toLogical(ev); drag.px = p.x; drag.py = p.y;
    let vx = p.x - drag.ax, vy = p.y - drag.ay; const len = Math.hypot(vx, vy);
    if (len > 46) { drag.ax += vx / len * (len - 46); drag.ay += vy / len * (len - 46); vx = p.x - drag.ax; vy = p.y - drag.ay; }
    // 손떨림 무시(DEAD 이하) + 반경의 절반(FULL)만 당겨도 최대 속도 → 급히 피할 때 기민하게
    const DEAD = 4, FULL = 23, m = Math.hypot(vx, vy);
    if (m <= DEAD) { input.dx = 0; input.dy = 0; return; }
    const k = Math.min(1, (m - DEAD) / (FULL - DEAD)) / m;
    input.dx = vx * k; input.dy = vy * k;
  }
  const endDrag = () => { drag = null; input.dx = 0; input.dy = 0; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') { pickCard(+k - 1); return; }
    if (k === 'escape' || k === 'p') { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); return; }
    keys[k] = true;
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  function currentInput() {
    if (drag) return input;
    const dx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
    const dy = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);
    return { dx, dy };
  }

  ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, () => Sfx.unlock()));

  /* ---------- 연출 상태 ---------- */
  let shake = 0;
  let windPhase = 0;   // 바람 줄기 위치
  let edgeFlash = 0;   // 무리가 몰려올 때 화면 테두리 주황 번쩍임 (본 게임은 글 대신 이것만)
  let hurtFlash = 0;   // 피격 시 화면 가장자리 붉은 번쩍임 (진동이 안 되는 기기에서도 피격을 알 수 있게)
  // 내 에너지가 깎이면 진동: 피해량이 클수록 길게 (미지원 기기는 조용히 무시)
  function vibrate(dmg) {
    try { if (navigator.vibrate) navigator.vibrate(Math.min(220, Math.max(70, Math.round((dmg || 5) * 12)))); } catch (e) { /* 무시 */ }
  }
  let floats = [];
  let autoFlash = [];
  let bubbles = [];     // 고마움 말풍선·하트 {text, x, y, t, max, small}
  let warmFx = [];      // 선행 순간 퍼지는 따뜻한 빛 {x, y, r, t}
  const THANKS = ['고마워!', '덕분이야 💛', '정말 고마워요', '너 최고야!', '살았다~', '고마워, 친구야', '복 받을 거야', '힘이 났어!'];
  const VISIT = ['지난번엔 고마웠어!', '은혜 갚으러 왔어 💛', '이거 받아!', '또 만났네!'];
  function thanks(x, y, list, delay) { bubbles.push({ text: list[Math.floor(Math.random() * list.length)], x, y: y - 34, t: -(delay || 0), max: 80 }); for (let i = 0; i < 5; i++) bubbles.push({ heart: true, x: x + (Math.random() - 0.5) * 30, y: y - 10, t: -i * 6, max: 60 }); }
  let headFlash = [];   // 새로 얻은 아이템: 주인공 머리 위에서 잠깐 반짝 {icon, t}
  // 보스 극복 연출: 슬로모션 → 부풀며 빛남 → 폭발·충격파·색종이 → 화면 번쩍
  let bossFx = null, slowmo = 0, whiteFlash = 0;
  const BOSS_FX_LEN = 80;
  function bossFxActive() { return !!bossFx && bossFx.t < BOSS_FX_LEN; }
  /* ---------- 새 그림체 (시안: 학교 월드). 일시정지 화면의 🎨 버튼 / G키로 이전 그림체와 바꿔 비교 ---------- */
  let artPref = 'new';
  // 이전 그림체는 더 이상 쓰지 않음 (비교용 전환 버튼 제거)
  function artOn() { const w = sim ? sim.world : EchoSim.WORLDS[GameUI.worldId()]; return artPref === 'new' && !!window.Art && Art.supports(w); }
  function toggleArt() {
    artPref = artPref === 'new' ? 'old' : 'new';
    try { localStorage.setItem('echo-art', artPref); } catch (e) { /* 무시 */ }
    if (window.Art) Art.clearParticles();
  }
  window.EchoArt = { toggle: toggleArt, get pref() { return artPref; } };
  let lastPX = null, lastPY = null, faceDir = 1;   // 자동 선택된 아이템 아이콘 반짝임 {id, icon, t}
  let banner = { text: '', t: 0 };
  let toast = { text: '', t: 0 };

  function handleEvents() {
    for (const ev of sim.drainEvents()) {
      switch (ev.k) {
        case 'shoot': Sfx.play('shoot'); break;
        case 'dmg':
          // 데미지 숫자는 표시하지 않음 (화면을 깔끔하게)
          Sfx.play('hit'); break;
        case 'kill':
          if (ev.type === 'boss') {   // 보스 극복: 바로 터뜨리지 않고 짧은 연출
            bossFx = { x: ev.x, y: ev.y, r: ev.r || 30, name: ev.name, emoji: ev.emoji, t: 0, last: !!ev.last };
            slowmo = 50; shake = Math.max(shake, 8); Sfx.play('bossDown');
            break;
          }
          Sfx.play('kill'); if (artOn() && ev.x !== undefined) Art.burst(ev.x, ev.y, Art.enemyColor(ev.type, ev.name), 7, false);
          break;
        case 'gem': Sfx.play('gem'); break;
        case 'levelup': Sfx.play('levelup'); break;
        case 'hurt': shake = Math.max(shake, 7); hurtFlash = 1; Sfx.play('hurt'); vibrate(ev.dmg); break;
        case 'nova': shake = Math.max(shake, 3); Sfx.play('nova'); break;
        case 'echoDown': Sfx.play('echoDown'); break;
        case 'heal': Sfx.play('heal'); break;
        case 'banner': if (!ev.hint || tutorial) banner = { text: ev.text, t: 150 }; break;   // 설명성 문구는 튜토리얼에서만
        case 'swarm': edgeFlash = 40; Sfx.play('boss'); break;
        case 'boss': banner = { text: ev.text || '보스 등장!', t: 90 }; shake = 10; Sfx.play('boss'); break;
        case 'helper': Sfx.play('heal'); break;
        case 'helped': playerCheer = 40; Sfx.play('levelup'); if (ev.x !== undefined) { for (let i = 0; i < 8; i++) bubbles.push({ heart: true, x: ev.x + (Math.random() - 0.5) * 36, y: ev.y - 34 + (Math.random() - 0.5) * 12, t: -i * 2, max: 45 }); if (artOn()) Art.burst(ev.x, ev.y, '#ffd84d', 10, false); } break;
        case 'warm': warmFx.push({ x: ev.x, y: ev.y, r: ev.r, t: 0 }); break;
        case 'deed':   // 선행: 소리·반짝임만 (설명은 튜토리얼 안내에서)
          if (ev.what === 'spot') { pickAnim = { t: 0, max: 26, item: ev.kind === 'pot' ? 'pot' : ev.kind === 'toy' ? 'teddy' : 'cup' }; Sfx.play('gem'); if (artOn()) Art.burst(ev.x, ev.y, '#ff8cc0', 6, false); bubbles.push({ heart: true, x: ev.x, y: ev.y - 6, t: 0, max: 45 }); }
          else if (ev.what === 'rescued' || ev.what === 'escortDone' || ev.what === 'gaugeFull') {
            Sfx.play('levelup'); if (artOn() && ev.x !== undefined) Art.burst(ev.x, ev.y, '#ff8cc0', 12, false);
            if (ev.x !== undefined && ev.what !== 'gaugeFull') { bubbles.push({ text: '만세!', x: ev.x, y: ev.y - 40, t: 0, max: 45 }); thanks(ev.x, ev.y, THANKS, 45); }   // 도와주면: 만세! → 고맙다는 말
            else if (ev.x !== undefined) thanks(ev.x, ev.y, THANKS);
          }
          else if (ev.what === 'cheer') cheerFx = { x0: ev.x, y0: ev.y - 20, t: 0 };   // 글자 대신 '공격력 업' 배지가 도와준 사람에게서 주인공에게 날아감
          else if (ev.what === 'visitGift') { Sfx.play('levelup'); thanks(ev.x, ev.y, VISIT); }
          else if (ev.what === 'allyBye') { for (let i = 0; i < 8; i++) bubbles.push({ heart: true, x: ev.x + (Math.random() - 0.5) * 34, y: ev.y + (Math.random() - 0.5) * 20, t: -i * 3, max: 50 }); if (artOn()) Art.burst(ev.x, ev.y, '#ffd84d', 10, false); }   // 하트가 반짝이며 사라짐
          else if (ev.what === 'rescueStart' || ev.what === 'escortStart' || ev.what === 'visitStart') { Sfx.play('heal'); if (ev.what === 'escortStart') escortTalk = { text: '같이 가 줄래?', t: 150 }; }
          break;
        case 'trainPass': { const em = (sim.world.rules.trains && sim.world.rules.trains.emoji) || '🚆'; Sfx.pass(ev.dir, em === '🚆' || em === '🛒', em === '🌊'); break; }
        case 'dropWarn': Sfx.play('dropWarn'); break;
        case 'dropHit': Sfx.play('dropHit'); shake = Math.max(shake, 4); if (artOn()) Art.burst(ev.x, ev.y, '#d7c7a5', 8, false); break;
        case 'train': Sfx.warn((sim.world.rules.trains && sim.world.rules.trains.emoji) || '🚆'); if (tutorial) banner = { text: ev.text || '🚆 열차 접근! 빨간 줄을 피하세요', t: 110 }; break;
        case 'phase': if (tutorial) banner = { text: `${ev.name || '보스'} ${ev.phase}페이즈`, t: 120 }; shake = 10; Sfx.play('boss'); break;
        case 'gotItem': headFlash.push({ icon: ev.icon, t: 50 }); if (headFlash.length > 3) headFlash.shift(); break;
        case 'autoPick': autoFlash.push({ id: ev.id, icon: ev.icon, t: 48 }); break;   // 자동 선택: 아이콘만 짧게 반짝 (글자·소리 없음)
        case 'synergy': toast = { text: `✨ 시너지: ${ev.name}`, t: 150 }; Sfx.play('levelup'); break;
        default: break;
      }
    }
  }

  /* ---------- 선행 그리기: 곤란한 사람 · 지켜 줄 친구 · 작은 선행 거리 ---------- */
  // 도움이 필요하다는 건 "몸짓"으로 보여 준다 (아이: 얼굴을 가리고 떪 · 어르신: 무거운 짐에 휘청 · 친구: 지도를 들고 머리를 긁적).
  // 몸짓만으로는 모자란 사정만 아주 짧은 말풍선으로, 가끔씩만.
  const NEED_SHORT = { child: '무서워요', elder: '너무 무거워요', friend: '길을 잃었어요' };
  const NEED_POSE = { child: 'cower', elder: 'carry', friend: 'lost' };
  let escortTalk = null;   // 지켜 줄 친구의 짧은 말풍선 {text, t}
  let pickAnim = null;     // 주인공이 선행 거리를 줍는 동작 {t, max, item}
  let cheerFx = null;      // 응원(공격력 업) 배지 연출 {x0, y0, t}
  let playerCheer = 0;     // 선생님께 배우고 난 뒤 주인공 만세 (프레임)
  /** 뻗는 팔의 각도(바라보는 쪽 기준, 위아래로 너무 꺾이지 않게) */
  function reachAng(fx, fy, tx, ty) { return Math.max(-1.1, Math.min(1.1, Math.atan2(ty - fy, Math.abs(tx - fx) || 1))); }
  /** 작은 말풍선: (x, y)는 꼬리 끝(말하는 사람 머리 위). 화면 밖으로 나가지 않게 좌우 보정 */
  function talkBubble(text, x, y, alpha, warn) {
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12, h = 17;
    const bx = Math.min(W - 4 - w / 2, Math.max(4 + w / 2, x)), by = y - h - 6;
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.strokeStyle = warn ? '#ff6b8a' : '#ffd84d'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - w / 2, by, w, h, 8); else ctx.rect(bx - w / 2, by, w, h);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, by + h - 0.5); ctx.lineTo(x + 4, by + h - 0.5); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = warn ? '#ff6b8a' : '#ffd84d'; ctx.beginPath(); ctx.moveTo(x - 4, by + h); ctx.lineTo(x, y); ctx.lineTo(x + 4, by + h); ctx.stroke();
    ctx.fillStyle = '#3a2a40'; ctx.fillText(text, bx, by + h / 2 + 0.5);
    ctx.restore();
  }
  /** 식은땀 방울: 머리 옆에서 흘러내린다 */
  function sweatDrop(x, y, now) {
    const k = (now / 900) % 1;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#8fd3ff';
    const dy = y + k * 10;
    ctx.beginPath(); ctx.moveTo(x, dy - 4); ctx.quadraticCurveTo(x + 3, dy, x, dy + 2.5); ctx.quadraticCurveTo(x - 3, dy, x, dy - 4); ctx.fill();
    ctx.restore();
  }
  const NPC_EMO = { child: '🧒', elder: '👵', friend: '🧑' };
  function drawNPC(useArt, kind, x, y, pose) {
    ctx.fillStyle = 'rgba(255,216,77,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 29, 14, 5.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, y + 29, 14, 5.5, 0, 0, 7); ctx.stroke();   // 노란 바닥 링 = 내 편인 사람 (적=빨강, 에코=회색, 나=초록)
    if (useArt && Art.drawPerson) return Art.drawPerson(ctx, 'npc:' + kind + (pose && pose.sad ? ':sad' : ''), x, y, pose, performance.now());
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(NPC_EMO[kind] || '🧑', x, y, 28);
    return { L: [x - 10, y + 6], R: [x + 10, y + 6] };
  }
  /** 선행 소품: 그림(Art)이 있으면 그림, 없으면 같은 모양의 선 그림(Glyphs) */
  const DEED_FALLBACK = { atkUp: '⚔', heart: '💛', heartPink: '💗', cup: '🥤', pot: '🪴', teddy: '🧸', gift: '🎁', flag: '🚩' };
  function deedArt(kind, x, y, size) {
    if (window.Art && Art.drawDeed) Art.drawDeed(ctx, kind, x, y, size); else { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(DEED_FALLBACK[kind], x, y, size); }
  }
  /** 떨어지는 위험 요소: 부정적인 마음 그림이 있으면 그 그림, 없으면(낙석 등) 그림 문자 */
  function dropArt(key, x, y, size) {
    if (window.Art && Art.drawGloom && Art.drawGloom(ctx, key, x, y, size)) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(key, x, y, size * 0.87);
  }
  /** 결과 화면용: 캔버스 그림을 작은 이미지로 */
  function deedImg(draw, w, h, dispH) {
    const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d'); g.scale(2, 2); if (window.Art) draw(g);
    const im = document.createElement('img'); im.src = c.toDataURL(); im.alt = ''; im.style.height = dispH + 'px'; im.style.verticalAlign = 'middle';
    return im;
  }
  function drawBubbles() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (escortTalk && --escortTalk.t <= 0) escortTalk = null;
    if (pickAnim && ++pickAnim.t >= pickAnim.max) pickAnim = null;
    if (playerCheer > 0) playerCheer -= 1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t += 1;
      if (b.t < 0) continue;
      if (b.t >= b.max) { bubbles.splice(i, 1); continue; }
      const k = b.t / b.max, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.globalAlpha = a;
      if (b.heart) { deedArt('heartPink', b.x + Math.sin(b.t / 6 + b.x) * 4, b.y - b.t * 0.7, 12); continue; }
      ctx.font = b.small ? 'bold 10px sans-serif' : 'bold 12px sans-serif';
      const tw = ctx.measureText(b.text).width + 14, y = b.y - b.t * 0.15;
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x - tw / 2, y - 10, tw, 20, 9) : ctx.rect(b.x - tw / 2, y - 10, tw, 20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(b.x - 4, y + 9); ctx.lineTo(b.x + 4, y + 9); ctx.lineTo(b.x, y + 15); ctx.fill();
      ctx.fillStyle = '#e8508a'; ctx.fillText(b.text, b.x, y + 1);
    }
    ctx.globalAlpha = 1;
  }
  function drawDeeds(useArt, people) {
    const d = sim.deeds; if (!d) return;
    const now = performance.now();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 작은 선행 거리: 은은한 분홍 빛 + 물건 (적보다 아래), 사람들은 적보다 위에 그려 가려지지 않게
    if (!people) for (const sp of d.spots) {
      const a = Math.min(1, sp.t / 60), pul = 0.5 + 0.5 * Math.sin(now / 260 + sp.x);
      // 줍는 물건 표시: 빨간 원(적) 대신 하늘색 빛 + 반짝이 4개가 천천히 돈다 (적·친구·에코와 다른 색)
      const gl = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, 17);
      gl.addColorStop(0, 'rgba(190,240,255,.55)'); gl.addColorStop(1, 'rgba(190,240,255,0)');
      ctx.globalAlpha = a * (0.6 + 0.4 * pul); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sp.x, sp.y, 17, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8fbff';
      for (let k = 0; k < 4; k++) {
        const ang = now / 700 + k * Math.PI / 2 + sp.x, rx = sp.x + Math.cos(ang) * 14, ry = sp.y + Math.sin(ang) * 9, r = 2.6 + 1.2 * Math.sin(now / 180 + k);
        ctx.beginPath(); ctx.moveTo(rx, ry - r); ctx.quadraticCurveTo(rx, ry, rx + r, ry); ctx.quadraticCurveTo(rx, ry, rx, ry + r); ctx.quadraticCurveTo(rx, ry, rx - r, ry); ctx.quadraticCurveTo(rx, ry, rx, ry - r); ctx.fill();
      }
      ctx.globalAlpha = a; deedArt(sp.kind === 'litter' ? 'cup' : sp.kind === 'pot' ? 'pot' : 'teddy', sp.x, sp.y, 20);
      // 지나가며 주워 달라는 표시: 위에서 통통 튀는 작은 화살표
      const ay = sp.y - 20 - Math.abs(Math.sin(now / 220 + sp.x)) * 5;
      ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.moveTo(sp.x - 5, ay - 4); ctx.lineTo(sp.x + 5, ay - 4); ctx.lineTo(sp.x, ay + 2); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!people) return;
    // 따뜻한 빛: 분홍 물결이 퍼지고 화면이 잠깐 환해진다
    for (let i = warmFx.length - 1; i >= 0; i--) {
      const w = warmFx[i], k = w.t / 50;
      if (k >= 1) { warmFx.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * 0.5; ctx.strokeStyle = '#ffb3d4'; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r * (0.2 + 0.8 * k), 0, 7); ctx.stroke();
      const gl = ctx.createRadialGradient(w.x, w.y, 4, w.x, w.y, w.r);
      gl.addColorStop(0, `rgba(255,200,225,${0.35 * (1 - k)})`); gl.addColorStop(1, 'rgba(255,200,225,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,240,220,${0.12 * (1 - k)})`; ctx.fillRect(0, 0, W, H);
      w.t += 1;
    }
    ctx.globalAlpha = 1;
    // 순해진 방해 요소: 머리 위 작은 하트
    for (const e of sim.enemies) if (e.calm > 0) { ctx.globalAlpha = Math.min(1, e.calm / 30) * 0.9; deedArt('heartPink', e.x, e.y - e.r - 6 + Math.sin(now / 200 + e.x) * 2, 10); }
    ctx.globalAlpha = 1;
    // 도와준 사람들: 고맙다고 손을 흔든 뒤 안전한 곳(화면 밖)으로 걸어서 떠난다 (싸우지 않음)
    for (const a of sim.allies) {
      // 떠나기 1초 전부터 반짝반짝 깜빡이며 흐려지고 머리 위로 하트가 피어오른다
      ctx.globalAlpha = a.t < 60 ? (a.t / 60) * (0.55 + 0.45 * Math.abs(Math.sin(now / 70))) : 1;
      if (a.t < 60 && a.t % 8 === 0) bubbles.push({ heart: true, x: a.x + (Math.random() - 0.5) * 20, y: a.y - 14, t: 0, max: 40 });
      const cheering = a.wave > 50, face = sim.player.x < a.x ? -1 : 1;
      drawNPC(useArt, a.kind, a.x, a.y - (cheering ? Math.abs(Math.sin(now / 110)) * 6 : a.wave > 0 ? Math.abs(Math.sin(now / 160)) * 2 : 0), cheering ? { name: 'cheer', dir: face } : a.wave > 0 ? { name: 'wave', dir: face } : { name: 'walk', dir: a.dir });
    }
    ctx.globalAlpha = 1;
    // 지난 판에 도와준 사람이 찾아옴
    const vs = d.visitor;
    if (vs) {
      ctx.globalAlpha = vs.state === 'come' ? 1 : Math.max(0, vs.fade / 70);
      const come = vs.state === 'come', hd = drawNPC(useArt, vs.kind, vs.x, vs.y, come ? { name: 'give', dir: sim.player.x < vs.x ? -1 : 1 } : { name: 'wave', dir: sim.player.x < vs.x ? -1 : 1 });
      if (come) deedArt('gift', (hd.L[0] + hd.R[0]) / 2, (hd.L[1] + hd.R[1]) / 2 - 4, 15);   // 두 손 사이의 선물
      ctx.globalAlpha = 1;
    }
    // 곤란한 사람: 머리 위 ❗ 말풍선 (도와주면 💛)
    const rs = d.rescue;
    if (rs) {
      ctx.globalAlpha = rs.state === 'wait' ? 1 : Math.max(0, rs.fade / 90);
      const bob = rs.state === 'done' ? -Math.abs(Math.sin(now / 160)) * 5 : 0;
      const by = rs.y - 34 + Math.sin(now / 200) * 2;
      if (rs.state === 'wait') {
        // 남은 시간: 발밑 고리가 줄어든다 (노랑 → 빨강)
        const left = Math.max(0, 1 - rs.t / (EchoSim.TUNING.deedRescueStay * TICK));
        ctx.strokeStyle = left > 0.35 ? '#ffd84d' : '#ff6b8a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(rs.x, rs.y + 29, 19, 7.5, 0, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
        // 몸짓: 아이는 얼굴을 가리고 떨고, 어르신은 무거운 짐에 휘청, 친구는 지도를 들고 두리번.
        // 내가 가까이 오면 나를 향해 손을 뻗는다 (도움을 받는 중)
        const p = sim.player, near = Math.hypot(p.x - rs.x, p.y - rs.y) < 110, face = p.x < rs.x ? -1 : 1;
        let pose, ox = 0, oy = 0;
        if (near) pose = { name: 'reach', sad: true, dir: face, ang: reachAng(rs.x, rs.y, p.x, p.y) };
        else {
          pose = { name: NEED_POSE[rs.kind] || 'lost', sad: true, dir: rs.kind === 'friend' ? (Math.floor(now / 1300) % 2 ? -1 : 1) : face };
          if (rs.kind === 'child') ox = Math.sin(now / 35) * 1.1;                 // 부들부들
          if (rs.kind === 'elder') { ox = Math.sin(now / 260) * 1.6; oy = Math.abs(Math.sin(now / 260)) * 1.5; }   // 휘청휘청
        }
        drawNPC(useArt, rs.kind, rs.x + ox, rs.y + oy, pose);
        if (!near && rs.kind !== 'child') sweatDrop(rs.x - 12 * pose.dir, rs.y - 14, now);   // 식은땀
        // 몸짓만으로 모자란 사정만 짧게: 처음 2초 + 5초마다 1.3초
        if (!near && (rs.t < 120 || rs.t % 300 < 80)) talkBubble(NEED_SHORT[rs.kind] || '도와주세요', rs.x, by + 4, 1, true);
      } else {
        if (rs.state !== 'done') drawNPC(useArt, rs.kind, rs.x, rs.y + bob, { name: 'walk', dir: rs.x < W / 2 ? -1 : 1 });   // 구했으면 '도와준 사람'이 이어서 만세·인사
        else deedArt('heart', rs.x, by - 14, 18);
      }
      ctx.globalAlpha = 1;
    }
    // 친구: 체력 막대 + 도착 깃발. 멀어지면 멈춰 서서 손짓(…)
    const es = d.escort;
    if (es) {
      ctx.globalAlpha = es.state === 'walk' ? 1 : Math.max(0, es.fade / 90);
      if (es.state === 'walk') {
        ctx.globalAlpha *= 0.5 + 0.3 * Math.sin(now / 300); deedArt('flag', es.goal, es.y - 10, 22); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,216,77,.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(es.x, es.y + 16); ctx.lineTo(es.goal, es.y + 16); ctx.stroke(); ctx.setLineDash([]);
      }
      const step = es.state === 'walk' && !es.waiting ? Math.abs(Math.sin(now / 140)) * 2 : 0;
      if (es.inv > 0 && Math.floor(es.inv / 4) % 2) ctx.globalAlpha *= 0.4;
      let fpose;
      if (es.state === 'walk') {
        const p = sim.player, dpx = p.x - es.x, ahead = dpx * es.dir >= -6, d2 = Math.hypot(dpx, p.y - es.y);
        if (es.inv > 0) fpose = { name: 'hurt', sad: true, dir: es.dir };                        // 맞아서 머리를 감싼다
        else if (es.waiting) fpose = { name: 'beckon', sad: true, dir: dpx < 0 ? -1 : 1 };                   // 멈춰 서서 이리 오라고 손짓
        else if (d2 < 75 && ahead) fpose = { name: 'walkHold', dir: es.dir, ang: reachAng(es.x, es.y, p.x, p.y) };   // 손잡고 함께 걷기
        else fpose = { name: 'walk', dir: es.dir };
      } else fpose = es.state === 'done' ? { name: 'cheer' } : { name: 'cower' };
      if (es.state !== 'done') drawNPC(useArt, 'friend', es.x + (es.inv > 20 ? Math.sin(now / 25) * 1.6 : 0), es.y - step, fpose);   // 무사히 도착하면 '도와준 사람'이 이어서 만세·인사   // 맞으면 움찔움찔
      ctx.globalAlpha = es.state === 'walk' ? 1 : Math.max(0, es.fade / 90);
      if (es.state === 'walk') {
        const w = 26, f = Math.max(0, es.hp / es.maxhp);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(es.x - w / 2, es.y - 30, w, 4);
        ctx.fillStyle = f > 0.4 ? '#7dffb2' : '#ffd84d'; ctx.fillRect(es.x - w / 2, es.y - 30, w * f, 4);
        if (escortTalk && escortTalk.t > 0) talkBubble(escortTalk.text, es.x, es.y - 34, Math.min(1, escortTalk.t / 20), escortTalk.text === '아야!');
        else if (es.waiting && Math.floor(now / 2200) % 2 === 0) talkBubble('같이 가!', es.x, es.y - 34, 1, true);   // 손짓에 짧게만 덧붙임
      } else if (es.state === 'done') deedArt('heart', es.x, es.y - 34, 18);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 게임 상태 ---------- */
  let playerEmoji = '🧑‍🎓';
  let sim = null, state = 'menu';   // menu | play | paused | levelup | end
  let tutorial = false;             // 지금 판이 튜토리얼(에코 10명과 함께하는 체험)인지
  let tipIdx = 0;
  let acc = 0, last = 0;

  function resize() {
    const st = $('stage'), k = Math.min(innerWidth / W, innerHeight / H);
    st.style.width = Math.floor(W * k) + 'px'; st.style.height = Math.floor(H * k) + 'px';
    const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  }
  addEventListener('resize', resize); resize();

  /** @param opts {tutorial?:boolean}  튜토리얼은 미리 만든 에코 10명과 학교 월드에서 한다. 내 에코 기록·학점에는 반영하지 않는다. */
  function startRun(opts) {
    Sfx.unlock(); Sfx.play('click');
    tutorial = !!(opts && opts.tutorial === true);
    tipIdx = 0;
    let clearedEchoes = 0;
    if (tutorial) {
      const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
      sim = new Sim({ seed, echoes: EchoTutorial.makeTutorialEchoes(seed), bonus: GameUI.bonus(), world: EchoTutorial.TUTORIAL_WORLD });
    } else {
      runCount += 1;
      clearedEchoes = syncEchoes(GameUI.worldId());
      sim = new Sim({ seed: (Date.now() ^ (runCount * 2654435761)) >>> 0, echoes, bonus: GameUI.bonus(), world: GameUI.worldId(), cycle: GameUI.cycle(), visitor: GameUI.takeVisitor() });
    }
    playerEmoji = GameUI.emoji();
    if (window.Art) { if (Art.setLook) Art.setLook(GameUI.look()); if (Art.setColor) Art.setColor(GameUI.kidColor()); if (Art.setSkin) Art.setSkin(GameUI.kidSkin()); if (Art.setHair) Art.setHair(GameUI.kidHair()); if (Art.setEchoForm) Art.setEchoForm(GameUI.echoForm()); Art.setOutfit(GameUI.outfitCycle()); }   // 회차별 복장 (에코도 같은 옷)
    state = 'play'; acc = 0; last = performance.now();
    shake = 0; hurtFlash = 0; edgeFlash = 0; floats = []; headFlash = []; autoFlash = []; bossFx = null; slowmo = 0; whiteFlash = 0; bubbles = []; warmFx = []; escortTalk = null; pickAnim = null; playerCheer = 0; tipFreeze = 0; cheerFx = null;
    const needE = sim.world.boss.needEchoes;
    if (!tutorial && echoes.length < needE) toast = { text: `👻 큰 도전엔 에코 ${needE}명 이상 권장 (지금 ${echoes.length}명)`, t: 240 };
    banner = { text: clearedEchoes ? `${sim.world.emoji} ${sim.world.name} · 에코는 새로 시작해요` : `${sim.world.emoji} ${sim.world.name}`, t: 140 }; banner.t = 0; toast.t = 0;
    ['start', 'levelup', 'end', 'tutorial', 'pause'].forEach((id) => $(id).classList.add('hidden'));
    $('again').innerHTML = Icons.svg('retry') + '<span>한 판만 더</span>';
    Music.play(sim.world.id);   // 월드별 배경음악 (보스가 나오면 frame에서 보스 곡으로 전환)
    if (tutorial) banner = { text: '📘 튜토리얼 · 과거의 나 10명과 함께!', t: 150 };
  }

  /** 튜토리얼 안내 문구를 시간에 맞춰 띄운다 */
  const TIP_FREEZE = 60;   // 튜토리얼 설명이 뜰 때 게임을 멈추는 시간(프레임, 약 1초). 느려지지 않고 딱 멈췄다가 그대로 이어감
  let tipFreeze = 0;
  function tutorialTips() {
    const tips = EchoTutorial.TIPS;
    while (tipIdx < tips.length && sim.tick >= tips[tipIdx].sec * TICK) { toast = { text: tips[tipIdx].text, t: 270 }; tipIdx++; tipFreeze = TIP_FREEZE; }   // 새 설명이 뜨면 잠깐 멈춤
  }

  /* ---------- 일시정지 ---------- */
  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused'; endDrag(); Music.pause(); for (const k in keys) keys[k] = false;
    $('pauseInfo').textContent = tutorial ? '튜토리얼 중이에요' : `${sim.world.emoji} ${sim.world.name} · ${Math.floor(sim.tick / TICK)}초 · Lv ${sim.player.level}`;
    $('quit').textContent = '🏳️ 그만하고 메뉴로'; quitArmed = false;
    $('pause').classList.remove('hidden');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    $('pause').classList.add('hidden');
    state = 'play'; last = performance.now(); acc = 0; Music.resume();
  }
  let quitArmed = false;
  function quitRun() {
    // 한 번 더 눌러야 그만둔다 (실수 방지). 그만둔 판은 에코·학점에 반영되지 않는다.
    if (!quitArmed) { quitArmed = true; $('quit').textContent = '⚠ 한 번 더 누르면 이번 판은 기록되지 않아요'; return; }
    quitArmed = false;
    if (tutorial) GameUI.finishTutorial();
    tutorial = false; sim = null; state = 'menu'; Music.stop();
    $('pause').classList.add('hidden'); $('start').classList.remove('hidden'); GameUI.refresh();
  }
  $('pauseBtn').onclick = () => { Sfx.play('click'); pauseGame(); };
  $('resume').onclick = () => { Sfx.play('click'); quitArmed = false; resumeGame(); };
  $('quit').onclick = () => { Sfx.play('click'); quitRun(); };
  // 앱을 내리거나 다른 창으로 가면 자동으로 일시정지 (전화·알림 등)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  addEventListener('blur', () => pauseGame());

  /* ---------- 레벨업·조언 카드: 게임을 멈추지 않는 작은 카드 (화면 위) ---------- */
  let shownChoices = null;
  function pickCard(i) {
    if (!sim || !sim.choices || !sim.choices[i] || state !== 'play') return;
    Sfx.play('click'); sim.choose(sim.choices[i].id); handleEvents(); updateCards();
  }
  function updateCards() {
    const box = $('cards');
    const ch = state === 'play' || state === 'paused' ? (sim && sim.choices) : null;
    if (ch !== shownChoices) {
      shownChoices = ch;
      box.innerHTML = '';
      if (ch) {
        const stats = sim.player.stats;
        const title = document.createElement('div'); title.className = 'ctitle' + (tutorial ? '' : ' hidden');
        title.textContent = sim.choiceKind === 'helper' ? `${sim.world.helper.emoji} ${sim.world.helper.name}의 조언 · 톡 눌러 고르기` : sim.choiceKind === 'deed' ? '💛 고마워! 선물을 골라요' : '🌱 성장! 톡 눌러 고르기 (안 고르면 자동)';
        box.appendChild(title);
        const row = document.createElement('div'); row.className = 'crow';
        ch.forEach((u, i) => {
          const b = document.createElement('button'); b.className = 'mini' + (u.boon ? ' boon' : '') + (u.deed ? ' deed' : '');
          // 처음 얻는 아이템은 무슨 효과인지, 가진 아이템은 레벨 변화를 보여 준다
          const lv = (u.instant || !(u.id in stats) || !stats[u.id]) ? '' : `Lv${stats[u.id]}→${stats[u.id] + 1}`;
          const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = u.icon;
          const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = u.name;
          b.title = u.desc;
          b.append(ic, nm);
          if (lv) { const ds = document.createElement('small'); ds.textContent = lv; b.appendChild(ds); }
          // 카드는 조작 영역에 있으므로: 톡 누르고 떼면 선택, 누른 채 움직이면(12px 이상) 선택하지 않고 이동(드래그)으로 바꾼다
          let press = null;
          b.addEventListener('pointerdown', (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            if (drag) { pickCard(i); return; }            // 다른 손가락으로 이동 중이면 바로 선택
            try { b.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
            press = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false };
          });
          b.addEventListener('pointermove', (ev) => {
            if (!press || ev.pointerId !== press.id) return;
            if (!press.moved && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 12) {
              press.moved = true;
              const st = toLogical({ clientX: press.x, clientY: press.y });
              drag = { ax: st.x, ay: st.y, px: st.x, py: st.y };
            }
            if (press.moved) dragMove(ev);
          });
          const release = (ev, ok) => {
            if (!press || ev.pointerId !== press.id) return;
            const wasDrag = press.moved; press = null;
            if (wasDrag) endDrag(); else if (ok) pickCard(i);
          };
          b.addEventListener('pointerup', (ev) => release(ev, true));
          b.addEventListener('pointercancel', (ev) => release(ev, false));
          row.appendChild(b);
        });
        box.appendChild(row);
        const bar = document.createElement('div'); bar.className = 'ctime'; bar.appendChild(document.createElement('i'));
        box.appendChild(bar);
      }
      box.classList.toggle('hidden', !ch);
    }
    if (ch) box.querySelector('.ctime > i').style.width = Math.max(0, 100 - sim.choiceT / (EchoSim.TUNING.choiceAutoSec * TICK) * 100) + '%';
  }


  /** 결과 화면의 따뜻한 한마디 (실패해도 괜찮고, 도움을 청하는 건 좋은 일) */
  function cheerMessage(result, helped, echoCount) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (helped) return pick(['도움을 청한 건 용기 있는 선택이었어요 🙋', '함께하면 더 멀리 갈 수 있어요 💛', '도움을 받는 것도 실력이에요']);
    if (result === 'clear') return pick(['혼자가 아니었어요. 과거의 나도 함께했어요 💛', '큰 도전을 해냈어요. 정말 잘했어요!', '차근차근 해낸 만큼 성장했어요 🌱']);
    if (result === 'survive') return pick(['끝까지 버틴 끈기가 멋져요!', '한 번만 더 도전하면 넘을 수 있어요']);
    return pick(['넘어져도 괜찮아요. 방금의 나는 에코가 되어 다음 판을 도와요 👻', '실패는 배움의 일부예요. 조금씩 나아지고 있어요 🌱', '선생님께 도움을 청해 보는 건 어때요? 🙋']);
  }

  /** 튜토리얼 결과 화면: 에코·학점에 반영하지 않고, 이제 내 에코를 0명부터 쌓는다는 걸 알려준다 */
  function showTutorialEnd() {
    state = 'end'; Music.stop();
    GameUI.finishTutorial();
    tutorial = false;
    Sfx.play(sim.result === 'dead' ? 'lose' : 'win');
    $('endTitle').textContent = sim.result === 'clear' ? `${sim.world.boss.name} 극복! 🎉` : '튜토리얼 끝!';
    $('endBadge').textContent = sim.result === 'clear' ? '🏆 승리!' : '📘 튜토리얼 끝'; $('endBadge').style.background = sim.result === 'clear' ? '#1f9d63' : '#4a5bd6';
    $('endEchoes').textContent = '👻 에코 10명';
    $('stats').innerHTML = `생존 ${(sim.tick / TICK).toFixed(0)}초 · 물리친 방해 ${sim.kills} · Lv ${sim.player.level}`;
    $('reward').innerHTML = '';
    [   // 메뉴 안내: 실제 메뉴 이름 그대로
      '방금 함께 싸운 10명은 연습용 "과거의 나"였어요. 이제 진짜 내 에코를 0명부터 쌓아요.',
      '🗺️ 월드: 왕을 넘으면 다음 월드가 열려요. 월드를 바꾸면 에코는 그 월드에서 새로 모아요.',
      '🏪 상점: 학점으로 기본 강화와 월드 장비를 사요. 뒤 월드일수록 장비가 더 필요해요.',
      '👕 내 캐릭터: 캐릭터를 고르고, 지금까지 얻은 복장 중에서 골라 입어요.',
      '🔁 12개 월드를 모두 넘으면 다음 회차가 열리고 새 복장 장식을 얻어요.',
    ].forEach((t) => { const d = document.createElement('div'); d.textContent = t; d.className = 'wide'; $('reward').appendChild(d); });
    $('cheer').textContent = `👻 ${sim.world.name}의 왕은 에코 ${sim.world.boss.needEchoes}명이 모이면 넘을 수 있어요. 시작 버튼 아래 "👻 에코 0 / ${sim.world.boss.needEchoes}명"을 확인해 보세요!`;
    $('again').innerHTML = Icons.svg('play') + '<span>이제 진짜 시작!</span>';
    $('end').classList.remove('hidden');
  }

  function showEnd() {
    if (tutorial) { showTutorialEnd(); return; }
    state = 'end'; Music.stop();
    const out = sim.exportEcho();
    echoes = addEcho(echoes, out, MAX_ECHOES).list; echoWorld = sim.world.id;
    save();
    const lastBoss = sim.bossLineup[sim.bossLineup.length - 1];
    // 승리/패배를 한눈에: 큰 배지(색) + 이유 한 줄
    const left = sim.bossCount - sim.bossDefeated;
    const badge = { clear: ['🏆 승리!', '#1f9d63'], survive: ['⏱ 시간 초과 · 패배', '#d9822b'], dead: ['💔 패배', '#c0394b'] }[sim.result];
    const title = { clear: `${lastBoss.name} 극복! 🎉`, survive: `왕 ${left}번을 못 넘었어요 (🏁 ${sim.bossDefeated}/${sim.bossCount})`, dead: '쓰러졌어요… 다음엔 에코와 함께!' }[sim.result];
    Sfx.play(sim.result === 'clear' ? 'win' : 'lose');
    $('endBadge').textContent = badge[0]; $('endBadge').style.background = badge[1];
    $('endTitle').textContent = title;
    $('endEchoes').textContent = `👻 에코 ${echoes.length}/${MAX_ECHOES}명`;
    $('cheer').textContent = cheerMessage(sim.result, sim.helped, sim.echoes.length);   // 따뜻한 한마디 한 줄
    // 본 게임 결과는 짧게: 핵심 숫자만 (자세한 설명은 튜토리얼에서)
    $('stats').textContent = `⏱ ${(sim.tick / TICK).toFixed(0)}초 · ☠ ${sim.kills} · Lv ${sim.player.level}` + (sim.bossCount > 1 ? ` · 🏁 ${sim.bossDefeated}/${sim.bossCount}` : '');
    // 학점 · 도전 과제 · 일일 미션
    const dd = sim.deeds;
    const sum = GameUI.recordRun({ kills: sim.kills, seconds: Math.floor(sim.tick / TICK), level: sim.player.level, result: sim.result, gems: sim.gemCount, echoes: sim.echoes.length, world: sim.world.id, helped: sim.helped,
      deeds: { people: dd.people.slice(), escorts: dd.escorts, spots: dd.spotCount } });
    const lines = [`🎓 학점 +${Meta.fmtNum(sum.earned)}`];
    // 오늘의 선행: 도운 사람들의 얼굴 + 작은 선행 수
    if (dd.people.length || dd.spotCount) {
      lines.push({ deed: true, people: dd.people.slice(), text: `${dd.people.length ? '도운 사람 ' + dd.people.length + '명' : ''}${dd.people.length && dd.spotCount ? ' · ' : ''}${dd.spotCount ? '작은 선행 ' + dd.spotCount + '개' : ''}` });
    }
    if (sum.newTitle) lines.push(`${sum.newTitle.icon} 새 칭호: ${sum.newTitle.name}`);
    for (const a of sum.newAch) lines.push(`🏆 ${a.name} +${a.reward}`);
    for (const m of sum.missionsDone) lines.push(`🎯 +${m.reward}`);
    if (sum.newWorld) { const w = EchoSim.WORLDS[sum.newWorld]; lines.push(`🔓 ${w.emoji} ${w.name}`); }
    $('nextCycle').style.display = 'none'; $('nextWorld').style.display = 'none';
    // 왕을 넘었고 다음 월드가 열려 있으면: 바로 다음 월드로 가는 버튼 (마지막 월드는 '다음 회차' 버튼이 대신)
    const order = EchoSim.WORLD_ORDER, nextId = order[order.indexOf(sim.world.id) + 1];
    if (sim.result === 'clear' && nextId && Meta.worldUnlocked(GameUI.save, nextId)) {
      const nw = EchoSim.WORLDS[nextId], nb = $('nextWorld');
      nb.style.display = ''; nb.innerHTML = `▶ 다음 월드: ${nw.emoji} ${nw.name}<small style="display:block;font-size:11px;font-weight:400;opacity:.85">에코는 새 월드에서 0명부터 · 권장 에코 ${nw.boss.needEchoes}명</small>`;
      nb.onclick = () => { if (GameUI.selectWorld(nextId)) { nb.style.display = 'none'; startRun(); } };
    }
    if (sum.newCycle !== null && sum.newCycle !== undefined) {
      lines.push(`🔓 ${sum.newCycle + 1}회차가 열렸어요!`);
      const nb = $('nextCycle'); nb.style.display = ''; nb.textContent = `🔁 ${sum.newCycle + 1}회차로 넘어가기 ▶`;
      nb.onclick = () => { Sfx.play('levelup'); GameUI.selectCycle(sum.newCycle); nb.style.display = 'none'; $('toMenu').onclick(); };
      const of = EchoWorlds.outfitOf(sum.newCycle);
      lines.push(of.tier === 0 ? `👕 새 복장: ${of.name}` : `👕 ${of.name} ${'★'.repeat(of.stars)} 장식 추가`);
    }
    if (sim.result !== 'clear') {   // 다음 판을 위한 짧은 처방: 에코 수 · 장비
      const need = sim.world.boss.needEchoes;
      if (echoes.length < need) lines.push(`👻 에코 ${echoes.length}/${need}명 · ${need - echoes.length}판 더 하면 에코가 모여요`);
      const short = GameUI.gearShort(sim.world.id);
      if (short) lines.push(`🧰 장비 부족: ${short.atk ? `⚔ 공격 ${short.atk}레벨 ` : ''}${short.def ? `🛡 방어 ${short.def}레벨 ` : ''}더 필요 (상점)`);
    }
    $('reward').innerHTML = '';
    lines.forEach((t) => {
      const d = document.createElement('div');
      if (t && t.deed) {   // 오늘의 선행: 그린 하트 + 도운 사람들 얼굴 그림
        d.className = 'wide deedchip';
        d.appendChild(deedImg((g) => Art.drawDeed(g, 'heart', 12, 12, 22), 24, 24, 20));
        for (const k of t.people.slice(0, 8)) d.appendChild(deedImg((g) => Art.drawHelper(g, 'npc:' + k, 18, 30), 36, 60, 34));
        const sp = document.createElement('span'); sp.textContent = t.text; d.appendChild(sp);
      } else { d.textContent = t; if (t.length > 18) d.className = 'wide'; }
      $('reward').appendChild(d);
    });   // 짧은 결과는 한 줄에 2~3개, 긴 안내는 한 줄 전체   // 짧은 결과는 한 줄에 2~3개, 긴 안내는 한 줄 전체
    if (sum.newAch.length || sum.missionsDone.length || sum.newWorld || sum.newCycle !== null || sum.newTitle) Sfx.play('levelup');
    $('end').classList.remove('hidden');
  }

  $('go').onclick = () => startRun(); $('again').onclick = () => startRun();
  $('bTutorial').onclick = () => startRun({ tutorial: true });
  $('tStart').onclick = () => startRun({ tutorial: true });
  $('tSkip').onclick = () => { Sfx.unlock(); Sfx.play('click'); GameUI.finishTutorial(); $('tutorial').classList.add('hidden'); $('start').classList.remove('hidden'); };
  // 처음 실행이면 튜토리얼 안내부터
  if (!GameUI.tutorialDone()) { $('start').classList.add('hidden'); $('tutorial').classList.remove('hidden'); }
  $('toMenu').onclick = () => { $('end').classList.add('hidden'); $('start').classList.remove('hidden'); GameUI.refresh(); state = 'menu'; };
  let resetArmed = false;   // 실수로 누르지 않게 두 번 눌러야 초기화
  const resetBtn = $('reset');   // 백업 화면 안으로 옮겨 다니므로 처음에 잡아 둔다
  resetBtn.onclick = () => {
    const label = (t) => { resetBtn.innerHTML = Icons.svg('trash') + `<span>${t}</span>`; };
    if (!resetArmed) { resetArmed = true; label(`에코 ${echoes.length}명 지우기? 한 번 더`); setTimeout(() => { resetArmed = false; label('에코 기록 초기화'); }, 3000); return; }
    resetArmed = false; echoes = []; runCount = 0; save(); label('초기화됨'); GameUI.refresh();
  };
  const muteIcon = () => {
    $('mute').innerHTML = Icons.svg(Sfx.isMuted() ? 'soundOff' : 'soundOn', 17);
    $('bMusic').innerHTML = `<span>🎵 배경음악: ${Sfx.musicOn() ? '켜짐' : '꺼짐'}</span>`; $('bMusic').style.opacity = Sfx.musicOn() ? 1 : 0.55;
    $('bSfx').innerHTML = `<span>🔔 효과음: ${Sfx.sfxOn() ? '켜짐' : '꺼짐'}</span>`; $('bSfx').style.opacity = Sfx.sfxOn() ? 1 : 0.55;
  };
  $('mute').onclick = () => { Sfx.setMuted(!Sfx.isMuted()); muteIcon(); };   // 위 버튼: 전체 켜기/끄기
  $('bMusic').onclick = () => { Sfx.setMusic(!Sfx.musicOn()); muteIcon(); };
  $('bSfx').onclick = () => { Sfx.setSfx(!Sfx.sfxOn()); Sfx.play('click'); muteIcon(); };
  Icons.apply(); muteIcon(); resetBtn.innerHTML = Icons.svg('trash') + '<span>에코 기록 초기화</span>'; $('again').innerHTML = Icons.svg('retry') + '<span>한 판만 더</span>';

  /* ---------- 렌더 ---------- */
  /** 화면 폭(W-16)에 맞게 글자 크기를 줄여서 가운데 정렬로 그린다 */
  function fitText(text, x, y, size) {
    ctx.font = `bold ${size}px sans-serif`;
    const w = ctx.measureText(text).width, maxW = W - 16;
    if (w > maxW) ctx.font = `bold ${Math.max(10, Math.floor(size * maxW / w))}px sans-serif`;
    ctx.fillText(text, x, y);
  }
  function emoji(ch, x, y, size) { ctx.font = `${size}px serif`; ctx.fillText(ch, x, y); }

  /** 보스가 터지는 순간: 큰 파편 + 여러 색 색종이 + 흰 번쩍임 */
  function bossBoom() {
    const f = bossFx; if (!f) return;
    shake = Math.max(shake, 16); whiteFlash = 1;
    if (window.Art) {
      Art.burst(f.x, f.y, Art.enemyColor('boss', f.name), 40, true);
      for (const col of ['#ffe14d', '#ff6b9a', '#7fdcff', '#7dffb2', '#c9a0ff']) Art.burst(f.x, f.y, col, 9, true);
    }
    banner = { text: `✨ ${f.name} 극복!`, t: 120 };
  }
  /** 보스 극복 연출 그리기 */
  function drawBossFx(now) {
    const f = bossFx, t = f.t;
    ctx.save();
    if (t < 30) {
      // 1) 빛줄기가 돌고, 보스가 부들부들 떨며 부풀어 오르고 하얗게 달아오름
      const k = t / 30;
      ctx.translate(f.x, f.y); ctx.rotate(now / 400);
      ctx.globalAlpha = 0.25 + 0.45 * k; ctx.fillStyle = '#fff6c2';
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -f.r * (1.6 + k * 2.2)); ctx.lineTo(7, -f.r * (1.6 + k * 2.2)); ctx.closePath(); ctx.fill(); }
      ctx.restore(); ctx.save();
      const sc = 1 + k * 0.35, jx = (Math.random() - 0.5) * 4 * k, jy = (Math.random() - 0.5) * 4 * k;
      const ghost = { x: f.x + jx, y: f.y + jy, r: f.r * sc, type: 'boss', name: f.name, def: { name: f.name }, flash: t % 6 < 3 ? 1 : 0, warn: false };
      if (artOn() && Art.hasEnemy(ghost)) Art.drawEnemy(ctx, ghost, now, f.x);
      else { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(f.emoji || '💥', ghost.x, ghost.y, f.r * 2 * sc); }
      ctx.globalAlpha = k * 0.8; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * sc * 0.9, 0, 7); ctx.fill();
    } else {
      // 2) 터진 뒤: 충격파 고리 3겹 + 가운데 빛 번짐
      const k = (t - 30) / (BOSS_FX_LEN - 30);
      for (let i = 0; i < 3; i++) {
        const kk = Math.max(0, k - i * 0.12); if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = (1 - kk) * 0.9; ctx.strokeStyle = i === 1 ? '#7fdcff' : '#ffe14d'; ctx.lineWidth = 6 * (1 - kk) + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + kk * 260, 0, 7); ctx.stroke();
      }
      const gl = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
      gl.addColorStop(0, `rgba(255,250,210,${0.8 * (1 - k)})`); gl.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gl; ctx.fillRect(f.x - f.r * 3, f.y - f.r * 3, f.r * 6, f.r * 6);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function render() {
    const sc = cv.width / W;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(sc, 0, 0, cv.height / H, sx * sc, sy * sc);
    const th = (sim ? sim.world : EchoSim.WORLDS[GameUI.worldId()]).theme;
    const useArt = artOn();
    if (useArt) Art.drawBackground(ctx, W, H, (sim ? sim.world : EchoSim.WORLDS[GameUI.worldId()]).id); else {
    ctx.fillStyle = th.bg; ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    if (th.deco === 'ruled') {            // 학원: 공책 줄무늬
      for (let y = 20; y <= H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,90,120,.18)'; ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(36, H); ctx.stroke();
    } else if (th.deco === 'tiles') {     // 회사: 사무실 타일
      for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.018)';
      for (let x = 0; x < W; x += 80) for (let y = 0; y < H; y += 80) ctx.fillRect(x, y, 40, 40);
      for (let x = 40; x < W; x += 80) for (let y = 40; y < H; y += 80) ctx.fillRect(x, y, 40, 40);
    } else if (th.deco === 'rails') {     // 지하철: 레일 두 줄 + 침목
      for (let y = 60; y <= H; y += 100) {
        ctx.strokeStyle = 'rgba(190,200,210,.16)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y - 6); ctx.lineTo(W, y - 6); ctx.moveTo(0, y + 6); ctx.lineTo(W, y + 6); ctx.stroke();
        ctx.strokeStyle = 'rgba(150,120,90,.14)'; ctx.lineWidth = 4;
        for (let x = 8; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke(); }
      }
    } else if (th.deco === 'stars') {     // 집·무대: 밤하늘 별
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = (i * 193) % H, tw = 0.5 + 0.5 * Math.sin(performance.now() / 600 + i); ctx.globalAlpha = 0.3 + 0.5 * tw; ctx.fillRect(x, y, 2, 2); }
      ctx.globalAlpha = 1;
    } else if (th.deco === 'waves') {     // 바닷가: 물결
      for (let y = 30; y <= H; y += 40) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) { const yy = y + Math.sin(x / 22 + performance.now() / 700 + y) * 4; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
        ctx.stroke();
      }
    } else if (th.deco === 'diag') {      // 산: 비탈 사선
      for (let x = -H; x <= W; x += 34) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H * 0.6, 0); ctx.stroke(); }
    } else {                              // 학교: 격자
      for (let x = 0; x <= W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    }
    if (!sim) return;
    const now = performance.now();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (const g of sim.gems) {
      if (g.kind === 'coffee') {
        if (useArt) Art.drawDrop(ctx, g, sim.world.rules.dropEmoji || '☕', now);
        else { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(sim.world.rules.dropEmoji || '☕', g.x, g.y, 15); }
        continue;
      }
      if (useArt) { Art.drawGem(ctx, g, now); continue; }
      ctx.fillStyle = '#7dffb2'; ctx.beginPath(); ctx.arc(g.x, g.y, 3.2, 0, 7); ctx.fill();
    }
    // 열차 (경고 줄 → 질주)
    for (const h of sim.hazards) {
      if (h.kind === 'drop') {   // 떨어지는 물건: 빨간 원(점점 진해짐) + 위에서 떨어지는 그림자·물건 → 쿵
        const em = (sim.world.rules.drops && sim.world.rules.drops.emoji) || '📦';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (h.state === 'warn') {
          const k = h.t / h.warn;
          ctx.fillStyle = `rgba(255,60,80,${0.12 + 0.25 * k})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(255,170,170,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1 - k) + 2, 0, 7); ctx.stroke();   // 좁혀 오는 원 = 남은 시간
          ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`; ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 6 + 12 * k, 3 + 5 * k, 0, 0, 7); ctx.fill();
          if (k > 0.45) { const fall = (1 - k) / 0.55; dropArt(em, h.x, h.y - fall * 160, 30); }
        } else {
          const k = h.t / 18;
          ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd7a0'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.6 + 0.6 * k), 0, 7); ctx.stroke();
          ctx.globalAlpha = Math.min(1, 1.6 - k); dropArt(em, h.x, h.y, 30); ctx.globalAlpha = 1;
        }
        continue;
      }
      if (h.state === 'warn') {
        const k = h.t / h.warn, blink = 0.35 + 0.3 * Math.sin(h.t * 0.5);
        ctx.fillStyle = `rgba(255,60,80,${blink * (0.5 + 0.5 * k)})`; ctx.fillRect(0, h.y - h.h / 2, W, h.h);
        ctx.strokeStyle = 'rgba(255,200,200,.8)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(0, h.y - h.h / 2); ctx.lineTo(W, h.y - h.h / 2); ctx.moveTo(0, h.y + h.h / 2); ctx.lineTo(W, h.y + h.h / 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px sans-serif';
        ctx.fillText(h.dir > 0 ? '▶ ▶ ▶' : '◀ ◀ ◀', W / 2, h.y);
      } else if (useArt) {
        Art.drawHazard(ctx, h, (sim.world.rules.trains && sim.world.rules.trains.emoji) || '🚆', now);
      } else {
        const hx = h.x, hy = h.y;
        ctx.fillStyle = '#c9d3dc'; ctx.fillRect(hx - 70, hy - 20, 140, 40);
        ctx.fillStyle = '#2a3340'; for (let k = -2; k <= 2; k++) ctx.fillRect(hx + k * 26 - 8, hy - 12, 16, 12);
        ctx.fillStyle = '#e53950'; ctx.fillRect(hx - 70, hy + 10, 140, 6);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji((sim.world.rules.trains && sim.world.rules.trains.emoji) || '🚆', hx + h.dir * 62, hy, 30);
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // 에코 = 내 편: 회색 원 + 회색 테두리 유령 (적은 빨간 테두리라 한눈에 구분)
    for (const ec of sim.echoes) {
      if (!ec.alive || ec.down > 0) continue;   // 에너지가 떨어져 사라진 동안은 그리지 않음
      // 흐리게: 내 캐릭터·적보다 눈에 덜 띄도록 (회색 테두리는 남겨 적과 구분). 맞으면 잠깐 깜빡임
      const hit = ec.inv > 0 && Math.floor(ec.inv / 4) % 2 === 0 ? 0.5 : 1;
      if (useArt) { Art.drawEcho(ctx, ec, playerEmoji, now, 0.3 * hit); continue; }   // 새 그림체: 과거의 나 모습의 유령
      ctx.globalAlpha = 0.07 * hit;
      ctx.fillStyle = '#aab0bd'; ctx.beginPath(); ctx.arc(ec.x, ec.y, 12, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.32 * hit;
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ec.x, ec.y, 12, 0, 7); ctx.stroke();
      ctx.globalAlpha = 0.24 * hit; emoji('👻', ec.x, ec.y + 1, 16);
      ctx.globalAlpha = 1;
    }

    // 도우미(선생님 등): 빛나는 상담 구역 + 게이지. 가까이 가서 잠시 머물면 조언 카드를 받는다
    if (sim.helper) {
      const hp = sim.helper, bob = Math.sin(performance.now() / 300) * 2;
      const fadeA = hp.state === 'wait' ? 1 : Math.min(1, Math.max(0, hp.fade / 25));   // 배운 뒤엔 손을 흔들며 인사하고 천천히 사라짐
      ctx.globalAlpha = fadeA;
      const glow = ctx.createRadialGradient(hp.x, hp.y, 4, hp.x, hp.y, hp.r + 8);
      glow.addColorStop(0, 'rgba(255,225,120,.35)'); glow.addColorStop(1, 'rgba(255,225,120,.05)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r + 8, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,120,.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (sim.helperShield && sim.helperShield()) {   // 보호 중: 구역 테두리가 또렷한 금빛 막으로 (적 탄을 막아 줌)
        ctx.globalAlpha = fadeA * (0.55 + 0.25 * Math.sin(performance.now() / 180)); ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r, 0, 7); ctx.stroke(); ctx.globalAlpha = fadeA;
      }
      if (hp.prog > 0 && hp.state === 'wait') {
        ctx.strokeStyle = '#7dffb2'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r - 5, -Math.PI / 2, -Math.PI / 2 + (hp.prog / hp.need) * Math.PI * 2); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const pl = sim.player, inZone = Math.hypot(pl.x - hp.x, pl.y - hp.y) < hp.r + pl.r, tface = pl.x < hp.x ? -1 : 1;
      const tpose = hp.state === 'wait' ? (inZone ? { name: 'teach', dir: tface } : { name: 'beckon', dir: tface })
        : { name: 'wave', dir: tface };   // 배운 뒤(또는 떠날 때): 웃으며 손을 흔들어 "안녕"
      if (useArt && Art.drawPerson) Art.drawPerson(ctx, sim.world.id, hp.x, hp.y + bob, tpose, performance.now()); else emoji(hp.emoji, hp.x, hp.y + bob, 34);
      if (hp.state === 'done') emoji('💛', hp.x + 20, hp.y - 22 + bob, 18);
      ctx.fillStyle = '#ffe58a'; ctx.font = 'bold 11px sans-serif';
      if (tutorial) ctx.fillText(hp.name, hp.x, hp.y - hp.r - 10);
      if (tutorial && hp.state === 'wait') { ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; const ht = hp.prog > 0 ? '조언을 듣는 중…' : '곁에 가서 잠시 머물러 보세요', hw = ctx.measureText(ht).width / 2; ctx.fillText(ht, Math.max(hw + 4, Math.min(W - hw - 4, hp.x)), hp.y + hp.r + 12); }   // 화면 밖으로 잘리지 않게
      ctx.globalAlpha = 1;
    }

    drawDeeds(useArt);

    // 적
    const lifeT = EchoSim.TUNING.enemyLifeSec * TICK, fadeT = EchoSim.TUNING.enemyFadeTicks, darkWorld = !!sim.world.rules.sight;
    for (const e of sim.enemies) {
      ctx.globalAlpha = e.age > lifeT - fadeT ? Math.max(0.1, (lifeT - e.age) / fadeT) : 1;   // 곧 사라질 방해 요소는 흐려진다
      if (darkWorld && e.type !== 'boss') { ctx.strokeStyle = 'rgba(255,120,140,.95)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, 7); ctx.stroke(); }   // 어두운 월드: 밝은 테두리로 잘 보이게
      if (useArt && Art.hasEnemy(e)) Art.drawEnemy(ctx, e, now, sim.player.x);
      else {
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 7); ctx.fill(); }
      if (e.warn) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.stroke(); }
      // 적 = 방해 요소: 빨간 테두리 원 (에코의 회색 원과 구분)
      ctx.strokeStyle = 'rgba(255,85,105,.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 7); ctx.stroke();
      emoji(e.emoji, e.x, e.y + 1, e.r * 2);
      }
      if (e.type === 'boss') {
        ctx.fillStyle = '#000a'; ctx.fillRect(40, 70, W - 80, 7);
        ctx.fillStyle = '#ff5d73'; ctx.fillRect(40, 70, (W - 80) * Math.max(0, e.hp / e.maxhp), 7);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(`${e.label} · ${e.phase}/3`, W / 2, 63);
      }
    }
    ctx.globalAlpha = 1;

    // 탄환 / 형광펜 / 적 탄환
    if (useArt) Art.drawParticles(ctx);
    for (const b of sim.bullets) {
      if (b.owner === 'ally') { deedArt('heartPink', b.x, b.y, 12); continue; }
      if (useArt) { Art.drawBullet(ctx, b); continue; }
      ctx.globalAlpha = b.owner === 'echo' ? 0.4 : 1;
      ctx.fillStyle = b.crit ? '#ffd34d' : b.owner === 'echo' ? '#8fe3ff' : '#ffe27a';
      ctx.beginPath(); ctx.arc(b.x, b.y, (b.owner === 'echo' ? 2.6 : 3.2) + (b.crit ? 1.2 : 0), 0, 7); ctx.fill();
    }
    // 형광펜: 점이 아니라 막대 모양(몸통 + 뚜껑)으로, 궤도 접선 방향으로 회전
    for (const o of sim.orbs) {
      const echo = o.owner === 'echo';
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang + Math.PI / 2);
      ctx.globalAlpha = echo ? 0.4 : 1;
      ctx.fillStyle = echo ? '#8fe3ff' : '#d8ff3c';
      ctx.fillRect(-3, -9, 6, 14);                       // 몸통
      ctx.fillStyle = echo ? '#5fb8d8' : '#ff8a1f';
      ctx.fillRect(-3, 5, 6, 4);                         // 뚜껑
      ctx.fillStyle = echo ? '#bfefff' : '#fff';
      ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(3, -9); ctx.lineTo(1.2, -13); ctx.lineTo(-1.2, -13); ctx.closePath(); ctx.fill();   // 펜촉
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 1;
    for (const b of sim.ebullets) { if (useArt) { Art.drawEnemyBullet(ctx, b); continue; } ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff8'; ctx.lineWidth = 1; ctx.stroke(); }
    drawDeeds(useArt, true);

    // 플레이어
    const p = sim.player;
    // 내 위치 표시: 몸 아래 초록 링(숨쉬듯 깜빡임) + 머리 위 ▼ (에코의 시안색과 구분)
    {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      const pr = 13 + 11 * pulse;                  // 반지름 13 ↔ 24 로 눈에 띄게 커졌다 작아졌다
      ctx.fillStyle = `rgba(125,255,178,${0.20 - 0.12 * pulse})`;
      ctx.beginPath(); ctx.arc(p.x, p.y + 1, pr, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(125,255,178,${0.95 - 0.45 * pulse})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y + 1, pr, 0, 7); ctx.stroke();
      const ay = p.y - 30 - 2 * pulse;
      ctx.fillStyle = '#7dffb2';
      ctx.beginPath(); ctx.moveTo(p.x - 5, ay - 5); ctx.lineTo(p.x + 5, ay - 5); ctx.lineTo(p.x, ay + 2); ctx.closePath(); ctx.fill();
    }
    const moving = lastPX !== null && Math.hypot(p.x - lastPX, p.y - lastPY) > 0.3;
    if (lastPX !== null && Math.abs(p.x - lastPX) > 0.3) faceDir = p.x < lastPX ? -1 : 1;
    lastPX = p.x; lastPY = p.y;
    const blink = p.inv > 0 && Math.floor(p.inv / 4) % 2;
    if (sim.cheer > 0) {   // 응원 받는 중: 분홍 고리 + 맴도는 작은 하트 (끝나기 1초 전부터 깜빡이며 흐려짐)
      const ca = Math.min(1, sim.cheer / 60) * (sim.cheer < 60 ? 0.5 + 0.5 * Math.abs(Math.sin(now / 90)) : 1);
      ctx.globalAlpha = 0.55 * ca; ctx.strokeStyle = '#ff8cc0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, 20 + Math.sin(now / 200) * 2, 7, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 공격력 업 배지: 날아와서(약 0.5초) 머리 위에 붙어 있는 동안만 효과. 끝나기 1초 전부터 깜빡이고, 끝나면 톡 터짐
    if (cheerFx) {
      const f = cheerFx, FLY = 30; f.t += 1;
      const hx = p.x + 16, hy = p.y - 30 + Math.sin(now / 220) * 2;
      if (f.t <= FLY) {
        const k = f.t / FLY, e = 1 - Math.pow(1 - k, 2), x = f.x0 + (hx - f.x0) * e, y = f.y0 + (hy - f.y0) * e - Math.sin(k * Math.PI) * 40;
        for (let i = 1; i <= 4; i++) { const kk = Math.max(0, k - i * 0.05), ee = 1 - Math.pow(1 - kk, 2); ctx.globalAlpha = 0.35 * (1 - i / 5); deedArt('heartPink', f.x0 + (hx - f.x0) * ee, f.y0 + (hy - f.y0) * ee - Math.sin(kk * Math.PI) * 40, 8); }
        ctx.globalAlpha = 1; deedArt('atkUp', x, y, 18 + 6 * Math.sin(k * Math.PI));
      } else if (sim.cheer > 0) {
        const pop = f.t < FLY + 10 ? 1 + 0.35 * Math.sin((f.t - FLY) / 10 * Math.PI) : 1;
        ctx.globalAlpha = sim.cheer < 60 ? 0.35 + 0.65 * Math.abs(Math.sin(now / 90)) : 1;
        const gl = ctx.createRadialGradient(hx, hy, 2, hx, hy, 16); gl.addColorStop(0, 'rgba(255,150,200,.55)'); gl.addColorStop(1, 'rgba(255,150,200,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, 16, 0, 7); ctx.fill();
        deedArt('atkUp', hx, hy, 20 * pop); ctx.globalAlpha = 1;
      } else { if (artOn()) Art.burst(hx, hy, '#ff8cc0', 8, false); cheerFx = null; }
    }
    let act = null;
    const dd = sim.deeds, prs = dd && dd.rescue, pes = dd && dd.escort, php = sim.helper;
    if (pickAnim) act = { pose: 'pick', k: pickAnim.t / pickAnim.max };
    else if (playerCheer > 0) act = { pose: 'cheer' };
    else if (prs && prs.state === 'wait' && Math.hypot(p.x - prs.x, p.y - prs.y) < 110) act = { pose: 'reach', tx: prs.x, ty: prs.y };
    else if (pes && pes.state === 'walk' && !pes.waiting && Math.hypot(p.x - pes.x, p.y - pes.y) < 75) act = { pose: 'reach', tx: pes.x, ty: pes.y };
    else if (php && php.state === 'wait' && Math.hypot(p.x - php.x, p.y - php.y) < php.r + p.r) act = { pose: 'learn', tx: php.x, ty: php.y };
    if (useArt) {
      const hand = Art.drawPlayer(ctx, p, playerEmoji, moving, faceDir, now, blink, act);
      if (pickAnim && hand) deedArt(pickAnim.item, hand[0], hand[1] - 4, 13);   // 주운 물건을 손에 들고
    } else {
      if (blink) ctx.globalAlpha = 0.4;
      emoji(playerEmoji, p.x, p.y + 1, 22); ctx.globalAlpha = 1;
    }

    // 이펙트
    for (const f of sim.fx) {
      ctx.globalAlpha = Math.min(1, f.t / 12);
      if (f.kind === 'pop') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y, 14 - f.t, 0, 7); ctx.stroke(); }
      else if (f.kind === 'block') { const k = 1 - f.t / 14; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 9, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }   // 선생님 구역이 막아 낸 탄
      else if (f.kind === 'hurt') { ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(f.x, f.y, 16 - f.t, 0, 7); ctx.fill(); }
      else if (f.kind === 'echoUp') { ctx.globalAlpha = f.t / 40; ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 4 + f.t * 0.6, 0, 7); ctx.stroke(); }
      else if (f.kind === 'vanish') { ctx.globalAlpha *= 0.35; ctx.fillStyle = '#6fe8ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 24 - f.t, 0, 7); ctx.fill(); }
      else if (f.kind === 'nova') { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - f.t / 24), 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // 데미지 숫자
    ctx.textAlign = 'center';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.t / 20);
      ctx.fillStyle = f.crit ? '#ffd34d' : '#fff';
      ctx.font = f.crit ? 'bold 15px sans-serif' : '11px sans-serif';
      ctx.fillText(f.v, f.x, f.y - (40 - f.t) * 0.6);
    }
    ctx.globalAlpha = 1;

    drawBubbles();
    if (bossFx) drawBossFx(now);
    if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,250,235,${whiteFlash * 0.75})`; ctx.fillRect(0, 0, W, H); }

    // 밤·안개 월드: 조준 거리 밖은 어둡게 (자동 공격이 닿는 범위가 보이도록)
    const sight = sim.world.rules.sight;
    if (sight) {
      const g = ctx.createRadialGradient(p.x, p.y, sight * 0.75, p.x, p.y, sight * 1.25);
      g.addColorStop(0, 'rgba(4,6,14,0)'); g.addColorStop(1, 'rgba(4,6,14,.46)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 바람 월드: 지금 바람 방향 표시
    const wind = sim.world.rules.wind;
    if (wind) {
      // 글자 대신 화면을 가로지르는 얇은 바람 줄기: 바람이 셀수록 진하고 빠르게, 방향이 바뀌면 줄기도 반대로 흐른다
      const wx = Math.sin((sim.tick / (wind.period * TICK)) * Math.PI * 2), strength = Math.abs(wx);
      if (strength > 0.08) {
        windPhase += wx * 3.2;
        ctx.strokeStyle = '#e6f6ff'; ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const y = 70 + ((i * 97) % (H - 120)), len = 26 + (i % 4) * 12, speed = 0.7 + (i % 3) * 0.25;
          const x = ((((i * 131) + windPhase * speed) % (W + 120)) + (W + 120)) % (W + 120) - 60;
          const wob = Math.sin(now / 300 + i) * 2.5;
          ctx.globalAlpha = strength * (0.22 + (i % 3) * 0.07); ctx.lineWidth = 1 + (i % 2) * 0.6;
          ctx.beginPath(); ctx.moveTo(x, y + wob); ctx.quadraticCurveTo(x - Math.sign(wx) * len * 0.5, y + wob - 3, x - Math.sign(wx) * len, y + wob); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.lineCap = 'butt';
      }
    }

    // HUD
    // 위쪽 정보 줄: 검은 띠 대신 아주 옅은 그라데이션 (적이 비쳐 보이게), 글자는 그림자로 읽기 쉽게
    { const hg = ctx.createLinearGradient(0, 0, 0, 52); hg.addColorStop(0, 'rgba(0,0,0,.32)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 52);
      // 정보가 있는 자리에는 반투명 받침: 위로 올라온 적이 글자·막대와 겹쳐 보이지 않게
      const pill = (x, y, w, h) => { ctx.fillStyle = 'rgba(10,12,26,.62)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h); ctx.fill(); };
      pill(3, 3, 145, 27); pill(W / 2 - 30, 2, 60, sim.bossCount > 1 ? 33 : 21); pill(W - 112, 3, 109, 33); }
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff5d73'; ctx.fillRect(8, 8, 100 * Math.max(0, p.hp / p.maxhp), 8);
    ctx.strokeStyle = '#fff6'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, 100, 8);
    ctx.fillStyle = '#7dffb2'; ctx.fillRect(8, 20, 100 * Math.min(1, p.xp / p.need), 5);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(`Lv ${p.level}`, 116, 14);
    ctx.textAlign = 'center';
    const left = Math.max(0, Math.ceil((RUN_TICKS - sim.tick) / TICK));
    ctx.font = 'bold 16px sans-serif';
    if (sim.tick >= RUN_TICKS) { ctx.fillStyle = '#ff9aa8'; ctx.fillText('연장전', W / 2, 16); ctx.fillStyle = '#fff'; }
    else ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, 16);
    if (sim.bossCount > 1 && (sim.bossIdx > 0 || sim.tick > 60 * 30)) {     // 큰 도전이 여러 번인 월드: 극복한 수 표시
      ctx.textAlign = 'center'; ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#ffe58a';
      ctx.fillText('🏁 ' + '●'.repeat(sim.bossDefeated) + '○'.repeat(sim.bossCount - sim.bossDefeated), W / 2, 29); ctx.fillStyle = '#fff';
    }
    ctx.textAlign = 'right'; ctx.font = '12px sans-serif';
    const alive = sim.echoes.filter((e) => e.alive && !e.down).length;   // 지금 화면에 나와 있는 에코 수
    ctx.fillText(`👻 ${alive}/${sim.echoes.length}   ☠ ${sim.kills}`, W - 8, 14);
    if (sim.deeds) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#ffb3d4'; const gt = `${sim.deeds.gauge}/${EchoSim.TUNING.deedGaugeNeed}`; ctx.fillText(gt, W - 8, 29); const ga = ctx.textAlign, gb = ctx.textBaseline; deedArt('heart', W - 16 - ctx.measureText(gt).width, 25, 11); ctx.textAlign = ga; ctx.textBaseline = gb; ctx.fillStyle = '#fff'; }

    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // 하단 추천 조작 영역 (이동 제한은 없음. 여기서 드래그하면 손가락이 캐릭터를 덜 가림). 카드가 떠 있으면 안내는 숨김
    if (tutorial && !drag && !sim.choices) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(performance.now() / 350);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '13px sans-serif';
      ctx.fillText('👆 여기서 드래그하면 캐릭터가 안 가려져요', W / 2, PLAY_BOTTOM + 76);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, PLAY_BOTTOM + 76, 38, 0, 7); ctx.globalAlpha *= 0.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    // 보유 아이템: 화면 위 HUD 두 번째 줄 (많아지면 글자를 줄여 한 줄에 맞춤)
    {
      const ownedUps = UPGRADES.filter((u) => p.stats[u.id] && !u.instant);
      const owned = ownedUps.map((u) => `${u.icon}${p.stats[u.id]}`), ownedIds = ownedUps.map((u) => u.id);
      // 자동 선택 id → 아이템 바의 능력 (조언 카드는 능력으로 바꿔서)
      for (const a of autoFlash) if (!a.stat) a.stat = { boon_power: 'dmg', boon_focus: 'rate', boon_team: 'echo' }[a.id] || a.id;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (!owned.length) {
        if (tutorial) { ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillText('🎒 아이템: 구슬을 모아 성장하면 생겨요', 8, 43); }
      } else {
        let size = 13, gap = 7;
        const total = (sz, g) => { ctx.font = `${sz}px sans-serif`; return owned.reduce((a, t) => a + ctx.measureText(t).width + g, 0); };
        while (size > 9 && total(size, gap) > W - 96) { size -= 1; gap = Math.max(3, gap - 1); }   // 오른쪽은 ⏸·🔊 버튼 자리
        ctx.font = `${size}px sans-serif`; ctx.fillStyle = '#fff';
        let ux = 8;
        for (let i = 0; i < owned.length; i++) {
          const t = owned[i], w2 = ctx.measureText(t).width;
          const fl = autoFlash.find((a) => a.stat === ownedIds[i]);
          if (fl) {   // 자동 선택된 아이템: 아이콘 뒤가 짧게 반짝
            ctx.globalAlpha = (Math.floor(fl.t / 6) % 2 ? 0.55 : 0.2);
            ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(ux + size * 0.55, 43, size * 0.9, 0, 7); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
          }
          ctx.fillText(t, ux, 43); ux += w2 + gap;
        }
      }
      // 새로 얻은 아이템: 주인공 머리 위에서 살짝 떠오르며 반짝 (여러 개면 옆으로 나란히)
      headFlash.forEach((h, i) => {
        const k = 1 - h.t / 50, x = p.x + (i - (headFlash.length - 1) / 2) * 20, y = p.y - 40 - k * 10;
        const pop = k < 0.2 ? 0.6 + k * 2.4 : 1.08 - Math.min(0.08, (k - 0.2) * 0.2);   // 톡 커졌다 제자리
        ctx.globalAlpha = Math.min(1, h.t / 14);
        const gl = ctx.createRadialGradient(x, y, 1, x, y, 15); gl.addColorStop(0, 'rgba(255,240,150,.8)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(now / 300);
        ctx.fillStyle = '#fff8c4';
        for (let s = 0; s < 4; s++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -11 - 3 * Math.sin(now / 90 + s)); ctx.lineTo(1.6, -7); ctx.lineTo(-1.6, -7); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; emoji(h.icon, x, y, 15 * pop);
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // 조이스틱 표시 (드래그 중)
    if (drag) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(drag.ax, drag.ay, 46, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(140,170,255,.85)';
      ctx.beginPath(); ctx.arc(drag.px, drag.py, 18, 0, 7); ctx.fill();
    }

    // 배너 / 시너지 토스트
    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 30);
      // 보스가 나와 있으면 체력 막대 바로 아래 좁은 띠에, 아니면 화면 가운데 위쪽에. 어두운 받침 위에 써서 싸움 장면을 덜 가린다
      const bossOn = sim.enemies.some((e) => e.type === 'boss'), by = bossOn ? 92 : H * 0.36, bs = bossOn ? 14 : 18;
      ctx.font = `bold ${bs}px sans-serif`; const bw = Math.min(W - 12, ctx.measureText(banner.text).width + 26);
      ctx.fillStyle = 'rgba(10,12,26,.6)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - bw / 2, by - bs * 0.95, bw, bs * 1.7, 10) : ctx.rect(W / 2 - bw / 2, by - bs * 0.95, bw, bs * 1.7); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = /^[⚠]/.test(banner.text) ? '#ff5d73' : '#ffe58a'; fitText(banner.text, W / 2, by - bs * 0.1, bs); ctx.textBaseline = 'alphabetic';   // 화면 위쪽(보스 체력 막대·HUD)과 겹치지 않게 가운데 쪽에
      ctx.globalAlpha = 1;
    }
    if (toast.t > 0) {
      ctx.globalAlpha = Math.min(1, toast.t / 30);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34d';
      // 긴 안내는 ' · ' 에서 줄을 나눠 여러 줄로 (작아지거나 잘리지 않게), 뒤에 반투명 띠
      // ' · ' 로 나눈 뒤에도 화면보다 길면 띄어쓰기에서 한 번 더 줄바꿈
      ctx.font = 'bold 14px sans-serif';
      const lines = [];
      for (const part of toast.text.split(' · ')) {
        let cur = '';
        for (const w of part.split(' ')) {
          const next = cur ? cur + ' ' + w : w;
          if (cur && ctx.measureText(next).width > W - 24) { lines.push(cur); cur = w; } else cur = next;
        }
        if (cur) lines.push(cur);
      }
      const y0 = H * 0.36 + 30;
      ctx.fillStyle = 'rgba(8,10,20,.55)'; ctx.fillRect(4, y0 - 13, W - 8, lines.length * 20 + 6);
      ctx.fillStyle = '#ffd34d'; lines.forEach((ln, i) => fitText(ln, W / 2, y0 + i * 20, 14));
      ctx.globalAlpha = 1;
    }
    if (edgeFlash > 0) {
      ctx.globalAlpha = (edgeFlash / 40) * (0.5 + 0.5 * Math.abs(Math.sin(edgeFlash / 4)));
      ctx.strokeStyle = '#ffa53a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10); ctx.globalAlpha = 1;
    }
    if (hurtFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62);
      g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, `rgba(255,40,70,${0.5 * hurtFlash})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- 메인 루프 (고정 60Hz) ---------- */
  let pauseShown = true;
  function frame(now) {
    if (state === 'play') {
      acc += Math.min(100, now - last) * (slowmo > 0 ? 0.3 : 1); last = now;   // 보스 극복 순간은 슬로모션
      if (tipFreeze > 0) { tipFreeze -= 1; acc = 0; }   // 튜토리얼 설명: 짧게 멈춤 (밀린 시간을 몰아서 돌리지 않음)
      const dt = 1000 / TICK;
      while (acc >= dt && state === 'play' && tipFreeze <= 0) {
        acc -= dt; sim.step(currentInput());
        handleEvents();
        if (tutorial) tutorialTips();
        if (sim.over) break;
      }
    }
    // 보스가 나오면 긴장감 있는 곡으로. 여러 번 나오는 월드는 사이 쉬는 시간에도 유지하고, 모두 극복하면 원래 곡으로
    updateCards();
    if (state === 'play' && sim) {   // 왕마다 다른 테마 (왕과 왕 사이 쉬는 동안은 지금 곡 유지)
      const be = sim.bossAlive ? sim.enemies.find((e) => e.type === 'boss') : null;
      Music.setBoss(sim.bossAlive || (sim.bossIdx > 0 && sim.bossIdx < sim.bossCount), be ? be.def : null);
    }
    if (state === 'play' && sim && sim.over && !bossFxActive()) showEnd();   // 마지막 보스면 연출이 끝난 뒤 결과 화면
    if (slowmo > 0) slowmo -= 1;
    if (bossFx) { bossFx.t += 1; if (bossFx.t === 30) bossBoom(); if (bossFx.t > BOSS_FX_LEN + 20) bossFx = null; }
    if (whiteFlash > 0) whiteFlash = Math.max(0, whiteFlash - 0.05);
    const showPause = state === 'play';
    if (showPause !== pauseShown) { pauseShown = showPause; $('pauseBtn').style.display = showPause ? '' : 'none'; }
    if (state === 'paused') { render(); requestAnimationFrame(frame); return; }   // 멈춘 동안 연출도 멈춘다
    if (shake > 0) shake = Math.max(0, shake - 0.4);
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - 0.06);
    if (edgeFlash > 0) edgeFlash -= 1;
    for (const f of floats) f.t -= 1;
    floats = floats.filter((f) => f.t > 0);
    for (const a of autoFlash) a.t -= 1;
    for (const h of headFlash) h.t -= 1;
    headFlash = headFlash.filter((h) => h.t > 0);
    autoFlash = autoFlash.filter((a) => a.t > 0);
    if (banner.t > 0) banner.t -= 1;
    if (toast.t > 0) toast.t -= 1;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  GameUI.refresh();   // 에코 수 표시 등 (에코 정보는 이 파일에서 준비됨)

  // 테스트/디버그용 훅
  window.__echo = { get bossFx() { return bossFx; }, get sim() { return sim; }, get state() { return state; }, get echoes() { return echoes; }, get tutorial() { return tutorial; } };
})();
