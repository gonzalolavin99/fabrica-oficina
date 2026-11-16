'use strict';
const OWNER = 'gonzalolavin99';
const REPOS = [
  {name: 'hierro-y-ceniza', short: 'HIERRO Y CENIZA', color: '#c0503a', session: 'session_01RhVe2yqKVjLJN25naPr6my', turnos: {explorador: '04:43', consejero: '15:22', dev: '22:17'}},
  {name: 'speech-therapy-hub', short: 'THERAPYHUB', color: '#3aa0a8', session: 'session_01RhVe2zJLh7B9rJxR5sU9UK', turnos: {explorador: '04:52', consejero: '15:31', dev: '22:26'}},
];
const ROLES = {
  explorador: {nombre: 'Lía', puesto: 'Exploradora', modelo: 'Sonnet', hace: 'Lee el código y los docs del proyecto y propone el siguiente paso pequeño.', hair: '#7a4a2a', shirt: '#f6c453'},
  consejero: {nombre: 'Bruno', puesto: 'Consejero', modelo: 'Opus', hace: 'Cuestiona tus ideas, te hace las preguntas difíciles y las convierte en tareas.', hair: '#2b2b3a', shirt: '#b08cff'},
  dev: {nombre: 'Kai', puesto: 'Dev', modelo: 'Opus', hace: 'Implementa lo que aprobaste, corre las pruebas y abre el PR.', hair: '#1f4f7a', shirt: '#6fb3ff'},
  revisor: {nombre: 'Mora', puesto: 'Revisora', modelo: 'Sonnet', hace: 'Revisa cada PR con otro modelo y memoria limpia, y te dice si fusionar.', hair: '#8a2f4f', shirt: '#6fdc8c'},
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
      const fab = issues.filter(i => !i.pull_request && i.labels.some(l => l.name.startsWith('fabrica:')));
      const bit = fab.find(i => has(i, 'bitacora'));
      const estados = {}; let notas = [];
      if (bit) {
        const since = new Date(Date.now() - 7 * 864e5).toISOString();
        const cs = await gh(`${R.name}/issues/${bit.number}/comments?since=${since}&per_page=100`);
        for (const c of cs) {
          const m = (c.body || '').match(/<!--\s*fabrica-estado:(\w+)\s*-->/);
          if (m) estados[m[1]] = {...parseEstado(c.body), updated: c.updated_at};
          else notas.push({at: c.created_at, body: c.body});
        }
        notas = notas.slice(-3).reverse();
      }
      const slim = i => ({n: i.number, title: i.title, url: i.html_url, at: i.updated_at, comments: i.comments, body: (i.body || '').slice(0, 600)});
      state.repos[R.name] = {
        props: fab.filter(i => has(i, 'propuesta') && !has(i, 'aprobada')).map(slim),
        queue: fab.filter(i => has(i, 'aprobada') && !has(i, 'en-curso')).map(slim),
        running: fab.filter(i => has(i, 'en-curso')).map(slim),
        ideas: fab.filter(i => has(i, 'idea')).map(slim),
        prs: pulls.filter(p => p.head.ref.startsWith('fabrica/')).map(p => ({n: p.number, title: p.title, url: p.html_url, at: p.updated_at, ref: p.head.ref})),
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
    else t = role === 'revisor' ? 'Descansando. Entra justo después del Dev' : `Descansando. Próximo turno ${R.turnos[role]}`;
    return {role, ...meta, s, t, e, repo: R};
  });
}
const SLABEL = {work: 'Trabajando ahora', wait: 'Esperándote', queue: 'En cola', sleep: 'Descansando'};

