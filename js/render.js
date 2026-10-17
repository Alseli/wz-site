/* =========================================================================
   哈基米 · 把自己填的游戏和动漫变成网页卡片
   -------------------------------------------------------------------------
   这个文件你不用改。要加游戏/动漫，请改 data/content.js。
   
   工作原理：
     1. 读取 data/content.js 里的 window.SITE_CONTENT
     2. 找到页面上标记了 data-content="games" / "anime" 的容器
     3. 按数据生成卡片，塞进容器
   
   安全说明：所有文字都经过转义才放进页面。
   就算你在内容里写了 <script> 之类的符号，也只会当普通文字显示，不会执行。
   ========================================================================= */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- 工具函数 ---------- */

  // 转义 HTML 特殊字符，防止内容里的符号破坏页面结构
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 链接的地址也做一次过滤，只允许 http/https/mailto/相对路径
  function safeUrl(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(u)) return u;
    return ''; // 出现 javascript: 这类危险协议就直接丢掉
  }

  /* ---------- 图标 ---------- */

  // 卡片左上角的小图标。你在 content.js 里写中文名，这里对应到图形
  var ICONS = {
    '游戏手柄': '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7.5 10.5v3M6 12h3M16 11.5h.01M18 13.5h.01"/>',
    '主机':     '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    '剑':       '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/>',
    '星星':     '<path d="M12 3l2.6 5.6 6.1.8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.4l6.1-.8z"/>',
    '电脑':     '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    '心':       '<path d="M12 20s-7-4.4-7-9.4A4 4 0 0 1 12 7a4 4 0 0 1 7 3.6c0 5-7 9.4-7 9.4z"/>'
  };
  var DEFAULT_ICON = ICONS['游戏手柄'];

  function iconSvg(name) {
    return ICONS[String(name || '').trim()] || DEFAULT_ICON;
  }

  /* ---------- 生成卡片 HTML ---------- */

  function gameCard(item, index) {
    var points = Array.isArray(item.points) ? item.points : [];
    var listHtml = points.length
      ? '<ul class="list">' + points.map(function (p) {
          return '<li>' + esc(p) + '</li>';
        }).join('') + '</ul>'
      : '';

    return '' +
      '<article class="card">' +
        '<div class="card__icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24">' + iconSvg(item.icon) + '</svg>' +
        '</div>' +
        '<h3 class="card__title">' + esc(item.title) + '</h3>' +
        (item.desc ? '<p class="card__desc">' + esc(item.desc) + '</p>' : '') +
        listHtml +
      '</article>';
  }

  function animeCard(item, index) {
    var tags = Array.isArray(item.tags) ? item.tags : [];
    var tagsHtml = tags.length
      ? '<ul class="tags tags--sm">' + tags.map(function (t) {
          return '<li>' + esc(t) + '</li>';
        }).join('') + '</ul>'
      : '';

    // 编号：你在 content.js 里写了就用你的，没写就自动按顺序排 01/02/03
    var number = String(item.number || '').trim() ||
      (index + 1 < 10 ? '0' + (index + 1) : String(index + 1));

    var url = safeUrl(item.link);
    var linkHtml = url
      ? '<div class="project__links">' +
          '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">' +
            '查看详情' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>' +
          '</a>' +
        '</div>'
      : '';

    return '' +
      '<article class="project">' +
        '<div class="project__thumb" aria-hidden="true"><span>' + esc(number) + '</span></div>' +
        '<div class="project__body">' +
          (item.meta ? '<p class="project__meta">' + esc(item.meta) + '</p>' : '') +
          '<h3 class="project__title">' + esc(item.title) + '</h3>' +
          (item.desc ? '<p class="project__desc">' + esc(item.desc) + '</p>' : '') +
          tagsHtml +
          linkHtml +
        '</div>' +
      '</article>';
  }

  // 数据为空时给一句人话提示，而不是留一片空白
  function emptyHint(what, file) {
    return '<p class="content-empty">' +
      '这里还没有内容。打开 <code>' + esc(file) + '</code>，' +
      '照着示例加一个' + esc(what) + '，保存后刷新页面就会出现在这里。' +
      '</p>';
  }

  /* ---------- 读取数据 ---------- */

  // 你在网页「编辑模式」里改的内容存在浏览器里，优先级高于 data/content.js。
  // 所以这里的顺序是：浏览器里的修改 → data/content.js 的原始数据
  var STORE_KEY = 'wz-content-override-v1';

  function readOverride() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;   // 隐私模式、file:// 协议下可能不可用，忽略即可
    }
  }

  var base = window.SITE_CONTENT || {};
  var override = readOverride();

  var data = {
    // 有修改就用修改的，没有就用文件里的
    games: (override && Array.isArray(override.games)) ? override.games
         : (Array.isArray(base.games) ? base.games : []),
    anime: (override && Array.isArray(override.anime)) ? override.anime
         : (Array.isArray(base.anime) ? base.anime : [])
  };

  // 挂到 window 上，方便编辑模式读取当前状态
  window.__wzData = data;
  window.__wzHasOverride = !!override;

  function renderList(container) {
    var kind = container.getAttribute('data-content');   // "games" 或 "anime"
    var list = data && Array.isArray(data[kind]) ? data[kind] : [];

    if (!list.length) {
      var labels = { games: '游戏', anime: '动漫' };
      container.innerHTML = emptyHint(labels[kind] || '内容', 'data/content.js');
      return 0;
    }

    container.innerHTML = list.map(function (item, index) {
      return kind === 'games' ? gameCard(item, index) : animeCard(item, index);
    }).join('');

    return list.length;
  }

  // 整个渲染流程包装成一个函数，方便编辑模式改完数据后重新画一遍
  function renderAll() {
    var containers = document.querySelectorAll('[data-content]');
    var total = 0;

    // 每次重画都重新算一遍数据来源
    var ov = readOverride();
    window.__wzData = data = {
      games: (ov && Array.isArray(ov.games)) ? ov.games : (Array.isArray(base.games) ? base.games : []),
      anime: (ov && Array.isArray(ov.anime)) ? ov.anime : (Array.isArray(base.anime) ? base.anime : [])
    };
    window.__wzHasOverride = !!ov;

    Array.prototype.forEach.call(containers, function (container) {
      total += renderList(container);
    });

    if (total > 0) {
      root.setAttribute('data-content-rendered', String(total));
      document.dispatchEvent(new CustomEvent('content:rendered', {
        detail: { count: total }
      }));
    }

    // 首屏数字：自动按实际卡片数量填写
    var gEl = document.querySelector('[data-count="games"]');
    var aEl = document.querySelector('[data-count="anime"]');
    if (gEl) gEl.textContent = String(data.games.length);
    if (aEl) aEl.textContent = String(data.anime.length);

    return total;
  }

  renderAll();

  // 暴露给编辑模式：改完数据后调用 __wzRerender() 就能立刻看到效果
  window.__wzRerender = renderAll;
  window.__wzStoreKey = STORE_KEY;
  window.__wzBase = base;
})();
