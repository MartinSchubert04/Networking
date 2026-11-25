'use strict';

/* ================================================================ utilidades */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\](?:\s|$))/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const CHECK_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LANG_ALIAS = { text: 'plaintext', txt: 'plaintext', sh: 'bash', shell: 'bash', console: 'bash', ps: 'powershell', ps1: 'powershell', toml: 'ini', rs: 'rust', yml: 'yaml', 'c++': 'cpp' };

const state = { tree: null, files: new Map(), current: null, version: 0, polling: null, view: 'home' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seccion';
const pct = (d, t) => (t ? Math.round((d * 100) / t) : 0);

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { return null; }
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function hashFor(path, params) {
  const p = path.split('/').map(encodeURIComponent).join('/');
  const q = params ? new URLSearchParams(params).toString() : '';
  return `#/f/${p}${q ? '?' + q : ''}`;
}

function parseHash() {
  const h = location.hash.slice(1);
  const v = h.match(/^\/videos(?:\/([^?]*))?(?:\?(.*))?$/);
  if (v) return { view: 'videos', list: v[1] ? decodeURIComponent(v[1]) : null, params: new URLSearchParams(v[2] || '') };
  if (!h.startsWith('/f/')) return { view: 'home' };
  const rest = h.slice(3);
  const qi = rest.indexOf('?');
  const raw = qi >= 0 ? rest.slice(0, qi) : rest;
  const params = new URLSearchParams(qi >= 0 ? rest.slice(qi + 1) : '');
  return { view: 'file', path: raw.split('/').map(decodeURIComponent).join('/'), params };
}

function taskLines(text) {
  const out = [];
  let fence = null;
  text.split('\n').forEach((line0, i) => {
    const line = line0.replace(/\r$/, '');
    const f = line.match(FENCE_RE);
    if (f) {
      const mark = f[1][0];
      if (fence === null) fence = mark;
      else if (fence === mark) fence = null;
      return;
    }
    if (fence !== null) return;
    const m = line.match(TASK_RE);
    if (m) out.push({ line: i, checked: /[xX]/.test(m[2]), raw: line });
  });
  return out;
}

function ring(done, total, size = 18, stroke = 2.6, cls = 'mini-ring') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (total ? done / total : 0));
  const complete = total && done === total ? ' complete' : '';
  return `<svg class="${cls}${complete}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, kind === 'win' ? 3200 : 2400);
  setTimeout(() => el.remove(), kind === 'win' ? 3600 : 2800);
}

function confetti(x, y, count = 10, spread = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cs = getComputedStyle(document.documentElement);
  const colors = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--done'), cs.getPropertyValue('--warn'), '#60a5fa', '#f472b6'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'confetti';
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.8);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d - spread * 0.3}px`);
    p.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    document.body.append(p);
    setTimeout(() => p.remove(), 950);
  }
}

/* ================================================================ árbol y sidebar */

async function loadTree() {
  state.tree = await api('/api/tree');
  state.version = state.tree.version;
  state.files.clear();
  for (const g of state.tree.groups) for (const f of g.files) state.files.set(f.path, { ...f, groupKey: g.key });
  renderSidebar();
}

function groupTotals(g) {
  const files = g.files.map((f) => state.files.get(f.path) || f);
  return { done: files.reduce((a, f) => a + (f.done || 0), 0), total: files.reduce((a, f) => a + (f.total || 0), 0), files };
}

function renderSidebar() {
  const collapsed = store('collapsed') || {};
  const cur = state.current && state.current.path;
  const home = state.view === 'home';
  let html = `<a class="nav-home${home ? ' active' : ''}" href="#/">
      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>
      Progreso</a>${navVideos()}`;
  for (const g of state.tree.groups) {
    const { done, total, files } = groupTotals(g);
    const isCol = collapsed[g.key];
    html += `<div class="nav-group${isCol ? ' collapsed' : ''}" data-key="${esc(g.key)}">
      <button class="nav-group-head" type="button">
        <svg class="chev" viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
        ${esc(g.label)}
        ${total ? `<span class="count${done === total ? ' complete' : ''}">${done}/${total}</span>` : ''}
      </button><ul class="nav-files">`;
    for (const f of files) {
      const active = f.path === cur ? ' active' : '';
      const tip = f.kind === 'md' ? f.path : f.path;
      html += `<li><a class="nav-file ${f.kind}${active}" href="${hashFor(f.path)}" title="${esc(tip)}">
        <span class="t">${esc(f.title)}</span>${f.total ? ring(f.done, f.total) : ''}</a></li>`;
    }
    html += '</ul></div>';
  }
  const nav = $('#sidebar');
  nav.innerHTML = html;
  $$('.nav-group-head', nav).forEach((b) => b.addEventListener('click', () => {
    const g = b.parentElement;
    g.classList.toggle('collapsed');
    const c = store('collapsed') || {};
    c[g.dataset.key] = g.classList.contains('collapsed');
    store('collapsed', c);
  }));
  const act = $('.nav-file.active', nav);
  if (act) act.scrollIntoView({ block: 'nearest' });
}

/* ================================================================ inicio */

