/* Dependency-free server: uses only Node's built-in modules, so `npm start` works without `npm install`. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const NETWORK_FILE = path.join(DATA_DIR, 'network.json');
const HISTORY_FILE = path.join(DATA_DIR, 'analysis-history.json');
const INCIDENT_FILE = path.join(DATA_DIR, 'incidents.json');
const STATION_FILE = path.join(DATA_DIR, 'station-reports.json');
const INCIDENT_TYPES = { traffic: 2 * 3600e3, accident: 3 * 3600e3, construction: 7 * 24 * 3600e3 }; // type -> default lifetime (ms)
const MAX_NODES = 20;
const MAX_EDGES = 190;

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }

function validateNetwork(input) {
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) return 'Network must contain nodes and edges arrays.';
  if (input.nodes.length > MAX_NODES) return `A maximum of ${MAX_NODES} locations is supported.`;
  if (input.edges.length > MAX_EDGES) return 'Too many connections.';
  const names = new Set();
  for (const raw of input.nodes) {
    if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 24 || raw.includes(',')) return 'Location names must be 1–24 characters and cannot contain commas.';
    const key = raw.trim().toLowerCase();
    if (names.has(key)) return 'Location names must be unique.';
    names.add(key);
  }
  const seenEdges = new Set();
  for (const e of input.edges) {
    if (!e || !names.has(String(e.a).toLowerCase()) || !names.has(String(e.b).toLowerCase())) return 'Every connection must refer to existing locations.';
    if (e.a === e.b) return 'Self-connections are not supported.';
    if (!Number.isFinite(Number(e.w)) || Number(e.w) <= 0 || Number(e.w) > 9999) return 'Connection weights must be positive numbers up to 9999.';
    const key = [e.a.toLowerCase(), e.b.toLowerCase()].sort().join('::');
    if (seenEdges.has(key)) return 'Duplicate connections are not allowed.';
    seenEdges.add(key);
  }
  return null;
}

function graphFor(network) {
  const adj = new Map(network.nodes.map(n => [n, []]));
  network.edges.forEach(e => { adj.get(e.a).push({ node: e.b, w: Number(e.w) }); adj.get(e.b).push({ node: e.a, w: Number(e.w) }); });
  return adj;
}

function dijkstra(network, start, end) {
  const adj = graphFor(network);
  if (!adj.has(start) || !adj.has(end)) throw new Error('Choose a valid start and destination.');
  const dist = new Map(network.nodes.map(n => [n, Infinity]));
  const prev = new Map(); const visited = new Set(); dist.set(start, 0);
  while (true) {
    let u = null, best = Infinity;
    for (const n of network.nodes) if (!visited.has(n) && dist.get(n) < best) { u = n; best = dist.get(n); }
    if (u === null || u === end) break;
    visited.add(u);
    for (const {node, w} of adj.get(u)) if (dist.get(u) + w < dist.get(node)) { dist.set(node, dist.get(u) + w); prev.set(node, u); }
  }
  if (!Number.isFinite(dist.get(end))) return { path: [], distance: null, summary: 'No route found' };
  const path = [end]; while (path[0] !== start) path.unshift(prev.get(path[0]));
  return { path, distance: dist.get(end), summary: `Shortest path: ${dist.get(end)}` };
}

function kruskal(network) {
  const parent = new Map(network.nodes.map(n => [n, n]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const tree = []; let total = 0;
  for (const e of [...network.edges].sort((a,b) => a.w-b.w)) { const a=find(e.a), b=find(e.b); if (a!==b) { parent.set(a,b); tree.push(e); total += Number(e.w); } }
  const connected = network.nodes.length <= 1 || new Set(network.nodes.map(find)).size === 1;
  return { tree, total, connected, summary: `MST cost: ${total}` };
}

function components(network) {
  const adj = graphFor(network); const seen = new Set(); const groups = [];
  for (const n of network.nodes) if (!seen.has(n)) { const stack=[n], group=[]; seen.add(n); while(stack.length) { const u=stack.pop(); group.push(u); for(const v of adj.get(u)) if(!seen.has(v.node)){seen.add(v.node);stack.push(v.node);} } groups.push(group); }
  return groups;
}

function analyze(input) {
  const network = input.network;
  const error = validateNetwork(network); if (error) throw new Error(error);
  if (input.algorithm === 'dijkstra') return dijkstra(network, input.start, input.end);
  if (input.algorithm === 'mst') return kruskal(network);
  if (input.algorithm === 'connectivity') { const groups=components(network); return { components: groups, connected: groups.length <= 1, summary: `${groups.length} connected component${groups.length===1?'':'s'}` }; }
  if (input.algorithm === 'matrix') { const matrix=network.nodes.map(a=>network.nodes.map(b=>a===b?0:(network.edges.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a))?.w ?? null))); return { matrix, nodes: network.nodes, summary: `Adjacency matrix: ${network.nodes.length} × ${network.nodes.length}` }; }
  if (input.algorithm === 'coloring') { const adj=graphFor(network), colors={}; for(const n of network.nodes){const used=new Set(adj.get(n).map(x=>colors[x.node]).filter(Boolean));let c=1;while(used.has(c))c++;colors[n]=c;} return { colors, colorCount:new Set(Object.values(colors)).size, summary:`Greedy coloring: ${new Set(Object.values(colors)).size} colors` }; }
  throw new Error('Unsupported algorithm.');
}

/* ---------- tiny router (replaces Express) ---------- */
const routes = [];
const app = {};
['get', 'post', 'put', 'delete'].forEach(m => app[m] = (pattern, handler) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method: m.toUpperCase(), re, keys, handler });
});

