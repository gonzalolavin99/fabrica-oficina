'use strict';
const OWNER = 'gonzalolavin99';
// Proyectos: viven en proyectos.json (este repo). El equipo trabaja en uno a la vez: el que tiene fabrica:activo en su manual.
const PALETA = ['#c0503a', '#3aa0a8', '#d4a017', '#7b5cd6', '#2f9e5b', '#d6457a', '#4a7fd4', '#9c6b3a'];
const TURNOS_BASE = {explorador: ['04:43'], consejero: ['10:22', '15:22', '20:22'], dev: ['22:17'], seguridad: ['dom 02:12']};
let REG = null, REPOS = [], PENDIENTES = [];
function applyRegistry(reg) {
  REG = reg;
  const map = p => ({name: p.repo, short: p.nombre.toUpperCase(), nombre: p.nombre, color: p.color, revisor: p.revisor || 'Opus', despliega: !!p.despliega, session: p.session, turnos: p.turnos || TURNOS_BASE, despierto: p.turnos_encendidos !== false});
  REPOS = reg.proyectos.filter(p => p.estado !== 'pendiente').map(map);
  PENDIENTES = reg.proyectos.filter(p => p.estado === 'pendiente').map(map);
}
const ROLES = {
  explorador: {nombre: 'Shisui', puesto: 'Explorador', modelo: 'Sonnet', hace: 'Recorre el código y los docs del proyecto y propone el siguiente paso pequeño, con su prioridad.', hair: '#2a1f1a', shirt: '#f6c453', look: 'rizos'},
  consejero: {nombre: 'Itachi', puesto: 'Consejero y Arquitecto', modelo: 'Opus', hace: 'Cuestiona tus ideas, conversa contigo cada propuesta y, cuando apruebas una tarea, escribe el plan que el Dev ejecuta. También dirige la retro semanal.', hair: '#2b2b3a', shirt: '#b08cff', look: 'coleta'},
  dev: {nombre: 'Sasuke', puesto: 'Dev', modelo: 'Sonnet', hace: 'Implementa exactamente el plan del Arquitecto, corre las pruebas y abre el PR.', hair: '#1f2a4a', shirt: '#6fb3ff', look: 'puntas'},
  revisor: {nombre: 'Madara', puesto: 'Revisor', modelo: 'Opus', hace: 'Revisa cada PR con memoria limpia y te dice si fusionar. Hasta que termina, el equipo no empieza otra tarea.', hair: '#2a2030', shirt: '#6fdc8c', look: 'melena'},
  seguridad: {nombre: 'Fugaku', puesto: 'Seguridad', modelo: 'Opus', hace: 'Audita cada semana el proyecto y a la propia fábrica. Lo delicado te lo informa en privado, nunca en GitHub.', hair: '#26222a', shirt: '#ff8a8a', look: 'corto'},
};
const PUESTO_A_ROL = {explorador: 'explorador', exploradora: 'explorador', consejero: 'consejero', arquitecto: 'consejero', retro: 'consejero', dev: 'dev', revisor: 'revisor', revisora: 'revisor', seguridad: 'seguridad'};
const BASE_TZ = 'America/Santiago';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let state = store.get('fabrica3', {repos: {}, fetchedAt: 0});
applyRegistry(store.get('fabrica-registro', {sede: 'session_01RhVe33VXjDtec5jfWbScXS', proyectos: []}));
let filters = store.get('fabrica-filtros', {repo: 'todos', tipo: 'todo', prio: 'todas'}), lastCount = -1;
let token = store.get('fabrica-token', '');
(() => { const m = location.hash.match(/[#&]t=([A-Za-z0-9_]+)/); if (m) { token = m[1]; store.set('fabrica-token', token); history.replaceState(null, '', location.pathname + location.search); } })();

// ---------- tiempo (los turnos viven en hora de Santiago; se muestran en la hora de tu dispositivo) ----------
const pad = n => String(n).padStart(2, '0');
function tzOffsetMin(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}).formatToParts(d).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - d.getTime() + d.getSeconds() * 1000 + d.getMilliseconds()) / 60000;
}
function localHHMM(hhmm) {
  const m = hhmm.match(/^(\D*?)\s*(\d\d):(\d\d)$/); if (!m) return hhmm;
  const diff = Math.round(-new Date().getTimezoneOffset() - tzOffsetMin(BASE_TZ));
  let t = (+m[2] * 60 + +m[3] + diff + 1440 * 2) % 1440;
  return (m[1] ? m[1] + ' ' : '') + pad(Math.floor(t / 60)) + ':' + pad(t % 60);
}
const turnos = list => list.map(localHHMM).join(', ');
const isDay = () => { const h = new Date().getHours(); return h >= 7 && h < 20; };
function ago(iso) {
  const t = new Date(iso).getTime(); if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

// ---------- texto: limpiar y mostrar Markdown de forma segura ----------
function clean(txt) {
  return String(txt || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n?-{2,}\s*\n\s*_?(Generated|Generado)[^\n]*$/i, '')
    .replace(/\n\s*_?(Generated|Generado) (by|with|con) \[?Claude[^\n]*/gi, '')
    .replace(/\n\s*🤖 Generated with[^\n]*/gi, '')
    .replace(/^\s*🤖\s*[^:\n]{1,40}:\s*/, '')
    .trim();
}
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1');
}
function md(txt) {
  const lines = esc(clean(txt)).split('\n'); let out = '', list = '', inCode = false, table = [];
  const flushList = () => { if (list) { out += `</${list}>`; list = ''; } };
  const flushTable = () => { if (table.length) { out += '<div class="tbl"><table>' + table.map((r, i) => '<tr>' + r.map(c => i ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join('') + '</tr>').join('') + '</table></div>'; table = []; } };
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) { flushList(); flushTable(); out += inCode ? '</pre>' : '<pre>'; inCode = !inCode; continue; }
    if (inCode) { out += raw + '\n'; continue; }
    const l = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(l)) { flushList(); if (!/^\s*\|[\s:|-]+\|\s*$/.test(l)) table.push(l.trim().slice(1, -1).split('|').map(c => c.trim())); continue; }
    flushTable();
    let m;
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { flushList(); out += '<hr>'; continue; }
    if ((m = l.match(/^#{1,6}\s+(.*)/))) { flushList(); out += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = l.match(/^\s*[-*]\s+(?:\[( |x)\]\s+)?(.*)/i))) { if (list !== 'ul') { flushList(); out += '<ul>'; list = 'ul'; } out += `<li>${m[1] ? (m[1] === ' ' ? '☐ ' : '☑ ') : ''}${inline(m[2])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { flushList(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^&gt;\s?(.*)/))) { flushList(); out += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if (!l.trim()) flushList();
    else { flushList(); out += `<p>${inline(l)}</p>`; }
  }
  flushList(); flushTable(); if (inCode) out += '</pre>';
  return out;
}

// ---------- GitHub ----------
async function gh(path, opts = {}) {
  const headers = {Accept: opts.accept || 'application/vnd.github+json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${path}`, {method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store'});
  if (!r.ok) {
    if (opts.ok404 && r.status === 404) return null;
    if (r.status === 401) throw new Error('La llave no es válida o venció (revisa ⚙).');
    if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') throw new Error(token ? 'GitHub limitó las consultas por un rato.' : 'GitHub limitó las consultas (60 por hora sin llave). Activa tu llave en ⚙.');
    if (r.status === 405 || r.status === 409) throw new Error('GitHub no permite fusionar este PR todavía (puede tener conflictos o pruebas pendientes).');
    if (r.status === 403 || r.status === 404) throw new Error(opts.method ? 'Tu llave no tiene permiso para esto en este proyecto (revisa ⚙).' : 'GitHub respondió ' + r.status);
    throw new Error('GitHub respondió ' + r.status);
  }
  return r.status === 204 ? null : r.json();
}
const isMine = x => x.user && x.user.login === OWNER;
const isAgent = x => !!x.performed_via_github_app || /^\s*🤖/.test(x.body || '');
const has = (i, l) => i.labels.some(x => x.name === 'fabrica:' + l);
const prioOf = i => { const l = i.labels.find(x => x.name.startsWith('prioridad:')); return l ? l.name.slice(10) : ''; };
function author(c) {
  if (!isMine(c)) return {who: 'Cuenta externa @' + c.user.login + ' · los agentes la ignoran', cls: 'ext'};
  if (!isAgent(c)) return {who: 'Tú', cls: 'me'};
  const m = (c.body || '').match(/^\s*🤖\s*([^:\n]{1,40}):/), key = m && PUESTO_A_ROL[m[1].trim().toLowerCase().split(/[\s·,]/)[0]];
  return key ? {who: `${ROLES[key].nombre} · ${ROLES[key].puesto}`, cls: 'bot'} : {who: 'Equipo', cls: 'bot'};
}

function parseEstado(body) {
  const g = k => { const m = body.match(new RegExp('\\*\\*' + k + ':\\*\\*[ \\t]*(.*)')); return m ? m[1].trim() : ''; };
  const log = (body.split('**Registro:**')[1] || '').split('\n').map(s => s.replace(/^\s*[-*]\s*/, '').trim())
    .filter(s => s && !/^-+$/.test(s) && !/(Generated|Generado).*Claude/i.test(s)).slice(-8);
  return {estado: g('Estado').toLowerCase(), tarea: g('Tarea'), paso: g('Paso'), modelo: g('Modelo'), accion: g('Acción').toLowerCase(), log};
}

let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    try { const r = await fetch('proyectos.json', {cache: 'no-store'}); if (r.ok) { const reg = await r.json(); const local = store.get('fabrica-registro', null); if (!local || reg.proyectos.length >= local.proyectos.length) { applyRegistry(reg); store.set('fabrica-registro', reg); } } } catch (e) {}
    for (const R of REPOS) {
      const [issues, pulls] = await Promise.all([gh(`${R.name}/issues?state=open&per_page=100`), gh(`${R.name}/pulls?state=open&per_page=50`)]);
      const fab = issues.filter(i => !i.pull_request && isMine(i) && i.labels.some(l => l.name.startsWith('fabrica:')));
      const bit = fab.find(i => has(i, 'bitacora')), man = fab.find(i => has(i, 'manual')), dos = fab.find(i => has(i, 'dossier'));
      const estados = {};
      if (bit) {
        const cs = await gh(`${R.name}/issues/${bit.number}/comments?since=${new Date(Date.now() - 7 * 864e5).toISOString()}&per_page=100`);
        for (const c of cs) { if (!isMine(c)) continue; const m = (c.body || '').match(/<!--\s*fabrica-estado:(\w+)\s*-->/); if (m) estados[m[1]] = {...parseEstado(c.body), updated: c.updated_at}; }
      }
      const prs = pulls.filter(p => p.head.ref.startsWith('fabrica/') && isMine(p) && p.head.repo && p.head.repo.full_name === `${OWNER}/${R.name}`)
        .map(p => ({n: p.number, title: p.title, created: p.created_at, at: p.updated_at, prio: '', veredicto: '', pr: true, issue: +((p.head.ref.match(/issue-(\d+)/) || [])[1] || 0)}));
      for (const p of prs.slice(0, 4)) {
        const rev = (await gh(`${R.name}/issues/${p.n}/comments?per_page=100`)).reverse().find(c => isMine(c) && /VEREDICTO:/.test(c.body || ''));
        if (rev) p.veredicto = ((rev.body.match(/VEREDICTO:\s*([A-ZÁÉÍÓÚÑ ]+)/) || [])[1] || '').trim();
      }
      const slim = i => ({n: i.number, title: i.title, created: i.created_at, at: i.updated_at, prio: prioOf(i), comments: i.comments, body: (i.body || '').slice(0, 400)});
      state.repos[R.name] = {
        activo: !!(man && has(man, 'activo')), manualN: man ? man.number : null, bitN: bit ? bit.number : null, dossierN: dos ? dos.number : null,
        props: fab.filter(i => has(i, 'propuesta') && !has(i, 'aprobada')).map(slim),
        queue: fab.filter(i => has(i, 'aprobada') && !has(i, 'planificada') && !has(i, 'en-curso')).map(slim),
        planned: fab.filter(i => has(i, 'planificada') && !has(i, 'en-curso')).map(slim),
        running: fab.filter(i => has(i, 'en-curso')).map(slim),
        ideas: fab.filter(i => has(i, 'idea')).map(slim),
        prs, estados,
      };
    }
    state.fetchedAt = Date.now(); store.set('fabrica3', state); notice('');
  } catch (e) {
    notice(e.message + (state.fetchedAt ? ' Mostrando datos de ' + ago(new Date(state.fetchedAt).toISOString()) + '.' : ''));
  }
  loading = false; fillSelects(); render(); schedule();
}
let timer;
function schedule() {
  clearTimeout(timer);
  const busy = team().some(a => a.s === 'work');
  timer = setTimeout(() => { if (!document.hidden) load(); else schedule(); }, token ? (busy ? 45e3 : 180e3) : 600e3);
}
function notice(t) { $('notice').textContent = t; }