function renderHome() {
  state.current = null;
  setView('home');
  document.title = 'Networking Lab';
  renderSidebar();
  $('#toc').innerHTML = '';
  window.onscroll = null;
  let done = 0, total = 0, next = null;
  const phases = [];
  for (const g of state.tree.groups) {
    const t = groupTotals(g);
    done += t.done;
    total += t.total;
    const pending = t.files.find((f) => f.next);
    if (!next && pending && g.phase) next = { file: pending, group: g };
    if (g.phase) phases.push({ g, ...t, pending });
  }
  if (!next) {
    for (const g of state.tree.groups) {
      const f = groupTotals(g).files.find((x) => x.next);
      if (f) { next = { file: f, group: g }; break; }
    }
  }
  const p = pct(done, total);
  const size = 132, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  const cards = phases.map(({ g, done: d, total: t, files, pending }) => {
    const readme = files.find((f) => /readme\.md$/i.test(f.path)) || files[0];
    const title = (readme ? readme.title : g.label).replace(/^\d+\s*·\s*/, '');
    const num = g.key === 'codigo' ? 'CÓDIGO' : `FASE ${g.key.split('-')[0]}`;
    const complete = t && d === t;
    const pend = complete
      ? '<div class="pending ok">✓ Completa</div>'
      : pending ? `<div class="pending">Sigue: ${esc(pending.next.text)}</div>` : '<div class="pending">Sin ejercicios todavía</div>';
    return `<a class="card${complete ? ' complete' : ''}" href="${hashFor(readme.path)}">
      <span class="num">${num}</span><h3>${esc(title)}</h3>${pend}
      <div class="bar"><span style="width:${pct(d, t)}%"></span></div>
      <div class="meta"><span>${d}/${t}</span><span>${pct(d, t)}%</span></div></a>`;
  }).join('');

  const quick = [];
  for (const g of state.tree.groups) {
    if (g.phase) continue;
    for (const f of g.files) if (f.kind === 'md') quick.push(f);
  }

  $('#main').innerHTML = `
    <section class="hero">
      <svg class="big-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${p}% completado">
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--done)"/></linearGradient></defs>
        <circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
        <text x="50%" y="50%" text-anchor="middle" dy="4">${p}%</text>
        <text class="sub" x="50%" y="50%" text-anchor="middle" dy="24">${done} de ${total}</text>
      </svg>
      <div class="hero-text">
        <h1>Redes y ciberseguridad, haciendo</h1>
        <p>${done === 0 ? 'Todavía no tildaste nada. El primer paso está acá abajo.' : done === total ? 'Terminaste todo. Hora de inventar más ejercicios.' : `Llevás ${done} ejercicios hechos. Quedan ${total - done}.`}</p>
      </div>
    </section>
    ${next ? `<a class="next-card" href="${hashFor(next.file.path, { line: next.file.next.line })}">
      <div><div class="lbl">Seguir con</div>
      <div class="txt">${esc(next.file.next.text)}</div>
      <div class="ctx">${esc(next.group.label)}${next.file.next.section ? ' · ' + esc(next.file.next.section) : ''}</div></div>
      <span class="go">→</span></a>` : ''}
    ${watchCard()}
    <h2 class="section-title">Fases</h2>
    <div class="cards">${cards}</div>
    <h2 class="section-title">Lectura</h2>
    <div class="quick">${quick.map((f) => `<a class="chip" href="${hashFor(f.path)}">${esc(f.title)}</a>`).join('')}</div>`;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fg = $('.big-ring .fg');
    if (fg) fg.style.strokeDashoffset = fg.dataset.off;
  }));
  window.scrollTo(0, 0);
}

/* ================================================================ archivos */

function resolveLink(fromPath, href) {
  const [p, anchor] = href.split('#');
  if (!p) return { path: fromPath, anchor };
  const base = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  let u;
  try { u = decodeURIComponent(new URL(p, 'http://x/' + base).pathname.slice(1)); } catch (e) { return null; }
  const cands = u.endsWith('/') || u === '' ? [u + 'README.md'] : [u, u + '/README.md'];
  for (const c of cands) if (state.files.has(c)) return { path: c, anchor };
  return null;
}

function enhanceCode(root) {
  $$('pre > code', root).forEach((code) => {
    const pre = code.parentElement;
    if (pre.parentElement.classList.contains('code-block')) return;
    const m = (code.className || '').match(/language-([\w+-]+)/);
    let lang = m ? m[1].toLowerCase() : '';
    lang = LANG_ALIAS[lang] || lang;
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    wrap.append(pre);
    if (window.hljs && lang && hljs.getLanguage(lang)) {
      code.className = `language-${lang}`;
      hljs.highlightElement(code);
    }
    if (m) {
      const l = document.createElement('span');
      l.className = 'code-lang';
      l.textContent = m[1];
      wrap.append(l);
    }
    wrap.append(copyButton(() => code.textContent));
  });
}

function copyButton(getText) {
  const b = document.createElement('button');
  b.className = 'copy-btn';
  b.type = 'button';
  b.textContent = 'Copiar';
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      b.textContent = '✓ Copiado';
      b.classList.add('ok');
    } catch (e) { b.textContent = 'Error'; }
    setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('ok'); }, 1400);
  });
  return b;
}

function docHead(path) {
  const vs = `vscode://file/${state.tree.root}/${path}`;
  return `<div class="doc-head">
    <span class="crumbs">${esc(path)}</span><span class="spacer"></span>
    <a class="btn" href="${esc(vs)}" title="Abrir en VS Code">
      <svg viewBox="0 0 24 24" width="14" height="14"><path d="M17 3 8 11.5 4 8.5 2 9.5v5l2 1 4-3L17 21l5-2.5v-13z" fill="currentColor"/></svg>VS Code</a>
  </div>`;
}

async function openFile(path, params = new URLSearchParams(), { keepScroll = false } = {}) {
  let data;
  try {
    data = await api('/api/file?path=' + encodeURIComponent(path));
  } catch (e) {
    $('#main').innerHTML = `<div class="empty">No encontré <code>${esc(path)}</code>. <a href="#/">Volver al inicio</a></div>`;
    return;
  }
  const scroll = window.scrollY;
  state.current = { path, data, params };
  setView('file');
  const info = state.files.get(path);
  document.title = `${info ? info.title : path} · Networking Lab`;
  renderSidebar();
  if (data.kind === 'md') renderMarkdown(path, data);
  else renderCode(path, data);
  document.body.classList.remove('nav-open');

  if (keepScroll) window.scrollTo(0, scroll);
  else if (params.has('line') && data.kind === 'md' && focusTask(+params.get('line'))) { /* listo */ }
  else if (params.has('line') && data.kind === 'code') focusCodeLine(+params.get('line'));
  else if (params.has('q') && highlightText(params.get('q'))) { /* listo */ }
  else if (params.has('h') && document.getElementById(params.get('h'))) document.getElementById(params.get('h')).scrollIntoView();
  else window.scrollTo(0, 0);
}