function wrapRes(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => { if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
  return res;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8'
};

function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(__dirname, rel));
  if (!file.startsWith(__dirname + path.sep) || /[\\/]node_modules[\\/]/.test(file.slice(__dirname.length))) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (/gzip/.test(req.headers['accept-encoding'] || '') && ['.html', '.js', '.css', '.json', '.svg'].includes(ext)) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.end(zlib.gzipSync(buf));
    }
    res.end(buf);
  });
}

let activePort = DEFAULT_PORT;

app.get('/api/health', (_req,res) => res.json({
  status: 'ok',
  port: activePort,
  storage: 'JSON persistence',
  uptime: Math.round(process.uptime()),
  timestamp: new Date().toISOString()
}));

app.get('/api/network', (_req,res) => res.json(readJson(NETWORK_FILE, { name:'Sample city network', unit:'km', nodes:[], edges:[] })));

app.put('/api/network', (req,res) => {
  const error = validateNetwork(req.body);
  if (error) return res.status(400).json({ error });
  const payload = {
    name: String(req.body.name || 'Untitled network').slice(0, 40),
    unit: String(req.body.unit || 'km').slice(0, 8),
    nodes: req.body.nodes.map(n => n.trim()),
    edges: req.body.edges.map(e => ({ a: e.a, b: e.b, w: Number(e.w) })),
    updatedAt: new Date().toISOString()
  };
  writeJson(NETWORK_FILE, payload);
  res.json({ ok: true, message: 'Network saved', network: payload });
});

app.post('/api/analyze', (req,res) => {
  try {
    const result = analyze(req.body);
    const history = readJson(HISTORY_FILE, []);
    history.unshift({
      id: Date.now().toString(36),
      algorithm: req.body.algorithm,
      networkName: req.body.network.name || 'Untitled network',
      summary: result.summary || 'Analysis completed',
      createdAt: new Date().toISOString(),
      result
    });
    writeJson(HISTORY_FILE, history.slice(0, 100));
    res.json(result);
  } catch(error) {
    res.status(400).json({ error: error.message || 'Unable to analyze this network.' });
  }
});

