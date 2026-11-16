/* ==========================================================
   前端唯一的「接后端」出口。页面只调这里的函数，不直接 fetch。

   三种接法（设置里选，存在本机 neon.conn）：
   - mock    ：演示数据，打开就能点（默认）
   - direct  ：浏览器直接连模型 API（OpenAI 兼容 / Claude 格式），key 只存在这台设备。
               只有 via: api 的窗口能用；聊天记录存在本机。
   - bridge  ：接你自己的后端（tmux 桥 / 心潮念 / 朋友圈相册等）。每个函数上面标了
               「TODO 接后端」，返回和 js/mock.js 一样形状的数据就行，页面不用动。

   他的回复是一条「事件流」，页面用 subscribe(窗口id, fn) 收：
     { type: 'part.add',   msg }               新加一段（think / text / tools / image / file / voice / approval / question）
     { type: 'text.delta', id, delta }         某段文字往后追加（流式）
     { type: 'part.update', msg }              某段整段替换（工具调用结果、审批状态变了）
     { type: 'status', state, since }          thinking | replying | waiting（等你批准/回答）| idle | stuck
     { type: 'turn.end' }                      这一轮说完了
     { type: 'context', used, max }            上下文用量
     { type: 'window', id }                    窗口列表变了（id 为 '*' 时整页重拉）
     { type: 'error', message }
   bridge 模式下建议后端用 SSE：GET {base}/v1/windows/{id}/events，每行一个上面的 JSON。
   ========================================================== */
