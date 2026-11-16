'use strict';
const OWNER = 'gonzalolavin99';
const REPOS = [
  {name: 'hierro-y-ceniza', short: 'HIERRO Y CENIZA', color: '#c0503a', session: 'session_01RhVe2yqKVjLJN25naPr6my', turnos: {explorador: '04:43', consejero: '15:22', dev: '22:17', revisor: 'tras el Dev', seguridad: 'domingo 02:12'}},
  {name: 'speech-therapy-hub', short: 'THERAPYHUB', color: '#3aa0a8', session: 'session_01RhVe2zJLh7B9rJxR5sU9UK', turnos: {explorador: '04:52', consejero: '15:31', dev: '22:26', revisor: 'tras el Dev', seguridad: 'domingo 02:24'}},
];
const ROLES = {
  explorador: {nombre: 'Lía', puesto: 'Exploradora', modelo: 'Sonnet', hace: 'Lee el código y los docs del proyecto y propone el siguiente paso pequeño.', hair: '#7a4a2a', hairD: '#3a2418', shirt: '#f6c453'},
  consejero: {nombre: 'Bruno', puesto: 'Consejero y Arquitecto', modelo: 'Opus', hace: 'Cuestiona tus ideas y, cuando apruebas una tarea, escribe el plan detallado que el Dev ejecuta. También dirige la retro semanal.', hair: '#2b2b3a', hairD: '#0c0c12', shirt: '#b08cff'},
  dev: {nombre: 'Kai', puesto: 'Dev', modelo: 'Sonnet', hace: 'Implementa exactamente el plan del Arquitecto, corre las pruebas y abre el PR.', hair: '#1f4f7a', hairD: '#14141c', shirt: '#6fb3ff'},
  revisor: {nombre: 'Mora', puesto: 'Revisora', modelo: 'Opus', hace: 'Revisa cada PR con otro modelo y memoria limpia, y te dice si fusionar.', hair: '#8a2f4f', hairD: '#2a0c16', shirt: '#6fdc8c'},
  seguridad: {nombre: 'Nyx', puesto: 'Seguridad', modelo: 'Opus', hace: 'Audita cada semana el proyecto y a la propia fábrica. Lo delicado te lo informa en privado, nunca en GitHub.', hair: '#3a3a44', hairD: '#050508', shirt: '#ff8a8a'},
};
const TZ = 'America/Santiago';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
let state = store.get('fabrica2', {repos: {}, fetchedAt: 0});
let token = store.get('fabrica-token', '');

// ---------- tiempo ----------
function nowParts() {
  const p = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(new Date());
  return {h: +p.find(x => x.type === 'hour').value % 24, m: +p.find(x => x.type === 'minute').value};
}
const pad = n => String(n).padStart(2, '0');
const isDay = () => { const h = nowParts().h; return h >= 7 && h < 20; };
function ago(iso) {
  const t = new Date(iso).getTime(); if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

// ---------- GitHub ----------
async function gh(path, opts = {}) {
  const headers = {Accept: 'application/vnd.github+json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${path}`, {method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store'});
  if (!r.ok) {
    if (r.status === 401) throw new Error('La llave no es válida o venció (revisa ⚙).');
    if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') throw new Error(token ? 'GitHub limitó las consultas por un rato.' : 'GitHub limitó las consultas (60 por hora sin llave). Agrega tu llave en ⚙ para verlo en vivo.');
    if (r.status === 403 || r.status === 404) throw new Error(opts.method ? 'La llave no tiene permiso para esto en este repo (revisa ⚙).' : 'GitHub respondió ' + r.status);
    throw new Error('GitHub respondió ' + r.status);
  }
  return r.status === 204 ? null : r.json();
}
const isBot = x => !!(x.performed_via_github_app) || /^\s*🤖/.test(x.body || '');
const has = (i, l) => i.labels.some(x => x.name === 'fabrica:' + l);

function parseEstado(body) {
  const g = k => { const m = body.match(new RegExp('\\*\\*' + k + ':\\*\\*[ \\t]*(.*)')); return m ? m[1].trim() : ''; };
  const log = (body.split('**Registro:**')[1] || '').split('\n').map(s => s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean).slice(-8);
  return {estado: g('Estado').toLowerCase(), tarea: g('Tarea'), paso: g('Paso'), modelo: g('Modelo'), at: g('Actualizado'), log};
}

