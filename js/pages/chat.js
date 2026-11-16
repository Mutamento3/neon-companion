/* 01 / 02 聊天：主窗口（伴侣）和其他窗口共用一页。
   via: terminal 的窗口多出工具卡、审批卡、选项卡、斜杠命令；伴侣窗口多一个通话按钮。 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;

  // 代码块简单上色：关键字粉、函数名青、注释灰
  const KW = new Set('for in if else elif return def class function const let var import from export async await while try catch new true false null None True False'.split(' '));
  function hl(code) {
    return code.split('\n').map((line) => {
      const c = line.match(/(^|\s)(#|\/\/).*/);
      const body = c ? line.slice(0, c.index) : line, tail = c ? line.slice(c.index) : '';
      // 先按「单词 / 其他」切开，再逐段转义上色，避免往已插入的标签里再替换
      const out = body.replace(/[A-Za-z_]\w*|[^A-Za-z_]+/g, (tok, off) => {
        if (/^[A-Za-z_]/.test(tok)) {
          if (KW.has(tok)) return `<span style="color:var(--pink)">${tok}</span>`;
          if (body[off + tok.length] === '(') return `<span style="color:var(--cyan)">${tok}</span>`;
        }
        return E(tok);
      });
      return out + (tail ? `<span style="color:var(--muted-2)">${E(tail)}</span>` : '');
    }).join('\n');
  }
  const BARS = [0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.6, 0.95, 0.5, 0.75, 0.3, 0.65, 0.9, 0.45, 0.8, 0.5, 0.7, 0.4, 0.6, 0.85, 0.35, 0.55];

  N.pages = N.pages || {};
  N.pages.chat = async function (root, id) {
    const [win, profile] = await Promise.all([N.api.window(id), N.api.profile()]);
    if (!win) { root.className = 'page'; root.innerHTML = `<div class="stub"><b>找不到这个窗口</b><a href="#/" style="color:var(--cyan)">回聊天列表</a></div>`; return; }
    const isMain = win.kind === 'companion';
    const isTerm = win.via === 'terminal';
    const [hist, ctx, xc] = await Promise.all([N.api.history(id), N.api.context(id), isMain ? N.api.xinchao() : null]);
    const mood = isMain ? N.mood(xc) : null;
    N.api.markRead(id);

    // —— 页面骨架 ——
    const glyph = isTerm ? '&gt;_' : '{ }';
    const stateText = { pending: '<em class="pulse">◆</em> 等你批准', busy: '回复中', online: '在线', offline: '离线' };
    root.className = 'page pg-chat';
    root.innerHTML = `
      <div class="page-glow" aria-hidden="true"></div>
      <svg class="hud" aria-hidden="true"></svg>
      <header class="c-hd" ${mood ? `style="--mood:${mood.color};--mood-glow:${mood.glow}"` : ''}>
        <div class="bar">
          <a class="ibtn cut-tl" href="#/" aria-label="返回聊天列表">${N.icon('back')}</a>
          ${isMain ? `<div class="av">${win.avatar ? `<img src="${E(win.avatar)}" alt="">` : 'TA'}</div>` : `<div class="term-ic" aria-hidden="true">${glyph}</div>`}
          <div class="who">
            <b class="ell">${E(win.name)}</b>
            ${isMain
              ? `<span class="ell"><span class="pulse">●</span> ${win.state === 'offline' ? 'OFFLINE' : 'ONLINE'}${mood.on ? ' · ' + E(mood.word) + ' ' + Math.round(mood.intensity * 100) : ''}</span>`
              : `<span class="ell plain" data-state>${stateText[win.state] || '在线'} · ${isTerm ? E(win.target || '') + ' · ' + E(win.dir || '') : 'API · ' + E(win.model || '')}</span>`}
          </div>
          ${isMain
            ? `<button type="button" class="ibtn" data-act="call" aria-label="语音通话">${N.icon('phone')}</button>`
            : `<div class="logo-box" role="img" aria-label="助手：${E(N.LOGOS[win.agent === 'codex' ? 'openai' : profile.logo] || 'Claude')}">${N.logoHTML(win.agent === 'codex' ? 'openai' : profile.logo, profile.logoRaw, profile.logoUrl)}</div>`}
          <button type="button" class="ring" data-act="ring" aria-label="上下文用量，点开压缩">
            <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="bg" cx="20" cy="20" r="15"/><circle class="fg" cx="20" cy="20" r="15" transform="rotate(-90 20 20)"/>
            <path d="M20 1 V5 M20 35 V39 M1 20 H5 M35 20 H39" stroke="var(--line)" stroke-width="1"/></svg><span></span>
          </button>
        </div>
      </header>
      <div class="c-flow" role="log" aria-live="polite"></div>
      <div class="c-in">
        <div class="pending-att" hidden></div>
        <div class="row">
          <button type="button" class="ibtn plus" data-act="plus" aria-label="展开附件" aria-expanded="false">${N.icon('plus', 'stroke-width="1.6"')}</button>
          <label class="box">${isTerm ? '<span class="gt" aria-hidden="true">&gt;</span>' : ''}<span class="sr-only">输入消息</span>
            <textarea rows="1" placeholder="${isTerm ? '说点什么，或输入 / 用命令' : '说点什么…'}"></textarea></label>
          <button type="button" class="ibtn mic" data-act="mic" aria-label="按住说话">${N.icon('mic')}</button>
          <button type="button" class="ibtn send" data-act="send" aria-label="发送">${N.icon('send', 'stroke-width="1.4"')}</button>
        </div>
        <div class="tray" role="group" aria-label="附件">
          <button type="button" data-act="photo"><span class="ic" style="--c:var(--pink)">${N.icon('photo')}</span>照片</button>
          <button type="button" data-act="camera"><span class="ic" style="--c:var(--pink)">${N.icon('camera')}</span>拍照</button>
          <button type="button" data-act="file"><span class="ic" style="--c:var(--lilac)">${N.icon('file')}</span>文件</button>
          <button type="button" data-act="call"><span class="ic" style="--c:var(--cyan)">${N.icon('phone')}</span>拨号</button>
          <button type="button" data-act="cmd" ${isTerm ? '' : 'disabled title="只有终端窗口有命令"'}><span class="ic" style="--c:var(--cyan)">${N.icon('cmd')}</span>命令</button>
        </div>
        <input type="file" accept="image/*" multiple hidden data-pick="photo">
        <input type="file" accept="image/*" capture="environment" hidden data-pick="camera">
        <input type="file" multiple hidden data-pick="file">
      </div>`;

    const $ = (s) => root.querySelector(s);
    const flow = $('.c-flow'), inBox = $('.c-in'), ta = $('textarea'), sendBtn = $('[data-act=send]'), svg = $('.hud');
    const drawHud = () => N.hud.chat(svg, inBox.getBoundingClientRect().height);

    // —— 上下文圆环 ——
    const ring = $('[data-act=ring]');
    const setRing = (c) => {
      const pct = c && c.max ? Math.min(100, Math.round((c.used / c.max) * 100)) : 0;
      ring.querySelector('.fg').setAttribute('stroke-dasharray', `${(94.2 * pct / 100).toFixed(1)} 94.2`);
      ring.querySelector('span').textContent = pct;
      ring.classList.toggle('hot', pct >= 80);
      ring.setAttribute('aria-label', `上下文用了 ${pct}%，点开压缩`);
    };
    setRing(ctx);

    // —— 消息渲染 ——
    const msgs = new Map(); // id → { m, el }
    const nearBottom = () => flow.scrollHeight - flow.scrollTop - flow.clientHeight < 120;
    const toBottom = () => { flow.scrollTop = flow.scrollHeight; };

    function voiceEl(m) {
      const me = m.role === 'me', n = me ? 16 : 22;
      const bars = BARS.slice(0, n).map((v) => `<i style="height:${Math.round(4 + v * 16)}px"></i>`).join('');
      return `<div class="voice ${me ? 'me' : 'ta'}">
        <button type="button" class="pill" data-act="play" aria-label="播放语音 ${N.dur(m.secs || 0)}">
          <svg class="pi" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>
          <span class="bars" aria-hidden="true">${bars}</span><span class="sec">${N.dur(m.secs || 0)}</span></button>
        ${!me && m.transcript && m.heard ? `<p class="tr">${E(m.transcript)}</p>` : `<button type="button" class="tr-btn" data-act="tr">转文字</button>`}
      </div>`;
    }

    function html(m) {
      const me = m.role === 'me';
      switch (m.type) {
        case 'divider': return `<div class="c-div">${E(m.label)}</div>`;
        case 'think': return `<div class="think"${m.streaming ? ' data-open' : ''}><button type="button" data-act="fold" aria-expanded="${!!m.streaming}">${N.icon('chev', 'stroke-width="1.6"')}${m.streaming ? 'THINK · 思考中…' : `THINK · 已思考${m.secs ? ' ' + m.secs + ' 秒' : ''}`}</button><div class="body">${E(m.text)}</div></div>`;
        case 'text': {
          if (me) return `<div class="bub me"><div>${E(m.text)}</div></div>`;
          const parts = N.md.split(m.text || '');
          if (!parts.length) parts.push({ kind: 'md', html: '' });
          let out = parts.map((p, i) => p.kind === 'code'
            ? `<div class="code"><div class="hd"><span><em>◢</em> ${E(p.lang)}</span><button type="button" data-act="copy-code" data-i="${i}">复制</button></div><pre>${hl(p.code)}</pre></div>`
            : `<div class="bub ta"><div class="md">${p.html}</div></div>`).join('');
          if (m.streaming) out = out.replace(/<\/div><\/div>$/, '<span class="caret" aria-hidden="true"></span></div></div>');
          else out += `<div class="acts" hidden><button type="button" data-act="copy" aria-label="复制">${N.icon('copy')}</button><button type="button" data-act="redo" aria-label="重新生成">${N.icon('redo')}</button><button type="button" data-act="keep" aria-label="存进相册">${N.icon('album')}</button><span>${N.time(m.time)}</span></div>`;
          return out;
        }
        case 'image': return `<div class="img ${me ? 'me' : 'ta'}" data-act="img" role="button" tabindex="0" aria-label="看大图">${m.url ? `<img src="${E(m.url)}" alt="${E(m.name || '图片')}">` : '<span class="ph">IMG · 图片</span>'}</div>`;
        case 'file': {
          const ext = (m.name || '').split('.').pop().slice(0, 4) || 'FILE';
          return `<a class="file ${me ? 'me' : 'ta'}" ${m.url ? `href="${E(m.url)}" download="${E(m.name)}"` : ''}><span class="ic">${E(ext)}</span><span class="tx"><b class="ell">${E(m.name)}</b><span>${m.size ? N.size(m.size) : ''}${me ? ' · 已上传' : ''}</span></span></a>`;
        }
        case 'voice': return voiceEl(m);
        case 'tools': return `<div class="tools"><div class="hd"><em>◢</em><span>TOOLS · ${m.items.length} 次调用</span><span>${m.ms ? (m.ms / 1000).toFixed(1) + 's' : ''}</span></div>
          ${m.items.map((t, i) => `<div class="tool"${t.open ? ' data-open' : ''}><button type="button" data-act="tool" aria-expanded="${!!t.open}">${N.icon('chev', 'stroke-width="1.8"')}
            <span class="tn ${/read/i.test(t.name) ? 'read' : /edit|write/i.test(t.name) ? 'edit' : ''}">${E(t.name)}</span><span class="ta ell">${E(t.arg)}</span>
            <span class="tr ${t.run ? 'run' : t.ok === false ? 'bad' : ''}">${t.run ? '运行中…' : E(t.res || '')}</span></button>
            <div class="det">${t.diff ? t.diff.map((d) => `<div class="d ${d.k}">${E(d.t)}</div>`).join('') : E(t.detail || '')}</div></div>`).join('')}</div>`;
        case 'approval':
          if (m.state !== 'pending') return `<div class="appr-done${m.state === 'denied' ? ' no' : ''}"><em>${m.state === 'denied' ? '✕ 已拒绝' : m.decision === 'allow_session' ? '✓ 本次都允许' : '✓ 已允许'}</em> · ${E(m.cmd)}${m.note ? ' · ' + E(m.note) : ''}</div>`;
          return `<div class="appr"><div class="o"><div class="i">
            <span class="k"><span class="pulse">◆</span> APPROVAL · 需要你批准</span>
            <span class="t">TA 想执行${m.tool === 'Bash' ? '一条命令' : '：' + E(m.tool)}</span>
            <div class="cmd"><em>$</em> ${E(m.cmd)}</div><span class="where">${E(m.tool)} · ${E(m.dir || '')}</span>
            <div class="btns"><button type="button" class="yes" data-act="allow">允许</button><button type="button" class="all" data-act="allow_session">本次都允许</button><button type="button" data-act="deny">拒绝</button></div>
            <label><span>拒绝说明</span><input type="text" placeholder="可以告诉 TA 为什么（选填）" data-note></label>
          </div></div></div>`;
        case 'question':
          if (m.state !== 'pending') {
            const a = m.answer || {};
            return `<div class="appr-done"><em>${m.state === 'skipped' ? '— 已跳过' : '✓ 已回答'}</em> · ${E(m.q)}${a.text ? ' · ' + E(a.text) : a.pick != null ? ' · ' + E(m.options[a.pick]?.t) : ''}</div>`;
          }
          return `<fieldset class="ask"><legend>◇ QUESTION · TA 在问你</legend><span class="q">${E(m.q)}</span>
            ${m.options.map((o, i) => `<label class="opt"><input type="radio" name="q-${E(m.qid)}" value="${i}"${i === 0 ? ' checked' : ''}><span><b>${E(o.t)}</b>${o.d ? `<span>${E(o.d)}</span>` : ''}</span></label>`).join('')}
            <label class="opt own"><input type="radio" name="q-${E(m.qid)}" value="own"><input type="text" placeholder="自己写…" aria-label="自己写一个答案" data-own></label>
            <div class="btns"><button type="button" class="btn" data-act="skip">跳过</button><button type="button" class="btn cyan" data-act="answer">提交</button></div></fieldset>`;
        default: return '';
      }
    }

    function mount(m, before) {
      const wrap = document.createElement('div');
      wrap.style.display = 'contents'; wrap.dataset.id = m.id;
      wrap.innerHTML = html(m);
      flow.insertBefore(wrap, before || statusEl);
      msgs.set(m.id, { m, el: wrap });
    }
    function update(m) {
      const rec = msgs.get(m.id);
      if (!rec) return mount(m);
      rec.m = m; rec.el.innerHTML = html(m);
    }
    function refreshActs() {
      flow.querySelectorAll('.acts').forEach((a) => { a.hidden = true; });
      const all = flow.querySelectorAll('.acts'); if (all.length) all[all.length - 1].hidden = false;
    }

    // 状态小字（回复中 / 在想 / 等你批准 / 卡住了）
    const statusEl = document.createElement('span');
    statusEl.className = 'status'; statusEl.hidden = true;
    flow.appendChild(statusEl);
    let st = { state: 'idle', since: 0, last: 0 }, stTimer = 0;
    function showStatus() {
      const busy = st.state === 'thinking' || st.state === 'replying';
      const secs = Math.max(0, Math.round((Date.now() - st.since) / 1000));
      const stuck = busy && Date.now() - st.last > 120000;
      statusEl.hidden = st.state === 'idle';
      statusEl.className = 'status' + (st.state === 'waiting' ? ' wait' : '') + (stuck ? ' stuck' : '');
      statusEl.innerHTML = `<span class="pulse">◆</span> ${stuck ? '好像卡住了' : st.state === 'thinking' ? '在想' : st.state === 'replying' ? '回复中' : '等你批准'}${busy ? ' · ' + N.dur(secs).padStart(5, '0') : ''}`;
      sendBtn.classList.toggle('stop', busy);
      sendBtn.innerHTML = busy ? '<i aria-hidden="true"></i>' : N.icon('send', 'stroke-width="1.4"');
      sendBtn.setAttribute('aria-label', busy ? '停止回复' : '发送');
    }
    const setStatus = (state, since) => {
      st = { state, since: since || Date.now(), last: Date.now() }; showStatus();
      clearInterval(stTimer); if (state === 'thinking' || state === 'replying') stTimer = setInterval(showStatus, 1000);
    };

    // 初始记录
    hist.items.forEach((m) => mount(m));
    if (!hist.items.length) flow.insertAdjacentHTML('afterbegin', `<div class="c-empty"><b>${isTerm ? 'TERMINAL // READY' : 'CHANNEL // OPEN'}</b>${isTerm ? '这台机器在等你的第一句话' : '还没有消息，说点什么吧'}</div>`);
    if (hist.more) {
      const more = document.createElement('button');
      more.type = 'button'; more.className = 'c-more'; more.textContent = '更早的消息';
      more.onclick = async () => {
        const first = [...msgs.keys()][0];
        const older = await N.api.history(id, first);
        const anchor = flow.children[1];
        older.items.forEach((m) => mount(m, anchor));
        if (!older.more) more.remove();
      };
      flow.prepend(more);
    }
    const waiting = hist.items.some((m) => (m.type === 'approval' || m.type === 'question') && m.state === 'pending');
    if (waiting) setStatus('waiting');
    refreshActs();
    requestAnimationFrame(() => { toBottom(); drawHud(); });

    // —— 事件流 ——
    let raf = 0; const dirty = new Set();
    const flush = () => { raf = 0; const nb = nearBottom(); dirty.forEach((mid) => { const r = msgs.get(mid); if (r) update(r.m); }); dirty.clear(); if (nb) toBottom(); };
    const unsub = N.api.subscribe(id, (ev) => {
      st.last = Date.now();
      const nb = nearBottom();
      if (ev.type === 'part.add') { flow.querySelector('.c-empty')?.remove(); mount(ev.msg); if (nb || ev.msg.role === 'me') toBottom(); }
      if (ev.type === 'text.delta') { const r = msgs.get(ev.id); if (r) { r.m.text += ev.delta; dirty.add(ev.id); if (!raf) raf = requestAnimationFrame(flush); } }
      if (ev.type === 'part.update') { update(ev.msg); if (nb) toBottom(); if (ev.msg.type === 'approval' || ev.msg.type === 'question') setStatus(flow.querySelector('.appr, .ask') ? 'waiting' : 'idle'); }
      if (ev.type === 'status') setStatus(ev.state, ev.since);
      if (ev.type === 'turn.end') refreshActs();
      if (ev.type === 'context') setRing(ev);
      if (ev.type === 'error') { N.toast(ev.message, 3600); setStatus('idle'); }
    });

    // —— 输入 ——
    const atts = [];
    const attBox = $('.pending-att');
    const renderAtts = () => {
      attBox.hidden = !atts.length;
      attBox.innerHTML = atts.map((a, i) => `<span><span class="ell">${E(a.name)}</span>${a.progress < 100 ? `<b class="mono" style="font-weight:400;color:var(--pink)">${a.progress}%</b>` : ''}<button type="button" data-rm="${i}" aria-label="移除">×</button></span>`).join('');
      drawHud();
    };
    attBox.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { atts.splice(+b.dataset.rm, 1); renderAtts(); } });

    const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; drawHud(); };
    ta.addEventListener('input', () => { autosize(); slash(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

    async function send() {
      const text = ta.value.trim();
      const ready = atts.filter((a) => a.progress >= 100 && a.url);
      if (!text && !ready.length) return;
      ta.value = ''; autosize(); closeSlash();
      atts.length = 0; renderAtts();
      try { await N.api.send(id, { text, atts: ready.map(({ kind, url, name, size, secs, transcript }) => ({ kind, url, name, size, secs, transcript })) }); }
      catch (e) { N.toast(e.message || '没发出去，再试一次', 3200); }
    }

    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('stop')) { N.api.interrupt(id); setStatus('idle'); } else send();
    });

    // + 附件面板
    const plus = $('[data-act=plus]');
    plus.addEventListener('click', () => {
      const open = !inBox.hasAttribute('data-tray');
      inBox.toggleAttribute('data-tray', open);
      plus.setAttribute('aria-expanded', open); plus.setAttribute('aria-label', open ? '收起附件' : '展开附件');
      drawHud();
    });
    if (new URLSearchParams(location.search).has('tray')) plus.click(); // 截预览图用：?tray 打开附件面板
    const pick = (k) => root.querySelector(`[data-pick=${k}]`).click();
    async function addFiles(files, kindHint) {
      for (const f of files) {
        const a = { kind: kindHint || (f.type.startsWith('image/') ? 'image' : 'file'), name: f.name, size: f.size, progress: 0 };
        atts.push(a); renderAtts();
        try {
          const r = await N.api.upload(f, (p) => { a.progress = p; renderAtts(); });
          Object.assign(a, r, { progress: 100 }); renderAtts();
        } catch (e) { N.toast(e.message || '上传失败', 3000); atts.splice(atts.indexOf(a), 1); renderAtts(); }
      }
    }
    root.querySelectorAll('[data-pick]').forEach((inp) => inp.addEventListener('change', () => { addFiles([...inp.files]); inp.value = ''; inBox.removeAttribute('data-tray'); drawHud(); }));

    // 斜杠命令（终端窗口）
    let slashEl = null, cmds = null;
    const closeSlash = () => { slashEl?.remove(); slashEl = null; };
    async function slash() {
      if (!isTerm || !ta.value.startsWith('/') || ta.value.includes(' ')) return closeSlash();
      cmds = cmds || await N.api.commands(id);
      const q = ta.value.slice(1).toLowerCase();
      const list = cmds.filter((c) => c.cmd.slice(1).toLowerCase().startsWith(q));
      if (!list.length) return closeSlash();
      if (!slashEl) { slashEl = document.createElement('div'); slashEl.className = 'slash'; slashEl.setAttribute('role', 'listbox'); inBox.appendChild(slashEl); }
      slashEl.innerHTML = list.map((c) => `<button type="button" role="option" data-cmd="${E(c.cmd)}"><b>${E(c.cmd)}</b><span>${E(c.desc)}</span></button>`).join('');
    }
    inBox.addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) { ta.value = b.dataset.cmd + ' '; closeSlash(); ta.focus(); } });

    // 按住说话：录一段语音 → 上传 → 发语音条
    const mic = $('[data-act=mic]');
    let rec = null, chunks = [], recStart = 0, recTip = null;
    const startRec = async (e) => {
      e.preventDefault();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return N.toast('这个浏览器不能录音');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        rec = new MediaRecorder(stream); chunks = []; recStart = Date.now();
        rec.ondataavailable = (ev) => chunks.push(ev.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const secs = (Date.now() - recStart) / 1000;
          if (secs < 1) return N.toast('说话时间太短');
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const file = new File([blob], 'voice.webm', { type: blob.type });
          try {
            const r = await N.api.upload(file);
            await N.api.send(id, { atts: [{ kind: 'voice', url: r.url, name: '语音', size: file.size, secs: Math.round(secs) }] });
          } catch (err) { N.toast(err.message || '语音没发出去'); }
        };
        rec.start(); mic.setAttribute('data-rec', '');
        recTip = document.createElement('span'); recTip.className = 'rec-tip'; recTip.textContent = '● 松开发送'; inBox.appendChild(recTip);
      } catch (err) { N.toast('没拿到麦克风权限'); }
    };
    const stopRec = () => { if (rec && rec.state === 'recording') rec.stop(); mic.removeAttribute('data-rec'); recTip?.remove(); };
    mic.addEventListener('pointerdown', startRec);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => mic.addEventListener(t, stopRec));

    // 页面上的其他按钮（事件委托）
    let audio = null;
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, wrap = b.closest('[data-id]'), rec2 = wrap && msgs.get(wrap.dataset.id), m = rec2?.m;
      if (act === 'photo' || act === 'camera' || act === 'file') pick(act);
      if (act === 'cmd') { ta.value = '/'; ta.focus(); inBox.removeAttribute('data-tray'); slash(); drawHud(); }
      if (act === 'call') { inBox.removeAttribute('data-tray'); drawHud(); N.call.start(id); }
      if (act === 'ring') N.ctxPanel.open(id);   // 09 上下文页（压缩后圆环会收到 context 事件自己更新）
      if (act === 'fold') { const t = b.closest('.think'); const open = !t.hasAttribute('data-open'); t.toggleAttribute('data-open', open); b.setAttribute('aria-expanded', open); }
      if (act === 'tool') { const t = b.closest('.tool'); const open = !t.hasAttribute('data-open'); t.toggleAttribute('data-open', open); b.setAttribute('aria-expanded', open); }
      if (act === 'copy' && m) { navigator.clipboard?.writeText(m.text).then(() => N.toast('复制了')); }
      if (act === 'copy-code' && m) { const p = N.md.split(m.text)[+b.dataset.i]; navigator.clipboard?.writeText(p.code).then(() => N.toast('代码复制了')); }
      if (act === 'redo' && m) N.toast('重新生成要接后端（接入说明 · 聊天）');
      if (act === 'keep' && m) N.toast('点聊天里的图片，就能存进相册');
      if (act === 'img' && m) N.viewer.open([{ url: m.url, size: m.size, by: m.role === 'me' ? 'me' : 'ta', time: m.time || Date.now() }], 0, 'feed');
      if ((act === 'allow' || act === 'allow_session' || act === 'deny') && m) {
        const note = wrap.querySelector('[data-note]')?.value.trim();
        await N.api.answerApproval(id, m.aid, act, act === 'deny' ? note : '');
      }
      if ((act === 'answer' || act === 'skip') && m) {
        if (act === 'skip') return N.api.answerQuestion(id, m.qid, { skip: true });
        const v = wrap.querySelector('input[type=radio]:checked')?.value;
        const own = wrap.querySelector('[data-own]').value.trim();
        if (v === 'own' && !own) return N.toast('先写一下你的答案');
        await N.api.answerQuestion(id, m.qid, v === 'own' ? { text: own } : { pick: +v });
      }
      if (act === 'play' && m) {
        const bars = [...b.querySelectorAll('.bars i')];
        if (audio) { audio.pause(); audio = null; bars.forEach((i) => i.classList.remove('on')); return; }
        if (!m.url) { // 演示：没音频就让波形走一遍
          let i = 0; const t = setInterval(() => { bars.forEach((x, j) => x.classList.toggle('on', j <= i)); if (++i > bars.length) { clearInterval(t); bars.forEach((x) => x.classList.remove('on')); } }, (m.secs || 3) * 1000 / bars.length);
          return;
        }
        audio = new Audio(m.url); audio.play().catch(() => N.toast('播放不了'));
        audio.ontimeupdate = () => { const p = audio.currentTime / (audio.duration || m.secs || 1); bars.forEach((x, j) => x.classList.toggle('on', j / bars.length <= p)); };
        audio.onended = () => { audio = null; bars.forEach((x) => x.classList.remove('on')); };
      }
      if (act === 'tr' && m) {
        b.disabled = true; b.textContent = '转写中…';
        const r = await N.api.transcribe(id, m.id);
        b.outerHTML = `<p class="tr">${E(r.text)}</p>`;
      }
    });

    // 截预览图 / 录演示用：?ctx 打开上下文页，?call 打开通话
    { const u = new URLSearchParams(location.search); if (u.has('ctx')) setTimeout(() => N.ctxPanel.open(id), 300); if (u.has('call')) setTimeout(() => N.call.start(id), 300); }
    const ro = new ResizeObserver(drawHud); ro.observe(root); ro.observe(inBox);
    return () => { unsub(); clearInterval(stTimer); stopRec(); audio?.pause(); ro.disconnect(); };
  };
})(window.NEON);