function renderMarkdown(path, data) {
  const main = $('#main');
  const content = data.content;
  const tasks = taskLines(content);
  state.current.tasks = tasks;
  state.current.lines = content.split('\n');

  if (!window.marked) {
    main.innerHTML = `${docHead(path)}<div class="warn-box">No cargó la librería de Markdown (¿sin internet?). Muestro el texto plano.</div><pre class="md">${esc(content)}</pre>`;
    return;
  }
  let html = marked.parse(content, { gfm: true });
  if (window.DOMPurify) html = DOMPurify.sanitize(html);
  main.innerHTML = `${docHead(path)}<div id="docProgress"></div><article class="md" id="doc">${html}</article>`;
  const art = $('#doc');

  const used = new Map();
  $$('h1, h2, h3, h4', art).forEach((h) => {
    const s = slug(h.textContent);
    const n = used.get(s) || 0;
    used.set(s, n + 1);
    h.id = n ? `${s}-${n}` : s;
  });

  $$('a[href]', art).forEach((a) => {
    const href = a.getAttribute('href');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else if (href.startsWith('#')) {
      a.setAttribute('href', hashFor(path, { h: href.slice(1) }));
    } else {
      const t = resolveLink(path, href);
      if (t) a.setAttribute('href', hashFor(t.path, t.anchor ? { h: t.anchor } : null));
      else {
        a.setAttribute('href', '#');
        a.addEventListener('click', (e) => { e.preventDefault(); toast(`No encontré ${href} en el repo`, 'err'); });
      }
    }
  });

  enhanceCode(art);

  const inputs = $$('input[type="checkbox"]', art);
  const ok = inputs.length === tasks.length;
  if (!ok && inputs.length) {
    art.insertAdjacentHTML('beforebegin', '<div class="warn-box">No pude ubicar los checkboxes de este archivo con seguridad, así que quedan de solo lectura.</div>');
  }
  inputs.forEach((inp, i) => {
    const li = inp.closest('li');
    if (!li) return;
    li.classList.add('task');
    if (inp.checked) li.classList.add('done');
    if (inp.parentElement === li) {
      const body = document.createElement('span');
      body.className = 'task-body';
      let n = inp.nextSibling;
      while (n && !(n.nodeType === 1 && /^(UL|OL)$/.test(n.nodeName))) {
        const nx = n.nextSibling;
        body.append(n);
        n = nx;
      }
      inp.after(body);
    }
    const cb = document.createElement('span');
    cb.className = 'cb';
    cb.innerHTML = CHECK_SVG;
    cb.setAttribute('role', 'checkbox');
    cb.setAttribute('aria-checked', String(inp.checked));
    li.prepend(cb);
    if (!ok) { li.classList.add('readonly'); return; }
    li.dataset.idx = String(i);
    li.dataset.line = String(tasks[i].line);
    cb.tabIndex = 0;
    cb.addEventListener('click', (e) => toggleTask(li, e));
    cb.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTask(li, e); }
    });
  });

  updateDocProgress();
  buildToc(art);
}

function sectionCounts() {
  const art = $('#doc');
  if (!art) return;
  $$('.sec-count', art).forEach((s) => s.remove());
  const counts = new Map();
  let h2 = null, h3 = null;
  for (const el of $$('h2, h3, li.task', art)) {
    if (el.tagName === 'H2') { h2 = el; h3 = null; continue; }
    if (el.tagName === 'H3') { h3 = el; continue; }
    for (const h of [h2, h3]) {
      if (!h) continue;
      const c = counts.get(h) || { d: 0, t: 0 };
      c.t++;
      if (el.classList.contains('done')) c.d++;
      counts.set(h, c);
    }
  }
  counts.forEach((c, h) => {
    h.insertAdjacentHTML('beforeend', `<span class="sec-count${c.d === c.t ? ' complete' : ''}">${c.d}/${c.t}</span>`);
  });
  return counts;
}

function updateDocProgress() {
  const box = $('#docProgress');
  if (!box) return;
  const all = $$('#doc li.task');
  const d = all.filter((l) => l.classList.contains('done')).length;
  const t = all.length;
  sectionCounts();
  if (!t) { box.innerHTML = ''; return; }
  const complete = d === t;
  box.innerHTML = `<div class="doc-progress${complete ? ' complete' : ''}">
    <div class="bar${complete ? ' complete' : ''}"><span style="width:${pct(d, t)}%"></span></div>
    <span class="lbl">${complete ? '✓ ' : ''}${d}/${t} · ${pct(d, t)}%</span></div>`;
}

async function toggleTask(li, ev) {
  if (li.classList.contains('busy')) return;
  const cur = state.current;
  const i = +li.dataset.idx;
  const t = cur.tasks[i];
  const want = !li.classList.contains('done');
  const h = li.closest('#doc') && findSection(li);
  li.classList.toggle('done', want);
  li.classList.add('busy');
  $('.cb', li).setAttribute('aria-checked', String(want));
  try {
    const res = await api('/api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cur.path, line: t.line, checked: want, original: t.raw }),
    });
    t.raw = res.line;
    t.checked = want;
    cur.lines[t.line] = res.line + (cur.lines[t.line].endsWith('\r') ? '\r' : '');
    cur.data.mtime = res.mtime;
    state.version = res.version;
    const f = state.files.get(cur.path);
    if (f) Object.assign(f, res.file, { mtime: res.mtime });
    updateDocProgress();
    renderSidebar();
    if (want) {
      li.classList.remove('pop');
      void li.offsetWidth;
      li.classList.add('pop');
      const r = $('.cb', li).getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (res.file.total && res.file.done === res.file.total) {
        confetti(x, y, 60, 260);
        toast(`¡Completaste "${res.file.title}"! 🎉`, 'win');
      } else {
        confetti(x, y, 10, 70);
        if (h && sectionDone(h)) toast(`Sección completa: ${headingText(h)}`, 'win');
      }
    }
  } catch (e) {
    li.classList.toggle('done', !want);
    $('.cb', li).setAttribute('aria-checked', String(!want));
    toast(e.status === 409 ? 'El archivo cambió por fuera; lo recargo.' : `No se pudo guardar: ${e.message}`, 'err');
    if (e.status === 409) openFile(cur.path, new URLSearchParams(), { keepScroll: true });
  } finally {
    li.classList.remove('busy');
  }
}

function findSection(li) {
  let last = null;
  for (const el of $$('#doc h2, #doc h3, #doc li.task')) {
    if (el === li) return last;
    if (el.tagName !== 'LI') last = el;
  }
  return last;
}

function headingText(h) {
  const c = h.cloneNode(true);
  $$('.sec-count', c).forEach((s) => s.remove());
  return c.textContent.trim();
}

function sectionDone(h) {
  const s = $('.sec-count', h);
  return s && s.classList.contains('complete');
}

function focusTask(line) {
  const li = $(`#doc li.task[data-line="${line}"]`);
  if (!li) return false;
  li.scrollIntoView({ block: 'center' });
  li.classList.add('flash');
  setTimeout(() => li.classList.remove('flash'), 1900);
  return true;
}