// ---------- el equipo ----------
const EMPTY = {props: [], queue: [], planned: [], running: [], ideas: [], prs: [], estados: {}};
const active = () => REPOS.find(R => (state.repos[R.name] || {}).activo) || null;
function team() {
  const R = active(), d = R ? state.repos[R.name] : EMPTY;
  return Object.keys(ROLES).map(role => {
    const e = d.estados[role], meta = ROLES[role];
    const fresh = e && Date.now() - new Date(e.updated).getTime() < 40 * 60000;
    let s = 'sleep', t;
    if (!R) t = 'Sin proyecto activo. Elige uno arriba.';
    else if (e && e.estado.startsWith('trabaj') && fresh) { s = 'work'; t = e.paso || 'Trabajando'; }
    else if ((role === 'explorador' || role === 'consejero') && !d.dossierN && state.fetchedAt) { s = 'queue'; t = 'Onboarding pendiente: estudiarán el proyecto completo en el próximo turno'; }
    else if (role === 'explorador' && d.props.length) { s = 'wait'; t = `${d.props.length} propuesta(s) esperando tu decisión`; }
    else if (role === 'consejero' && d.queue.length) { s = 'queue'; t = `${d.queue.length} tarea(s) aprobada(s) por planificar`; }
    else if (role === 'consejero' && d.ideas.length) { s = 'wait'; t = `${d.ideas.length} idea(s) en conversación contigo`; }
    else if (role === 'dev' && d.running.length) { s = 'wait'; t = `#${d.running[0].n} a medio camino`; }
    else if (role === 'dev' && d.planned.length) { s = 'queue'; t = `${d.planned.length} tarea(s) planificada(s), las toma en la próxima ronda (${turnos(R.turnos.dev)})`; }
    else if (role === 'revisor' && d.prs.some(p => !p.veredicto)) { s = 'queue'; t = 'PR por revisar'; }
    else if (role === 'revisor' && d.prs.length) { s = 'wait'; t = `${d.prs.length} PR revisado(s), esperando que decidas`; }
    else t = role === 'revisor' ? 'Libre. Entra justo después del Dev' : `Libre. Próximo turno ${turnos(R.turnos[role])}`;
    return {role, ...meta, modelo: role === 'revisor' && R ? R.revisor : meta.modelo, s, t, e, repo: R};
  });
}
const SLABEL = {work: 'Trabajando ahora', wait: 'Esperando tu decisión', queue: 'Tiene trabajo para su próximo turno', sleep: 'Libre'};

