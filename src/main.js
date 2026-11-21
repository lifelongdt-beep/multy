/* Endless Me — 입력 / 렌더 / 저장 / 연출 */
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
    input.dx = vx / 46; input.dy = vy / 46;
  }
  const endDrag = () => { drag = null; input.dx = 0; input.dy = 0; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '1' || k === '2' || k === '3') { pickCard(+k - 1); return; }
    if (k === 'g') { toggleArt(); return; }
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
  let hurtFlash = 0;   // 피격 시 화면 가장자리 붉은 번쩍임 (진동이 안 되는 기기에서도 피격을 알 수 있게)
  // 내 에너지가 깎이면 진동: 피해량이 클수록 길게 (미지원 기기는 조용히 무시)
  function vibrate(dmg) {
    try { if (navigator.vibrate) navigator.vibrate(Math.min(220, Math.max(70, Math.round((dmg || 5) * 12)))); } catch (e) { /* 무시 */ }
  }
  let floats = [];
  let autoFlash = [];
  let headFlash = [];   // 새로 얻은 아이템: 주인공 머리 위에서 잠깐 반짝 {icon, t}
  // 보스 극복 연출: 슬로모션 → 부풀며 빛남 → 폭발·충격파·색종이 → 화면 번쩍
  let bossFx = null, slowmo = 0, whiteFlash = 0;
  const BOSS_FX_LEN = 80;
  function bossFxActive() { return !!bossFx && bossFx.t < BOSS_FX_LEN; }
  /* ---------- 새 그림체 (시안: 학교 월드). 일시정지 화면의 🎨 버튼 / G키로 이전 그림체와 바꿔 비교 ---------- */
  let artPref = 'new';
  try { artPref = localStorage.getItem('echo-art') || 'new'; } catch (e) { /* 무시 */ }
  function artOn() { const w = sim ? sim.world : EchoSim.WORLDS[GameUI.worldId()]; return artPref === 'new' && !!window.Art && Art.supports(w); }
  function toggleArt() {
    artPref = artPref === 'new' ? 'old' : 'new';
    try { localStorage.setItem('echo-art', artPref); } catch (e) { /* 무시 */ }
    if (window.Art) Art.clearParticles();
    const b = document.getElementById('artBtn'); if (b) b.textContent = artPref === 'new' ? '🎨 그림체: 새 그림체' : '🎨 그림체: 이전';
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
        case 'boss': banner = { text: ev.text || '보스 등장!', t: 150 }; shake = 10; Sfx.play('boss'); break;
        case 'helper': Sfx.play('heal'); break;
        case 'helped': Sfx.play('levelup'); break;
        case 'train': Sfx.play('train'); if (tutorial) banner = { text: ev.text || '🚆 열차 접근! 빨간 줄을 피하세요', t: 110 }; break;
        case 'phase': if (tutorial) banner = { text: `${ev.name || '보스'} ${ev.phase}페이즈`, t: 120 }; shake = 10; Sfx.play('boss'); break;
        case 'gotItem': headFlash.push({ icon: ev.icon, t: 50 }); if (headFlash.length > 3) headFlash.shift(); break;
        case 'autoPick': autoFlash.push({ id: ev.id, icon: ev.icon, t: 48 }); break;   // 자동 선택: 아이콘만 짧게 반짝 (글자·소리 없음)
        case 'synergy': toast = { text: `✨ 시너지: ${ev.name}`, t: 150 }; Sfx.play('levelup'); break;
        default: break;
      }
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
      sim = new Sim({ seed: (Date.now() ^ (runCount * 2654435761)) >>> 0, echoes, bonus: GameUI.bonus(), world: GameUI.worldId(), cycle: GameUI.cycle() });
    }
    playerEmoji = GameUI.emoji();
    if (window.Art) Art.setOutfit(GameUI.cycle());   // 회차별 복장 (에코도 같은 옷)
    state = 'play'; acc = 0; last = performance.now();
    shake = 0; hurtFlash = 0; floats = []; headFlash = []; autoFlash = []; bossFx = null; slowmo = 0; whiteFlash = 0;
    const needE = sim.world.boss.needEchoes;
    if (!tutorial && echoes.length < needE) toast = { text: `👻 큰 도전엔 에코 ${needE}명 이상 권장 (지금 ${echoes.length}명)`, t: 240 };
    banner = { text: clearedEchoes ? `${sim.world.emoji} ${sim.world.name} · 에코는 새로 시작해요` : `${sim.world.emoji} ${sim.world.name}`, t: 140 }; banner.t = 0; toast.t = 0;
    ['start', 'levelup', 'end', 'tutorial', 'pause'].forEach((id) => $(id).classList.add('hidden'));
    $('again').textContent = '한 판만 더';
    Music.play(sim.world.id);   // 월드별 배경음악 (보스가 나오면 frame에서 보스 곡으로 전환)
    if (tutorial) banner = { text: '📘 튜토리얼 · 과거의 나 10명과 함께!', t: 150 };
  }

  /** 튜토리얼 안내 문구를 시간에 맞춰 띄운다 */
  function tutorialTips() {
    const tips = EchoTutorial.TIPS;
    while (tipIdx < tips.length && sim.tick >= tips[tipIdx].sec * TICK) { toast = { text: tips[tipIdx].text, t: 300 }; tipIdx++; }
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
  $('artBtn').onclick = () => { Sfx.play('click'); toggleArt(); render(); };
  $('artBtn').textContent = artPref === 'new' ? '🎨 그림체: 새 그림체' : '🎨 그림체: 이전';
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
        title.textContent = sim.choiceKind === 'helper' ? `${sim.world.helper.emoji} ${sim.world.helper.name}의 조언 · 톡 눌러 고르기` : '🌱 성장! 톡 눌러 고르기 (안 고르면 자동)';
        box.appendChild(title);
        const row = document.createElement('div'); row.className = 'crow';
        ch.forEach((u, i) => {
          const b = document.createElement('button'); b.className = 'mini' + (u.boon ? ' boon' : '');
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
    $('endEchoes').textContent = '👻 에코 10명';
    $('stats').innerHTML = `생존 ${(sim.tick / TICK).toFixed(0)}초 · 물리친 방해 ${sim.kills} · Lv ${sim.player.level}`;
    $('reward').innerHTML = '';
    [
      '방금 함께 싸운 10명은 연습용 "과거의 나"였어요.',
      '이제부터는 진짜 내 에코를 0명부터 쌓아요.',
      '한 판이 끝날 때마다 그 판의 내가 에코가 되어 다음 판을 도와요.',
    ].forEach((t) => { const d = document.createElement('div'); d.textContent = t; $('reward').appendChild(d); });
    $('cheer').textContent = `👻 ${sim.world.name}의 큰 도전은 에코 ${sim.world.boss.needEchoes}명쯤 모이면 넘을 수 있어요. 차근차근 쌓아 봐요!`;
    $('again').textContent = '이제 진짜 시작! ▶';
    $('end').classList.remove('hidden');
  }

  function showEnd() {
    if (tutorial) { showTutorialEnd(); return; }
    state = 'end'; Music.stop();
    const out = sim.exportEcho();
    echoes = addEcho(echoes, out, MAX_ECHOES).list; echoWorld = sim.world.id;
    save();
    const lastBoss = sim.bossLineup[sim.bossLineup.length - 1];
    const title = { dead: '쓰러졌다… 하지만!', clear: `${lastBoss.name} 극복! 🎉`, survive: '120초 버텼어요!' }[sim.result];
    Sfx.play(sim.result === 'dead' ? 'lose' : 'win');
    $('endTitle').textContent = title;
    $('endEchoes').textContent = `👻 에코 ${echoes.length}/${MAX_ECHOES}명`;
    $('cheer').textContent = cheerMessage(sim.result, sim.helped, sim.echoes.length);   // 따뜻한 한마디 한 줄
    // 본 게임 결과는 짧게: 핵심 숫자만 (자세한 설명은 튜토리얼에서)
    $('stats').textContent = `⏱ ${(sim.tick / TICK).toFixed(0)}초 · ☠ ${sim.kills} · Lv ${sim.player.level}` + (sim.bossCount > 1 ? ` · 🏁 ${sim.bossDefeated}/${sim.bossCount}` : '');
    // 학점 · 도전 과제 · 일일 미션
    const sum = GameUI.recordRun({ kills: sim.kills, seconds: Math.floor(sim.tick / TICK), level: sim.player.level, result: sim.result, gems: sim.gemCount, echoes: sim.echoes.length, world: sim.world.id, helped: sim.helped });
    const lines = [`🎓 학점 +${Meta.fmtNum(sum.earned)}`];
    for (const a of sum.newAch) lines.push(`🏆 ${a.name} +${a.reward}`);
    for (const m of sum.missionsDone) lines.push(`🎯 +${m.reward}`);
    if (sum.newWorld) { const w = EchoSim.WORLDS[sum.newWorld]; lines.push(`🔓 ${w.emoji} ${w.name}`); }
    if (sum.newCycle !== null && sum.newCycle !== undefined) {
      lines.push(`🔁 ${sum.newCycle + 1}회차!`);
      const of = EchoWorlds.outfitOf(sum.newCycle);
      lines.push(of.tier === 0 ? `👕 새 복장: ${of.name}` : `👕 ${of.name} ${'★'.repeat(of.stars)} 장식 추가`);
    }
    if (sim.result !== 'clear') {
      const short = GameUI.gearShort(sim.world.id);
      if (short) lines.push(`🧰 ⚔ -${short.atk} 🛡 -${short.def}`);
    }
    $('reward').innerHTML = '';
    lines.forEach((t) => { const d = document.createElement('div'); d.textContent = t; $('reward').appendChild(d); });
    if (sum.newAch.length || sum.missionsDone.length || sum.newWorld || sum.newCycle !== null) Sfx.play('levelup');
    $('end').classList.remove('hidden');
  }

  $('go').onclick = () => startRun(); $('again').onclick = () => startRun();
  $('bTutorial').onclick = () => startRun({ tutorial: true });
  $('tStart').onclick = () => startRun({ tutorial: true });
  $('tSkip').onclick = () => { Sfx.unlock(); Sfx.play('click'); GameUI.finishTutorial(); $('tutorial').classList.add('hidden'); $('start').classList.remove('hidden'); };
  // 처음 실행이면 튜토리얼 안내부터
  if (!GameUI.tutorialDone()) { $('start').classList.add('hidden'); $('tutorial').classList.remove('hidden'); }
  $('toMenu').onclick = () => { $('end').classList.add('hidden'); $('start').classList.remove('hidden'); GameUI.refresh(); state = 'menu'; };
  $('reset').onclick = () => { echoes = []; runCount = 0; save(); $('reset').textContent = '초기화됨'; };
  $('mute').onclick = () => { Sfx.setMuted(!Sfx.isMuted()); $('mute').textContent = Sfx.isMuted() ? '🔇' : '🔊'; };

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

    // 에코 = 내 편: 파란 원 + 파란 테두리 유령 (적은 빨간 테두리라 한눈에 구분)
    for (const ec of sim.echoes) {
      if (!ec.alive || ec.down > 0) continue;   // 에너지가 떨어져 사라진 동안은 그리지 않음
      // 흐리게: 내 캐릭터·적보다 눈에 덜 띄도록 (파란 테두리는 남겨 적과 구분). 맞으면 잠깐 깜빡임
      const hit = ec.inv > 0 && Math.floor(ec.inv / 4) % 2 === 0 ? 0.5 : 1;
      if (useArt) { Art.drawEcho(ctx, ec, playerEmoji, now, 0.3 * hit); continue; }   // 새 그림체: 과거의 나 모습의 유령
      ctx.globalAlpha = 0.07 * hit;
      ctx.fillStyle = '#3fb8ff'; ctx.beginPath(); ctx.arc(ec.x, ec.y, 12, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.32 * hit;
      ctx.strokeStyle = '#6fd6ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ec.x, ec.y, 12, 0, 7); ctx.stroke();
      ctx.globalAlpha = 0.24 * hit; emoji('👻', ec.x, ec.y + 1, 16);
      ctx.globalAlpha = 1;
    }

    // 도우미(선생님 등): 빛나는 상담 구역 + 게이지. 가까이 가서 잠시 머물면 조언 카드를 받는다
    if (sim.helper) {
      const hp = sim.helper, bob = Math.sin(performance.now() / 300) * 2;
      const fadeA = hp.state === 'wait' ? 1 : Math.max(0, hp.fade / (hp.state === 'done' ? 150 : 90));
      ctx.globalAlpha = fadeA;
      const glow = ctx.createRadialGradient(hp.x, hp.y, 4, hp.x, hp.y, hp.r + 8);
      glow.addColorStop(0, 'rgba(255,225,120,.35)'); glow.addColorStop(1, 'rgba(255,225,120,.05)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r + 8, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,120,.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (hp.prog > 0 && hp.state === 'wait') {
        ctx.strokeStyle = '#7dffb2'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r - 5, -Math.PI / 2, -Math.PI / 2 + (hp.prog / hp.need) * Math.PI * 2); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (useArt) Art.drawHelper(ctx, sim.world.id, hp.x, hp.y + bob); else emoji(hp.emoji, hp.x, hp.y + bob, 34);
      if (hp.state === 'done') emoji('💛', hp.x + 20, hp.y - 22 + bob, 18);
      ctx.fillStyle = '#ffe58a'; ctx.font = 'bold 11px sans-serif';
      if (tutorial) ctx.fillText(hp.name, hp.x, hp.y - hp.r - 10);
      if (tutorial && hp.state === 'wait') { ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText(hp.prog > 0 ? '조언을 듣는 중…' : '곁에 가서 잠시 머물러 보세요', hp.x, hp.y + hp.r + 12); }
      ctx.globalAlpha = 1;
    }

    // 적
    for (const e of sim.enemies) {
      if (useArt && Art.hasEnemy(e)) Art.drawEnemy(ctx, e, now, sim.player.x);
      else {
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 7); ctx.fill(); }
      if (e.warn) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.stroke(); }
      // 적 = 방해 요소: 빨간 테두리 원 (에코의 파란 원과 구분)
      ctx.strokeStyle = 'rgba(255,85,105,.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 7); ctx.stroke();
      emoji(e.emoji, e.x, e.y + 1, e.r * 2);
      }
      if (e.type === 'boss') {
        ctx.fillStyle = '#000a'; ctx.fillRect(40, 70, W - 80, 7);
        ctx.fillStyle = '#ff5d73'; ctx.fillRect(40, 70, (W - 80) * Math.max(0, e.hp / e.maxhp), 7);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(`${e.label} · ${e.phase}/3`, W / 2, 63);
      }
    }

    // 탄환 / 형광펜 / 적 탄환
    if (useArt) Art.drawParticles(ctx);
    for (const b of sim.bullets) {
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
    if (useArt) Art.drawPlayer(ctx, p, playerEmoji, moving, faceDir, now, blink);
    else {
      if (blink) ctx.globalAlpha = 0.4;
      emoji(playerEmoji, p.x, p.y + 1, 22); ctx.globalAlpha = 1;
    }

    // 이펙트
    for (const f of sim.fx) {
      ctx.globalAlpha = Math.min(1, f.t / 12);
      if (f.kind === 'pop') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y, 14 - f.t, 0, 7); ctx.stroke(); }
      else if (f.kind === 'hurt') { ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(f.x, f.y, 16 - f.t, 0, 7); ctx.fill(); }
      else if (f.kind === 'echoUp') { ctx.globalAlpha = f.t / 40; ctx.strokeStyle = '#6fd6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 4 + f.t * 0.6, 0, 7); ctx.stroke(); }
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

    if (bossFx) drawBossFx(now);
    if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,250,235,${whiteFlash * 0.75})`; ctx.fillRect(0, 0, W, H); }

    // 밤·안개 월드: 조준 거리 밖은 어둡게 (자동 공격이 닿는 범위가 보이도록)
    const sight = sim.world.rules.sight;
    if (sight) {
      const g = ctx.createRadialGradient(p.x, p.y, sight * 0.75, p.x, p.y, sight * 1.25);
      g.addColorStop(0, 'rgba(4,6,14,0)'); g.addColorStop(1, 'rgba(4,6,14,.62)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 바람 월드: 지금 바람 방향 표시
    const wind = sim.world.rules.wind;
    if (wind) {
      const wx = Math.sin((sim.tick / (wind.period * TICK)) * Math.PI * 2);
      ctx.globalAlpha = Math.min(0.8, Math.abs(wx)); ctx.fillStyle = '#cfefff'; ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(wx > 0 ? '🌬️ →' : '← 🌬️', W / 2, 92);
      ctx.globalAlpha = 1;
    }

    // HUD
    // 위쪽 정보 줄: 검은 띠 대신 아주 옅은 그라데이션 (적이 비쳐 보이게), 글자는 그림자로 읽기 쉽게
    { const hg = ctx.createLinearGradient(0, 0, 0, 52); hg.addColorStop(0, 'rgba(0,0,0,.32)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, 52); }
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
      ctx.textAlign = 'center'; ctx.fillStyle = /^[⚠]/.test(banner.text) ? '#ff5d73' : '#ffe58a'; fitText(banner.text, W / 2, 100, 18);
      ctx.globalAlpha = 1;
    }
    if (toast.t > 0) {
      ctx.globalAlpha = Math.min(1, toast.t / 30);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd34d'; fitText(toast.text, W / 2, 130, 15);
      ctx.globalAlpha = 1;
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
      const dt = 1000 / TICK;
      while (acc >= dt && state === 'play') {
        acc -= dt; sim.step(currentInput());
        handleEvents();
        if (tutorial) tutorialTips();
        if (sim.over) break;
      }
    }
    // 보스가 나오면 긴장감 있는 곡으로. 여러 번 나오는 월드는 사이 쉬는 시간에도 유지하고, 모두 극복하면 원래 곡으로
    updateCards();
    if (state === 'play' && sim) Music.setBoss(sim.bossAlive || (sim.bossIdx > 0 && sim.bossIdx < sim.bossCount));
    if (state === 'play' && sim && sim.over && !bossFxActive()) showEnd();   // 마지막 보스면 연출이 끝난 뒤 결과 화면
    if (slowmo > 0) slowmo -= 1;
    if (bossFx) { bossFx.t += 1; if (bossFx.t === 30) bossBoom(); if (bossFx.t > BOSS_FX_LEN + 20) bossFx = null; }
    if (whiteFlash > 0) whiteFlash = Math.max(0, whiteFlash - 0.05);
    const showPause = state === 'play';
    if (showPause !== pauseShown) { pauseShown = showPause; $('pauseBtn').style.display = showPause ? '' : 'none'; }
    if (state === 'paused') { render(); requestAnimationFrame(frame); return; }   // 멈춘 동안 연출도 멈춘다
    if (shake > 0) shake = Math.max(0, shake - 0.4);
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - 0.06);
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

  // 테스트/디버그용 훅
  window.__echo = { get bossFx() { return bossFx; }, get sim() { return sim; }, get state() { return state; }, get echoes() { return echoes; }, get tutorial() { return tutorial; } };
})();
