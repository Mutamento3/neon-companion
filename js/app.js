/* 路由 + 底栏。#/ 聊天列表 · #/chat/窗口id 聊天 · #/xinchao 心潮念 · #/moments 朋友圈 · #/moments/album 相册 · #/moments/trash 最近删除 · #/settings 设置 */
window.NEON = window.NEON || {};
(function (N) {
  const TABS = [
    { key: 'chat', href: '#/', icon: 'chat', label: '聊天' },
    { key: 'xinchao', href: '#/xinchao', icon: 'pulse', label: '心潮念' },
    { key: 'moments', href: '#/moments', icon: 'moments', label: '朋友圈' },
    { key: 'settings', href: '#/settings', icon: 'gear', label: '设置' }
  ];
  N.tabbar = (active) => `<nav class="tabbar" aria-label="主导航">${TABS.map((t) =>
    `<a class="tab" href="${t.href}"${t.key === active ? ' aria-current="page"' : ''}>${N.icon(t.icon, 'stroke-width="1.2"')}<span>${t.label}</span></a>`).join('')}</nav>`;

  // 还没设计的页
  const STUB = {}; // 以后新加的页先放这里占位：{ key: ['标题', '小字'] }
  function stub(root, key) {
    root.className = 'page';
    root.innerHTML = `<div class="page-glow" aria-hidden="true"></div><div class="stub"><b>${STUB[key][0]}</b><span>${STUB[key][1]}</span></div>${N.tabbar(key)}`;
  }

  // 外观（设置页以后写进 neon.look）：主色、气泡色、字号、光晕
  // 外观存在这台设备（neon.look），设置页改了马上调这里
  const LOOK_VARS = { pink: '--pink', cyan: '--cyan', violet: '--violet', meBubble: '--me-bubble', taBubble: '--ta-bubble', glow: '--glow', chatFont: '--chat-font' };
  function applyLook() {
    const look = N.store.get('look', {});
    const root = document.documentElement.style;
    Object.entries(LOOK_VARS).forEach(([k, v]) => { if (look[k] != null && look[k] !== '') root.setProperty(v, k === 'chatFont' ? look[k] + 'px' : look[k]); else root.removeProperty(v); });
    document.getElementById('app').classList.toggle('no-hud', look.hud === false);
    document.title = (N.store.get('profile', {}).appName) || N.MOCK.profile.appName;
  }
  N.applyLook = applyLook;

  let cleanup = null, seq = 0;
  async function render() {
    const my = ++seq;
    cleanup && cleanup(); cleanup = null;
    const app = document.getElementById('app');
    const root = document.createElement('div');
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    try {
      let c;
      document.querySelectorAll('#app .viewer, #app .sheet-mask').forEach((x) => x.remove());
      if (parts[0] === 'chat' && parts[1]) c = await N.pages.chat(root, decodeURIComponent(parts[1]));
      else if (parts[0] === 'moments') c = await N.pages.moments(root, parts[1] || '');
      else if (parts[0] === 'settings') c = await N.pages.settings(root);
      else if (parts[0] === 'xinchao') c = await N.pages.xinchao(root);
      else if (STUB[parts[0]]) stub(root, parts[0]);
      else c = await N.pages.list(root);
      if (my !== seq) { c && c(); return; } // 等数据期间又换了页
      app.querySelectorAll('.page').forEach((p) => p.remove());
      app.prepend(root);
      cleanup = c || null;
    } catch (e) {
      console.error(e);
      root.className = 'page';
      root.innerHTML = `<div class="stub"><b>没加载出来</b><span>${N.esc(e.message || '刷新一下试试')}</span></div>`;
      app.querySelectorAll('.page').forEach((p) => p.remove()); app.prepend(root);
    }
  }

  N.app = { rerender: render };
  applyLook();
  window.addEventListener('hashchange', render);
  render();
})(window.NEON);
