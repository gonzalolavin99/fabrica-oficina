'use strict';
const OWNER = 'gonzalolavin99';
// Proyectos: viven en proyectos.json (este repo). El equipo trabaja en uno a la vez: el que tiene fabrica:activo en su manual.
const PALETA = ['#c0503a', '#3aa0a8', '#d4a017', '#7b5cd6', '#2f9e5b', '#d6457a', '#4a7fd4', '#9c6b3a'];
const TURNOS_BASE = {explorador: ['04:43'], consejero: ['10:22', '15:22', '20:22'], dev: ['22:17'], seguridad: ['dom 02:12']};
let REG = null, REPOS = [], PENDIENTES = [];
function applyRegistry(reg) {
  REG = reg;
  const map = p => ({name: p.repo, short: p.nombre.toUpperCase(), nombre: p.nombre, color: p.color, revisor: p.revisor || 'Opus', despliega: !!p.despliega, session: p.session, turnos: p.turnos || TURNOS_BASE, despierto: p.turnos_encendidos !== false, ronda: p.ronda_min, instantaneo: !!p.instantaneo});
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
  if (!isMine(c) && !(c.user.login === 'github-actions[bot]' && /^\s*🤖/.test(c.body || ''))) return {who: 'Cuenta externa @' + c.user.login + ' · los agentes la ignoran', cls: 'ext'};
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
  if (loading) return; loading = true; $('refresh').classList.add('girando');
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
      const slim = i => ({n: i.number, title: i.title, created: i.created_at, at: i.updated_at, prio: prioOf(i), comments: i.comments, body: (i.body || '').slice(0, 2500), ultimo: i._ultimo || null});
      let porResponder = 0;
      for (const i of fab.filter(i => has(i, 'idea') || ((has(i, 'propuesta') || has(i, 'aprobada')) && !has(i, 'en-curso')))) {
        if (!i.comments) { if (has(i, 'idea')) { porResponder++; i._ultimo = 'tu'; } continue; }
        if (!token) continue;
        const cs = await gh(`${R.name}/issues/${i.number}/comments?per_page=100`), last = cs[cs.length - 1];
        if (last && isMine(last) && !isAgent(last)) { porResponder++; i._ultimo = 'tu'; } else if (last) i._ultimo = 'equipo';
      }
      state.repos[R.name] = {
        porResponder,
        activo: !!(man && has(man, 'activo')), manualN: man ? man.number : null, bitN: bit ? bit.number : null, dossierN: dos ? dos.number : null,
        props: fab.filter(i => has(i, 'propuesta') && !has(i, 'aprobada')).map(slim),
        queue: fab.filter(i => has(i, 'aprobada') && !has(i, 'planificada') && !has(i, 'en-curso')).map(slim),
        planned: fab.filter(i => has(i, 'planificada') && !has(i, 'en-curso')).map(slim),
        planificando: fab.filter(i => has(i, 'planificando')).map(slim),
        running: fab.filter(i => has(i, 'en-curso')).map(slim),
        ideas: fab.filter(i => has(i, 'idea')).map(slim),
        prs, estados,
      };
    }
    state.fetchedAt = Date.now(); store.set('fabrica3', state); notice('');
  } catch (e) {
    notice(e.message + (state.fetchedAt ? ' Mostrando datos de ' + ago(new Date(state.fetchedAt).toISOString()) + '.' : ''));
  }
  loading = false; $('refresh').classList.remove('girando'); fillSelects(); render(); schedule();
}
let timer;
function schedule() {
  clearTimeout(timer);
  const busy = team().some(a => a.s === 'work');
  timer = setTimeout(() => { if (!document.hidden) load(); else schedule(); }, token ? (busy ? 45e3 : 180e3) : 600e3);
}
function notice(t) { $('notice').textContent = t; }

