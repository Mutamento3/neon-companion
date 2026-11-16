/* 00 聊天列表：主窗口卡（联动心潮念）+ 其他窗口（挂在刻度轨上）+ 底栏 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;

  function waveD(k, amp) {
    let d = '';
    for (let x = 0; x <= 552; x += 4) {
      const t = (x / 276) * Math.PI * 2;
      const y = 20 + amp * Math.sin(k * t) + amp * 0.28 * Math.sin(3 * k * t);
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    return d;
  }

  function mainCard(w, ctx, mood) {
    const pct = ctx ? Math.round((ctx.used / ctx.max) * 100) : 0;
    const off = w.state === 'offline';
    const via = w.via === 'terminal' ? 'TERM // ' + E(w.target || '') : 'API // ' + E(w.model || '');
    const band = mood.on ? `
      <div class="xc-band">
        <span class="dot" aria-hidden="true"></span>
        <div class="hd"><span>XINCHAO // LIVE <span class="pulse">●</span></span><span style="margin-left:auto">冷</span>
          <span class="scale" aria-hidden="true"><i style="left:${Math.round(mood.warm * 100)}%"></i></span><span>暖</span></div>
        <div class="wave" aria-hidden="true">
          <svg width="552" height="40" viewBox="0 0 552 40"><defs><linearGradient id="xcw" x1="0" x2="1">
            <stop offset="0" stop-color="${mood.color}" stop-opacity="0"/><stop offset=".12" stop-color="${mood.color}"/><stop offset=".5" stop-color="#fff"/>
            <stop offset=".62" stop-color="${mood.color}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
            ${mood.mixed ? `<g style="animation-duration:${(4.4 - mood.intensity * 2).toFixed(1)}s"><path d="${waveD((mood.mood >= 0 ? 3 : 5) + 2, (3 + mood.intensity * 13) * 0.7)}" fill="none" stroke="${mood.mixColor}" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/></g>` : ''}
            <g style="animation-duration:${(6 - mood.intensity * 4).toFixed(1)}s"><path d="${waveD(mood.mood >= 0 ? 3 : 5, 3 + mood.intensity * 13)}" fill="none" stroke="url(#xcw)" stroke-width="1.3" style="filter:drop-shadow(0 0 3px ${mood.color})"/></g>
          </svg>
          <div class="word"><b>${E(mood.word)}</b><span>${Math.round(mood.intensity * 100)}</span></div>
        </div>
        <div class="chips">
          ${mood.top ? `<span class="chip">▲ ${E(mood.top.label)} <b>${Math.round(mood.top.value * 100)}</b></span>` : ''}
          ${mood.mixed ? `<span class="chip mixed">◇ ${E(mood.mixed.name)}</span>` : ''}
        </div>
        ${mood.thought ? `<p class="xc-think ell"><span>THINK ▸ </span>${E(mood.thought)}</p>` : ''}
      </div>` : `<div class="xc-off"><span>XINCHAO // —</span>心潮念未连接 · 去设置填地址</div>`;

    return `
    <div class="l-main" style="--mood:${mood.color};--mood-glow:${mood.glow};--mix:${mood.mixColor || 'transparent'}">
      <div class="glow">
        <a class="card" href="#/chat/${E(w.id)}" aria-label="打开主窗口：${E(w.name)}">
          <div class="in">
            <div class="top">
              <div class="av-col">
                <div class="av">${w.avatar ? `<img src="${E(w.avatar)}" alt="">` : 'TA'}</div>
                <div class="slices slide" aria-hidden="true"><i></i><i></i><i></i></div>
                <div class="stem" aria-hidden="true"><i style="top:${Math.round((1 - (mood.on ? mood.intensity : 0.5)) * 70)}%"></i></div>
              </div>
              <div class="info">
                <div class="row1"><b>MAIN / 01</b><span>${N.time(w.time)}</span></div>
                <span class="name ell">${E(w.name)}</span>
                <span class="state${off ? ' off' : ''}"><span class="pulse">●</span> ${off ? 'OFFLINE' : 'ONLINE'}${mood.on && mood.doing ? ' · ' + E(mood.doing) : w.state === 'busy' ? ' · 正在输入…' : ''}</span>
                <p class="prev">${E(w.last || '还没有消息')}</p>
              </div>
            </div>
            ${band}
            <div class="meta"><span class="ell" style="min-width:0">${via}</span><span style="margin-left:auto">CTX</span>
              <span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span><b>${pct}%</b></div>
          </div>
        </a>
      </div>
      <span class="p-bar" aria-hidden="true"></span><span class="p-top" aria-hidden="true"></span>
      <span class="p-line" aria-hidden="true"></span><span class="p-tri" aria-hidden="true"></span>
      ${w.unread ? `<span class="unread" aria-label="${w.unread} 条未读">${w.unread}</span>` : ''}
    </div>`;
  }

  function row(w, i) {
    const cls = w.state === 'pending' ? ' pending' : w.state === 'offline' ? ' off' : '';
    const term = w.via === 'terminal';
    return `<li class="l-row${cls}">
      <span class="node" aria-hidden="true"></span>
      <a href="#/chat/${E(w.id)}" aria-label="打开 ${E(w.name)}">
        <span class="num">${String(i + 2).padStart(2, '0')}</span>
        <div class="mid">
          <div class="l1"><span class="nm ell">${E(w.name)}</span><span class="kind ${term ? 'term' : 'api'}">${term ? 'TERM' : 'API'}</span>
            ${w.state === 'pending' ? '<span class="pend pulse">◆ 待批准</span>' : ''}</div>
          <span class="pv ell">${E(w.state === 'busy' ? '回复中…' : w.last || '还没有消息')}</span>
        </div>
        ${w.unread ? `<span class="ur">${w.unread}</span>` : `<span class="tm">${N.time(w.time)}</span>`}
      </a></li>`;
  }

  N.pages = N.pages || {};
  N.pages.list = async function (root) {
    const [profile, wins, xc] = await Promise.all([N.api.profile(), N.api.windows(), N.api.xinchao()]);
    const main = wins.find((w) => w.kind === 'companion');
    const others = wins.filter((w) => w.kind !== 'companion');
    const ctx = main ? await N.api.context(main.id) : null;
    const linked = wins.filter((w) => w.state !== 'offline').length;

    root.className = 'page pg-list';
    root.innerHTML = `
      <div class="page-glow" aria-hidden="true"></div>
      <svg class="hud" aria-hidden="true"></svg>
      <div class="scroll">
        <div class="l-emblem" aria-hidden="true"><span class="ring"><i></i></span><span class="ladder"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="stem"></span><span class="foot"></span></div>
        <header class="l-hd">
          <div style="min-width:0">
            <span class="tag">◢ CH.LIST — <em>${String(linked).padStart(2, '0')} LINKED</em><span class="blink">_</span></span>
            <h1 class="ell">${E(profile.appName)}</h1>
            <span class="sub">CHANNELS<i></i><span>聊天</span></span>
          </div>
          <div class="right">
            <div class="model"><div class="logo-box" role="img" aria-label="当前模型：${E(N.LOGOS[profile.logo] || 'Claude')}">${N.logoHTML(profile.logo, profile.logoRaw, profile.logoUrl)}</div>
              <span class="logo-name">${E(N.LOGOS[profile.logo] || 'Claude')}</span></div>
            <button type="button" class="ibtn new" data-act="new" aria-label="新建窗口">${N.icon('plus')}</button>
          </div>
        </header>
        <div class="l-search"><label><span class="gt" aria-hidden="true">&gt;</span><span class="sr-only">搜索</span>
          <input type="search" placeholder="搜索窗口或消息" data-act="search"></label></div>
        <div data-main>${main ? mainCard(main, ctx, N.mood(xc)) : ''}</div>
        <div class="l-others-hd"><span class="n">${String(others.length).padStart(2, '0')}</span><span class="t">OTHER WINDOWS</span><a href="#/new" data-act="new">+ 新建</a></div>
        <div class="l-rail"><ul class="l-rows">${others.length ? others.map(row).join('') : '<li class="l-empty">还没有其他窗口</li>'}</ul></div>
      </div>
      ${N.tabbar('chat')}`;

    const svg = root.querySelector('.hud');
    const draw = () => N.hud.list(svg);
    draw();

    // 搜索：前端先按名字和最后一句过滤（TODO 接后端：全文搜索聊天记录 GET /v1/search?q=）
    root.querySelector('[data-act=search]').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      root.querySelectorAll('.l-row').forEach((li) => { li.style.display = !q || li.textContent.includes(q) ? '' : 'none'; });
    });
    root.querySelectorAll('[data-act=new]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); N.toast('新建窗口要接后端（见接入说明 · 窗口）'); }));

    // 窗口有变化就重画；心潮念每分钟拉一次
    let pend = 0;
    const unsub = N.api.subscribe('*', () => { clearTimeout(pend); pend = setTimeout(() => N.app.rerender(), 120); });
    const timer = setInterval(async () => {
      const box = root.querySelector('[data-main]'); if (!box || !main) return;
      const [x, c, ws] = await Promise.all([N.api.xinchao(), N.api.context(main.id), N.api.windows()]);
      box.innerHTML = mainCard(ws.find((w) => w.id === main.id) || main, c, N.mood(x));
    }, 60000);
    const ro = new ResizeObserver(draw); ro.observe(root); // 尺寸变了（含第一次排版完成）就重画边框
    return () => { unsub(); clearTimeout(pend); clearInterval(timer); ro.disconnect(); };
  };
})(window.NEON);
