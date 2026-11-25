'use strict';

/* ================================================================ utilidades */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\](?:\s|$))/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
const CHECK_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LANG_ALIAS = { text: 'plaintext', txt: 'plaintext', sh: 'bash', shell: 'bash', console: 'bash', ps: 'powershell', ps1: 'powershell', toml: 'ini', rs: 'rust', yml: 'yaml', 'c++': 'cpp' };

const state = { tree: null, files: new Map(), current: null, version: 0, polling: null };

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
  const home = !cur;
  let html = `<a class="nav-home${home ? ' active' : ''}" href="#/">
      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>
      Progreso</a>`;
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
    if (!cur) { renderHome(); return; }
    const f = state.files.get(cur.path);
    if (!f) { location.hash = '#/'; return; }
    if (f.mtime !== cur.data.mtime) openFile(cur.path, new URLSearchParams(), { keepScroll: true });
  } catch (e) { /* servidor apagado: reintenta */ }
}

function route() {
  const r = parseHash();
  if (r.view === 'file') openFile(r.path, r.params);
  else renderHome();
}

async function init() {
  setupChrome();
  setupSearch();
  try {
    await loadTree();
  } catch (e) {
    $('#main').innerHTML = '<div class="empty">No puedo hablar con el servidor. ¿Está corriendo <code>web.cmd</code>?</div>';
    return;
  }
  if (window.marked) marked.use({ gfm: true });
  window.addEventListener('hashchange', route);
  route();
  setInterval(poll, 2500);
}

init();
