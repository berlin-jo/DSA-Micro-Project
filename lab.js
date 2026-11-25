/* Route Lab: Dijkstra animation, A* comparison, road closures, alternative routes (Yen's k-shortest) on a real Coimbatore road graph. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const hav = (p, q) => { const r = x => x * Math.PI / 180, a = Math.sin(r(q[0] - p[0]) / 2) ** 2 + Math.cos(r(p[0])) * Math.cos(r(q[0])) * Math.sin(r(q[1] - p[1]) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); };

/* ---------- data ---------- */
const DATA = {
  cbe: { campus: false, center: [10.99, 76.86], zoom: 11,
    nodes: { airport: ['Coimbatore Airport', 11.0300, 77.0434], sitra: ['SITRA', 11.0237, 77.0160], hopes: ['Hopes College', 11.0246, 77.0000], lakshmi: ['Lakshmi Mills', 11.0145, 76.9730], gandhi: ['Gandhipuram', 11.0180, 76.9660], junction: ['Coimbatore Junction', 10.9990, 76.9660], town: ['Town Hall', 10.9975, 76.9588], ukkadam: ['Ukkadam', 10.9890, 76.9620], selva: ['Selvapuram', 10.9760, 76.9570], perur: ['Perur', 10.9760, 76.9150], alandurai: ['Alandurai', 10.9890, 76.8100], karunya: ['Karunya Nagar', 10.9360, 76.7440], siruvani: ['Siruvani Dam', 10.9400, 76.6580], rs: ['R.S. Puram', 11.0070, 76.9500], vadavalli: ['Vadavalli', 11.0230, 76.9040], thonda: ['Thondamuthur', 10.9930, 76.8520] },
    edges: [['airport', 'sitra', 'Avinashi Rd'], ['sitra', 'hopes', 'Avinashi Rd'], ['hopes', 'lakshmi', 'Avinashi Rd'], ['lakshmi', 'gandhi', 'Avinashi Rd'], ['gandhi', 'town', 'Siruvani Rd'], ['town', 'ukkadam', 'Siruvani Rd'], ['ukkadam', 'selva', 'Siruvani Rd'], ['selva', 'perur', 'Siruvani Rd'], ['perur', 'alandurai', 'Siruvani Rd'], ['alandurai', 'karunya', 'Siruvani Rd'], ['karunya', 'siruvani', 'Siruvani Rd'], ['gandhi', 'rs', 'Thondamuthur Rd'], ['rs', 'vadavalli', 'Thondamuthur Rd'], ['vadavalli', 'thonda', 'Thondamuthur Rd'], ['thonda', 'alandurai', 'Thondamuthur Rd'], ['junction', 'gandhi', 'Railway Station Rd'], ['junction', 'town', 'Big Bazaar St'], ['rs', 'town', 'Dr Nanjappa Rd'], ['lakshmi', 'junction', 'Trichy Rd link']] },
  campus: { campus: true, center: [10.9368, 76.7462], zoom: 16,
    nodes: { main: ['Main Gate', 10.9340, 76.7440], library: ['Library', 10.9362, 76.7458], maths: ['ADSA Block', 10.9380, 76.7478], lab: ['Computer Lab', 10.9398, 76.7466], cafe: ['Cafeteria', 10.9350, 76.7476], audi: ['Auditorium', 10.9376, 76.7494], bethesda: ['Bethesda Prayer Centre', 10.9322, 76.7458], immanual: ['Immanual Auditorium', 10.9326, 76.7432] },
    edges: [['main', 'library', 4], ['main', 'cafe', 3], ['library', 'maths', 2], ['library', 'audi', 5], ['maths', 'lab', 3], ['maths', 'cafe', 4], ['lab', 'audi', 4], ['cafe', 'audi', 6], ['bethesda', 'main', 4.1], ['bethesda', 'audi', 5.1], ['immanual', 'bethesda', 2.1], ['immanual', 'main', 3.1]] }
};

/* ---------- state ---------- */
let ds = 'cbe', G = null, closed = new Set(), ADJ = {}, K = 1, metric = 'dist', tab = 'route', altSel = 0;
let main = null, alts = [], cmpD = null, cmpA = null, anim = null, idx = 0, timer = null;
const COLORS = ['#a3e635', '#38bdf8', '#f5a524'];
const nm = id => G.nodes[id].name, unit = () => G.campus || metric === 'time' ? 'min' : 'km';
const fw = w => (Math.round(w * 10) / 10) + ' ' + unit();

