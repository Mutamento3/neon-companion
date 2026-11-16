/* 03 朋友圈：#/moments 动态 · #/moments/album 相册 · #/moments/trash 最近删除
   05 看大图：N.viewer.open(...) 盖在整页上 */
window.NEON = window.NEON || {};
(function (N) {
  const E = N.esc;
  const TONES = ['linear-gradient(160deg,#2A1850,#120E2A)', 'linear-gradient(160deg,#3A1446,#140B26)', 'linear-gradient(160deg,#10263F,#0F0C24)', 'linear-gradient(200deg,#2B1240,#0F1A33)', 'linear-gradient(140deg,#1B1440,#3A1446)', 'linear-gradient(160deg,#0F2A3A,#1A1236)'];
  const SRC = { chat: 'M4 5h16v11H9l-5 4z', moments: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z M12 10a2 2 0 110 4 2 2 0 010-4z' };
  const SRC_TXT = { chat: '从聊天存的', moments: '从朋友圈存的', upload: '从手机存的' };
  const ICON = {
    cam: 'M4 8h4l2-3h4l2 3h4v11H4z M12 10v6M9 13h6',
    heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
    down: 'M12 4v11M7 10l5 5 5-5M5 19h14',
    move: 'M3 7h7l2 2h9v10H3z M10 14h6M13 11l3 3-3 3',
    tochat: 'M4 5h16v11H9l-5 4z M9 10h6M13 8l2 2-2 2',
    del: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
    x: 'M6 6l12 12M18 6L6 18',
    prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7'
  };
  const svg = (d, extra = '') => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" ${extra}><path d="${d}"/></svg>`;
  const day = (t) => { const d = new Date(t); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const dayLabel = (t) => { const n = N.time(t); return n.includes(':') ? '今天' : n === '昨天' ? '昨天' : '周' + '日一二三四五六'[new Date(t).getDay()]; };

  // —— 弹层（发动态 / 选相簿 / 新建相簿）——
  function sheet(html, mount) {
    const app = document.getElementById('app');
    const m = document.createElement('div');
    m.className = 'sheet-mask'; m.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => m.remove();
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
    app.appendChild(m); mount && mount(m.querySelector('.sheet'), close);
    return close;
  }
  function pickAlbum(title) {
    return new Promise(async (resolve) => {
      const albums = await N.api.albums();
      sheet(`<h3>${E(title)}</h3><div class="pick-list">
          <button type="button" data-a="">不放进相簿</button>
          ${albums.map((a) => `<button type="button" data-a="${E(a.id)}">${E(a.name)}<span>${a.count} 张</span></button>`).join('')}
          <button type="button" data-a="__new">+ 新建相簿</button></div>
        <div class="row"><button type="button" class="btn" data-close>取消</button></div>`, (el, close) => {
        el.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-a]'); if (!b) return;
          close();
          if (b.dataset.a === '__new') { const a = await newAlbum(); resolve(a ? a.id : undefined); } else resolve(b.dataset.a);
        });
        el.parentElement.addEventListener('click', (e) => { if (e.target === el.parentElement || e.target.closest('[data-close]')) resolve(undefined); });
      });
    });
  }
  function newAlbum() {
    return new Promise((resolve) => sheet(`<h3>新建相簿</h3><label class="compose"><span class="sr-only">相簿名字</span><input type="text" maxlength="20" placeholder="相簿名字" style="width:100%;height:40px;padding:0 10px;background:var(--bg-deep);border:1px solid var(--line);outline:none;font-size:14px"></label>
      <div class="row"><button type="button" class="btn" data-close>取消</button><button type="button" class="btn pink" data-ok>建好了</button></div>`, (el, close) => {
      const inp = el.querySelector('input'); inp.focus();
      const ok = async () => { const v = inp.value.trim(); if (!v) return N.toast('起个名字'); close(); resolve(await N.api.createAlbum(v)); };
      el.querySelector('[data-ok]').onclick = ok;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      el.querySelector('[data-close]').addEventListener('click', () => resolve(null));
    }));
  }

  // —— 05 看大图 ——
  // items: [{ id?, url, by, source, album, time, notes }]；mode: album（相册里的）| feed（动态里的图，还没存进相册）
  N.viewer = {
    async open(items, index, mode, onChange) {
      const app = document.getElementById('app');
      const v = document.createElement('div');
      v.className = 'viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '看大图');
      app.appendChild(v);
      const albums = mode === 'album' ? await N.api.albums() : [];
      let i = index;
      const draw = () => {
        const p = items[i]; const me = p.by === 'me';
        const al = albums.find((a) => a.id === p.album);
        v.innerHTML = `
          <div class="v-hd">
            <button type="button" class="ibtn cut-tl" data-v="close" aria-label="关闭">${svg(ICON.x)}</button>
            <div class="mid"><b>${String(i + 1).padStart(3, '0')} / ${String(items.length).padStart(3, '0')}</b><span>${mode === 'album' ? 'IMG_' + String(i + 1).padStart(3, '0') + ' · ' : ''}${day(p.time)} ${N.time(p.time).includes(':') ? N.time(p.time) : ''}</span></div>
            <span class="by${me ? ' me' : ''}">${mode === 'album' ? (me ? '我存的' : 'TA 存的') : (me ? '我发的' : 'TA 发的')}</span>
          </div>
          <div class="v-img">
            <div class="o"><div class="i">${p.url ? `<img src="${E(p.url)}" alt="">` : 'IMG · 照片原图'}</div></div>
            <span class="br1" aria-hidden="true"></span><span class="br2" aria-hidden="true"></span>
            ${items.length > 1 ? `<button type="button" class="nav prev" data-v="prev" aria-label="上一张">${svg(ICON.prev, 'stroke-width="1.6"')}</button><button type="button" class="nav next" data-v="next" aria-label="下一张">${svg(ICON.next, 'stroke-width="1.6"')}</button>` : ''}
          </div>
          ${mode === 'album' ? `
          <div class="v-meta">${p.source !== 'upload' ? svg(SRC[p.source] || '', 'stroke-width="1.6"') : ''}<span>${SRC_TXT[p.source] || ''}</span>
            <button type="button" data-v="move">${al ? E(al.name) : '不在相簿里'}</button></div>
          <div class="v-notes">
            ${p.notes?.ta ? `<div class="n"><b>TA ▸</b><span>${E(p.notes.ta)}</span></div>` : ''}
            <label><b>我 ▸</b><input type="text" maxlength="60" placeholder="写一句…" value="${E(p.notes?.me || '')}" data-note aria-label="给这张写一句"></label>
          </div>` : ''}
          <nav class="v-ops" aria-label="照片操作">
            <button type="button" data-v="save">${svg(ICON.down, 'stroke-width="1.3"')}存到手机</button>
            ${mode === 'album' ? `<button type="button" data-v="move">${svg(ICON.move, 'stroke-width="1.3"')}移到相簿</button>` : `<button type="button" data-v="keep">${svg('M3 6h18v13H3z M3 15l5-5 4 4 3-3 6 6', 'stroke-width="1.3"')}存进相册</button>`}
            <button type="button" class="chat" data-v="chat">${svg(ICON.tochat, 'stroke-width="1.3"')}发到聊天</button>
            ${mode === 'album' ? `<button type="button" class="del" data-v="del">${svg(ICON.del, 'stroke-width="1.3"')}删除</button>` : '<span></span>'}
          </nav>`;
        const note = v.querySelector('[data-note]');
        note && note.addEventListener('change', async () => { p.notes = { ...(p.notes || {}), me: note.value.trim() }; await N.api.setPhotoNote(p.id, p.notes.me); N.toast('写好了'); onChange && onChange(); });
      };
      const close = () => { v.remove(); document.removeEventListener('keydown', key); };
      const go = (d) => { i = (i + d + items.length) % items.length; draw(); };
      const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
      document.addEventListener('keydown', key);
      let sx = null; // 左右滑
      v.addEventListener('pointerdown', (e) => { if (e.target.closest('.v-img')) sx = e.clientX; });
      v.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50 && items.length > 1) go(e.clientX < sx ? 1 : -1); sx = null; });
      v.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        const p = items[i], act = b.dataset.v;
        if (act === 'close') close();
        if (act === 'prev') go(-1);
        if (act === 'next') go(1);
        if (act === 'save') {
          if (!p.url) return N.toast('演示图没有原图');
          const a = document.createElement('a'); a.href = p.url; a.download = 'photo'; a.click();
        }
        if (act === 'keep') { await N.api.savePhotos([{ url: p.url, size: p.size }], 'moments'); N.toast('存进相册了'); }
        if (act === 'move') {
          const to = await pickAlbum('移到相簿'); if (to === undefined) return;
          await N.api.movePhoto(p.id, to); p.album = to || null;
          albums.splice(0, albums.length, ...(await N.api.albums())); draw(); onChange && onChange();
        }
        if (act === 'chat') {
          const wins = await N.api.windows(); const main = wins.find((w) => w.kind === 'companion');
          if (!main) return N.toast('还没有主窗口');
          await N.api.send(main.id, { atts: [{ kind: 'image', url: p.url, name: '照片', size: p.size }] });
          N.toast('发到聊天了');
        }
        if (act === 'del') {
          if (!(await N.confirm({ title: '删除这张？', text: '会先放进「最近删除」，30 天内能找回。', ok: '删除' }))) return;
          await N.api.deletePhoto(p.id); items.splice(i, 1); onChange && onChange();
          if (!items.length) return close();
          i = Math.min(i, items.length - 1); draw();
        }
      });
      draw();
      v.querySelector('[data-v=close]').focus();
    }
  };

  // —— 一条动态 ——
  function postHTML(p, prof) {
    const me = p.by === 'me';
    const name = me ? prof.meName : prof.taName;
    const n = (p.likes.me ? 1 : 0) + (p.likes.ta ? 1 : 0);
    const imgs = p.imgs || [];
    const img = (g, j) => `<button type="button" data-img="${j}" aria-label="看大图">${g.url ? `<img src="${E(g.url)}" alt="">` : 'IMG'}</button>`;
    return `<article class="post ${me ? 'me' : 'ta'}" data-post="${E(p.id)}">
      <header class="hd"><div class="pav">${me ? '我' : 'TA'}</div>
        <div class="nm"><b>${E(name)}</b><span>TX // ${day(p.time)} ${N.time(p.time).includes(':') ? N.time(p.time) : ''}</span></div>
        ${p.mood ? `<span class="mood">◇ 发的时候 · ${E(p.mood)}</span>` : ''}</header>
      ${p.text ? `<p class="tx">${E(p.text)}</p>` : ''}
      ${imgs.length === 1 ? `<button type="button" class="one" data-img="0" aria-label="看大图">${imgs[0].url ? `<img src="${E(imgs[0].url)}" alt="">` : 'IMG · 图片'}</button>` : ''}
      ${imgs.length > 1 ? `<div class="grid">${imgs.slice(0, 9).map(img).join('')}</div>` : ''}
      <div class="ops">
        <button type="button" data-op="like" aria-pressed="${p.likes.me}" aria-label="点赞">${svg(ICON.heart)}${n || ''}</button>
        <button type="button" data-op="cm" aria-label="评论">${svg('M4 5h16v11H9l-5 4z')}${p.comments.length || ''}</button>
        ${imgs.length ? `<button type="button" data-op="keep" aria-label="存进相册">${svg('M3 6h18v13H3z M3 15l5-5 4 4 3-3 6 6')}</button>` : ''}
      </div>
      ${p.comments.length || p._open ? `<div class="cm">
        ${p.comments.map((c) => `<p data-reply="${c.by}"><b class="${c.by}">${E(c.by === 'me' ? prof.meName : prof.taName)}</b>${c.replyTo ? `<span class="to"> 回复 ${E(c.replyTo === 'me' ? prof.meName : prof.taName)}</span>` : ''}：${E(c.text)}</p>`).join('')}
        <label><i aria-hidden="true">&gt;</i><input type="text" maxlength="200" placeholder="回复…" aria-label="写评论" data-cm></label></div>` : ''}
    </article>`;
  }

  N.pages = N.pages || {};
  N.pages.moments = async function (root, sub) {
    const tab = sub === 'album' || sub === 'trash' ? 'album' : 'feed';
    const prof = await N.api.profile();
    const [feed, ph] = await Promise.all([N.api.moments(), N.api.photos({})]);
    const weekAgo = Date.now() - 7 * 86400000;
    const wk = feed.items.filter((p) => p.time > weekAgo);

    root.className = 'page pg-moments';
    root.innerHTML = `
      <div class="page-glow" aria-hidden="true"></div>
      <svg class="hud" aria-hidden="true"></svg>
      <div class="scroll">
        <header class="m-hd">
          <div>
            <span class="tag">${tab === 'feed' ? `◢ FEED.LOG — <em>${feed.items.length} SIGNALS</em>` : `◢ MEMORY.BANK — <em>${ph.counts.all} FILES</em>`}</span>
            <div class="tt"><h1>朋友圈</h1><span class="en">${tab === 'feed' ? 'MOMENTS' : 'ALBUM'}</span></div>
          </div>
          <div class="acts">
            ${tab === 'album' && sub !== 'trash' ? '<button type="button" class="ibtn txtbtn" data-act="select" aria-pressed="false">选择</button>' : ''}
            <button type="button" class="ibtn pinkbtn" data-act="${tab === 'feed' ? 'compose' : 'add'}" aria-label="${tab === 'feed' ? '发动态' : '存照片'}">${tab === 'feed' ? svg(ICON.cam, 'stroke-width="1.3"') : N.icon('plus')}</button>
          </div>
        </header>
        <nav class="m-tabs" role="tablist" aria-label="朋友圈和相册">
          <a role="tab" href="#/moments" aria-selected="${tab === 'feed'}">动态</a>
          <a role="tab" href="#/moments/album" aria-selected="${tab === 'album'}">相册 <b>${ph.counts.all}</b></a>
          ${tab === 'feed' ? `<span class="wk">TA ${wk.filter((p) => p.by === 'ta').length} · 你 ${wk.filter((p) => p.by === 'me').length} · 本周</span>` : ''}
        </nav>
        <div data-body></div>
      </div>
      ${N.tabbar('moments')}
      <input type="file" accept="image/*" multiple hidden data-pick>`;

    const body = root.querySelector('[data-body]');
    const svgEl = root.querySelector('.hud');
    const draw = () => N.hud.page(svgEl);
    const picker = root.querySelector('[data-pick]');
    const pickFiles = () => new Promise((resolve) => { picker.value = ''; picker.onchange = () => resolve([...picker.files]); picker.click(); });

    // ===== 动态 =====
    async function renderFeed() {
      const f = await N.api.moments();
      body.innerHTML = `
        <div class="m-cover">
          <div class="o"><button type="button" class="i" data-act="cover" aria-label="换封面">
            ${f.cover ? `<img src="${E(f.cover)}" alt="">` : `<svg viewBox="0 0 356 218" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs><linearGradient id="mSun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--pink)"/><stop offset="1" style="stop-color:var(--violet)"/></linearGradient></defs>
              <circle cx="250" cy="96" r="44" fill="url(#mSun)" opacity=".55"/>
              <g style="fill:var(--bg)"><rect x="206" y="96" width="88" height="3"/><rect x="206" y="106" width="88" height="4"/><rect x="206" y="118" width="88" height="5"/></g>
              <path d="M0 140 V112 H18 V96 H30 V118 H44 V84 H52 V70 H58 V84 H70 V124 H88 V104 H104 V140 Z M150 140 V110 H164 V92 H176 V120 H194 V100 H204 V140 Z M300 140 V102 H316 V82 H324 V102 H340 V120 H356 V140 Z" style="fill:#120A28;stroke:var(--pink);stroke-opacity:.45"/>
              <g style="stroke:var(--cyan)" stroke-opacity=".4"><path d="M0 140 H356 M0 150 H356 M0 164 H356 M0 184 H356 M0 212 H356 M178 140 L178 218 M178 140 L120 218 M178 140 L236 218 M178 140 L50 218 M178 140 L306 218 M178 140 L-30 218 M178 140 L386 218"/></g>
            </svg>`}
          </button></div>
          <span class="hint">COVER // 点一下换封面</span>
          <div class="m-pair">
            <div class="who ta"><div class="av">${prof.taAvatar ? `<img src="${E(prof.taAvatar)}" alt="">` : 'TA'}</div><span>${E(prof.taName)}</span></div>
            <div class="link" aria-hidden="true"><i class="pulse"></i></div>
            <div class="who me"><div class="av">我</div><span>${E(prof.meName)}</span></div>
          </div>
        </div>
        <div class="m-rail" style="margin-top:58px">
          ${f.items.length ? f.items.map((p) => postHTML(p, prof)).join('') : '<div class="al-empty">还没有动态，点右上角发第一条</div>'}
          ${f.items.length ? '<div class="m-end">— 往下翻看更早 —</div>' : ''}
        </div>`;
      body._feed = f;
    }

    // ===== 相册 =====
    const st = { who: 'all', album: '', selecting: false, picked: new Set() };
    async function renderAlbum() {
      const [res, albums] = await Promise.all([N.api.photos({ who: st.who, album: st.album }), N.api.albums()]);
      const c = res.counts, rest = Math.max(10, Math.round(c.all * 0.3));
      const groups = [];
      res.items.slice().sort((a, b) => b.time - a.time).forEach((p) => {
        const k = day(p.time); let g = groups[groups.length - 1];
        if (!g || g.k !== k) groups.push(g = { k, t: p.time, items: [] });
        g.items.push(p);
      });
      body._items = res.items.slice().sort((a, b) => b.time - a.time);
      let n = 0;
      body.innerHTML = `
        <div class="al-store">
          <div class="bar" aria-hidden="true"><i class="me" style="flex:${c.me}"></i><i class="ta" style="flex:${c.ta}"></i><i class="rest" style="flex:${rest}"></i></div>
          <div class="lg"><span><em class="me">■</em> 我存的 ${c.me}</span><span><em class="ta">■</em> TA 存的 ${c.ta}</span><span style="margin-left:auto">${N.size(c.size)}</span></div>
        </div>
        <div class="al-filter" role="group" aria-label="筛选">
          ${[['all', '全部'], ['me', '我存的'], ['ta', 'TA 存的']].map(([k, t]) => `<button type="button" data-who="${k}" aria-pressed="${st.who === k}">${t}</button>`).join('')}
        </div>
        <div class="al-sec"><span class="n">${String(albums.length).padStart(2, '0')}</span><span class="t">ALBUMS · 相簿</span>${st.album ? '<button type="button" data-album="">看全部照片</button>' : ''}</div>
        <div class="al-albums">
          ${albums.map((a, j) => `<button type="button" class="al-chip ${a.by}" data-album="${E(a.id)}" aria-pressed="${st.album === a.id}">
            <div class="o"><div class="i"><i aria-hidden="true"></i><b>${a.count}</b><span>AL.${String(j + 1).padStart(2, '0')}</span></div></div>
            <b>${E(a.name)}</b><span>${a.by === 'me' ? '我建的' : 'TA 建的'}</span></button>`).join('')}
          <button type="button" class="al-chip new" data-act="new-album"><div class="o"><div class="i"><i aria-hidden="true"></i><b>+</b><span>NEW</span></div></div><b>+ 新建相簿</b><span>两个人都能建</span></button>
        </div>
        <div class="m-rail" style="margin-top:22px">
          ${groups.length ? groups.map((g) => `<section class="al-day"><h2><b>${g.k}</b><span>${dayLabel(g.t)}</span><em>${g.items.length} 张</em></h2>
            <div class="al-grid">${g.items.map((p) => { const idx = n++; return `<button type="button" class="tile ${p.by}" data-ph="${idx}" style="--bg-t:${TONES[idx % TONES.length]}" aria-label="${p.by === 'me' ? '我存的' : 'TA 存的'}照片 ${idx + 1}"${st.selecting ? ` aria-pressed="${st.picked.has(p.id)}"` : ''}>
              ${p.url ? `<img src="${E(p.url)}" alt="">` : ''}<span class="code" aria-hidden="true">IMG_${String(idx + 1).padStart(3, '0')}</span>
              <span class="who">${p.by === 'me' ? '我' : 'TA'}</span>
              ${SRC[p.source] ? `<span class="src" aria-hidden="true">${svg(SRC[p.source], 'stroke-width="1.6"')}</span>` : ''}
              ${st.selecting ? '<span class="chk" aria-hidden="true"></span>' : (p.notes?.ta || p.notes?.me) ? '<span class="note" aria-hidden="true"></span>' : ''}
            </button>`; }).join('')}</div></section>`).join('') : '<div class="al-empty">这里还没有照片。聊天、朋友圈里的图点「存进相册」才会进来。</div>'}
          <a class="al-trash" href="#/moments/trash">${svg(ICON.del)}最近删除 · ${(await N.api.trash()).length} 张<span>30 天内能找回</span></a>
        </div>`;
      root.querySelector('.al-bulk')?.remove();
      if (st.selecting) {
        root.insertAdjacentHTML('beforeend', `<div class="al-bulk"><button type="button" data-bulk="move">${svg(ICON.move, 'stroke-width="1.3"')}移到相簿</button><button type="button" class="chat" data-bulk="chat">${svg(ICON.tochat, 'stroke-width="1.3"')}发到聊天</button><button type="button" class="del" data-bulk="del">${svg(ICON.del, 'stroke-width="1.3"')}删除 ${st.picked.size || ''}</button></div>`);
      }
    }

    async function renderTrash() {
      const list = await N.api.trash();
      body.innerHTML = `<div class="al-sec"><span class="n">${String(list.length).padStart(2, '0')}</span><span class="t">TRASH · 最近删除</span><button type="button" onclick="location.hash='#/moments/album'">回相册</button></div>
        <div class="m-rail" style="margin-top:14px">${list.length ? list.map((p, j) => `<div class="trash-row">
          <span class="tile ${p.by}" style="--bg-t:${TONES[j % TONES.length]}">${p.url ? `<img src="${E(p.url)}" alt="">` : ''}</span>
          <div class="tx">${p.deleted.by === 'me' ? '我' : 'TA'} 删的<span>${day(p.deleted.at)} · 还剩 ${Math.max(0, 30 - Math.floor((Date.now() - p.deleted.at) / 86400000))} 天</span></div>
          <button type="button" class="btn cyan" data-restore="${E(p.id)}">找回</button></div>`).join('') : '<div class="al-empty">最近没有删过照片</div>'}</div>`;
    }

    const render = () => (tab === 'feed' ? renderFeed() : sub === 'trash' ? renderTrash() : renderAlbum());
    await render();
    draw();

    // ===== 交互 =====
    root.addEventListener('click', async (e) => {
      const t = e.target;
      // 动态
      const post = t.closest('[data-post]');
      if (post && body._feed) {
        const p = body._feed.items.find((x) => x.id === post.dataset.post);
        const op = t.closest('[data-op]')?.dataset.op;
        const im = t.closest('[data-img]');
        if (im) return N.viewer.open(p.imgs.map((g) => ({ ...g, by: p.by, time: p.time })), +im.dataset.img, 'feed');
        if (op === 'like') { await N.api.like(p.id); return renderFeed(); }
        if (op === 'cm') { p._open = true; post.outerHTML = postHTML(p, prof); return root.querySelector(`[data-post="${p.id}"] [data-cm]`)?.focus(); }
        if (op === 'keep') { await N.api.savePhotos(p.imgs.map((g) => ({ url: g.url, size: g.size })), 'moments'); return N.toast(`${p.imgs.length} 张存进相册了`); }
        const rp = t.closest('[data-reply]');
        if (rp) { const inp = post.querySelector('[data-cm]'); inp.dataset.to = rp.dataset.reply; inp.placeholder = '回复 ' + (rp.dataset.reply === 'me' ? prof.meName : prof.taName) + '…'; inp.focus(); }
      }
      const act = t.closest('[data-act]')?.dataset.act;
      if (act === 'cover') {
        const [f] = await pickFiles(); if (!f) return;
        const r = await N.api.upload(f); await N.api.setCover(r.url); renderFeed();
      }
      if (act === 'compose') compose();
      if (act === 'add') {
        const files = await pickFiles(); if (!files.length) return;
        const up = []; for (const f of files) up.push(await N.api.upload(f));
        await N.api.savePhotos(up, 'upload', st.album || null); N.toast(`存了 ${up.length} 张`); renderAlbum();
      }
      if (act === 'select') {
        st.selecting = !st.selecting; st.picked.clear();
        t.closest('[data-act]').setAttribute('aria-pressed', st.selecting); t.closest('[data-act]').textContent = st.selecting ? '取消' : '选择';
        renderAlbum();
      }
      if (act === 'new-album') { if (await newAlbum()) renderAlbum(); }
      // 相册
      const who = t.closest('[data-who]'); if (who) { st.who = who.dataset.who; renderAlbum(); }
      const alb = t.closest('[data-album]'); if (alb) { st.album = st.album === alb.dataset.album ? '' : alb.dataset.album; renderAlbum(); }
      const tile = t.closest('[data-ph]');
      if (tile) {
        const p = body._items[+tile.dataset.ph];
        if (st.selecting) { st.picked.has(p.id) ? st.picked.delete(p.id) : st.picked.add(p.id); renderAlbum(); }
        else N.viewer.open(body._items.slice(), +tile.dataset.ph, 'album', renderAlbum);
      }
      const bulk = t.closest('[data-bulk]')?.dataset.bulk;
      if (bulk) {
        const ids = [...st.picked]; if (!ids.length) return N.toast('先点几张照片');
        if (bulk === 'move') { const to = await pickAlbum(`把 ${ids.length} 张移到`); if (to === undefined) return; for (const id of ids) await N.api.movePhoto(id, to); }
        if (bulk === 'chat') {
          const main = (await N.api.windows()).find((w) => w.kind === 'companion');
          const all = body._items.filter((p) => st.picked.has(p.id));
          await N.api.send(main.id, { atts: all.map((p) => ({ kind: 'image', url: p.url, name: '照片', size: p.size })) }); N.toast('发到聊天了');
        }
        if (bulk === 'del') { if (!(await N.confirm({ title: `删除 ${ids.length} 张？`, text: '会先放进「最近删除」，30 天内能找回。', ok: '删除' }))) return; for (const id of ids) await N.api.deletePhoto(id); }
        st.selecting = false; st.picked.clear(); root.querySelector('[data-act=select]').textContent = '选择'; renderAlbum();
      }
      const rs = t.closest('[data-restore]'); if (rs) { await N.api.restorePhoto(rs.dataset.restore); N.toast('找回来了'); renderTrash(); }
    });
    // 评论回车发送
    root.addEventListener('keydown', async (e) => {
      const inp = e.target.closest('[data-cm]'); if (!inp || e.key !== 'Enter' || e.isComposing) return;
      const text = inp.value.trim(); if (!text) return;
      await N.api.comment(inp.closest('[data-post]').dataset.post, { text, replyTo: inp.dataset.to || '' });
      renderFeed();
    });

    // 发动态
    function compose() {
      const imgs = [];
      sheet(`<h3>发动态</h3><div class="compose" style="display:flex;flex-direction:column;gap:10px">
          <label><span class="sr-only">写点什么</span><textarea maxlength="1000" placeholder="写点什么…"></textarea></label>
          <div class="imgs" data-imgs></div>
          <span class="cnt">最多 9 张 · 可以从手机选，也可以从相册里挑</span></div>
        <div class="row"><button type="button" class="btn" data-from="album">从相册选</button><button type="button" class="btn" data-close>取消</button><button type="button" class="btn pink" data-post-ok>发布</button></div>`, (el, close) => {
        const box = el.querySelector('[data-imgs]'), ta = el.querySelector('textarea');
        const paint = () => { box.innerHTML = imgs.map((g, j) => `<span>${g.url ? `<img src="${E(g.url)}" alt="">` : ''}<button type="button" class="rm" data-rm="${j}" aria-label="移除">×</button></span>`).join('') + (imgs.length < 9 ? '<button type="button" class="add" data-add aria-label="加图片">+</button>' : ''); };
        paint(); ta.focus();
        el.addEventListener('click', async (e) => {
          if (e.target.closest('[data-add]')) { const fs = await pickFiles(); for (const f of fs.slice(0, 9 - imgs.length)) imgs.push(await N.api.upload(f)); paint(); }
          const rm = e.target.closest('[data-rm]'); if (rm) { imgs.splice(+rm.dataset.rm, 1); paint(); }
          if (e.target.closest('[data-from]')) {
            const { items } = await N.api.photos({});
            sheet(`<h3>从相册选</h3><div class="al-grid" style="max-height:300px;overflow-y:auto">${items.slice(0, 30).map((p, j) => `<button type="button" class="tile ${p.by}" data-pk="${j}" aria-pressed="false" style="--bg-t:${TONES[j % TONES.length]}">${p.url ? `<img src="${E(p.url)}" alt="">` : ''}<span class="chk" aria-hidden="true"></span></button>`).join('')}</div>
              <div class="row"><button type="button" class="btn" data-close>取消</button><button type="button" class="btn pink" data-pk-ok>好了</button></div>`, (el2, close2) => {
              el2.addEventListener('click', (ev) => { const b = ev.target.closest('[data-pk]'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); });
              el2.querySelector('[data-pk-ok]').onclick = () => { el2.querySelectorAll('[data-pk][aria-pressed="true"]').forEach((b) => { if (imgs.length < 9) imgs.push({ url: items[+b.dataset.pk].url, size: items[+b.dataset.pk].size }); }); close2(); paint(); };
            });
          }
          if (e.target.closest('[data-post-ok]')) {
            const text = ta.value.trim(); if (!text && !imgs.length) return N.toast('写点什么或者放张图');
            await N.api.postMoment({ text, imgs: imgs.map((g) => ({ url: g.url, size: g.size })) }); close(); N.toast('发出去了'); renderFeed();
          }
        });
      });
    }

    // 截预览图 / 录演示用：?viewer 打开第一张照片的大图
    if (tab === 'album' && new URLSearchParams(location.search).has('viewer') && body._items?.length) N.viewer.open(body._items.slice(), 0, 'album', renderAlbum);
    const ro = new ResizeObserver(draw); ro.observe(root);
    return () => { ro.disconnect(); };
  };
})(window.NEON);