// ---------- escenas ----------
const rc = (x, y, w, h, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
const SKIN = '#f3cfae';
function agentWrap(x, a, inner) {
  const label = `${a.nombre}, ${a.puesto} de ${a.repo.short}: ${SLABEL[a.s]}`;
  return `<g class="agent" tabindex="0" role="button" aria-label="${esc(label)}" data-repo="${a.repo.name}" data-role="${a.role}">${rc(x, 30, 46, 86, 'transparent', 'class="hit"')}${inner}</g>`;
}
function pixelDesk(x, a) {
  const p = x + 23, dot = {work: '#6fb3ff', wait: '#f6c453', queue: '#6fdc8c', sleep: '#6b6898'}[a.s];
  let s = rc(p - 1, 58, 14, 16, '#3a3760') + rc(p, 56, 12, 3, '#4a4778'); // silla
  if (a.s === 'sleep') {
    s += rc(p + 1, 60, 10, 6, a.shirt) + rc(p + 2, 57, 8, 6, SKIN) + rc(p + 2, 56, 8, 3, a.hair) + rc(p + 3, 61, 2, 1, '#3b2a20') + rc(p + 7, 61, 2, 1, '#3b2a20');
    s += `<text x="${p + 12}" y="52" class="ptxt zzz" fill="#a3a1c9">z</text><text x="${p + 15}" y="46" class="ptxt small zzz" style="animation-delay:.8s" fill="#a3a1c9">z</text>`;
  } else {
    s += rc(p + 1, 57, 10, 9, a.shirt) + rc(p + 2, 49, 8, 8, SKIN) + rc(p + 1, 47, 10, 4, a.hair) + rc(p + 1, 50, 1, 4, a.hair) + rc(p + 10, 50, 1, 4, a.hair);
    s += `<g class="blink" style="transform-origin:${p + 6}px 54px">${rc(p + 4, 53, 1, 2, '#2a2030')}${rc(p + 7, 53, 1, 2, '#2a2030')}</g>` + rc(p + 5, 56, 2, 1, '#c98b7a');
    s += `<g class="${a.s === 'work' ? 'typing' : ''}">${rc(p - 1, 60, 2, 5, SKIN)}</g><g class="${a.s === 'work' ? 'typing' : ''}" style="animation-delay:.25s">${rc(p + 11, 60, 2, 5, SKIN)}</g>`;
    if (a.s === 'wait') s += rc(p + 13, 38, 9, 10, '#f6c453') + rc(p + 12, 39, 11, 8, '#f6c453') + rc(p + 17, 40, 1, 4, '#1b1a2e') + rc(p + 17, 45, 1, 1, '#1b1a2e') + rc(p + 13, 48, 2, 2, '#f6c453');
    if (a.s === 'queue') s += rc(p + 12, 39, 11, 8, '#6fdc8c') + rc(p + 14, 42, 2, 2, '#0c2a1b') + rc(p + 16, 44, 2, 2, '#0c2a1b') + rc(p + 18, 41, 2, 3, '#0c2a1b');
  }
  s += rc(x + 2, 66, 42, 4, '#b07a50') + rc(x + 2, 70, 42, 2, '#7b4f33') + rc(x + 4, 72, 3, 12, '#6b442c') + rc(x + 39, 72, 3, 12, '#6b442c'); // escritorio
  s += rc(x + 5, 52, 15, 11, '#11101f') + rc(x + 11, 63, 3, 3, '#55537e'); // monitor
  if (a.s === 'work') s += rc(x + 6, 53, 13, 9, '#0f2a4a') + `<g class="pulse">${rc(x + 7, 54, 8, 1, '#6fdc8c')}${rc(x + 7, 58, 6, 1, '#6fdc8c')}</g>` + rc(x + 7, 56, 10, 1, '#6fb3ff') + rc(x + 7, 60, 9, 1, '#f6c453');
  else if (a.s !== 'sleep') s += rc(x + 6, 53, 13, 9, a.s === 'wait' ? '#5a4a1c' : '#1f4a2c');
  s += rc(x + 38, 62, 4, 4, '#ecebff') + rc(x + 42, 63, 1, 2, '#ecebff');
  s += rc(x + 4, 91, 3, 3, dot, a.s === 'work' ? 'class="pulse"' : '') + `<text x="${x + 9}" y="94.5" class="ptxt" fill="#ecebff">${a.nombre.toUpperCase()}</text><text x="${x + 4}" y="102" class="ptxt small" fill="#a3a1c9">${a.puesto}</text>`;
  return agentWrap(x, a, s);
}
function pixelRoom(R, ags) {
  const day = isDay(); let s = rc(0, 0, 200, 80, '#2f2c52') + rc(0, 80, 200, 40, '#4a3f63');
  for (let i = 0; i < 200; i += 20) s += rc(i, 80, 10, 14, '#43395b') + rc(i + 10, 94, 10, 14, '#43395b') + rc(i, 108, 10, 12, '#43395b');
  s += rc(0, 76, 200, 4, '#1d1b33') + rc(0, 30, 200, 1, '#35325c');
  s += rc(84, 8, 34, 26, '#1d1b33') + rc(86, 10, 30, 22, day ? '#8fd3ff' : '#15143c');
  s += day ? rc(106, 13, 6, 6, '#fff3a8') + rc(88, 25, 12, 3, '#ffffff') + rc(91, 22, 7, 3, '#ffffff') : rc(90, 14, 1, 1, '#fff') + rc(97, 24, 1, 1, '#fff') + rc(111, 27, 1, 1, '#fff') + rc(105, 13, 5, 5, '#ecebff') + rc(107, 13, 3, 3, '#15143c');
  s += rc(100, 10, 2, 22, '#1d1b33') + rc(86, 20, 30, 2, '#1d1b33') + rc(82, 34, 38, 2, '#55537e');
  s += rc(6, 8, 72, 13, '#1d1b33') + rc(6, 8, 3, 13, R.color) + `<text x="13" y="17.5" class="ptxt" fill="#ecebff">${R.short}</text>`;
  s += rc(130, 20, 44, 2, '#8a5a3c') + rc(133, 12, 4, 8, '#c0503a') + rc(138, 10, 4, 10, '#6fb3ff') + rc(143, 13, 4, 7, '#f6c453') + rc(148, 11, 3, 9, '#b08cff') + rc(160, 14, 8, 6, '#7b4f33') + rc(161, 9, 2, 5, '#6fdc8c') + rc(164, 7, 2, 7, '#6fdc8c') + rc(166, 10, 2, 4, '#6fdc8c');
  s += rc(182, 10, 12, 12, '#1d1b33') + rc(183, 11, 10, 10, '#ecebff') + rc(188, 13, 1, 4, '#1d1b33') + rc(188, 16, 3, 1, '#1d1b33');
  s += rc(6, 26, 22, 3, R.color) + rc(30, 26, 10, 3, '#55537e');
  ags.forEach((a, i) => { s += pixelDesk(4 + i * 48, a); });
  return s;
}
function animeDesk(x, a) {
  const c = x + 23, dot = {work: '#5b8def', wait: '#ff7eb6', queue: '#2fae7a', sleep: '#c9b8d6'}[a.s];
  let s = `<rect x="${c - 11}" y="52" width="22" height="26" rx="8" fill="#e9d5f5"/>`;
  s += `<path d="M${c - 9} 80 Q${c - 9} 64 ${c} 64 Q${c + 9} 64 ${c + 9} 80Z" fill="${a.shirt}"/>`;
  s += `<ellipse cx="${c}" cy="51" rx="12.5" ry="12" fill="${a.hair}"/><circle cx="${c}" cy="53" r="10" fill="#ffe6d6"/>`;
  s += `<path d="M${c - 10.5} 52 Q${c - 9} 40 ${c} 42 Q${c + 9} 40 ${c + 10.5} 52 Q${c + 5} 45.5 ${c + 1} 48 Q${c - 4} 44.5 ${c - 10.5} 52Z" fill="${a.hair}"/>`;
  if (a.s === 'sleep') {
    s += `<path d="M${c - 6.5} 55 q2 2 4 0 M${c + 2.5} 55 q2 2 4 0" stroke="#5a3c50" stroke-width=".9" fill="none" stroke-linecap="round"/><ellipse cx="${c}" cy="59" rx="1.2" ry="1" fill="#e98aa0"/>`;
    s += `<text x="${c + 12}" y="44" class="atxt zzz" fill="#b9a3cc">z</text><text x="${c + 16}" y="38" class="atxt small zzz" style="animation-delay:.8s" fill="#b9a3cc">z</text>`;
  } else {
    s += `<g class="blink" style="transform-origin:${c}px 55px"><ellipse cx="${c - 4.5}" cy="55" rx="2" ry="2.8" fill="#4a2f5e"/><ellipse cx="${c + 4.5}" cy="55" rx="2" ry="2.8" fill="#4a2f5e"/><circle cx="${c - 5.1}" cy="54" r=".8" fill="#fff"/><circle cx="${c + 3.9}" cy="54" r=".8" fill="#fff"/></g>`;
    s += `<path d="M${c - 1.6} 59.5 q1.6 1.6 3.2 0" stroke="#c0506e" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
    if (a.s === 'wait') s += `<g><rect x="${c + 11}" y="33" width="12" height="12" rx="6" fill="#ff7eb6"/><path d="M${c + 13} 44 l-2 4 5 -3z" fill="#ff7eb6"/><rect x="${c + 16.3}" y="35.5" width="1.6" height="5" rx=".8" fill="#fff"/><circle cx="${c + 17.1}" cy="42.3" r=".9" fill="#fff"/></g>`;
    if (a.s === 'queue') s += `<g><rect x="${c + 11}" y="33" width="12" height="12" rx="6" fill="#2fae7a"/><path d="M${c + 14} 39 l2.2 2.4 4-4.6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    if (a.s === 'work') s += `<g class="pulse" fill="#ffb347"><path d="M${c + 14} 40 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1-2.4 -2.4-1 2.4-1z"/><circle cx="${c - 14}" cy="46" r="1.2"/></g>`;
  }
  s += `<ellipse cx="${c - 7}" cy="58.5" rx="2.2" ry="1.3" fill="#ffb3c7" opacity=".65"/><ellipse cx="${c + 7}" cy="58.5" rx="2.2" ry="1.3" fill="#ffb3c7" opacity=".65"/>`;
  s += `<rect x="${x + 2}" y="72" width="42" height="6" rx="3" fill="#f2c9a1"/><rect x="${x + 5}" y="78" width="3" height="9" rx="1.5" fill="#dba97c"/><rect x="${x + 38}" y="78" width="3" height="9" rx="1.5" fill="#dba97c"/>`;
  s += `<rect x="${c - 9}" y="62" width="18" height="11" rx="2" fill="#fff" stroke="#d9c7e6" stroke-width=".8"/><circle cx="${c}" cy="67.5" r="1.6" fill="${a.s === 'work' ? '#5b8def' : '#e3d3ee'}" ${a.s === 'work' ? 'class="pulse"' : ''}/>`;
  if (a.s !== 'sleep') s += `<g class="${a.s === 'work' ? 'typing' : ''}"><circle cx="${c - 11}" cy="72" r="2.2" fill="#ffe6d6"/></g><g class="${a.s === 'work' ? 'typing' : ''}" style="animation-delay:.25s"><circle cx="${c + 11}" cy="72" r="2.2" fill="#ffe6d6"/></g>`;
  s += `<rect x="${x + 37}" y="67" width="5" height="5" rx="1.5" fill="#ff9fc4"/>`;
  s += `<circle cx="${x + 6}" cy="94.5" r="2" fill="${dot}" ${a.s === 'work' ? 'class="pulse"' : ''}/><text x="${x + 10}" y="97" class="atxt" fill="#3b2c4a">${a.nombre}</text><text x="${x + 4}" y="104.5" class="atxt small" fill="#8a7699">${a.puesto}</text>`;
  return agentWrap(x, a, s);
}
function animeRoom(R, ags, k) {
  const day = isDay();
  let s = `<defs><linearGradient id="w${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9f2"/><stop offset="1" stop-color="#f1e6ff"/></linearGradient><linearGradient id="k${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${day ? '#9fd8ff' : '#2a2560'}"/><stop offset="1" stop-color="${day ? '#e6f6ff' : '#6a4f9c'}"/></linearGradient></defs>`;
  s += `<rect width="200" height="84" fill="url(#w${k})"/><rect y="84" width="200" height="36" fill="#f7e2cf"/><rect y="82" width="200" height="3" fill="#ecc9ad"/>`;
  for (let i = 0; i < 200; i += 25) s += `<rect x="${i}" y="85" width=".6" height="35" fill="#ecd0b8"/>`;
  s += `<rect x="82" y="7" width="38" height="28" rx="6" fill="#fff"/><rect x="84.5" y="9.5" width="33" height="23" rx="4" fill="url(#k${k})"/>`;
  s += day ? `<circle cx="110" cy="16" r="3.5" fill="#fff6b8"/><ellipse cx="94" cy="25" rx="6" ry="2.6" fill="#fff"/><ellipse cx="98" cy="23" rx="4" ry="2.4" fill="#fff"/>` : `<circle cx="109" cy="16" r="3.5" fill="#fff8d6"/><circle cx="110.6" cy="15" r="3" fill="#3a3070"/><circle cx="91" cy="15" r=".7" fill="#fff"/><circle cx="98" cy="24" r=".6" fill="#fff"/><circle cx="103" cy="13" r=".5" fill="#fff"/>`;
  s += `<rect x="100.3" y="9.5" width="1.4" height="23" fill="#fff"/>`;
  s += `<rect x="6" y="8" width="70" height="14" rx="7" fill="#fff"/><circle cx="14" cy="15" r="3.2" fill="${R.color}"/><text x="21" y="17.5" class="atxt" fill="#3b2c4a">${R.short}</text>`;
  s += `<rect x="130" y="22" width="44" height="2.4" rx="1.2" fill="#e8b98e"/><rect x="133" y="12" width="4.5" height="10" rx="1" fill="#ff9fc4"/><rect x="138.5" y="10" width="4.5" height="12" rx="1" fill="#9ec5ff"/><rect x="144" y="13" width="4.5" height="9" rx="1" fill="#ffd27a"/><rect x="159" y="15" width="9" height="7" rx="2" fill="#ffc7a8"/><path d="M163.5 15 q-5-7 0-9 q5 2 0 9z" fill="#7fd6a4"/><path d="M163.5 15 q5-4 6 0z M163.5 15 q-5-4 -6 0z" fill="#59c08a"/>`;
  s += `<circle cx="188" cy="16" r="6.5" fill="#fff" stroke="#f3d3e2"/><path d="M188 12.5 v3.5 h2.6" stroke="#8a7699" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  s += `<g fill="#ffc2d9" opacity=".8"><circle cx="30" cy="30" r="1.3"/><circle cx="52" cy="36" r="1"/><circle cx="150" cy="34" r="1.2"/><circle cx="176" cy="30" r=".9"/></g>`;
  ags.forEach((a, i) => { s += animeDesk(4 + i * 48, a); });
  return s;
}

// ---------- pintar ----------
function style() { return document.body.dataset.style; }
function render() {
  const pix = style() === 'pixel';
  $('rooms').innerHTML = REPOS.map((R, k) => `<div class="room"><svg viewBox="0 0 200 112" role="group" aria-label="Equipo de ${esc(R.short)}">${pix ? pixelRoom(R, agents(R)) : animeRoom(R, agents(R), k)}</svg></div>`).join('');
  document.querySelectorAll('[data-setstyle]').forEach(b => b.classList.toggle('on', b.dataset.setstyle === style()));
  let inbox = '', pipe = '', ideas = '', n = 0;
  for (const R of REPOS) {
    const d = state.repos[R.name]; if (!d) continue;
    for (const p of d.prs) { n++; inbox += item(R, p, 't-pr', 'PR listo', `<a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">Revisar y fusionar en GitHub</a>`); }
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
      <dt>Ahora</dt><dd>${esc(a.t)}</dd>
      ${e && e.tarea && e.tarea !== '—' ? `<dt>Tarea</dt><dd>${esc(e.tarea)}</dd>` : ''}
      ${e && e.paso && a.s !== 'work' ? `<dt>Último paso</dt><dd>${esc(e.paso)}</dd>` : ''}
      <dt>Modelo</dt><dd>${a.modelo}</dd>
      <dt>Turno</dt><dd>${role === 'revisor' ? 'Justo después del Dev' : R.turnos[role] + ' (Santiago)'}</dd>
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
    <small>Créala en GitHub → Settings → Developer settings → Fine-grained tokens. Acceso solo a <b>hierro-y-ceniza</b> y <b>speech-therapy-hub</b>, permiso <b>Issues: Read and write</b> y nada más. Se guarda únicamente en este navegador; bórrala dejando el campo vacío.</small>
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
    box.innerHTML = (cs.map(c => `<div class="msg ${isBot(c) ? 'bot' : 'me'}"><b>${isBot(c) ? 'Consejero' : 'Tú'} · ${ago(c.created_at)}</b>${esc(c.body.replace(/^\s*🤖\s*[^:]*:\s*/, ''))}</div>`).join('') || '<p class="empty">El Consejero aún no responde. Lo hará en su turno, o háblale en vivo desde la oficina.</p>')
      + `<form data-reply="${repo}/${n}"><label for="r-${repo}-${n}">Tu respuesta</label><textarea id="r-${repo}-${n}" required></textarea><button class="primary" type="submit">Responder</button></form>`;
  } catch (e) { box.innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}
function newIssue(repo, title, body, label) {
  const url = `https://github.com/${OWNER}/${repo}/issues/new?labels=${encodeURIComponent(label)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  if (needToken(url)) return Promise.resolve(false);
  return act(() => gh(`${repo}/issues`, {method: 'POST', body: {title, body, labels: [label]}}), 'Enviado.').then(() => true);
}

document.addEventListener('click', e => {
  const ag = e.target.closest('.agent'); if (ag) return openAgent(ag.dataset.repo, ag.dataset.role);
  if (e.target.closest('[data-close]') || e.target === $('sheet')) return $('sheet').close();
  const st = e.target.closest('[data-setstyle]'); if (st) { document.body.dataset.style = st.dataset.setstyle; store.set('fabrica-style', st.dataset.setstyle); return render(); }
  const tb = e.target.closest('[data-tab]');
  if (tb) { document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tb.dataset.tab; }); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === tb)); window.scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const {act: a, repo, n} = b.dataset, web = `https://github.com/${OWNER}/${repo}/issues/${n}`;
  if (a === 'hilo') return showThread(repo, n);
  if (needToken(web)) return;
  if (a === 'aprobar') act(() => gh(`${repo}/issues/${n}/labels`, {method: 'POST', body: {labels: ['fabrica:aprobada']}}), `#${n} aprobada. El Dev la toma en su próximo turno.`);
  if (a === 'rechazar' && confirm(`¿Rechazar y cerrar la propuesta #${n}?`)) act(() => gh(`${repo}/issues/${n}`, {method: 'PATCH', body: {state: 'closed', state_reason: 'not_planned'}}), `#${n} rechazada. No la volverán a proponer.`);
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('agent')) { e.preventDefault(); openAgent(e.target.dataset.repo, e.target.dataset.role); } });
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

document.body.dataset.style = store.get('fabrica-style', 'pixel');
for (const id of ['t-repo', 'i-repo']) $(id).innerHTML = REPOS.map(R => `<option value="${R.name}">${R.name}</option>`).join('');
render(); setInterval(render, 60000);
if (Date.now() - state.fetchedAt > 60000) load(); else schedule();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