app.get('/api/history', (_req,res) => res.json(readJson(HISTORY_FILE, [])));
app.delete('/api/history', (_req,res) => { writeJson(HISTORY_FILE, []); res.json({ ok: true, message: 'Analysis history cleared' }); });

app.get('/api/stats', (_req,res) => {
  const n = readJson(NETWORK_FILE, { nodes: [], edges: [] });
  const groups = components(n);
  const total = n.edges.reduce((s, e) => s + Number(e.w), 0);
  res.json({
    locations: n.nodes.length,
    connections: n.edges.length,
    totalWeight: total,
    components: groups.length,
    connected: groups.length <= 1,
    averageDegree: n.nodes.length ? 2 * n.edges.length / n.nodes.length : 0
  });
});

// ---------- Boundary & Charging Station Datasets ----------
app.get('/api/boundary', (_req, res) => {
  const file = path.join(DATA_DIR, 'tamil-nadu-boundary.json');
  res.json(readJson(file, { type: 'FeatureCollection', features: [] }));
});

app.get('/api/chargers', (_req, res) => {
  const file = path.join(DATA_DIR, 'chargers-tamil-nadu.json');
  res.json(readJson(file, []));
});

app.get('/api/battery-banks', (_req, res) => {
  const file = path.join(DATA_DIR, 'battery-banks-tamil-nadu.json');
  res.json(readJson(file, []));
});

// ---------- Popular Tamil Nadu Corridors Preset API ----------
app.get('/api/popular-routes', (_req, res) => {
  res.json([
    { id: 'cbe-ooty', from: 'coimbatore', to: 'ooty', name: 'Coimbatore ➔ Ooty (Nilgiri Ghat Climb)', tag: 'Mountain / Regen Test', car: 'nexon', desc: 'Climbs 1,900m to Ooty with downhill regen returning 40%+ energy on descent.' },
    { id: 'chn-cbe', from: 'chennai', to: 'coimbatore', name: 'Chennai ➔ Coimbatore (Industrial Spine)', tag: 'Express Highway', car: 'zs', desc: '500+ km NH48/NH544 trunk road with multiple high-speed charging hubs.' },
    { id: 'chn-mdu', from: 'chennai', to: 'madurai', name: 'Chennai ➔ Madurai (Cultural Corridor)', tag: 'NH44 Trunk', car: 'curvv', desc: 'Direct fast travel through Villupuram & Tiruchirappalli.' },
    { id: 'mdu-rsm', from: 'madurai', to: 'rameswaram', name: 'Madurai ➔ Rameswaram (Pamban Ocean Route)', tag: 'Coastal Highway', car: 'tiago', desc: 'Scenic NH87 coastal corridor across the Gulf of Mannar.' },
    { id: 'hsr-kny', from: 'hosur', to: 'kanyakumari', name: 'Hosur ➔ Kanyakumari (Grand North-South)', tag: 'Epic 650km', car: 'ioniq5', desc: 'Traverses the entire length of Tamil Nadu via NH44.' },
    { id: 'trc-thj', from: 'trichy', to: 'kumbakonam', name: 'Trichy ➔ Thanjavur ➔ Kumbakonam', tag: 'Cauvery Delta', car: 'punch', desc: 'Heritage delta route through ancient Chola temples.' }
  ]);
});

// ---------- Kovai Live incident alerts ----------
function liveIncidents() {
  const now = Date.now();
  const all = readJson(INCIDENT_FILE, []);
  const live = all.filter(i => new Date(i.expiresAt).getTime() > now);
  if (live.length !== all.length) writeJson(INCIDENT_FILE, live);
  return live;
}

