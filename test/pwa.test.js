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

test('웹 체험판 빌드: 학교·학원만 플레이 데이터가 있고, 앱 전용 월드는 이름·소개만 남는다', () => {
  const { execFileSync } = require('child_process');
  const out = path.join(ROOT, 'www');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-web.js'), '--demo'], { stdio: 'pipe' });
  const file = path.join(out, 'src', 'worlds.js');
  delete require.cache[require.resolve(file)];
  const W = require(file), full = require(path.join(ROOT, 'src', 'worlds.js'));
  for (const id of Object.keys(full.WORLDS)) {
    const w = W.WORLDS[id];
    assert.ok(w && w.name === full.WORLDS[id].name, id + ' 이름은 남음');
    if (id === 'school' || id === 'academy') assert.deepStrictEqual(w.enemies, full.WORLDS[id].enemies, id + ' 그대로');
    else { assert.deepStrictEqual(w.enemies, {}, id + ' 방해 요소 없음'); assert.deepStrictEqual(w.waves, []); assert.ok(w.boss.appOnly); assert.strictEqual(w.boss.hp, undefined); }
  }
  assert.match(fs.readFileSync(path.join(out, 'src', 'version.js'), 'utf8'), /ECHO_DEMO = true/);
  assert.match(read('sw.js'), /importScripts\('src\/version\.js'\)/, '오프라인 저장본 이름이 버전과 연결됨');
  fs.rmSync(out, { recursive: true, force: true });
});