function highlightText(q) {
  const root = $('#doc') || $('#main');
  const fq = fold(q);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const idx = fold(n.data).indexOf(fq);
    if (idx < 0 || n.parentElement.closest('.sec-count, .copy-btn, .code-lang')) continue;
    const range = document.createRange();
    range.setStart(n, idx);
    range.setEnd(n, Math.min(idx + q.length, n.data.length));
    const mark = document.createElement('mark');
    range.surroundContents(mark);
    mark.scrollIntoView({ block: 'center' });
    return true;
  }
  return false;
}

function renderCode(path, data) {
  const code = data.content.replace(/\r\n/g, '\n').replace(/\n$/, '');
  const n = code.split('\n').length;
  const lang = data.lang || 'plaintext';
  const hl = window.hljs && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : esc(code);
  const gutter = Array.from({ length: n }, (_, i) => `<span data-l="${i}">${i + 1}</span>`).join('\n');
  $('#main').innerHTML = `${docHead(path)}
    <div class="code-file"><pre class="gutter">${gutter}</pre><pre class="src"><code class="hljs language-${esc(lang)}">${hl}</code></pre></div>`;
  const btn = copyButton(() => code);
  $('.code-file').append(btn);
  $('#toc').innerHTML = '';
  window.onscroll = null;
}

function focusCodeLine(line) {
  const s = $(`.gutter span[data-l="${line}"]`);
  if (!s) return;
  s.scrollIntoView({ block: 'center' });
  s.style.color = 'var(--accent-text)';
  s.style.fontWeight = '700';
}

/* ================================================================ índice */

let tocObserver = null;
function buildToc(art) {
  const toc = $('#toc');
  const hs = $$('h2, h3', art);
  window.onscroll = null;
  if (hs.length < 2) { toc.innerHTML = ''; return; }
  toc.innerHTML = '<div class="toc-title">En esta página</div>' + hs.map((h) =>
    `<a class="lvl${h.tagName[1]}" href="${hashFor(state.current.path, { h: h.id })}" data-id="${h.id}">${esc(headingText(h))}</a>`).join('');
  $$('a', toc).forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const el = document.getElementById(a.dataset.id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }));
  if (tocObserver) tocObserver.disconnect();
  const onScroll = () => {
    let cur = hs[0];
    for (const h of hs) if (h.getBoundingClientRect().top < 110) cur = h;
    $$('a', toc).forEach((a) => a.classList.toggle('active', a.dataset.id === cur.id));
  };
  window.onscroll = () => requestAnimationFrame(onScroll);
  onScroll();
}

/* ================================================================ búsqueda */

function setupSearch() {
  const input = $('#searchInput');
  const box = $('#searchResults');
  let timer = null, items = [], active = -1, lastQ = '';

  const close = () => { box.hidden = true; active = -1; };
  const go = (i) => {
    const r = items[i];
    if (!r) return;
    close();
    input.blur();
    location.hash = hashFor(r.path, { line: r.line, q: lastQ });
  };
  const mark = (text, q) => {
    const i = fold(text).indexOf(fold(q));
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };
  const paint = () => $$('.sr-item', box).forEach((el, i) => el.classList.toggle('active', i === active));

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      lastQ = q;
      const { results } = await api('/api/search?q=' + encodeURIComponent(q));
      if (input.value.trim() !== q) return;
      items = results;
      active = results.length ? 0 : -1;
      box.innerHTML = results.length
        ? results.map((r, i) => `<a class="sr-item" data-i="${i}">
            <div class="sr-where"><b>${esc(r.title)}</b>${r.section && r.section !== r.title ? ' · ' + esc(r.section) : ''}</div>
            <div class="sr-text">${mark(r.text.replace(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*/, '').replace(/^#+\s*/, ''), q)}</div></a>`).join('')
        : '<div class="sr-empty">Nada por acá.</div>';
      box.hidden = false;
      paint();
      $$('.sr-item', box).forEach((el) => el.addEventListener('mousedown', (e) => { e.preventDefault(); go(+el.dataset.i); }));
    }, 160);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2 && items.length) box.hidden = false; });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

/* ================================================================ videos */

const vids = { data: null, apiP: null, player: null, ready: false, pending: null, playing: null, shown: null, tick: null, lastSave: 0 };
const YT_ERRORS = {
  2: 'el link del video no es válido',
  5: 'el navegador no pudo reproducirlo',
  100: 'el video no existe o es privado',
  101: 'el dueño no deja verlo fuera de YouTube',
  150: 'el dueño no deja verlo fuera de YouTube',
  152: 'YouTube no recibió el origen de la página',
  153: 'YouTube no recibió el origen de la página',
};
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2.5" y="5" width="19" height="14" rx="4" fill="currentColor"/><path d="m10 9 5 3-5 3z" fill="var(--bg)"/></svg>';
const JSON_POST = (body, extra = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...extra });

