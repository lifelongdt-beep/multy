/* Echo Rush — 버튼 아이콘 (이모지 대신 직접 그린 선 아이콘, SVG)
 * 둥근 선 · 같은 굵기 · currentColor 로 버튼 글자색을 따른다.
 */
(function (root) {
  'use strict';
  const P = {
    pause:    '<rect x="6" y="4.5" width="4" height="15" rx="1.4"/><rect x="14" y="4.5" width="4" height="15" rx="1.4"/>',
    play:     '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"/>',
    soundOn:  '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill-op="1"/><path d="M15.5 9a4 4 0 0 1 0 6" class="s"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11" class="s"/>',
    soundOff: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill-op="1"/><path d="M16 9.5l5 5M21 9.5l-5 5" class="s"/>',
    shop:     '<path d="M4 9.5 5.5 4.5h13L20 9.5" class="s"/><path d="M4 9.5c0 1.6 1.2 2.6 2.7 2.6S9.3 11.1 9.3 9.5c0 1.6 1.2 2.6 2.7 2.6s2.7-1 2.7-2.6c0 1.6 1.2 2.6 2.6 2.6S20 11.1 20 9.5" class="s"/><path d="M5.5 12v7.5h13V12M10 19.5v-4.5h4v4.5" class="s"/>',
    shirt:    '<path d="M8.5 4 4 6.5l1.8 4 2.2-.9V20h8V9.6l2.2.9L20 6.5 15.5 4c-.5 1.6-1.8 2.6-3.5 2.6S9 5.6 8.5 4z" class="s"/>',
    heart:    '<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" class="s"/>',
    trophy:   '<path d="M8 4.5h8v5a4 4 0 0 1-8 0z" class="s"/><path d="M8 6.5H5a2.8 2.8 0 0 0 3 4M16 6.5h3a2.8 2.8 0 0 1-3 4M12 13.5v3M8.5 19.5h7M10 16.5h4v3h-4z" class="s"/>',
    save:     '<path d="M5 4.5h11l3 3v12H5z" class="s"/><path d="M8 4.5v5h7v-5M8 19.5v-5h8v5" class="s"/>',
    book:     '<path d="M12 6.5C10 5 7.5 4.6 4.5 5v13c3-.4 5.5 0 7.5 1.5 2-1.5 4.5-1.9 7.5-1.5V5c-3-.4-5.5 0-7.5 1.5zM12 6.5v13" class="s"/>',
    trash:    '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 10.5v6M13.5 10.5v6" class="s"/>',
    dots:     '<circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/>',
    home:     '<path d="M4 11 12 4.5 20 11M6.5 9.2v10.3h11V9.2M10 19.5v-5h4v5" class="s"/>',
    retry:    '<path d="M18.5 8.5A7 7 0 1 0 19 13" class="s"/><path d="M19.5 4.5v4.5H15" class="s"/>',
    palette:  '<path d="M12 4a8 8 0 0 0 0 16c1.2 0 1.6-.8 1.3-1.7-.4-1 .3-2.1 1.4-2.1H17a3 3 0 0 0 3-3A8 8 0 0 0 12 4z" class="s"/><circle cx="8" cy="11" r="1.2"/><circle cx="11" cy="7.8" r="1.2"/><circle cx="15" cy="8.2" r="1.2"/>',
    person:   '<circle cx="12" cy="8" r="3.6" class="s"/><path d="M5 20c.6-4 3.4-6.2 7-6.2s6.4 2.2 7 6.2" class="s"/>',
    lock:     '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2" class="s"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" class="s"/>',
    cap:      '<path d="M12 5 2.5 9.5 12 14l9.5-4.5z"/><path d="M6.5 11.5v4c1.5 1.6 3.4 2.4 5.5 2.4s4-.8 5.5-2.4v-4M21.5 9.5v5" class="s"/>',
    up:       '<path d="M12 19V6M6.5 11 12 5.5 17.5 11" class="s"/>',
    install:  '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2" class="s"/><path d="M12 7v7.5M9 11.5l3 3 3-3M10.5 18.5h3" class="s"/>',
    flag:     '<path d="M6 20.5V4.5M6 5h11l-2.2 3.5L17 12H6" class="s"/>',
  };
  function svg(name, size) {
    const s = size || 18, body = (P[name] || '').replace(/ class="s"/g, ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"').replace(/ fill-op="1"/g, ' fill="currentColor"');
    return `<svg class="icn" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
  }
  /** data-icon="이름" 이 붙은 버튼 앞에 아이콘을 넣는다 (글자는 그대로) */
  function apply(rootEl) {
    for (const el of (rootEl || document).querySelectorAll('[data-icon]')) {
      if (el.dataset.iconDone) continue;
      el.dataset.iconDone = '1';
      const label = el.textContent.trim();
      const sz = +el.dataset.iconSize || 18, ic = el.dataset.iconColor !== undefined ? color(el.dataset.icon, sz) : svg(el.dataset.icon, sz);
      el.innerHTML = ic + (label ? `<span>${label}</span>` : '');
    }
  }
  /* ---------- 컬러 아이콘 (게임 메뉴용): 색을 채운 그림 + 진한 외곽선 + 윗면 빛 ---------- */
  const O = 'stroke="#1c1930" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
  const HI = (d) => `<path d="${d}" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.4" stroke-linecap="round"/>`;
  const C = {
    shop: `<path d="M4.5 10.5h15v9a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" fill="#ffd36b" ${O}/><path d="M9.5 20.5v-5h5v5" fill="#8a5a3c" ${O}/>`
        + `<path d="M3 10.5 5 4.5h14l2 6z" fill="#fff" ${O}/><path d="M5 4.5 3 10.5h3.6l1.2-6zM10.6 4.5l-.6 6h4l-.6-6zM16.2 4.5l1.2 6H21l-2-6z" fill="#ff5d6c"/>`
        + `<path d="M3 10.5 5 4.5h14l2 6z" fill="none" ${O}/><path d="M3 10.5c0 1.5 1.3 2.4 2.7 2.4s2.6-.9 2.6-2.4c0 1.5 1.3 2.4 2.7 2.4h2c1.4 0 2.7-.9 2.7-2.4 0 1.5 1.2 2.4 2.6 2.4s2.7-.9 2.7-2.4" fill="none" ${O}/>`,
    shirt: `<path d="M8.4 3.8 3.5 6.6l1.9 4.3 2.4-.9v10.5h8.4V10l2.4.9 1.9-4.3-4.9-2.8c-.6 1.7-1.9 2.6-3.6 2.6S9 5.5 8.4 3.8z" fill="#5b8cff" ${O}/>`
        + `<path d="M10 4.3c.5 1 1.1 1.4 2 1.4s1.5-.4 2-1.4" fill="none" stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"/>` + HI('M8.6 11v4'),
    heart: `<path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.8-8 10.6-8 10.6z" fill="#ff6fa3" ${O}/>` + HI('M6.8 9.2a2.3 2.3 0 0 1 2.4-2')
        + `<path d="M19.5 2.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#ffe66b" ${O.replace('1.5', '0.8')}/>`,
    trophy: `<path d="M7.5 6H4.3a3 3 0 0 0 3.5 4.6M16.5 6h3.2a3 3 0 0 1-3.5 4.6" fill="none" ${O}/><path d="M7 3.5h10v5.5a5 5 0 0 1-10 0z" fill="#ffc83d" ${O}/>`
        + `<path d="M10.5 13.6h3v3h-3z" fill="#e0a12a" ${O}/><path d="M7.5 16.6h9l.8 3.9H6.7z" fill="#9a6a3c" ${O}/>` + HI('M9.3 5.3v3.4') + `<path d="M12 6l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="#fff6c8"/>`,
    save: `<path d="M4 4.5h12.5l3.5 3.5v12a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5z" fill="#7b6cf0" ${O}/><path d="M7.5 4.5h8v5h-8z" fill="#dfe4ff" ${O}/><path d="M13 5.8v2.4" stroke="#1c1930" stroke-width="1.5"/>`
        + `<path d="M6.5 13h11v7.5h-11z" fill="#fff" ${O}/><path d="M8.5 15.5h7M8.5 18h5" stroke="#9aa3c8" stroke-width="1.2" stroke-linecap="round"/>`,
    book: `<path d="M12 6.4C10 4.9 7.3 4.4 3.8 4.8v13.6c3.5-.4 6.2.1 8.2 1.6z" fill="#7fd6a0" ${O}/><path d="M12 6.4c2-1.5 4.7-2 8.2-1.6v13.6c-3.5-.4-6.2.1-8.2 1.6z" fill="#6fb8ff" ${O}/>`
        + `<path d="M6 8.3c1.6-.1 3 .2 4.2.8M6 11.3c1.6-.1 3 .2 4.2.8M13.8 9.1c1.2-.6 2.6-.9 4.2-.8M13.8 12.1c1.2-.6 2.6-.9 4.2-.8" stroke="rgba(28,25,48,.45)" stroke-width="1.1" stroke-linecap="round" fill="none"/>`,
    map: `<path d="M3.5 6.2 8.7 4l6.6 2.4 5.2-2.2v13.6l-5.2 2.2-6.6-2.4-5.2 2.2z" fill="#f3e3b5" ${O}/><path d="M8.7 4v13.6M15.3 6.4V20" stroke="#1c1930" stroke-width="1.2" fill="none" stroke-dasharray="1.6 1.4"/>`
        + `<path d="M16.5 4.6a2.7 2.7 0 0 1 2.7 2.7c0 2-2.7 4.6-2.7 4.6s-2.7-2.6-2.7-4.6a2.7 2.7 0 0 1 2.7-2.7z" fill="#ff5d6c" ${O}/><circle cx="16.5" cy="7.3" r="1" fill="#fff"/>`,
    play: `<path d="M8 4.8v14.4a1 1 0 0 0 1.5.86l11.2-7.2a1 1 0 0 0 0-1.72L9.5 3.94A1 1 0 0 0 8 4.8z" fill="#fff" ${O}/>`,
    home: `<path d="M5.5 10.5v9.5h13v-9.5" fill="#ffe0a8" ${O}/><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#ff7a45" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11.5 12 4l9 7.5" fill="none" ${O}/><path d="M10 20v-5h4v5" fill="#8a5a3c" ${O}/>`,
    coin: `<circle cx="12" cy="12" r="8.6" fill="#ffc83d" ${O}/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#e09a1f" stroke-width="1.4"/><path d="M12 8.2 7 10.6l5 2.4 5-2.4zM9 11.8v2c.8.8 1.8 1.2 3 1.2s2.2-.4 3-1.2v-2" fill="#5a3d1c"/>` + HI('M7.4 8.6a5.8 5.8 0 0 1 3-2.2'),
  };
  // 학점이 쌓일수록 자라는 아이콘: 동전 더미 · 금화 주머니 · 금괴 · 보물상자
  const COIN1 = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.42}" fill="#ffc83d" ${O}/><ellipse cx="${x}" cy="${y - 0.4}" rx="${r * 0.62}" ry="${r * 0.24}" fill="none" stroke="#e09a1f" stroke-width="1"/>`;
  C.coins = `<path d="M4 18.2v-2.6M13 18.2v-2.6" stroke="#1c1930" stroke-width="1.5"/><rect x="4" y="15.6" width="9" height="2.6" fill="#f0a92b"/>` + COIN1(8.5, 18.3, 4.5) + COIN1(8.5, 15.6, 4.5) + COIN1(8.5, 12.9, 4.5)
    + COIN1(15.6, 18.3, 4.5) + COIN1(15.6, 15.6, 4.5) + `<circle cx="16.5" cy="8" r="4.4" fill="#ffc83d" ${O}/><path d="M16.5 5.6v4.8M15 7h2.6a1 1 0 0 1 0 2H15" fill="none" stroke="#b5741a" stroke-width="1.1" stroke-linecap="round"/>`;
  C.pouch = `<path d="M8.5 7.5c-3.6 2-5 5.6-4.4 9 .5 2.6 3.2 4 7.9 4s7.4-1.4 7.9-4c.6-3.4-.8-7-4.4-9z" fill="#c98a4b" ${O}/><path d="M8.2 7.6 7 4.6c1.6.6 3.3.4 5-.4 1.7.8 3.4 1 5 .4l-1.2 3z" fill="#e2a868" ${O}/>`
    + `<path d="M8 7.8h8" stroke="#7a4a22" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="14.5" r="3.6" fill="#ffc83d" ${O}/><path d="M12 12.4v4.2M10.7 13.6h2.3a.9.9 0 0 1 0 1.8h-2.3" fill="none" stroke="#b5741a" stroke-width="1" stroke-linecap="round"/>` + HI('M7 12.5a5 5 0 0 1 1.6-2.6');
  const BAR = (x, y) => `<path d="M${x} ${y}h7.6l1.6 3.6H${x - 1.6}z" fill="#ffcf4a" ${O}/><path d="M${x + 0.6} ${y + 0.9}h6.2" stroke="rgba(255,255,255,.75)" stroke-width="1" stroke-linecap="round"/>`;
  C.gold = BAR(4.4, 15.4) + BAR(13.6, 15.4) + BAR(9, 11.6) + BAR(9, 7.8).replace('#ffcf4a', '#ffe07a')
    + `<path d="M20.2 3.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#fff6c8"/>`;
  C.chest = `<path d="M3.5 11h17v9a.8.8 0 0 1-.8.8H4.3a.8.8 0 0 1-.8-.8z" fill="#b0652e" ${O}/><path d="M3.5 11c0-3.6 2.6-6 8.5-6s8.5 2.4 8.5 6z" fill="#c8793a" ${O}/>`
    + `<path d="M5.2 7.3c1.6-1 3.7-1.4 6.8-1.4s5.2.4 6.8 1.4" fill="none" stroke="#ffc83d" stroke-width="1.4"/><path d="M3.5 11h17M8 5.6V20.8M16 5.6V20.8" stroke="#ffc83d" stroke-width="1.6" fill="none"/>`
    + `<path d="M3.5 11h17" stroke="#1c1930" stroke-width="1"/><rect x="10.3" y="10" width="3.4" height="4.2" rx=".8" fill="#ffe07a" ${O}/><circle cx="12" cy="11.8" r=".7" fill="#1c1930"/>`
    + `<path d="M5 4.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5zM19.4 2.6l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff6c8"/>`;
  /** 컬러 아이콘 (메뉴·상점 버튼용). 없는 이름이면 선 아이콘 */
  function color(name, size) {
    const s = size || 22; if (!C[name]) return svg(name, s);
    return `<svg class="icn cicn" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${C[name]}</svg>`;
  }
  root.Icons = { svg, color, apply, names: Object.keys(P), colorNames: Object.keys(C) };
})(typeof window !== 'undefined' ? window : globalThis);
