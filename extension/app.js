(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isExt = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['blue', 'violet', 'bronze', 'teal', 'straw'];
  const KEY = 'forgeTab';
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  let state = null;
  let editing = false;

  // ---------------------------------------------------------------- storage
  const store = {
    async load() {
      try {
        if (isExt && chrome.storage && chrome.storage.local) {
          const r = await chrome.storage.local.get(KEY);
          return r[KEY] || null;
        }
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    async save(data) {
      try {
        if (isExt && chrome.storage && chrome.storage.local) await chrome.storage.local.set({ [KEY]: data });
        else localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { toast('Changes were not saved: ' + e.message); }
    }
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
  // Every dashboard tab tags its saves, so other open tabs can pick up the
  // change instead of later overwriting it with their older copy.
  const TAB_ID = uid('tab');
  const save = () => { state._writer = TAB_ID; return store.save(state); };

  function sanitize(s) {
    if (!s || !Array.isArray(s.groups)) return null;
    s.groups.forEach((g) => {
      g.id = g.id || uid('g');
      g.name = g.name || 'Untitled';
      g.color = COLORS.includes(g.color) ? g.color : 'blue';
      g.tiles = Array.isArray(g.tiles) ? g.tiles.filter((t) => t && t.url) : [];
      g.tiles.forEach((t) => { t.id = t.id || uid('t'); t.name = t.name || hostOf(t.url); t.icon = t.icon || { type: 'auto' }; });
    });
    s.checks = Array.isArray(s.checks) ? s.checks : [];
    if (!Array.isArray(s.commands)) s.commands = clone((window.FORGE_DEFAULTS && window.FORGE_DEFAULTS.commands) || []);
    s.commands = s.commands.filter((k) => k && k.cmd).map((k) => ({
      id: k.id || uid('k'),
      name: k.name || k.cmd,
      cmd: k.cmd,
      where: k.where === 'forge' ? 'server' : (['server', 'windows', 'any'].includes(k.where) ? k.where : 'any')
    }));
    s.fills = s.fills && typeof s.fills === 'object' ? s.fills : {};
    if (typeof s.openInNewTab !== 'boolean') s.openInNewTab = true;
    s.notes = Array.isArray(s.notes)
      ? s.notes.filter((n) => n && typeof n.text === 'string').map((n) => ({
        id: n.id || uid('n'),
        text: n.text,
        updated: n.updated || Date.now(),
        pinned: !!n.pinned,
        color: COLORS.includes(n.color) ? n.color : null
      }))
      : [];
    return s;
  }

  // ---------------------------------------------------------------- urls + icons
  function normalizeUrl(v) {
    v = (v || '').trim();
    if (!v) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^(mailto|tel|chrome):/i.test(v)) return v;
    const host = v.split(/[/?#]/)[0].split(':')[0];
    const local = !host.includes('.') || /^(\d+\.){3}\d+$/.test(host) || host.endsWith('.local') || host.endsWith('.ts.net');
    return (local ? 'http://' : 'https://') + v;
  }
  function hostOf(url) {
    try { return new URL(url).host.replace(/^www\./, ''); } catch { return url || ''; }
  }
  function looksLikeUrl(v) {
    return /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v) || /^[\w-]+:\d+(\/\S*)?$/.test(v);
  }
  function faviconUrl(url) {
    if (!isExt) return null;
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', url);
    u.searchParams.set('size', '64');
    return u.href;
  }
  // Chrome hands back a generic globe for sites it has no icon for yet.
  // Fingerprint that globe once, and show a coloured letter instead of it.
  const iconSig = (im) => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    c.getContext('2d').drawImage(im, 0, 0, 16, 16);
    return c.toDataURL();
  };
  const defaultIcon = isExt ? new Promise((res) => {
    const i = new Image();
    i.onload = () => { try { res(iconSig(i)); } catch { res(null); } };
    i.onerror = () => res(null);
    i.src = faviconUrl('https://no-icon.invalid/');
  }) : Promise.resolve(null);

  function iconEl(tile, cls = 'tile-icon') {
    const el = document.createElement('div');
    el.className = cls;
    const type = (tile.icon && tile.icon.type) || 'auto';
    const val = tile.icon && tile.icon.value;
    const letter = ((tile.name || '').trim().charAt(0) || '?').toUpperCase();
    const fav = type === 'auto' && tile.url ? faviconUrl(tile.url) : null;
    if (type === 'emoji' && val) { el.classList.add('emoji'); el.textContent = val; }
    else if (type === 'image' && val) { el.classList.add('image'); el.append(img(val)); }
    else if (fav) {
      const i = img(fav);
      i.addEventListener('load', () => defaultIcon.then((sig) => {
        let same = false;
        try { same = sig && iconSig(i) === sig; } catch { /* ignore */ }
        if (same) { el.textContent = letter; el.classList.add('letter'); }
      }));
      el.append(i);
    }
    else { el.classList.add('letter'); el.textContent = letter; }
    return el;
  }
  function img(src) {
    const i = new Image();
    i.alt = ''; i.decoding = 'async'; i.draggable = false; i.src = src;
    return i;
  }
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Website links follow the "Open shortcuts in a new tab" setting; app links
  // (like vscode://file/...) never do, since they open an app, not a page.
  const isWeb = (url) => /^https?:/i.test(url || '');
  const wantsNewTab = (url) => !!(state && state.openInNewTab && isWeb(url));
  function linkTarget(a, url) {
    if (wantsNewTab(url)) { a.target = '_blank'; a.rel = 'noopener'; }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); }
  }

  function findTile(id) {
    for (const g of state.groups) {
      const t = g.tiles.find((x) => x.id === id);
      if (t) return { tile: t, group: g };
    }
    return null;
  }

  // ---------------------------------------------------------------- motion
  // FLIP: remember where things were, change the DOM, then glide them from
  // the old spot to the new one so nothing ever jumps.
  function flip(mutate) {
    const sel = '.tile[data-id]:not(.ghost), .group-head[data-gid], .add-group';
    if (reduceMotion) { mutate(); return; }
    const keyOf = (e) => e.dataset.id || (e.dataset.gid ? 'h:' + e.dataset.gid : 'add-group');
    const before = new Map($$(sel).map((e) => [keyOf(e), e.getBoundingClientRect()]));
    mutate();
    for (const e of $$(sel)) {
      const b = before.get(keyOf(e));
      const a = e.getBoundingClientRect();
      if (!a.width) continue;
      if (!b) {
        e.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
        continue;
      }
      const dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 340, easing: EASE });
    }
  }

  // ---------------------------------------------------------------- render
  const groupsEl = $('#groups');

  function render() {
    document.body.classList.toggle('editing', editing);
    groupsEl.textContent = '';
    if (!state.groups.length && !editing) {
      const p = h('p', 'empty', 'No shortcuts yet.');
      const b = h('button', 'mini', 'Add a group');
      b.type = 'button';
      b.addEventListener('click', () => { setEditing(true); addGroup(); });
      p.append(b);
      groupsEl.append(p);
      return;
    }
    for (const g of state.groups) groupsEl.append(groupEl(g));
    const add = h('button', 'add-group', 'Add group');
    add.type = 'button';
    add.dataset.action = 'add-group';
    groupsEl.append(add);
  }

  function groupEl(g) {
    const sec = h('section', 'group');
    sec.dataset.id = g.id;
    sec.style.setProperty('--c', `var(--${g.color})`);

    const head = h('div', 'group-head');
    head.dataset.gid = g.id;
    const sw = h('button', 'swatch');
    sw.type = 'button';
    sw.dataset.action = 'color';
    sw.tabIndex = editing ? 0 : -1;
    sw.setAttribute('aria-label', editing ? `Change colour of ${g.name}` : '');
    sw.title = editing ? 'Change colour' : '';
    if (!editing) sw.disabled = true;
    head.append(sw);

    if (editing) {
      const inp = h('input', 'group-name-input');
      inp.value = g.name;
      inp.maxLength = 32;
      inp.setAttribute('aria-label', 'Group name');
      inp.dataset.action = 'rename';
      head.append(inp);
    } else {
      head.append(h('h2', 'group-name', g.name));
    }

    const tools = h('div', 'group-tools');
    const del = h('button', 'mini', 'Delete group');
    del.type = 'button';
    del.dataset.action = 'delete-group';
    if (g.tiles.length) { del.disabled = true; del.title = 'Move or delete its shortcuts first'; }
    tools.append(del);
    head.append(tools);
    sec.append(head);

    const grid = h('div', 'tiles');
    grid.dataset.group = g.id;
    for (const t of g.tiles) grid.append(tileEl(t));
    const add = h('button', 'tile add-tile');
    add.type = 'button';
    add.dataset.action = 'add-tile';
    const plus = h('div', 'tile-icon', '+');
    add.append(plus, h('span', 'tile-label', 'Add'));
    add.setAttribute('aria-label', `Add shortcut to ${g.name}`);
    grid.append(add);
    sec.append(grid);
    return sec;
  }

  function tileEl(t) {
    const a = h('a', 'tile');
    a.href = t.url;
    a.dataset.id = t.id;
    a.draggable = false;
    a.title = `${t.name}\n${hostOf(t.url)}`;
    linkTarget(a, t.url);
    a.append(iconEl(t), h('span', 'tile-label', t.name));
    return a;
  }

  // ---------------------------------------------------------------- edit mode
  const editBtn = $('#editBtn');
  function setEditing(on) {
    if (editing === on) return;
    editing = on;
    editBtn.setAttribute('aria-pressed', String(on));
    editBtn.textContent = on ? 'Done' : 'Edit';
    $('#editHint').hidden = !on;
    flip(render);
  }
  editBtn.addEventListener('click', () => setEditing(!editing));

  function addGroup() {
    const used = state.groups.map((g) => g.color);
    const color = COLORS.find((c) => !used.includes(c)) || COLORS[state.groups.length % COLORS.length];
    const g = { id: uid('g'), name: 'New group', color, tiles: [] };
    state.groups.push(g);
    save();
    flip(render);
    const inp = $(`.group-head[data-gid="${g.id}"] input`);
    if (inp) { inp.focus(); inp.select(); }
  }

  // Clicks inside the shortcut area
  let suppressClick = false;
  let justDragged = false;
  groupsEl.addEventListener('click', (e) => {
    if (suppressClick || justDragged) { e.preventDefault(); suppressClick = false; return; }
    const act = e.target.closest('[data-action]');
    const tile = e.target.closest('.tile[data-id]');
    const sec = e.target.closest('.group');
    const g = sec && state.groups.find((x) => x.id === sec.dataset.id);

    if (act) {
      const a = act.dataset.action;
      if (a === 'add-group') { addGroup(); return; }
      if (a === 'add-tile' && g) { openEditor(null, g.id); return; }
      if (a === 'color' && g && editing) {
        g.color = COLORS[(COLORS.indexOf(g.color) + 1) % COLORS.length];
        sec.style.setProperty('--c', `var(--${g.color})`);
        save();
        return;
      }
      if (a === 'delete-group' && g && !g.tiles.length) {
        const snap = clone(state);
        state.groups = state.groups.filter((x) => x !== g);
        save();
        flip(render);
        toast(`Deleted ${g.name}`, () => { state = snap; save(); flip(render); });
        return;
      }
    }
    if (tile && editing) { e.preventDefault(); openEditor(tile.dataset.id); }
  });
  groupsEl.addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'rename') return;
    const sec = e.target.closest('.group');
    const g = state.groups.find((x) => x.id === sec.dataset.id);
    g.name = e.target.value.trim() || 'Untitled';
    e.target.value = g.name;
    save();
  });
  groupsEl.addEventListener('keydown', (e) => {
    if (e.target.dataset.action === 'rename' && e.key === 'Enter') e.target.blur();
  });

  // ---------------------------------------------------------------- drag + long press
  let press = null;
  let drag = null;
  let lastMove = 0;

  groupsEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const tile = e.target.closest('.tile[data-id]');
    if (!tile) return;
    press = { tile, x: e.clientX, y: e.clientY, timer: null };
    if (!editing) {
      // Press and hold a shortcut to start editing, like a phone home screen.
      press.timer = setTimeout(() => {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 800);
        press = null;
        setEditing(true);
      }, 550);
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (press && !drag && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
      clearTimeout(press.timer);
      if (editing) startDrag(e); else press = null;
    }
    if (drag) { e.preventDefault(); moveDrag(e); }
  });
  const release = () => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (drag) endDrag();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  groupsEl.addEventListener('dragstart', (e) => e.preventDefault());

  function startDrag(e) {
    const tile = press.tile;
    const r = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.removeAttribute('data-id');
    Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    ghost.style.setProperty('--c', tile.closest('.group').style.getPropertyValue('--c'));
    document.body.append(ghost);
    tile.classList.add('placeholder');
    drag = { tile, ghost, ox: press.x - r.left, oy: press.y - r.top, x0: r.left, y0: r.top };
    press = null;
    document.body.style.cursor = 'grabbing';
    moveDrag(e);
  }

  function moveDrag(e) {
    const d = drag;
    d.ghost.style.transform = `translate(${e.clientX - d.ox - d.x0}px, ${e.clientY - d.oy - d.y0}px)`;
    const now = performance.now();
    if (now - lastMove < 90) return;
    lastMove = now;

    const under = document.elementFromPoint(e.clientX, e.clientY);
    const grid = under && under.closest('.tiles');
    $$('.tiles.drop-target').forEach((g) => { if (g !== grid) g.classList.remove('drop-target'); });
    if (!grid) return;
    grid.classList.add('drop-target');

    let ref = grid.querySelector('.add-tile');
    let best = null, bestD = Infinity;
    for (const o of grid.querySelectorAll(':scope > .tile[data-id]:not(.placeholder)')) {
      const r = o.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist < bestD) { bestD = dist; best = { o, cx }; }
    }
    if (best) ref = e.clientX < best.cx ? best.o : best.o.nextElementSibling;
    const same = d.tile.parentElement === grid;
    if (ref === d.tile || (same && ref === d.tile.nextElementSibling)) return;
    flip(() => grid.insertBefore(d.tile, ref));
    d.ghost.style.setProperty('--c', grid.closest('.group').style.getPropertyValue('--c'));
  }

  function endDrag() {
    const { tile, ghost } = drag;
    drag = null;
    document.body.style.cursor = '';
    $$('.tiles.drop-target').forEach((g) => g.classList.remove('drop-target'));
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 60);

    const r = tile.getBoundingClientRect();
    const x0 = parseFloat(ghost.style.left), y0 = parseFloat(ghost.style.top);
    const anim = ghost.animate(
      [{ transform: ghost.style.transform }, { transform: `translate(${r.left - x0}px, ${r.top - y0}px)` }],
      { duration: reduceMotion ? 1 : 240, easing: EASE, fill: 'forwards' }
    );
    anim.onfinish = () => { ghost.remove(); tile.classList.remove('placeholder'); };

    // Write the new order back from the DOM.
    const byId = new Map();
    state.groups.forEach((g) => g.tiles.forEach((t) => byId.set(t.id, t)));
    for (const sec of $$('.group')) {
      const g = state.groups.find((x) => x.id === sec.dataset.id);
      if (g) g.tiles = $$('.tiles > .tile[data-id]', sec).map((el) => byId.get(el.dataset.id)).filter(Boolean);
    }
    // Refresh the "Delete group" buttons, which depend on tile counts.
    for (const sec of $$('.group')) {
      const g = state.groups.find((x) => x.id === sec.dataset.id);
      const del = sec.querySelector('[data-action="delete-group"]');
      if (g && del) { del.disabled = g.tiles.length > 0; del.title = del.disabled ? 'Move or delete its shortcuts first' : ''; }
    }
    save();
  }

  // ---------------------------------------------------------------- shortcut editor
  const editor = $('#editor');
  const ef = $('#editorForm');
  let ed = null; // { tileId, image }

  function openEditor(tileId, groupId) {
    const found = tileId ? findTile(tileId) : null;
    const tile = found ? found.tile : { name: '', url: '', icon: { type: 'auto' } };
    const gid = found ? found.group.id : groupId;
    ed = { tileId, image: tile.icon.type === 'image' ? tile.icon.value : null, site: tile.icon.site || '' };

    $('#editorTitle').textContent = tileId ? 'Edit shortcut' : 'Add shortcut';
    ef.elements['name'].value = tile.name;
    ef.elements['url'].value = tile.url;
    const sel = ef.elements['group'];
    sel.textContent = '';
    for (const g of state.groups) {
      const o = h('option', null, g.name);
      o.value = g.id;
      sel.append(o);
    }
    sel.value = gid;
    for (const r of ef.elements['iconType']) r.checked = r.value === (tile.icon.type || 'auto');
    ef.elements['emoji'].value = tile.icon.type === 'emoji' ? tile.icon.value || '' : '';
    ef.elements['image'].value = '';
    ef.elements['logoSite'].value = ed.site || (/^https?:/i.test(tile.url) ? hostOf(tile.url).split(':')[0] : '');
    $('#deleteTile').hidden = !tileId;
    syncIconFields();
    editor.returnValue = '';
    editor.showModal();
    (tileId ? ef.elements['name'] : ef.elements['url']).focus();
  }

  function formTile() {
    const type = ef.elements['iconType'].value || 'auto';
    const value = type === 'emoji' ? ef.elements['emoji'].value.trim() : type === 'image' ? ed.image : undefined;
    let name = ef.elements['name'].value.trim();
    const url = normalizeUrl(ef.elements['url'].value);
    const icon = value ? { type, value } : { type: type === 'emoji' || type === 'image' ? 'letter' : type };
    if (value && type === 'image' && ed.site) icon.site = ed.site;
    return { name, url, icon };
  }

  function syncIconFields() {
    const type = ef.elements['iconType'].value;
    $('.emoji-field', ef).hidden = type !== 'emoji';
    $('.image-field', ef).hidden = type !== 'image';
    const t = formTile();
    if (!t.name && t.url) t.name = hostOf(t.url);
    const prev = iconEl(t, 'tile-icon big');
    prev.id = 'iconPreview';
    const g = state.groups.find((x) => x.id === ef.elements['group'].value);
    prev.style.setProperty('--c', `var(--${g ? g.color : 'blue'})`);
    $('#iconPreview').replaceWith(prev);
  }
  ef.addEventListener('input', (e) => { if (e.target.type !== 'file') syncIconFields(); });
  ef.addEventListener('change', (e) => { if (e.target.type !== 'file') syncIconFields(); });
  // Fill in a name from the address if the name is still empty.
  ef.elements['url'].addEventListener('blur', () => {
    const n = ef.elements['name'];
    if (!n.value.trim() && ef.elements['url'].value.trim()) {
      const host = hostOf(normalizeUrl(ef.elements['url'].value)).split(':')[0];
      const base = host.split('.').slice(-2, -1)[0] || host;
      n.value = base.charAt(0).toUpperCase() + base.slice(1);
      syncIconFields();
    }
  });
  ef.elements['image'].addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      ed.image = await shrinkImage(file, 128);
      ed.site = '';
      syncIconFields();
    } catch { toast('That image could not be read. Try a PNG or JPG.'); }
  });

  // ---- Get a logo from a website: reads the site's own icon links and web
  // app manifest, takes the biggest one, and falls back to Google's icon service.
  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }
  function iconFromImage(im, size = 128) {
    const w = im.naturalWidth || size, ht = im.naturalHeight || size;
    const draw = (pad) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      const box = size - pad * 2, sc = Math.min(box / w, box / ht);
      x.drawImage(im, (size - w * sc) / 2, (size - ht * sc) / 2, w * sc, ht * sc);
      return c;
    };
    // Square icons with a solid background (like app icons) fill the tile;
    // transparent logos get a little breathing room.
    const full = draw(0);
    const corner = full.getContext('2d').getImageData(3, 3, 1, 1).data[3];
    return (corner > 240 && Math.abs(w - ht) < 2 ? full : draw(size * 0.12)).toDataURL('image/png');
  }
  async function findLogo(site) {
    const base = normalizeUrl(site);
    const origin = new URL(base).origin;
    const signal = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
    const sizeOf = (str) => Math.max(0, ...String(str || '').toLowerCase().split(/\s+/).map((v) => (v === 'any' ? 512 : parseInt(v, 10) || 0)));
    const cands = [];
    const add = (href, size, from) => { try { cands.push({ url: new URL(href, from).href, size }); } catch { /* bad url */ } };

    try {
      const r = await fetch(base, { signal: signal(6000), credentials: 'omit' });
      if (r.ok) {
        const pageUrl = r.url || base;
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        for (const l of doc.querySelectorAll('link[rel][href]')) {
          const rel = l.getAttribute('rel').toLowerCase();
          if (!rel.includes('icon') || rel.includes('mask')) continue;
          const href = l.getAttribute('href');
          const size = sizeOf(l.getAttribute('sizes')) || (rel.includes('apple') ? 180 : /\.svg(\?|$)/i.test(href) ? 256 : 32);
          add(href, size, pageUrl);
        }
        const man = doc.querySelector('link[rel="manifest"][href]');
        if (man) {
          try {
            const mu = new URL(man.getAttribute('href'), pageUrl).href;
            const mj = await (await fetch(mu, { signal: signal(5000), credentials: 'omit' })).json();
            for (const ic of mj.icons || []) if (ic.src) add(ic.src, sizeOf(ic.sizes) || 192, mu);
          } catch { /* no manifest */ }
        }
      }
    } catch { /* page blocked or offline; try the usual spots */ }
    add('/apple-touch-icon.png', 180, origin);
    add('/favicon.ico', 32, origin);
    cands.sort((a, b) => b.size - a.size);
    cands.push({ url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(base).hostname)}&sz=128`, size: 1 });

    const seen = new Set();
    for (const c of cands) {
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      try {
        const r = await fetch(c.url, { signal: signal(6000), credentials: 'omit' });
        if (!r.ok) continue;
        const blob = await r.blob();
        if (blob.size < 100 || /text|html|json/.test(blob.type)) continue;
        const obj = URL.createObjectURL(blob);
        try {
          const im = await loadImage(obj);
          if (im.naturalWidth && im.naturalWidth < 16) continue;
          return iconFromImage(im);
        } finally {
          URL.revokeObjectURL(obj);
        }
      } catch { /* try the next one */ }
    }
    return null;
  }
  // Reading other websites needs permission. Forge Tab installs without it and
  // asks the first time you fetch a logo, so the install prompt stays quiet.
  const WEB_ORIGINS = { origins: ['http://*/*', 'https://*/*'] };
  function askWebAccess() {
    if (!isExt || !chrome.permissions) return Promise.resolve(true);
    return chrome.permissions.request(WEB_ORIGINS).catch(() => false);
  }
  async function getLogoClick() {
    const input = ef.elements['logoSite'];
    const site = input.value.trim();
    if (!site) { input.focus(); return; }
    if (!(await askWebAccess())) {
      toast('Forge Tab needs permission to read websites to fetch a logo. You can still choose an image file.');
      return;
    }
    const btn = $('#getLogo');
    btn.disabled = true;
    btn.textContent = 'Getting…';
    try {
      const data = await findLogo(site);
      if (data) { ed.image = data; ed.site = site; syncIconFields(); }
      else toast(`No logo found on ${site}. Try the company's main website, or choose an image file.`);
    } catch {
      toast(`No logo found on ${site}. Try the company's main website, or choose an image file.`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Get logo';
    }
  }
  $('#getLogo').addEventListener('click', getLogoClick);
  ef.elements['logoSite'].addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); getLogoClick(); }
  });

  function shrinkImage(file, size) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const im = new Image();
        im.onerror = reject;
        im.onload = () => {
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const x = c.getContext('2d');
          const s = Math.min(im.width, im.height);
          x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
          resolve(c.toDataURL('image/png'));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  editor.addEventListener('close', () => {
    if (editor.returnValue !== 'save') return;
    const t = formTile();
    if (!t.url) return;
    if (!t.name) t.name = hostOf(t.url);
    const gid = ef.elements['group'].value;
    const target = state.groups.find((g) => g.id === gid);
    flip(() => {
      if (ed.tileId) {
        const found = findTile(ed.tileId);
        Object.assign(found.tile, t);
        if (found.group !== target) {
          found.group.tiles = found.group.tiles.filter((x) => x !== found.tile);
          target.tiles.push(found.tile);
        }
      } else {
        target.tiles.push({ id: uid('t'), ...t });
      }
      render();
    });
    save();
    toast(ed.tileId ? 'Saved' : `Added ${t.name}`);
  });

  $('#deleteTile').addEventListener('click', () => {
    const found = findTile(ed.tileId);
    if (!found) return;
    const snap = clone(state);
    editor.close();
    found.group.tiles = found.group.tiles.filter((x) => x !== found.tile);
    save();
    flip(render);
    toast(`Deleted ${found.tile.name}`, () => { state = snap; save(); flip(render); });
  });

  // ---------------------------------------------------------------- launcher
  const q = $('#q');
  const results = $('#results');
  const launcher = $('.launcher');
  let items = [];
  let sel = 0;

  function score(text, query) {
    if (!text) return 0;
    if (text === query) return 120;
    if (text.startsWith(query)) return 100 - Math.min(20, text.length - query.length);
    if (text.includes(' ' + query)) return 70;
    if (text.includes(query)) return 45;
    let i = 0;
    for (const ch of text) if (ch === query[i]) i++;
    return i === query.length ? 15 : 0;
  }

  function updateResults() {
    const v = q.value.trim();
    if (!v) { hideResults(); return; }
    const noteMatch = v.match(/^note[:\s]\s*([\s\S]+)/i);
    if (noteMatch) {
      items = [{ kind: 'note', text: noteMatch[1].trim() }, { kind: 'search', text: v }];
      sel = 0;
      drawResults();
      return;
    }
    const ql = v.toLowerCase();
    // Shortcuts and commands are ranked together, so a strong match on a
    // command beats a loose match on a shortcut's address.
    const scored = [];
    for (const g of state.groups) {
      for (const t of g.tiles) {
        const host = score(hostOf(t.url).toLowerCase(), ql);
        const s = Math.max(score(t.name.toLowerCase(), ql), host > 15 ? host * 0.8 : 0);
        if (s > 0) scored.push({ s, item: { kind: 'tile', tile: t, group: g } });
      }
    }
    for (const k of state.commands) {
      const s = Math.max(score(k.name.toLowerCase(), ql), score(k.cmd.toLowerCase(), ql) * 0.6);
      if (s > 15) scored.push({ s: s - 1, item: { kind: 'command', cmd: k } });
    }
    scored.sort((a, b) => b.s - a.s);
    items = scored.slice(0, 6).map((x) => x.item);
    if (looksLikeUrl(v)) items.push({ kind: 'url', url: normalizeUrl(v) });
    items.push({ kind: 'search', text: v });
    sel = 0;
    drawResults();
  }

  const GLYPH = {
    url: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    command: '<svg viewBox="0 0 24 24"><path d="M5 7l5 5-5 5M12 17h7"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/></svg>'
  };

  function drawResults() {
    results.textContent = '';
    items.forEach((it, i) => {
      const li = h('li', 'result');
      li.id = 'r' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === sel));
      if (it.kind === 'tile') {
        const ic = iconEl(it.tile);
        ic.style.setProperty('--c', `var(--${it.group.color})`);
        li.append(ic, h('span', 'r-name', it.tile.name), h('span', 'r-sub', it.group.name));
      } else if (it.kind === 'note') {
        const gl = h('span', 'r-glyph note');
        gl.innerHTML = GLYPH.note;
        li.append(gl, h('span', 'r-name', 'Save as a note'), h('span', 'r-sub', it.text.length > 48 ? it.text.slice(0, 48) + '…' : it.text));
      } else if (it.kind === 'command') {
        const gl = h('span', 'r-glyph');
        gl.innerHTML = GLYPH.command;
        li.append(gl, h('span', 'r-name', it.cmd.name), h('span', 'r-sub', 'Copy command, ' + WHERE[it.cmd.where].short));
      } else {
        const gl = h('span', 'r-glyph');
        gl.innerHTML = GLYPH[it.kind];
        const label = it.kind === 'url' ? `Go to ${hostOf(it.url)}` : `Search the web for “${it.text}”`;
        li.append(gl, h('span', null, label));
      }
      li.addEventListener('pointermove', () => { if (sel !== i) { sel = i; markSel(); } });
      li.addEventListener('pointerdown', (e) => e.preventDefault());
      li.addEventListener('click', (e) => activate(i, e.ctrlKey || e.metaKey || e.button === 1));
      results.append(li);
    });
    results.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    q.setAttribute('aria-activedescendant', 'r' + sel);
  }
  function markSel() {
    $$('.result', results).forEach((li, i) => li.setAttribute('aria-selected', String(i === sel)));
    q.setAttribute('aria-activedescendant', 'r' + sel);
  }
  function hideResults() {
    results.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    q.removeAttribute('aria-activedescendant');
    items = [];
  }
  function go(url, newTab) {
    if (newTab) window.open(url, '_blank');
    else location.href = url;
  }
  function activate(i, newTab) {
    const it = items[i];
    if (!it) return;
    if (it.kind === 'note') {
      q.value = '';
      hideResults();
      q.blur();
      state.notes.unshift({ id: uid('n'), text: it.text, updated: Date.now() });
      save();
      toast('Note saved. Find it under Notes.');
      return;
    }
    if (it.kind === 'command') {
      q.value = '';
      hideResults();
      q.blur();
      if (blanksOf(it.cmd.cmd).length) openCommands(it.cmd.id);
      else finishCopy(null, it.cmd, it.cmd.cmd);
      return;
    }
    if (it.kind === 'tile') newTab = newTab || wantsNewTab(it.tile.url);
    else if (it.kind === 'url') newTab = newTab || wantsNewTab(it.url);
    else newTab = newTab || !!state.openInNewTab;
    if (it.kind === 'tile') go(it.tile.url, newTab);
    else if (it.kind === 'url') go(it.url, newTab);
    else if (isExt && chrome.search && chrome.search.query) {
      chrome.search.query({ text: it.text, disposition: newTab ? 'NEW_TAB' : 'CURRENT_TAB' });
    } else go('https://www.google.com/search?q=' + encodeURIComponent(it.text), newTab);
    if (newTab) { q.value = ''; hideResults(); }
  }

  q.addEventListener('input', updateResults);
  q.addEventListener('focus', () => { if (q.value.trim()) updateResults(); });
  q.addEventListener('blur', () => setTimeout(hideResults, 120));
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); sel = (sel + 1) % items.length; markSel(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; markSel(); }
    else if (e.key === 'Enter' && items.length) { e.preventDefault(); activate(sel, e.ctrlKey || e.metaKey); }
    else if (e.key === 'Escape') { if (q.value) { q.value = ''; hideResults(); } else q.blur(); }
  });

  // Start typing anywhere to jump into the launcher.
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Escape' && editing) { setEditing(false); return; }
    if (e.key === '/') { e.preventDefault(); q.focus(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') q.focus();
  });

  // ---------------------------------------------------------------- clock
  const clockEl = $('#clock');
  const dateEl = $('#date');
  let lastClock = '';
  function tick() {
    const d = new Date();
    let hr = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12 || 12;
    const key = `${hr}:${mm}${ampm}`;
    if (key === lastClock) return;
    lastClock = key;
    clockEl.textContent = `${hr}:${mm}`;
    clockEl.append(h('span', 'ampm', ampm));
    clockEl.dateTime = d.toISOString();
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);

  // ---------------------------------------------------------------- status checks
  const checksEl = $('#checks');
  const checkResults = new Map();

  async function runCheck(c) {
    if (!c.url) return { state: 'unset', detail: 'add address' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const t0 = performance.now();
    try {
      if (c.kind === 'ollama') {
        const base = c.url.replace(/\/+$/, '');
        const r = await fetch(base + '/api/tags', { signal: ctrl.signal, cache: 'no-store' });
        if (r.status === 403) return { state: 'up', detail: 'up, origin blocked', title: 'Ollama answered but refused this page. Set OLLAMA_ORIGINS=chrome-extension://* on the server to see models.' };
        if (!r.ok) return { state: 'down', detail: 'error ' + r.status };
        const j = await r.json();
        const models = (j.models || []).map((m) => m.name);
        let running = 0;
        try {
          const p = await fetch(base + '/api/ps', { signal: ctrl.signal, cache: 'no-store' });
          if (p.ok) running = ((await p.json()).models || []).length;
        } catch { /* older Ollama */ }
        const n = models.length;
        return {
          state: 'up',
          detail: `${n} model${n === 1 ? '' : 's'}` + (running ? `, ${running} running` : ''),
          title: models.length ? models.join('\n') : 'No models pulled yet'
        };
      }
      await fetch(c.url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
      return { state: 'up', detail: Math.round(performance.now() - t0) + ' ms' };
    } catch (err) {
      return { state: 'down', detail: err.name === 'AbortError' ? 'timed out' : 'unreachable' };
    } finally {
      clearTimeout(timer);
    }
  }

  function renderChecks() {
    checksEl.textContent = '';
    for (const c of state.checks) {
      const res = checkResults.get(c.id) || { state: 'checking', detail: 'checking' };
      const li = h('li');
      let chip;
      if (c.kind === 'web' && c.url && res.state !== 'unset') {
        chip = h('a', 'check');
        chip.href = c.url;
        linkTarget(chip, c.url);
      } else {
        chip = h('button', 'check');
        chip.type = 'button';
        chip.dataset.id = c.id;
      }
      chip.dataset.state = res.state;
      chip.title = res.title || (c.url || 'Set an address in Settings');
      chip.append(h('span', 'dot'), h('span', 'name', c.name || hostOf(c.url)), h('span', 'detail', res.detail));
      li.append(chip);
      checksEl.append(li);
    }
  }
  checksEl.addEventListener('click', (e) => {
    const b = e.target.closest('button.check');
    if (!b) return;
    const c = state.checks.find((x) => x.id === b.dataset.id);
    if (!c || !c.url) openSettings();
    else runAll();
  });

  async function runAll() {
    await Promise.all(state.checks.map(async (c) => {
      checkResults.set(c.id, await runCheck(c));
      renderChecks();
    }));
  }
  setInterval(() => { if (document.visibilityState === 'visible') runAll(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runAll(); });

  // ---------------------------------------------------------------- settings
  const settings = $('#settings');
  const rowsEl = $('#checkRows');
  let draft = [];

  function openSettings() {
    draft = clone(state.checks);
    $('#newTabToggle').checked = !!state.openInNewTab;
    drawCheckRows();
    settings.returnValue = '';
    settings.showModal();
  }
  $('#settingsBtn').addEventListener('click', openSettings);
  // Switches take effect right away, like any on/off switch.
  $('#newTabToggle').addEventListener('change', (e) => {
    state.openInNewTab = e.target.checked;
    save();
    render();
    renderChecks();
  });

  function drawCheckRows() {
    rowsEl.textContent = '';
    draft.forEach((c, i) => {
      const row = h('div', 'check-row');
      const name = h('input');
      name.value = c.name; name.placeholder = 'Name'; name.setAttribute('aria-label', 'Check name');
      name.addEventListener('input', () => { c.name = name.value; });
      const url = h('input');
      url.value = c.url; url.placeholder = 'example.com or http://192.168.1.10:3000'; url.setAttribute('aria-label', 'Address to check');
      url.addEventListener('input', () => { c.url = url.value; });
      const kind = h('select');
      kind.setAttribute('aria-label', 'Check type');
      for (const [v, l] of [['web', 'Website'], ['ollama', 'Ollama']]) {
        const o = h('option', null, l); o.value = v; kind.append(o);
      }
      kind.value = c.kind;
      kind.addEventListener('change', () => { c.kind = kind.value; });
      const rm = h('button', 'remove', '×');
      rm.type = 'button';
      rm.setAttribute('aria-label', `Remove ${c.name || 'check'}`);
      rm.addEventListener('click', () => { draft.splice(i, 1); drawCheckRows(); });
      row.append(name, url, kind, rm);
      rowsEl.append(row);
    });
  }
  $('#addCheck').addEventListener('click', () => {
    draft.push({ id: uid('c'), name: '', url: '', kind: 'web' });
    drawCheckRows();
    const inputs = $$('.check-row input', rowsEl);
    inputs[inputs.length - 2].focus();
  });

  // An Ollama check reads the server's model list, which needs website access.
  // Ask while the Save click still counts as the user's own action.
  $('#saveSettings').addEventListener('click', () => {
    if (draft.some((c) => c.kind === 'ollama' && c.url.trim())) askWebAccess().then((ok) => { if (ok) runAll(); });
  });
  settings.addEventListener('close', () => {
    if (settings.returnValue !== 'save') return;
    state.checks = draft
      .filter((c) => c.name.trim() || c.url.trim())
      .map((c) => ({ ...c, name: c.name.trim(), url: normalizeUrl(c.url) }));
    save();
    checkResults.clear();
    renderChecks();
    runAll();
    toast('Settings saved');
  });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = h('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'forge-tab-layout.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = sanitize(JSON.parse(await file.text()));
      if (!data) throw new Error('no groups');
      const snap = clone(state);
      state = data;
      save();
      settings.close();
      flip(render);
      checkResults.clear();
      renderChecks();
      runAll();
      toast('Layout imported', () => { state = snap; save(); flip(render); renderChecks(); runAll(); });
    } catch {
      toast('That file is not a Forge Tab layout. Choose a file made with Export layout.');
    }
  });
  $('#resetBtn').addEventListener('click', () => {
    const snap = clone(state);
    const fresh = clone(window.FORGE_DEFAULTS);
    fresh.notes = snap.notes; fresh.commands = snap.commands; fresh.fills = snap.fills; fresh.openInNewTab = snap.openInNewTab;
    state = sanitize(fresh);
    save();
    settings.close();
    flip(render);
    checkResults.clear();
    renderChecks();
    runAll();
    toast('Starting layout restored', () => { state = snap; save(); flip(render); renderChecks(); runAll(); });
  });

  // ---------------------------------------------------------------- commands
  // Saved terminal commands: click to copy. Words in single braces, like
  // {container}, are blanks you fill in before copying.
  const cmdDialog = $('#commands');
  const cmdGroupsEl = $('#cmdGroups');
  const cmdFilter = $('#cmdFilter');
  const cmdForm = $('#cmdForm');
  const WHERE = {
    server: { title: 'Linux or Mac terminal', short: 'run in a Linux or Mac terminal', paste: 'Paste it into your Linux or Mac terminal.' },
    windows: { title: 'In Windows PowerShell', short: 'run in PowerShell', paste: 'Paste it into Windows PowerShell.' },
    any: { title: 'Anywhere', short: 'run anywhere', paste: 'Paste it into a terminal.' }
  };
  const BLANK = /(?<![{\w])\{([A-Za-z][\w-]*)\}(?!\})/g;
  const blanksOf = (cmd) => [...new Set([...cmd.matchAll(BLANK)].map((m) => m[1]))];
  let editingCmd = null;

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = h('textarea');
      ta.value = text;
      Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
      (document.querySelector('dialog[open]') || document.body).append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  function showCmdView(v) {
    $('#cmdList').hidden = v !== 'list';
    cmdForm.hidden = v !== 'form';
  }

  function openCommands(focusId) {
    showCmdView('list');
    cmdFilter.value = '';
    drawCommands();
    if (!cmdDialog.open) cmdDialog.showModal();
    const row = focusId && cmdGroupsEl.querySelector(`.cmd[data-id="${focusId}"]`);
    if (row) {
      row.scrollIntoView({ block: 'center' });
      startCopy(row, focusId);
    } else {
      cmdFilter.focus();
    }
  }
  $('#commandsBtn').addEventListener('click', () => openCommands());
  $('#closeCmds').addEventListener('click', () => cmdDialog.close());
  cmdDialog.addEventListener('click', (e) => {
    if (e.target !== cmdDialog) return;
    const r = cmdDialog.getBoundingClientRect();
    if (e.clientX < r.left) cmdDialog.close();
  });
  cmdDialog.addEventListener('cancel', (e) => {
    // Esc in the add/edit form goes back to the list instead of closing.
    if (!cmdForm.hidden) { e.preventDefault(); showCmdView('list'); }
  });

  function codeEl(cmd) {
    const c = h('code', 'cmd-code');
    let last = 0;
    for (const m of cmd.matchAll(BLANK)) {
      c.append(cmd.slice(last, m.index), h('span', 'blank', m[0]));
      last = m.index + m[0].length;
    }
    c.append(cmd.slice(last));
    return c;
  }

  function drawCommands() {
    cmdGroupsEl.textContent = '';
    const f = cmdFilter.value.trim().toLowerCase();
    const list = state.commands.filter((k) => !f || k.name.toLowerCase().includes(f) || k.cmd.toLowerCase().includes(f));
    if (!list.length) {
      cmdGroupsEl.append(h('p', 'cmd-empty', f
        ? 'No commands match. Clear the search, or add it as a new command.'
        : 'No saved commands yet. Add the ones you use often.'));
      return;
    }
    for (const where of ['windows', 'server', 'any']) {
      const items = list.filter((k) => k.where === where);
      if (!items.length) continue;
      const sec = h('section', 'cmd-group');
      sec.dataset.where = where;
      sec.append(h('h3', null, WHERE[where].title));
      for (const k of items) sec.append(cmdRow(k));
      cmdGroupsEl.append(sec);
    }
  }

  function cmdRow(k) {
    const row = h('div', 'cmd');
    row.dataset.id = k.id;
    const b = h('button', 'cmd-copy');
    b.type = 'button';
    b.title = k.cmd;
    b.append(h('span', 'cmd-name', k.name), codeEl(k.cmd));
    const ed = h('button', 'cmd-edit', 'Edit');
    ed.type = 'button';
    ed.setAttribute('aria-label', `Edit ${k.name}`);
    row.append(b, ed, h('span', 'cmd-done', 'Copied'));
    return row;
  }

  cmdGroupsEl.addEventListener('click', (e) => {
    const row = e.target.closest('.cmd');
    if (!row) return;
    if (e.target.closest('.cmd-edit')) { openCmdForm(row.dataset.id); return; }
    if (e.target.closest('.cmd-copy')) startCopy(row, row.dataset.id);
  });
  cmdFilter.addEventListener('input', drawCommands);
  cmdFilter.addEventListener('keydown', (e) => {
    // Enter copies the first match.
    if (e.key !== 'Enter') return;
    const row = cmdGroupsEl.querySelector('.cmd');
    if (row) { e.preventDefault(); startCopy(row, row.dataset.id); }
  });

  function startCopy(row, id) {
    const k = state.commands.find((x) => x.id === id);
    if (!k) return;
    const blanks = blanksOf(k.cmd);
    if (!blanks.length) { finishCopy(row, k, k.cmd); return; }

    let fill = row.querySelector('.cmd-fill');
    if (fill) { fill.querySelector('input').focus(); return; }
    $$('.cmd-fill', cmdGroupsEl).forEach((x) => x.remove());

    fill = h('form', 'cmd-fill');
    for (const name of blanks) {
      const lab = h('label', null, name.charAt(0).toUpperCase() + name.slice(1));
      const inp = h('input');
      inp.name = name;
      inp.required = true;
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.value = state.fills[name] || '';
      lab.append(inp);
      fill.append(lab);
    }
    const act = h('div', 'fill-actions');
    const goBtn = h('button', 'primary', 'Copy command');
    goBtn.type = 'submit';
    act.append(goBtn);
    fill.append(act);
    fill.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let text = k.cmd;
      for (const name of blanks) {
        const v = fill.querySelector(`input[name="${name}"]`).value.trim();
        state.fills[name] = v;
        text = text.replace(new RegExp(`(?<![{\\w])\\{${name}\\}(?!\\})`, 'g'), () => v);
      }
      save();
      fill.remove();
      finishCopy(row, k, text);
    });
    row.append(fill);
    const first = fill.querySelector('input');
    first.focus();
    first.select();
  }

  async function finishCopy(row, k, text) {
    const ok = await copyText(text);
    if (!ok) { toast('Copying was blocked. Select the command and press Ctrl+C.'); return; }
    if (row) {
      row.classList.add('copied');
      clearTimeout(row._copiedTimer);
      row._copiedTimer = setTimeout(() => row.classList.remove('copied'), 1800);
    }
    toast('Copied. ' + WHERE[k.where].paste);
  }

  function openCmdForm(id) {
    const k = id ? state.commands.find((x) => x.id === id) : null;
    editingCmd = k ? k.id : null;
    $('#cmdFormTitle').textContent = k ? 'Edit command' : 'Add command';
    cmdForm.elements['name'].value = k ? k.name : '';
    cmdForm.elements['cmd'].value = k ? k.cmd : '';
    cmdForm.elements['where'].value = k ? k.where : 'any';
    $('#deleteCmd').hidden = !k;
    showCmdView('form');
    cmdForm.elements['name'].focus();
  }
  $('#addCmd').addEventListener('click', () => openCmdForm(null));
  $('#cancelCmd').addEventListener('click', () => showCmdView('list'));
  cmdForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: cmdForm.elements['name'].value.trim(),
      cmd: cmdForm.elements['cmd'].value.trim(),
      where: cmdForm.elements['where'].value
    };
    if (!data.name || !data.cmd) return;
    if (editingCmd) Object.assign(state.commands.find((x) => x.id === editingCmd), data);
    else state.commands.push({ id: uid('k'), ...data });
    save();
    showCmdView('list');
    drawCommands();
    toast(editingCmd ? 'Command saved' : `Added ${data.name}`);
  });
  $('#deleteCmd').addEventListener('click', () => {
    const k = state.commands.find((x) => x.id === editingCmd);
    if (!k) return;
    const snap = clone(state);
    state.commands = state.commands.filter((x) => x !== k);
    save();
    showCmdView('list');
    drawCommands();
    toast(`Deleted ${k.name}`, () => { state = snap; save(); drawCommands(); });
  });

  // ---------------------------------------------------------------- notes
  // A quick notepad. Notes save as you type and are included in Export layout.
  const notesDialog = $('#notes');
  const noteItemsEl = $('#noteItems');
  const noteFilter = $('#noteFilter');
  const noteText = $('#noteText');
  const noteSavedEl = $('#noteSaved');
  let openNoteId = null;
  let noteTimer = null;

  const noteTitle = (t) => (t.split('\n').find((l) => l.trim()) || 'Empty note').trim();
  const notePreview = (t) => {
    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.slice(1).join('  ') || '';
  };
  function whenText(ms) {
    const d = new Date(ms), now = new Date();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function showNoteView(v) {
    $('#noteList').hidden = v !== 'list';
    $('#noteEdit').hidden = v !== 'edit';
  }
  function openNotes() {
    openNoteId = null;
    noteFilter.value = '';
    showNoteView('list');
    drawNotes();
    if (!notesDialog.open) notesDialog.showModal();
    $('#newNote').focus();
  }
  $('#notesBtn').addEventListener('click', openNotes);
  $('#closeNotes').addEventListener('click', () => notesDialog.close());
  notesDialog.addEventListener('click', (e) => {
    if (e.target !== notesDialog) return;
    if (e.clientX < notesDialog.getBoundingClientRect().left) notesDialog.close();
  });
  notesDialog.addEventListener('cancel', (e) => {
    // Esc while writing goes back to the list instead of closing.
    if (openNoteId) { e.preventDefault(); leaveNote(); }
  });
  notesDialog.addEventListener('close', () => { if (openNoteId) leaveNote(true); });

  // Colours are the same five the shortcut groups use, named after those groups.
  function colorLabel(c) {
    const names = state.groups.filter((g) => g.color === c).map((g) => g.name);
    return names.length ? names.join(', ') : c.charAt(0).toUpperCase() + c.slice(1);
  }
  let noteColorFilter = null;

  function drawNoteChips() {
    const chips = $('#noteChips');
    chips.textContent = '';
    const used = COLORS.filter((c) => state.notes.some((n) => n.color === c && n.text.trim()));
    if (noteColorFilter && !used.includes(noteColorFilter)) noteColorFilter = null;
    chips.hidden = !used.length;
    if (!used.length) return;
    const mk = (c, label) => {
      const b = h('button', 'chip');
      b.type = 'button';
      b.dataset.color = c || '';
      b.setAttribute('aria-pressed', String(noteColorFilter === c));
      if (c) { const d = h('span', 'cdot'); d.style.setProperty('--c', `var(--${c})`); b.append(d); }
      b.append(label);
      chips.append(b);
    };
    mk(null, 'All');
    for (const c of used) mk(c, colorLabel(c));
  }
  $('#noteChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const c = b.dataset.color || null;
    noteColorFilter = noteColorFilter === c ? null : c;
    drawNotes();
  });

  function noteItem(n) {
    const b = h('button', 'note-item');
    b.type = 'button';
    b.dataset.id = n.id;
    if (n.color) { b.classList.add('tagged'); b.style.setProperty('--c', `var(--${n.color})`); }
    const head = h('span', 'note-head');
    head.append(h('span', 'note-title', noteTitle(n.text)), h('span', 'note-when', whenText(n.updated)));
    b.append(head);
    const pv = notePreview(n.text);
    if (pv) b.append(h('span', 'note-preview', pv));
    return b;
  }

  function drawNotes() {
    drawNoteChips();
    noteItemsEl.textContent = '';
    const f = noteFilter.value.trim().toLowerCase();
    const list = state.notes
      .filter((n) => n.text.trim() && (!f || n.text.toLowerCase().includes(f)) && (!noteColorFilter || n.color === noteColorFilter))
      .sort((a, b) => b.updated - a.updated);
    if (!list.length) {
      noteItemsEl.append(h('p', 'note-empty', f || noteColorFilter
        ? 'No notes match that.'
        : 'No notes yet. Click New note, or type "note" and your text in the search bar.'));
      return;
    }
    const pinned = list.filter((n) => n.pinned);
    const rest = list.filter((n) => !n.pinned);
    if (pinned.length) {
      noteItemsEl.append(h('h3', 'note-section', 'Pinned'));
      pinned.forEach((n) => noteItemsEl.append(noteItem(n)));
      if (rest.length) noteItemsEl.append(h('h3', 'note-section', 'Everything else'));
    }
    rest.forEach((n) => noteItemsEl.append(noteItem(n)));
  }

  function drawNoteTools(n) {
    const pin = $('#pinNote');
    pin.setAttribute('aria-pressed', String(!!n.pinned));
    pin.textContent = n.pinned ? 'Pinned' : 'Pin to top';
    const box = $('#noteColors');
    box.textContent = '';
    for (const c of [null, ...COLORS]) {
      const b = h('button', 'dot-btn');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.color = c || '';
      b.setAttribute('aria-checked', String((n.color || null) === c));
      const label = c ? colorLabel(c) : 'No color';
      b.setAttribute('aria-label', label);
      b.title = label;
      if (c) b.style.setProperty('--c', `var(--${c})`); else b.classList.add('none');
      box.append(b);
    }
  }
  $('#pinNote').addEventListener('click', () => {
    const n = state.notes.find((x) => x.id === openNoteId);
    if (!n) return;
    n.pinned = !n.pinned;
    save();
    drawNoteTools(n);
  });
  $('#noteColors').addEventListener('click', (e) => {
    const b = e.target.closest('.dot-btn');
    const n = state.notes.find((x) => x.id === openNoteId);
    if (!b || !n) return;
    n.color = b.dataset.color || null;
    save();
    drawNoteTools(n);
  });
  noteFilter.addEventListener('input', drawNotes);
  noteItemsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.note-item');
    if (b) openNote(b.dataset.id);
  });

  function openNote(id) {
    const n = state.notes.find((x) => x.id === id);
    if (!n) return;
    openNoteId = id;
    noteText.value = n.text;
    noteSavedEl.textContent = 'Edited ' + whenText(n.updated);
    drawNoteTools(n);
    showNoteView('edit');
    noteText.focus();
    noteText.setSelectionRange(noteText.value.length, noteText.value.length);
  }
  $('#newNote').addEventListener('click', () => {
    // A new note starts in the colour you're currently filtering by.
    const n = { id: uid('n'), text: '', updated: Date.now(), pinned: false, color: noteColorFilter };
    state.notes.unshift(n);
    openNote(n.id);
    noteSavedEl.textContent = '';
  });

  function flushNote() {
    clearTimeout(noteTimer);
    noteTimer = null;
    const n = openNoteId && state.notes.find((x) => x.id === openNoteId);
    if (!n || n.text === noteText.value) return;
    n.text = noteText.value;
    n.updated = Date.now();
    save();
    noteSavedEl.textContent = 'Saved';
  }
  noteText.addEventListener('input', () => {
    noteSavedEl.textContent = '';
    clearTimeout(noteTimer);
    noteTimer = setTimeout(flushNote, 400);
  });
  noteText.addEventListener('blur', flushNote);
  window.addEventListener('pagehide', flushNote);

  function leaveNote(closing) {
    flushNote();
    const n = state.notes.find((x) => x.id === openNoteId);
    openNoteId = null;
    // An empty note isn't worth keeping.
    if (n && !n.text.trim()) { state.notes = state.notes.filter((x) => x !== n); save(); }
    if (!closing) { showNoteView('list'); drawNotes(); $('#newNote').focus(); }
  }
  $('#noteBack').addEventListener('click', () => leaveNote());
  $('#copyNote').addEventListener('click', async () => {
    const ok = await copyText(noteText.value);
    toast(ok ? 'Note copied' : 'Copying was blocked. Select the text and press Ctrl+C.');
  });
  $('#deleteNote').addEventListener('click', () => {
    clearTimeout(noteTimer);
    const n = state.notes.find((x) => x.id === openNoteId);
    if (!n) return;
    n.text = noteText.value;
    const snap = clone(state);
    state.notes = state.notes.filter((x) => x !== n);
    openNoteId = null;
    save();
    showNoteView('list');
    drawNotes();
    if (n.text.trim()) toast('Note deleted', () => { state = snap; save(); drawNotes(); });
  });

  // ---------------------------------------------------------------- other open tabs
  // With shortcuts opening in new tabs, several dashboards can be open at once.
  // When one saves, the others take its copy.
  if (isExt && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY] || !changes[KEY].newValue) return;
      const nv = changes[KEY].newValue;
      if (nv._writer === TAB_ID || drag) return;
      const incoming = sanitize(clone(nv));
      if (!incoming) return;
      // Keep the note being written here exactly as it is.
      const typing = openNoteId && state.notes.find((x) => x.id === openNoteId);
      if (typing) {
        typing.text = noteText.value;
        const i = incoming.notes.findIndex((x) => x.id === typing.id);
        if (i >= 0) incoming.notes[i] = typing; else incoming.notes.unshift(typing);
      }
      state = incoming;
      const ae = document.activeElement;
      if (!editor.open && !(ae && ae.closest && ae.closest('.group-head'))) render();
      renderChecks();
      if (cmdDialog.open && cmdForm.hidden) drawCommands();
      if (notesDialog.open && !openNoteId) drawNotes();
    });
  }

  // ---------------------------------------------------------------- toast
  const toastEl = $('#toast');
  let toastTimer = null;
  function toast(msg, undo) {
    // Inside an open panel the page behind is covered, so show it there.
    const host = document.querySelector('dialog[open]') || document.body;
    if (toastEl.parentElement !== host) host.append(toastEl);
    toastEl.textContent = msg;
    if (undo) {
      const b = h('button', null, 'Undo');
      b.type = 'button';
      b.addEventListener('click', () => { undo(); toastEl.classList.remove('show'); });
      toastEl.append(b);
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), undo ? 6000 : 2200);
  }

  // ---------------------------------------------------------------- start
  (async () => {
    state = sanitize(await store.load()) || sanitize(clone(window.FORGE_DEFAULTS));
    render();
    renderChecks();
    runAll();
  })();
})();
