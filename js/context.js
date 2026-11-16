/* 09 上下文：点聊天页右上角的圆环，从右边滑出来。谁占了多少、还能聊几轮、压缩。
   数据走 N.api.contextDetail(窗口id)，压缩走 N.api.compact(窗口id)。 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;
  const COLOR = { system: 'var(--lilac)', memory: 'var(--pink)', chat: 'var(--cyan)', tools: '#FFD36B', files: '#8DFFB8' };
  const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n));

  async function open(winId) {
    const app = document.getElementById('app');
    app.querySelector('.ctx-mask')?.remove();
    const [d, win] = await Promise.all([N.api.contextDetail(winId), N.api.window(winId)]);
    const m = document.createElement('div');
    m.className = 'ctx-mask';
    const draw = (d) => {
      const pct = Math.min(100, Math.round((d.used / d.max) * 100));
      const C = 2 * Math.PI * 56; let acc = 0;
      const arcs = d.parts.map((p) => { const len = C * p.tokens / d.max; const s = `<circle cx="66" cy="66" r="56" fill="none" stroke="${COLOR[p.key] || 'var(--violet)'}" stroke-width="7" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 66 66)"/>`; acc += len; return s; }).join('');
      const turns = Math.max(0, Math.floor((d.max * (d.autoAt || 0.8) - d.used) / (d.turnTokens || 1800)));
      const tone = pct >= 80 ? 'hot' : pct >= 60 ? 'warn' : '';
      m.innerHTML = `<aside class="ctx" role="dialog" aria-modal="true" aria-label="上下文"><div>
        <header><div><span>◢ CONTEXT // ${E(win?.name || '')}</span><b>上下文</b></div>
          <button type="button" class="ibtn" data-k="close" aria-label="关闭">${N.icon('plus', 'stroke-width="1.5" style="transform:rotate(45deg)"')}</button></header>
        <div class="ctx-top">
          <svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="56" fill="none" stroke="var(--line-soft)" stroke-width="2"/>${arcs}
            <path d="M66 2 V10 M66 122 V130 M2 66 H10 M122 66 H130" stroke="var(--line)" stroke-width="1"/><circle cx="66" cy="66" r="44" fill="none" stroke="var(--line-soft)" stroke-dasharray="2 5"/></svg>
          <div><b class="${tone}">${pct}<small>%</small></b><span class="mono">${k(d.used)} / ${k(d.max)}</span><em>还能聊大约 ${turns} 轮</em></div>
        </div>
        <div class="ctx-bar" aria-hidden="true">${d.parts.map((p) => `<i style="flex:${p.tokens};background:${COLOR[p.key]};box-shadow:0 0 6px ${COLOR[p.key]}"></i>`).join('')}<i style="flex:${Math.max(0, d.max - d.used)}"></i></div>
        <div class="ctx-list">
          ${d.parts.map((p) => `<div><i style="background:${COLOR[p.key]};box-shadow:0 0 6px ${COLOR[p.key]}"></i><span>${E(p.label)}</span><b class="mono">${k(p.tokens)}</b><em class="mono">${Math.round(p.tokens / d.max * 100)}%</em></div>`).join('')}
          <div class="free"><i></i><span>还空着</span><b class="mono">${k(Math.max(0, d.max - d.used))}</b><em></em></div>
        </div>
        <div class="ctx-info"><div><span>自动压缩</span><b class="mono">用到 ${Math.round((d.autoAt || 0.8) * 100)}% 时</b></div>
          <div><span>上次压缩</span><b class="mono dim">${d.compactedAt ? (N.time(d.compactedAt).includes(':') ? '今天 ' + N.time(d.compactedAt) : N.time(d.compactedAt) + ' ' + new Date(d.compactedAt).toTimeString().slice(0, 5)) : '还没压过'}</b></div></div>
        <div class="ctx-go"><button type="button" class="btn pink" data-k="compact">压缩上下文</button>
          <span>把前面的对话总结成一小段，腾出地方。聊天记录还在，往上翻都看得到。</span></div>
      </div></aside>`;
    };
    draw(d);
    app.appendChild(m);
    setTimeout(() => m.classList.add('in'), 16);   // 不用 rAF：页面在后台时 rAF 不跑，抽屉会一直不出来
    const close = () => { m.classList.remove('in'); setTimeout(() => m.remove(), 220); document.removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    m.addEventListener('click', async (e) => {
      if (e.target === m || e.target.closest('[data-k="close"]')) return close();
      const b = e.target.closest('[data-k="compact"]');
      if (b) {
        b.disabled = true; b.textContent = '压缩中…';
        await N.api.compact(winId);
        draw(await N.api.contextDetail(winId)); m.classList.add('in');
        N.toast('压缩好了');
      }
    });
    m.querySelector('[data-k="close"]').focus();
  }

  N.ctxPanel = { open };
})(window.NEON);