function fmtTime(sec) {
  const t = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

async function loadVideos() {
  try { vids.data = await api('/api/videos'); } catch (e) { vids.data = null; }
  return vids.data;
}

const vList = (id) => (vids.data && id ? vids.data.lists.find((l) => l.id === id) : null) || null;
const vProg = (id) => (vids.data && vids.data.progress[id]) || null;
const vDur = (v) => v.duration || (vProg(v.id) || {}).duration || 0;
const listHash = (id, params) => `#/videos/${encodeURIComponent(id)}${params ? '?' + new URLSearchParams(params) : ''}`;
const ytLink = (vid, listId, at) => `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}${listId && listId !== vid ? '&list=' + encodeURIComponent(listId) : ''}${at > 0 ? `&t=${Math.floor(at)}s` : ''}`;

function listStats(l) {
  let seen = 0, done = 0, total = 0;
  for (const v of l.videos) {
    const p = vProg(v.id) || {};
    const dur = vDur(v);
    if (p.watched) seen++;
    if (dur) {
      total += dur;
      done += p.watched ? dur : Math.min(p.position || 0, dur);
    }
  }
  const n = l.videos.length;
  return { seen, count: n, percent: total ? Math.round((done * 100) / total) : pct(seen, n), total };
}

// Saca los pedazos "a | b | c" que se repiten en más de la mitad de los títulos
// ("Free CCNA", "CCNA 200-301 Complete Course") para que la lista se lea mejor.
function shortTitles(l) {
  const segs = l.videos.map((v) => (v.title || v.id).split(' | ').map((x) => x.trim()));
  const freq = new Map();
  if (l.videos.length >= 4) segs.forEach((ss) => new Set(ss).forEach((x) => freq.set(x, (freq.get(x) || 0) + 1)));
  return segs.map((ss, i) => {
    const keep = ss.filter((x) => !((freq.get(x) || 0) > l.videos.length / 2));
    return keep.length ? keep.join(' · ') : l.videos[i].title || l.videos[i].id;
  });
}

function finished(id) {
  const p = vProg(id);
  return !!(p && p.watched && p.duration && p.position >= p.duration - 10);
}

// Segundo donde retomar un video: lo guardado, o 0 si nunca se empezó o ya se terminó.
function resumeAt(id) {
  const p = vProg(id);
  if (!p || !p.position || p.position < 5 || finished(id)) return 0;
  return p.position;
}

// Qué video sigue: el puntero "current" si es de esta lista (o el siguiente si ese ya terminó);
// si no, el último empezado de la lista o el primero sin ver.
function continueTarget(listId) {
  const d = vids.data;
  if (!d || !d.lists.length) return null;
  const c = d.current;
  const l = vList(listId) || (c && vList(c.list)) || vList(d.default) || d.lists[0];
  const at = (i) => ({ list: l, index: i, at: resumeAt(l.videos[i].id) });
  if (c && c.list === l.id) {
    const i = l.videos.findIndex((v) => v.id === c.video);
    if (i >= 0 && !finished(c.video)) return at(i);
    if (i >= 0 && i + 1 < l.videos.length) return at(i + 1);
  }
  let best = -1;
  l.videos.forEach((v, i) => {
    const p = vProg(v.id);
    if (p && p.position && !p.watched && (best < 0 || p.updated > vProg(l.videos[best].id).updated)) best = i;
  });
  if (best >= 0) return at(best);
  const i = l.videos.findIndex((v) => !(vProg(v.id) || {}).watched);
  return at(i < 0 ? 0 : i);
}

/* ---------- inicio y sidebar */

function navVideos() {
  const d = vids.data;
  const l = d && (vList(d.default) || d.lists[0]);
  const st = l ? listStats(l) : null;
  return `<a class="nav-home nav-videos${state.view === 'videos' ? ' active' : ''}" id="navVideos" href="#/videos" title="${st ? `${st.percent}% de ${esc(l.title)}` : ''}">
      ${PLAY_SVG}Videos${st ? ring(st.percent, 100) : ''}</a>`;
}

function watchCard() {
  const t = continueTarget();
  if (!t) return '';
  const l = t.list, v = l.videos[t.index], st = listStats(l), dur = vDur(v);
  const lbl = t.at ? 'Seguir viendo' : st.seen ? 'Próximo video' : 'Empezar el curso';
  const where = `Video ${t.index + 1} de ${l.videos.length}${t.at ? ` · vas por ${fmtTime(t.at)}${dur ? ' de ' + fmtTime(dur) : ''}` : dur ? ` · ${fmtTime(dur)}` : ''}`;
  return `<a class="watch-card" href="${listHash(l.id, { seguir: 1 })}">
      <span class="thumb"><img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy">
        <span class="thumb-play">${PLAY_SVG}</span>${t.at && dur ? `<span class="thumb-bar"><span style="width:${pct(t.at, dur)}%"></span></span>` : ''}</span>
      <span class="wc-body"><span class="lbl">${lbl}</span>
        <span class="txt">${esc(shortTitles(l)[t.index])}</span>
        <span class="ctx">${esc(where)}</span>
        <span class="wc-list"><span class="bar"><span style="width:${st.percent}%"></span></span><span>${st.percent}% · ${st.seen}/${st.count} vistos</span></span>
      </span>
      <span class="go">→</span></a>`;
}

/* ---------- página */

function renderVideos(listId, params = new URLSearchParams()) {
  const first = state.view !== 'videos' || !$('#vpage');
  state.current = null;
  setView('videos');
  document.title = 'Videos · Networking Lab';
  renderSidebar();
  $('#toc').innerHTML = '';
  window.onscroll = null;
  document.body.classList.remove('nav-open');
  const d = vids.data;
  if (!d) {
    $('#main').innerHTML = '<div class="empty">No pude leer <code>progreso/listas.json</code>. ¿Está corriendo el servidor?</div>';
    return;
  }
  const l = vList(listId) || (d.current && vList(d.current.list)) || vList(d.default) || d.lists[0] || null;
  vids.shown = l ? l.id : null;
  if (first) {
    $('#main').innerHTML = `<div id="vpage">
      <div class="vhead" id="vhead"></div>
      <div class="vtabs" id="vtabs"></div>
      <form class="vadd" id="vadd" hidden>
        <input id="vaddUrl" type="url" placeholder="Pegá un link de YouTube: una lista o un video" autocomplete="off" spellcheck="false" required>
        <button class="btn primary" type="submit">Agregar</button>
        <span class="vadd-status" id="vaddStatus"></span>
      </form>
      <div class="vgrid">
        <section class="vleft">
          <div class="vplayer"><div id="ytPlayer"></div><div class="vplayer-msg" id="vmsg" hidden></div></div>
          <div class="vnow" id="vnow"></div>
        </section>
        <section class="vright" id="vlist"></section>
      </div></div>`;
    setupVideoEvents();
    window.scrollTo(0, 0);
    vids.tick = setInterval(onTick, 1000);
  }
  paintVideos();
  const seguir = params.has('seguir');
  if (seguir) history.replaceState(null, '', listHash(vids.shown));
  if (first || seguir) {
    const t = continueTarget(seguir ? null : vids.shown);
    if (t) {
      if (t.list.id !== vids.shown) location.hash = listHash(t.list.id);
      startVideo(t.list.id, t.index, t.at, seguir);
    }
  }
}

function paintVideos() {
  paintHead();
  paintTabs();
  paintList();
  paintNow();
}

function paintHead() {
  const box = $('#vhead');
  if (!box) return;
  const t = continueTarget();
  let sub = 'Agregá una lista de YouTube para empezar.';
  if (t) {
    const title = esc(shortTitles(t.list)[t.index]);
    sub = t.at
      ? `Quedaste en el video ${t.index + 1} de ${t.list.videos.length}, <b>${title}</b>, a los ${fmtTime(t.at)}.`
      : `Sigue el video ${t.index + 1} de ${t.list.videos.length}: <b>${title}</b>.`;
  }
  box.innerHTML = `<div class="vhead-text"><h1>Videos</h1><p>${sub}</p></div>
    ${t ? `<button class="btn primary big" type="button" id="vcont">${PLAY_SVG}${t.at ? 'Seguir donde quedé' : 'Empezar'}</button>` : ''}`;
}

function paintTabs() {
  const box = $('#vtabs');
  if (!box) return;
  const d = vids.data;
  box.innerHTML = d.lists.map((l) => {
    const st = listStats(l);
    const x = l.id !== d.default ? `<button class="vtab-x" type="button" data-id="${esc(l.id)}" title="Quitar" aria-label="Quitar ${esc(l.title)}">×</button>` : '';
    return `<span class="vtab${l.id === vids.shown ? ' active' : ''}"><a href="${listHash(l.id)}">${ring(st.percent, 100)}
      <span class="t">${esc(l.title)}</span><span class="n">${l.kind === 'video' ? 'video' : `${st.seen}/${st.count}`}</span></a>${x}</span>`;
  }).join('') + '<button class="vtab add" type="button" id="vaddBtn">+ Agregar</button>';
}

function rowHtml(l, v, i, title) {
  const p = vProg(v.id) || {};
  const dur = vDur(v);
  const w = !!p.watched;
  const pos = p.position || 0;
  const partial = !w && pos > 0;
  const playing = vids.playing && vids.playing.list === l.id && vids.playing.video === v.id;
  const meta = w ? `Visto${dur ? ' · ' + fmtTime(dur) : ''}` : partial ? `Vas por ${fmtTime(pos)}${dur ? ' de ' + fmtTime(dur) : ''}` : dur ? fmtTime(dur) : '';
  const fill = !w && dur ? pct(pos, dur) : 0;
  return `<li class="vrow${w ? ' watched' : ''}${partial ? ' partial' : ''}${playing ? ' playing' : ''}" data-i="${i}" data-id="${esc(v.id)}">
    <button class="vplay" type="button" title="${esc(v.title || v.id)}">
      <span class="vnum">${playing ? PLAY_SVG : i + 1}</span>
      <span class="vmain"><span class="vtitle">${esc(title)}</span><span class="vmeta">${meta}</span></span>
      <span class="vbar"${fill ? '' : ' hidden'}><span style="width:${fill}%"></span></span>
    </button>
    <button class="vmark" type="button" aria-pressed="${w}" title="${w ? 'Marcar como no visto' : 'Marcar como visto'}">${CHECK_SVG}</button></li>`;
}

function paintList() {
  const box = $('#vlist');
  if (!box) return;
  const l = vList(vids.shown);
  if (!l) { box.innerHTML = '<div class="empty">No hay listas. Tocá <b>+ Agregar</b> y pegá un link de YouTube.</div>'; return; }
  const st = listStats(l);
  const titles = shortTitles(l);
  const complete = st.seen === st.count ? ' complete' : '';
  box.innerHTML = `<div class="vlist-head">
      <div><h2>${esc(l.title)}</h2><div class="sub">${l.channel ? esc(l.channel) + ' · ' : ''}${st.count} video${st.count === 1 ? '' : 's'}${st.total ? ' · ' + fmtTime(st.total) : ''}</div></div>
      <a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">YouTube ↗</a></div>
    <div class="doc-progress${complete}"><div class="bar${complete}"><span style="width:${st.percent}%"></span></div>
      <span class="lbl">${st.seen}/${st.count} · ${st.percent}%</span></div>
    <ol class="vrows">${l.videos.map((v, i) => rowHtml(l, v, i, titles[i])).join('')}</ol>`;
  const rows = $('.vrows', box);
  const act = $('.vrow.playing', rows) || $('.vrow.partial', rows);
  if (act && rows.scrollHeight > rows.clientHeight) rows.scrollTop = act.offsetTop - rows.clientHeight / 3;
}

function paintNow() {
  const box = $('#vnow');
  if (!box) return;
  const cur = vids.playing;
  const l = cur && vList(cur.list);
  const i = l ? l.videos.findIndex((v) => v.id === cur.video) : -1;
  if (i < 0) { box.innerHTML = ''; return; }
  const v = l.videos[i];
  box.innerHTML = `<div class="vnow-text">
      <div class="lbl">${l.id !== vids.shown ? esc(l.title) + ' · ' : ''}Video ${i + 1} de ${l.videos.length}</div>
      <div class="txt" title="${esc(v.title || v.id)}">${esc(shortTitles(l)[i])}</div>
      <div class="ctx" id="vnowTime">${nowTime(v)}</div></div>
    <div class="vnow-btns">
      <button class="btn" type="button" id="vprev"${i === 0 ? ' disabled' : ''}>← Anterior</button>
      <button class="btn" type="button" id="vnext"${i === l.videos.length - 1 ? ' disabled' : ''}>Siguiente →</button>
      <a class="btn" id="vyt" href="${esc(ytLink(v.id, l.id, resumeAt(v.id)))}" target="_blank" rel="noopener">YouTube ↗</a></div>`;
}

function nowTime(v) {
  const p = vids.player;
  let pos = resumeAt(v.id), dur = vDur(v);
  if (p && vids.ready && typeof p.getCurrentTime === 'function' && [1, 2, 3].includes(p.getPlayerState())) {
    pos = p.getCurrentTime();
    dur = p.getDuration() || dur;
  }
  const w = (vProg(v.id) || {}).watched ? ' · <span class="ok">✓ visto</span>' : '';
  return `${fmtTime(pos)}${dur ? ' / ' + fmtTime(dur) : ''}${w}`;
}

function setupVideoEvents() {
  const page = $('#vpage');
  page.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'vcont') return continueWatching();
    if (t.id === 'vaddBtn') {
      const f = $('#vadd');
      f.hidden = !f.hidden;
      if (!f.hidden) $('#vaddUrl').focus();
      return;
    }
    if (t.id === 'vprev' || t.id === 'vnext') {
      const cur = vids.playing, l = cur && vList(cur.list);
      if (!l) return;
      const i = l.videos.findIndex((v) => v.id === cur.video) + (t.id === 'vnext' ? 1 : -1);
      if (i >= 0 && i < l.videos.length) startVideo(l.id, i, resumeAt(l.videos[i].id), true);
      return;
    }
    if (t.classList.contains('vtab-x')) return removeList(t.dataset.id);
    const row = t.closest('.vrow');
    if (!row) return;
    const l = vList(vids.shown);
    const i = +row.dataset.i;
    if (t.classList.contains('vplay')) {
      const cur = vids.playing;
      if (cur && cur.list === l.id && cur.video === row.dataset.id && vids.ready && vids.player.getPlayerState() === 1) vids.player.pauseVideo();
      else if (cur && cur.list === l.id && cur.video === row.dataset.id && vids.ready && [2, 5].includes(vids.player.getPlayerState())) vids.player.playVideo();
      else startVideo(l.id, i, resumeAt(row.dataset.id), true);
      if (matchMedia('(max-width: 1180px)').matches) $('.vplayer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (t.classList.contains('vmark')) {
      markWatched(l.id, row.dataset.id, t.getAttribute('aria-pressed') !== 'true', t);
    }
  });
  $('#vadd').addEventListener('submit', (e) => {
    e.preventDefault();
    addList($('#vaddUrl').value);
  });
}

