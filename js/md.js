/* 小号 Markdown：段落、标题、加粗、斜体、行内代码、链接、有序/无序列表、引用、代码块。
   代码块单独拆出来（聊天里是独立一格），所以 split() 返回 [{ kind: 'md', html } | { kind: 'code', lang, code }] */
window.NEON = window.NEON || {};
(function (N) {
  const esc = N.esc;
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  function block(text) {
    const lines = text.split('\n'); let html = '', list = null, para = [];
    const flushPara = () => { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const flushList = () => { if (list) { html += `<${list.t}>` + list.items.map((x) => '<li>' + inline(x) + '</li>').join('') + `</${list.t}>`; list = null; } };
    for (const raw of lines) {
      const l = raw.trimEnd();
      let m;
      if (!l.trim()) { flushPara(); flushList(); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flushPara(); flushList(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
      if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))) { flushPara(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[2]); continue; }
      if ((m = l.match(/^\s*[-*]\s+(.*)/))) { flushPara(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = l.match(/^>\s?(.*)/))) { flushPara(); flushList(); html += '<blockquote>' + inline(m[1]) + '</blockquote>'; continue; }
      flushList(); para.push(l);
    }
    flushPara(); flushList();
    return html;
  }

  N.md = {
    split(text) {
      const out = []; const re = /```(\w*)\n?([\s\S]*?)(```|$)/g; let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) { const t = text.slice(last, m.index).trim(); if (t) out.push({ kind: 'md', html: block(t) }); }
        out.push({ kind: 'code', lang: m[1] || 'text', code: m[2].replace(/\n$/, '') });
        last = re.lastIndex;
        if (!m[3]) break;
      }
      const rest = text.slice(last).trim();
      if (rest) out.push({ kind: 'md', html: block(rest) });
      return out;
    },
    html: block
  };
})(window.NEON);
