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
      el.innerHTML = svg(el.dataset.icon, +el.dataset.iconSize || 18) + (label ? `<span>${label}</span>` : '');
    }
  }
  root.Icons = { svg, apply, names: Object.keys(P) };
})(typeof window !== 'undefined' ? window : globalThis);