let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    for (const R of REPOS) {
      const [issues, pulls] = await Promise.all([gh(`${R.name}/issues?state=open&per_page=100`), gh(`${R.name}/pulls?state=open&per_page=50`)]);
      const fab = issues.filter(i => !i.pull_request && i.user && i.user.login === OWNER && i.labels.some(l => l.name.startsWith('fabrica:')));
      const bit = fab.find(i => has(i, 'bitacora'));
      const estados = {}; let notas = [];
      if (bit) {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const cs = await gh(`${R.name}/issues/${bit.number}/comments?since=${since}&per_page=100`);
        for (const c of cs) {
          if (!c.user || c.user.login !== OWNER) continue; // solo lo escrito por la cuenta dueña cuenta como estado o bitácora
          const m = (c.body || '').match(/<!--\s*fabrica-estado:(\w+)\s*-->/);
          if (m) estados[m[1]] = {...parseEstado(c.body), updated: c.updated_at};
          else notas.push({at: c.created_at, body: c.body});
        }
        notas = notas.slice(-3).reverse();
      }
      const prs = pulls.filter(p => p.head.ref.startsWith('fabrica/') && p.user && p.user.login === OWNER && p.head.repo && p.head.repo.full_name === `${OWNER}/${R.name}`).map(p => ({n: p.number, title: p.title, url: p.html_url, at: p.updated_at, ref: p.head.ref, veredicto: ''}));
      for (const p of prs.slice(0, 3)) {
        const rev = (await gh(`${R.name}/issues/${p.n}/comments?per_page=100`)).reverse().find(c => c.user && c.user.login === OWNER && /VEREDICTO:/.test(c.body || ''));
        if (rev) p.veredicto = (rev.body.match(/VEREDICTO:\s*([A-ZÁÉÍÓÚÑ ]+)/) || [])[1] || '';
      }
      const slim = i => ({n: i.number, title: i.title, url: i.html_url, at: i.updated_at, comments: i.comments, body: (i.body || '').slice(0, 600)});
      state.repos[R.name] = {
        props: fab.filter(i => has(i, 'propuesta') && !has(i, 'aprobada')).map(slim),
        queue: fab.filter(i => has(i, 'aprobada') && !has(i, 'en-curso')).map(slim),
        running: fab.filter(i => has(i, 'en-curso')).map(slim),
        ideas: fab.filter(i => has(i, 'idea')).map(slim),
        prs,
        estados, notas, bitUrl: bit ? bit.html_url : null,
      };
    }
    state.fetchedAt = Date.now(); store.set('fabrica2', state); notice('');
  } catch (e) {
    notice(e.message + (state.fetchedAt ? ' Mostrando datos de ' + ago(new Date(state.fetchedAt).toISOString()) + '.' : ''));
  }
  loading = false; render(); schedule();
}
let timer;
function schedule() {
  clearTimeout(timer);
  const busy = REPOS.some(R => agents(R).some(a => a.s === 'work'));
  const ms = token ? (busy ? 45e3 : 180e3) : 600e3;
  timer = setTimeout(() => { if (!document.hidden) load(); else schedule(); }, ms);
}
function notice(t) { $('notice').textContent = t; }

// ---------- estado de cada agente ----------
const EMPTY = {props: [], queue: [], running: [], ideas: [], prs: [], estados: {}, notas: []};
function agents(R) {
  const d = state.repos[R.name] || EMPTY;
  return Object.keys(ROLES).map(role => {
    const e = d.estados[role], meta = ROLES[role];
    const fresh = e && Date.now() - new Date(e.updated).getTime() < 40 * 60000;
    let s = 'sleep', t = '';
    if (e && e.estado.startsWith('trabaj') && fresh) { s = 'work'; t = e.paso || 'Trabajando'; }
    else if (role === 'explorador' && d.props.length) { s = 'wait'; t = `${d.props.length} propuesta(s) esperando tu decisión`; }
    else if (role === 'consejero' && d.ideas.length) { s = 'wait'; t = `${d.ideas.length} idea(s) en conversación contigo`; }
    else if (role === 'dev' && d.running.length) { s = 'wait'; t = `#${d.running[0].n} en curso`; }
    else if ((role === 'dev' || role === 'revisor') && d.prs.length) { s = 'wait'; t = `${d.prs.length} PR esperando que lo revises y fusiones`; }
    else if (role === 'dev' && d.queue.length) { s = 'queue'; t = `${d.queue.length} tarea(s) aprobada(s) en cola para las ${R.turnos.dev}`; }
    else t = role === 'revisor' ? 'Libre. Entra justo después del Dev' : `Libre. Próximo turno ${R.turnos[role]}`;
    return {role, ...meta, s, t, e, repo: R};
  });
}
const SLABEL = {work: 'Trabajando ahora', wait: 'Esperándote', queue: 'En cola', sleep: 'Libre'};