function continueWatching() {
  const t = continueTarget();
  if (!t) return;
  if (t.list.id !== vids.shown) location.hash = listHash(t.list.id);
  const cur = vids.playing;
  const same = cur && cur.list === t.list.id && cur.video === t.list.videos[t.index].id && vids.ready;
  if (same) vids.player.playVideo();
  else startVideo(t.list.id, t.index, t.at, true);
  $('.vplayer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- reproductor */

function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!vids.apiP) {
    vids.apiP = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { vids.apiP = null; s.remove(); reject(new Error('sin conexión')); };
      document.head.append(s);
    });
  }
  return vids.apiP;
}

function showMsg(html) {
  const m = $('#vmsg');
  if (!m) return;
  m.innerHTML = html;
  m.hidden = !html;
}

async function startVideo(listId, index, at, autoplay) {
  const l = vList(listId);
  if (!l || !l.videos[index]) return;
  const v = l.videos[index];
  saveProgress();
  vids.playing = { list: listId, video: v.id };
  paintNow();
  paintList();
  showMsg('');
  try {
    await loadYT();
  } catch (e) {
    showMsg(`No cargó el reproductor de YouTube (¿sin internet?). <a href="${esc(ytLink(v.id, l.id, at))}" target="_blank" rel="noopener">Abrir en YouTube ↗</a>`);
    return;
  }
  if (state.view !== 'videos' || !vids.playing || vids.playing.video !== v.id) return;
  const opts = { videoId: v.id, startSeconds: Math.floor(at || 0) };
  if (vids.player && vids.ready) {
    if (autoplay) vids.player.loadVideoById(opts);
    else vids.player.cueVideoById(opts);
    return;
  }
  if (vids.player) { vids.pending = { opts, autoplay }; return; }
  vids.ready = false;
  vids.player = new YT.Player('ytPlayer', {
    width: '100%',
    height: '100%',
    videoId: v.id,
    // origin: sin esto (o sin Referer) YouTube corta con error 152/153.
    playerVars: { origin: location.origin, playsinline: 1, rel: 0, start: opts.startSeconds, autoplay: autoplay ? 1 : 0 },
    events: {
      onReady: () => {
        vids.ready = true;
        const p = vids.pending;
        vids.pending = null;
        if (p) (p.autoplay ? vids.player.loadVideoById(p.opts) : vids.player.cueVideoById(p.opts));
      },
      onStateChange: onYtState,
      onError: onYtError,
    },
  });
}

