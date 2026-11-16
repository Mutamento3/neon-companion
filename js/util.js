/* 公共小工具：命名空间 NEON、转义、提示、确认、本机存储、颜色、图标 */
window.NEON = window.NEON || {};
(function (N) {
  const PREFIX = 'neon.';

  N.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 本机存储（隐私模式下可能读不到，读不到就当没有）
  N.store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* 存不了就算了 */ } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) { } }
  };

  N.toast = (msg, ms = 2200) => {
    const app = document.getElementById('app');
    app.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    app.appendChild(t);
    setTimeout(() => t.remove(), ms);
  };

  // 确认弹层：N.confirm({ title, text, ok, cancel }) → Promise<boolean>
  N.confirm = ({ title, text, ok = '确定', cancel = '取消' }) => new Promise((resolve) => {
    const app = document.getElementById('app');
    const m = document.createElement('div');
    m.className = 'sheet-mask';
    m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${N.esc(title)}">
      <h3>${N.esc(title)}</h3>${text ? `<p>${N.esc(text)}</p>` : ''}
      <div class="row"><button type="button" class="btn" data-v="0">${N.esc(cancel)}</button><button type="button" class="btn pink" data-v="1">${N.esc(ok)}</button></div></div>`;
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (b || e.target === m) { m.remove(); resolve(!!(b && b.dataset.v === '1')); }
    });
    app.appendChild(m);
    m.querySelector('.btn.pink').focus();
  });

  // 时间：今天显示 HH:MM，昨天显示「昨天」，更早显示 M/D
  N.time = (t) => {
    if (!t) return '';
    const d = new Date(t), now = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return hm;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return '昨天';
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  N.dur = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  N.size = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  // 颜色：读 tokens.css 里的变量，按比例混合（心潮冷暖用）
  N.cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rgb = (c) => {
    c = c.trim();
    if (c.startsWith('#')) {
      let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
  };
  N.mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
  N.alpha = (c, a) => { const A = rgb(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };
  N.resolveColor = (name) => {
    // 变量可能是 var(--x) 套娃，借一个元素让浏览器算出最终颜色
    const el = document.createElement('i'); el.style.color = `var(${name})`; el.style.display = 'none';
    document.body.appendChild(el); const c = getComputedStyle(el).color; el.remove(); return c;
  };

  // 心潮念 → 页面用的颜色和数字
  N.mood = (xc) => {
    const cold = N.resolveColor('--cold'), warm = N.resolveColor('--warm');
    if (!xc || !xc.online) return { on: false, color: N.resolveColor('--off'), glow: 'transparent' };
    const s = xc.snapshot || {}, emo = s.emotion || {}, drives = (s.drives || []).slice().sort((a, b) => b.value - a.value);
    const mood = Math.max(-1, Math.min(1, s.stamen?.mood ?? 0));
    const intensity = emo.intensity ?? drives[0]?.value ?? 0.3;
    const color = N.mix(cold, warm, (mood + 1) / 2);
    return {
      on: true, color, glow: N.alpha(color, 0.28 + 0.25 * intensity),
      warm: (mood + 1) / 2, mood, intensity,
      word: emo.shown || emo.label || '—', top: drives[0] || null, mixed: s.mixed || null,
      doing: xc.now?.doing || '', thought: xc.now?.thought || '',
      mixColor: N.mix(N.resolveColor('--cyan'), '#ffffff', 0.25)
    };
  };

  // 模型 logo（assets/logos 下）。单色版走遮罩，原色版直接 <img>
  N.LOGOS = { claude: 'Claude', openai: 'GPT', deepseek: 'DeepSeek', gemini: 'Gemini', own: '自己的' };
  // key = own 时用设置里上传的那张（url 是 dataURL）
  N.logoHTML = (key, raw, url) => {
    if (key === 'own' && url) {
      if (raw) return `<img class="logo-raw" src="${N.esc(url)}" alt="">`;
      const o = `--logo:url("${url}")`;
      return `<span class="logo-mask a" style='${o}'></span><span class="logo-mask b" style='${o}'></span><span class="logo-mask main" style='${o}'></span>`;
    }
    key = N.LOGOS[key] ? key : 'claude';
    if (raw) {
      const file = key === 'openai' ? 'openai' : key + '-color';
      return `<img class="logo-raw" src="assets/logos/${file}.svg" alt="">`;
    }
    // 用完整地址：CSS 变量里的相对路径会按 css/ 目录算
    const v = `--logo:url(${new URL(`assets/logos/${key}.svg`, location.href).href})`;
    return `<span class="logo-mask a" style="${v}"></span><span class="logo-mask b" style="${v}"></span><span class="logo-mask main" style="${v}"></span>`;
  };

  // 线条图标
  const P = {
    back: 'M15 5l-7 7 7 7',
    plus: 'M12 4v16M4 12h16',
    phone: 'M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
    mic: 'M9 4h6v10H9z M5 11a7 7 0 0014 0M12 18v3',
    send: 'M4 12h15M13 6l6 6-6 6',
    chev: 'M9 6l6 6-6 6',
    copy: 'M8 8h11v12H8z M5 16V4h11',
    redo: 'M20 11a8 8 0 10-2.3 5.7 M20 5v6h-6',
    album: 'M3 6h18v13H3z M3 15l5-5 4 4 3-3 6 6',
    chat: 'M4 5h16v11H9l-5 4z M8 10h8M8 13h5',
    pulse: 'M2 12h4l2-5 3 10 3-13 3 11 2-3h3',
    moments: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4 M12 10a2 2 0 110 4 2 2 0 010-4z',
    gear: 'M12 9a3 3 0 110 6 3 3 0 010-6z M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    photo: 'M3 6h18v13H3z M3 15l5-5 4 4 3-3 6 6 M16.5 9.5h.01',
    camera: 'M4 8h4l2-3h4l2 3h4v11H4z M12 9.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z',
    file: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 13h6 M9 17h6',
    cmd: 'M4 5h16v14H4z M7 10l3 2-3 2 M12 15h5'
  };
  N.icon = (name, extra = '') => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" ${extra}><path d="${P[name]}"></path></svg>`;
})(window.NEON);
