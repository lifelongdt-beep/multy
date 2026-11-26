/* Echo Rush — 배포할 게임 파일 모으기 (www/)
 *  - 안드로이드 앱(Capacitor): www/ 안의 파일을 앱 속에 넣어 인터넷 없이 실행한다.  node tools/build-web.js
 *  - 웹 체험판(GitHub Pages):  node tools/build-web.js --demo
 *    학교·학원 두 월드만 실제로 플레이할 수 있는 데이터를 넣는다. 나머지 10개 월드는 이름·소개만 남기고
 *    방해 요소·웨이브·왕 데이터를 빼서, 파일을 내려받아도 앱 전용 월드는 플레이할 수 없다.
 * 버전: APP_VERSION_NAME 환경 값이 있으면 src/version.js에 넣는다 (오프라인 저장본도 버전마다 새로 만들어짐) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'www');
const DEMO = process.argv.includes('--demo');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'].concat(DEMO ? ['privacy.html', '.nojekyll'] : []);
const DIRS = ['src', 'icons'];
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });

const ver = process.env.APP_VERSION_NAME || (DEMO ? '웹 체험판' : null);
if (ver) fs.writeFileSync(path.join(OUT, 'src', 'version.js'), `(function (root) { root.ECHO_VERSION = ${JSON.stringify(ver)};${DEMO ? ' root.ECHO_DEMO = true;' : ''} })(typeof window !== 'undefined' ? window : globalThis);\n`);

if (DEMO) {   // 앱 전용 월드의 플레이 데이터 빼기
  const Worlds = require(path.join(ROOT, 'src', 'worlds.js'));
  const KEEP = ['school', 'academy'];
  const file = path.join(OUT, 'src', 'worlds.js');
  let src = fs.readFileSync(file, 'utf8');
  /** text[i]가 여는 괄호일 때 짝이 맞는 닫는 괄호 위치 (문자열 안의 괄호는 건너뜀) */
  const match = (text, i) => {
    const open = text[i], close = open === '{' ? '}' : ']';
    let depth = 0, q = null;
    for (let k = i; k < text.length; k++) {
      const c = text[k];
      if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
      if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); if (k < 0) break; continue; }   // 줄 주석 건너뜀
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === open) depth++; else if (c === close && --depth === 0) return k;
    }
    throw new Error('괄호 짝을 못 찾음');
  };
  let stripped = 0;
  for (const id of Object.keys(Worlds.WORLDS)) {
    if (KEEP.includes(id)) continue;
    const head = src.indexOf(`\n    ${id}: {\n`); if (head < 0) throw new Error('월드 못 찾음: ' + id);
    const bStart = src.indexOf('{', head + 5), bEnd = match(src, bStart);
    let block = src.slice(bStart, bEnd + 1);
    const cut = (key, empty) => {
      const at = block.indexOf(`\n      ${key}:`); if (at < 0) return;
      let vs = at + `\n      ${key}:`.length; while (block[vs] === ' ') vs++;
      const ve = match(block, vs);
      block = block.slice(0, vs) + empty + block.slice(ve + 1);
    };
    cut('enemies', '{}'); cut('waves', '[]'); cut('swarms', '[]');
    const b = Worlds.WORLDS[id].boss;   // 왕: 메뉴에 보이는 것만 (이름·모양·등장 횟수·필요한 에코 수)
    cut('boss', JSON.stringify({ name: b.name, emoji: b.emoji, times: b.times, needEchoes: b.needEchoes, appOnly: true }));
    src = src.slice(0, bStart) + block + src.slice(bEnd + 1);
    stripped++;
  }
  fs.writeFileSync(file, src);
  const check = require(file);   // 고친 파일이 잘 읽히는지 + 정말 비었는지 확인
  for (const id of Object.keys(check.WORLDS)) if (!KEEP.includes(id) && Object.keys(check.WORLDS[id].enemies).length) throw new Error('데이터가 남음: ' + id);
  delete require.cache[require.resolve(file)];
  console.log(`웹 체험판: 앱 전용 월드 ${stripped}개의 플레이 데이터를 뺐어요`);
}
// index.html이 부르는 스크립트가 모두 들어갔는지 확인 (빠지면 하얀 화면)
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !fs.existsSync(path.join(OUT, s)));
if (missing.length) { console.error('빠진 파일:', missing.join(', ')); process.exit(1); }
console.log('www/ 준비 완료:', fs.readdirSync(OUT).join(', '));