// ---------- el equipo ----------
const EMPTY = {props: [], queue: [], planned: [], planificando: [], running: [], ideas: [], prs: [], estados: {}};
const active = () => REPOS.find(R => (state.repos[R.name] || {}).activo) || null;
const dOf = R => (R && state.repos[R.name]) || EMPTY;
const sinPaso = t => String(t || '').replace(/^\s*\d+\s*\/\s*\d+\s*·\s*/, '').trim();
const sinHora = t => String(t || '').replace(/^\s*\d{1,2}:\d\d\s*(\([^)]*\))?\s*/, '').trim();
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
function proximaRonda(R) {
  if (!R || R.ronda == null) return R ? turnos(R.turnos.consejero) : '';
  const d = new Date(); if (d.getUTCMinutes() >= R.ronda) d.setUTCHours(d.getUTCHours() + 1); d.setUTCMinutes(R.ronda, 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// s: work (Trabajando) · soon (Pronto) · you (Tú) · free (Libre)
function team() {
  const R = active(), d0 = dOf(R), fifo = l => [...l].sort((a, b) => new Date(a.created) - new Date(b.created));
  const d = {...d0, props: fifo(d0.props), queue: fifo(d0.queue), planned: fifo(d0.planned)};
  return Object.keys(ROLES).map(role => {
    const e = d.estados[role], meta = ROLES[role];
    const fresh = e && Date.now() - new Date(e.updated).getTime() < 40 * 60000;
    let s = 'free', big = '', sub = '', next = '';
    const ronda = R ? `a las ${proximaRonda(R)}` : '';
    if (!R) { big = 'Sin proyecto'; sub = 'Elige un proyecto arriba'; }
    else if (e && e.estado.startsWith('trabaj') && fresh) { s = 'work'; big = cap(sinPaso(e.paso)) || 'Trabajando'; sub = e.tarea && e.tarea !== '—' ? e.tarea : ''; }
    else if ((role === 'explorador' || role === 'consejero') && !d.dossierN && state.fetchedAt) { s = 'soon'; big = 'Va a estudiar el proyecto'; sub = 'Onboarding en la próxima ronda'; }
    else if (role === 'consejero' && d.planificando.length) { s = 'work'; big = 'Escribiendo un plan'; sub = d.planificando[0].title; }
    else if (role === 'consejero' && d.porResponder) { s = 'soon'; big = 'Va a responder tu mensaje'; sub = ronda; }
    else if (role === 'consejero' && d.queue.length) { s = 'soon'; big = 'Va a planificar una tarea'; sub = `${titulo(d.queue[0].title).t} · ${ronda}`; }
    else if (role === 'explorador' && d.props.length) { s = 'you'; big = `${d.props.length} propuesta${d.props.length > 1 ? 's esperan' : ' espera'} tu decisión`; sub = 'En Inicio'; }
    else if (role === 'dev' && d.running.length) { s = 'work'; big = 'Programando'; sub = d.running[0].title; }
    else if (role === 'dev' && d.planned.length) { s = 'soon'; big = 'Va a programar'; sub = `${titulo(d.planned[0].title).t} · ${ronda}`; }
    else if (role === 'revisor' && d.prs.some(p => !p.veredicto)) { s = 'soon'; big = 'Va a revisar un cambio'; sub = ronda; }
    else if (role === 'revisor' && d.prs.length) { s = 'you'; big = 'Revisó: te toca fusionar'; sub = 'En Inicio'; }
    else { big = 'Libre'; sub = Scene.activity(role) || (role === 'explorador' ? `Explora a las ${turnos(R.turnos.explorador)}` : role === 'seguridad' ? 'Audita los domingos' : 'Entra cuando llegue trabajo'); }
    if (role === 'explorador') next = R ? `Explorar el proyecto a las ${turnos(R.turnos.explorador)}` : '';
    if (role === 'consejero') next = d.queue[0] ? `Planificar «${titulo(d.queue[0].title).t}»` : d.props[0] ? `Planificar «${titulo(d.props[0].title).t}» cuando lo apruebes` : 'Responder tus ideas al instante';
    if (role === 'dev') next = d.planned[0] ? `Programar «${titulo(d.planned[0].title).t}»` : 'Programar lo que Itachi planifique';
    if (role === 'revisor') next = 'Revisar cada cambio apenas Sasuke abre el PR';
    if (role === 'seguridad') next = 'Auditoría del domingo';
    const util = e ? e.log.map(sinHora).filter(l => !/worktree|copia de trabajo|^borr|eliminad|quedo libre|resumen del turno|^inicio|^tom[eé] /i.test(l)) : [];
    const last = util.length ? util[util.length - 1] : (e && e.log.length ? sinHora(e.log[e.log.length - 1]) : '');
    return {role, ...meta, modelo: role === 'revisor' && R ? R.revisor : meta.modelo, s, big, sub, next, last, e, repo: R};
  });
}
const PILL = {work: ['Trabajando', 'p-work'], soon: ['Pronto', 'p-soon'], you: ['Tú', 'p-you'], free: ['Libre', 'p-free']};
const pill = s => `<span class="pill ${PILL[s][1]}">${PILL[s][0]}</span>`;
const av = (role, size = '') => `<span class="av ${size}" style="background:${ROLES[role].shirt}">${ROLES[role].nombre[0]}</span>`;

// ---------- resúmenes cortos ----------
function titulo(t) { const m = String(t).match(/^\s*(Paso\s+[\d.]+)\s*·\s*(.*)$/i); return m ? {paso: m[1], t: m[2]} : {paso: '', t: String(t)}; }
function plano(txt) {
  return String(txt || '').replace(/\(\s*`[^`]*`[^)]*\)/g, '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}
function corta(txt, n = 140) { const t = plano(txt); if (t.length <= n) return t; const cut = t.slice(0, n); const dot = cut.lastIndexOf('. '); return (dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s\S*$/, '') + '…'); }
function enCorto(body) {
  const b = clean(body), out = {};
  const sec = b.match(/#+\s*En corto\s*\n([\s\S]*?)(?:\n#+\s|$)/i);
  const src = sec ? sec[1] : b;
  const g = re => { const m = src.match(re); return m ? plano(m[1]) : ''; };
  out.ve = g(/\*\*\s*Qu[eé] ver[aá]s\s*:?\s*\*\*:?\s*(.+)/i); out.por = g(/\*\*\s*Por qu[eé][^*]*:?\s*\*\*:?\s*(.+)/i); out.prueba = g(/\*\*\s*C[oó]mo probarlo\s*:?\s*\*\*:?\s*(.+)/i);
  out.resumen = g(/\*\*\s*Resumen\s*:?\s*\*\*:?\s*(.+)/i);
  if (!out.resumen) {
    const sec2 = b.replace(/^>.*$/gm, '').match(/#+\s*(?:Problema|Objetivo)[^\n]*\n+([^\n#|>-][^\n]*)/i);
    const para = (sec2 && sec2[1]) || b.split('\n').find(l => l.trim() && !/^\s*([#>|-]|\d+[.)]|\*\*[^*]+\*\*\s*$)/.test(l)) || '';
    out.resumen = corta(out.ve || para, 150);
  }
  return out;
}
function primerParrafo(body) { const b = clean(body); const p = b.split(/\n\s*\n/).find(x => x.trim() && !/^\s*#/.test(x)) || b; return p.trim(); }

// ---------- pintar ----------
const style = () => document.body.dataset.style;
function render() {
  const R = active(), d = dOf(R);
  $('proyecto').innerHTML = R ? `<i style="background:${R.color}"></i>${esc(R.nombre)} <span>▾</span>` : 'Elegir proyecto <span>▾</span>';
  Scene.refresh();
  const T = team();
  // Inicio: decisiones
  const rows = [];
  for (const Rx of REPOS) {
    const dx = state.repos[Rx.name]; if (!dx) continue;
    for (const p of dx.prs) if (p.veredicto) rows.push({R: Rx, p, tipo: 'pr'});
    for (const p of dx.props) rows.push({R: Rx, p, tipo: 'prop'});
    for (const p of dx.ideas) if (p.ultimo === 'equipo') rows.push({R: Rx, p, tipo: 'idea'});
  }
  const f = filters.tipo || 'todo';
  const shown = rows.filter(r => f === 'todo' || r.tipo === f).sort((x, y) => new Date(x.p.created) - new Date(y.p.created));
  const work = T.filter(a => a.s === 'work');
  const enMarcha = R ? d.running.length + d.planned.length + d.queue.length + d.prs.filter(p => !p.veredicto).length + d.planificando.length : 0;
  $('resumen').innerHTML = `<div><b>${rows.length}</b><span>para decidir</span></div><div><b>${enMarcha}</b><span>en marcha</span></div><div><b class="${work.length ? 'c-work' : 'c-free'}">●</b><span>${work.length ? work.length + ' trabajando' : 'equipo libre'}</span></div>`;
  $('filtros').innerHTML = [['todo', 'Todo'], ['prop', 'Propuestas'], ['pr', 'Para fusionar'], ['idea', 'Ideas']].map(([k, t]) => `<button class="chipb ${f === k ? 'on' : ''}" data-filtro="${k}">${t}</button>`).join('');
  $('inbox').innerHTML = shown.map(card).join('') || `<div class="vacio">${rows.length ? 'Nada con este filtro.' : '✓ Nada pendiente. El equipo no te necesita ahora.'}</div>`;
  $('marcha').innerHTML = R ? enMarchaHTML(R, T) : '<div class="vacio">Elige un proyecto arriba.</div>';
  // Oficina
  $('team').innerHTML = T.map(a => `<button class="row" data-role="${a.role}">${av(a.role)}<span class="x"><b>${a.nombre}</b><span>${esc(a.s === 'free' ? a.sub : a.big + (a.sub && a.s !== 'you' ? ' · ' + a.sub : ''))}</span></span>${pill(a.s)}</button>`).join('');
  // Ideas
  $('ideas').innerHTML = REPOS.flatMap(Rx => (dOf(Rx).ideas || []).map(p => ({Rx, p}))).sort((a, b) => new Date(b.p.at) - new Date(a.p.at)).map(({Rx, p}) =>
    `<button class="card tap" data-chat="${Rx.name}/${p.n}"><div class="tags">${p.ultimo === 'equipo' ? '<span class="tag t-ok">Itachi respondió</span>' : p.ultimo === 'tu' ? '<span class="tag">Esperando a Itachi</span>' : ''}${Rx.name !== (R || {}).name ? `<span class="tag">${esc(Rx.nombre)}</span>` : ''}</div><div class="t">${esc(p.title)}</div><div class="s">${esc(corta(enCorto(p.body).resumen || p.body, 110))}</div></button>`).join('') || '<div class="vacio">Aún no hay ideas. Escribe la primera arriba.</div>';
  $('badge').textContent = rows.length || '';
  if (rows.length > lastCount && lastCount >= 0 && store.get('fabrica-sonido', false)) chime();
  lastCount = rows.length;
  for (const id of ['t-repo', 'i-repo']) if (!$(id).dataset.touched && R) $(id).value = R.name;
}
function card({R, p, tipo}) {
  const ti = titulo(p.title), ec = enCorto(p.body || ''), otro = R.name !== (active() || {}).name;
  const tags = [];
  if (p.prio) tags.push(`<span class="tag ${p.prio}">${p.prio.toUpperCase()}</span>`);
  tags.push(`<span class="tag">${tipo === 'pr' ? 'Para fusionar' : tipo === 'idea' ? 'Idea' : 'Propuesta'}${ti.paso ? ' · ' + ti.paso : ''}</span>`);
  if (p.ultimo === 'equipo' && tipo !== 'pr') tags.push('<span class="tag t-warn">Itachi te escribió</span>');
  if (tipo === 'pr' && p.veredicto) tags.push(`<span class="tag ${/LISTO/.test(p.veredicto) ? 't-ok' : /NO /.test(p.veredicto) ? 'alta' : 't-warn'}">Madara: ${esc(p.veredicto.toLowerCase())}</span>`);
  if (otro) tags.push(`<span class="tag">${esc(R.nombre)}</span>`);
  const btns = tipo === 'pr'
    ? `<button class="b p" data-act="fusionar" data-repo="${R.name}" data-n="${p.n}">Fusionar</button><button class="b" data-open="${R.name}/${p.n}/pr">Ver</button>`
    : tipo === 'idea' ? `<button class="b p" data-chat="${R.name}/${p.n}">Responder</button>`
    : `<button class="b p" data-act="aprobar" data-repo="${R.name}" data-n="${p.n}">Aprobar</button><button class="b" data-open="${R.name}/${p.n}">Ver</button><button class="b g" data-act="rechazar" data-repo="${R.name}" data-n="${p.n}" aria-label="Rechazar">✕</button>`;
  return `<div class="card"><div class="tags">${tags.join('')}</div><div class="t tap" data-open="${R.name}/${p.n}${tipo === 'pr' ? '/pr' : ''}">${esc(ti.t)}</div>${ec.resumen ? `<div class="s">${esc(ec.resumen)}</div>` : ''}<div class="btns">${btns}</div></div>`;
}
const FASES = ['Aprobada', 'Plan', 'Código', 'Revisión', 'Tuya'];
const pasos = f => `<div class="steps">${FASES.map((_, k) => `<i class="${k < f ? 'ok' : k === f ? 'now' : ''}"></i>`).join('')}</div><div class="stepl">${FASES.map((x, k) => `<span class="${k === f ? 'now' : ''}">${x}</span>`).join('')}</div>`;
function fases(R) {
  const d = dOf(R), out = [], prOf = n => d.prs.find(p => p.issue === n), ronda = proximaRonda(R);
  for (const i of d.running) if (!prOf(i.n)) out.push({i, f: 2, q: 'Sasuke programando'});
  for (const p of d.prs) out.push({i: {n: p.issue || p.n, title: p.title, created: p.created}, f: p.veredicto ? 4 : 3, q: p.veredicto ? 'Te toca fusionar' : `Madara revisa · ${ronda}`, pr: p});
  for (const i of d.planned) out.push({i, f: 2, q: `Sasuke programa · ${ronda}`});
  for (const i of d.planificando) out.push({i, f: 1, q: 'Itachi escribe el plan ahora'});
  for (const i of d.queue) if (!d.planificando.some(x => x.n === i.n)) out.push({i, f: 1, q: `Itachi planifica · ${ronda}`});
  return out.sort((a, b) => b.f - a.f || new Date(a.i.created) - new Date(b.i.created));
}
function enMarchaHTML(R, T) {
  const d = dOf(R), list = fases(R).filter(o => o.f < 4);
  const onb = !d.dossierN ? `<div class="card"><div class="t">Estudiando ${esc(R.nombre)}</div><div class="s">Onboarding: el equipo lee el proyecto completo antes de proponer.</div></div>` : '';
  return onb + (list.map(o => `<button class="card tap" data-open="${R.name}/${o.pr ? o.pr.n + '/pr' : o.i.n}"><div class="t">${esc(titulo(o.i.title).t)}</div>${pasos(o.f)}<div class="s">${esc(o.q)}</div></button>`).join('') || (onb ? '' : '<div class="vacio">Nada en marcha. Aprueba una propuesta y el equipo arranca.</div>'));
}
function chime() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(880, c.currentTime); o.frequency.setValueAtTime(1320, c.currentTime + .09); g.gain.setValueAtTime(.06, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .25); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .26); } catch (e) {} }

// ---------- vistas (pantalla completa en el celu) ----------
let backFn = null;
function view({title = '', back = null, right = '', body = '', foot = ''}) {
  backFn = back;
  $('sheet-body').innerHTML = `<div class="v-top"><button class="v-back" data-back>${back ? '‹ Volver' : '✕ Cerrar'}</button><b class="v-title">${title}</b>${right}</div><div class="v-body">${body}</div>${foot ? `<div class="v-foot">${foot}</div>` : ''}`;
  if (!$('sheet').open) $('sheet').showModal();
  const vb = $('sheet-body').querySelector('.v-body'); if (vb) vb.scrollTop = 0;
}
const cargando = () => view({body: '<div class="spin-wrap"><i class="spin"></i> Cargando…</div>'});
const acordeon = (icono, titulo, html, abierto = false) => `<details class="acc" ${abierto ? 'open' : ''}><summary><span>${icono} ${titulo}</span><span class="chev">›</span></summary><div class="acc-in md">${html}</div></details>`;

const cache = {};
async function datos(repo, n, pr) {
  const [it, cs] = await Promise.all([gh(`${repo}/issues/${n}`), gh(`${repo}/issues/${n}/comments?per_page=100`)]);
  const files = pr ? await gh(`${repo}/pulls/${n}/files?per_page=100`) : null;
  return (cache[repo + n] = {it, cs: cs.filter(c => isMine(c) || (c.user.login === 'github-actions[bot]' && /^\s*🤖/.test(c.body || ''))), files});
}
function rolDe(c) { if (!isAgent(c)) return null; const m = (c.body || '').match(/^\s*🤖\s*([^:\n]{1,40}):/); return (m && PUESTO_A_ROL[m[1].trim().toLowerCase().split(/[\s·,]/)[0]]) || 'consejero'; }

async function openTask(repo, n, kind) {
  const R = REPOS.find(r => r.name === repo), pr = kind === 'pr'; cargando();
  try {
    const {it, cs, files} = await datos(repo, n, pr);
    const ti = titulo(it.title), ec = enCorto(it.body), isProp = has(it, 'propuesta') && !has(it, 'aprobada'), isIdea = has(it, 'idea');
    const plan = [...cs].reverse().find(c => /^\s*🤖\s*Arquitecto:\s*Plan/i.test(c.body || ''));
    const opin = [...cs].reverse().find(c => rolDe(c) === 'consejero' && c !== plan);
    const rev = [...cs].reverse().find(c => /VEREDICTO:/.test(c.body || ''));
    const prio = prioOf(it);
    let corto = '';
    if (ec.ve || ec.por || ec.prueba) corto = `<div class="card">${ec.ve ? `<div class="li"><span class="n">👁</span><span><b>Qué verás:</b> ${esc(ec.ve)}</span></div>` : ''}${ec.por ? `<div class="li"><span class="n">?</span><span><b>Por qué ahora:</b> ${esc(ec.por)}</span></div>` : ''}${ec.prueba ? `<div class="li"><span class="n">▶</span><span><b>Cómo probarlo:</b> ${esc(ec.prueba)}</span></div>` : ''}</div>`;
    else corto = `<div class="card"><div class="s big-s">${esc(ec.resumen || corta(it.body, 220))}</div></div>`;
    const fase = fases(R).find(o => pr ? (o.pr && o.pr.n === +n) : o.i.n === +n);
    const quien = rev ? `<div class="quote"><b>Madara:</b> ${esc(corta(primerParrafo(rev.body).replace(/VEREDICTO:\s*/, ''), 200))}</div>` : opin ? `<div class="quote"><b>Itachi:</b> ${esc(corta(primerParrafo(opin.body), 200))}</div>` : '';
    const diff = files ? acordeon('🧩', `Cambios en ${files.length} archivo${files.length === 1 ? '' : 's'}`, files.map(f => `<details class="diff"><summary><code>${esc(f.filename)}</code> <span class="add">+${f.additions}</span> <span class="del">−${f.deletions}</span></summary><pre>${(f.patch || '(sin vista previa)').split('\n').slice(0, 300).map(l => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : l.startsWith('@@') ? 'hunk' : ''}">${esc(l)}</span>`).join('\n')}</pre></details>`).join('')) : '';
    const foot = pr ? `<button class="b p" data-act="fusionar" data-repo="${repo}" data-n="${n}">${R.despliega ? 'Fusionar y desplegar' : 'Fusionar'}</button><button class="b" data-chat="${repo}/${n}/pr">Preguntar</button>`
      : isProp ? `<button class="b p" data-act="aprobar" data-repo="${repo}" data-n="${n}">Aprobar</button><button class="b" data-chat="${repo}/${n}">Preguntar</button><button class="b g" data-act="rechazar" data-repo="${repo}" data-n="${n}">Rechazar</button>`
      : `<button class="b" data-chat="${repo}/${n}${pr ? '/pr' : ''}">💬 Chat (solo si quieres cambiar algo)</button>${isIdea ? `<button class="b g" data-act="cerrar" data-repo="${repo}" data-n="${n}">Cerrar idea</button>` : ''}`;
    view({title: '', right: prio ? `<span class="tag ${prio}">${prio.toUpperCase()}</span>` : '', body: `
      <div class="tags">${ti.paso ? `<span class="tag">${ti.paso}</span>` : ''}<span class="tag">${pr ? 'Cambio listo' : isIdea ? 'Idea' : isProp ? 'Propuesta' : 'En la cadena'}</span><span class="tag">#${n} · ${ago(it.created_at)}</span></div>
      <h3 class="v-h">${esc(ti.t)}</h3>
      ${fase ? `<div class="card">${pasos(fase.f)}<div class="s">${esc(fase.q)}</div>${fase.f < 4 ? '<div class="ok-msg">✓ No tienes que hacer nada: avanza solo. Usa el chat solo si quieres cambiar algo.</div>' : ''}</div>` : ''}
      <h2>En corto</h2>${corto}${quien}
      ${diff}
      ${plan ? acordeon('🗺', 'Plan de Itachi', md(plan.body)) : ''}
      ${acordeon('📄', pr ? 'Descripción del cambio' : 'Detalle técnico completo', md(it.body))}
      <button class="acc-link" data-chat="${repo}/${n}${pr ? '/pr' : ''}"><span>💬 Chat de esta tarea (${cs.length})</span><span class="chev">›</span></button>`, foot});
  } catch (e) { view({body: `<div class="vacio">${esc(e.message)}</div>`}); }
}
async function openChat(repo, n, kind) {
  const R = REPOS.find(r => r.name === repo), pr = kind === 'pr'; cargando();
  try {
    const {it, cs} = cache[repo + n] || await datos(repo, n, pr);
    const ti = titulo(it.title), isIdea = has(it, 'idea');
    const fase = fases(R).find(o => pr ? (o.pr && o.pr.n === +n) : o.i.n === +n);
    const burbuja = c => {
      const rol = rolDe(c), cuerpo = clean(c.body), primero = primerParrafo(c.body), largo = cuerpo.length > primero.length + 20;
      if (!rol) return `<div class="msg me"><div class="bub">${md(cuerpo)}<span class="hora">${ago(c.created_at)}</span></div></div>`;
      return `<div class="msg">${av(rol)}<div class="bub"><div class="nm" style="color:${ROLES[rol].shirt}">${ROLES[rol].nombre}</div>${largo ? `<details><summary>${md(primero)}<span class="mas">Ver completo</span></summary>${md(cuerpo.slice(cuerpo.indexOf(primero) + primero.length))}</details>` : md(cuerpo)}<span class="hora">${ago(c.created_at)}</span></div></div>`;
    };
    const inicio = isMine(it) && !it.performed_via_github_app && !/^\s*🤖/.test(it.body || '')
      ? `<div class="msg me"><div class="bub"><b>${esc(it.title)}</b>${md(String(it.body || '').replace(/\n*—\s*(Idea|Tarea directa) de Gonzalo[^\n]*$/, ''))}<span class="hora">${ago(it.created_at)}</span></div></div>`
      : `<div class="msg">${av('explorador')}<div class="bub"><div class="nm" style="color:${ROLES.explorador.shirt}">${ROLES.explorador.nombre}</div>${esc(enCorto(it.body).resumen || corta(it.body, 200))}<span class="mas" data-open="${repo}/${n}${pr ? '/pr' : ''}">Ver la tarea</span></div></div>`;
    const espera = cs.length && !rolDe(cs[cs.length - 1]) || (isIdea && !cs.length);
    view({title: esc(corta(ti.t, 34)), back: () => openTask(repo, n, kind), body: `
      ${fase ? `<div class="card">${pasos(fase.f)}</div>` : ''}
      <div class="chat">${inicio}${cs.map(burbuja).join('')}${espera ? `<div class="escribiendo">${av('consejero')}<span>${R.instantaneo ? 'Itachi responde en 1-2 minutos…' : `Itachi responde a las ${proximaRonda(R)}…`}</span></div>` : ''}</div>`,
      foot: `<form class="chat-in" data-reply="${repo}/${n}/${kind || ''}"><textarea id="reply" rows="1" required placeholder="Escribe a ${pr ? 'el equipo' : 'Itachi'}…"></textarea><button class="b p send" type="submit" aria-label="Enviar">➤</button></form>`});
    const vb = $('sheet-body').querySelector('.v-body'); vb.scrollTop = vb.scrollHeight;
  } catch (e) { view({body: `<div class="vacio">${esc(e.message)}</div>`}); }
}
function openAgent(role) {
  const a = team().find(x => x.role === role), R = active();
  view({body: `
    <div class="ag-head">${av(role, 'xl')}<div><b>${a.nombre}</b><span>${a.puesto} · ${a.modelo}</span></div></div>
    <div class="card">${pill(a.s)}<div class="big">${esc(a.big)}</div>${a.sub ? `<div class="s">${esc(a.sub)}</div>` : ''}</div>
    <div class="kv2">${a.last ? `<span>Último trabajo</span><b>${esc(corta(a.last, 120))}${a.e ? ` · ${ago(a.e.updated)}` : ''}</b>` : ''}${a.next ? `<span>Siguiente</span><b>${esc(a.next)}</b>` : ''}<span>Qué hace</span><b class="dim">${esc(a.hace)}</b></div>
    ${a.e && a.e.log.length ? acordeon('📜', `Qué hizo paso a paso (${a.e.log.length})`, `<ul class="log">${a.e.log.map(l => `<li>${inline(esc(l))}</li>`).join('')}</ul>`) : ''}
    ${R ? `<a class="acc-link" href="https://claude.ai/code/${R.session}" target="_blank" rel="noopener"><span>💬 Hablarle ahora (abre Claude)</span><span class="chev">›</span></a>` : ''}`});
}
function openBitacora(repo, n) {
  cargando();
  gh(`${repo}/issues/${n}/comments?per_page=100`).then(cs => {
    cs = cs.filter(c => isMine(c) && !/fabrica-estado:/.test(c.body || '')).slice(-15).reverse();
    view({title: 'Bitácora', body: cs.map(c => { const r = rolDe(c) || 'consejero'; return `<div class="msg">${av(r)}<div class="bub"><div class="nm" style="color:${ROLES[r].shirt}">${ROLES[r].nombre}</div><details><summary>${md(primerParrafo(c.body))}<span class="mas">Ver completo</span></summary>${md(clean(c.body))}</details><span class="hora">${ago(c.created_at)}</span></div></div>`; }).join('') || '<div class="vacio">Sin registros.</div>'});
  }).catch(e => view({body: `<div class="vacio">${esc(e.message)}</div>`}));
}
function openProjects() {
  const cur = active();
  view({title: 'Proyectos', body: `<p class="dim">El equipo trabaja en un proyecto a la vez.</p>
    ${REPOS.map(R => { const d = dOf(R), on = R.name === (cur || {}).name, pend = d.props.length + d.prs.length + d.queue.length + d.planned.length;
      return `<div class="card"><div class="tags"><span class="tag" style="color:${R.color}">● ${on ? 'activo' : 'en pausa'}</span>${R.despierto ? '' : '<span class="tag">turnos apagados</span>'}</div><div class="t">${esc(R.nombre)}</div><div class="s">${pend} pendiente(s) · ${d.dossierN ? 'el equipo ya lo conoce' : 'aún no lo estudian'}</div><div class="btns">${on ? '' : `<button class="b p" data-act="activar" data-repo="${R.name}">Trabajar en este</button>`}${d.dossierN ? `<button class="b" data-open="${R.name}/${d.dossierN}">Qué saben</button>` : ''}${d.bitN ? `<button class="b" data-bitacora="${R.name}/${d.bitN}">Bitácora</button>` : ''}</div></div>`; }).join('')}
    ${PENDIENTES.map(P => `<div class="card"><div class="tags"><span class="tag t-warn">por conectar</span></div><div class="t">${esc(P.nombre)}</div><div class="s">Pídele a la Sede: «Conecta el proyecto ${esc(P.nombre)}».</div><div class="btns"><a class="b p" href="https://claude.ai/code/${REG.sede}" target="_blank" rel="noopener">Abrir la Sede</a></div></div>`).join('')}
    <details class="acc"><summary><span>＋ Agregar proyecto</span><span class="chev">›</span></summary><div class="acc-in">
    <form id="addproj">
      <label for="np-url">Link del repo</label><input id="np-url" required placeholder="https://github.com/${OWNER}/mi-app" inputmode="url" autocomplete="off">
      <label for="np-nombre">Nombre</label><input id="np-nombre" required maxlength="40" placeholder="Ej: Portafolio">
      <label>Color</label><div class="paleta">${PALETA.map((c, i) => `<label><input type="radio" name="np-color" value="${c}" ${i === (REPOS.length + PENDIENTES.length) % PALETA.length ? 'checked' : ''}><i style="background:${c}"></i></label>`).join('')}</div>
      <button class="b p full" type="submit">Agregar</button>
    </form></div></details>`});
}
function openSettings() {
  view({title: 'Ajustes', body: `
    <h2>Estilo</h2><div class="seg">${['pixel', 'oscuro'].map(s => `<button class="chipb ${style() === s ? 'on' : ''}" data-setstyle="${s}">${s === 'pixel' ? 'Pixel' : 'Oscuro'}</button>`).join('')}</div>
    <h2>Llave de GitHub</h2>
    <p class="dim">${token ? '✅ Activa en este dispositivo.' : 'Sin llave solo puedes mirar.'}</p>
    <form id="tokform"><input id="tok" type="password" autocomplete="off" value="${esc(token)}" placeholder="github_pat_…"><button class="b p full" type="submit">Guardar</button></form>
    <p class="dim small">Permisos «Read and write»: Issues, Pull requests y Contents, sobre tus proyectos y fabrica-oficina.</p>
    <label class="check"><input id="sonido" type="checkbox" ${store.get('fabrica-sonido', false) ? 'checked' : ''}> Sonar cuando llegue algo nuevo</label>`});
}
async function addProject(url, nombre, color) {
  const m = url.trim().match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[\/?#].*)?$/i);
  if (!m) throw new Error('Ese link no parece un repo de GitHub.');
  if (m[1].toLowerCase() !== OWNER) throw new Error('Por ahora solo repos de tu cuenta (' + OWNER + ').');
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

// ---------- acciones ----------
function needToken() { if (token) return false; notice('Para hacer eso activa tu llave en ⚙.'); openSettings(); return true; }
function busy(on, txt) { const L = $('loader'); ($('sheet').open ? $('sheet') : document.body).appendChild(L); L.querySelector('span').textContent = txt || 'Guardando…'; L.classList.toggle('on', !!on); document.body.classList.toggle('busy', !!on); }
async function act(fn, okMsg, txt) { busy(true, txt); try { await fn(); busy(true, 'Actualizando…'); notice(okMsg); toast(okMsg); await load(); return true; } catch (e) { notice(e.message); alert(e.message); return false; } finally { busy(false); } }
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
async function setActive(repo) {
  for (const R of REPOS) {
    const d = state.repos[R.name]; if (!d || !d.manualN) continue;
    if (R.name === repo) await gh(`${R.name}/issues/${d.manualN}/labels`, {method: 'POST', body: {labels: ['fabrica:activo']}});
    else if (d.activo) await gh(`${R.name}/issues/${d.manualN}/labels/${encodeURIComponent('fabrica:activo')}`, {method: 'DELETE', ok404: true});
  }
  Scene.projectChanged();
}
async function newIssue(repo, title, body, labels) { if (needToken()) return false; return act(() => gh(`${repo}/issues`, {method: 'POST', body: {title, body, labels}}), (REPOS.find(r => r.name === repo) || {}).instantaneo ? 'Enviado. Itachi te responde en 1-2 minutos.' : `Enviado. Itachi responde a las ${proximaRonda(REPOS.find(r => r.name === repo))}.`, 'Enviando…'); }

document.addEventListener('click', async e => {
  if (e.target.closest('[data-back]')) { if (backFn) return backFn(); return $('sheet').close(); }
  const ag = e.target.closest('[data-role]'); if (ag) return openAgent(ag.dataset.role);
  if (e.target.id === 'scene') { const role = Scene.pick(e.clientX, e.clientY); if (role) openAgent(role); return; }
  const ch = e.target.closest('[data-chat]'); if (ch) { const [r, n, k] = ch.dataset.chat.split('/'); return openChat(r, n, k); }
  const op = e.target.closest('[data-open]'); if (op) { const [r, n, k] = op.dataset.open.split('/'); return openTask(r, n, k); }
  const bt = e.target.closest('[data-bitacora]'); if (bt) { const [r, n] = bt.dataset.bitacora.split('/'); return openBitacora(r, n); }
  if (e.target === $('sheet')) return $('sheet').close();
  if (e.target.closest('#proyecto')) return openProjects();
  const fl = e.target.closest('[data-filtro]'); if (fl) { filters.tipo = fl.dataset.filtro; store.set('fabrica-filtros', filters); return render(); }
  const st = e.target.closest('[data-setstyle]'); if (st) { document.body.dataset.style = st.dataset.setstyle; store.set('fabrica-style', st.dataset.setstyle); Scene.setTheme(st.dataset.setstyle); render(); return openSettings(); }
  const tb = e.target.closest('[data-tab]');
  if (tb) { document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tb.dataset.tab; }); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === tb)); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const {act: a, repo, n} = b.dataset, R = REPOS.find(r => r.name === repo);
  if (needToken()) return;
  const cerrar = ok => { if (ok && $('sheet').open) $('sheet').close(); };
  if (a === 'activar' && confirm(`¿Poner al equipo a trabajar en ${R.nombre}?`)) { if (await act(() => setActive(repo), `El equipo trabaja ahora en ${R.nombre}.`, 'Cambiando…')) { if (!R.despierto) view({title: 'Último paso', body: `<p>Los turnos de ${esc(R.nombre)} están apagados para ahorrar cuota. Pídele a la Sede: <b>«Enciende los turnos de ${esc(R.nombre)}»</b>.</p><a class="b p full" href="https://claude.ai/code/${REG.sede}" target="_blank" rel="noopener">Abrir la Sede</a>`}); else cerrar(true); } }
  if (a === 'fusionar' && confirm(`¿Fusionar este cambio?` + (R.despliega ? ' Se despliega a producción.' : ''))) cerrar(await act(() => gh(`${repo}/pulls/${n}/merge`, {method: 'PUT', body: {merge_method: 'squash'}}), `Fusionado${R.despliega ? ' y desplegando' : ''}.`, 'Fusionando…'));
  if (a === 'aprobar') cerrar(await act(() => gh(`${repo}/issues/${n}/labels`, {method: 'POST', body: {labels: ['fabrica:aprobada']}}), 'Aprobada. Itachi la planifica.', 'Aprobando…'));
  if (a === 'rechazar' && confirm('¿Rechazar esta propuesta?')) cerrar(await act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed', state_reason: 'not_planned'}}), 'Rechazada.', 'Rechazando…'));
  if (a === 'cerrar' && confirm('¿Cerrar esta idea?')) cerrar(await act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed'}}), 'Idea cerrada.', 'Cerrando…'));
});
document.addEventListener('change', e => {
  if (e.target.id === 'sonido') store.set('fabrica-sonido', e.target.checked);
  if (e.target.id === 't-repo' || e.target.id === 'i-repo') e.target.dataset.touched = '1';
});
document.addEventListener('input', e => { if (e.target.id === 'reply') { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; } });
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, btn = f.querySelector('button[type=submit]');
  if (btn) { if (btn.disabled) return; btn.disabled = true; setTimeout(() => { btn.disabled = false; }, 4000); }
  if (f.id === 'addproj') { if (needToken()) return; try { busy(true, 'Agregando…'); await addProject($('np-url').value, $('np-nombre').value, (f.querySelector('input[name=np-color]:checked') || {}).value || PALETA[0]); toast('Proyecto agregado'); openProjects(); } catch (err) { alert(err.message); } finally { busy(false); } return; }
  if (f.id === 'tokform') { token = $('tok').value.trim(); store.set('fabrica-token', token); $('sheet').close(); toast(token ? 'Llave guardada' : 'Llave borrada'); return load(); }
  if (f.id === 'task') { if (await newIssue($('t-repo').value, $('t-title').value.trim(), ($('t-body').value.trim() || '(sin detalle)') + '\n\n— Tarea directa de Gonzalo desde la oficina.', ['fabrica:aprobada'])) f.reset(); return; }
  if (f.id === 'idea') { const txt = $('i-body').value.trim(); if (!txt) return; const t = $('i-title').value.trim() || corta(txt, 60); if (await newIssue($('i-repo').value, t, txt + '\n\n— Idea de Gonzalo para el Consejero.', ['fabrica:idea'])) f.reset(); return; }
  if (f.dataset.reply) {
    const [repo, n, kind] = f.dataset.reply.split('/'), txt = f.querySelector('textarea').value.trim(); if (!txt || needToken()) return;
    if (await act(() => gh(`${repo}/issues/${n}/comments`, {method: 'POST', body: {body: txt}}), 'Mensaje enviado.', 'Enviando…')) { delete cache[repo + n]; openChat(repo, n, kind); }
  }
});
$('refresh').addEventListener('click', load);
$('settings').addEventListener('click', openSettings);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.fetchedAt > 60000) load(); });

function fillSelects() { for (const id of ['t-repo', 'i-repo']) { const v = $(id).value; $(id).innerHTML = REPOS.map(R => `<option value="${R.name}">${esc(R.nombre)}</option>`).join(''); if (v) $(id).value = v; } }
document.body.dataset.style = store.get('fabrica-style', 'oscuro') === 'pixel' ? 'pixel' : 'oscuro';
fillSelects();
Scene.init($('scene'), {getState: () => [team().map(a => ({role: a.role, s: a.s === 'work' ? 'work' : a.s === 'you' ? 'wait' : a.s === 'soon' ? 'queue' : 'sleep', accion: a.e && a.e.accion, paso: a.e && a.e.paso}))], roles: ROLES, isDay, project: () => { const R = active(); return R ? {name: R.short, color: R.color} : {name: 'SIN PROYECTO', color: '#777'}; }});
Scene.setTheme(style());
render(); setInterval(render, 20000);
load();
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
