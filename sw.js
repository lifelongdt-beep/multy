/* Echo Rush — 오프라인 플레이 (서비스 워커)
 * - 처음 열 때 게임 파일을 모두 저장해 두고, 인터넷이 없어도 저장본으로 실행한다.
 * - 인터넷이 있으면 늘 새 파일을 먼저 받아(새 버전이 바로 반영) 저장본도 바꿔 둔다.
 * - 게임 제목 글꼴(Google Fonts)은 한 번 받으면 저장본을 쓴다.
 * 새 스크립트 파일을 추가하면 아래 FILES에도 넣는다 (test/pwa.test.js가 확인). */
importScripts('src/version.js');   // 게임 버전 (자동 빌드가 배포마다 새 번호를 넣음)
const CACHE = 'echo-rush-' + String(self.ECHO_VERSION || 'v1').trim().replace(/\s+/g, '-');   // 버전이 바뀌면 저장본도 새로 (옛 저장본은 activate에서 지움)
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'src/version.js', 'src/glyphs.js', 'src/worlds.js', 'src/sim.js', 'src/tutorial.js', 'src/meta.js', 'src/audio.js', 'src/music.js',
  'src/art.js', 'src/art-worlds.js', 'src/art-bg.js', 'src/art-bullets.js', 'src/art-echoes.js', 'src/art-menu.js',
  'src/icons.js', 'src/ui.js', 'src/main.js',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('echo-rush-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {   // 글꼴: 저장본 먼저, 없으면 받아서 저장
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // 게임 파일: 새 파일 먼저 → 실패하면(오프라인) 저장본
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
