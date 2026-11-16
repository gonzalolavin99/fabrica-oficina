'use strict';
// Oficina vista desde arriba. Los agentes caminan entre su escritorio y la zona común según su estado.
const Scene = (() => {
  const W = 288, H = 224, SC = 4;
  const TH = {
    pixel: {id: 'pixel', wood: '#c8a071', wood2: '#b98f62', woodLine: '#a67d53', tile: '#dfe6e2', tile2: '#cfd9d4', wall: '#4b3f5e', wallFace: '#7d6a94', wallTrim: '#5e4f75', desk: '#8a5a3c', deskTop: '#b9824f', chair: '#3d5a80', rug: '#c0503a', rug2: '#d9785f', sofa: '#3a7ca5', sofa2: '#2f6690', metal: '#9aa5b1', plant: '#4f9d69', plant2: '#3b7d52', pot: '#b5651d', text: '#ffffff', tag: 'rgba(20,16,34,.75)', skin: '#f3cfae', pants: '#2f2a45', screenOff: '#1b1a2e', glass: null},
    oscuro: {id: 'oscuro', wood: '#26262e', wood2: '#212128', woodLine: '#18181d', tile: '#1c1c22', tile2: '#17171c', wall: '#08080b', wallFace: '#1b1b22', wallTrim: '#8a1326', desk: '#15151a', deskTop: '#2f2f3a', chair: '#3a0d16', rug: '#5c0f1c', rug2: '#8a1326', sofa: '#2a2a34', sofa2: '#1d1d25', metal: '#4a4a57', plant: '#2f5d47', plant2: '#22463a', pot: '#3a3a46', text: '#f2e9ea', tag: 'rgba(0,0,0,.7)', skin: '#e8c9b0', pants: '#0d0d11', screenOff: '#050507', glass: '#12091a'},
  };
  const DESK = [[12, 36], [52, 36], [92, 36], [28, 72], [82, 72]]; // por puesto, relativo a la sala
  const ORDER = ['explorador', 'consejero', 'dev', 'revisor', 'seguridad'];
  const ROOM_X = [6, 148], DOOR = [73, 215];
  const SPOTS = [
    {x: 24, y: 147, act: 'Tomando un café', prop: 'mug'}, {x: 40, y: 147, act: 'Tomando un café', prop: 'mug'},
    {x: 74, y: 146, act: 'Tomando agua', prop: 'mug'}, {x: 122, y: 172, act: 'Jugando a la consola', sofa: 1, prop: 'pad'},
    {x: 137, y: 172, act: 'Jugando a la consola', sofa: 1, prop: 'pad'}, {x: 152, y: 172, act: 'Mirando la partida', sofa: 1},
    {x: 196, y: 142, act: 'Hojeando un libro'}, {x: 58, y: 198, act: 'Estirando las piernas'},
    {x: 178, y: 202, act: 'Regando la planta'}, {x: 98, y: 206, act: 'Dando una vuelta'}, {x: 262, y: 204, act: 'Mirando por la ventana'},
  ];
  const TABLE = [{x: 216, y: 166}, {x: 258, y: 166}];
  let cv, cx, theme = TH.pixel, bg = null, bgKey = '', ags = [], tick = 0, getState, roles, isDay = () => true, still = false;
  const R = (x, y, w, h, f, c = cx) => { c.fillStyle = f; c.fillRect(x, y, w, h); };
  const seatOf = (k, role) => { const d = DESK[ORDER.indexOf(role)]; return {x: ROOM_X[k] + d[0] + 15, y: d[1] + 19}; };
  const zone = p => p.y < 104 ? (p.x < 144 ? 0 : 1) : 2;
  const aisle = y => y < 64 ? 62 : 98;
  function route(from, to) {
    const p = [], zf = zone(from), zt = zone(to);
    if (zf !== zt) {
      if (zf !== 2) p.push({x: from.x, y: aisle(from.y)}, {x: DOOR[zf], y: aisle(from.y)}, {x: DOOR[zf], y: 112});
      if (zt !== 2) p.push({x: DOOR[zt], y: 112}, {x: DOOR[zt], y: aisle(to.y)}, {x: to.x, y: aisle(to.y)});
      else p.push({x: to.x, y: 112});
    } else if (zf === 2) p.push({x: to.x, y: from.y});
    else p.push({x: from.x, y: aisle(from.y)}, {x: to.x, y: aisle(from.y)});
    p.push({x: to.x, y: to.y}); return p;
  }

  // ---------- fondo (se dibuja una vez por tema) ----------
  function drawBg() {
    const key = theme.id + (isDay() ? 'd' : 'n'); if (bg && bgKey === key) return; bgKey = key;
    bg = document.createElement('canvas'); bg.width = W * SC; bg.height = H * SC; const c = bg.getContext('2d'); c.scale(SC, SC);
    const r = (x, y, w, h, f) => R(x, y, w, h, f, c), t = theme, dark = t.id === 'oscuro', day = isDay() && !dark;
    r(0, 0, W, H, t.wall);
    for (const k of [0, 1]) { // salas con piso de madera
      const x0 = ROOM_X[k]; r(x0, 18, 134, 84, t.wood);
      for (let y = 18; y < 102; y += 7) { r(x0, y, 134, 1, t.woodLine); for (let x = x0 + ((y / 7) % 2 ? 12 : 34); x < x0 + 134; x += 44) r(x, y, 1, 7, t.woodLine); }
      for (let y = 25; y < 102; y += 14) r(x0, y - 6, 134, 6, t.wood2 + '55');
      r(x0, 4, 134, 14, t.wallFace); r(x0, 16, 134, 2, t.wallTrim);
      for (const wx of [x0 + 54, x0 + 96]) { r(wx, 5, 26, 10, t.wall); r(wx + 1, 6, 24, 8, dark ? '#160a1c' : day ? '#8fd3ff' : '#1c1a4a'); if (dark && k === 1 && wx > x0 + 60) { r(wx + 15, 7, 6, 6, '#c2182f'); r(wx + 16, 8, 4, 4, '#e3344b'); } else if (day) { r(wx + 4, 10, 8, 2, '#fff'); r(wx + 6, 8, 5, 2, '#fff'); } else { r(wx + 5, 8, 1, 1, '#fff'); r(wx + 14, 11, 1, 1, '#fff'); r(wx + 20, 7, 1, 1, '#fff'); } r(wx + 12, 6, 1, 8, t.wall); }
      r(x0 + 4, 5, 44, 10, dark ? '#0b0b0f' : '#2c2540'); r(x0 + 4, 5, 2, 10, REPOCOLORS[k]);
      c.fillStyle = t.text; c.font = 'bold 5px ui-monospace,Menlo,monospace'; c.textBaseline = 'middle'; c.fillText(REPONAMES[k], x0 + 9, 10.5);
      r(x0 + 122, 22, 9, 22, dark ? '#101014' : '#6b4a2f'); for (let i = 0; i < 4; i++) r(x0 + 123, 24 + i * 5, 7, 3, ['#c0503a', '#6fb3ff', '#f6c453', '#6fdc8c'][i]); // estante
      r(x0 + 3, 86, 8, 8, t.pot); r(x0 + 2, 80, 10, 8, t.plant); r(x0 + 4, 77, 6, 4, t.plant2);
      DESK.forEach(([dx, dy]) => { const x = x0 + dx; r(x + 9, dy + 13, 12, 9, t.chair); r(x + 10, dy + 20, 10, 3, dark ? '#22060c' : '#2c4463'); r(x, dy + 1, 30, 12, t.desk); r(x, dy, 30, 10, t.deskTop); r(x + 10, dy + 6, 10, 3, dark ? '#0c0c10' : '#2f2a45'); r(x + 24, dy + 2, 3, 3, '#f4f1ea'); r(x + 2, dy + 5, 4, 4, '#f4f1ea'); r(x + 3, dy + 6, 2, 1, '#9aa5b1'); });
    }
    r(140, 0, 8, 104, t.wall); r(0, 100, W, 4, t.wall); r(0, 0, 6, H, t.wall); r(282, 0, 6, H, t.wall); r(0, 220, W, 4, t.wall);
    r(6, 104, 276, 116, t.tile); for (let y = 104; y < 220; y += 12) for (let x = 6 + ((y - 104) / 12 % 2 ? 12 : 0); x < 282; x += 24) r(x, y, 12, Math.min(12, 220 - y), t.tile2);
    for (const k of [0, 1]) { r(DOOR[k] - 8, 100, 16, 4, t.wood); r(DOOR[k] - 8, 100, 1, 4, t.wallTrim); r(DOOR[k] + 7, 100, 1, 4, t.wallTrim); }
    r(104, 148, 66, 40, t.rug); r(106, 150, 62, 36, t.rug2); r(108, 152, 58, 32, t.rug); // alfombra
    r(10, 122, 44, 13, t.desk); r(10, 120, 44, 11, dark ? '#3a3a46' : '#e9e4da'); r(14, 114, 12, 13, dark ? '#0d0d11' : '#3a3540'); r(16, 116, 8, 4, dark ? '#26262e' : '#59535f'); r(22, 123, 2, 2, '#e3344b'); r(30, 121, 5, 5, '#f4f1ea'); r(37, 121, 5, 5, '#f4f1ea'); r(44, 120, 8, 6, dark ? '#55101c' : '#d98e4a'); // café
    r(68, 116, 10, 20, t.metal); r(69, 112, 8, 8, dark ? '#274a66' : '#9fd8ff'); r(71, 126, 4, 3, '#1b1a2e'); // agua
    r(116, 112, 40, 4, dark ? '#0d0d11' : '#3a3540'); r(120, 116, 32, 4, t.desk); // mueble TV
    r(128, 122, 16, 5, dark ? '#101014' : '#2c2540'); r(133, 123, 2, 2, '#6fb3ff'); // consola
    r(188, 110, 26, 22, dark ? '#101014' : '#6b4a2f'); for (let i = 0; i < 12; i++) r(190 + (i % 6) * 4, 112 + (i > 5 ? 10 : 0), 3, 8, ['#c0503a', '#6fb3ff', '#f6c453', '#6fdc8c', '#b08cff', '#e3344b'][(i * 5) % 6]);
    r(222, 150, 30, 30, t.desk); r(220, 152, 34, 26, t.desk); r(222, 148, 30, 28, t.deskTop); r(220, 150, 34, 24, t.deskTop); r(231, 156, 12, 9, '#f4f1ea'); r(233, 158, 8, 1, '#9aa5b1'); r(233, 160, 6, 1, '#9aa5b1'); // mesa del CEO
    c.fillStyle = dark ? '#e3344b' : '#2c2540'; c.font = 'bold 4px ui-monospace,Menlo,monospace'; c.textAlign = 'center'; c.fillText('MESA DEL CEO', 237, 186); c.textAlign = 'left';
    for (const [px, py] of [[170, 206], [270, 114], [10, 206]]) { r(px, py + 6, 8, 7, t.pot); r(px - 2, py - 2, 12, 9, t.plant); r(px, py - 6, 8, 6, t.plant2); r(px + 3, py - 9, 3, 4, t.plant); }
    r(240, 216, 36, 4, dark ? '#160a1c' : day ? '#8fd3ff' : '#1c1a4a'); r(84, 216, 36, 4, dark ? '#160a1c' : day ? '#8fd3ff' : '#1c1a4a');
    if (dark) { r(6, 104, 276, 1, '#8a1326'); for (const [lx, ly] of [[60, 118], [176, 118]]) { r(lx, ly - 6, 2, 6, '#3a3a46'); r(lx - 2, ly, 6, 7, '#e3344b'); r(lx - 1, ly + 1, 4, 5, '#ff8a5c'); } }
  }

  // ---------- personajes ----------
  function person(a) {
    const m = roles[a.role], t = theme, dark = t.id === 'oscuro', x = Math.round(a.x) - 4, moving = a.path.length > 0;
    let y = Math.round(a.y) - 12; const up = a.face === 'up', step = moving && (tick >> 1) % 2, sit = a.seated && !moving;
    const hair = dark ? m.hairD : m.hair, body = dark ? '#0e0e13' : m.shirt, eye = dark ? '#e3344b' : '#2a2030';
    if (!sit) R(x, y + 12, 8, 2, 'rgba(0,0,0,.28)'); else y -= 1;
    if (!sit) { R(x + 1, y + 10, 2, step ? 1 : 2, t.pants); R(x + 5, y + 10, 2, step ? 2 : 1 + (moving ? 0 : 1), t.pants); }
    R(x, y + 6, 8, sit ? 5 : 4, body);
    if (dark) { R(x, y + 6, 8, 1, m.shirt); if (!up) R(x + 3, y + 7, 2, 3, '#8a1326'); }
    const typing = sit && a.s === 'work' ? (tick % 2) : 0;
    if (up) { R(x - 1, y + 6 - typing, 1, 3, t.skin); R(x + 8, y + 6 - (sit && a.s === 'work' ? 1 - typing : 0), 1, 3, t.skin); R(x + 1, y, 6, 6, hair); R(x + 2, y + 6, 4, 1, hair); }
    else { R(x - 1, y + 7, 1, 3, t.skin); R(x + 8, y + 7, 1, 3, t.skin); R(x + 1, y + 2, 6, 4, t.skin); R(x + 1, y, 6, 3, hair); R(x, y + 1, 1, 3, hair); R(x + 7, y + 1, 1, 3, hair); if (tick % 40 > 1) { R(x + 2, y + 4, 1, 1, eye); R(x + 5, y + 4, 1, 1, eye); } }
    if (dark) { R(x, y, 1, 2, hair); R(x + 7, y, 1, 2, hair); R(x + 2, y - 1, 1, 1, hair); R(x + 5, y - 1, 1, 1, hair); R(x - 1, y + 2, 1, 2, hair); R(x + 8, y + 2, 1, 2, hair); if (!up) R(x + 1, y + 3, 2, 1, hair); }
    if (!moving && a.prop === 'mug') { R(x + 8, y + 6, 3, 3, '#f4f1ea'); if (tick % 6 < 3) R(x + 9, y + 3, 1, 2, 'rgba(255,255,255,.6)'); }
    if (!moving && a.prop === 'pad') R(x + 2, y + 9, 4, 2, '#f4f1ea');
    if (!moving && a.s === 'wait') { const b = dark ? '#e3344b' : '#f6c453'; R(x + 9, y - 9, 7, 8, b); R(x + 9, y - 1, 2, 2, b); R(x + 12, y - 8, 1, 4, '#14101f'); R(x + 12, y - 3, 1, 1, '#14101f'); }
    if (!moving && a.s === 'queue') { R(x + 9, y - 8, 7, 7, '#6fdc8c'); R(x + 11, y - 5, 1, 1, '#0c2a1b'); R(x + 12, y - 4, 1, 1, '#0c2a1b'); R(x + 13, y - 6, 1, 2, '#0c2a1b'); }
    cx.font = 'bold 5px ui-monospace,Menlo,monospace'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    const w = cx.measureText(m.nombre).width + 4; R(Math.round(a.x - w / 2), y - 9, Math.round(w), 7, t.tag);
    R(Math.round(a.x - w / 2), y - 2, Math.round(w), 1, REPOCOLORS[a.k]);
    if (a.s === 'work') R(Math.round(a.x - w / 2), y - 9, 1, 7, '#6fb3ff');
    cx.fillStyle = t.text; cx.fillText(m.nombre, Math.round(a.x), y - 3.5); cx.textAlign = 'left';
  }
  function dynamic() {
    const t = theme, dark = t.id === 'oscuro';
    for (const a of ags) { // monitores
      const d = DESK[ORDER.indexOf(a.role)], x = ROOM_X[a.k] + d[0] + 8, y = d[1] - 4, on = a.seated && !a.path.length;
      R(x, y, 14, 9, dark ? '#000' : '#2c2540'); R(x + 1, y + 1, 12, 7, on && a.s === 'work' ? (dark ? '#1a0508' : '#0f2a4a') : on ? '#3b3460' : t.screenOff); R(x + 5, y + 9, 4, 2, t.metal);
      if (on && a.s === 'work') for (let i = 0; i < 3; i++) R(x + 2, y + 2 + i * 2, 3 + ((tick + i * 3 + a.k) % 7), 1, dark ? ['#e3344b', '#ff8a5c', '#f2e9ea'][i] : ['#6fdc8c', '#6fb3ff', '#f6c453'][i]);
    }
    const playing = ags.some(a => a.spot && a.spot.sofa && !a.path.length);
    R(120, 106, 32, 10, dark ? '#000' : '#1b1a2e'); R(121, 107, 30, 8, playing ? (dark ? '#14060a' : '#123a2a') : t.screenOff);
    if (playing) { const p = tick % 24, bx = 122 + (p < 12 ? p * 2.2 : (24 - p) * 2.2); R(Math.round(bx), 109 + (tick % 5), 2, 2, '#fff'); R(122, 108 + (tick % 4), 1, 4, '#f6c453'); R(149, 110 - (tick % 3), 1, 4, dark ? '#e3344b' : '#6fb3ff'); }
    if (tick % 8 < 5) { R(19, 110 - (tick % 4), 1, 2, 'rgba(255,255,255,.45)'); R(21, 111 - ((tick + 2) % 4), 1, 2, 'rgba(255,255,255,.3)'); }
  }
  function sofaFront() { const t = theme; R(112, 176, 50, 9, t.sofa); R(112, 183, 50, 3, t.sofa2); R(110, 168, 4, 18, t.sofa2); R(160, 168, 4, 18, t.sofa2); }
  function sofaBack() { R(114, 164, 46, 14, theme.sofa); R(114, 164, 46, 2, theme.sofa2); }

  // ---------- lógica ----------
  function target(a) {
    if (a.s === 'work' || a.s === 'queue' || (a.s === 'wait' && a.role !== 'consejero')) return {pos: seatOf(a.k, a.role), seated: a.s !== 'wait', spot: null};
    if (a.s === 'wait') return {pos: TABLE[a.k], seated: false, spot: null};
    if (!a.spot || Date.now() > a.until) { const used = new Set(ags.filter(o => o !== a && o.spot).map(o => o.spot)), free = SPOTS.filter(s => !used.has(s)); a.spot = free[Math.floor(Math.random() * free.length)]; a.until = Date.now() + 25000 + Math.random() * 35000; }
    return {pos: a.spot, seated: !!a.spot.sofa, spot: a.spot};
  }
  function sync(first) {
    const st = getState();
    st.forEach((team, k) => team.forEach(s => {
      let a = ags.find(o => o.k === k && o.role === s.role);
      if (!a) { a = {k, role: s.role, x: 0, y: 0, path: [], face: 'down', spot: null, until: 0, goal: null}; ags.push(a); }
      a.s = s.s; if (a.s !== 'sleep') a.spot = null;
      const tg = target(a); a.wantSeat = tg.seated; a.prop = tg.spot ? tg.spot.prop : null;
      if (!a.goal || a.goal.x !== tg.pos.x || a.goal.y !== tg.pos.y) {
        a.goal = {x: tg.pos.x, y: tg.pos.y};
        if (first || still || !a.x) { a.x = tg.pos.x; a.y = tg.pos.y; a.path = []; } else { a.path = route(a, a.goal); a.seated = false; }
      }
    }));
  }
  function stepAll() {
    for (const a of ags) {
      if (a.path.length) {
        const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), v = 2.2;
        if (d <= v) { a.x = p.x; a.y = p.y; a.path.shift(); } else { a.x += dx / d * v; a.y += dy / d * v; a.face = Math.abs(dy) > Math.abs(dx) && dy < 0 ? 'up' : 'down'; }
      } else { a.seated = a.wantSeat; a.face = a.seated || (a.spot && a.spot.sofa) ? 'up' : 'down'; if (a.s === 'wait') a.face = 'down'; }
    }
  }
  function frame() {
    tick++; if (tick % 10 === 0) sync(false); stepAll(); drawBg();
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(bg, 0, 0); cx.setTransform(SC, 0, 0, SC, 0, 0);
    dynamic(); sofaBack();
    [...ags].sort((a, b) => a.y - b.y).forEach(person);
    if (ags.some(a => a.spot && a.spot.sofa && !a.path.length)) sofaFront(); else { sofaFront(); }
  }
  let REPONAMES = [], REPOCOLORS = [];
  return {
    init(canvas, opts) {
      cv = canvas; cv.width = W * SC; cv.height = H * SC; cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
      getState = opts.getState; roles = opts.roles; isDay = opts.isDay; REPONAMES = opts.names; REPOCOLORS = opts.colors;
      still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sync(true); frame();
      setInterval(() => { if (!document.hidden) frame(); }, still ? 2000 : 110);
    },
    setTheme(id) { theme = TH[id] || TH.pixel; bg = null; if (cx) frame(); },
    refresh() { if (cx) { sync(false); frame(); } },
    pick(clientX, clientY) {
      const r = cv.getBoundingClientRect(), x = (clientX - r.left) / r.width * W, y = (clientY - r.top) / r.height * H;
      let best = null, bd = 18; for (const a of ags) { const d = Math.hypot(a.x - x, a.y - 6 - y); if (d < bd) { bd = d; best = a; } }
      return best && {k: best.k, role: best.role};
    },
    activity(k, role) { const a = ags.find(o => o.k === k && o.role === role); if (!a) return ''; if (a.path.length) return 'Caminando por la oficina'; return a.spot ? a.spot.act : ''; },
  };
})();
