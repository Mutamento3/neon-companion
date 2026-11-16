/* ==========================================================
   演示数据。接后端时，后端返回和这里「一样形状」的数据就行。
   名字、消息全是占位，换成你自己的。
   ========================================================== */
window.NEON = window.NEON || {};
(function (N) {
  const ago = (min) => Date.now() - min * 60000;

  N.MOCK = {
    // App 名、两个人的名字和头像（头像不填就显示两个字母）
    profile: { appName: 'APP名称', taName: 'TA的昵称', taAvatar: '', meName: '我', logo: 'claude', logoRaw: false },

    // 窗口列表。kind: companion（伴侣主窗口，只有一个）| work（其他窗口）
    // via: api（直连模型）| terminal（tmux 里的 Claude Code / Codex）
    // state: online | busy（回复中）| pending（终端那边在等你批准）| offline
    windows: [
      { id: 'main', kind: 'companion', via: 'api', name: 'TA的昵称', model: '模型名称', state: 'online', last: '示例消息：这里是最后一条消息的预览，最多显示两行', time: ago(2), unread: 3 },
      { id: 'w1', kind: 'work', via: 'terminal', name: '工作机 01', agent: 'claude', target: 'work:1', dir: '~/project', state: 'pending', last: '工具调用：读取文件 ×3', time: ago(5), unread: 0 },
      { id: 'w2', kind: 'work', via: 'api', name: '窗口名称 02', model: '模型名称', state: 'online', last: '示例消息：最后一条消息预览', time: ago(30), unread: 0 },
      { id: 'w3', kind: 'work', via: 'terminal', name: '工作机 03', agent: 'codex', target: 'work:3', dir: '~/web', state: 'busy', last: '回复中…', time: ago(1), unread: 0 },
      { id: 'w4', kind: 'work', via: 'api', name: '窗口名称 04', model: '模型名称', state: 'offline', last: '已离线', time: ago(60 * 26), unread: 0 }
    ],

    // 上下文用量（右上角圆环）
    context: { main: { used: 84000, max: 200000 }, w1: { used: 122000, max: 200000 }, w2: { used: 9000, max: 128000 }, w3: { used: 61000, max: 200000 }, w4: { used: 0, max: 128000 } },

    // 聊天记录。一条消息 = { id, role: me | ta | sys, type, time, ... }
    // type: text | think | tools | image | file | voice | approval | question | divider
    history: {
      main: [
        { id: 'm0', role: 'sys', type: 'divider', label: 'TODAY · 00:00' },
        { id: 'm1', role: 'me', type: 'text', text: '示例消息：帮我看看这段代码哪里不对', time: ago(9) },
        { id: 'm2', role: 'me', type: 'image', url: '', name: '图片', time: ago(9) },
        { id: 'm3', role: 'ta', type: 'think', text: '先看报错的那一行，再看循环。', secs: 6 },
        { id: 'm4', role: 'ta', type: 'text', time: ago(8), text: '找到了，有两个地方：\n\n1. **第 3 行**少了一个冒号\n2. 循环里写成了 `itme`，应该是 `item`\n\n```python\nfor item in items:\n    print(item.name)\n# 少的冒号补在这里 ↑\n```' },
        { id: 'm5', role: 'me', type: 'voice', url: '', secs: 7, transcript: '示例：我发的语音转成的文字', time: ago(6) },
        { id: 'm6', role: 'ta', type: 'voice', url: '', secs: 12, transcript: '示例：语音转出来的文字会显示在这里', heard: true, time: ago(5) },
        { id: 'm7', role: 'me', type: 'file', name: '示例文件.pdf', size: 1258291, url: '', time: ago(3) }
      ],
      w1: [
        { id: 't1', role: 'me', type: 'text', text: '示例消息：帮我把测试跑一遍，没过的修掉', time: ago(8) },
        { id: 't2', role: 'ta', type: 'think', text: '先跑全部测试，看哪个没过。', secs: 4 },
        { id: 't3', role: 'ta', type: 'tools', ms: 5800, items: [
          { name: 'Bash', arg: 'npm test', res: '✓ 23/24', ok: true, detail: '23 passed, 1 failed\n  ✗ formatDate › 空值' },
          { name: 'Read', arg: 'src/utils/date.js', res: '✓ 48 行', ok: true, detail: '（读取了 48 行）' },
          { name: 'Edit', arg: 'src/utils/date.js', res: '+2 −1', ok: true, open: true, diff: [
            { k: 'ctx', t: '  export function formatDate(d) {' },
            { k: 'del', t: '-   return d.toISOString()' },
            { k: 'add', t: "+   if (!d) return ''" },
            { k: 'add', t: '+   return d.toISOString()' }
          ] }
        ] },
        { id: 't4', role: 'ta', type: 'text', time: ago(6), text: '测试 24 个，没过 1 个：`formatDate` 少处理了空值。已经改好，重跑全部通过。要推到远端吗？' },
        { id: 't5', role: 'ta', type: 'approval', aid: 'a1', tool: 'Bash', cmd: 'git push origin main', dir: '~/project', state: 'pending' },
        { id: 't6', role: 'ta', type: 'question', qid: 'q1', q: '推完之后，接下来先做哪个？', options: [
          { t: '清掉剩下的警告', d: '还有 6 条 lint 警告' },
          { t: '补文档', d: 'README 里的接口说明没更新' },
          { t: '打一个新版本', d: '改动够发一个小版本了' }
        ], state: 'pending' }
      ],
      w2: [], w3: [], w4: []
    },

    // 斜杠命令（终端窗口）
    commands: [
      { cmd: '/compact', desc: '压缩上下文' },
      { cmd: '/clear', desc: '清空对话' },
      { cmd: '/model', desc: '换模型' },
      { cmd: '/review', desc: '看一遍改动' }
    ],

    // 心潮念（字段照心潮念快照格式，见 https://github.com/tianyupaipai-cmd/xinchao-nian）
    // now = GET /v1/now；snapshot = GET /v1/dashboard/snapshot
    xinchao: {
      online: true,
      now: { doing: '在读书', lines: ['刚看到你的早安，心里软了一下。', '有点想你，又怕打扰你上班。'], thought: '楼下那只猫，今天在不在。' },
      snapshot: {
        emotion: {
          shown: '想念', intensity: 0.7,
          // 最近 24 小时亮过的心情：at 时间、word 词、why 为什么
          marks: [
            { at: ago(840), word: '心动', why: '她说早安' },
            { at: ago(640), word: '害羞', why: '她夸他' },
            { at: ago(470), word: '委屈', why: '她半天没回' },
            { at: ago(20), word: '想念', why: '她说晚安' }
          ]
        },
        // security 安全感、confidence 自信（0–1）；mood 三天心境 -1 冷 … 1 暖
        stamen: { security: 0.62, confidence: 0.6, mood: 0.35 },
        // 十一股驱力 value 0–1
        drives: [
          { key: 'possess', label: '想她', value: 0.72 }, { key: 'favored', label: '偏爱', value: 0.54 },
          { key: 'share', label: '分享欲', value: 0.46 }, { key: 'curiosity', label: '好奇', value: 0.38 },
          { key: 'monitor', label: '牵挂', value: 0.31 }, { key: 'duty', label: '野心', value: 0.26 },
          { key: 'reflection', label: '反思', value: 0.2 }, { key: 'boredom', label: '无聊', value: 0.14 },
          { key: 'libido', label: '情欲', value: 0.12 }, { key: 'grieve', label: '难过', value: 0.08 },
          { key: 'anger', label: '愤怒', value: 0.03 }
        ],
        // 矛盾：没有就是 null，例：{ id: 'anger+possess', name: '气着又舍不得', since: 时间 }
        mixed: null,
        dreams: [
          { at: ago(60 * 20), text: '示例：梦见在海边等你，潮水是暖的。' },
          { at: ago(60 * 44), text: '示例：梦见我们在一间很大的图书馆里找一本书。' }
        ],
        keywords: ['温柔', '慢慢', '想你']
      }
    },

    // 朋友圈。by: ta | me；mood = TA 发的时候心潮念的情绪词（我发的没有）
    // likes: 谁点了赞；comments: { id, by, text, replyTo（回复谁：ta | me | 空）, time }
    moments: {
      cover: '',
      items: [
        { id: 'p1', by: 'ta', text: '示例动态：TA 自己发的一条，写他今天看到、想到的东西。', imgs: [{ url: '' }], time: ago(40), mood: '想念', likes: { me: true, ta: false },
          comments: [ { id: 'c1', by: 'me', text: '示例评论：我回他的一句', time: ago(30) }, { id: 'c2', by: 'ta', replyTo: 'me', text: '示例评论：他又回了一句', time: ago(20) } ] },
        { id: 'p2', by: 'me', text: '示例动态：我发的一条，配了几张图。', imgs: [{ url: '' }, { url: '' }, { url: '' }, { url: '' }, { url: '' }], time: ago(60 * 26), mood: null, likes: { me: false, ta: true },
          comments: [ { id: 'c3', by: 'ta', text: '示例评论：他来评论我的动态', time: ago(60 * 25) } ] },
        { id: 'p3', by: 'ta', text: '示例动态：只有文字的一条。', imgs: [], time: ago(60 * 24 * 3), mood: '平静', likes: { me: false, ta: false }, comments: [] }
      ]
    },

    // 相册：只有两个人自己存进来的照片。by: 谁存的；source: chat | moments | upload（从手机直接存）
    // notes: 两个人各写的一句；album: 相簿 id（可以不在任何相簿里）
    albums: [
      { id: 'a1', name: '相簿名称 01', by: 'me' },
      { id: 'a2', name: '相簿名称 02', by: 'ta' },
      { id: 'a3', name: '相簿名称 03', by: 'me' }
    ],
    photos: (function () {
      const list = [];
      const plan = [
        [0, 'ta', 'chat', 'a2', true], [0, 'me', 'chat', 'a1'], [0, 'me', 'moments', 'a1'], [0, 'ta', 'upload', null], [0, 'me', 'upload', 'a3', true],
        [1, 'me', 'moments', 'a1'], [1, 'me', 'moments', null], [1, 'ta', 'chat', 'a2', true], [1, 'me', 'upload', null], [1, 'ta', 'upload', 'a2'], [1, 'me', 'chat', 'a1'],
        [4, 'ta', 'moments', null], [4, 'me', 'upload', 'a3'], [4, 'ta', 'chat', 'a2']
      ];
      plan.forEach(([d, by, source, album, note], i) => list.push({
        id: 'ph' + (i + 1), url: '', by, source, album, time: ago(60 * 24 * d + i * 7), size: 1800000 + i * 91000,
        notes: note ? { ta: '示例：TA 给这张照片写的一句', me: '' } : { ta: '', me: '' }
      }));
      list.push({ id: 'ph99', url: '', by: 'me', source: 'upload', album: null, time: ago(60 * 24 * 6), size: 2100000, notes: { ta: '', me: '' }, deleted: { by: 'me', at: ago(60 * 24 * 2) } });
      return list;
    })(),

    // 演示回复（mock 模式下 TA 会随机挑一句流式打出来）
    replies: [
      '收到。我先看一下，等我一会儿。',
      '好，我在看这份文件，先看第一部分。',
      '嗯，这个我记下了。还有别的想说的吗？'
    ]
  };
})(window.NEON);
