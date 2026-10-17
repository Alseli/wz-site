/* =========================================================================
   哈基米 · 个人主页交互
   -------------------------------------------------------------------------
   这个文件只做 5 件小事：
     1. 明暗主题切换（记住你的选择）
     2. 手机上折叠菜单
     3. 导航高亮当前所在区块
     4. 滚动到可见位置时淡入
     5. 自动填页脚年份
   全部是渐进增强：哪怕这个文件加载失败，页面内容依然完整可读。
   ========================================================================= */

(function () {
  'use strict';

  /* 打个标记：JS 可用。CSS 里只有 .js 存在时才启用「先隐藏再淡入」，
     这样 JS 挂掉时内容不会永久隐身。 */
  document.documentElement.classList.add('js');

  var root = document.documentElement;

  /* ---------- 1. 明暗主题 ---------- */

  var THEME_KEY = 'theme';
  var themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式下会失败，忽略 */ }
    if (themeToggle) {
      themeToggle.setAttribute(
        'aria-label',
        theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'
      );
    }
  }

  if (themeToggle) {
    // 同步一次按钮的无障碍标签（页面加载时主题已在 <head> 里定好）
    themeToggle.setAttribute(
      'aria-label',
      root.getAttribute('data-theme') === 'dark' ? '切换到亮色主题' : '切换到暗色主题'
    );

    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  /* ---------- 2. 手机折叠菜单 ---------- */

  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');

  function setMenu(open) {
    if (!burger || !navLinks) return;
    navLinks.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }

  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });

    // 点了某个链接就收起菜单
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    // 点页面别处、或按 Esc 也收起
    document.addEventListener('click', function (e) {
      if (!navLinks.classList.contains('is-open')) return;
      if (e.target.closest('#nav')) return;
      setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });

    // 屏幕变宽后清掉手机端的展开状态
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

  /* ---------- 3. 滚动时给导航加分隔线 ---------- */

  var nav = document.getElementById('nav');
  var lastScrollState = null;
  function syncNav() {
    var scrolled = window.scrollY > 12;
    if (scrolled === lastScrollState) return; // 避免每帧都改 class
    lastScrollState = scrolled;
    if (nav) nav.classList.toggle('is-scrolled', scrolled);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      syncNav();
      ticking = false;
    });
  }, { passive: true });
  syncNav();

  /* ---------- 4. 导航高亮当前区块 ---------- */

  var navAnchors = navLinks
    ? Array.prototype.slice.call(navLinks.querySelectorAll('a[href^="#"]'))
    : [];

  if (navAnchors.length && 'IntersectionObserver' in window) {
    // 记录每个区块当前是否在视口里，取最靠上的那个作为「当前区块」
    var visible = new Map();

    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target.id, entry.isIntersecting);
      });

      var currentId = null;
      navAnchors.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        if (!currentId && visible.get(id)) currentId = id;
      });

      navAnchors.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href').slice(1) === currentId);
      });
    }, {
      // 上方留出导航的高度，下方收窄到中间一条带，判断更贴近直觉
      rootMargin: '-84px 0px -55% 0px',
      threshold: 0
    });

    navAnchors.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) sectionObserver.observe(el);
    });
  }

  /* ---------- 5. 滚动淡入 ---------- */

  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  var revealObserver = null;

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target); // 只播一次
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    // 老浏览器：不做动效，直接全部显示
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // render.js 生成卡片后会发这个事件。生成的卡片可能带 .reveal 类，
  // 所以这里再扫一遍，把新来的也纳入观察，避免它们一直不显示。
  document.addEventListener('content:rendered', function () {
    if (!revealObserver) return;
    var fresh = document.querySelectorAll('.reveal:not(.is-visible)');
    Array.prototype.forEach.call(fresh, function (el) { revealObserver.observe(el); });
  });

  /* ---------- 6. 页脚年份 ---------- */

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
