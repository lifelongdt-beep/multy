/* Echo Rush — 앱에 넣을 게임 파일 모으기 (www/)
 * 안드로이드 앱(Capacitor)은 www/ 안의 파일을 앱 속에 넣어 인터넷 없이 실행한다.
 * 실행: node tools/build-web.js   (npm run build:web) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'www');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['src', 'icons'];
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
// 버전: 자동 빌드가 알려 준 번호를 앱 속 version.js에 넣음 (예: 1.0.9)
if (process.env.APP_VERSION_NAME) fs.writeFileSync(path.join(OUT, 'src', 'version.js'), `(function (root) { root.ECHO_VERSION = ${JSON.stringify(process.env.APP_VERSION_NAME)}; })(typeof window !== 'undefined' ? window : globalThis);\n`);
// index.html이 부르는 스크립트가 모두 들어갔는지 확인 (빠지면 앱이 하얀 화면)
const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !fs.existsSync(path.join(OUT, s)));
if (missing.length) { console.error('빠진 파일:', missing.join(', ')); process.exit(1); }
console.log('www/ 준비 완료:', fs.readdirSync(OUT).join(', '));