function onYtState(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) { showMsg(''); paintNow(); }
  if (e.data === S.PAUSED) saveProgress();
  if (e.data === S.ENDED) {
    const cur = vids.playing;
    saveProgress({ ended: true }).then(() => {
      const l = cur && vList(cur.list);
      if (!l || !vids.playing || vids.playing.video !== cur.video) return;
      const i = l.videos.findIndex((v) => v.id === cur.video);
      if (i >= 0 && i + 1 < l.videos.length) {
        toast(`Visto ✓ Sigue el video ${i + 2}.`, 'win');
        startVideo(l.id, i + 1, resumeAt(l.videos[i + 1].id), true);
      } else {
        toast('¡Terminaste la lista! 🎉', 'win');
        const r = $('.vplayer').getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top + r.height / 2, 60, 260);
      }
    });
  }
}

function onYtError(e) {
  const cur = vids.playing;
  const why = YT_ERRORS[e.data] || 'error desconocido';
  const link = cur ? ` <a href="${esc(ytLink(cur.video, cur.list, resumeAt(cur.video)))}" target="_blank" rel="noopener">Abrir en YouTube ↗</a>` : '';
  showMsg(`YouTube no lo reproduce acá: ${esc(why)} (error ${esc(e.data)}).${link}`);
}

function onTick() {
  const p = vids.player;
  if (!p || !vids.ready || typeof p.getPlayerState !== 'function') return;
  if (p.getPlayerState() !== 1) return;
  const cur = vids.playing, l = cur && vList(cur.list);
  const v = l && l.videos.find((x) => x.id === cur.video);
  const t = $('#vnowTime');
  if (t && v) t.innerHTML = nowTime(v);
  const row = l && l.id === vids.shown && $(`.vrow[data-id="${CSS.escape(cur.video)}"]`);
  const dur = p.getDuration();
  if (row && dur > 0) {
    const bar = $('.vbar', row);
    bar.hidden = false;
    $('span', bar).style.width = `${pct(p.getCurrentTime(), dur)}%`;
  }
  if (Date.now() - vids.lastSave >= 10000) saveProgress();
}

// Lo que hay que guardar ahora, o null si el reproductor no tiene una posición confiable.
function playerSnapshot() {
  const p = vids.player, cur = vids.playing;
  if (!p || !vids.ready || !cur || typeof p.getCurrentTime !== 'function') return null;
  const st = p.getPlayerState();
  if (st === -1 || st === 5) return null; // sin empezar o en cola
  const vd = typeof p.getVideoData === 'function' ? p.getVideoData() : null;
  if (vd && vd.video_id && vd.video_id !== cur.video) return null;
  const body = { list: cur.list, video: cur.video, position: Math.max(0, Math.round(p.getCurrentTime() || 0)) };
  const dur = p.getDuration();
  if (dur > 0) body.duration = Math.round(dur);
  return body;
}

