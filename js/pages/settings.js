/* 06 设置：01 接入 · 02 两个人 · 03 外观 · 04 数据。
   连接配置存 neon.conn，资料存 neon.profile（接了后端也同步一份），外观存 neon.look（只在这台设备） */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;
  const SW = {
    pink: ['#FF5FD2', '#B57BFF', '#FF4F7B', '#FFD36B'],
    cyan: ['#5FE3FF', '#8DFFB8', '#4D9BFF', '#FF5FD2'],
    violet: ['#8B5CFF', '#5B6BFF', '#C04DFF', '#4D9BFF'],
    meBubble: ['#3A1446', '#2A1850', '#14304A', '#3D1F1F'],
    taBubble: ['#0F1E3A', '#1B1440', '#102B2B', '#2A1838']
  };
  const SW_LABEL = { pink: '主色', cyan: '第二色', violet: '线条', meBubble: '我的气泡', taBubble: 'TA 的气泡' };

  // 头像：裁成正方形 256×256 的 jpg
  const shrink = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      resolve(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src);
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
  const readText = (file) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });

  N.pages = N.pages || {};
  N.pages.settings = async function (root) {
    let conn = N.api.conn();
    let prof = await N.api.profile();
    const look = () => N.store.get('look', {});
    const cur = (k) => look()[k] || N.cssVar('--' + { pink: 'pink', cyan: 'cyan', violet: 'violet', meBubble: 'me-bubble', taBubble: 'ta-bubble' }[k]);

    root.className = 'page pg-settings';
    root.innerHTML = `<div class="page-glow" aria-hidden="true"></div><svg class="hud" aria-hidden="true"></svg>
      <div class="scroll"></div>${N.tabbar('settings')}
      <input type="file" accept="image/*" hidden data-file>`;
    const scroll = root.querySelector('.scroll');
    const fileIn = root.querySelector('[data-file]');
    const pick = (accept = 'image/*') => new Promise((r) => { fileIn.accept = accept; fileIn.value = ''; fileIn.onchange = () => r(fileIn.files[0]); fileIn.click(); });
    const saveConn = () => { N.api.setConn(conn); };

    function linkFields() {
      if (conn.mode === 'mock') return `<p class="s-hint">现在跑的是演示数据，什么都不用填。想真聊天就选「直连模型」或「接后端」。</p>`;
      if (conn.mode === 'bridge') return `<p class="s-hint">接你自己的后端（tmux 里的 Claude Code / Codex、朋友圈相册同步都走这里）。怎么搭见接入说明。</p>
        <div class="s-box"><div>
          <label class="s-row"><span class="k">地址</span><input type="url" class="mono" data-c="bridge.base" value="${E(conn.bridge.base)}" placeholder="https://你的后端地址"></label>
          <label class="s-row"><span class="k">凭证</span><input type="password" class="mono" data-c="bridge.token" value="${E(conn.bridge.token)}" placeholder="你的 TOKEN" autocomplete="off"><button type="button" class="side" data-act="eye">显示</button></label>
        </div></div>`;
      const d = conn.direct;
      return `<p class="s-hint">浏览器直接连模型 API，不用服务器。key 只存在这台设备上，别把填了 key 的设备借给别人。</p>
        <div class="s-box"><div>
          <div class="s-row"><span class="k">格式</span><div class="s-seg small two" role="radiogroup" aria-label="格式" style="flex:1;margin:7px 0">
            <button type="button" role="radio" data-fmt="claude" aria-checked="${d.format === 'claude'}">Claude</button><button type="button" role="radio" data-fmt="openai" aria-checked="${d.format !== 'claude'}">OpenAI 兼容</button></div></div>
          <label class="s-row"><span class="k">地址</span><input type="url" class="mono" data-c="direct.base" value="${E(d.base)}" placeholder="${d.format === 'claude' ? '不填 = 官方地址' : 'https://…/v1'}"></label>
          <label class="s-row"><span class="k">KEY</span><input type="password" class="mono" data-c="direct.key" value="${E(d.key)}" placeholder="你的 KEY" autocomplete="off"><button type="button" class="side" data-act="eye">显示</button></label>
          <label class="s-row"><span class="k">模型</span><input type="text" class="mono" data-c="direct.model" value="${E(d.model)}" placeholder="${d.format === 'claude' ? 'claude-opus-5-5' : '模型名'}" list="neon-models"></label>
          <label class="s-row"><span class="k">人设</span><textarea rows="2" data-c="direct.system" placeholder="他是谁、怎么说话（选填）">${E(d.system)}</textarea></label>
          <div class="s-row"><span class="k">思考</span><span style="flex:1;font-size:12px;font-weight:300;color:var(--ink-2)">聊天里显示可以折叠的思考过程${d.format === 'claude' ? '' : '（OpenAI 兼容的看模型有没有）'}</span>
            <button type="button" class="s-switch" role="switch" aria-checked="${!!d.thinking}" data-sw="direct.thinking" aria-label="显示思考"></button></div>
        </div></div>
        <datalist id="neon-models"><option value="claude-opus-5-5"><option value="claude-sonnet-5-5"><option value="claude-haiku-5-5"></datalist>`;
    }

    function render() {
      const L = look();
      const fs = L.chatFont || 14, glow = L.glow ?? 0.6;
      scroll.innerHTML = `
        <header>
          <span class="mono" style="font-size:10px;letter-spacing:.18em;color:var(--muted)">◢ SYS.CONFIG — <span style="color:var(--cyan)">v0.1</span></span>
          <div style="display:flex;align-items:baseline;gap:12px;margin-top:5px"><h1 style="margin:0;font-weight:300;font-size:26px;letter-spacing:.2em;color:var(--ink-hi)">设置</h1>
            <span style="font-family:var(--font-thin);font-weight:300;font-size:10px;letter-spacing:.42em;color:var(--pink)">SETTINGS</span></div>
        </header>

        <section class="s-sec" aria-labelledby="s1"><h2 id="s1"><span class="n">01</span><span class="t">接入</span><span class="e">LINK</span></h2>
          <div class="s-seg" role="radiogroup" aria-label="接入方式">
            ${[['mock', '演示'], ['direct', '直连模型'], ['bridge', '接后端']].map(([k, t]) => `<button type="button" role="radio" data-mode="${k}" aria-checked="${conn.mode === k}">${t}</button>`).join('')}
          </div>
          ${linkFields()}
          <div class="s-test" aria-live="polite">
            <div class="hd"><span>TEST // 测试连接</span><button type="button" data-act="test">测一次</button></div>
            ${['地址能连上', conn.mode === 'bridge' ? '凭证有效' : 'key 有效', conn.mode === 'bridge' ? '后端在线' : '模型能回话'].map((t, i) => `<div class="s-step" data-step="${i}"><i aria-hidden="true">·</i><span>${t}</span><em></em></div>`).join('')}
          </div>
          <div class="s-list">
            <label class="s-row"><span class="k wide">心潮念</span><input type="url" class="mono" data-c="xinchao.base" value="${E(conn.xinchao.base)}" placeholder="心潮念地址（选填）"><span class="st" data-xc>${conn.xinchao.base ? '…' : '未填'}</span></label>
            <label class="s-row"><span class="k wide">心潮令牌</span><input type="password" class="mono" data-c="xinchao.token" value="${E(conn.xinchao.token)}" placeholder="你的 TOKEN（选填）" autocomplete="off"></label>
            <label class="s-row"><span class="k wide">PaiVoice</span><input type="url" class="mono" data-c="paivoice" value="${E(conn.paivoice)}" placeholder="通话服务地址（选填）"><span class="st${conn.paivoice ? ' on' : ''}">${conn.paivoice ? '已填' : '未填'}</span></label>
          </div>
        </section>

        <section class="s-sec" aria-labelledby="s2"><h2 id="s2"><span class="n">02</span><span class="t">两个人</span><span class="e">PROFILE</span></h2>
          <div class="s-pair">
            <div class="s-person ta"><button type="button" class="av" data-av="taAvatar" aria-label="换 TA 的头像">${prof.taAvatar ? `<img src="${E(prof.taAvatar)}" alt="">` : 'TA'}</button>
              <input type="text" maxlength="16" data-p="taName" value="${E(prof.taName)}" aria-label="TA 的名字"><span>点头像换图</span></div>
            <div class="s-person me"><button type="button" class="av" data-av="meAvatar" aria-label="换我的头像">${prof.meAvatar ? `<img src="${E(prof.meAvatar)}" alt="">` : '我'}</button>
              <input type="text" maxlength="16" data-p="meName" value="${E(prof.meName)}" aria-label="我的名字"><span>点头像换图</span></div>
          </div>
          <div class="s-list"><label class="s-row"><span class="k wide">App 名字</span><input type="text" maxlength="20" data-p="appName" value="${E(prof.appName)}"></label></div>
          <div class="s-list" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px">
            <span style="font-size:12px;color:var(--ink-2)">右上角的模型 logo</span>
            <div class="s-logos">
              ${['claude', 'openai', 'deepseek', 'gemini'].map((k) => `<button type="button" data-logo="${k}" aria-pressed="${prof.logo === k}"><span class="lg" style="--logo:url(${new URL('assets/logos/' + k + '.svg', location.href).href})"></span>${N.LOGOS[k].toUpperCase()}</button>`).join('')}
              <button type="button" data-logo="own" aria-pressed="${prof.logo === 'own'}">${prof.logoUrl ? `<span class="lg" style='--logo:url("${prof.logoUrl}")'></span>` : '<span class="plus">+</span>'}自己的</button>
            </div>
            <div style="display:flex;align-items:center;font-size:12px;font-weight:300;color:var(--ink-2)">用品牌原色<button type="button" class="s-switch" role="switch" aria-checked="${!!prof.logoRaw}" data-act="logoRaw" aria-label="用品牌原色"></button></div>
          </div>
        </section>

        <section class="s-sec" aria-labelledby="s3"><h2 id="s3"><span class="n">03</span><span class="t">外观</span><span class="e">LOOK</span></h2>
          <div class="s-look">
            ${Object.keys(SW).map((k) => { const v = cur(k).toLowerCase(); return `<div class="s-sw"><span>${SW_LABEL[k]}</span><div role="radiogroup" aria-label="${SW_LABEL[k]}">
              ${SW[k].map((c) => `<button type="button" role="radio" data-sw-k="${k}" data-sw-v="${c}" aria-checked="${v === c.toLowerCase()}" aria-label="${c}" style="--v:${c}"></button>`).join('')}
              <label aria-label="自己挑颜色">+<input type="color" data-sw-k="${k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'}"></label></div></div>`; }).join('')}
            <div class="s-range"><span>聊天字号</span><input type="range" min="12" max="18" step="1" value="${fs}" data-range="chatFont" aria-label="聊天字号" style="--p:${((fs - 12) / 6) * 100}%"><b>${fs}px</b></div>
            <div class="s-range"><span>光晕</span><input type="range" min="0" max="1" step="0.05" value="${glow}" data-range="glow" aria-label="光晕" style="--c:var(--cyan);--p:${glow * 100}%"><b>${Math.round(glow * 100)}%</b></div>
            <div style="display:flex;align-items:center;font-size:12px;color:var(--ink-2)">HUD 边框装饰<button type="button" class="s-switch pink" role="switch" aria-checked="${L.hud !== false}" data-act="hud" aria-label="HUD 边框装饰"></button></div>
            <div class="s-preview" aria-hidden="true"><span class="me">示例：我说的一句</span><span class="ta">示例：TA 回的一句</span></div>
            <button type="button" class="s-link" data-act="reset-look">恢复默认外观</button>
          </div>
        </section>

        <section class="s-sec" aria-labelledby="s4"><h2 id="s4"><span class="n">04</span><span class="t">数据</span><span class="e">DATA</span></h2>
          <div class="s-list">
            <button type="button" class="s-row btn-row" data-act="export">导出聊天记录<span>.json</span></button>
            <button type="button" class="s-row btn-row" data-act="clear">清掉这台设备上的缓存<span>${N.size(N.api.localSize())}</span></button>
            <button type="button" class="s-row btn-row danger" data-act="clear-conn">清掉 key 和所有连接<span>⚠</span></button>
          </div>
          <div class="s-about"><span>${E(prof.appName)} · v0.1 · CC BY-NC 4.0</span>
            <a href="https://github.com/tianyupaipai-cmd/xinchao-nian" target="_blank" rel="noopener">心潮念 · github.com/tianyupaipai-cmd/xinchao-nian</a>
            <a href="https://github.com/tianyupaipai-cmd/pai-voice" target="_blank" rel="noopener">PaiVoice · github.com/tianyupaipai-cmd/pai-voice</a>
            <span>字体 / logo 来源见 README</span></div>
        </section>`;
      if (conn.xinchao.base) N.api.testXinchao(conn.xinchao).then((r) => { const el = scroll.querySelector('[data-xc]'); if (el) { el.textContent = r.ok ? '● 已连' : r.msg; el.className = 'st ' + (r.ok ? 'on' : 'bad'); } });
    }
    render();

    const setLook = (k, v) => { const L = look(); if (v == null) delete L[k]; else L[k] = v; N.store.set('look', L); N.applyLook(); };
    const setPath = (path, v) => { const [a, b] = path.split('.'); if (b) conn[a][b] = v; else conn[a] = v; saveConn(); };

    scroll.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.dataset.c) { setPath(t.dataset.c, t.value.trim()); if (t.dataset.c.startsWith('xinchao') || t.dataset.c === 'paivoice') render(); }
      if (t.dataset.p) { prof = await N.api.saveProfile({ [t.dataset.p]: t.value.trim() }); N.applyLook(); N.toast('存好了'); }
      if (t.type === 'color' && t.dataset.swK) { setLook(t.dataset.swK, t.value); render(); }
    });
    scroll.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.range) {
        const v = +t.value; setLook(t.dataset.range, v);
        t.style.setProperty('--p', (t.dataset.range === 'chatFont' ? ((v - 12) / 6) * 100 : v * 100) + '%');
        t.nextElementSibling.textContent = t.dataset.range === 'chatFont' ? v + 'px' : Math.round(v * 100) + '%';
      }
    });
    scroll.addEventListener('click', async (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.mode) { conn.mode = t.dataset.mode; saveConn(); render(); }
      if (t.dataset.fmt) { conn.direct.format = t.dataset.fmt; saveConn(); render(); }
      if (t.dataset.sw) { const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); setPath(t.dataset.sw, on); }
      if (t.dataset.swK) { setLook(t.dataset.swK, t.dataset.swV); render(); }
      if (t.dataset.logo) {
        if (t.dataset.logo === 'own' && !prof.logoUrl) {
          const f = await pick('image/svg+xml,image/png'); if (!f) return;
          if (f.size > 200 * 1024) return N.toast('logo 文件太大了（200 KB 以内）');
          prof = await N.api.saveProfile({ logo: 'own', logoUrl: await readText(f) });
        } else prof = await N.api.saveProfile({ logo: t.dataset.logo });
        render();
      }
      if (t.dataset.av) {
        const f = await pick(); if (!f) return;
        try { prof = await N.api.saveProfile({ [t.dataset.av]: await shrink(f) }); render(); N.toast('头像换好了'); } catch (err) { N.toast('这张图读不出来'); }
      }
      const act = t.dataset.act;
      if (act === 'eye') { const inp = t.previousElementSibling; inp.type = inp.type === 'password' ? 'text' : 'password'; t.textContent = inp.type === 'password' ? '显示' : '隐藏'; }
      if (act === 'logoRaw') { prof = await N.api.saveProfile({ logoRaw: !prof.logoRaw }); t.setAttribute('aria-checked', !!prof.logoRaw); }
      if (act === 'hud') { const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on); setLook('hud', on ? null : false); }
      if (act === 'reset-look') { N.store.del('look'); N.applyLook(); render(); N.toast('外观恢复默认了'); }
      if (act === 'test') {
        t.disabled = true; t.textContent = '测试中…';
        const rows = scroll.querySelectorAll('.s-step');
        rows.forEach((r) => { r.className = 's-step run'; r.querySelector('i').textContent = '·'; r.querySelector('em').textContent = ''; });
        const res = await N.api.test(conn);
        res.forEach((s, i) => {
          const r = rows[i];
          r.className = 's-step' + (s.ok === true ? ' ok' : s.ok === false ? ' bad' : '');
          r.querySelector('i').textContent = s.ok === true ? '✓' : s.ok === false ? '✕' : '·';
          r.querySelector('em').textContent = s.msg || (s.ms ? (s.ms > 999 ? (s.ms / 1000).toFixed(1) + 's' : s.ms + 'ms') : '');
        });
        t.disabled = false; t.textContent = '再测一次';
      }
      if (act === 'export') {
        const blob = new Blob([JSON.stringify(N.api.exportLocal(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chat-export-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
      if (act === 'clear') { if (await N.confirm({ title: '清掉这台设备上的缓存？', text: '直连模式存在本机的聊天记录会清掉；连接、资料、外观不动。接了后端的记录在后端，不受影响。', ok: '清掉' })) { N.api.clearCache(); render(); N.toast('清好了'); } }
      if (act === 'clear-conn') { if (await N.confirm({ title: '清掉 key 和所有连接？', text: '这台设备上填的 key、后端地址、心潮念和 PaiVoice 地址都会清掉，回到演示模式。', ok: '清掉' })) { N.api.clearConn(); conn = N.api.conn(); render(); N.toast('清好了，现在是演示模式'); } }
    });

    const svgEl = root.querySelector('.hud');
    const draw = () => N.hud.page(svgEl);
    const ro = new ResizeObserver(draw); ro.observe(root);
    return () => ro.disconnect();
  };
})(window.NEON);
