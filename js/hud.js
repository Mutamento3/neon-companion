/* HUD 边框：按当前屏幕宽高画（切角外框、粉色平行线、粗青条、准星、斜纹、棋盘格、条码、四角星）
   N.hud.list(svg)、N.hud.chat(svg, 输入面板高度)。屏幕大小变了会重画。 */
window.NEON = window.NEON || {};
(function (N) {
  let seq = 0;
  const defs = (k) => `<defs>
    <linearGradient id="hb${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="st-bar"/><stop offset="1" class="st-blue"/></linearGradient>
    <linearGradient id="hh${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="st-blue"/><stop offset="1" class="st-bar"/></linearGradient>
    <pattern id="ck${k}" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" style="fill:#F4F0FF"/><rect x="4" y="4" width="4" height="4" style="fill:#F4F0FF"/>
      <rect x="4" width="4" height="4" class="f-pink"/><rect y="4" width="4" height="4" class="f-pink"/></pattern>
    <pattern id="ht${k}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="3" height="6" class="f-pink"/></pattern>
  </defs>`;
  const star = (x, y, r, delay = 0) => `<g class="twinkle" style="animation-delay:${delay}s"><path class="star" d="M${x} ${y - r} Q${x + 1} ${y - 1} ${x + r} ${y} Q${x + 1} ${y + 1} ${x} ${y + r} Q${x - 1} ${y + 1} ${x - r} ${y} Q${x - 1} ${y - 1} ${x} ${y - r} Z"/></g>`;
  const cross = (x, y) => `<circle class="s-pink" cx="${x}" cy="${y}" r="4"/><path class="s-pink" d="M${x - 8} ${y} H${x + 8} M${x} ${y - 8} V${y + 8}"/>`;
  const tri3 = (x, y) => [0, 12, 24].map((d) => `<path class="f-cyan" d="M${x + d} ${y} l4 -7 l4 7 Z"/>`).join('');
  const barcode = (x, y) => [2, 1, 3, 1, 2, 1, 3, 1, 2, 1, 2, 3].reduce((a, w, i) => { a.s += `<rect class="f-pink" x="${a.x}" y="${y}" width="${w}" height="6"/>`; a.x += w + (i % 2 ? 2 : 1); return a; }, { s: '', x }).s;

  function size(svg) {
    const r = svg.parentElement.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    return [r.width, r.height];
  }
  // 顶部状态栏高度（和 CSS 的 --status-h 一致）
  const top = () => { const el = document.createElement('i'); el.style.cssText = 'position:absolute;height:var(--status-h)'; document.body.appendChild(el); const h = el.getBoundingClientRect().height; el.remove(); return h; };
  const safeB = () => { const el = document.createElement('i'); el.style.cssText = 'position:absolute;height:var(--safe-b)'; document.body.appendChild(el); const h = el.getBoundingClientRect().height; el.remove(); return h; };

  N.hud = {
    // 聊天列表：整屏外框
    list(svg) {
      const [w, h] = size(svg), T = top() + 8, k = ++seq;
      const navTop = h - (62 + safeB()) - 4;
      svg.innerHTML = defs(k) + `
        <path class="s-cyan" d="M8 ${h} V${T + 32} L40 ${T} H${w - 132} L${w - 124} ${T + 7} H${w - 46} L${w - 8} ${T + 44} V${h}"/>
        <path class="s-pink" d="M14 ${T + 42} L50 ${T + 6} H176"/>
        <path class="s-pink" d="M${w - 14} ${T + 512} V${Math.min(T + 648, navTop - 60)} L${w - 21} ${Math.min(T + 655, navTop - 53)} V${navTop - 16}"/>
        <path class="s-pink" d="M150 ${h - 6} H230"/>
        <path d="M8 ${T + 292} L13 ${T + 297} V${T + 404} L8 ${T + 410} Z" fill="url(#hb${k})"/>
        <path d="M${w - 8} ${T + 412} L${w - 13} ${T + 418} V${T + 486} L${w - 8} ${T + 492} Z" fill="url(#hb${k})"/>
        <path d="M${w - 118} ${T} H${w - 46} L${w - 41} ${T + 5} H${w - 123} Z" fill="url(#hh${k})"/>
        <path class="f-pink" d="M${w - 36} ${T + 5} H${w - 13} V${T + 28} Z"/>
        <path class="f-pink" d="M0 ${h - 22} V${h} H22 Z"/>
        <path class="f-pink" d="M${w} ${h - 22} V${h} H${w - 22} Z" opacity=".85"/>
        <path class="s-cyan" d="M8 ${T + 154} H176 L186 ${T + 162} H${w - 90}" style="stroke-opacity:.6"/>
        <rect x="${w - 78}" y="${T + 150}" width="56" height="8" fill="url(#ck${k})"/>
        ${cross(30, T + 222)}${cross(30, T + 254)}${cross(30, T + 286)}
        <path d="M20 ${T + 322} H40 V${T + 402} H20 Z" fill="url(#ht${k})" opacity=".85"/>
        <path class="s-cyan" d="M18 ${T + 318} V${T + 406} L24 ${T + 412}" style="stroke-opacity:.6"/>
        <path d="M${w - 16} ${T + 548} H${w - 8} V${T + 624} H${w - 16} Z" fill="url(#ht${k})" opacity=".8"/>
        ${[0, 16, 32, 48].map((d) => `<circle class="f-pink" cx="${w - 20}" cy="${T + 554 + d}" r="1.5"/>`).join('')}
        ${star(w - 24, T + 179, 10)}${star(w - 10, T + 210, 8, 1.2)}
        <path class="s-cyan" d="M0 ${navTop + 8} H118 L130 ${navTop} H${w}" style="stroke-opacity:.6"/>
        ${tri3(w - 90, navTop - 6)}
        ${barcode(44, h - 10)}
        <rect x="${w - 124}" y="${h - 10}" width="80" height="6" fill="url(#ck${k})" opacity=".9"/>`;
    },

    // 朋友圈 / 相册：外框 + 两侧零件 + 底栏上沿（比列表页简单）
    page(svg) {
      const [w, h] = size(svg), T = top() + 8, k = ++seq;
      const navTop = h - (62 + safeB()) - 4;
      svg.innerHTML = defs(k) + `
        <path class="s-cyan" d="M8 ${h} V${T + 32} L40 ${T} H${w - 132} L${w - 124} ${T + 7} H${w - 46} L${w - 8} ${T + 44} V${h}" style="stroke-opacity:.5"/>
        <path class="s-pink" d="M14 ${T + 42} L50 ${T + 6} H176"/>
        <path d="M${w - 118} ${T} H${w - 46} L${w - 41} ${T + 5} H${w - 123} Z" fill="url(#hh${k})"/>
        <path class="f-pink" d="M${w - 36} ${T + 5} H${w - 13} V${T + 28} Z"/>
        <path d="M8 ${T + 460} L13 ${T + 465} V${T + 572} L8 ${T + 578} Z" fill="url(#hb${k})"/>
        <path d="M${w - 8} ${Math.min(T + 800, navTop - 120)} L${w - 13} ${Math.min(T + 806, navTop - 114)} V${Math.min(T + 900, navTop - 20)} L${w - 8} ${Math.min(T + 906, navTop - 14)} Z" fill="url(#hb${k})"/>
        <path d="M2 ${T + 700} H8 V${T + 780} H2 Z" fill="url(#ht${k})"/>
        <path class="s-cyan" d="M0 ${navTop + 8} H118 L130 ${navTop} H${w}" style="stroke-opacity:.6"/>
        ${tri3(w - 90, navTop - 6)}
        <path class="f-pink" d="M0 ${h - 22} V${h} H22 Z"/><path class="f-pink" d="M${w} ${h - 22} V${h} H${w - 22} Z"/>
        <rect x="${w - 124}" y="${h - 10}" width="80" height="6" fill="url(#ck${k})" opacity=".9"/>`;
    },

    // 聊天页：顶栏面板 + 两侧细线 + 贴底输入面板
    chat(svg, inputH) {
      const [w, h] = size(svg), T = top() + 8, k = ++seq;
      const pTop = h - inputH;
      svg.innerHTML = defs(k) + `
        <path class="f-panel" d="M8 ${T + 28} L36 ${T} H${w - 140} L${w - 132} ${T + 6} H${w - 44} L${w - 8} ${T + 36} V${T + 58} L${w - 18} ${T + 68} H196 L186 ${T + 76} H18 L8 ${T + 66} Z"/>
        <path class="s-pink" d="M14 ${T + 38} L46 ${T + 6} H170"/>
        <path d="M${w - 124} ${T} H${w - 48} L${w - 43} ${T + 5} H${w - 129} Z" fill="url(#hh${k})"/>
        <path class="f-pink" d="M${w - 36} ${T + 5} H${w - 13} V${T + 28} Z"/>
        <rect x="${w - 90}" y="${T + 72}" width="64" height="7" fill="url(#ck${k})"/>
        <path class="s-cyan-soft" d="M8 ${T + 96} V${pTop + 8}"/>
        <path class="s-cyan-soft" d="M${w - 8} ${T + 96} V${pTop}"/>
        <path d="M8 ${T + 412} L12 ${T + 417} V${T + 522} L8 ${T + 528} Z" fill="url(#hb${k})"/>
        <path d="M${w - 8} ${Math.min(T + 812, pTop - 120)} L${w - 12} ${Math.min(T + 818, pTop - 114)} V${Math.min(T + 912, pTop - 20)} L${w - 8} ${Math.min(T + 918, pTop - 14)} Z" fill="url(#hb${k})"/>
        <path d="M3 ${T + 692} H8 V${T + 762} H3 Z" fill="url(#ht${k})"/>
        <circle class="s-pink" cx="${w - 4}" cy="${T + 292}" r="3"/><path class="s-pink" d="M${w - 10} ${T + 292} H${w + 2} M${w - 4} ${T + 286} V${T + 298}"/>
        <path class="f-panel-solid" d="M0 ${pTop + 8} H120 L132 ${pTop} H${w} V${h} H0 Z"/>
        ${tri3(w - 90, pTop - 6)}
        <path class="s-pink" d="M24 ${h - 6} H120"/>
        <path class="f-pink" d="M0 ${h - 24} V${h} H24 Z"/>`;
    }
  };
})(window.NEON);
