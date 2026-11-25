'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('앱 설치(PWA): 오프라인 저장 목록에 게임 파일이 모두 있고, 아이콘·설치 정보가 맞다', () => {
  const html = read('index.html'), sw = read('sw.js');
  const files = JSON.parse('[' + sw.match(/const FILES = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 10);
  for (const s of scripts) assert.ok(files.includes(s), `sw.js FILES에 ${s} 없음 (오프라인에서 안 열림)`);
  for (const f of files) if (f !== './') assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} 파일 없음`);
  assert.ok(html.includes('rel="manifest" href="manifest.webmanifest"'));
  const man = JSON.parse(read('manifest.webmanifest'));
  assert.strictEqual(man.display, 'standalone');
  assert.strictEqual(man.start_url, './');
  assert.ok(man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of man.icons) assert.ok(fs.existsSync(path.join(ROOT, i.src)), `${i.src} 없음`);
});