// ---------- pintar ----------
const style = () => document.body.dataset.style;
function render() {
  const R = active();
  $('proyecto').innerHTML = R ? `<i style="background:${R.color}"></i>${esc(R.nombre)} <span>▾</span>` : 'Elegir proyecto <span>▾</span>';
  Scene.refresh();
  $('team').innerHTML = `<div class="card"><h2 style="margin-top:0">Equipo${R ? ' · ' + esc(R.short) : ''}</h2>${team().map(a => {
    const act = a.s === 'sleep' && R ? Scene.activity(a.role) : '';
    return `<button class="who" data-role="${a.role}"><span class="dot s-${a.s}"></span><span><b>${a.nombre}</b> · ${a.puesto} <small>${esc(act ? act + '. ' + a.t : a.t)}</small></span></button>`;
  }).join('')}</div>`;
  document.querySelectorAll('[data-setstyle]').forEach(b => b.classList.toggle('on', b.dataset.setstyle === style()));
  const rows = []; let pipe = '', ideas = '';
  for (const Rx of REPOS) {
    const d = state.repos[Rx.name]; if (!d) continue;
    for (const p of d.prs) rows.push({R: Rx, p, tipo: 'pr', tag: p.veredicto ? 'Revisor: ' + p.veredicto.toLowerCase() : 'PR sin revisar aún', cls: 't-pr'});
    for (const p of d.props) rows.push({R: Rx, p, tipo: 'propuesta', tag: 'Propuesta', cls: 't-prop'});
    for (const p of d.ideas) ideas += item(Rx, p, 't-prop', `Idea · ${p.comments} mensaje(s)`);
  }
  const f = filters, n = rows.length;
  const shown = rows.filter(r => (f.repo === 'todos' || r.R.name === f.repo) && (f.tipo === 'todo' || r.tipo === f.tipo) && (f.prio === 'todas' || (f.prio === 'sin' ? !r.p.prio : r.p.prio === f.prio)))
    .sort((x, y) => new Date(x.p.created) - new Date(y.p.created));
  $('fcount').textContent = n ? `${shown.length} de ${n} · más antiguas primero` : '';
  $('inbox').innerHTML = shown.map(r => item(r.R, r.p, r.cls, r.tag)).join('') || (n ? '<p class="empty">Nada con estos filtros.</p>' : '<p class="empty">Nada pendiente. Los agentes no te necesitan ahora.</p>');
  const A = active(), dA = A ? state.repos[A.name] || EMPTY : EMPTY;
  const cols = [['Aprobadas', 'Itachi las planifica', dA.queue, 't-ok'], ['Planificadas', 'Sasuke las implementa', dA.planned, 't-ok'], ['En código', 'Sasuke trabajando', dA.running, 't-run'], ['En revisión', 'Madara revisa', dA.prs.filter(p => !p.veredicto), 't-pr']];
  pipe = A ? `<div class="kanban">${cols.map(([t, sub, list, cls]) => `<div class="col"><h4>${t} <b>${list.length}</b></h4><small>${sub}</small>${list.sort((x, y) => new Date(x.created) - new Date(y.created)).map(i => `<button class="mini" data-open="${A.name}/${i.n}${i.pr ? '/pr' : ''}">#${i.n} ${esc(i.title)}</button>`).join('') || '<p class="empty">—</p>'}</div>`).join('')}</div>` : '';
  $('pipeline').innerHTML = pipe || '<p class="empty">Elige un proyecto activo.</p>';
  $('marcha').innerHTML = A ? enMarcha(A) : '<p class="empty">Elige un proyecto activo.</p>';
  $('ideas').innerHTML = ideas || '<p class="empty">Aún no has traído ideas. Escribe la primera arriba.</p>';
  $('badge').textContent = n || '';
  if (n > lastCount && lastCount >= 0 && store.get('fabrica-sonido', false)) chime();
  lastCount = n;
  const now = new Date();
  $('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}` + (state.fetchedAt ? ` · datos ${ago(new Date(state.fetchedAt).toISOString())}` : '');
  for (const id of ['t-repo', 'i-repo']) if (!$(id).dataset.touched && R) $(id).value = R.name;
}
const FASES = ['Aprobada', 'Plan', 'Código', 'Revisión', 'Fusionar'];
function enMarcha(R) {
  const d = state.repos[R.name] || EMPTY, T = team(), working = T.filter(a => a.s === 'work'), out = [];
  const now = role => { const a = working.find(x => x.role === role); return a ? `${a.nombre} ahora: ${a.e.paso || 'trabajando'}` : ''; };
  const prOf = n => d.prs.find(p => p.issue === n);
  const add = (i, fase, quien, pr) => out.push({i, fase, quien, pr});
  for (const i of d.running) { const p = prOf(i.n); if (!p) add(i, 2, now('dev') || 'Sasuke la está programando'); }
  for (const p of d.prs) add({n: p.issue || p.n, title: p.title, created: p.created}, p.veredicto ? 4 : 3, p.veredicto ? `Madara dice: ${p.veredicto.toLowerCase()}. Te toca decidir.` : (now('revisor') || `Madara la revisa en la próxima ronda (${turnos(R.turnos.dev)})`), p);
  for (const i of d.planned) add(i, 2, `Plan listo. Sasuke la programa en la próxima ronda (${turnos(R.turnos.dev)})`);
  for (const i of d.queue) add(i, 1, now('consejero') && /#\s*${i.n}\b/.test(now('consejero')) ? now('consejero') : `Itachi escribe el plan en la próxima ronda del equipo (${turnos(R.turnos.consejero)})`);
  out.sort((a, b) => b.fase - a.fase || new Date(a.i.created) - new Date(b.i.created));
  const onb = !d.dossierN || working.some(a => /onboarding/i.test((a.e && (a.e.tarea + ' ' + a.e.paso)) || ''));
  const head = onb ? `<div class="item marcha"><span class="tag t-run">Onboarding</span><b>El equipo está estudiando ${esc(R.nombre)}</b><span class="meta">${esc(now('explorador') || now('consejero') || 'Empieza en el próximo turno del equipo')}</span></div>` : '';
  return head + (out.map(o => `<button class="item marcha" data-open="${R.name}/${o.pr ? o.pr.n + '/pr' : o.i.n}"><b>#${o.i.n} ${esc(o.i.title)}</b>
    <span class="fases">${FASES.map((f, k) => `<span class="${k < o.fase ? 'ok' : k === o.fase ? 'now' : ''}">${f}</span>`).join('')}</span>
    <span class="meta">${esc(o.quien)}</span></button>`).join('') || (head ? '' : '<p class="empty">Nada en marcha. Aprueba una propuesta para que el equipo empiece.</p>'));
}
function item(R, i, cls, tag) {
  return `<button class="item" data-open="${R.name}/${i.n}${i.pr ? '/pr' : ''}"><span class="tag ${cls}">${esc(tag)}</span>${i.prio ? `<span class="tag p-${i.prio}">prioridad ${i.prio}</span>` : ''}<b>#${i.n} ${esc(i.title)}</b><span class="meta">${esc(R.nombre)}${(active() || {}).name === R.name ? '' : ' · en pausa'} · creada ${ago(i.created || i.at)}</span>${i.body ? `<span class="meta">${esc(clean(i.body).replace(/[#*`>|_]/g, '').replace(/\s+/g, ' ').slice(0, 180))}…</span>` : ''}<span class="more">Abrir →</span></button>`;
}
function chime() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(880, c.currentTime); o.frequency.setValueAtTime(1320, c.currentTime + .09); g.gain.setValueAtTime(.06, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .25); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .26); } catch (e) {} }

// ---------- hojas (todo se lee dentro de la app) ----------
function sheet(html) { $('sheet-body').innerHTML = html + '<div class="rowbtns"><button data-close>Cerrar</button></div>'; if (!$('sheet').open) $('sheet').showModal(); $('sheet-body').scrollTop = 0; }
function openAgent(role) {
  const R = active(), a = team().find(x => x.role === role), e = a.e;
  const log = e && e.log.length ? `<ul class="log">${e.log.map(l => `<li>${inline(esc(l))}</li>`).join('')}</ul>` : '<p class="empty">Todavía no ha publicado pasos de trabajo. Aparecerán aquí en su próximo turno.</p>';
  sheet(`
    <h3>${a.nombre} <small style="display:inline">· ${a.puesto}</small></h3>
    <p style="margin:6px 0 10px">${a.hace}</p>
    <span class="state s-${a.s}">${SLABEL[a.s]}</span>
    <dl class="kv">
      <dt>Ahora</dt><dd>${esc(a.s === 'sleep' && R ? (Scene.activity(role) || 'En pausa') + '. ' + a.t : a.t)}</dd>
      ${R ? `<dt>Proyecto</dt><dd>${esc(R.short)}</dd>` : ''}
      ${e && e.tarea && e.tarea !== '—' ? `<dt>Tarea</dt><dd>${esc(e.tarea)}</dd>` : ''}
      ${a.s === 'work' && e && e.accion ? `<dt>Acción</dt><dd>${esc(e.accion)}</dd>` : ''}
      <dt>Modelo</dt><dd>${a.modelo}</dd>
      ${R ? `<dt>Turno (tu hora)</dt><dd>${role === 'revisor' ? 'Justo después del Dev' : turnos(R.turnos[role])}</dd>` : ''}
      ${e ? `<dt>Última señal</dt><dd>${ago(e.updated)}</dd>` : ''}
    </dl>
    <h2>Cómo lo está haciendo</h2>${log}
    ${R ? `<div class="rowbtns"><a class="btn primary" href="https://claude.ai/code/${R.session}" target="_blank" rel="noopener">Hablar en vivo</a><button data-open="${R.name}/${state.repos[R.name].bitN}/bitacora">Bitácora</button></div>
    <small>«Hablar en vivo» abre la conversación del equipo en la app de Claude: pregúntale en qué está o pídele cambios al instante.</small>` : ''}`);
}
async function openItem(repo, n, kind) {
  const R = REPOS.find(r => r.name === repo); sheet('<p class="empty">Cargando…</p>');
  try {
    if (kind === 'bitacora') {
      const cs = (await gh(`${repo}/issues/${n}/comments?per_page=100`)).filter(c => isMine(c) && !/fabrica-estado:/.test(c.body || '')).slice(-15).reverse();
      return sheet(`<h3>Bitácora · ${esc(R.short)}</h3><p class="small">Resumen y lección de cada turno, lo más reciente primero.</p>${cs.map(c => `<div class="msg bot"><b>${esc(author(c).who)} · ${ago(c.created_at)}</b><div class="md">${md(c.body)}</div></div>`).join('') || '<p class="empty">Aún sin turnos registrados.</p>'}`);
    }
    const [it, cs] = await Promise.all([gh(`${repo}/issues/${n}`), gh(`${repo}/issues/${n}/comments?per_page=100`)]);
    const pr = kind === 'pr', d = state.repos[repo] || EMPTY, isIdea = has(it, 'idea'), isProp = has(it, 'propuesta') && !has(it, 'aprobada'), isActive = (active() || {}).name === repo;
    let files = '';
    if (pr) {
      const fs = await gh(`${repo}/pulls/${n}/files?per_page=100`); let budget = 500;
      files = `<h2>Cambios (${fs.length} archivo${fs.length === 1 ? '' : 's'})</h2>` + fs.map(f => {
        const lines = (f.patch || '(sin vista previa)').split('\n'), shownL = lines.slice(0, Math.max(0, budget)); budget -= shownL.length;
        return `<details class="diff"><summary><code>${esc(f.filename)}</code> <span class="add">+${f.additions}</span> <span class="del">−${f.deletions}</span></summary><pre>${shownL.map(l => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : l.startsWith('@@') ? 'hunk' : ''}">${esc(l)}</span>`).join('\n')}${lines.length > shownL.length ? '\n…' : ''}</pre></details>`;
      }).join('');
    }
    const who = isIdea || isProp || has(it, 'aprobada') ? 'Itachi (Consejero)' : 'el equipo';
    const thread = cs.map(c => { const a = author(c); return `<div class="msg ${a.cls}"><b>${esc(a.who)} · ${ago(c.created_at)}</b><div class="md">${md(c.body)}</div></div>`; }).join('');
    const p = d.prs.find(x => x.n === +n);
    const acts = pr
      ? `<button class="primary" data-act="fusionar" data-repo="${repo}" data-n="${n}">${R.despliega ? 'Fusionar y desplegar' : 'Fusionar'}</button>`
      : isProp ? `<button class="primary" data-act="aprobar" data-repo="${repo}" data-n="${n}">Aprobar</button><button class="danger" data-act="rechazar" data-repo="${repo}" data-n="${n}">Rechazar</button>`
      : isIdea ? `<button class="danger" data-act="cerrar" data-repo="${repo}" data-n="${n}">Cerrar idea</button>` : '';
    sheet(`
      <p class="small">${esc(R.short)} · #${n} · creada ${ago(it.created_at)}${isActive ? '' : ' · <b>proyecto en pausa</b>'}${p && p.veredicto ? ` · Revisor: <b>${esc(p.veredicto.toLowerCase())}</b>` : ''}</p>
      <h3>${esc(it.title)}</h3>

      <div class="md card">${md(it.body)}</div>
      ${files}
      <h2>Conversación</h2>${thread || '<p class="empty">Aún nadie ha comentado.</p>'}
      <form data-reply="${repo}/${n}" class="card">
        <label for="reply">Tu mensaje ${pr ? 'sobre este cambio' : 'para ' + who}</label><textarea id="reply" required placeholder="${isProp ? 'Pregunta, cuestiona o pide cambios a la propuesta…' : 'Escribe aquí…'}"></textarea>
        <button class="primary" type="submit">Enviar</button>
        <small>${isActive ? `Lo responde ${who} en su próximo turno (${turnos(R.turnos.consejero)}, tu hora). Para algo inmediato usa «Hablar en vivo» desde la ficha de un agente.` : 'Este proyecto está en pausa: el equipo lo verá cuando lo actives.'}</small>
      </form>
      ${acts ? `<div class="rowbtns sticky">${acts}</div>` : ''}`);
  } catch (e) { sheet(`<p class="empty">${esc(e.message)}</p>`); }
}
function openProjects() {
  const cur = active();
  sheet(`<h3>Proyectos</h3><p>El equipo trabaja en un solo proyecto a la vez. Al cambiar, el otro queda en pausa desde su próximo turno; lo que estaba a medio camino se retoma cuando vuelvas.</p>
    ${REPOS.map(R => { const d = state.repos[R.name] || EMPTY, pend = d.props.length + d.prs.length + d.queue.length + d.planned.length + d.ideas.length, on = R.name === (cur || {}).name;
      return `<div class="item"><span class="tag" style="color:${R.color}">${on ? 'activo' : 'en pausa'}</span><b>${esc(R.nombre)}</b><span class="meta">${esc(R.name)} · ${pend} pendiente(s) · ${d.dossierN ? 'el equipo ya lo conoce' : 'onboarding pendiente'} · turnos ${R.despierto ? 'encendidos' : 'apagados'}</span><div class="acts">${on ? '' : `<button class="primary" data-act="activar" data-repo="${R.name}">Trabajar en este</button>`}${d.dossierN ? `<button data-open="${R.name}/${d.dossierN}">Qué saben de él</button>` : ''}</div></div>`; }).join('')}
    ${PENDIENTES.map(P => `<div class="item"><span class="tag t-prop">por conectar</span><b>${esc(P.nombre)}</b><span class="meta">${esc(P.name)}</span><div class="acts"><a class="btn primary" href="https://claude.ai/code/${REG.sede}" target="_blank" rel="noopener">Pedir a la Sede que lo conecte</a></div><small>Escríbele: «Conecta el proyecto ${esc(P.nombre)}». Dar acceso de escritura a un repo nuevo lo aprueba siempre una persona.</small></div>`).join('')}
    <h2>Agregar proyecto</h2>
    <form id="addproj" class="card">
      <label for="np-url">Link del repo en GitHub</label><input id="np-url" required placeholder="https://github.com/gonzalolavin99/mi-app" inputmode="url" autocomplete="off">
      <label for="np-nombre">Nombre para identificarlo</label><input id="np-nombre" required maxlength="40" placeholder="Ej: Portafolio">
      <label>Color</label><div class="paleta">${PALETA.map((c, i) => `<label><input type="radio" name="np-color" value="${c}" ${i === (REPOS.length + PENDIENTES.length) % PALETA.length ? 'checked' : ''}><i style="background:${c}"></i></label>`).join('')}</div>
      <button class="primary" type="submit">Agregar</button>
      <small>Queda «por conectar» hasta que la Sede lo conecta: le crea su manual y sus turnos. Después, la primera vez que lo actives, el equipo lo estudia completo (onboarding) antes de proponer nada.</small>
    </form>`);
}
async function addProject(url, nombre, color) {
  const m = url.trim().match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[\/?#].*)?$/i);
  if (!m) throw new Error('Ese link no parece un repo de GitHub.');
  if (m[1].toLowerCase() !== OWNER) throw new Error('Por ahora solo se pueden agregar repos de tu cuenta (' + OWNER + ').');
  const repo = m[2];
  if (REPOS.concat(PENDIENTES).some(r => r.name === repo)) throw new Error('Ese repo ya está en la fábrica.');
  await gh(repo);
  const f = await gh('fabrica-oficina/contents/proyectos.json');
  const reg = JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\n/g, '')))));
  reg.proyectos.push({repo, nombre: nombre.trim(), color, estado: 'pendiente', revisor: 'Opus', despliega: false});
  const body = JSON.stringify(reg, null, 2) + '\n';
  await gh('fabrica-oficina/contents/proyectos.json', {method: 'PUT', body: {message: `Agregar proyecto ${nombre.trim()} (por conectar)`, content: btoa(unescape(encodeURIComponent(body))), sha: f.sha}});
  applyRegistry(reg); store.set('fabrica-registro', reg);
}
function openSettings() {
  sheet(`
    <h3>Ajustes</h3>
    <p>${token ? '✅ Llave activa en este dispositivo: puedes aprobar, rechazar, conversar, crear tareas, cambiar de proyecto y fusionar desde aquí.' : 'Sin llave puedes mirar, pero no actuar. Ábrela con tu enlace personal o pégala aquí.'}</p>
    <form id="tokform">
      <label for="tok">Llave personal de GitHub</label>
      <input id="tok" type="password" autocomplete="off" value="${esc(token)}" placeholder="github_pat_…">
      <button class="primary" type="submit">Guardar en este dispositivo</button>
    </form>
    <small>Permisos en «Read and write»: Issues, Pull requests y Contents, sobre tus proyectos y sobre <b>fabrica-oficina</b> (ahí se guarda la lista de proyectos). Si la llave es por repos seleccionados, agrega cada proyecto nuevo a la llave. Se guarda solo en este navegador; bórrala dejando el campo vacío.</small>
    <label class="check"><input id="sonido" type="checkbox" ${store.get('fabrica-sonido', false) ? 'checked' : ''}> Sonar cuando llegue algo nuevo a la bandeja</label>`);
}

// ---------- acciones (siempre dentro de la app) ----------
function needToken() { if (token) return false; notice('Para hacer eso desde aquí activa tu llave (⚙).'); openSettings(); return true; }
async function act(fn, okMsg) { try { await fn(); notice(okMsg); await load(); return true; } catch (e) { notice(e.message); alert(e.message); return false; } }
async function setActive(repo) {
  for (const R of REPOS) {
    const d = state.repos[R.name]; if (!d || !d.manualN) continue;
    if (R.name === repo) await gh(`${R.name}/issues/${d.manualN}/labels`, {method: 'POST', body: {labels: ['fabrica:activo']}});
    else if (d.activo) await gh(`${R.name}/issues/${d.manualN}/labels/${encodeURIComponent('fabrica:activo')}`, {method: 'DELETE', ok404: true});
  }
  Scene.projectChanged();
}
async function newIssue(repo, title, body, labels) {
  if (needToken()) return false;
  return act(() => gh(`${repo}/issues`, {method: 'POST', body: {title, body, labels}}), 'Enviado.');
}

document.addEventListener('click', async e => {
  const ag = e.target.closest('.who'); if (ag) return openAgent(ag.dataset.role);
  if (e.target.id === 'scene') { const role = Scene.pick(e.clientX, e.clientY); if (role) openAgent(role); return; }
  const op = e.target.closest('[data-open]'); if (op) { const [repo, n, kind] = op.dataset.open.split('/'); return openItem(repo, n, kind); }
  if (e.target.closest('[data-close]') || e.target === $('sheet')) return $('sheet').close();
  if (e.target.closest('#proyecto')) return openProjects();
  const st = e.target.closest('[data-setstyle]'); if (st) { document.body.dataset.style = st.dataset.setstyle; store.set('fabrica-style', st.dataset.setstyle); Scene.setTheme(st.dataset.setstyle); return render(); }
  const tb = e.target.closest('[data-tab]');
  if (tb) { document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tb.dataset.tab; }); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === tb)); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const {act: a, repo, n} = b.dataset, R = REPOS.find(r => r.name === repo);
  if (needToken()) return;
  if (a === 'activar' && confirm(`¿Poner al equipo a trabajar en ${R.short}? El proyecto actual queda en pausa.`)) { if (await act(() => setActive(repo), `El equipo trabaja ahora en ${R.nombre}.`)) { if (!R.despierto) sheet(`<h3>Último paso: despertar al equipo en ${esc(R.nombre)}</h3><p>Para no gastar tu cuota, los turnos de los proyectos en pausa están apagados. Pídele a la Sede que los encienda:</p><div class="card"><b>«Cambié el proyecto activo a ${esc(R.nombre)}: enciende sus turnos y apaga los del anterior.»</b></div><div class="rowbtns"><a class="btn primary" href="https://claude.ai/code/${REG.sede}" target="_blank" rel="noopener">Abrir la Sede</a></div>`); else $('sheet').close(); } }
  if (a === 'fusionar' && confirm(`¿Fusionar el PR #${n}?` + (R.despliega ? ' Esto lo despliega a producción.' : ''))) { if (await act(() => gh(`${repo}/pulls/${n}/merge`, {method: 'PUT', body: {merge_method: 'squash'}}), `PR #${n} fusionado${R.despliega ? ': Vercel lo está desplegando' : ''}.`)) $('sheet').close(); }
  if (a === 'aprobar') { if (await act(() => gh(`${repo}/issues/${n}/labels`, {method: 'POST', body: {labels: ['fabrica:aprobada']}}), `#${n} aprobada. El equipo la toma en su próximo turno Dev.`)) $('sheet').close(); }
  if (a === 'rechazar' && confirm(`¿Rechazar y cerrar la propuesta #${n}?`)) { if (await act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed', state_reason: 'not_planned'}}), `#${n} rechazada. No la volverán a proponer.`)) $('sheet').close(); }
  if (a === 'cerrar' && confirm(`¿Cerrar la idea #${n}?`)) { if (await act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed'}}), `Idea #${n} cerrada.`)) $('sheet').close(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.filter; if (k) { filters[k] = e.target.value; store.set('fabrica-filtros', filters); render(); }
  if (e.target.id === 'sonido') store.set('fabrica-sonido', e.target.checked);
  if (e.target.id === 't-repo' || e.target.id === 'i-repo') e.target.dataset.touched = '1';
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'addproj') { if (needToken()) return; try { await addProject($('np-url').value, $('np-nombre').value, (f.querySelector('input[name=np-color]:checked') || {}).value || PALETA[0]); notice('Proyecto agregado. Ahora pídele a la Sede que lo conecte.'); openProjects(); } catch (err) { alert(err.message); } return; }
  if (f.id === 'tokform') { token = $('tok').value.trim(); store.set('fabrica-token', token); $('sheet').close(); notice(token ? 'Llave guardada.' : 'Llave borrada.'); return load(); }
  if (f.id === 'task') { if (await newIssue($('t-repo').value, $('t-title').value.trim(), ($('t-body').value.trim() || '(sin detalle)') + '\n\n— Tarea directa de Gonzalo desde la oficina.', ['fabrica:aprobada'])) f.reset(); return; }
  if (f.id === 'idea') { if (await newIssue($('i-repo').value, $('i-title').value.trim(), ($('i-body').value.trim() || '(sin detalle)') + '\n\n— Idea de Gonzalo para el Consejero.', ['fabrica:idea'])) f.reset(); return; }
  if (f.dataset.reply) {
    const [repo, n] = f.dataset.reply.split('/'), txt = f.querySelector('textarea').value.trim(); if (!txt || needToken()) return;
    if (await act(() => gh(`${repo}/issues/${n}/comments`, {method: 'POST', body: {body: txt}}), 'Mensaje enviado.')) openItem(repo, n, f.closest('#sheet-body').innerHTML.includes('Cambios (') ? 'pr' : '');
  }
});
$('refresh').addEventListener('click', load);
$('settings').addEventListener('click', openSettings);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.fetchedAt > 60000) load(); });

document.body.dataset.style = store.get('fabrica-style', 'pixel') === 'pixel' ? 'pixel' : 'oscuro';
function fillSelects() {
  for (const id of ['t-repo', 'i-repo']) { const v = $(id).value; $(id).innerHTML = REPOS.map(R => `<option value="${R.name}">${esc(R.nombre)}</option>`).join(''); if (v) $(id).value = v; }
  $('f-repo').innerHTML = '<option value="todos">Todos los proyectos</option>' + REPOS.map(R => `<option value="${R.name}">${esc(R.nombre)}</option>`).join('');
  for (const k of ['repo', 'tipo', 'prio']) $('f-' + k).value = filters[k];
}
fillSelects();
Scene.init($('scene'), {getState: () => [team().map(a => ({role: a.role, s: a.s, accion: a.e && a.e.accion, paso: a.e && a.e.paso}))], roles: ROLES, isDay, project: () => { const R = active(); return R ? {name: R.short, color: R.color} : {name: 'SIN PROYECTO', color: '#777'}; }});
Scene.setTheme(style());
render(); setInterval(render, 20000);
load();
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