// ---------- pintar ----------
function style() { return document.body.dataset.style; }
function render() {
  Scene.refresh();
  $('team').innerHTML = REPOS.map((R, k) => `<div class="card"><h2 style="margin-top:0">${esc(R.short)}</h2>${agents(R).map(a => {
    const act = a.s === 'sleep' ? Scene.activity(k, a.role) : '';
    return `<button class="who" data-repo="${R.name}" data-role="${a.role}"><span class="dot s-${a.s}"></span><span><b>${a.nombre}</b> · ${a.puesto} <small>${esc(act || a.t)}</small></span></button>`;
  }).join('')}</div>`).join('');
  document.querySelectorAll('[data-setstyle]').forEach(b => b.classList.toggle('on', b.dataset.setstyle === style()));
  let inbox = '', pipe = '', ideas = '', n = 0;
  for (const R of REPOS) {
    const d = state.repos[R.name]; if (!d) continue;
    for (const p of d.prs) { n++; inbox += item(R, p, 't-pr', p.veredicto ? 'Revisora: ' + p.veredicto.trim() : 'PR sin revisar aún', `<button class="primary" data-act="fusionar" data-repo="${R.name}" data-n="${p.n}">Fusionar${R.name === 'speech-therapy-hub' ? ' y desplegar' : ''}</button><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">Ver cambios y revisión</a>`); }
    for (const p of d.props) { n++; inbox += item(R, p, 't-prop', 'Propuesta', `<button class="primary" data-act="aprobar" data-repo="${R.name}" data-n="${p.n}">Aprobar</button><button class="danger" data-act="rechazar" data-repo="${R.name}" data-n="${p.n}">Rechazar</button><a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">Leer completa</a>`, p.body); }
    for (const p of d.running) pipe += item(R, p, 't-run', 'En curso');
    for (const p of d.queue) pipe += item(R, p, 't-ok', 'Aprobada, en cola');
    for (const p of d.ideas) ideas += item(R, p, 't-prop', 'Idea', `<button data-act="hilo" data-repo="${R.name}" data-n="${p.n}">Ver conversación (${p.comments})</button>`, '', `<div class="thread" id="hilo-${R.name}-${p.n}" hidden></div>`);
  }
  $('inbox').innerHTML = inbox || '<p class="empty">Nada pendiente. Los agentes no te necesitan ahora.</p>';
  $('pipeline').innerHTML = pipe || '<p class="empty">No hay tareas aprobadas ni en curso.</p>';
  $('ideas').innerHTML = ideas || '<p class="empty">Aún no has traído ideas. Escribe la primera arriba.</p>';
  $('badge').textContent = n || '';
  const t = nowParts();
  $('clock').textContent = `${pad(t.h)}:${pad(t.m)}` + (state.fetchedAt ? ` · datos ${ago(new Date(state.fetchedAt).toISOString())}` : '');
}
function item(R, i, cls, tag, acts = '', body = '', extra = '') {
  return `<div class="item"><span class="tag ${cls}">${tag}</span><b>#${i.n} ${esc(i.title)}</b><div class="meta">${esc(R.name)} · ${ago(i.at)}</div>${body ? `<div class="meta">${esc(body.replace(/[#*`>]/g, '').slice(0, 220))}…</div>` : ''}${acts ? `<div class="acts">${acts}</div>` : ''}${extra}</div>`;
}

// ---------- ficha del agente ----------
function openAgent(repoName, role) {
  const R = REPOS.find(r => r.name === repoName), a = agents(R).find(x => x.role === role), d = state.repos[R.name] || EMPTY, e = a.e;
  const log = e && e.log.length ? `<ul class="log">${e.log.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="empty">Todavía no ha publicado pasos. Aparecerán aquí en su próximo turno.</p>';
  $('sheet-body').innerHTML = `
    <h3>${a.nombre} <small style="display:inline">· ${a.puesto} de ${esc(R.short)}</small></h3>
    <p style="margin:6px 0 10px">${a.hace}</p>
    <span class="state s-${a.s}">${SLABEL[a.s]}</span>
    <dl class="kv">
      <dt>Ahora</dt><dd>${esc(a.s === 'sleep' ? (Scene.activity(REPOS.indexOf(R), role) || 'En pausa') + '. ' + a.t : a.t)}</dd>
      ${e && e.tarea && e.tarea !== '—' ? `<dt>Tarea</dt><dd>${esc(e.tarea)}</dd>` : ''}
      ${e && e.paso && a.s !== 'work' ? `<dt>Último paso</dt><dd>${esc(e.paso)}</dd>` : ''}
      <dt>Modelo</dt><dd>${a.modelo}</dd>
      <dt>Turno</dt><dd>${R.turnos[role]}</dd>
      ${e ? `<dt>Última señal</dt><dd>${ago(e.updated)}</dd>` : ''}
    </dl>
    <h2>Cómo lo está haciendo</h2>${log}
    <div class="rowbtns">
      <a class="btn primary" href="https://claude.ai/code/${R.session}" target="_blank" rel="noopener">Hablar en vivo</a>
      ${d.bitUrl ? `<a class="btn" href="${esc(d.bitUrl)}" target="_blank" rel="noopener">Bitácora completa</a>` : ''}
      <button data-close>Cerrar</button>
    </div>
    <small>«Hablar en vivo» abre la sesión del equipo de ${esc(R.short)} en la app de Claude: pregúntale ahí en qué está o pídele cambios, como a una persona.</small>`;
  $('sheet').showModal();
}
function openSettings() {
  $('sheet-body').innerHTML = `
    <h3>Ajustes</h3>
    <p>Sin llave puedes mirar. Con tu llave personal de GitHub además apruebas, rechazas, respondes y creas tareas desde aquí, y la oficina se actualiza cada 45 segundos mientras alguien trabaja.</p>
    <form id="tokform">
      <label for="tok">Llave personal de GitHub (fine-grained)</label>
      <input id="tok" type="password" autocomplete="off" value="${esc(token)}" placeholder="github_pat_…">
      <button class="primary" type="submit">Guardar en este dispositivo</button>
    </form>
    <small>Créala en GitHub → Settings → Developer settings → Fine-grained tokens. Acceso solo a <b>hierro-y-ceniza</b> y <b>speech-therapy-hub</b>, con tres permisos en <b>Read and write</b>: <b>Issues</b>, <b>Pull requests</b> y <b>Contents</b> (este último solo hace falta para el botón Fusionar). Se guarda únicamente en este navegador; bórrala dejando el campo vacío.</small>
    <div class="rowbtns"><button data-close>Cerrar</button></div>`;
  $('sheet').showModal();
}

// ---------- acciones ----------
function needToken(fallbackUrl) {
  if (token) return false;
  if (fallbackUrl) window.open(fallbackUrl, '_blank', 'noopener'); else { notice('Para hacerlo desde aquí agrega tu llave en ⚙.'); openSettings(); }
  return true;
}
async function act(fn, okMsg) {
  try { await fn(); notice(okMsg); await load(); } catch (e) { notice(e.message); }
}
async function showThread(repo, n) {
  const box = $(`hilo-${repo}-${n}`); box.hidden = false; box.innerHTML = '<p class="empty">Cargando…</p>';
  try {
    const cs = await gh(`${repo}/issues/${n}/comments?per_page=100`);
    box.innerHTML = (cs.map(c => `<div class="msg ${isBot(c) ? 'bot' : 'me'}"><b>${c.user.login !== OWNER ? 'Cuenta externa @' + esc(c.user.login) + ' (los agentes la ignoran)' : isBot(c) ? 'Consejero' : 'Tú'} · ${ago(c.created_at)}</b>${esc(c.body.replace(/^\s*🤖\s*[^:]*:\s*/, ''))}</div>`).join('') || '<p class="empty">El Consejero aún no responde. Lo hará en su turno, o háblale en vivo desde la oficina.</p>')
      + `<form data-reply="${repo}/${n}"><label for="r-${repo}-${n}">Tu respuesta</label><textarea id="r-${repo}-${n}" required></textarea><button class="primary" type="submit">Responder</button></form>`;
  } catch (e) { box.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function newIssue(repo, title, body, label) {
  const url = `https://github.com/${OWNER}/${repo}/issues/new?labels=${encodeURIComponent(label)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  if (needToken(url)) return Promise.resolve(false);
  return act(() => gh(`${repo}/issues`, {method: 'POST', body: {title, body, labels: [label]}}), 'Enviado.').then(() => true);
}

document.addEventListener('click', e => {
  const ag = e.target.closest('.who'); if (ag) return openAgent(ag.dataset.repo, ag.dataset.role);
  if (e.target.id === 'scene') { const p = Scene.pick(e.clientX, e.clientY); if (p) openAgent(REPOS[p.k].name, p.role); return; }
  if (e.target.closest('[data-close]') || e.target === $('sheet')) return $('sheet').close();
  const st = e.target.closest('[data-setstyle]'); if (st) { document.body.dataset.style = st.dataset.setstyle; store.set('fabrica-style', st.dataset.setstyle); Scene.setTheme(st.dataset.setstyle); return render(); }
  const tb = e.target.closest('[data-tab]');
  if (tb) { document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tb.dataset.tab; }); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === tb)); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const {act: a, repo, n} = b.dataset, web = `https://github.com/${OWNER}/${repo}/issues/${n}`;
  if (a === 'hilo') return showThread(repo, n);
  if (needToken(web)) return;
  if (a === 'fusionar' && confirm(`¿Fusionar el PR #${n}?` + (repo === 'speech-therapy-hub' ? ' Esto lo despliega a producción.' : ''))) act(() => gh(`${repo}/pulls/${n}/merge`, {method: 'PUT', body: {merge_method: 'squash'}}), `PR #${n} fusionado.`);
  if (a === 'aprobar') act(() => gh(`${repo}/issues/${n}/labels`, {method: 'POST', body: {labels: ['fabrica:aprobada']}}), `#${n} aprobada. El Dev la toma en su próximo turno.`);
  if (a === 'rechazar' && confirm(`¿Rechazar y cerrar la propuesta #${n}?`)) act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed', state_reason: 'not_planned'}}), `#${n} rechazada. No la volverán a proponer.`);
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'tokform') { token = $('tok').value.trim(); store.set('fabrica-token', token); $('sheet').close(); notice(token ? 'Llave guardada.' : 'Llave borrada.'); return load(); }
  if (f.id === 'task') { if (await newIssue($('t-repo').value, $('t-title').value.trim(), ($('t-body').value.trim() || '(sin detalle)') + '\n\n— Tarea directa de Gonzalo desde la oficina.', 'fabrica:aprobada')) f.reset(); return; }
  if (f.id === 'idea') { if (await newIssue($('i-repo').value, $('i-title').value.trim(), ($('i-body').value.trim() || '(sin detalle)') + '\n\n— Idea de Gonzalo para el Consejero.', 'fabrica:idea')) f.reset(); return; }
  if (f.dataset.reply) { const [repo, n] = f.dataset.reply.split('/'), txt = f.querySelector('textarea').value.trim(); if (needToken(`https://github.com/${OWNER}/${repo}/issues/${n}`)) return; await act(() => gh(`${repo}/issues/${n}/comments`, {method: 'POST', body: {body: txt}}), 'Respuesta enviada.'); showThread(repo, n); }
});
$('refresh').addEventListener('click', load);
$('settings').addEventListener('click', openSettings);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - state.fetchedAt > 60000) load(); });

document.body.dataset.style = store.get('fabrica-style', 'pixel') === 'pixel' ? 'pixel' : 'oscuro';
for (const id of ['t-repo', 'i-repo']) $(id).innerHTML = REPOS.map(R => `<option value="${R.name}">${R.name}</option>`).join('');
Scene.init($('scene'), {getState: () => REPOS.map(agents), roles: ROLES, isDay, names: REPOS.map(r => r.short), colors: REPOS.map(r => r.color)});
Scene.setTheme(style());
render(); setInterval(render, 20000);
if (Date.now() - state.fetchedAt > 60000) load(); else schedule();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
