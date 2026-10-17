/* =========================================================================
   哈基米 · 网页编辑模式
   -------------------------------------------------------------------------
   点右下角的「✏️ 编辑」按钮，就能直接在网页上加/改/删游戏和动漫。
   
   改完立刻能看到效果，数据存在你浏览器里，刷新也不会丢。
   
   ⚠️ 重要：浏览器里的修改只存在你这台电脑上。
      别人访问你的网站看不到，换台电脑也看不到。
      想真正保存下来（并且让别人也能看到），要点「导出」，
      把生成的代码粘回 data/content.js。
   ========================================================================= */

(function () {
  'use strict';

  // 版本号：用来确认浏览器加载的是最新代码，而不是缓存里的旧版本。
  // 会写在 <html data-editor-version="..."> 上，按 F12 能在元素面板看到；
  // 也会打印到控制台，并记录到本地存储，方便排查"到底加载了哪一版"。
  var EDITOR_VERSION = '2025-10-17.4';
  try {
    console.log('[编辑器] 已加载，版本 ' + EDITOR_VERSION);
    document.documentElement.setAttribute('data-editor-version', EDITOR_VERSION);
    window.localStorage.setItem('wz-editor-version', EDITOR_VERSION);
  } catch (e) {}

  // 纯函数部分放在这个对象里，方便自动化测试（不需要浏览器就能测）
  var Core = {

    // 数据来源：浏览器里的修改优先，否则用 data/content.js
    load: function (storage) {
      var keys = window.__wzStoreKey || 'wz-content-override-v1';
      try {
        var raw = storage.getItem(keys);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    save: function (storage, data) {
      var keys = window.__wzStoreKey || 'wz-content-override-v1';
      try {
        storage.setItem(keys, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;   // 隐私模式 / 空间满了
      }
    },

    clear: function (storage) {
      var keys = window.__wzStoreKey || 'wz-content-override-v1';
      try { storage.removeItem(keys); } catch (e) {}
    },

    // 新建一个空白的游戏条目
    newGame: function () {
      return {
        icon: '游戏手柄',
        title: '新游戏',
        desc: '',
        points: []
      };
    },

    // 新建一个空白的动漫条目
    newAnime: function () {
      return {
        meta: '在想看 / 在看 / 看完',
        title: '新动漫',
        desc: '',
        tags: [],
        link: ''
      };
    },

    // 把「段落文字」切成一行的数组（用户在输入框里一行写一条）
    linesToArray: function (text) {
      return String(text || '')
        .split('\n')
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
    },

    // 逗号分隔 → 数组（动漫的类型标签）
    commasToArray: function (text) {
      return String(text || '')
        .split(/[,，、;；]/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
    },

    // 从表单读取一个游戏条目
    readGameForm: function (get) {
      return {
        icon: (get('icon') || '游戏手柄').trim(),
        title: (get('title') || '').trim() || '未命名游戏',
        desc: (get('desc') || '').trim(),
        points: Core.linesToArray(get('points'))
      };
    },

    // 从表单读取一个动漫条目
    readAnimeForm: function (get) {
      var link = (get('link') || '').trim();
      return {
        meta: (get('meta') || '').trim(),
        title: (get('title') || '').trim() || '未命名动漫',
        desc: (get('desc') || '').trim(),
        tags: Core.commasToArray(get('tags')),
        link: link
      };
    },

    // 生成可以直接粘回 data/content.js 的代码
    toJsSource: function (data) {
      var games = (data && data.games) || [];
      var anime = (data && data.anime) || [];

      function game(item) {
        var pts = (item.points || []).map(function (p) {
          return '        ' + JSON.stringify(String(p));
        }).join(',\n');
        return '    {\n' +
          '      icon: ' + JSON.stringify(item.icon || '游戏手柄') + ',\n' +
          '      title: ' + JSON.stringify(item.title || '') + ',\n' +
          '      desc: ' + JSON.stringify(item.desc || '') + ',\n' +
          '      points: [\n' + pts + '\n      ]\n' +
          '    }';
      }

      function anim(item) {
        var tags = (item.tags || []).map(function (t) {
          return JSON.stringify(String(t));
        }).join(', ');
        return '    {\n' +
          '      meta: ' + JSON.stringify(item.meta || '') + ',\n' +
          '      title: ' + JSON.stringify(item.title || '') + ',\n' +
          '      desc: ' + JSON.stringify(item.desc || '') + ',\n' +
          '      tags: [' + tags + '],\n' +
          '      link: ' + JSON.stringify(item.link || '') + '\n' +
          '    }';
      }

      return 'window.SITE_CONTENT = {\n\n' +
        '  games: [\n\n' + games.map(game).join(',\n\n') + '\n\n  ],\n\n' +
        '  anime: [\n\n' + anime.map(anim).join(',\n\n') + '\n\n  ]\n\n};\n';
    },

    // 解析导入的内容：既接受 { "games": [...] } 这样的 JSON，
    // 也接受从 data/content.js 里整段复制的 window.SITE_CONTENT = { ... };
    parseImport: function (text) {
      var src = String(text || '').trim();
      if (!src) throw new Error('内容为空');

      // 去掉可能复制进来的外层包装，取出最外层的 { ... }
      var start = src.indexOf('{');
      var end = src.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('里面没有找到 { }');
      var body = src.slice(start, end + 1);

      // 第一步：标准 JSON（导出功能生成的就是标准 JSON）
      var parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        // 第二步：宽松处理 —— 允许 key 不加引号、允许尾逗号。
        // 用逐字符扫描，只改「字符串外面」的内容，
        // 这样字符串里的引号、逗号、换行都不会被误伤。
        try {
          parsed = JSON.parse(Core.loosify(body));
        } catch (e2) {
          throw new Error('看不懂这段内容，请检查引号和逗号');
        }
      }

      if (!parsed || typeof parsed !== 'object' ||
          (!Array.isArray(parsed.games) && !Array.isArray(parsed.anime))) {
        throw new Error('里面没有 games 或 anime');
      }
      return parsed;
    },

    // 把「手写的 JS 对象」转成标准 JSON。
    // 只做三件事，而且全部在字符串之外进行：
    //   1. 给没引号的 key 补上双引号
    //   2. 去掉对象/数组末尾多余的逗号
    //   3. 删掉注释
    loosify: function (src) {
      var out = '';
      var i = 0;
      var n = src.length;

      while (i < n) {
        var ch = src[i];

        // 字符串：原样复制，不碰里面任何内容
        if (ch === '"' || ch === "'") {
          var quote = ch;
          out += '"';
          i++;
          while (i < n) {
            var c = src[i];
            if (c === '\\') {           // 转义序列，连后面一个字符一起copy
              out += c;
              i++;
              if (i < n) { out += src[i]; i++; }
              continue;
            }
            if (c === quote) {          // 字符串结束
              out += '"';
              i++;
              break;
            }
            if (quote === "'" && c === '"') {
              out += '\\"';             // 单引号字符串里的双引号要转义
              i++;
              continue;
            }
            out += c;
            i++;
          }
          continue;
        }

        // 注释：整段删掉
        if (ch === '/' && src[i + 1] === '/') {
          while (i < n && src[i] !== '\n') i++;
          continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
          i += 2;
          while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
          i += 2;
          continue;
        }

        // key 不加引号的情况：{ 或 , 后面跟着一个标识符，再跟冒号
        if (ch === '{' || ch === ',') {
          out += ch;
          i++;
          var ws = '';
          while (i < n && /\s/.test(src[i])) { ws += src[i]; i++; }
          var m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i));
          if (m) {
            out += ws + '"' + m[1] + '":';
            i += m[0].length;
          } else {
            out += ws;
          }
          continue;
        }

        out += ch;
        i++;
      }

      // 去掉 } 或 ] 前面多余的逗号（同样只在字符串外）
      var cleaned = '';
      var inStr = false;
      for (var k = 0; k < out.length; k++) {
        var ch2 = out[k];
        if (inStr) {
          cleaned += ch2;
          if (ch2 === '\\') { cleaned += out[k + 1] || ''; k++; continue; }
          if (ch2 === '"') inStr = false;
          continue;
        }
        if (ch2 === '"') { inStr = true; cleaned += ch2; continue; }
        if (ch2 === ',') {
          var rest = out.slice(k + 1).replace(/^\s+/, '');
          if (rest[0] === '}' || rest[0] === ']') continue;   // 丢掉这个逗号
        }
        cleaned += ch2;
      }

      return cleaned;
    },
  };

  // 暴露给测试
  window.__wzEditorCore = Core;

  /* =======================================================================
     下面是界面部分。没有浏览器环境（比如自动化测试）时会跳过。
     ======================================================================= */

  if (typeof document === 'undefined' || !document.body) return;

  /* ---------- 出错时把问题显示在页面上 ---------- */
  // 为什么要有这个：如果编辑器里出了任何意外错误，
  // 浏览器默认是「静默失败」——用户只看到「点了没反应」，不知道哪里错了。
  // 这里把错误直接显示在页面上，省得去翻开发者工具。
  var banner = null;
  var lastErrorKey = '';

  function showError(where, err) {
    var msg = (err && err.message) ? err.message : String(err);
    var key = where + '::' + msg;
    if (key === lastErrorKey) return;      // 同一个错误不重复弹
    lastErrorKey = key;

    try { console.error('[编辑器] ' + where + ' 出错：', err); } catch (e) {}

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'ed-error';
      document.body.appendChild(banner);
    }
    banner.innerHTML =
      '<b>编辑器出错了</b>' +
      '<span class="ed-error__where">出错位置：' + esc(where) + '</span>' +
      '<span class="ed-error__msg">' + esc(msg) + '</span>' +
      '<span class="ed-error__hint">请把上面这行字截图发给 AI，就能定位问题。</span>' +
      '<button type="button" class="ed-error__close" aria-label="关闭错误提示">✕</button>';

    // 顺手写进存储，刷新后还能查
    try {
      window.localStorage.setItem('wz-editor-last-error',
        new Date().toISOString() + ' | ' + where + ' | ' + msg);
    } catch (e) {}
  }

  // 把任何一段代码包起来跑，出错就显示出来，绝不让它静默失败
  function safely(where, fn) {
    return function (e) {
      try {
        return fn(e);
      } catch (err) {
        showError(where, err);
      }
    };
  }

  // 关闭错误提示
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('.ed-error__close')) {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
      banner = null;
    }
  });

  var overlay = null;
  var open = false;
  var activeKind = 'games';
  var editingIndex = -1;     // -1 表示正在新增
  var working = null;        // 当前正在编辑的数据副本
  var copy = {};             // 界面上的文字

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 读取当前应该显示的数据。
  // 优先级：浏览器里的修改 > data/content.js 的原始数据。
  // ⚠️ 刻意不用 window.__wzData —— 那是渲染脚本上一次算出来的快照。
  //    如果用它，点「还原成文件内容」之后拿到的还是还原前的旧数据，按钮就失效了。
  function currentData() {
    var o = Core.load(window.localStorage);
    var b = window.SITE_CONTENT || window.__wzBase || {};
    return {
      games: (o && Array.isArray(o.games)) ? o.games : (Array.isArray(b.games) ? b.games : []),
      anime: (o && Array.isArray(o.anime)) ? o.anime : (Array.isArray(b.anime) ? b.anime : [])
    };
  }

  function persist() {
    Core.save(window.localStorage, working);
    if (typeof window.__wzRerender === 'function') window.__wzRerender();
    // 顺序很重要：先让 render 重算数据，再刷新编辑面板
    working = currentData();
    refreshFooter();
    renderList();
  }

  /* ---------- 构建界面 ---------- */

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'wzEditor';
    overlay.className = 'ed';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '网站内容编辑器');

    overlay.innerHTML = '' +
      '<div class="ed__backdrop" data-act="close"></div>' +
      '<div class="ed__panel">' +
        '<header class="ed__head">' +
          '<h2 class="ed__title">编辑内容</h2>' +
          '<p class="ed__note">' +
            '改完立刻生效。数据存在<b>这个浏览器</b>里，刷新不会丢。' +
            '<br>但别人看不到——想永久保存，点下面的<b>导出</b>，把代码粘回 <code>data/content.js</code>。' +
          '</p>' +
          '<button class="ed__close" type="button" data-act="close" aria-label="关闭编辑器">✕</button>' +
        '</header>' +

        '<div class="ed__tabs" role="tablist">' +
          '<button class="ed__tab is-active" type="button" data-kind="games" role="tab">我的游戏</button>' +
          '<button class="ed__tab" type="button" data-kind="anime" role="tab">我的动漫</button>' +
        '</div>' +

        '<div class="ed__body">' +
          '<div class="ed__col ed__col--list">' +
            '<div class="ed__listhead">' +
              '<span class="ed__count"></span>' +
              '<button class="ed__btn ed__btn--primary" type="button" data-act="add">+ 新增一条</button>' +
            '</div>' +
            '<div class="ed__list" data-role="list"></div>' +
          '</div>' +

          '<div class="ed__col ed__col--form">' +
            '<div class="ed__form" data-role="form"></div>' +
          '</div>' +
        '</div>' +

        '<footer class="ed__foot">' +
          '<div class="ed__status" data-role="status"></div>' +
          '<div class="ed__footbtns">' +
            '<button class="ed__btn" type="button" data-act="import-open">导入</button>' +
            '<button class="ed__btn" type="button" data-act="reset">还原成文件内容</button>' +
            '<button class="ed__btn ed__btn--primary" type="button" data-act="export">导出并保存</button>' +
          '</div>' +
        '</footer>' +

        '<div class="ed__sheet" data-role="exp" hidden>' +
          '<div class="ed__sheetInner">' +
            '<h3 class="ed__sheetTitle" data-role="expTitle">导出</h3>' +
            '<p class="ed__sheetNote" data-role="expNote"></p>' +
            '<textarea class="ed__code" data-role="code" spellcheck="false" readonly></textarea>' +
            '<div class="ed__sheetBtns" data-role="expBtns"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    buildLauncher();
  }

  // 右下角的悬浮按钮（重复调用也只会有一个）
  //
  // ⚠️ 这里直接把 onclick 挂在按钮上，而不是依赖 document 的事件委托。
  //    原因：委托方式踩过两次坑 ——
  //      一次是「按钮自己的监听器 + document 的委托监听器」同时生效，
  //      一次点击切换了两次，看起来就是「点了没反应」；
  //      一次是委托那层因为 e.target 不是元素而静默失败。
  //    直接挂 onclick 最简单，也最不可能失效。
  //    下面的委托处理器仍然保留（做兜底），靠 toggle() 里的状态判断防止重复触发。
  function buildLauncher() {
    if (document.getElementById('wzEditBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'wzEditBtn';
    btn.className = 'ed-launcher';
    btn.type = 'button';
    // 版本号放在提示文字里：鼠标放上去就能确认加载的是哪一版
    btn.title = '编辑网站内容（脚本版本 ' + EDITOR_VERSION + '）';
    btn.setAttribute('aria-label', '编辑网站内容');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span aria-hidden="true">✏️</span> 编辑' +
      '<span class="ed-launcher__ver" aria-hidden="true">v' + EDITOR_VERSION + '</span>';

    // 直接绑定，不经过事件委托
    btn.onclick = function (e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      safely('打开编辑面板', toggle)();
    };

    document.body.appendChild(btn);
  }

  // 同步按钮的展开状态，方便 CSS 和读屏软件识别
  function syncLauncher() {
    var btn = document.getElementById('wzEditBtn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ---------- 开关 ---------- */

  function toggle() {
    open ? close() : show();
  }

  function show() {
    if (open) return;                        // 已经开着就不重复打开
    if (!overlay) build();
    working = JSON.parse(JSON.stringify(currentData()));
    activeKind = 'games';
    editingIndex = -1;
    open = true;
    overlay.classList.add('is-open');
    document.documentElement.classList.add('ed-lock');
    syncLauncher();
    refreshTabs();
    refreshFooter();
    renderList();
    renderForm();
  }
  function close() {
    if (!open) return;                       // 已经关着就不重复关闭
    open = false;
    if (overlay) overlay.classList.remove('is-open');
    document.documentElement.classList.remove('ed-lock');
    syncLauncher();
    hideSheet();
  }

  function hideSheet() {
    var s = overlay && overlay.querySelector('[data-role="exp"]');
    if (s) s.hidden = true;
  }

  /* ---------- 列表 ---------- */

  function refreshTabs() {
    Array.prototype.forEach.call(overlay.querySelectorAll('.ed__tab'), function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-kind') === activeKind);
    });
  }

  function refreshFooter() {
    var st = overlay.querySelector('[data-role="status"]');
    if (!st) return;
    var has = !!Core.load(window.localStorage);
    st.innerHTML = has
      ? '<span class="ed__dot ed__dot--on"></span>已有本地修改（仅此浏览器可见）'
      : '<span class="ed__dot"></span>当前显示的是 data/content.js 里的原始内容';
  }

  function renderList() {
    var box = overlay.querySelector('[data-role="list"]');
    var list = working[activeKind] || [];
    var label = activeKind === 'games' ? '个游戏' : '部动漫';

    var counter = overlay.querySelector('.ed__count');
    if (counter) counter.textContent = list.length + ' ' + label;

    if (!list.length) {
      box.innerHTML = '<p class="ed__empty">还没有内容，点「+ 新增一条」开始。</p>';
      return;
    }

    box.innerHTML = list.map(function (item, i) {
      var sub = activeKind === 'games'
        ? ((item.points || []).slice(0, 2).join(' · ') || '（没有要点）')
        : (((item.tags || []).join(' · ')) || '（没有标签）');
      var num = activeKind === 'anime' ? String(i + 1).padStart(2, '0') + ' ' : '';
      return '' +
        '<div class="ed__item' + (i === editingIndex ? ' is-active' : '') + '">' +
          '<button class="ed__itemMain" type="button" data-act="edit" data-i="' + i + '">' +
            '<span class="ed__itemTitle">' + num + esc(item.title) + '</span>' +
            '<span class="ed__itemSub">' + esc(sub) + '</span>' +
          '</button>' +
          '<button class="ed__itemDel" type="button" data-act="del" data-i="' + i + '" aria-label="删除">✕</button>' +
        '</div>';
    }).join('');
  }

  /* ---------- 表单 ---------- */

  function field(name, label, value, hint, type) {
    var tag = type === 'area' ? 'textarea' : 'input';
    var inner = type === 'area'
      ? esc(value)
      : '';
    var attrs = type === 'area'
      ? 'rows="3"'
      : 'type="text" value="' + esc(value) + '"';
    return '' +
      '<label class="ed__field">' +
        '<span class="ed__label">' + esc(label) + '</span>' +
        '<' + tag + ' class="ed__input" data-field="' + esc(name) + '" ' + attrs + ' spellcheck="false">' +
          (type === 'area' ? inner : '') +
        '</' + tag + '>' +
        (hint ? '<span class="ed__hint">' + hint + '</span>' : '') +
      '</label>';
  }

  function renderForm() {
    var box = overlay.querySelector('[data-role="form"]');
    var isNew = editingIndex < 0;
    var item = isNew
      ? (activeKind === 'games' ? Core.newGame() : Core.newAnime())
      : working[activeKind][editingIndex];

    if (!item) {
      box.innerHTML = '<p class="ed__empty">从左边选一条来编辑，或者点「+ 新增一条」。</p>';
      return;
    }

    var head = '<div class="ed__formhead">' +
      '<h3 class="ed__formtitle">' + (isNew ? '新增' : '编辑') +
      (activeKind === 'games' ? '游戏' : '动漫') + '</h3>' +
      (isNew ? '' : '<button class="ed__btn ed__btn--danger" type="button" data-act="del-current">删除这条</button>') +
      '</div>';

    var fields;
    if (activeKind === 'games') {
      fields =
        field('title', '游戏名字', item.title || '') +
        field('desc', '为什么喜欢它', item.desc || '', '一两句话就行，写具体一点', 'area') +
        field('points', '小要点（一行一条）', (item.points || []).join('\n'), '比如：在哪个平台玩 / 玩了多久 / 最喜欢什么', 'area') +
        field('icon', '小图标', item.icon || '游戏手柄', '可填：游戏手柄 · 主机 · 剑 · 星星 · 电脑 · 心');
    } else {
      fields =
        field('title', '动漫名字', item.title || '') +
        field('meta', '年份和状态', item.meta || '', '比如：2023 · 看完，或 在看 / 想补') +
        field('desc', '观后感', item.desc || '', '说说哪里打动你，写个具体细节', 'area') +
        field('tags', '类型标签', (item.tags || []).join(', '), '用逗号隔开，比如：奇幻, 治愈') +
        field('link', '链接（可留空）', item.link || '', '留空就不显示「查看详情」按钮');
    }

    box.innerHTML = head + fields +
      '<div class="ed__formbtns">' +
        '<button class="ed__btn ed__btn--primary" type="button" data-act="save">' +
          (isNew ? '添加到网站' : '保存修改') +
        '</button>' +
        (isNew ? '' : '<button class="ed__btn" type="button" data-act="add">改成新增</button>') +
      '</div>';

    // 光标自动落在名字上，方便直接开始打字
    var first = box.querySelector('[data-field="title"]');
    if (first) first.focus();
  }

  function readForm(asNew) {
    var get = function (name) {
      var el = overlay.querySelector('[data-field="' + name + '"]');
      return el ? el.value : '';
    };
    return activeKind === 'games' ? Core.readGameForm(get) : Core.readAnimeForm(get);
  }

  /* ---------- 导出 / 导入 ---------- */

  function showExport() {
    var sheet = overlay.querySelector('[data-role="exp"]');
    var code = overlay.querySelector('[data-role="code"]');
    var title = overlay.querySelector('[data-role="expTitle"]');
    var note = overlay.querySelector('[data-role="expNote"]');
    var btns = overlay.querySelector('[data-role="expBtns"]');

    var payload = { games: working.games || [], anime: working.anime || [] };
    var jsSource = Core.toJsSource(payload);

    title.textContent = '导出并保存';
    note.innerHTML =
      '<b>这样才会真的保存下来，别人也能看到。</b><br>' +
      '① 点「复制」或「下载」拿到代码 &nbsp; ' +
      '② 打开 <code>data/content.js</code>（双击 <code>打开内容文件.cmd</code>） &nbsp; ' +
      '③ 把整个文件内容替换成这段 &nbsp; ④ 保存';
    code.value = jsSource;
    code.readOnly = true;

    btns.innerHTML =
      '<button class="ed__btn ed__btn--primary" type="button" data-act="copy">复制代码</button>' +
      '<button class="ed__btn" type="button" data-act="download-js">下载 content.js</button>' +
      '<button class="ed__btn" type="button" data-act="download-json">下载备份(.json)</button>' +
      '<button class="ed__btn" type="button" data-act="close">关闭</button>';

    sheet.hidden = false;
  }

  function showImport() {
    var sheet = overlay.querySelector('[data-role="exp"]');
    var code = overlay.querySelector('[data-role="code"]');
    var title = overlay.querySelector('[data-role="expTitle"]');
    var note = overlay.querySelector('[data-role="expNote"]');
    var btns = overlay.querySelector('[data-role="expBtns"]');

    title.textContent = '导入';
    note.innerHTML =
      '把 <code>data/content.js</code> 的内容整个复制进来，或粘贴之前的 .json 备份。' +
      '<br>导入会<b>覆盖</b>当前浏览器里的修改。';
    code.value = '';
    code.readOnly = false;
    code.placeholder = '在这里粘贴内容...';

    btns.innerHTML =
      '<button class="ed__btn ed__btn--primary" type="button" data-act="do-import">导入</button>' +
      '<label class="ed__btn ed__btn--file">选择文件<input type="file" accept=".json,.js,.txt" data-act="file" hidden></label>' +
      '<button class="ed__btn" type="button" data-act="close">取消</button>';

    sheet.hidden = false;
    code.focus();
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'ed-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  /* ---------- 事件 ---------- */

  // 统一入口：所有点击都在这里处理。
  // 按钮自己只阻止冒泡，不调用 toggle，所以一次点击只会切换一次。
  document.addEventListener('click', safely('处理点击', function (e) {
    var launcher = e.target.closest('#wzEditBtn');
    if (launcher) { toggle(); return; }

    if (!open) return;

    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');

    // ⚠️ 「关闭」按钮有两个不同含义，必须区分：
    //    浮层（导出/导入）里的关闭 —— 只关浮层，面板要留着
    //    面板里的关闭 —— 关掉整个编辑器
    //    一开始没区分，结果点浮层的关闭会把整个面板一起关掉。
    if (act === 'close') {
      if (btn.closest('.ed__sheet')) hideSheet();
      else close();
      return;
    }
    if (act === 'add') { editingIndex = -1; renderList(); renderForm(); return; }

    if (act === 'edit') {
      editingIndex = parseInt(btn.getAttribute('data-i'), 10);
      renderList(); renderForm();
      return;
    }

    if (act === 'del') {
      var i = parseInt(btn.getAttribute('data-i'), 10);
      var it = working[activeKind][i];
      if (window.confirm('确定删除「' + (it.title || '这一条') + '」吗？')) {
        working[activeKind].splice(i, 1);
        if (editingIndex === i) editingIndex = -1;
        else if (editingIndex > i) editingIndex--;
        persist();
        renderForm();
      }
      return;
    }

    if (act === 'del-current') {
      if (editingIndex < 0) return;
      var cur = working[activeKind][editingIndex];
      if (window.confirm('确定删除「' + (cur.title || '这一条') + '」吗？')) {
        working[activeKind].splice(editingIndex, 1);
        editingIndex = -1;
        persist();
        renderForm();
      }
      return;
    }

    if (act === 'save') {
      var item = readForm();
      if (editingIndex < 0) {
        working[activeKind].push(item);
        editingIndex = working[activeKind].length - 1;
        toast('已添加');
      } else {
        working[activeKind][editingIndex] = item;
        toast('已保存');
      }
      persist();
      renderForm();
      return;
    }

    if (act === 'export') { showExport(); return; }
    if (act === 'import-open') { showImport(); return; }

    if (act === 'reset') {
      if (window.confirm('把浏览器里的修改全部清除，恢复成 data/content.js 里的内容？')) {
        // ⚠️ 顺序很重要，三步都不能颠倒：
        //    1. 先清除浏览器里的修改
        //    2. 再让页面重新渲染（现在读到的是 data/content.js 的原始数据）
        //    3. 最后把编辑面板的数据也换成原始数据
        //    如果先渲染后清除，读到的还是旧数据，「还原」就等于没还原。
        Core.clear(window.localStorage);
        if (typeof window.__wzRerender === 'function') window.__wzRerender();
        working = JSON.parse(JSON.stringify(currentData()));
        editingIndex = -1;
        renderList();
        renderForm();
        refreshFooter();
        syncLauncher();
        toast('已还原成 data/content.js 里的内容');
      }
      return;
    }

    if (act === 'copy') {
      var code = overlay.querySelector('[data-role="code"]');
      var done = function () { toast('代码已复制，去粘贴到 data/content.js'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code.value).then(done, function () { code.select(); done(); });
      } else {
        code.removeAttribute('readonly');
        code.select();
        try { document.execCommand('copy'); done(); } catch (err) { toast('复制失败，请手动选中复制'); }
        code.setAttribute('readonly', 'readonly');
      }
      return;
    }

    if (act === 'download-js' || act === 'download-json') {
      var payload = { games: working.games || [], anime: working.anime || [] };
      if (act === 'download-js') {
        download('content.js', Core.toJsSource(payload), 'text/javascript;charset=utf-8');
      } else {
        download('content-backup.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
      }
      return;
    }

    if (act === 'do-import') {
      var ta = overlay.querySelector('[data-role="code"]');
      try {
        var parsed = Core.parseImport(ta.value);
        working = {
          games: Array.isArray(parsed.games) ? parsed.games : [],
          anime: Array.isArray(parsed.anime) ? parsed.anime : []
        };
        editingIndex = -1;
        persist();
        renderList();
        renderForm();
        hideSheet();
        toast('导入成功');
      } catch (err) {
        toast('导入失败：' + err.message);
      }
      return;
    }
  }));

  // 切换标签
  document.addEventListener('click', safely('切换标签页', function (e) {
    var tab = e.target.closest('.ed__tab');
    if (!tab || !open) return;
    activeKind = tab.getAttribute('data-kind');
    editingIndex = -1;
    refreshTabs();
    renderList();
    renderForm();
  }));

  // 选择文件导入
  document.addEventListener('change', safely('读取导入文件', function (e) {
    var input = e.target.closest('[data-act="file"]');
    if (!input || !input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = safely('解析导入文件', function () {
      var ta = overlay.querySelector('[data-role="code"]');
      ta.value = String(reader.result || '');
      toast('文件已读入，点「导入」确认');
    });
    reader.onerror = function () { showError('读取导入文件', new Error('文件读取失败')); };
    reader.readAsText(input.files[0], 'utf-8');
  }));

  // Esc 关闭
  document.addEventListener('keydown', safely('按下 Esc', function (e) {
    if (e.key === 'Escape' && open) close();
  }));

  // 页面加载完就把悬浮按钮放上去（不会自动打开面板）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safely('创建编辑按钮', buildLauncher));
  } else {
    safely('创建编辑按钮', buildLauncher)();
  }
})();