app.get('/api/incidents', (_req, res) => res.json(liveIncidents()));
app.post('/api/incidents', (req, res) => {
  const b = req.body || {};
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!INCIDENT_TYPES[b.type]) return res.status(400).json({ error: 'Type must be traffic, accident or construction.' });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 10.85 || lat > 11.15 || lng < 76.55 || lng > 77.15) return res.status(400).json({ error: 'Location must be in the Coimbatore – Karunya Nagar – Siruvani area.' });
  const sev = ['low', 'medium', 'high'].includes(b.severity) ? b.severity : 'medium';
  const list = liveIncidents();
  if (list.length >= 200) return res.status(400).json({ error: 'Too many active incidents.' });
  const now = Date.now();
  const incident = {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    type: b.type, severity: sev, lat, lng,
    note: String(b.note || '').trim().slice(0, 140),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INCIDENT_TYPES[b.type]).toISOString()
  };
  list.unshift(incident);
  writeJson(INCIDENT_FILE, list);
  res.status(201).json(incident);
});

app.delete('/api/incidents/:id', (req, res) => {
  const list = liveIncidents();
  const next = list.filter(i => i.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Incident not found.' });
  writeJson(INCIDENT_FILE, next);
  res.json({ ok: true });
});

// ---------- VoltPath charging-station reports (busy / free), kept 3 hours ----------
const STATION_RE = /^cs_[a-z_]{2,30}$/;
function liveStationReports() {
  const cutoff = Date.now() - 3 * 3600e3;
  const all = readJson(STATION_FILE, []);
  const live = all.filter(r => new Date(r.at).getTime() > cutoff);
  if (live.length !== all.length) writeJson(STATION_FILE, live);
  return live;
}

app.get('/api/stations/reports', (_req, res) => res.json(liveStationReports()));
app.post('/api/stations/reports', (req, res) => {
  const b = req.body || {};
  if (!STATION_RE.test(String(b.station || ''))) return res.status(400).json({ error: 'Unknown charging station.' });
  if (!['busy', 'free'].includes(b.status)) return res.status(400).json({ error: 'Status must be busy or free.' });
  const list = liveStationReports();
  const r = { station: b.station, status: b.status, at: new Date().toISOString() };
  list.unshift(r);
  writeJson(STATION_FILE, list.slice(0, 500));
  res.status(201).json(r);
});

const server = http.createServer((req, res) => {
  wrapRes(res);
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api')) return serveStatic(req, res);
  const route = routes.find(r => r.method === req.method && r.re.test(url.pathname));
  if (!route) return res.status(404).json({ error: 'API endpoint not found' });
  const m = url.pathname.match(route.re);
  req.params = {};
  route.keys.forEach((k, i) => req.params[k] = decodeURIComponent(m[i + 1]));
  let body = '', size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > 100 * 1024) { res.status(413).json({ error: 'Request too large' }); req.destroy(); }
    else body += c;
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    if (body && /json/.test(req.headers['content-type'] || '')) {
      try { req.body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    } else req.body = {};
    try { route.handler(req, res); } catch (e) { res.status(500).json({ error: e.message || 'Server error' }); }
  });
});

/* Smart port binding: if port is in use, auto-try next ports seamlessly */
function startListening(port, remainingAttempts = 10) {
  server.removeAllListeners('error');
  server.on('error', e => {
    if (e.code === 'EADDRINUSE' && remainingAttempts > 0) {
      console.log(`Port ${port} in use, auto-trying port ${port + 1}...`);
      startListening(port + 1, remainingAttempts - 1);
    } else {
      console.error('Server error:', e);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    activePort = port;
    console.log(`\n╭──────────────────────────────────────────────────────────╮`);
    console.log(`│   ⚡ VoltPath Tamil Nadu v8.0 Ultra: Energy-Aware EV Network  │`);
    console.log(`├──────────────────────────────────────────────────────────┤`);
    console.log(`│  ⚡ Main Application   →  http://localhost:${port}          │`);
    console.log(`│  🧪 Algorithm Lab      →  http://localhost:${port}/lab.html │`);
    console.log(`│  (Zero dependencies · Built-in Node HTTP Server)         │`);
    console.log(`╰──────────────────────────────────────────────────────────╯\n`);
  });
}

startListening(DEFAULT_PORT);
