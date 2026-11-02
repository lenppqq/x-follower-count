// ==UserScript==
// @name         X 用户列表显示粉丝数
// @namespace    https://x.com/
// @version      1.2.0
// @description  在 X 的 followers / following 等用户列表里，每个用户的 @handle 旁边显示他的粉丝数，按阈值高亮，并可过滤低粉丝用户
// @homepageURL  https://github.com/lenppqq/x-follower-count
// @updateURL    https://raw.githubusercontent.com/lenppqq/x-follower-count/main/x-follower-count.user.js
// @downloadURL  https://raw.githubusercontent.com/lenppqq/x-follower-count/main/x-follower-count.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @inject-into  page
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BADGE_CLASS = 'xfc-badge';
  const STORAGE_KEY = 'xfc-settings';

  const STYLES = {
    border: '明显边框',
    orange: '橙色加粗',
    rainbow: '彩虹动态边框',
  };

  const FILTER_MODES = {
    hide: '彻底隐藏',
    mini: '最小化',
    strip: '头像排',
  };

  const DEFAULT_TIERS = [
    { min: 3000, style: 'border' },
    { min: 5000, style: 'orange' },
    { min: 10000, style: 'rainbow' },
  ];

  const DEFAULT_FILTER = { enabled: false, min: 100, mode: 'mini' };

  // 只在这些用户列表页显示过滤栏、做过滤
  const LIST_PAGE_RE = /^\/[^/]+\/(followers|following|verified_followers|followers_you_follow)\/?$/;

  const fmt = new Intl.NumberFormat(navigator.language || 'zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  // ---------- 设置读写 ----------

  function sanitizeTiers(list) {
    return list
      .map((t) => ({ min: Math.max(0, Math.floor(Number(t.min))), style: t.style }))
      .filter((t) => Number.isFinite(t.min) && STYLES[t.style])
      .sort((a, b) => a.min - b.min);
  }

  function sanitizeFilter(f) {
    const min = Math.max(0, Math.floor(Number(f?.min)));
    return {
      enabled: !!f?.enabled,
      min: Number.isFinite(min) ? min : DEFAULT_FILTER.min,
      mode: FILTER_MODES[f?.mode] ? f.mode : DEFAULT_FILTER.mode,
    };
  }

  function loadSettings() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {}
    return {
      tiers: Array.isArray(saved?.tiers) ? sanitizeTiers(saved.tiers) : DEFAULT_TIERS.map((t) => ({ ...t })),
      filter: saved?.filter ? sanitizeFilter(saved.filter) : { ...DEFAULT_FILTER },
    };
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  const settings = loadSettings();

  // 返回满足条件的最高一档的样式
  function tierStyle(count) {
    let style = null;
    for (const t of settings.tiers) if (count >= t.min) style = t.style;
    return style;
  }

  // ---------- 样式 ----------

  const css = document.createElement('style');
  css.textContent = `
    .${BADGE_CLASS} {
      --xfc-page-bg: #fff;
      flex-shrink: 0;
      margin-left: 6px;
      padding: 0 6px;
      border: 2px solid transparent;
      border-radius: 6px;
      font-size: 12px;
      line-height: 16px;
      font-weight: 600;
      color: rgb(29, 155, 240);
      background: rgba(29, 155, 240, 0.12);
      white-space: nowrap;
      cursor: pointer;
    }
    .${BADGE_CLASS}.xfc-border {
      border-color: rgb(29, 155, 240);
    }
    .${BADGE_CLASS}.xfc-orange {
      color: rgb(255, 122, 0);
      background: rgba(255, 122, 0, 0.14);
      border: 3px solid rgb(255, 122, 0);
      font-size: 13px;
      font-weight: 800;
    }
    .${BADGE_CLASS}.xfc-rainbow {
      font-size: 13px;
      font-weight: 800;
      color: rgb(255, 122, 0);
      border: 3px solid transparent;
      background:
        linear-gradient(rgba(255, 122, 0, 0.12), rgba(255, 122, 0, 0.12)) padding-box,
        linear-gradient(var(--xfc-page-bg), var(--xfc-page-bg)) padding-box,
        linear-gradient(90deg, #ff004c, #ff8a00, #ffe600, #2bd96b, #00c8ff, #7a5cff, #ff2bd6, #ff004c) border-box;
      background-size: 100% 100%, 100% 100%, 300% 100%;
      animation: xfc-rainbow 2.5s linear infinite;
      box-shadow: 0 0 6px rgba(255, 90, 160, 0.45);
    }
    @keyframes xfc-rainbow {
      from { background-position: 0 0, 0 0, 0% 0; }
      to   { background-position: 0 0, 0 0, 150% 0; }
    }

    /* ----- 过滤栏 ----- */
    .xfc-filterbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 8px 16px;
      border-bottom: 1px solid rgba(128, 128, 128, 0.25);
      font-size: 14px;
      color: var(--xfc-fg);
    }
    .xfc-filterbar label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .xfc-filterbar input[type="number"] {
      width: 80px;
      padding: 3px 6px;
      border: 1px solid rgba(128, 128, 128, 0.5);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .xfc-seg { display: inline-flex; border: 1px solid rgba(128, 128, 128, 0.5); border-radius: 999px; overflow: hidden; }
    .xfc-seg button {
      padding: 3px 10px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .xfc-seg button + button { border-left: 1px solid rgba(128, 128, 128, 0.5); }
    .xfc-seg button.xfc-on { background: rgb(29, 155, 240); color: #fff; font-weight: 700; }
    .xfc-filterbar.xfc-off .xfc-seg,
    .xfc-filterbar.xfc-off input[type="number"] { opacity: 0.5; }
    .xfc-filtered-count { margin-left: auto; font-size: 13px; opacity: 0.65; }

    /* ----- 被过滤的行 ----- */
    .xfc-f-hide > :not(.xfc-ui),
    .xfc-f-mini > :not(.xfc-ui),
    .xfc-f-strip > :not(.xfc-ui) { display: none !important; }
    .xfc-f-hide > .xfc-ui { display: none; }

    .xfc-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 16px;
      border-bottom: 1px solid rgba(128, 128, 128, 0.15);
      font-size: 13px;
      line-height: 18px;
      color: var(--xfc-fg);
      opacity: 0.7;
      text-decoration: none;
      cursor: pointer;
    }
    .xfc-mini:hover { opacity: 1; background: rgba(128, 128, 128, 0.08); }
    .xfc-mini img { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }
    .xfc-mini .xfc-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .xfc-mini .xfc-handle { opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .xfc-mini .${BADGE_CLASS} { margin-left: auto; }

    .xfc-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding: 6px 16px;
      border-bottom: 1px solid rgba(128, 128, 128, 0.15);
      color: var(--xfc-fg);
    }
    .xfc-strip-label { font-size: 12px; opacity: 0.6; margin-right: 4px; }
    .xfc-strip a { display: block; width: 28px; height: 28px; border-radius: 50%; overflow: hidden; opacity: 0.8; }
    .xfc-strip a:hover { opacity: 1; outline: 2px solid rgb(29, 155, 240); }
    .xfc-strip img { width: 100%; height: 100%; display: block; }

    /* ----- 设置面板 ----- */
    .xfc-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(91, 112, 131, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .xfc-panel {
      width: min(460px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      box-sizing: border-box;
      padding: 20px;
      border-radius: 16px;
      background: var(--xfc-page-bg);
      color: var(--xfc-fg);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
    }
    .xfc-panel h2 { margin: 0 0 4px; font-size: 20px; }
    .xfc-panel p { margin: 0 0 16px; font-size: 13px; opacity: 0.7; }
    .xfc-row {
      display: grid;
      grid-template-columns: auto 1fr 1fr auto auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .xfc-panel input, .xfc-panel select {
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid rgba(128, 128, 128, 0.5);
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .xfc-panel select option { color: #000; }
    .xfc-panel .xfc-preview { justify-self: start; margin-left: 0; cursor: default; }
    .xfc-btn {
      padding: 6px 14px;
      border: 1px solid rgba(128, 128, 128, 0.5);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .xfc-btn:hover { background: rgba(128, 128, 128, 0.12); }
    .xfc-btn.xfc-primary { background: var(--xfc-fg); color: var(--xfc-page-bg); border-color: var(--xfc-fg); }
    .xfc-btn.xfc-icon { padding: 4px 9px; }
    .xfc-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .xfc-actions .xfc-spacer { flex: 1; }
  `;
  document.head.appendChild(css);

  function pageBg() {
    return getComputedStyle(document.body).backgroundColor || '#fff';
  }

  function pageFg() {
    return getComputedStyle(document.body).color || '#0f1419';
  }

  function applyTierClass(el, count) {
    const style = tierStyle(count);
    for (const s of Object.keys(STYLES)) el.classList.toggle('xfc-' + s, s === style);
  }

  function makeBadge(count) {
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.textContent = fmt.format(count) + ' 粉丝';
    badge.title = count.toLocaleString() + ' 位粉丝（点击打开高亮设置）';
    badge.style.setProperty('--xfc-page-bg', pageBg());
    applyTierClass(badge, count);
    badge.addEventListener('click', (e) => {
      // 拦住点击，不让整行跳转到用户主页
      e.preventDefault();
      e.stopPropagation();
      openSettings();
    });
    return badge;
  }

  // ---------- 读取用户数据 ----------

  // X 的 UserCell 是 React 组件，用户对象（含 followers_count）就挂在组件 props 上
  function getUser(cell) {
    const key = Object.keys(cell).find((k) => k.startsWith('__reactFiber$'));
    let fiber = key && cell[key];
    for (let i = 0; fiber && i < 30; i++, fiber = fiber.return) {
      const user = fiber.memoizedProps?.user;
      if (user && user.screen_name) {
        return {
          screenName: user.screen_name,
          name: user.name ?? user.legacy?.name ?? user.screen_name,
          avatar: user.profile_image_url_https ?? user.legacy?.profile_image_url_https ?? '',
          followers: user.followers_count ?? user.legacy?.followers_count,
        };
      }
    }
    return null;
  }

  // ---------- 列表标注 ----------

  function annotate(cell, user) {
    let badge = cell.querySelector('.' + BADGE_CLASS);
    // 虚拟列表会复用 DOM，已标注且是同一个人只刷新高亮
    if (!(badge && badge.dataset.user === user.screenName && badge.dataset.count === String(user.followers))) {
      const handle = [...cell.querySelectorAll('a[href] span')].find(
        (s) => s.textContent.toLowerCase() === '@' + user.screenName.toLowerCase()
      );
      const link = handle?.closest('a');
      const row = link?.parentElement?.parentElement; // @handle 和「关注了你」所在的那一行
      if (!row) return;

      const fresh = makeBadge(user.followers);
      if (badge) badge.replaceWith(fresh);
      badge = fresh;
      badge.dataset.user = user.screenName;
      badge.dataset.count = String(user.followers);
      link.parentElement.after(badge);
    }
    badge.style.setProperty('--xfc-page-bg', pageBg());
    applyTierClass(badge, user.followers);
  }

  // ---------- 过滤 ----------

  let filteredSeen = new Set();
  let lastPath = location.pathname;

  function isListPage() {
    return LIST_PAGE_RE.test(location.pathname);
  }

  // 点击我们自己画的条目时，转交给被隐藏的原始 UserCell，走 X 自己的路由跳转
  function openUser(e, screenName) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return; // 让新标签页打开等行为照常
    e.preventDefault();
    e.stopPropagation();
    const avatar = document.querySelector(`[data-testid="primaryColumn"] [data-testid="UserAvatar-Container-${CSS.escape(screenName)}"]`);
    const userCell = avatar?.closest('[data-testid="UserCell"]');
    if (userCell) userCell.click();
    else location.href = '/' + screenName;
  }

  function setUi(cellInner, mode, key, build) {
    const cls = ['xfc-f-hide', 'xfc-f-mini', 'xfc-f-strip'];
    for (const c of cls) cellInner.classList.toggle(c, c === 'xfc-f-' + mode);
    let ui = cellInner.querySelector(':scope > .xfc-ui');
    if (!mode || mode === 'hide') {
      ui?.remove();
      return;
    }
    if (ui && ui.dataset.key === key) return; // 内容没变就不动，避免和 MutationObserver 互相触发
    const fresh = build();
    fresh.classList.add('xfc-ui');
    fresh.dataset.key = key;
    fresh.style.setProperty('--xfc-fg', pageFg());
    if (ui) ui.replaceWith(fresh);
    else cellInner.appendChild(fresh);
  }

  function buildMini(user) {
    const a = document.createElement('a');
    a.className = 'xfc-mini';
    a.href = '/' + user.screenName;
    a.title = `${user.name} @${user.screenName}（粉丝少于 ${settings.filter.min.toLocaleString()}，已最小化）`;
    const img = document.createElement('img');
    img.src = user.avatar;
    img.alt = '';
    const name = document.createElement('span');
    name.className = 'xfc-name';
    name.textContent = user.name;
    const handle = document.createElement('span');
    handle.className = 'xfc-handle';
    handle.textContent = '@' + user.screenName;
    a.append(img, name, handle, makeBadge(user.followers));
    a.addEventListener('click', (e) => openUser(e, user.screenName));
    return a;
  }

  function buildStrip(users) {
    const div = document.createElement('div');
    div.className = 'xfc-strip';
    const label = document.createElement('span');
    label.className = 'xfc-strip-label';
    label.textContent = `${users.length} 位低粉丝用户`;
    div.appendChild(label);
    for (const u of users) {
      const a = document.createElement('a');
      a.href = '/' + u.screenName;
      a.title = `${u.name} @${u.screenName} · ${u.followers.toLocaleString()} 粉丝`;
      const img = document.createElement('img');
      img.src = u.avatar;
      img.alt = u.screenName;
      a.appendChild(img);
      a.addEventListener('click', (e) => openUser(e, u.screenName));
      div.appendChild(a);
    }
    return div;
  }

  function cellY(el) {
    const m = /translateY\(([-\d.]+)px\)/.exec(el.style.transform);
    return m ? parseFloat(m[1]) : 0;
  }

  function applyFilter(entries) {
    const f = settings.filter;
    const active = f.enabled && isListPage();
    entries.sort((a, b) => cellY(a.inner) - cellY(b.inner));

    let run = []; // 连续被过滤的行，头像排模式下合并成一排
    const flushRun = () => {
      if (!run.length) return;
      const key = 'strip:' + run.map((r) => r.user.screenName).join(',');
      setUi(run[0].inner, 'strip', key, () => buildStrip(run.map((r) => r.user)));
      for (const r of run.slice(1)) setUi(r.inner, 'hide', 'hide');
      run = [];
    };

    for (const entry of entries) {
      const { inner, user } = entry;
      const filtered = active && user && typeof user.followers === 'number' && user.followers < f.min;
      if (!filtered) {
        flushRun();
        setUi(inner, null);
        continue;
      }
      filteredSeen.add(user.screenName);
      if (f.mode === 'strip') run.push(entry);
      else if (f.mode === 'mini') setUi(inner, 'mini', 'mini:' + user.screenName + ':' + user.followers, () => buildMini(user));
      else setUi(inner, 'hide', 'hide');
    }
    flushRun();
  }

  // ---------- 过滤栏（插在 tabs 和列表之间） ----------

  function buildFilterBar() {
    const bar = document.createElement('div');
    bar.className = 'xfc-filterbar';
    bar.innerHTML = `
      <label><input type="checkbox" class="xfc-enabled"> 过滤粉丝少于</label>
      <input type="number" class="xfc-min" min="0" step="100">
      <span>的用户</span>
      <span class="xfc-seg">${Object.entries(FILTER_MODES).map(([k, v]) => `<button type="button" data-mode="${k}">${v}</button>`).join('')}</span>
      <span class="xfc-filtered-count"></span>
    `;
    const enabled = bar.querySelector('.xfc-enabled');
    const min = bar.querySelector('.xfc-min');
    enabled.checked = settings.filter.enabled;
    min.value = settings.filter.min;

    const update = () => {
      settings.filter = sanitizeFilter({ ...settings.filter, enabled: enabled.checked, min: min.value });
      saveSettings();
      refreshBar(bar);
      scan();
    };
    enabled.addEventListener('change', update);
    min.addEventListener('input', () => {
      if (min.value === '') return;
      update();
    });
    bar.querySelector('.xfc-seg').addEventListener('click', (e) => {
      const mode = e.target.closest('[data-mode]')?.dataset.mode;
      if (!mode) return;
      settings.filter.mode = mode;
      if (!settings.filter.enabled) enabled.checked = true; // 选了方式就顺手打开过滤
      update();
    });
    // 不让 X 的键盘快捷键吃掉输入
    bar.addEventListener('keydown', (e) => e.stopPropagation());
    refreshBar(bar);
    return bar;
  }

  function refreshBar(bar) {
    const f = settings.filter;
    bar.classList.toggle('xfc-off', !f.enabled);
    bar.style.setProperty('--xfc-fg', pageFg());
    bar.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('xfc-on', b.dataset.mode === f.mode));
    const counter = bar.querySelector('.xfc-filtered-count');
    const text = f.enabled ? `已过滤 ${filteredSeen.size} 人` : '';
    // 只在变化时写入，否则会触发 MutationObserver 形成每帧一次的死循环
    if (counter.textContent !== text) counter.textContent = text;
  }

  function ensureFilterBar() {
    const existing = document.querySelector('.xfc-filterbar');
    if (!isListPage()) {
      existing?.remove();
      return;
    }
    const nav = document.querySelector('[data-testid="primaryColumn"] nav[role="navigation"]');
    if (!nav?.querySelector('[role="tablist"]')) return;
    if (existing && existing.previousElementSibling === nav) {
      refreshBar(existing);
      return;
    }
    existing?.remove();
    nav.after(buildFilterBar());
  }

  // ---------- 主循环 ----------

  function scan() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      filteredSeen = new Set();
    }

    const entries = [];
    document.querySelectorAll('[data-testid="UserCell"]').forEach((cell) => {
      const user = getUser(cell);
      if (user && typeof user.followers === 'number') annotate(cell, user);
      const inner = cell.closest('[data-testid="cellInnerDiv"]');
      if (inner && inner.closest('[data-testid="primaryColumn"]')) entries.push({ inner, user });
    });
    applyFilter(entries);
    ensureFilterBar();
  }

  // ---------- 设置面板 ----------

  function openSettings() {
    if (document.querySelector('.xfc-overlay')) return;

    let draft = settings.tiers.map((t) => ({ ...t }));

    const overlay = document.createElement('div');
    overlay.className = 'xfc-overlay';
    overlay.style.setProperty('--xfc-page-bg', pageBg());
    overlay.style.setProperty('--xfc-fg', pageFg());
    overlay.innerHTML = `
      <div class="xfc-panel" role="dialog" aria-label="粉丝数高亮设置">
        <h2>粉丝数高亮设置</h2>
        <p>粉丝数达到阈值时使用对应样式；同时满足多档时取阈值最高的一档。</p>
        <div class="xfc-rows"></div>
        <div class="xfc-actions">
          <button class="xfc-btn" data-act="add">＋ 添加阈值</button>
          <button class="xfc-btn" data-act="reset">恢复默认</button>
          <span class="xfc-spacer"></span>
          <button class="xfc-btn" data-act="cancel">取消</button>
          <button class="xfc-btn xfc-primary" data-act="save">保存</button>
        </div>
      </div>
    `;
    const rowsEl = overlay.querySelector('.xfc-rows');

    function renderRows() {
      rowsEl.innerHTML = '';
      draft.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'xfc-row';
        row.innerHTML = `
          <span>粉丝 ≥</span>
          <input type="number" min="0" step="100">
          <select>${Object.entries(STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <span class="${BADGE_CLASS} xfc-preview"></span>
          <button class="xfc-btn xfc-icon" title="删除这一档">✕</button>
        `;
        const [input, select, preview, del] = [
          row.querySelector('input'),
          row.querySelector('select'),
          row.querySelector('.xfc-preview'),
          row.querySelector('button'),
        ];
        input.value = t.min;
        select.value = t.style;
        const refresh = () => {
          preview.textContent = fmt.format(Number(input.value) || 0) + ' 粉丝';
          preview.style.setProperty('--xfc-page-bg', pageBg());
          for (const s of Object.keys(STYLES)) preview.classList.toggle('xfc-' + s, s === select.value);
        };
        input.addEventListener('input', () => { t.min = input.value; refresh(); });
        select.addEventListener('change', () => { t.style = select.value; refresh(); });
        del.addEventListener('click', () => { draft.splice(i, 1); renderRows(); });
        refresh();
        rowsEl.appendChild(row);
      });
    }

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return close();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'add') {
        const last = draft[draft.length - 1];
        draft.push({ min: last ? Number(last.min) * 2 || 1000 : 1000, style: 'border' });
        renderRows();
      } else if (act === 'reset') {
        draft = DEFAULT_TIERS.map((t) => ({ ...t }));
        renderRows();
      } else if (act === 'cancel') {
        close();
      } else if (act === 'save') {
        settings.tiers = sanitizeTiers(draft);
        saveSettings();
        close();
        // 最小化条目里的徽章是我们自己画的，清掉缓存让它们按新阈值重画
        document.querySelectorAll('.xfc-ui').forEach((ui) => delete ui.dataset.key);
        scan();
      }
    });
    document.addEventListener('keydown', onKey, true);

    renderRows();
    document.body.appendChild(overlay);
  }

  // ---------- 启动 ----------

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();