function saveProgress(extra = {}, keepalive = false) {
  const body = playerSnapshot();
  if (!body) return Promise.resolve();
  Object.assign(body, extra);
  vids.lastSave = Date.now();
  return fetch('/api/videos/progress', JSON_POST(body, { keepalive }))
    .then((r) => (r.ok ? r.json() : null))
    .then((res) => { if (res) applyProgress(res, body.list); })
    .catch(() => { /* servidor apagado: se reintenta en el próximo guardado */ });
}

function applyProgress(res, listId) {
  if (!vids.data) return;
  const was = (vids.data.progress[res.video] || {}).watched;
  vids.data.progress[res.video] = res.progress;
  vids.data.current = res.current;
  const l = vList(listId);
  const v = l && l.videos.find((x) => x.id === res.video);
  if (v && res.duration && !v.duration) v.duration = res.duration;
  const nav = $('#navVideos');
  if (nav) nav.outerHTML = navVideos();
  if (state.view !== 'videos') return;
  paintHead();
  paintTabs();
  if (l && l.id === vids.shown) {
    const row = $(`.vrow[data-id="${CSS.escape(res.video)}"]`);
    if (row) {
      const i = +row.dataset.i;
      row.outerHTML = rowHtml(l, v, i, shortTitles(l)[i]);
    }
    const st = listStats(l);
    const prog = $('#vlist .doc-progress');
    if (prog) {
      $('.bar > span', prog).style.width = `${st.percent}%`;
      $('.lbl', prog).textContent = `${st.seen}/${st.count} · ${st.percent}%`;
    }
  }
  if (!was && res.progress.watched) paintNow();
}

async function markWatched(listId, vid, watched, btn) {
  try {
    const res = await api('/api/videos/progress', JSON_POST({ list: listId, video: vid, watched, current: false }));
    applyProgress(res, listId);
    paintNow();
    if (watched && btn) {
      const r = btn.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 10, 70);
    }
  } catch (e) {
    toast(`No se pudo guardar: ${e.message}`, 'err');
  }
}

function leaveVideos() {
  saveProgress({}, true);
  clearInterval(vids.tick);
  vids.tick = null;
  if (vids.player) { try { vids.player.destroy(); } catch (e) { /* ya no estaba */ } }
  vids.player = null;
  vids.ready = false;
  vids.pending = null;
  vids.playing = null;
}

/* ---------- agregar y quitar listas */

// Saca los ids de una playlist con el propio reproductor de YouTube (no hace falta API key).
async function playlistIds(listId) {
  await loadYT();
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:180px';
    const inner = document.createElement('div');
    host.append(inner);
    document.body.append(host);
    let done = false, iv = null, p = null;
    const finish = (err, ids) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      clearInterval(iv);
      try { p.destroy(); } catch (e) { /* nada */ }
      host.remove();
      if (err) reject(err); else resolve(ids);
    };
    const to = setTimeout(() => finish(new Error('YouTube no devolvió la lista')), 20000);
    p = new YT.Player(inner, {
      width: 320,
      height: 180,
      playerVars: { listType: 'playlist', list: listId, origin: location.origin },
      events: {
        onReady: () => {
          iv = setInterval(() => {
            const ids = p.getPlaylist && p.getPlaylist();
            if (ids && ids.length) finish(null, ids);
          }, 300);
        },
        onError: (e) => finish(new Error(YT_ERRORS[e.data] || `error ${e.data}`)),
      },
    });
  });
}

async function addList(url) {
  const form = $('#vadd'), status = $('#vaddStatus'), btn = $('button', form);
  btn.disabled = true;
  status.textContent = 'Buscando…';
  try {
    let res = await api('/api/videos/lists', JSON_POST({ url }));
    if (res.resolve === 'playlist') {
      status.textContent = 'Leyendo la lista desde YouTube…';
      const ids = await playlistIds(res.id);
      status.textContent = `Buscando los títulos de ${ids.length} videos…`;
      res = await api('/api/videos/lists', JSON_POST({ url, videos: ids }));
    }
    await loadVideos();
    $('#vaddUrl').value = '';
    form.hidden = true;
    toast(`Agregada: ${res.list.title}`);
    if (location.hash === listHash(res.list.id)) paintVideos();
    else location.hash = listHash(res.list.id);
  } catch (e) {
    toast(`No se pudo agregar: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
    status.textContent = '';
  }
}

async function removeList(id) {
  const l = vList(id);
  if (!l || !confirm(`¿Quitar "${l.title}"? Lo que viste queda guardado por si la volvés a agregar.`)) return;
  try {
    if (vids.playing && vids.playing.list === id) await saveProgress();
    await api('/api/videos/lists/remove', JSON_POST({ id }));
    if (vids.playing && vids.playing.list === id) {
      if (vids.player && vids.ready) vids.player.stopVideo();
      vids.playing = null;
    }
    await loadVideos();
    toast(`Quitada: ${l.title}`);
    if (vids.shown === id) location.hash = '#/videos';
    else paintVideos();
  } catch (e) {
    toast(`No se pudo quitar: ${e.message}`, 'err');
  }
}

/* ================================================================ tema, menú, refresco */

function setupChrome() {
  $('#themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* sin storage */ }
  });
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
}

async function poll() {
  if (document.hidden) return;
  try {
    const { version } = await api('/api/version');
    if (version <= state.version) return;
    await loadTree();
    const cur = state.current;
    if (!cur) {
      if (state.view === 'home') renderHome();
      else renderSidebar();
      return;
    }
    const f = state.files.get(cur.path);
    if (!f) { location.hash = '#/'; return; }
    if (f.mtime !== cur.data.mtime) openFile(cur.path, new URLSearchParams(), { keepScroll: true });
  } catch (e) { /* servidor apagado: reintenta */ }
}

function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
}

function route() {
  const r = parseHash();
  if (r.view !== 'videos' && state.view === 'videos') leaveVideos();
  if (r.view === 'file') openFile(r.path, r.params);
  else if (r.view === 'videos') renderVideos(r.list, r.params);
  else renderHome();
}

async function init() {
  setupChrome();
  setupSearch();
  try {
    await Promise.all([loadTree(), loadVideos()]);
  } catch (e) {
    $('#main').innerHTML = '<div class="empty">No puedo hablar con el servidor. ¿Está corriendo <code>web.cmd</code>?</div>';
    return;
  }
  if (window.marked) marked.use({ gfm: true });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', () => saveProgress({}, true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress({}, true); });
  route();
  setInterval(poll, 2500);
}

init();
