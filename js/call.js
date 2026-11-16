/* 08 语音通话：盖在整个 App 上的一层，换页也不断。
   N.call.start(窗口id) 打开 / 回到通话；收起后顶上浮一条小条，点它回来；挂断后在聊天里记一行「通话 m:ss」。 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;
  const ICON = {
    down: 'M6 9l6 6 6-6',
    mute: 'M9 4h6v10H9z M5 11a7 7 0 0014 0M12 18v3', muted: 'M9 4h6v10H9z M5 11a7 7 0 0014 0M12 18v3 M4 4l16 16',
    spk: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 010 6 M18.5 6.5a8 8 0 010 11',
    cc: 'M3 6h18v12H3z M7 11h4M7 14h7M13 11h4',
    hang: 'M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z'
  };
  const svg = (d, w = 22, extra = '') => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" ${extra}><path d="${d}"/></svg>`;
  const STATE = { connecting: '接通中…', listening: '在听你说', thinking: '他在想', speaking: '他在说', ended: '已挂断' };
  const BARS = 48;
  let cur = null;   // 当前这通电话

  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  async function start(winId) {
    if (cur) { expand(); return; }
    const app = document.getElementById('app');
    const [win, prof] = await Promise.all([N.api.window(winId), N.api.profile()]);
    const name = win?.name || prof.taName;
    const el = document.createElement('div');
    el.className = 'call'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '语音通话');
    const bars = Array.from({ length: BARS }, (_, i) => `<g transform="rotate(${i * 360 / BARS} 195 195)"><rect class="cb" x="193.5" y="61" width="3" height="30" rx="1" style="--k:${(0.55 + ((i * 37) % 23) / 50).toFixed(2)}"/></g>`).join('');
    el.innerHTML = `
      <img class="call-bg" src="assets/xinchao/street.jpg" alt="">
      <div class="call-glow" aria-hidden="true"></div>
      <header class="call-hd">
        <button type="button" class="ibtn cut-tl" data-c="min" aria-label="收起，回到聊天">${svg(ICON.down, 18, 'stroke-width="1.5"')}</button>
        <div class="mid"><span>◢ VOICE.LINK</span><b data-c="time">00:00</b></div>
        <span class="pv">PAI<br>VOICE</span>
      </header>
      <div class="call-core">
        <svg viewBox="0 0 390 390" aria-hidden="true">
          <defs><linearGradient id="cRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset=".5" style="stop-color:var(--violet)"/><stop offset="1" style="stop-color:var(--pink)"/></linearGradient></defs>
          <g class="breath"><circle cx="195" cy="195" r="150" fill="none" class="halo" stroke-width="22"/></g>
          <g class="spin"><circle cx="195" cy="195" r="132" fill="none" stroke="url(#cRing)" stroke-width="1.5" stroke-dasharray="60 14 6 14"/></g>
          <g class="spinR"><circle cx="195" cy="195" r="118" fill="none" class="ring2" stroke-width="1" stroke-dasharray="2 6"/></g>
          <g class="bars">${bars}</g>
          <path d="M195 40 V52 M195 338 V350 M40 195 H52 M338 195 H350" style="stroke:var(--cyan)" stroke-width="1.5"/>
        </svg>
        <div class="call-av"><div>${prof.taAvatar ? `<img src="${E(prof.taAvatar)}" alt="">` : 'TA'}</div></div>
      </div>
      <div class="call-who"><b>${E(name)}</b><span data-c="state"><i class="pulse">●</i> 接通中…</span></div>
      <div class="call-subs" data-c="subs" aria-live="polite"><p class="me"><i>你 ▸ </i><span></span></p><p class="him"><i>TA ▸ </i><span></span></p></div>
      <nav class="call-ops" aria-label="通话操作">
        <button type="button" data-c="mute" aria-pressed="false"><span>${svg(ICON.mute)}</span>静音</button>
        <button type="button" data-c="spk" aria-pressed="true"><span>${svg(ICON.spk)}</span>扬声器</button>
        <button type="button" data-c="cc" aria-pressed="true"><span>${svg(ICON.cc)}</span>字幕</button>
        <button type="button" class="hang" data-c="hang" aria-label="挂断"><span>${svg(ICON.hang, 24, 'stroke-width="1.6" style="transform:rotate(135deg)"')}</span>挂断</button>
      </nav>`;
    app.appendChild(el);

    const pill = document.createElement('button');
    pill.type = 'button'; pill.className = 'call-pill'; pill.hidden = true; pill.setAttribute('aria-label', '回到通话');
    pill.innerHTML = `<span class="lv" aria-hidden="true"><i></i><i></i><i></i></span><b data-c="ptime">00:00</b><span class="t">${E(name)} · <em data-c="pstate">接通中…</em></span>`;
    app.appendChild(pill);

    const q = (k, root = el) => root.querySelector(`[data-c="${k}"]`);
    const rects = [...el.querySelectorAll('.cb')];
    const t0 = Date.now();
    const caps = [];
    let timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); q('time').textContent = fmt(s); q('ptime', pill).textContent = fmt(s); }, 500);

    const onEvent = (ev) => {
      if (ev.type === 'state') {
        el.dataset.state = ev.state; pill.dataset.state = ev.state;
        q('state').innerHTML = `<i class="pulse">●</i> ${STATE[ev.state] || ''}`;
        q('pstate', pill).textContent = STATE[ev.state] || '';
      }
      if (ev.type === 'level') rects.forEach((r) => { r.style.transform = `scaleY(${(0.18 + ev.value * +r.style.getPropertyValue('--k') * 1.4).toFixed(2)})`; });
      if (ev.type === 'caption') {
        const p = el.querySelector(ev.who === 'me' ? '.call-subs .me span' : '.call-subs .him span');
        p.textContent = ev.text;
        if (ev.final) caps.push({ who: ev.who, text: ev.text });
      }
      if (ev.type === 'error') N.toast(ev.message, 3200);
      if (ev.type === 'ended') finish(ev.seconds);
    };

    const finish = async (secs) => {
      if (!cur) return;
      clearInterval(timer); cur = null;
      el.remove(); pill.remove();
      await N.api.logCall(winId, secs, caps);
      N.toast('通话 ' + fmt(secs));
    };

    cur = { winId, el, pill, ctl: null };
    cur.ctl = await N.callDriver(winId, onEvent);

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const k = b.dataset.c;
      if (k === 'min') collapse();
      if (k === 'hang') cur?.ctl?.hangup();
      if (k === 'mute' || k === 'spk' || k === 'cc') {
        const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
        if (k === 'mute') { cur.ctl.setMute(on); b.querySelector('span').innerHTML = svg(on ? ICON.muted : ICON.mute); }
        if (k === 'spk') cur.ctl.setSpeaker(on);
        if (k === 'cc') q('subs').hidden = !on;
      }
    });
    pill.addEventListener('click', expand);
    el.querySelector('[data-c="min"]').focus();
  }

  function collapse() { if (!cur) return; cur.el.hidden = true; cur.pill.hidden = false; }
  function expand() { if (!cur) return; cur.el.hidden = false; cur.pill.hidden = true; }

  N.call = { start, collapse, expand, get active() { return !!cur; } };
})(window.NEON);