window.NEON = window.NEON || {};
(function (N) {
  const M = N.MOCK;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // —— 连接配置（设置页写，这里读）——
  const DEFAULT_CONN = {
    mode: 'mock',
    direct: { format: 'claude', base: '', key: '', model: '', system: '', maxTokens: 32000, thinking: true },
    bridge: { base: '', token: '' },
    xinchao: { base: '', token: '' },
    paivoice: ''
  };
  const conn = () => {
    const c = N.store.get('conn', {});
    return { ...DEFAULT_CONN, ...c, direct: { ...DEFAULT_CONN.direct, ...(c.direct || {}) }, bridge: { ...DEFAULT_CONN.bridge, ...(c.bridge || {}) }, xinchao: { ...DEFAULT_CONN.xinchao, ...(c.xinchao || {}) } };
  };

  // —— 事件总线 ——
  const subs = {};
  const emit = (id, ev) => (subs[id] || []).forEach((fn) => { try { fn(ev); } catch (e) { console.error(e); } });

  // —— 本机状态（mock / direct 用）——
  const local = { windows: null, history: {}, ctx: {} };
  const windowsLocal = () => {
    if (!local.windows) local.windows = N.store.get('windows', null) || clone(M.windows);
    return local.windows;
  };
  const histLocal = (id) => {
    if (!local.history[id]) local.history[id] = N.store.get('hist.' + id, null) || clone(M.history[id] || []);
    return local.history[id];
  };
  const mom = () => (local.moments = local.moments || clone(M.moments));
  const pho = () => (local.photos = local.photos || clone(M.photos));
  const alb = () => (local.albums = local.albums || clone(M.albums));
  const saveHist = (id) => { if (conn().mode === 'direct') N.store.set('hist.' + id, histLocal(id).slice(-200)); };
  const touchWindow = (id, patch) => {
    const w = windowsLocal().find((x) => x.id === id); if (!w) return;
    Object.assign(w, patch, { time: Date.now() });
    emit('*', { type: 'window', id });
  };

  // bridge 模式的请求（统一带 token）
  const bridgeFetch = async (path, opt = {}) => {
    const b = conn().bridge;
    if (!b.base) throw new Error('还没填后端地址（设置 → 连接）');
    const r = await fetch(b.base.replace(/\/$/, '') + path, {
      ...opt, headers: { 'content-type': 'application/json', ...(b.token ? { authorization: 'Bearer ' + b.token } : {}), ...(opt.headers || {}) }
    });
    if (!r.ok) throw new Error('后端返回 ' + r.status);
    return r.headers.get('content-type')?.includes('json') ? r.json() : r.text();
  };

  const api = {
    conn, setConn(c) { N.store.set('conn', c); },

    // App 名、两人名字、模型 logo
    // TODO 接后端：GET /v1/profile → 形状同 MOCK.profile
    async profile() {
      const p = { ...M.profile, ...N.store.get('profile', {}) };
      if (conn().mode === 'bridge') { try { Object.assign(p, await bridgeFetch('/v1/profile')); } catch (e) { /* 用本机的 */ } }
      return p;
    },

    // 窗口列表（主窗口 + 其他窗口）
    // TODO 接后端：GET /v1/windows → 形状同 MOCK.windows
    async windows() {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/windows');
      // 主窗口的名字、头像跟设置里的「两个人」走
      const p = { ...M.profile, ...N.store.get('profile', {}) };
      return clone(windowsLocal()).map((w) => (w.kind === 'companion' ? { ...w, name: p.taName || w.name, avatar: p.taAvatar || w.avatar } : w));
    },

    // 保存两个人的资料、App 名、模型 logo（头像已在前端裁成 256×256）
    // TODO 接后端：PUT /v1/profile。没接后端时只存在这台设备
    async saveProfile(patch) {
      const p = { ...N.store.get('profile', {}), ...patch };
      N.store.set('profile', p);
      if (conn().mode === 'bridge') { try { await bridgeFetch('/v1/profile', { method: 'PUT', body: JSON.stringify(patch) }); } catch (e) { N.toast('后端没存上：' + e.message); } }
      emit('*', { type: 'window', id: '*' });
      return p;
    },

    // 测试连接：返回三步 [{ ok, ms, msg }]（地址能连上 / key 或凭证有效 / 能回话）
    // direct 会真的发一句很短的话给模型（会用掉一点点 token）
    async test(c = conn()) {
      const steps = [{}, {}, {}];
      const t0 = performance.now();
      const fail = (i, msg) => { steps[i] = { ok: false, msg }; for (let j = i + 1; j < 3; j++) steps[j] = { ok: null }; return steps; };
      if (c.mode === 'mock') return [{ ok: true, msg: '演示模式' }, { ok: true }, { ok: true }];
      if (c.mode === 'bridge') {
        if (!c.bridge.base) return fail(0, '没填地址');
        let r;
        try { r = await fetch(c.bridge.base.replace(/\/$/, '') + '/v1/ping', { headers: c.bridge.token ? { authorization: 'Bearer ' + c.bridge.token } : {} }); }
        catch (e) { return fail(0, '连不上（地址、https 或跨域）'); }
        steps[0] = { ok: true, ms: Math.round(performance.now() - t0) };
        if (r.status === 401 || r.status === 403) return fail(1, '凭证不对');
        steps[1] = { ok: true };
        if (!r.ok) return fail(2, '后端返回 ' + r.status);
        const j = await r.json().catch(() => ({}));
        steps[2] = { ok: !!j.ok, msg: j.version ? 'v' + j.version : '' };
        return steps;
      }
      const d = c.direct;
      if (!d.key) return fail(0, '没填 key');
      if (!d.model) return fail(0, '没填模型');
      let r;
      try {
        if (d.format === 'claude') {
          r = await fetch((d.base || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': d.key, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: d.model, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] })
          });
        } else {
          r = await fetch((d.base || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + d.key },
            body: JSON.stringify({ model: d.model, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] })
          });
        }
      } catch (e) { return fail(0, '连不上（地址或跨域）'); }
      steps[0] = { ok: true, ms: Math.round(performance.now() - t0) };
      if (r.status === 401 || r.status === 403) return fail(1, 'key 不对');
      steps[1] = { ok: true };
      if (!r.ok) { const t = await r.text().catch(() => ''); return fail(2, (r.status === 404 ? '模型名不对？' : '返回 ' + r.status) + ' ' + t.slice(0, 60)); }
      steps[2] = { ok: true, ms: Math.round(performance.now() - t0) };
      return steps;
    },
    async testXinchao(x = conn().xinchao) {
      if (!x.base) return { ok: false, msg: '未填' };
      try {
        const r = await fetch(x.base.replace(/\/$/, '') + '/v1/now', { headers: x.token ? { authorization: 'Bearer ' + x.token } : {} });
        return r.ok ? { ok: true, msg: '已连' } : { ok: false, msg: '返回 ' + r.status };
      } catch (e) { return { ok: false, msg: '连不上' }; }
    },

    // 导出：这台设备上的聊天记录 + 资料 + 外观（不含 key）。TODO 接后端：GET /v1/export 返回下载地址
    exportLocal() {
      const out = { exportedAt: new Date().toISOString(), profile: N.store.get('profile', {}), look: N.store.get('look', {}), history: {} };
      try { Object.keys(localStorage).filter((k) => k.startsWith('neon.hist.')).forEach((k) => { out.history[k.slice(10)] = JSON.parse(localStorage.getItem(k)); }); } catch (e) { }
      return out;
    },
    localSize() { let n = 0; try { Object.keys(localStorage).filter((k) => k.startsWith('neon.')).forEach((k) => { n += (localStorage.getItem(k) || '').length * 2; }); } catch (e) { } return n; },
    clearCache() { try { Object.keys(localStorage).filter((k) => k.startsWith('neon.hist.') || k === 'neon.windows').forEach((k) => localStorage.removeItem(k)); } catch (e) { } local.history = {}; local.windows = null; },
    clearConn() { N.store.del('conn'); },
    async window(id) { return (await api.windows()).find((w) => w.id === id) || null; },

    // 聊天记录（从新往旧分页，before = 最早那条的 id）
    // TODO 接后端：GET /v1/windows/{id}/history?before=xxx&limit=40 → { items: [...], more: bool }
    async history(id, before) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/history?limit=40${before ? '&before=' + before : ''}`);
      return { items: clone(histLocal(id)), more: false };
    },

    // 上下文用量（右上角圆环）
    // TODO 接后端：GET /v1/windows/{id}/context → { used, max }
    async context(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/context`);
      return local.ctx[id] || M.context[id] || { used: 0, max: 200000 };
    },

    // 压缩上下文（点圆环）
    // TODO 接后端：POST /v1/windows/{id}/compact。终端窗口 = 往 tmux 里输入 /compact 回车
    async compact(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/compact`, { method: 'POST' });
      if (conn().mode === 'direct') {
        // 直连没有服务器帮忙压，这里只保留最近 20 条
        const h = histLocal(id); h.splice(0, Math.max(0, h.length - 20)); saveHist(id);
      }
      const c = await api.context(id); local.ctx[id] = { used: Math.round(c.used * 0.25), max: c.max };
      local.compactedAt = { ...(local.compactedAt || {}), [id]: Date.now() };
      emit(id, { type: 'context', ...local.ctx[id] });
      return local.ctx[id];
    },

    markRead(id) { touchWindow(id, { unread: 0 }); /* TODO 接后端：POST /v1/windows/{id}/read */ },

    // 发消息。payload = { text, atts: [{ kind: image|file|voice, url, name, size, secs }] }
    // 发出去后，回复走 subscribe 的事件流
    // TODO 接后端：POST /v1/windows/{id}/send，body = payload。终端窗口：后端把文字注入 tmux 回车，附件给路径
    async send(id, payload) {
      const c = conn();
      const mine = [];
      if (payload.text) mine.push({ id: uid(), role: 'me', type: 'text', text: payload.text, time: Date.now() });
      (payload.atts || []).forEach((a) => mine.push({ id: uid(), role: 'me', type: a.kind, url: a.url, name: a.name, size: a.size, secs: a.secs, transcript: a.transcript, time: Date.now() }));
      if (c.mode === 'bridge') {
        mine.forEach((m) => emit(id, { type: 'part.add', msg: m }));
        await bridgeFetch(`/v1/windows/${id}/send`, { method: 'POST', body: JSON.stringify(payload) });
        return;
      }
      mine.forEach((m) => { histLocal(id).push(m); emit(id, { type: 'part.add', msg: m }); });
      touchWindow(id, { last: payload.text || '[' + (payload.atts?.[0]?.kind === 'voice' ? '语音' : '附件') + ']' });
      const w = windowsLocal().find((x) => x.id === id);
      if (c.mode === 'direct' && w && w.via === 'api') return directTurn(id);
      return mockTurn(id);
    },

    // 停止（回复中时发送键变成停止）
    // TODO 接后端：POST /v1/windows/{id}/interrupt。终端窗口 = 往 tmux 里按 Esc
    async interrupt(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/interrupt`, { method: 'POST' });
      if (running[id]) running[id].abort();
    },

    // 审批：decision = allow | allow_session | deny，note = 拒绝时的说明
    // TODO 接后端：POST /v1/windows/{id}/approval/{aid}。对应 Claude Code 原生菜单 1 / 2 / 3；拒绝带说明的，再把说明当一句话发进去
    async answerApproval(id, aid, decision, note) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/approval/${aid}`, { method: 'POST', body: JSON.stringify({ decision, note }) });
      const m = histLocal(id).find((x) => x.aid === aid); if (!m) return;
      m.state = decision === 'deny' ? 'denied' : 'allowed'; m.decision = decision; m.note = note || '';
      emit(id, { type: 'part.update', msg: clone(m) });
      const still = histLocal(id).some((x) => (x.type === 'approval' || x.type === 'question') && x.state === 'pending');
      touchWindow(id, { state: still ? 'pending' : 'online' });
    },

    // 选项卡：answer = { pick: 序号 } 或 { text: 自己写的 } 或 { skip: true }
    // TODO 接后端：POST /v1/windows/{id}/question/{qid}。后端按选项给 tmux 发对应按键 / 文字
    async answerQuestion(id, qid, answer) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/question/${qid}`, { method: 'POST', body: JSON.stringify(answer) });
      const m = histLocal(id).find((x) => x.qid === qid); if (!m) return;
      m.state = answer.skip ? 'skipped' : 'answered'; m.answer = answer;
      emit(id, { type: 'part.update', msg: clone(m) });
      const still = histLocal(id).some((x) => (x.type === 'approval' || x.type === 'question') && x.state === 'pending');
      touchWindow(id, { state: still ? 'pending' : 'online' });
    },

    // 上传附件（图片 / 文件 / 语音），返回 { url, name, size }
    // TODO 接后端：POST /v1/upload（multipart），返回 { url }。限制：单个 30 MB
    async upload(file, onProgress) {
      if (file.size > 30 * 1048576) throw new Error('文件太大了（单个最多 30 MB）');
      if (conn().mode === 'bridge') {
        const fd = new FormData(); fd.append('file', file);
        const b = conn().bridge;
        const r = await fetch(b.base.replace(/\/$/, '') + '/v1/upload', { method: 'POST', body: fd, headers: b.token ? { authorization: 'Bearer ' + b.token } : {} });
        if (!r.ok) throw new Error('上传失败 ' + r.status);
        return { ...(await r.json()), name: file.name, size: file.size };
      }
      for (let p = 0; p <= 100; p += 25) { onProgress && onProgress(p); await wait(80); }
      return { url: URL.createObjectURL(file), name: file.name, size: file.size };
    },

    // 语音转文字（点「转文字」）
    // TODO 接后端：POST /v1/windows/{id}/transcribe/{msgId} → { text }
    async transcribe(id, msgId) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/transcribe/${msgId}`, { method: 'POST' });
      await wait(500);
      const m = histLocal(id).find((x) => x.id === msgId);
      return { text: m?.transcript || '（演示模式：接上后端后这里显示转出来的文字）' };
    },

    // 斜杠命令（终端窗口）
    // TODO 接后端：GET /v1/windows/{id}/commands → [{ cmd, desc }]，内置命令 + 项目 .claude/commands/ 里的
    async commands(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/windows/${id}/commands`);
      return clone(M.commands);
    },

    // 心潮念：在做什么 / 在想什么 + 快照里的情绪、冷暖、驱力、矛盾
    // 接 https://github.com/tianyupaipai-cmd/xinchao-nian 的 /v1/now 和 /v1/dashboard/snapshot
    async xinchao() {
      const x = conn().xinchao;
      if (conn().mode === 'mock' || !x.base) return conn().mode === 'mock' ? clone(M.xinchao) : { online: false };
      try {
        const h = x.token ? { authorization: 'Bearer ' + x.token } : {};
        const base = x.base.replace(/\/$/, '');
        const [now, snapshot] = await Promise.all([
          fetch(base + '/v1/now', { headers: h }).then((r) => r.json()),
          fetch(base + '/v1/dashboard/snapshot', { headers: h }).then((r) => r.json())
        ]);
        return { online: true, now, snapshot };
      } catch (e) { return { online: false }; }
    },

    // 某股驱力最近 24 小时的走势（点楼弹卡里的折线）→ { points: [36 个 0–1], why }
    // 心潮念的快照里没有这一项，需要后端从心潮念的历史里取（每 40 分钟一个点），why 是一句为什么涨落
    // TODO 接后端：GET /v1/xinchao/drives/{key}/history
    async driveHistory(key, value = 0.5) {
      const c = conn();
      if (c.mode === 'bridge') { try { return await bridgeFetch(`/v1/xinchao/drives/${key}/history`); } catch (e) { return { points: [], why: '' }; } }
      let s = [...key].reduce((a, ch) => a + ch.charCodeAt(0), 7);
      const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      return { points: Array.from({ length: 36 }, (_, i) => Math.max(0, Math.min(1, value + (r() - 0.5) * 0.35 - (35 - i) * 0.004))), why: c.mode === 'mock' ? '示例：这股驱力为什么涨落的一句话。' : '' };
    },

    // 挂断后记一行「通话 m:ss」进这个窗口的聊天记录（role: sys）
    // TODO 接后端：PaiVoice 那边挂断时后端自己记，连同这通电话的转写一起进上下文；前端收到 part.add 就会显示
    async logCall(id, seconds, captions = []) {
      const label = '通话 ' + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      if (conn().mode === 'bridge') { try { await bridgeFetch(`/v1/windows/${id}/call-log`, { method: 'POST', body: JSON.stringify({ seconds, captions }) }); } catch (e) { } return; }
      const m = { id: uid(), role: 'sys', type: 'divider', label: '◢ ' + label, time: Date.now() };
      histLocal(id).push(m); saveHist(id); emit(id, { type: 'part.add', msg: m });
      touchWindow(id, { last: '[' + label + ']' });
    },

    // 上下文明细（右上角圆环点开的那一页）
    // → { used, max, parts: [{ key, label, tokens }], autoAt: 0–1, compactedAt, turnTokens }
    // key: system（人设和规则）| memory（记忆、心潮念这些注入的）| chat（聊天记录）| tools（工具调用和结果）| files（图片文件）
    // TODO 接后端：GET /v1/windows/{id}/context?detail=1。终端窗口可以照 Claude Code 的 /context 输出拆
    async contextDetail(id) {
      if (conn().mode === 'bridge') { try { return await bridgeFetch(`/v1/windows/${id}/context?detail=1`); } catch (e) { } }
      const c = await api.context(id);
      const w = windowsLocal().find((x) => x.id === id);
      const term = w && w.via === 'terminal';
      const share = term ? { system: 0.12, memory: 0.06, chat: 0.22, tools: 0.52, files: 0.08 } : { system: 0.1, memory: 0.18, chat: 0.6, tools: 0, files: 0.12 };
      const LABEL = { system: '人设和规则', memory: '记忆 · 心潮念', chat: '聊天记录', tools: '工具调用和结果', files: '图片和文件' };
      const parts = Object.entries(share).filter(([, v]) => v > 0).map(([key, v]) => ({ key, label: LABEL[key], tokens: Math.round(c.used * v) }));
      return { used: c.used, max: c.max, parts, autoAt: 0.8, compactedAt: local.compactedAt?.[id] || null, turnTokens: term ? 6000 : 1800 };
    },

    // 语音通话：在 js/call.js + js/call-driver.js（接 PaiVoice，https://github.com/tianyupaipai-cmd/pai-voice）

    // ================= 朋友圈 =================
    // 没接后端时（mock / direct）朋友圈和相册只存在这一次打开的页面里，刷新就回到演示数据
    // TODO 接后端：GET /v1/moments?before=xxx → { cover, items: [...], more }（形状同 MOCK.moments）
    async moments() {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/moments');
      return clone(mom());
    },
    // 发动态：{ text, imgs: [{ url }] }。TODO 接后端：POST /v1/moments。后端存好后可以注入 TA 的窗口，让他决定要不要点赞评论
    async postMoment(p) {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/moments', { method: 'POST', body: JSON.stringify(p) });
      const item = { id: uid(), by: 'me', text: p.text || '', imgs: p.imgs || [], time: Date.now(), mood: null, likes: { me: false, ta: false }, comments: [] };
      mom().items.unshift(item);
      return clone(item);
    },
    // 点赞（再点一次取消）。TODO 接后端：POST /v1/moments/{id}/like
    async like(postId) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/moments/${postId}/like`, { method: 'POST' });
      const p = mom().items.find((x) => x.id === postId); if (!p) return;
      p.likes.me = !p.likes.me; return clone(p);
    },
    // 评论：{ text, replyTo }。TODO 接后端：POST /v1/moments/{id}/comments。注入 TA 的窗口，他想回就回
    async comment(postId, c) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/moments/${postId}/comments`, { method: 'POST', body: JSON.stringify(c) });
      const p = mom().items.find((x) => x.id === postId); if (!p) return;
      p.comments.push({ id: uid(), by: 'me', text: c.text, replyTo: c.replyTo || '', time: Date.now() });
      return clone(p);
    },
    // 换封面。TODO 接后端：PUT /v1/moments/cover { url }
    async setCover(url) {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/moments/cover', { method: 'PUT', body: JSON.stringify({ url }) });
      mom().cover = url;
    },

    // ================= 相册 =================
    // 照片：{ who: all | me | ta, album } → { items, counts: { all, me, ta, size } }
    // TODO 接后端：GET /v1/photos?who=&album=
    async photos(q = {}) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/photos?who=${q.who || 'all'}&album=${q.album || ''}`);
      const live = pho().filter((p) => !p.deleted);
      const items = live.filter((p) => (!q.who || q.who === 'all' || p.by === q.who) && (!q.album || p.album === q.album));
      return { items: clone(items), counts: { all: live.length, me: live.filter((p) => p.by === 'me').length, ta: live.filter((p) => p.by === 'ta').length, size: live.reduce((s, p) => s + (p.size || 0), 0) } };
    },
    async photo(id) { return clone(pho().find((p) => p.id === id) || null); },
    // 相簿列表（带张数）。TODO 接后端：GET /v1/albums
    async albums() {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/albums');
      return alb().map((a) => ({ ...a, count: pho().filter((p) => !p.deleted && p.album === a.id).length }));
    },
    // 建相簿。TODO 接后端：POST /v1/albums { name }。TA 也能建（by: ta）
    async createAlbum(name) {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/albums', { method: 'POST', body: JSON.stringify({ name }) });
      const a = { id: uid(), name, by: 'me' }; alb().push(a); return a;
    },
    // 存进相册：items = [{ url, size }]，source = chat | moments | upload。只有点了「存进相册」才进
    // TODO 接后端：POST /v1/photos。TA 存也走这个（by: ta）：后端给他一个「存进相册」的工具
    async savePhotos(items, source = 'upload', album = null) {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/photos', { method: 'POST', body: JSON.stringify({ items, source, album }) });
      const added = items.map((it) => ({ id: uid(), url: it.url || '', by: 'me', source, album, time: Date.now(), size: it.size || 0, notes: { ta: '', me: '' } }));
      pho().unshift(...added); return clone(added);
    },
    // 移到相簿（album 为空 = 移出相簿）。TODO 接后端：PATCH /v1/photos/{id} { album }
    async movePhoto(id, album) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/photos/${id}`, { method: 'PATCH', body: JSON.stringify({ album }) });
      const p = pho().find((x) => x.id === id); if (p) p.album = album || null;
    },
    // 写一句。TODO 接后端：PATCH /v1/photos/{id} { note }。可以注入 TA 的窗口告诉他
    async setPhotoNote(id, text) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/photos/${id}`, { method: 'PATCH', body: JSON.stringify({ note: text }) });
      const p = pho().find((x) => x.id === id); if (p) p.notes.me = text;
    },
    // 删除：不真删，进「最近删除」，记下谁删的，30 天后再清。TODO 接后端：DELETE /v1/photos/{id}
    async deletePhoto(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/photos/${id}`, { method: 'DELETE' });
      const p = pho().find((x) => x.id === id); if (p) p.deleted = { by: 'me', at: Date.now() };
    },
    // 最近删除 / 找回。TODO 接后端：GET /v1/photos/trash、POST /v1/photos/{id}/restore
    async trash() {
      if (conn().mode === 'bridge') return bridgeFetch('/v1/photos/trash');
      return clone(pho().filter((p) => p.deleted));
    },
    async restorePhoto(id) {
      if (conn().mode === 'bridge') return bridgeFetch(`/v1/photos/${id}/restore`, { method: 'POST' });
      const p = pho().find((x) => x.id === id); if (p) delete p.deleted;
    },

    subscribe(id, fn) {
      (subs[id] = subs[id] || []).push(fn);
      let es = null;
      const c = conn();
      if (c.mode === 'bridge' && c.bridge.base && id !== '*') {
        // TODO 接后端：事件流 GET /v1/windows/{id}/events（SSE），每条 data 是上面写的事件 JSON
        es = new EventSource(c.bridge.base.replace(/\/$/, '') + `/v1/windows/${id}/events` + (c.bridge.token ? '?token=' + encodeURIComponent(c.bridge.token) : ''));
        es.onmessage = (e) => { try { fn(JSON.parse(e.data)); } catch (err) { } };
      }
      return () => { subs[id] = (subs[id] || []).filter((f) => f !== fn); es && es.close(); };
    }
  };

  // —— 演示回复 ——
  const running = {};
  async function mockTurn(id) {
    const ctl = new AbortController(); running[id] = ctl;
    const w = windowsLocal().find((x) => x.id === id);
    emit(id, { type: 'status', state: 'thinking', since: Date.now() });
    touchWindow(id, { state: 'busy' });
    await wait(700);
    const think = { id: uid(), role: 'ta', type: 'think', text: '（演示）先想一下怎么回。', secs: 1 };
    histLocal(id).push(think); emit(id, { type: 'part.add', msg: think });
    if (w && w.via === 'terminal') {
      const tools = { id: uid(), role: 'ta', type: 'tools', ms: 1200, items: [{ name: 'Bash', arg: 'ls', res: '…', run: true }] };
      histLocal(id).push(tools); emit(id, { type: 'part.add', msg: tools });
      await wait(900);
      tools.items[0] = { name: 'Bash', arg: 'ls', res: '✓ 12 项', ok: true, detail: 'README.md  src/  package.json …' };
      emit(id, { type: 'part.update', msg: clone(tools) });
    }
    const full = M.replies[Math.floor(Math.random() * M.replies.length)];
    const msg = { id: uid(), role: 'ta', type: 'text', text: '', time: Date.now(), streaming: true };
    histLocal(id).push(msg); emit(id, { type: 'part.add', msg: clone(msg) });
    emit(id, { type: 'status', state: 'replying', since: Date.now() });
    for (const ch of full) {
      if (ctl.signal.aborted) break;
      msg.text += ch; emit(id, { type: 'text.delta', id: msg.id, delta: ch });
      await wait(45);
    }
    msg.streaming = false; delete running[id];
    emit(id, { type: 'part.update', msg: clone(msg) });
    emit(id, { type: 'turn.end' }); emit(id, { type: 'status', state: 'idle' });
    touchWindow(id, { state: 'online', last: msg.text });
    const cx = await api.context(id); local.ctx[id] = { used: Math.min(cx.max, cx.used + 1800), max: cx.max };
    emit(id, { type: 'context', ...local.ctx[id] });
  }

  // —— 浏览器直连模型 API（方案 A）——
  // 只发文字（图片、文件在直连模式下只显示，不发给模型；要发给模型请接后端）
  function toMessages(id) {
    const out = [];
    histLocal(id).forEach((m) => {
      if (m.type !== 'text' || !m.text) return;
      const role = m.role === 'me' ? 'user' : 'assistant';
      const last = out[out.length - 1];
      if (last && last.role === role) last.content += '\n\n' + m.text; else out.push({ role, content: m.text });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  async function* sse(resp) {
    const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
        try { yield JSON.parse(data); } catch (e) { }
      }
    }
  }

  async function directTurn(id) {
    const d = conn().direct;
    if (!d.key || !d.model) { emit(id, { type: 'error', message: '还没填 API 地址 / key / 模型（设置 → 连接）' }); return; }
    const ctl = new AbortController(); running[id] = ctl;
    emit(id, { type: 'status', state: 'thinking', since: Date.now() });
    touchWindow(id, { state: 'busy' });
    let think = null, text = null;
    const startPart = (type) => {
      const m = { id: uid(), role: 'ta', type, text: '', time: Date.now(), streaming: true };
      histLocal(id).push(m); emit(id, { type: 'part.add', msg: clone(m) }); return m;
    };
    const add = (m, delta) => { m.text += delta; emit(id, { type: 'text.delta', id: m.id, delta }); };
    let usage = { input: 0, output: 0 };
    try {
      let resp;
      if (d.format === 'claude') {
        const base = (d.base || 'https://api.anthropic.com').replace(/\/$/, '');
        const body = { model: d.model, max_tokens: d.maxTokens || 32000, stream: true, messages: toMessages(id) };
        if (d.system) body.system = d.system;
        if (d.thinking) body.thinking = { type: 'adaptive', display: 'summarized' };
        resp = await fetch(base + '/v1/messages', {
          method: 'POST', signal: ctl.signal,
          headers: {
            'content-type': 'application/json', 'x-api-key': d.key, 'anthropic-version': '2026-10-21',
            'anthropic-dangerous-direct-browser-access': 'true' // 允许浏览器直连（key 在本机，自己用的设备才这样做）
          },
          body: JSON.stringify(body)
        });
      } else {
        const base = (d.base || 'https://api.openai.com/v1').replace(/\/$/, '');
        const messages = toMessages(id); if (d.system) messages.unshift({ role: 'system', content: d.system });
        resp = await fetch(base + '/chat/completions', {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + d.key },
          body: JSON.stringify({ model: d.model, stream: true, stream_options: { include_usage: true }, messages })
        });
      }
      if (!resp.ok) throw new Error('模型返回 ' + resp.status + '：' + (await resp.text()).slice(0, 160));
      for await (const ev of sse(resp)) {
        if (d.format === 'claude') {
          if (ev.type === 'message_start') usage.input = ev.message?.usage?.input_tokens || 0;
          if (ev.type === 'content_block_start' && ev.content_block?.type === 'thinking' && !think) think = startPart('think');
          if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'thinking_delta' && ev.delta.thinking) { think = think || startPart('think'); add(think, ev.delta.thinking); }
            if (ev.delta.type === 'text_delta') { if (!text) { text = startPart('text'); emit(id, { type: 'status', state: 'replying', since: Date.now() }); } add(text, ev.delta.text); }
          }
          if (ev.type === 'message_delta') {
            usage.output = ev.usage?.output_tokens || usage.output;
            if (ev.delta?.stop_reason === 'refusal') { text = text || startPart('text'); add(text, '\n\n（这条请求被模型拒绝了）'); }
          }
        } else {
          const delta = ev.choices?.[0]?.delta || {};
          const r = delta.reasoning_content || delta.reasoning;
          if (r) { think = think || startPart('think'); add(think, r); }
          if (delta.content) { if (!text) { text = startPart('text'); emit(id, { type: 'status', state: 'replying', since: Date.now() }); } add(text, delta.content); }
          if (ev.usage) usage = { input: ev.usage.prompt_tokens || 0, output: ev.usage.completion_tokens || 0 };
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') emit(id, { type: 'error', message: String(e.message || e) });
    } finally {
      delete running[id];
      [think, text].forEach((m) => { if (m) { m.streaming = false; emit(id, { type: 'part.update', msg: clone(m) }); } });
      saveHist(id);
      emit(id, { type: 'turn.end' }); emit(id, { type: 'status', state: 'idle' });
      touchWindow(id, { state: 'online', last: text?.text || '' });
      if (usage.input) { local.ctx[id] = { used: usage.input + usage.output, max: (await api.context(id)).max }; emit(id, { type: 'context', ...local.ctx[id] }); }
    }
  }

  N.api = api;
})(window.NEON);
