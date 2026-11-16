/* 07 心潮念 · 雨夜街道
   底图 assets/xinchao/street.jpg（864×1872），叠层 SVG 用底图坐标。
   11 块竖灯牌 = 驱力，右边大屏 = 情绪，左边粉屏 = 今天的心情，连廊跑马灯 = 在做什么/在想什么，
   两盏路灯 = 安全感/自信，飞车 = 梦，卷帘门涂鸦 = 常说的词。默认什么卡都没有，点了才出现。
   想换底图：换 street.jpg，再改下面 SPOTS 里的坐标（灯牌、大屏、粉屏、连廊、路灯、飞车、涂鸦的位置）。 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;
  const IMG_W = 864, IMG_H = 1872;

  // —— 底图上各个东西的位置（底图像素坐标）——
  const SPOTS = {
    // 11 块驱力灯牌，按强弱顺序分配：左大列 4 → 右列 4 → 左小列 3。[x, y, 宽, 高, 哪一列]
    signs: [
      [88, 288, 54, 147, 'L'], [88, 453, 54, 145, 'L'], [88, 617, 54, 147, 'L'], [88, 782, 54, 150, 'L'],
      [572, 660, 28, 70, 'R'], [572, 742, 28, 68, 'R'], [572, 822, 28, 68, 'R'], [572, 902, 28, 68, 'R'],
      [234, 577, 34, 81, 'M'], [234, 672, 34, 82, 'M'], [234, 766, 34, 82, 'M']
    ],
    // 没分到驱力的空灯牌（暗着，偶尔闪）
    spare: [[234, 862, 34, 80], [234, 956, 34, 80], [234, 1050, 34, 78], [572, 982, 28, 68], [572, 1062, 28, 68]],
    billboard: '655,725 808,405 808,1125 655,1185', billboardM: 'matrix(1.02 -0.8 0 1 655 840)',
    pinkScreen: '100,940 197,838 197,1212 100,1212', pinkM: 'matrix(1 -1.0515 0 1 100 940)',
    bridge: { x: 276, y: 862, w: 292, h: 26, hit: [270, 830, 305, 90] },
    lamps: [[316, 1118, 250, 390, 1420], [552, 1114, 480, 620, 1420]],
    car: [350, 314],
    wall: [760, 1280, 80, 170]
  };

  const rnd = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  const dur = (ms) => { const h = Math.floor(ms / 3600000); return h ? h + ' 小时' : Math.max(1, Math.round(ms / 60000)) + ' 分钟'; };
  const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const X = 'M6 6l12 12M18 6L6 18';

  function cityHTML(m, x, sel) {
    const s = x.snapshot || {}, now = x.now || {};
    const pink = N.resolveColor('--pink'), cyan = N.resolveColor('--cyan'), lilac = N.resolveColor('--lilac');
    const drives = (s.drives || []).slice().sort((a, b) => b.value - a.value).slice(0, 11);
    const signs = drives.map((d, i) => {
      const [sx, sy, w, h, side] = SPOTS.signs[i]; const v = m.on ? d.value : 0.05;
      const c = !m.on ? N.resolveColor('--off') : i === 0 ? pink : i === 1 ? cyan : i === 2 ? lilac : side === 'R' ? cyan : side === 'L' ? pink : lilac;
      const fs = side === 'L' ? 30 : side === 'R' ? 17 : 20;
      const chars = [...(d.label || '')].slice(0, 3); const gap = fs * 1.12, top = sy + (h - gap * chars.length) / 2 + fs * 0.92;
      const cls = v < 0.1 ? 'dead' : v < 0.2 ? 'flicker' : '';
      return `<g class="hit" data-x="drive" data-i="${i}" role="button" tabindex="0" aria-label="驱力 ${E(d.label)}">
        <rect x="${sx - 2}" y="${sy - 2}" width="${w + 4}" height="${h + 4}" fill="#0E0820"/>
        <g class="${cls}" style="opacity:${(0.35 + v * 0.65).toFixed(2)};filter:drop-shadow(0 0 ${Math.round(4 + v * 16)}px ${c})">
          <rect x="${sx + 2}" y="${sy + 2}" width="${w - 4}" height="${h - 4}" fill="${N.alpha(c, 0.12 + v * 0.3)}" stroke="${c}" stroke-width="${side === 'L' ? 3 : 2}"/>
          ${chars.map((t, j) => `<text x="${sx + w / 2}" y="${(top + j * gap).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${v > 0.25 ? '#fff' : c}" style="font-family:var(--font)">${E(t)}</text>`).join('')}
        </g>
        ${sel && sel.k === 'drive' && sel.i === i ? `<rect class="sel" x="${sx - 2}" y="${sy - 2}" width="${w + 4}" height="${h + 4}"/>` : ''}
      </g>`;
    }).join('');
    const spare = SPOTS.spare.map(([sx, sy, w, h], i) => `<rect x="${sx - 2}" y="${sy - 2}" width="${w + 4}" height="${h + 4}" fill="#0E0820"/><rect x="${sx - 2}" y="${sy - 2}" width="${w + 4}" height="${h + 4}" fill="${N.alpha([lilac, pink, lilac, cyan, pink][i], 0.35)}" class="dead" style="animation-delay:${-i * 0.7}s"/>`).join('');

    const r = rnd(11); let rain = '';
    const nRain = Math.round(30 + (m.on ? m.intensity : 0.2) * 70);
    for (let i = 0; i < nRain; i++) { const rx = r() * 1000, ry = r() * 1800; rain += `<line x1="${rx.toFixed(0)}" y1="${ry.toFixed(0)}" x2="${(rx - 6).toFixed(0)}" y2="${(ry + 34).toFixed(0)}" style="animation-duration:${(0.7 + r() * 0.6 - (m.on ? m.intensity : 0) * 0.25).toFixed(2)}s;animation-delay:${(-r() * 2).toFixed(2)}s"/>`; }

    const word = [...(m.on ? m.word : '—')];
    const marks = (s.emotion?.marks || []).slice(-4);
    const ticker = m.on ? `▸ ${now.doing || ''} · ${now.thought || ''} · ${(now.lines || [])[0] || ''}　　▸ ${now.doing || ''} · ${now.thought || ''}` : '▸ 心潮念未连接';
    const kw = (s.keywords || [])[0] || '';
    const L = SPOTS.lamps, B = SPOTS.bridge, [cx, cy] = SPOTS.car, W = SPOTS.wall;
    const sec = s.stamen?.security ?? 0.3, conf = s.stamen?.confidence ?? 0.3;
    const rainCol = N.mix(N.resolveColor('--cyan'), '#F3D6FF', m.on ? m.warm : 0.5);

    return `<defs>
        <linearGradient id="xsBill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.color}" stop-opacity=".95"/><stop offset="1" stop-color="#160A2E" stop-opacity=".95"/></linearGradient>
        <linearGradient id="xsPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pink}" stop-opacity=".85"/><stop offset="1" stop-color="#2A0F3F" stop-opacity=".95"/></linearGradient>
        <radialGradient id="xsCone" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#FFF4D6" stop-opacity=".75"/><stop offset="1" stop-color="#FFF4D6" stop-opacity="0"/></radialGradient>
        <pattern id="xsScan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.5" fill="#000" opacity=".35"/></pattern>
        <clipPath id="xsBridge"><rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}"/></clipPath>
        <filter id="xsBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
      </defs>
      <g filter="url(#xsBlur)" class="shimmer" style="mix-blend-mode:screen;pointer-events:none">
        <ellipse cx="170" cy="1720" rx="80" ry="150" fill="${pink}" opacity=".5"/><ellipse cx="690" cy="1740" rx="90" ry="140" fill="${cyan}" opacity=".5"/><ellipse cx="440" cy="1620" rx="50" ry="200" fill="${m.color}" opacity=".35"/>
      </g>
      ${signs}${spare}
      <g class="hit" data-x="tower" role="button" tabindex="0" aria-label="情绪大屏">
        <polygon points="${SPOTS.billboard}" fill="#0A0A1E"/>
        <g class="${m.mixed ? 'glitch' : ''}">
          <polygon points="${SPOTS.billboard}" fill="url(#xsBill)" opacity="${m.on ? (0.45 + m.intensity * 0.5).toFixed(2) : 0.25}"/>
          <g transform="${SPOTS.billboardM}">
            ${word.slice(0, 2).map((w, i) => `<text x="75" y="${70 + i * 84}" text-anchor="middle" font-size="68" font-weight="300" fill="#fff" style="font-family:var(--font);filter:drop-shadow(0 0 10px ${m.color})">${E(w)}</text>`).join('')}
            <text x="75" y="206" text-anchor="middle" font-size="16" letter-spacing="3" fill="#fff" opacity=".75" style="font-family:var(--font-mono)">XINCHAO // ${m.on ? Math.round(m.intensity * 100) : '--'}</text>
            <rect x="40" y="220" width="70" height="4" fill="#fff" opacity=".25"/><rect x="40" y="220" width="${m.on ? Math.round(m.intensity * 70) : 0}" height="4" fill="#fff"/>
            <g class="scan"><rect x="0" y="-60" width="150" height="40" fill="#fff" opacity=".08"/></g>
          </g>
          <polygon points="${SPOTS.billboard}" fill="url(#xsScan)"/>
        </g>
      </g>
      <g class="hit" data-x="today" role="button" tabindex="0" aria-label="今天亮过的心情">
        <polygon points="${SPOTS.pinkScreen}" fill="#0A0A1E"/><polygon points="${SPOTS.pinkScreen}" fill="url(#xsPink)" class="shimmer"/>
        <g transform="${SPOTS.pinkM}"><text x="48" y="60" text-anchor="middle" font-size="13" letter-spacing="2" fill="#fff" opacity=".8" style="font-family:var(--font-mono)">TODAY</text>
          ${marks.map((k, i) => `<text x="48" y="${100 + i * 34}" text-anchor="middle" font-size="22" fill="#fff" opacity="${(0.5 + 0.5 * (i + 1) / marks.length).toFixed(2)}" style="font-family:var(--font)">${E(k.word)}</text>`).join('')}</g>
        <polygon points="${SPOTS.pinkScreen}" fill="url(#xsScan)"/>
      </g>
      <g class="hit" data-x="now" role="button" tabindex="0" aria-label="他在做什么、在想什么">
        <rect x="${B.hit[0]}" y="${B.hit[1]}" width="${B.hit[2]}" height="${B.hit[3]}" fill="transparent"/>
        <rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" fill="#05030E" opacity=".85"/>
        <g clip-path="url(#xsBridge)"><text x="${B.x + B.w}" y="${B.y + 19}" font-size="16" fill="#FFE7A8" class="tick" style="font-family:var(--font);filter:drop-shadow(0 0 4px #FFD36B)">${E(ticker)}</text></g>
      </g>
      <g class="hit" data-x="lights" role="button" tabindex="0" aria-label="安全感和自信" style="mix-blend-mode:screen">
        ${L.map(([x, y, l, rr, b], i) => { const o = (0.2 + (i ? conf : sec) * 0.8).toFixed(2); return `<polygon points="${x},${y} ${l},${b} ${rr},${b}" fill="url(#xsCone)" opacity="${o}"/><circle cx="${x}" cy="${y - 1}" r="7" fill="#FFF4D6" opacity="${o}"/>`; }).join('')}
      </g>
      <g class="hit drift" data-x="dreams" role="button" tabindex="0" aria-label="梦">
        <path d="M${cx - 100} ${cy - 14} L${cx - 20} ${cy - 2}" stroke="${cyan}" stroke-width="2" opacity=".6"/>
        <ellipse cx="${cx}" cy="${cy}" rx="26" ry="8" fill="#1A1236" stroke="${pink}" stroke-width="1.5"/><rect x="${cx - 14}" y="${cy - 8}" width="20" height="5" fill="${pink}"/><circle cx="${cx + 24}" cy="${cy + 1}" r="3" fill="#fff"/>
        <rect x="${cx - 30}" y="${cy - 24}" width="70" height="40" fill="transparent"/>
      </g>
      <g class="hit" data-x="words" role="button" tabindex="0" aria-label="常说的词">
        <rect x="${W[0]}" y="${W[1]}" width="${W[2]}" height="${W[3]}" fill="transparent"/>
        <g transform="rotate(-9 800 1360)"><text x="800" y="1350" text-anchor="middle" font-size="26" font-weight="700" fill="none" stroke="${pink}" stroke-width="1.5" style="font-family:var(--font);filter:drop-shadow(0 0 5px ${pink})">${E(kw)}</text>
          <path d="M772 1366 q14 -10 28 0 t28 -4" fill="none" stroke="${cyan}" stroke-width="2"/></g>
      </g>
      <g class="rain" stroke="${rainCol}" stroke-width="1.6" opacity="${(0.25 + (m.on ? m.intensity : 0.2) * 0.35).toFixed(2)}" style="pointer-events:none">${rain}</g>`;
  }

  async function cardHTML(k, i, m, x) {
    const s = x.snapshot || {}, now = x.now || {};
    const drives = (s.drives || []).slice().sort((a, b) => b.value - a.value);
    const head = (tag, cc) => `<div class="hd"><span>${tag}</span><button type="button" data-close aria-label="关闭"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${X}"/></svg></button></div>`;
    const pink = N.resolveColor('--pink'), cyan = N.resolveColor('--cyan'), lilac = N.resolveColor('--lilac');
    if (!m.on) return { cc: N.resolveColor('--off'), html: head('◢ XINCHAO // OFFLINE') + '<p class="xc-p">心潮念还没连上。在「设置 → 01 接入」里填心潮念的地址，这条街就会亮起来。</p>' };
    if (k === 'drive') {
      const d = drives[i]; const cc = i === 0 ? pink : i === 1 ? cyan : i === 2 ? lilac : SPOTS.signs[i][4] === 'R' ? cyan : SPOTS.signs[i][4] === 'L' ? pink : lilac;
      const hst = await N.api.driveHistory(d.key, d.value);
      const pts = hst.points || [];
      const path = pts.map((v, j) => (j ? 'L' : 'M') + (j * 330 / Math.max(1, pts.length - 1)).toFixed(1) + ' ' + (46 - v * 42).toFixed(1)).join('');
      return { cc, html: head('◢ DRIVE // 灯牌') + `<div class="xc-big"><b>${E(d.label)}</b><span class="v">${Math.round(d.value * 100)}</span><em>第 ${i + 1} / ${drives.length}</em></div>
        ${pts.length ? `<svg class="xc-spark" viewBox="0 0 330 48" preserveAspectRatio="none" aria-hidden="true"><path d="M0 47 H330" stroke="var(--line-soft)"/><path d="${path}" fill="none" stroke="${cc}" stroke-width="1.5"/></svg><div class="xc-axis"><span>24H AGO</span><span>NOW</span></div>` : ''}
        ${hst.why ? `<p class="xc-p">${E(hst.why)}</p>` : ''}` };
    }
    if (k === 'tower') return { cc: m.color, html: head('◢ EMOTION // 大屏') + `<div class="xc-big emo"><b>${E(m.word)}</b><span>强度 ${Math.round(m.intensity * 100)}</span></div>
      ${m.mixed ? `<span class="xc-mixed">◇ ${E(m.mixed.name)}${m.mixed.since ? ' · 已经 ' + dur(Date.now() - m.mixed.since) : ''}</span>` : ''}
      <div class="xc-scale">冷<i><b style="left:${Math.round(m.warm * 100)}%"></b></i>暖</div>` };
    if (k === 'today') {
      const mk = s.emotion?.marks || [];
      return { cc: pink, html: head('◢ TODAY // 今天亮过的心情') + (mk.length ? `<div class="xc-marks">${mk.map((a) => `<div><i>${hm(a.at)}</i><b style="color:${a.word === m.word ? m.color : pink}">${E(a.word)}</b><span>${E(a.why || '')}</span></div>`).join('')}</div>` : '<p class="xc-empty">今天还没有亮过别的心情</p>') };
    }
    if (k === 'lights') return { cc: '#FFD36B', html: head('◢ CORE // 两盏路灯') + [['安全感', s.stamen?.security], ['自信', s.stamen?.confidence]].map(([n, v]) => `<div class="xc-meter"><b>${n}</b><i><span style="width:${Math.round((v ?? 0) * 100)}%"></span></i><em>${Math.round((v ?? 0) * 100)}</em></div>`).join('') + '<p class="xc-p">左边那盏是安全感，右边是自信。灯越亮他越安心、越有底气。</p>' };
    if (k === 'now') return { cc: '#FFD36B', html: head('◢ NOW // 连廊跑马灯') + `<span class="xc-now">NOW ▸ ${E(now.doing || '—')}</span>${(now.lines || []).map((l) => `<p class="xc-line">${E(l)}</p>`).join('')}${now.thought ? `<p class="xc-thought">冒出来的念头：${E(now.thought)}</p>` : ''}` };
    if (k === 'dreams') { const ds = s.dreams || []; return { cc: pink, html: head('◢ DREAMS // 飞车') + (ds.length ? ds.slice(0, 5).map((d) => `<div class="xc-dream"><i>${N.time(d.at)} ${hm(d.at)}</i><span>${E(d.text)}</span></div>`).join('') : '<p class="xc-empty">最近没有梦</p>') }; }
    if (k === 'words') { const ks = s.keywords || []; return { cc: pink, html: head('◢ WORDS // 涂鸦') + (ks.length ? `<div class="xc-words">${ks.map((w, j) => `<span style="--kc:${[pink, cyan, '#FFD36B'][j % 3]};transform:rotate(${[-4, 3, -2][j % 3]}deg)">${E(w)}</span>`).join('')}</div>` : '<p class="xc-empty">还没有常说的词</p>') }; }
    return null;
  }

  N.pages = N.pages || {};
  N.pages.xinchao = async function (root) {
    let x = await N.api.xinchao();
    let m = N.mood(x);
    let sel = null;
    root.className = 'page pg-xc';
    root.innerHTML = `
      <div class="xc-stage">
        <img src="assets/xinchao/street.jpg" alt="" draggable="false">
        <div class="xc-tint" aria-hidden="true"></div>
        <svg viewBox="0 0 ${IMG_W} ${IMG_H}" role="img" aria-label="心潮念：雨夜的街，灯牌是他的驱力，大屏是他的情绪"></svg>
      </div>
      <div class="xc-title"><span>◢ XINCHAO // ${hm(Date.now())}</span><b>心潮念</b></div>
      ${N.tabbar('xinchao')}`;
    const stage = root.querySelector('.xc-stage'), svg = stage.querySelector('svg'), tint = stage.querySelector('.xc-tint');

    // 底图等比铺满（多出来的裁掉）
    const fit = () => {
      const W = root.clientWidth, H = root.clientHeight; if (!W || !H) return;
      const s = Math.max(W / IMG_W, H / IMG_H);
      Object.assign(stage.style, { width: IMG_W * s + 'px', height: IMG_H * s + 'px', left: (W - IMG_W * s) / 2 + 'px', top: (H - IMG_H * s) / 2 + 'px' });
    };
    const paint = () => {
      svg.innerHTML = cityHTML(m, x, sel);
      tint.style.background = m.on ? `linear-gradient(180deg, ${m.color}, ${N.mix(m.color, '#000000', 0.4)})` : '#555';
      tint.style.opacity = m.on ? (0.35 + Math.abs(m.mood) * 0.35).toFixed(2) : 0.6;
      root.querySelector('.xc-off-tip')?.remove();
      if (!m.on) root.insertAdjacentHTML('beforeend', '<div class="xc-off-tip">心潮念未连接 · <a href="#/settings">去设置填地址</a></div>');
    };
    paint();

    async function open(k, i) {
      root.querySelector('.xc-card')?.remove();
      sel = { k, i }; paint();
      const c = await cardHTML(k, i, m, x); if (!c) return;
      root.insertAdjacentHTML('beforeend', `<section class="xc-card" aria-live="polite" style="--cc:${c.cc}"><div>${c.html}</div></section>`);
    }
    const close = () => { root.querySelector('.xc-card')?.remove(); sel = null; paint(); };

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const h = e.target.closest('[data-x]');
      if (h) return open(h.dataset.x, +(h.dataset.i || 0));
      if (!e.target.closest('.xc-card, .tabbar, a')) close();   // 点街上空白处收起卡片
    });
    root.addEventListener('keydown', (e) => {
      const h = e.target.closest('[data-x]');
      if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(h.dataset.x, +(h.dataset.i || 0)); }
      if (e.key === 'Escape') close();
    });

    // 截预览图 / 录演示用：?open=drive|tower|today|now|lights|dreams|words 直接打开那张卡
    const o = new URLSearchParams(location.search).get('open'); if (o) open(o, 0);

    // 每 5 分钟拉一次心潮念
    const timer = setInterval(async () => { x = await N.api.xinchao(); m = N.mood(x); paint(); }, 300000);
    const ro = new ResizeObserver(fit); ro.observe(root);
    return () => { clearInterval(timer); ro.disconnect(); };
  };
})(window.NEON);