/* ---------- map ---------- */
const map = L.map('map', { zoomControl: true }).setView(DATA.cbe.center, 11);
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
osmLayer.addTo(map);
const edgeLayer = L.layerGroup().addTo(map), routeLayer = L.layerGroup().addTo(map), nodeLayer = L.layerGroup().addTo(map), labLayer = L.layerGroup().addTo(map);

window.addEventListener('resize', () => map.invalidateSize());
setTimeout(() => map.invalidateSize(), 250);
setTimeout(() => map.invalidateSize(), 1000);

function build(key) {
  ds = key; const D = DATA[key]; closed = new Set(); altSel = 0;
  G = { campus: D.campus, nodes: {}, edges: [] };
  Object.entries(D.nodes).forEach(([id, n]) => G.nodes[id] = { id, name: n[0], pt: [n[1], n[2]] });
  D.edges.forEach(([a, b, x], i) => {
    const km = hav(G.nodes[a].pt, G.nodes[b].pt) * 1.3, e = { id: 'e' + i, a, b, km, min: km / 30 * 60, est: !D.campus, geom: [G.nodes[a].pt, G.nodes[b].pt] };
    if (D.campus) { e.w = x; e.road = 'path'; } else e.road = x;
    G.edges.push(e);
  });
  if (!D.campus) { const c = store.get('lab_cbe_v1', null); if (c) G.edges.forEach(e => { const v = c[e.a + '|' + e.b]; if (v) { e.km = v[0]; e.min = v[1]; e.geom = v[2]; e.est = false; } }); }
  const opt = Object.values(G.nodes).sort((a, b) => a.name.localeCompare(b.name)).map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('');
  $('labFrom').innerHTML = opt; $('labTo').innerHTML = opt;
  $('labFrom').value = D.campus ? 'main' : 'airport'; $('labTo').value = D.campus ? 'library' : 'siruvani';
  $('metricWrap').hidden = D.campus;
  edgeLayer.clearLayers(); nodeLayer.clearLayers();
  Object.values(G.nodes).forEach(n => n.m = L.circleMarker(n.pt, { radius: 6, color: '#fff', weight: 2, fillColor: '#0f172a', fillOpacity: 1 })
    .bindTooltip(esc(n.name), { permanent: true, direction: 'top', offset: [0, -6], className: 'stop' }).addTo(nodeLayer));
  map.setView(D.center, D.zoom);
  $('dataNote').textContent = D.campus ? 'schematic layout · weights in minutes' : 'estimated · loading road data…';
  recompute(); if (!D.campus && !store.get('lab_cbe_v1', null)) loadRoads();
}
async function loadRoads() {
  const out = {};
  await Promise.all(G.edges.map(async e => {
    try {
      const A = G.nodes[e.a].pt, B = G.nodes[e.b].pt, r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${A[1]},${A[0]};${B[1]},${B[0]}?overview=simplified&geometries=geojson`)).json(), rt = r.routes[0];
      out[e.a + '|' + e.b] = [rt.distance / 1000, rt.duration / 60 * 1.15, rt.geometry.coordinates.map(c => [c[1], c[0]])];
    } catch {}
  }));
  if (Object.keys(out).length === G.edges.length) { store.set('lab_cbe_v1', out); G.edges.forEach(e => { const v = out[e.a + '|' + e.b]; e.km = v[0]; e.min = v[1]; e.geom = v[2]; e.est = false; }); $('dataNote').textContent = 'real road distances (OSRM / OpenStreetMap)'; }
  else $('dataNote').textContent = 'estimated distances (straight line × 1.3): road service unreachable';
  if (ds === 'cbe') recompute();
}

/* ---------- graph search ---------- */
function buildAdj(ignoreClosed) {
  const adj = {}; Object.keys(G.nodes).forEach(n => adj[n] = []);
  G.edges.forEach(e => { if (!ignoreClosed && closed.has(e.id)) return; adj[e.a].push({ to: e.b, e }); adj[e.b].push({ to: e.a, e }); });
  return adj;
}
/* one search routine: Dijkstra (h = 0) or A* (h = straight-line × K, K = smallest weight-per-km so h never over-estimates) */
function search(s, t, o = {}) {
  const h = o.astar ? n => hav(G.nodes[n].pt, G.nodes[t].pt) * K : () => 0;
  const dist = {}, prev = {}, prevE = {}, done = new Set(), steps = [], order = [], open = new Set([s]);
  Object.keys(G.nodes).forEach(n => dist[n] = Infinity); dist[s] = 0;
  const snap = (cur, relax, html) => steps.push({ cur, relax: new Set(relax.map(r => r.e.id)), done: new Set(done), dist: { ...dist }, prev: { ...prev }, tree: new Set(Object.values(prevE).map(e => e.id)), html });
  if (o.steps) snap(null, [], `<b>Start:</b> ${esc(nm(s))} has distance 0. Every other location is ∞ (not reached yet).`);
  while (open.size) {
    let u = null, bf = Infinity; open.forEach(n => { const f = dist[n] + h(n); if (f < bf) { bf = f; u = n; } });
    open.delete(u); done.add(u); order.push(u);
    if (u === t) { if (o.steps) snap(u, [], `<b>Reached ${esc(nm(t))}.</b> Its distance <b>${fw(dist[t])}</b> is final, so the search stops.`); break; }
    const relax = [];
    for (const { to, e } of ADJ[u]) {
      if (done.has(to) || (o.banE && o.banE.has(e.id)) || (o.banN && o.banN.has(to))) continue;
      const nd = dist[u] + e.w, upd = nd < dist[to] - 1e-9; relax.push({ to, e, nd, old: dist[to], upd });
      if (upd) { dist[to] = nd; prev[to] = u; prevE[to] = e; open.add(to); }
    }
    if (o.steps) snap(u, relax, `<b>Check ${esc(nm(u))}</b>: it has the smallest unfinished distance (${fw(dist[u])}), so that distance is final.<ul>${relax.map(r => `<li>${esc(nm(r.to))}: ${fw(dist[u])} + ${fw(r.e.w)} = ${fw(r.nd)} ${r.upd ? (r.old === Infinity ? '(first time reached) → <b>set</b>' : `< ${fw(r.old)} → <b>shorter, update</b>`) : `≥ ${fw(r.old)} → keep old`}</li>`).join('') || '<li>No unfinished neighbours.</li>'}</ul>`);
  }
  if (!isFinite(dist[t])) return { path: null, edges: [], cost: Infinity, checked: order.length, order, steps };
  const path = [t], edges = []; while (path[0] !== s) { edges.unshift(prevE[path[0]]); path.unshift(prev[path[0]]); }
  return { path, edges, cost: dist[t], checked: order.length, order, steps };
}
function kShortest(s, t, k) {   // Yen's algorithm
  const first = search(s, t); if (!first.path) return [];
  const A = [first], B = [];
  for (let i = 1; i < k; i++) {
    const last = A[i - 1];
    for (let j = 0; j < last.path.length - 1; j++) {
      const root = last.path.slice(0, j + 1), rootE = last.edges.slice(0, j), banE = new Set(), banN = new Set(root.slice(0, -1));
      A.forEach(p => { if (p.path.length > j + 1 && root.every((n, x) => p.path[x] === n)) banE.add(p.edges[j].id); });
      const sp = search(root[j], t, { banE, banN }); if (!sp.path) continue;
      const c = { path: [...root.slice(0, -1), ...sp.path], edges: [...rootE, ...sp.edges], cost: rootE.reduce((a, e) => a + e.w, 0) + sp.cost };
      if (![...A, ...B].some(p => p.path.join() === c.path.join())) B.push(c);
    }
    if (!B.length) break; B.sort((a, b) => a.cost - b.cost); A.push(B.shift());
  }
  return A;
}

/* ---------- recompute everything ---------- */
function recompute() {
  stop(); metric = $('labMetric').value;
  G.edges.forEach(e => { if (!G.campus) e.w = metric === 'time' ? e.min : e.km; });
  K = Math.min(...G.edges.map(e => e.w / Math.max(hav(G.nodes[e.a].pt, G.nodes[e.b].pt), 1e-6)));
  ADJ = buildAdj(false);
  const s = $('labFrom').value, t = $('labTo').value;
  if (s === t) { main = null; alts = []; cmpD = cmpA = anim = null; }
  else { main = search(s, t); alts = kShortest(s, t, 3); cmpD = main; cmpA = search(s, t, { astar: true }); anim = search(s, t, { steps: true }); }
  idx = 0; altSel = Math.min(altSel, Math.max(alts.length - 1, 0));
  drawEdges(); renderRoute(); renderCompare(); renderClosures(); renderAnim(); refreshMap();
}

/* ---------- drawing ---------- */
function drawEdges() {
  edgeLayer.clearLayers(); labLayer.clearLayers();
  G.edges.forEach(e => {
    e.line = L.polyline(e.geom, { color: '#94a3b8', weight: 3, opacity: .75 }).bindTooltip(`${esc(e.road)}: ${esc(nm(e.a))} – ${esc(nm(e.b))}. Tap to close or reopen.`, { sticky: true }).on('click', () => toggle(e.id)).addTo(edgeLayer);
    const mid = e.geom[Math.floor(e.geom.length / 2)], txt = G.campus ? `${e.w} min` : `${e.km.toFixed(1)} km · ${Math.round(e.min)} min${e.est ? '*' : ''}`;
    L.marker(mid, { icon: L.divIcon({ className: '', html: `<div class="elab${closed.has(e.id) ? ' x' : ''}">${txt}</div>`, iconSize: [0, 0] }), interactive: false }).addTo(labLayer);
  });
}
function paint(st) {
  const s = $('labFrom').value, t = $('labTo').value;
  G.edges.forEach(e => { let c = '#94a3b8', w = 3, o = .75, d = null;
    if (closed.has(e.id)) { c = '#ef4444'; d = '4 8'; o = .95; } else if (st && st.tree.has(e.id)) { c = '#4ade80'; w = 4; o = 1; }
    if (st && st.relax.has(e.id) && !closed.has(e.id)) { c = '#fbbf24'; w = 6; o = 1; }
    e.line.setStyle({ color: c, weight: w, opacity: o, dashArray: d }); });
  Object.values(G.nodes).forEach(n => { let f = '#0f172a', r = 6;
    if (st) { if (st.done.has(n.id)) f = '#4ade80'; else if (isFinite(st.dist[n.id])) f = '#fbbf24'; if (n.id === st.cur) { f = '#38bdf8'; r = 11; } }
    else if (n.id === s) { f = '#22c55e'; r = 9; } else if (n.id === t) { f = '#ef4444'; r = 9; }
    n.m.setStyle({ fillColor: f }); n.m.setRadius(r);
    n.m.setTooltipContent(esc(n.name) + (st ? ` · ${isFinite(st.dist[n.id]) ? fw(st.dist[n.id]) : '∞'}` : '')); });
}
function showRoutes(list) {
  routeLayer.clearLayers();
  list.forEach(r => { if (!r.edges) return; r.edges.forEach(e => { L.polyline(e.geom, { color: '#020617', weight: r.w + 5, opacity: .5, interactive: false }).addTo(routeLayer); L.polyline(e.geom, { color: r.color, weight: r.w, opacity: r.o ?? 1, dashArray: r.dash || null, interactive: false }).addTo(routeLayer); }); });
}
function refreshMap() {
  routeLayer.clearLayers(); if (!main) return paint(null);
  if (tab === 'anim') { paint(anim.steps[idx]); if (idx === anim.steps.length - 1 && anim.path) showRoutes([{ edges: anim.edges, color: '#a3e635', w: 7 }]); }
  else { paint(null);
    if (tab === 'cmp') showRoutes([{ edges: cmpD.edges, color: '#38bdf8', w: 11, o: .9 }, { edges: cmpA.edges, color: '#a3e635', w: 5 }]);
    else if (tab === 'route') showRoutes(alts.map((a, i) => ({ edges: a.edges, color: COLORS[i], w: i === altSel ? 8 : 4, o: i === altSel ? 1 : .7, dash: i === altSel ? null : '7 7' })).reverse());
    else showRoutes([{ edges: main.edges, color: '#a3e635', w: 7 }]); }
}

/* ---------- Route tab: explanation + alternatives ---------- */
const pathHtml = r => r.path.map((n, i) => `${esc(nm(n))}${i < r.edges.length ? ` <i>—${Math.round(r.edges[i].w * 10) / 10}→</i> ` : ''}`).join('');
function renderRoute() {
  const why = $('why'), box = $('alts');
  if (!main) { why.innerHTML = '<p class="hint">Choose two different locations.</p>'; box.innerHTML = ''; return; }
  if (!main.path) { why.innerHTML = `<div class="note warn">⚠ No route exists${closed.size ? ' because the closed roads cut this network in two. Reopen a road in the Closures tab.' : '.'}</div>`; box.innerHTML = ''; return; }
  const base = (() => { const keep = ADJ; ADJ = buildAdj(true); const r = search($('labFrom').value, $('labTo').value); ADJ = keep; return r; })();
  const next = alts[1], lines = [];
  lines.push(`<b>Total ${fw(main.cost)}</b>: ${main.edges.map(e => Math.round(e.w * 10) / 10).join(' + ')} across ${main.edges.length} road${main.edges.length > 1 ? 's' : ''}.`);
  lines.push(next ? `Every other route is longer. The next best is <b>${fw(next.cost)}</b> (+${fw(next.cost - main.cost)}), via ${esc(nm(next.path[Math.min(1, next.path.length - 1)]))}.` : 'There is no other route between these two places.');
  if (closed.size) lines.push(base.path.join() !== main.path.join() ? `<b>Closed roads changed the route.</b> Without closures it would be ${pathHtml(base)} (${fw(base.cost)}). The detour costs <b>+${fw(main.cost - base.cost)}</b>.` : 'The closed roads are not on this route, so it is unchanged.');
  lines.push('Dijkstra picks the unfinished location with the smallest distance each time, so the first time it reaches the destination, that distance cannot be beaten.');
  why.innerHTML = `<h2>Why this route?</h2><div class="route-hero"><div class="path">${pathHtml(main)}</div></div><ul class="why">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
  box.innerHTML = alts.map((a, i) => `<button class="alt ${i === altSel ? 'sel' : ''}" data-i="${i}" style="--c:${COLORS[i]}"><div class="alt-top"><i></i><b>${i ? 'Alternative ' + i : 'Shortest'}</b><span class="alt-d">${fw(a.cost)}</span>${i ? `<span class="tag">+${fw(a.cost - main.cost)}</span>` : '<span class="tag ok">best</span>'}</div><small>${pathHtml(a)}</small></button>`).join('');
  box.querySelectorAll('.alt').forEach(b => b.onclick = () => { altSel = +b.dataset.i; renderRoute(); refreshMap(); });
}

/* ---------- Compare tab ---------- */
function renderCompare() {
  const o = $('cmpOut'); if (!main || !cmpA) { o.innerHTML = '<p class="hint">Choose two different locations.</p>'; return; }
  const row = (n, r, c) => `<div class="cmp" style="--c:${c}"><b>${n}</b>${r.path ? `<div class="path-s">${pathHtml(r)}</div><table class="etable"><tr><td>Route length</td><td><b>${fw(r.cost)}</b></td></tr><tr><td>Locations checked</td><td><b>${r.checked}</b> of ${Object.keys(G.nodes).length}</td></tr></table><small>Order: ${r.order.map(x => esc(nm(x))).join(' → ')}</small>` : '<p class="hint">No route.</p>'}</div>`;
  const same = cmpD.path && cmpA.path && Math.abs(cmpD.cost - cmpA.cost) < 1e-6, saved = cmpD.checked - cmpA.checked;
  o.innerHTML = row('Dijkstra <span class="muted">(blue, wide line)</span>', cmpD, '#38bdf8') + row('A* <span class="muted">(green, thin line)</span>', cmpA, '#a3e635') +
    `<div class="algo-stat">${!cmpD.path ? 'Neither algorithm finds a route.' : same ? `Both found a route of the same length (${fw(cmpD.cost)}). ${saved > 0 ? `A* checked <b>${saved} fewer location${saved > 1 ? 's' : ''}</b> (${Math.round(100 * saved / cmpD.checked)}% less) because its straight-line estimate steers it toward the destination.` : 'On this small network A* checked the same number of locations, since almost every location lies near the way.'}` : 'The routes differ in length. A* should never do this, so check the data.'}</div>`;
}

/* ---------- Animate tab ---------- */
function renderAnim() {
  const has = !!anim, last = has ? anim.steps.length - 1 : 0;
  $('aStep').max = last; $('aStep').value = idx; $('aStepV').textContent = has ? `${idx + 1} / ${last + 1}` : '–';
  if (!has) { $('stepInfo').innerHTML = 'Choose two different locations.'; $('dtable').innerHTML = ''; return; }
  const st = anim.steps[idx]; $('stepInfo').innerHTML = st.html;
  const rows = Object.keys(G.nodes).sort((a, b) => st.dist[a] - st.dist[b] || nm(a).localeCompare(nm(b)));
  $('dtable').innerHTML = `<table class="etable"><tr><th>Location</th><th>Distance</th><th>From</th><th></th></tr>${rows.map(n => `<tr class="${n === st.cur ? 'cur' : ''}"><td>${esc(nm(n))}</td><td>${isFinite(st.dist[n]) ? fw(st.dist[n]) : '∞'}</td><td>${st.prev[n] ? esc(nm(st.prev[n])) : '–'}</td><td>${st.done.has(n) ? '✔' : isFinite(st.dist[n]) ? '…' : ''}</td></tr>`).join('')}</table>`;
}
function setStep(i) { if (!anim) return; idx = Math.max(0, Math.min(anim.steps.length - 1, i)); renderAnim(); refreshMap(); }
function stop() { clearTimeout(timer); timer = null; if ($('aPlay')) $('aPlay').textContent = '▶ Auto Play'; }
function play() {
  if (timer) return stop(); if (!anim) return;
  if (idx >= anim.steps.length - 1) idx = -1; if ($('aPlay')) $('aPlay').textContent = '⏸ Pause';
  const tick = () => { if (idx >= anim.steps.length - 1) return stop(); setStep(idx + 1); timer = setTimeout(tick, +$('aSpeed').value); }; tick();
}

/* ---------- Closures ---------- */
function toggle(id) { closed.has(id) ? closed.delete(id) : closed.add(id); recompute(); }
function renderClosures() {
  const sel = $('cEdge'), keep = sel.value;
  sel.innerHTML = G.edges.map(e => `<option value="${e.id}">${closed.has(e.id) ? '🚧 ' : ''}${esc(nm(e.a))} – ${esc(nm(e.b))}</option>`).join(''); if (keep) sel.value = keep;
  $('cList').innerHTML = closed.size ? [...closed].map(id => { const e = G.edges.find(x => x.id === id); return `<div class="chip">🚧 ${esc(nm(e.a))} – ${esc(nm(e.b))}<button data-id="${id}">Reopen</button></div>`; }).join('') : '<p class="hint">No roads closed.</p>';
  $('cList').querySelectorAll('button').forEach(b => b.onclick = () => toggle(b.dataset.id));
}

/* ---------- wiring ---------- */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; stop(); document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'p-' + tab)); refreshMap(); });
$('labData').onchange = () => build($('labData').value);
['labFrom', 'labTo', 'labMetric'].forEach(k => $(k).onchange = recompute);
$('aPlay').onclick = play; $('aNext').onclick = () => { stop(); setStep(idx + 1); }; $('aBack').onclick = () => { stop(); setStep(idx - 1); }; $('aStep').oninput = e => { stop(); setStep(+e.target.value); };
if ($('aSpeed')) $('aSpeed').oninput = e => { if ($('aSpeedVal')) $('aSpeedVal').textContent = (+e.target.value / 1000).toFixed(1) + 's'; };
$('cToggle').onclick = () => toggle($('cEdge').value); $('cClear').onclick = () => { closed.clear(); recompute(); };
$('cBest').onclick = () => { if (main && main.edges.length) toggle(main.edges[0].id); };
$('labLegend').innerHTML = '<span><i class="bar" style="background:#a3e635"></i>Shortest</span><span><i class="bar" style="background:#38bdf8"></i>Alternative / Dijkstra</span><span><i class="bar" style="background:#f5a524"></i>Alternative 2</span><span><i class="bar" style="background:#ef4444"></i>Closed road</span><span>* = estimated distance</span>';
build('cbe');
})();
