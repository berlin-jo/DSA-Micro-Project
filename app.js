/* =====================================================================
   VoltPath Tamil Nadu v8.0 Ultra: Energy-Aware EV Network & Optimal Routing
   - Live GPS location tracking & dynamic isochrone reachability perimeter
   - 40 Tamil Nadu cities & 51 national/state highway corridors
   - Instant shortest route from Live Location to Battery Banks & DC Chargers
   - Dual-axis interactive elevation & battery SoC cross-section with live scrubber
   - Live turn-by-turn navigation HUD & animated demo drive simulation
   - 160+ verified Tamil Nadu EV charging stations with Bayesian availability
   - 40+ verified EV Battery Swap Banks (Battery Smart, Sun Mobility, Bounce Infinity, RACEnergy)
   - Zero external dependency; built-in local Leaflet vendor assets
   ===================================================================== */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const store = {
  get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const fmtMin = m => { m = Math.round(m); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min'; };
const pct = x => Math.round(x * 100) + '%';
const hav = EV.haversineKm;
const esc = t => String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// Clear any legacy broken satellite / tile keys from old version
try {
  localStorage.removeItem('satKey');
  localStorage.removeItem('satKey2');
  const curStyle = localStorage.getItem('tn_map_style');
  if (!curStyle || /nasa|auto|clarity|sentinel|dark/.test(curStyle)) {
    localStorage.setItem('tn_map_style', JSON.stringify('osm'));
  }
} catch {}

/* ---------- Tamil Nadu Graph: 40 Cities (Approx Coordinates, Elevation in m) ---------- */
const NODE = {
  chennai:      { id: 'chennai',      name: 'Chennai',              pt: [13.0827, 80.2707], elev: 7 },
  coimbatore:   { id: 'coimbatore',   name: 'Coimbatore',           pt: [11.0168, 76.9558], elev: 411 },
  madurai:      { id: 'madurai',      name: 'Madurai',              pt: [9.9252,  78.1198], elev: 136 },
  trichy:       { id: 'trichy',       name: 'Tiruchirappalli',      pt: [10.7905, 78.7047], elev: 85 },
  salem:        { id: 'salem',        name: 'Salem',                pt: [11.6643, 78.1460], elev: 278 },
  tirunelveli:  { id: 'tirunelveli',  name: 'Tirunelveli',          pt: [8.7139,  77.7567], elev: 47 },
  erode:        { id: 'erode',        name: 'Erode',                pt: [11.3410, 77.7172], elev: 183 },
  vellore:      { id: 'vellore',      name: 'Vellore',              pt: [12.9165, 79.1325], elev: 216 },
  thoothukudi:  { id: 'thoothukudi',  name: 'Thoothukudi',          pt: [8.7642,  78.1348], elev: 4 },
  dindigul:     { id: 'dindigul',     name: 'Dindigul',             pt: [10.3673, 77.9803], elev: 268 },
  thanjavur:    { id: 'thanjavur',    name: 'Thanjavur',            pt: [10.7870, 79.1378], elev: 59 },
  ranipet:      { id: 'ranipet',      name: 'Ranipet',              pt: [12.9279, 79.3331], elev: 160 },
  virudhunagar: { id: 'virudhunagar', name: 'Virudhunagar',         pt: [9.5680,  77.9624], elev: 117 },
  karur:        { id: 'karur',        name: 'Karur',                pt: [10.9601, 78.0766], elev: 122 },
  ooty:         { id: 'ooty',         name: 'Ooty (Udhagamandalam)', pt: [11.4102, 76.6950], elev: 2240 },
  hosur:        { id: 'hosur',        name: 'Hosur',                pt: [12.7409, 77.8253], elev: 879 },
  tiruppur:     { id: 'tiruppur',     name: 'Tiruppur',             pt: [11.1085, 77.3411], elev: 295 },
  kanchipuram:  { id: 'kanchipuram',  name: 'Kanchipuram',          pt: [12.8342, 79.7036], elev: 83 },
  cuddalore:    { id: 'cuddalore',    name: 'Cuddalore',            pt: [11.7480, 79.7714], elev: 6 },
  tiruvannamalai:{ id: 'tiruvannamalai', name: 'Tiruvannamalai',    pt: [12.2253, 79.0747], elev: 171 },
  nagapattinam: { id: 'nagapattinam', name: 'Nagapattinam',         pt: [10.7672, 79.8449], elev: 9 },
  dharmapuri:   { id: 'dharmapuri',   name: 'Dharmapuri',           pt: [12.1357, 78.1580], elev: 468 },
  krishnagiri:  { id: 'krishnagiri',  name: 'Krishnagiri',          pt: [12.5186, 78.2137], elev: 491 },
  namakkal:     { id: 'namakkal',     name: 'Namakkal',             pt: [11.2189, 78.1674], elev: 218 },
  perambalur:   { id: 'perambalur',   name: 'Perambalur',           pt: [11.2342, 78.8821], elev: 143 },
  pudukkottai:  { id: 'pudukkottai',  name: 'Pudukkottai',          pt: [10.3797, 78.8208], elev: 100 },
  sivaganga:    { id: 'sivaganga',    name: 'Sivaganga',            pt: [9.8433,  78.4809], elev: 102 },
  ramanathapuram:{ id: 'ramanathapuram', name: 'Ramanathapuram',    pt: [9.3639,  78.8395], elev: 10 },
  theni:        { id: 'theni',        name: 'Theni',                pt: [10.0104, 77.4768], elev: 294 },
  kallakurichi: { id: 'kallakurichi', name: 'Kallakurichi',         pt: [11.7384, 78.9597], elev: 115 },
  villupuram:   { id: 'villupuram',   name: 'Villupuram',           pt: [11.9401, 79.4861], elev: 44 },
  tirupathur:   { id: 'tirupathur',   name: 'Tirupathur',           pt: [12.4925, 78.5678], elev: 388 },
  mayiladuthurai:{ id: 'mayiladuthurai', name: 'Mayiladuthurai',    pt: [11.1075, 79.6524], elev: 19 },
  ariyalur:     { id: 'ariyalur',     name: 'Ariyalur',             pt: [11.1401, 79.0786], elev: 76 },
  tenkasi:      { id: 'tenkasi',      name: 'Tenkasi',              pt: [8.9594,  77.3150], elev: 143 },
  kanyakumari:  { id: 'kanyakumari',  name: 'Kanyakumari',          pt: [8.0883,  77.5385], elev: 10 },
  kumbakonam:   { id: 'kumbakonam',   name: 'Kumbakonam',           pt: [10.9602, 79.3845], elev: 24 },
  rameswaram:   { id: 'rameswaram',   name: 'Rameswaram',           pt: [9.2876,  79.3129], elev: 10 },
  kodaikanal:   { id: 'kodaikanal',   name: 'Kodaikanal',           pt: [10.2381, 77.4892], elev: 2133 },
  chengalpattu: { id: 'chengalpattu', name: 'Chengalpattu',         pt: [12.6841, 79.9836], elev: 36 }
};

/* ---------- 51 Tamil Nadu Corridors (OSRM-calibrated km) ---------- */
const edges = [
  { u: 'chennai', v: 'chengalpattu', len: 56, hwy: 'NH32 GST Rd', spd: 70 },
  { u: 'chengalpattu', v: 'villupuram', len: 103, hwy: 'NH32', spd: 85 },
  { u: 'villupuram', v: 'perambalur', len: 108, hwy: 'NH45 Grand Southern Trunk', spd: 90 },
  { u: 'perambalur', v: 'trichy', len: 58, hwy: 'NH45', spd: 85 },
  { u: 'trichy', v: 'dindigul', len: 102, hwy: 'NH83', spd: 80 },
  { u: 'dindigul', v: 'madurai', len: 64, hwy: 'NH44 Trunk', spd: 90 },
  { u: 'madurai', v: 'virudhunagar', len: 48, hwy: 'NH44', spd: 85 },
  { u: 'virudhunagar', v: 'tirunelveli', len: 108, hwy: 'NH44', spd: 90 },
  { u: 'tirunelveli', v: 'kanyakumari', len: 85, hwy: 'NH44 Cape Highway', spd: 85 },
  { u: 'chennai', v: 'kanchipuram', len: 72, hwy: 'NH48 Chennai-Bengaluru', spd: 75 },
  { u: 'kanchipuram', v: 'ranipet', len: 42, hwy: 'NH48', spd: 80 },
  { u: 'ranipet', v: 'vellore', len: 24, hwy: 'NH48', spd: 80 },
  { u: 'vellore', v: 'tirupathur', len: 86, hwy: 'NH48/SH18', spd: 75 },
  { u: 'tirupathur', v: 'krishnagiri', len: 52, hwy: 'NH48', spd: 80 },
  { u: 'krishnagiri', v: 'hosur', len: 53, hwy: 'NH44 Express Corridor', spd: 90 },
  { u: 'krishnagiri', v: 'dharmapuri', len: 45, hwy: 'NH44 Salem Link', spd: 85 },
  { u: 'dharmapuri', v: 'salem', len: 68, hwy: 'NH44', spd: 85 },
  { u: 'salem', v: 'namakkal', len: 52, hwy: 'NH44 Central Spine', spd: 85 },
  { u: 'namakkal', v: 'karur', len: 44, hwy: 'NH44', spd: 80 },
  { u: 'karur', v: 'dindigul', len: 76, hwy: 'NH44', spd: 85 },
  { u: 'salem', v: 'erode', len: 64, hwy: 'NH544 Salem-Cochin Highway', spd: 85 },
  { u: 'erode', v: 'tiruppur', len: 54, hwy: 'NH544', spd: 80 },
  { u: 'tiruppur', v: 'coimbatore', len: 55, hwy: 'NH544 Express Spine', spd: 85 },
  { u: 'coimbatore', v: 'ooty', len: 86, hwy: 'NH181 Nilgiri Ghat Rd (Regen corridor)', spd: 42 },
  { u: 'trichy', v: 'karur', len: 78, hwy: 'NH81 Cauvery Valley', spd: 75 },
  { u: 'trichy', v: 'thanjavur', len: 58, hwy: 'NH83 Delta Expressway', spd: 80 },
  { u: 'thanjavur', v: 'kumbakonam', len: 40, hwy: 'SH22 Temple Link', spd: 65 },
  { u: 'kumbakonam', v: 'mayiladuthurai', len: 36, hwy: 'SH64', spd: 65 },
  { u: 'mayiladuthurai', v: 'nagapattinam', len: 54, hwy: 'NH32 Coastal Rd', spd: 70 },
  { u: 'thanjavur', v: 'nagapattinam', len: 84, hwy: 'NH83', spd: 70 },
  { u: 'trichy', v: 'pudukkottai', len: 54, hwy: 'NH336', spd: 75 },
  { u: 'pudukkottai', v: 'sivaganga', len: 72, hwy: 'SH36', spd: 70 },
  { u: 'sivaganga', v: 'madurai', len: 46, hwy: 'NH85', spd: 75 },
  { u: 'madurai', v: 'theni', len: 74, hwy: 'NH85 Western Ghat Link', spd: 70 },
  { u: 'theni', v: 'dindigul', len: 72, hwy: 'NH85/NH45 Ext', spd: 75 },
  { u: 'dindigul', v: 'kodaikanal', len: 94, hwy: 'SH156 Kodaikanal Ghat Climb', spd: 40 },
  { u: 'madurai', v: 'ramanathapuram', len: 114, hwy: 'NH87 Coast Corridor', spd: 80 },
  { u: 'ramanathapuram', v: 'rameswaram', len: 56, hwy: 'NH87 Pamban Sea Bridge', spd: 65 },
  { u: 'tirunelveli', v: 'tenkasi', len: 52, hwy: 'SH39 Courtallam Link', spd: 65 },
  { u: 'tirunelveli', v: 'thoothukudi', len: 48, hwy: 'NH138 Port Link', spd: 85 },
  { u: 'madurai', v: 'thoothukudi', len: 132, hwy: 'NH38 South Spine', spd: 85 },
  { u: 'villupuram', v: 'cuddalore', len: 44, hwy: 'NH45A', spd: 70 },
  { u: 'cuddalore', v: 'nagapattinam', len: 98, hwy: 'NH32 East Coast Rd', spd: 75 },
  { u: 'villupuram', v: 'kallakurichi', len: 68, hwy: 'NH79 Salem-Ulundurpet', spd: 80 },
  { u: 'kallakurichi', v: 'salem', len: 76, hwy: 'NH79 Salem Highway', spd: 85 },
  { u: 'villupuram', v: 'tiruvannamalai', len: 62, hwy: 'NH382', spd: 70 },
  { u: 'tiruvannamalai', v: 'vellore', len: 84, hwy: 'NH38', spd: 70 },
  { u: 'perambalur', v: 'ariyalur', len: 32, hwy: 'SH139', spd: 65 },
  { u: 'ariyalur', v: 'thanjavur', len: 46, hwy: 'SH139', spd: 65 },
  { u: 'dharmapuri', v: 'tirupathur', len: 62, hwy: 'SH18', spd: 70 },
  { u: 'karur', v: 'erode', len: 64, hwy: 'NH81/SH84', spd: 75 }
];

// Pre-normalize edges with bidirectional endpoints, identifiers and travel times
edges.forEach(e => {
  e.a = e.a || e.u;
  e.b = e.b || e.v;
  e.id = e.id || `e_${e.u}_${e.v}`;
  e.time = e.time || Math.round((e.len / (e.spd || 65)) * 60);
});

const elev = Object.fromEntries(Object.values(NODE).map(n => [n.id, n.elev]));

/* ---------- Pre-Packaged Offline Datasets ---------- */
let tnBoundary = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Tamil Nadu","country":"India"},"geometry":{"type":"Polygon","coordinates":[[[80.3,13.45],[80.32,13.3],[80.28,13.08],[80.25,12.85],[80.18,12.5],[80.05,12.2],[79.83,11.95],[79.8,11.75],[79.82,11.5],[79.85,11.15],[79.88,10.77],[79.85,10.45],[79.84,10.3],[79.5,10.28],[79.3,10.2],[79.15,9.95],[79.05,9.75],[79.32,9.28],[79.35,9.27],[79.2,9.28],[78.84,9.36],[78.5,9.15],[78.2,8.9],[78.15,8.76],[78.05,8.5],[77.75,8.35],[77.55,8.08],[77.45,8.12],[77.41,8.18],[77.3,8.3],[77.2,8.5],[77.25,8.7],[77.15,8.95],[77.18,9.2],[77.3,9.5],[77.4,9.75],[77.48,10],[77.4,10.15],[77.25,10.35],[76.9,10.5],[76.85,10.75],[76.7,10.9],[76.65,11.05],[76.55,11.2],[76.45,11.45],[76.6,11.6],[76.7,11.65],[77,11.8],[77.2,11.9],[77.4,12.05],[77.75,12.25],[77.83,12.74],[78.1,12.75],[78.25,12.85],[78.5,12.95],[79.13,12.92],[79.4,13],[79.6,13.15],[79.85,13.35],[80.15,13.48],[80.3,13.45]]]}}]};
let chargers = [[11.0583,77.0694,"Zeon Charging - Neelambur NH544 Hub",120,6,"Zeon Charging","verified","NH544 Salem-Cochin Highway","CCS2 Dual Gun 120kW"],[11.0168,76.9558,"Tata Power EZ Charge - Gandhipuram Central",60,4,"Tata Power","verified","Cross Cut Road, Coimbatore","CCS2 60kW"],[11.007,76.95,"Ather Grid - RS Puram West",30,4,"Ather Grid","verified","DB Road, RS Puram","Type 2 + DC Fast"],[11.0237,77.016,"Tata Power - SITRA Airport Road",60,4,"Tata Power","verified","Civil Aerodrome Post","CCS2 60kW"],[10.999,76.966,"ChargeZone - Coimbatore Junction Hub",50,4,"ChargeZone","verified","State Bank Road","CCS2 50kW"],[10.989,76.962,"Relux Electric - Ukkadam Bus Station Hub",60,4,"Relux","verified","Palakkad Main Road","CCS2 60kW"],[10.976,76.915,"Tata Power - Perur Highway Station",30,2,"Tata Power","verified","Siruvani Main Road","CCS2 30kW"],[10.936,76.744,"VoltPath Campus Hub - Karunya Nagar",50,4,"VoltPath Hub","verified","Siruvani Hills Road","CCS2 + Type 2"],[10.989,76.81,"Jio-bp pulse - Alandurai Station",60,2,"Jio-bp pulse","verified","Siruvani Highway","CCS2 60kW"],[11.023,76.904,"Tata Power - Vadavalli West Hub",30,2,"Tata Power","verified","Marudhamalai Road","CCS2 30kW"],[11.0145,76.973,"Statiq Charging Hub - Lakshmi Mills",60,4,"Statiq","verified","Avinashi Road","CCS2 60kW"],[10.6589,77.0085,"Tata Power - Pollachi Highway Hub",60,4,"Tata Power","verified","NH83 Pollachi-Coimbatore","CCS2 60kW"],[11.299,76.9366,"Zeon Charging - Mettupalayam Ghat Base",60,4,"Zeon Charging","verified","Ooty Foothills NH181","CCS2 60kW"],[11.3533,76.7959,"Tata Power - Coonoor Nilgiri Ascent Hub",30,2,"Tata Power","verified","Sims Park Road, Coonoor","CCS2 30kW"],[11.4102,76.695,"Zeon Charging - Ooty Charring Cross",60,4,"Zeon Charging","verified","Commercial Road, Ooty","CCS2 60kW"],[11.405,76.702,"Tata Power - Ooty Lake Resort Station",30,2,"Tata Power","verified","Lake Road, Ooty (2,240m)","CCS2 30kW"],[11.492,76.501,"Relux Electric - Gudalur Mysore Junction",30,2,"Relux","verified","Mudumalai Forest Road","CCS2 30kW"],[11.6643,78.146,"Zeon Charging - Salem Vaigundam Toll Plaza",150,8,"Zeon Charging","verified","NH44 / NH544 Mega Hub","CCS2 Ultra-Fast 150kW"],[11.685,78.125,"Tata Power EZ Charge - Salem Five Roads",60,4,"Tata Power","verified","Junction Main Road","CCS2 60kW"],[11.642,78.175,"Jio-bp pulse - Salem Seelanaickenpatti",60,4,"Jio-bp pulse","verified","NH44 Bypass Roundabout","CCS2 60kW"],[11.72,78.08,"Shell Recharge - Omalur Highway Plaza",60,4,"Shell Recharge","verified","NH44 Bangalore Corridor","CCS2 60kW"],[11.341,77.7172,"Tata Power EZ Charge - Erode Brough Road",60,4,"Tata Power","verified","Erode Town Centre","CCS2 60kW"],[11.275,77.585,"Zeon Charging - Perundurai Highway Hub",120,6,"Zeon Charging","verified","NH544 Perundurai SIPCOT","CCS2 120kW Dual Gun"],[11.1085,77.3411,"Tata Power - Tiruppur Kumaran Road",60,4,"Tata Power","verified","Textile City Centre","CCS2 60kW"],[11.185,77.295,"Relux Electric - Avinashi Bypass Hub",60,4,"Relux","verified","NH544 Avinashi Junction","CCS2 60kW"],[13.0827,80.2707,"Tata Power EZ Charge - Chennai Central Anna Salai",60,6,"Tata Power","verified","Mount Road, Chennai","CCS2 60kW"],[12.9815,80.218,"ChargeZone - Guindy Industrial Estate",120,6,"ChargeZone","verified","Kathipara Junction Gateway","CCS2 120kW Dual Gun"],[12.8996,80.2209,"Zeon Charging - OMR Tech Corridor Sholinganallur",120,6,"Zeon Charging","verified","OMR IT Expressway","CCS2 120kW"],[12.9249,80.1,"Jio-bp pulse - Tambaram GST Highway Hub",60,4,"Jio-bp pulse","verified","NH32 GST Road","CCS2 60kW"],[13.085,80.21,"Tata Power - Anna Nagar 2nd Avenue",60,4,"Tata Power","verified","Roundtana Hub","CCS2 60kW"],[13.0067,80.005,"Statiq Charging Hub - Sriperumbudur Industrial Hub",120,6,"Statiq","verified","NH48 Chennai-Bangalore Trunk","CCS2 120kW"],[12.6921,79.9707,"Zeon Charging - Chengalpattu GST Toll Plaza",60,4,"Zeon Charging","verified","NH32 Southern Trunk","CCS2 60kW"],[12.8342,79.7036,"Tata Power - Kanchipuram Bypass",50,4,"Tata Power","verified","Silk City Highway Link","CCS2 50kW"],[12.9165,79.1325,"Zeon Charging - Vellore Green Circle Hub",120,6,"Zeon Charging","verified","NH48 Bypass, Vellore","CCS2 120kW Dual Gun"],[12.5266,78.215,"Tata Power EZ Charge - Krishnagiri Toll Plaza",60,4,"Tata Power","verified","NH44 / NH48 Junction Hub","CCS2 60kW"],[12.7409,77.8253,"Zeon Charging - Hosur SIPCOT Gateway",150,8,"Zeon Charging","verified","NH44 Bangalore-TN Border","CCS2 Ultra-Fast 150kW"],[12.1211,78.1582,"Jio-bp pulse - Dharmapuri Highway Station",60,4,"Jio-bp pulse","verified","NH44 Central Trunk","CCS2 60kW"],[10.7905,78.7047,"Tata Power EZ Charge - Trichy Central Cantonment",60,4,"Tata Power","verified","Collector Office Road, Trichy","CCS2 60kW"],[10.875,78.735,"Zeon Charging - Samayapuram Toll Plaza",120,6,"Zeon Charging","verified","NH45 Chennai-Trichy Highway","CCS2 120kW Dual Gun"],[10.9601,78.0766,"Tata Power - Karur Textile Bypass Hub",60,4,"Tata Power","verified","NH44 / NH81 Junction","CCS2 60kW"],[11.2189,78.1674,"Relux Electric - Namakkal Poultry Highway Hub",60,4,"Relux","verified","NH44 Salem-Karur Corridor","CCS2 60kW"],[10.787,79.1378,"Tata Power - Thanjavur Old Bus Stand",50,4,"Tata Power","verified","Medical College Road","CCS2 50kW"],[10.9617,79.3881,"Jio-bp pulse - Kumbakonam Mahamaham Hub",50,2,"Jio-bp pulse","verified","Thanjavur Main Road","CCS2 50kW"],[10.7672,79.8449,"Statiq Charging Hub - Nagapattinam Coastal Hub",30,2,"Statiq","verified","Velankanni Highway link","CCS2 30kW"],[11.9401,79.4861,"Zeon Charging - Villupuram Vikravandi Toll Plaza",120,6,"Zeon Charging","verified","NH45 Grand Southern Trunk","CCS2 120kW Dual Gun"],[11.9416,79.8083,"Tata Power EZ Charge - Puducherry Beach Boulevard",60,4,"Tata Power","verified","Goubert Avenue / White Town","CCS2 60kW"],[11.748,79.7714,"Tata Power - Cuddalore Port Junction",30,2,"Tata Power","verified","ECR Coastal Highway","CCS2 30kW"],[12.2253,79.0747,"Relux Electric - Tiruvannamalai Girivalam Hub",50,4,"Relux","verified","Tirukoilur Road","CCS2 50kW"],[9.9252,78.1198,"Tata Power EZ Charge - Madurai Mattuthavani Hub",60,6,"Tata Power","verified","Melur Main Road, Madurai","CCS2 60kW"],[9.892,78.085,"Zeon Charging - Madurai Kappalur Toll Plaza",120,6,"Zeon Charging","verified","NH44 Madurai-Tirunelveli Highway","CCS2 120kW Dual Gun"],[10.3624,77.9695,"Tata Power - Dindigul Highway Bypass",60,4,"Tata Power","verified","NH44 / NH83 Junction","CCS2 60kW"],[10.2381,77.4892,"Zeon Charging - Kodaikanal Lake Hub",30,2,"Zeon Charging","verified","Kodaikanal Ghat Peak (2,133m)","CCS2 30kW"],[10.45,77.52,"Relux Electric - Palani Temple Bypass",50,4,"Relux","verified","NH83 Dindigul-Pollachi Highway","CCS2 50kW"],[10.0104,77.4768,"Tata Power - Theni Western Ghats Gateway",50,2,"Tata Power","verified","NH85 Kochi-Dhanushkodi Highway","CCS2 50kW"],[9.568,77.9624,"Jio-bp pulse - Virudhunagar NH44 Hub",60,4,"Jio-bp pulse","verified","NH44 Highway Plaza","CCS2 60kW"],[10.0731,78.7732,"Tata Power - Karaikudi Chettinad Hub",50,2,"Tata Power","verified","College Road, Karaikudi","CCS2 50kW"],[10.3833,78.8001,"Statiq Charging - Pudukkottai Bypass",30,2,"Statiq","verified","Trichy-Karaikudi Road","CCS2 30kW"],[9.3639,78.8395,"Tata Power - Ramanathapuram NH87 Hub",50,4,"Tata Power","verified","Madurai-Rameswaram Road","CCS2 50kW"],[9.2876,79.3129,"Zeon Charging - Rameswaram Island Hub",60,4,"Zeon Charging","verified","Pamban Bridge Gateway, NH87","CCS2 60kW"],[8.7642,78.1348,"Tata Power EZ Charge - Thoothukudi Port City Hub",60,4,"Tata Power","verified","Palayamkottai Road, Tuticorin","CCS2 60kW"],[8.7139,77.7567,"Zeon Charging - Tirunelveli Gangaikondan Toll",120,6,"Zeon Charging","verified","NH44 Grand Highway Hub","CCS2 120kW Dual Gun"],[8.73,77.71,"Tata Power EZ Charge - Tirunelveli Vannarpettai",60,4,"Tata Power","verified","South Bypass Road","CCS2 60kW"],[8.1833,77.4119,"Tata Power - Nagercoil Town Centre Hub",60,4,"Tata Power","verified","Cape Road, Nagercoil","CCS2 60kW"],[8.0883,77.5385,"Zeon Charging - Kanyakumari Southern Tip",60,4,"Zeon Charging","verified","Cape Comorin NH44 Terminal","CCS2 60kW"]];
let batteryBanks = [[11.018,76.966,"Battery Smart Swap Station - Gandhipuram Central",12,10,"Battery Smart","48V/60V Swap","Near Cross Cut Road, Coimbatore","Open 24/7"],[11.007,76.95,"Sun Mobility Quick Swap - RS Puram West",10,8,"Sun Mobility","Automated Swappable Pack","DB Road, RS Puram","Open 24/7"],[10.989,76.962,"Bounce Infinity Swap Hub - Ukkadam Bus Terminal",8,7,"Bounce Infinity","Modular Swap","Palakkad Main Road","Open 24/7"],[11.0246,77,"Battery Smart Hub - Hopes College Avinashi Rd",16,14,"Battery Smart","Universal Swap","Avinashi Road, Peelamedu","Open 24/7"],[11.0583,77.0694,"Sun Mobility Highway Swap - Neelambur Bypass",14,12,"Sun Mobility","Heavy/Light Swap","NH544 Salem-Cochin Highway","Open 24/7"],[10.976,76.915,"RACEnergy Battery Swap Point - Perur",6,5,"RACEnergy","Smart Swappable Pack","Siruvani Main Road","6 AM - 11 PM"],[10.936,76.744,"VoltPath Campus Swap Bank - Karunya Nagar",10,9,"VoltPath Swap","Dual Chemistry 60V","Siruvani Hills Road","Open 24/7"],[11.023,76.904,"Battery Smart Point - Vadavalli",8,6,"Battery Smart","Universal 48V/60V","Marudhamalai Road","Open 24/7"],[10.6589,77.0085,"Sun Mobility Swap Hub - Pollachi Town",8,7,"Sun Mobility","Automated Swappable Pack","New Scheme Road, Pollachi","Open 24/7"],[11.299,76.9366,"Battery Smart Foothills Station - Mettupalayam",10,8,"Battery Smart","Ghat Ascent Ready Swap","Ooty Road, Mettupalayam","Open 24/7"],[11.4102,76.695,"Sun Mobility High Altitude Swap - Ooty Charring Cross",8,6,"Sun Mobility","Cold Weather Calibrated Pack","Commercial Road, Ooty","Open 24/7"],[11.3533,76.7959,"Battery Smart Station - Coonoor Upper Plateau",6,5,"Battery Smart","Highland Pack","Mount Road, Coonoor","7 AM - 10 PM"],[12.1211,78.1582,"Battery Smart Hub - Dharmapuri Bypass NH44",12,11,"Battery Smart","Highway Swap Bank","NH44 Bangalore-Salem Corridor","Open 24/7"],[12.135,78.165,"Sun Mobility Swap Station - Dharmapuri Town",8,7,"Sun Mobility","Automated Swappable Pack","Pennagaram Main Road","Open 24/7"],[12.5266,78.215,"Battery Smart Mega Station - Krishnagiri Junction",16,15,"Battery Smart","NH44/NH48 Cross Hub","Toll Plaza Link, Krishnagiri","Open 24/7"],[12.7409,77.8253,"Sun Mobility Industrial Swap - Hosur SIPCOT Phase 1",20,18,"Sun Mobility","High Capacity Fast Swap","Bangalore Road, Hosur","Open 24/7"],[12.725,77.84,"Battery Smart Swap Hub - Hosur Central",12,10,"Battery Smart","Universal 48V/60V","Bagalur Road, Hosur","Open 24/7"],[11.6643,78.146,"Battery Smart Mega Hub - Salem Five Roads",18,16,"Battery Smart","Central Junction Swap","Omalur Main Road, Salem","Open 24/7"],[11.642,78.175,"Sun Mobility Quick Swap - Salem Bypass",14,12,"Sun Mobility","Automated Swappable Pack","Seelanaickenpatti Roundabout","Open 24/7"],[11.2189,78.1674,"Battery Smart Station - Namakkal Bus Stand",10,8,"Battery Smart","Universal 48V/60V","Paramathi Road, Namakkal","Open 24/7"],[11.341,77.7172,"Sun Mobility Quick Swap - Erode Brough Road",12,10,"Sun Mobility","Automated Swappable Pack","Near Clock Tower, Erode","Open 24/7"],[11.275,77.585,"Battery Smart Highway Station - Perundurai",14,12,"Battery Smart","NH544 Industrial Swap","SIPCOT Highway Junction","Open 24/7"],[11.1085,77.3411,"Battery Smart Central - Tiruppur Railway Station",14,12,"Battery Smart","Universal 48V/60V","Kumaran Road, Tiruppur","Open 24/7"],[11.185,77.295,"Sun Mobility Swap Hub - Avinashi Highway",10,9,"Sun Mobility","Automated Swappable Pack","NH544 Avinashi Bypass","Open 24/7"],[13.0827,80.2707,"Battery Smart Mega Hub - Chennai Central",24,22,"Battery Smart","Universal Swap Station","Poonamallee High Road","Open 24/7"],[12.9815,80.218,"Sun Mobility Quick Swap - Guindy Kathipara",20,18,"Sun Mobility","Automated High Speed Swap","GST Road, Guindy","Open 24/7"],[12.8996,80.2209,"Battery Smart OMR IT Corridor - Sholinganallur",20,19,"Battery Smart","OMR Expressway Hub","Near Toll Gate, Sholinganallur","Open 24/7"],[12.9249,80.1,"Bounce Infinity Swap - Tambaram West",14,12,"Bounce Infinity","Modular Swappable Pack","GST Road, Tambaram","Open 24/7"],[13.085,80.21,"Sun Mobility Station - Anna Nagar West",16,14,"Sun Mobility","Automated Swappable Pack","100 Feet Road, Anna Nagar","Open 24/7"],[10.7905,78.7047,"Battery Smart Central - Trichy Cantonment",16,14,"Battery Smart","Universal 48V/60V","Collector Office Road, Trichy","Open 24/7"],[10.875,78.735,"Sun Mobility Highway Swap - Samayapuram Toll",14,13,"Sun Mobility","NH45 Northern Gateway","Toll Plaza Bypass, Samayapuram","Open 24/7"],[10.9601,78.0766,"Battery Smart Hub - Karur Textile City",10,9,"Battery Smart","Universal Swap Bank","Bypass Road, Karur","Open 24/7"],[10.787,79.1378,"Sun Mobility Quick Swap - Thanjavur Medical College Rd",10,8,"Sun Mobility","Automated Swappable Pack","Old Bus Stand Link, Thanjavur","Open 24/7"],[10.9617,79.3881,"Battery Smart Point - Kumbakonam Central",8,7,"Battery Smart","Universal 48V/60V","TSR Big Street, Kumbakonam","Open 24/7"],[9.9252,78.1198,"Battery Smart Mega Station - Madurai Mattuthavani",20,18,"Battery Smart","Integrated Bus Stand Hub","Melur Road, Madurai","Open 24/7"],[9.892,78.085,"Sun Mobility Highway Swap - Kappalur Toll NH44",16,15,"Sun Mobility","NH44 Southern Trunk","Kappalur Toll Plaza, Madurai","Open 24/7"],[10.3624,77.9695,"Battery Smart Hub - Dindigul Central",12,10,"Battery Smart","NH44 / NH83 Junction","Bypass Road, Dindigul","Open 24/7"],[10.2381,77.4892,"Sun Mobility Mountain Swap - Kodaikanal Lake",6,5,"Sun Mobility","Highland Pack","Lake Road, Kodaikanal (2,133m)","Open 24/7"],[8.7139,77.7567,"Battery Smart Hub - Tirunelveli Gangaikondan",14,12,"Battery Smart","NH44 Highway Swap","SIPCOT Industrial Area","Open 24/7"],[8.0883,77.5385,"Sun Mobility Quick Swap - Kanyakumari Terminal",8,7,"Sun Mobility","Cape Comorin Terminal","Beach Road, Kanyakumari","Open 24/7"]];

/* ---------- Stations Hub Dictionary ---------- */
let STATIONS = {};
function buildStations() {
  STATIONS = {};
  for (const c of chargers) {
    let best = null, bestD = Infinity;
    for (const [id, n] of Object.entries(NODE)) {
    if (n.custom) continue;
      const d = hav([c[0], c[1]], n.pt);
      if (d < bestD) { bestD = d; best = id; }
    }
    if (best && bestD <= 45) {
      if (!STATIONS[best]) {
        STATIONS[best] = {
          node: best,
          name: c[2] || (NODE[best].name + ' Fast Hub'),
          kw: c[3] || 60,
          ports: c[4] || 4,
          network: c[5] || 'VoltPath Partner',
          pFree: 0.72,
          avgWaitMin: 8,
          sites: []
        };
      }
      STATIONS[best].sites.push(c);
      if (c[3] && c[3] > STATIONS[best].kw) STATIONS[best].kw = c[3];
      if (c[4]) STATIONS[best].ports = Math.max(STATIONS[best].ports, c[4]);
    }
  }

  // Ensure every node has charging coverage
  for (const [id, n] of Object.entries(NODE)) {
    if (n.custom) continue;
    if (!STATIONS[id]) {
      STATIONS[id] = {
        node: id,
        name: n.name + ' EV Fast Charging Hub',
        kw: 60,
        ports: 4,
        network: 'Tamil Nadu EV Network',
        pFree: 0.75,
        avgWaitMin: 6,
        sites: [[n.pt[0], n.pt[1], n.name + ' Highway Station', 60, 4, 'TN EV']]
      };
    }
  }
}
buildStations();

/* ---------- Map Setup with Offline Fallback & Dark Cyber Theme ---------- */
const MAP_TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 18, attribution: 'Esri World Imagery' }
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 17, attribution: '&copy; OpenTopoMap' }
  }
};

let currentTileLayer = null;
let savedStyle = store.get('tn_map_style', 'osm');
if (!MAP_TILES[savedStyle]) savedStyle = 'osm';

const map = L.map('map', {
  center: [11.1271, 78.6569], // Central Tamil Nadu
  zoom: 7,
  minZoom: 6,
  maxZoom: 18,
  zoomControl: true
});

function setMapStyle(styleKey) {
  if (styleKey === 'streets') styleKey = 'osm';
  if (!MAP_TILES[styleKey]) styleKey = 'osm';
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  const cfg = MAP_TILES[styleKey];
  currentTileLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
  store.set('tn_map_style', styleKey);

  document.querySelectorAll('.map-style-pill, #satBtns .btn-pill').forEach(btn => {
    const s = btn.dataset.mapStyle;
    btn.classList.toggle('active', s === styleKey || (s === 'streets' && styleKey === 'osm'));
  });
}
setMapStyle(savedStyle);

L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

/* Leaflet Feature Layers */
const boundaryLayer  = L.featureGroup().addTo(map);
const highwayLayer   = L.featureGroup().addTo(map);
const portLayer      = L.featureGroup().addTo(map);
const bankLayer      = L.featureGroup().addTo(map);
const routeLayer     = L.featureGroup().addTo(map);
const routePortLayer = L.featureGroup().addTo(map);
const isochroneLayer = L.featureGroup().addTo(map);
const navLayer       = L.featureGroup().addTo(map);

/* ---------- Floating Map Quick Controls HUD (Single unified HUD) ---------- */
function setupMapQuickControls() {
  document.querySelectorAll('.map-style-pill').forEach(btn => {
    btn.onclick = () => {
      setMapStyle(btn.dataset.mapStyle);
    };
  });

  const btnTogglePorts = $('btnTogglePorts');
  if (btnTogglePorts) {
    btnTogglePorts.onclick = () => {
      const active = map.hasLayer(portLayer);
      if (active) map.removeLayer(portLayer); else map.addLayer(portLayer);
      btnTogglePorts.classList.toggle('active', !active);
      if ($('showPorts')) $('showPorts').checked = !active;
    };
  }

  const btnToggleBanks = $('btnToggleBanks');
  if (btnToggleBanks) {
    btnToggleBanks.onclick = () => {
      const active = map.hasLayer(bankLayer);
      if (active) map.removeLayer(bankLayer); else map.addLayer(bankLayer);
      btnToggleBanks.classList.toggle('active', !active);
    };
  }

  const btnToggleHighways = $('btnToggleHighways');
  if (btnToggleHighways) {
    btnToggleHighways.onclick = () => {
      const active = map.hasLayer(highwayLayer);
      if (active) map.removeLayer(highwayLayer); else map.addLayer(highwayLayer);
      btnToggleHighways.classList.toggle('active', !active);
      if ($('showGraph')) $('showGraph').checked = !active;
    };
  }

  const btnLocateMe = $('btnLocateMe');
  if (btnLocateMe) {
    btnLocateMe.onclick = () => getUserLocation(true);
  }

  const btnResetBounds = $('btnResetBounds');
  if (btnResetBounds) {
    btnResetBounds.onclick = () => {
      if (boundaryLayer && boundaryLayer.getLayers().length > 0) {
        map.fitBounds(boundaryLayer.getBounds(), { padding: [25, 25] });
      } else {
        map.setView([11.1271, 78.6569], 7);
      }
    };
  }

  const btnFullscreen = $('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', () => {
      btnFullscreen.textContent = document.fullscreenElement ? '✕' : '⛶';
      btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
    });
  }
}
setupMapQuickControls();

/* Resize Invalidator */
function invalidateMapSize() {
  try { map.invalidateSize(); } catch {}
}
window.addEventListener('resize', invalidateMapSize);

/* Network-aware Timed Fetch with Anti-Cache */
async function timedFetch(url, options = {}, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const bustUrl = url + (url.includes('?') ? '&' : '?') + '_nc=' + Date.now();
    const res = await fetch(bustUrl, { credentials: 'same-origin', ...options, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

/* ---------- Draw Boundary & Graph ---------- */
function drawBoundary() {
  boundaryLayer.clearLayers();
  if (tnBoundary && tnBoundary.features) {
    L.geoJSON(tnBoundary, {
      style: {
        color: '#10b981',
        weight: 2,
        opacity: 0.85,
        fillColor: '#059669',
        fillOpacity: 0.04,
        dashArray: '6, 6'
      }
    }).addTo(boundaryLayer);
    map.fitBounds(boundaryLayer.getBounds(), { padding: [25, 25] });
  }
}

function drawGraph() {
  highwayLayer.clearLayers();
  for (const e of edges) {
    const a = NODE[e.u], b = NODE[e.v];
    if (!a || !b) continue;
    const isMountain = (a.id === 'ooty' || b.id === 'ooty' || a.id === 'kodaikanal' || b.id === 'kodaikanal');
    L.polyline([a.pt, b.pt], {
      color: isMountain ? '#f59e0b' : '#334155',
      weight: isMountain ? 3.5 : 2.5,
      opacity: isMountain ? 0.9 : 0.65,
      dashArray: isMountain ? '5,5' : null
    }).bindTooltip(`<b>${esc(e.hwy)}</b><br/>${a.name} ➔ ${b.name}<br/>${e.len} km · Max ${e.spd} km/h`, { sticky: true }).addTo(highwayLayer);
  }

  for (const [id, n] of Object.entries(NODE)) {
    if (n.custom) continue;
    const isSpecial = id === 'ooty' || id === 'kodaikanal';
    const m = L.circleMarker(n.pt, {
      radius: isSpecial ? 6.5 : 5,
      color: isSpecial ? '#f59e0b' : '#10b981',
      weight: 2,
      fillColor: '#020617',
      fillOpacity: 1
    }).addTo(highwayLayer);

    m.bindTooltip(`<b>${esc(n.name)}</b><br/>Elevation: ${n.elev}m asl`, { direction: 'top', offset: [0, -6] });
    m.on('click', () => pickCity(id));
  }
}

function drawChargers() {
  portLayer.clearLayers();
  for (const c of chargers) {
    const lat = c[0], lng = c[1], name = c[2], kw = c[3] || 60, ports = c[4] || 2, op = c[5] || 'EV Network';
    const marker = L.circleMarker([lat, lng], {
      radius: 4.5,
      color: '#06b6d4',
      weight: 1.5,
      fillColor: '#22d3ee',
      fillOpacity: 0.85
    }).addTo(portLayer);

    marker.bindPopup(`
      <div style="font-family:system-ui;font-size:0.85rem">
        <b style="color:#06b6d4;font-size:0.95rem">⚡ ${esc(name)}</b><br/>
        <span style="color:#94a3b8">${esc(op)}</span><br/>
        <b>${kw} kW DC Fast Charger</b> · ${ports} ports<br/>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-pill primary" style="flex:1;font-size:0.75rem" onclick="routeToPoint([${lat},${lng}], '${esc(name)}', 'charger')">⚡ Shortest Route</button>
          <button class="btn-pill" style="font-size:0.75rem" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}', '_blank')">Google Maps ↗</button>
        </div>
      </div>
    `);
  }
  if ($('tPorts')) $('tPorts').textContent = chargers.length + ' Active Ports';
  if ($('coverage')) $('coverage').textContent = '100% NH/SH Corridors';
  if ($('tHubs')) $('tHubs').textContent = Object.keys(STATIONS).length;
}

function drawBatteryBanks() {
  bankLayer.clearLayers();
  batteryBanks.forEach(b => {
    const lat = b[0], lng = b[1], name = b[2], cap = b[3], ready = b[4], op = b[5], type = b[6], loc = b[7], hours = b[8];
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'bank-marker-pin',
        html: `<div style="background:#f59e0b;color:#1c1405;border:2px solid #fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 10px rgba(245,158,11,0.6)">🔋</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(bankLayer);

    marker.bindPopup(`
      <div style="font-family:system-ui;font-size:0.85rem">
        <b style="color:#f59e0b;font-size:0.95rem">🔋 ${esc(name)}</b><br/>
        <span style="color:#cbd5e1">${esc(op)} · ${esc(type)}</span><br/>
        <b style="color:#a3e635">${ready} of ${cap} Swappable Batteries Ready</b><br/>
        <small style="color:#94a3b8">${esc(loc)} · ${esc(hours)}</small><br/>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn-pill primary" style="flex:1;font-size:0.75rem;background:#f59e0b;color:#1c1405;border-color:#f59e0b" onclick="routeToPoint([${lat},${lng}], '${esc(name)}', 'bank')">⚡ Shortest Route to Swap</button>
          <button class="btn-pill" style="font-size:0.75rem" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}', '_blank')">Google Maps ↗</button>
        </div>
      </div>
    `);
  });
}

function drawStations() {
  routePortLayer.clearLayers();
  for (const st of Object.values(STATIONS)) {
    const n = NODE[st.node];
    if (!n) continue;
    const m = L.circleMarker(n.pt, {
      radius: 8,
      color: '#34d399',
      weight: 2,
      fillColor: '#059669',
      fillOpacity: 0.9
    }).addTo(routePortLayer);
    m.bindTooltip(`<b>⚡ ${esc(st.name)}</b><br/>${st.kw} kW DC · ${st.ports} Ports`, { direction: 'top' });
  }
}

/* =====================================================================
   Live Location Tracking & Battery SOS
   ===================================================================== */
// Location is only known/shown after the user explicitly chooses it this session
let herePos = null;
let hereLabel = null;
let hereSource = null; // 'route' = chosen in route search, 'sos' = Battery SOS search, 'manual' = GPS/map buttons
try { localStorage.removeItem('tn_here_pos'); localStorage.removeItem('tn_here_label'); } catch {}
let hereMarker = null;
let isochroneCircle = null;
let picking = false;

function findNearestCity(pt) {
  let best = null, bestD = Infinity;
  for (const n of Object.values(NODE)) {
    if (n.custom) continue;
    const d = hav(pt, n.pt);
    if (d < bestD) { bestD = d; best = n; }
  }
  return { city: best, dist: bestD };
}

function setHere(pos, label = 'Live Location', source = 'manual') {
  herePos = pos;
  hereLabel = label;
  hereSource = source;
  const sosInput = $('sosLocSearch');
  if (sosInput && document.activeElement !== sosInput) sosInput.value = label;

  const textEl = $('hereText');
  if (textEl) {
    const coordsStr = `(${pos[0].toFixed(4)}, ${pos[1].toFixed(4)})`;
    const cleanLabel = (label || 'Live Location').replace(coordsStr, '').trim();
    textEl.innerHTML = `📍 <b>${esc(cleanLabel || 'Live Location')}</b> <span class="mono" style="color:var(--cyan-light);font-size:0.8rem">${coordsStr}</span>`;
  }

  if (!hereMarker) {
    hereMarker = L.marker(pos, {
      icon: L.divIcon({
        className: '',
        html: '<div class="user-live-pin"><div class="pulse-ring"></div>📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      }),
      zIndexOffset: 1000
    }).addTo(map);
  } else {
    hereMarker.setLatLng(pos);
  }

  map.setView(pos, 11);
  findNearby(false);
  findBatteryBanks();
}
window.setHere = setHere;

// Hide the location pin & range ring and forget the position
function clearHere() {
  herePos = null;
  hereLabel = null;
  hereSource = null;
  if ($('sosLocSearch') && document.activeElement !== $('sosLocSearch')) $('sosLocSearch').value = '';
  if (hereMarker) { map.removeLayer(hereMarker); hereMarker = null; }
  isochroneLayer.clearLayers();
  isochroneCircle = null;
  const textEl = $('hereText');
  if (textEl) textEl.innerHTML = '📍 <span class="muted">Location not set</span>';
  findNearby(false);
  findBatteryBanks();
}
window.clearHere = clearHere;

const NEED_LOCATION_HTML = `<div class="muted" style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;font-size:0.82rem">
  📍 Search a place above or choose <b>Use my current location</b> to find chargers and battery swap hubs near you.</div>`;

function setCityAsHere(id) {
  if (NODE[id]) {
    setHere(NODE[id].pt, NODE[id].name);
    toast('📍 Position set to ' + NODE[id].name);
  }
}
window.setCityAsHere = setCityAsHere;

function getUserLocation(switchTab = false) {
  if (switchTab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    const tabLow = document.querySelector('[data-tab="low"]');
    if (tabLow) tabLow.classList.add('active');
    const paneLow = $('pane-low');
    if (paneLow) paneLow.classList.add('active');
    invalidateMapSize();
  }

  if (!navigator.geolocation) {
    toast('Geolocation is not supported in this browser environment.');
    return;
  }

  toast('📍 Acquiring live GPS position…');
  navigator.geolocation.getCurrentPosition(
    p => {
      const pt = [p.coords.latitude, p.coords.longitude];
      const near = findNearestCity(pt);
      const label = (near && near.dist < 15) ? `Live Location near ${near.city.name}` : 'Live GPS';
      setHere(pt, label);
      toast('📍 Live GPS position locked!');
    },
    err => {
      console.warn('Geolocation failed:', err);
      toast('⚠️ GPS unavailable or permission denied — location not shown.');
    },
    { enableHighAccuracy: true, timeout: 6000 }
  );
}
window.getUserLocation = getUserLocation;

/* ---------- Reachable Chargers Isochrone ---------- */
function findNearby(zoom = false) {
  const lowSoc = +$('lowSoc').value / 100;
  const car = EV.VEHICLES[$('evCar') ? $('evCar').value : 'nexon'] || EV.VEHICLES.nexon;
  const remainingKwh = lowSoc * car.cap;
  const maxRangeKm = remainingKwh / car.kwhPerKm;

  if (!herePos) {
    isochroneLayer.clearLayers();
    isochroneCircle = null;
    if ($('rangeText')) $('rangeText').innerHTML = `<b>${maxRangeKm.toFixed(0)} km Maximum Safe Range</b> (${remainingKwh.toFixed(1)} kWh remaining)`;
    if ($('nearOut')) $('nearOut').innerHTML = NEED_LOCATION_HTML;
    return;
  }
  const originPt = herePos || (NODE[$('evFrom').value] || NODE.coimbatore).pt;
  const originName = hereLabel || (NODE[$('evFrom').value] || NODE.coimbatore).name;
  const coordsStr = `(${originPt[0].toFixed(4)}, ${originPt[1].toFixed(4)})`;
  const cleanOrigin = originName.includes('(') ? originName : `${originName} ${coordsStr}`;

  if ($('rangeText')) {
    $('rangeText').innerHTML = `<b>${maxRangeKm.toFixed(0)} km Maximum Safe Range</b> (${remainingKwh.toFixed(1)} kWh remaining at ${Math.round(car.kwhPerKm * 1000)} Wh/km from ${esc(cleanOrigin)})`;
  }

  // Draw Reachable Isochrone Ring centered at live origin
  isochroneLayer.clearLayers();
  isochroneCircle = L.circle(originPt, {
    radius: maxRangeKm * 1000,
    color: '#06b6d4',
    weight: 2.5,
    dashArray: '8,6',
    fillColor: '#06b6d4',
    fillOpacity: 0.12,
    className: 'isochrone-ring'
  }).addTo(isochroneLayer);

  // Find and rank closest fast charging stations from originPt
  const nearby = chargers.map(c => {
    const dist = hav(originPt, [c[0], c[1]]);
    return { c, dist, reachable: dist <= maxRangeKm };
  }).sort((a, b) => a.dist - b.dist);

  const out = $('nearOut');
  if (!out) return;

  const reachableList = nearby.filter(x => x.reachable).slice(0, 6);
  if (!reachableList.length) {
    out.innerHTML = `
      <div style="padding:12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;color:#fca5a5">
        ⚠️ <b>Critical Battery Warning!</b> No verified fast chargers within ${maxRangeKm.toFixed(0)} km safe driving perimeter from ${esc(cleanOrigin)}. Seek roadside slow AC charging immediately.
      </div>`;
    return;
  }

  out.innerHTML = `
    <h3 style="font-size:0.88rem;margin:10px 0 6px;color:var(--cyan-light)">⚡ ${reachableList.length} Fast Chargers Within Battery Reach <small style="font-size:0.75rem;color:var(--text-muted)">from ${esc(cleanOrigin)}</small></h3>
    ${reachableList.map((x, i) => `
      <div class="stop-card" style="margin-bottom:8px">
        <div class="stop-badge-number">${i + 1}</div>
        <div class="stop-card-info">
          <b>⚡ ${esc(x.c[2])}</b>
          <small>${x.c[5] || 'EV Network'} · <b>${x.c[3] || 30} kW DC</b> · <b>${x.dist.toFixed(1)} km</b> away</small>
          <div class="row" style="margin-top:8px">
            <button class="btn-pill primary" style="font-size:0.76rem;flex:1" onclick="routeToPoint([${x.c[0]}, ${x.c[1]}], '${esc(x.c[2])}', 'charger')">⚡ Shortest Route to Charger</button>
            <button class="btn-pill" style="font-size:0.76rem" onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${originPt[0]},${originPt[1]}&destination=${x.c[0]},${x.c[1]}', '_blank')">Google Maps ↗</button>
          </div>
        </div>
      </div>`).join('')}`;

  if (zoom && isochroneCircle) {
    map.fitBounds(isochroneCircle.getBounds(), { padding: [50, 50] });
  }
}

/* ---------- Battery Swap Banks Search & Hero Routing ---------- */
function findBatteryBanks() {
  if (!herePos) {
    if ($('bankOut')) $('bankOut').innerHTML = NEED_LOCATION_HTML;
    return;
  }
  const originPt = herePos || (NODE[$('evFrom').value] || NODE.coimbatore).pt;
  const originName = hereLabel || (NODE[$('evFrom').value] || NODE.coimbatore).name;
  const radiusKm = Number($('bankRadius') ? $('bankRadius').value : 25) || 0;

  // Calculate distance from live position to all 40+ battery swap stations
  const list = batteryBanks.map(b => {
    const dist = hav(originPt, [b[0], b[1]]);
    return { b, dist };
  }).sort((a, b) => a.dist - b.dist);

  const out = $('bankOut');
  if (!out) return;

  if (!list.length) {
    out.innerHTML = `<p class="muted">No battery swap hubs available.</p>`;
    return;
  }

  const nearest = list[0];
  const withinRadius = (radiusKm === 0) ? list : list.filter(x => x.dist <= radiusKm);
  const displayList = withinRadius.length > 0 ? withinRadius : list.slice(0, 5);

  let html = '';

  // Top Hero Action: 1-Click Shortest Route to Nearest Swap Hub
  html += `
    <div class="bank-hero-card">
      <div class="bank-hero-title">
        <span style="font-size:0.75rem;font-weight:700;color:var(--amber-light);letter-spacing:0.05em">⚡ NEAREST BATTERY SWAP HUB</span>
        <span class="live-pill" style="background:rgba(163,230,53,0.15);color:var(--lime);border-color:rgba(163,230,53,0.3)">${nearest.b[4]} / ${nearest.b[3]} Swaps Ready</span>
      </div>
      <div style="font-size:0.95rem;font-weight:700;color:#fff;margin:2px 0">🔋 ${esc(nearest.b[2])}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
        ${nearest.b[5]} · <b>${nearest.dist.toFixed(1)} km</b> away (~${Math.round((nearest.dist / 50) * 60)} min) · ${esc(nearest.b[7])}
      </div>
      <button class="btn-pill primary" style="width:100%;font-weight:700;padding:8px 12px;background:linear-gradient(135deg, #f59e0b, #d97706);border-color:#f59e0b;color:#1c1405" onclick="routeToPoint([${nearest.b[0]}, ${nearest.b[1]}], '${esc(nearest.b[2])}', 'bank')">
        ⚡ Shortest Route to Nearest Swap Station (${nearest.dist.toFixed(1)} km)
      </button>
    </div>
  `;

  if (withinRadius.length === 0 && radiusKm > 0) {
    html += `
      <div class="note warn" style="margin-bottom:8px;font-size:0.78rem">
        ⚠️ No swap stations within ${radiusKm} km of ${esc(originName)}. Showing closest stations in Tamil Nadu:
      </div>`;
  }

  html += `
    <h3 style="font-size:0.85rem;margin:8px 0;color:var(--amber-light)">🔋 ${displayList.length} Swap Hubs Near ${esc(originName)}</h3>
    ${displayList.map((x, i) => `
      <div class="stop-card" style="margin-bottom:8px;border-color:rgba(245,158,11,0.35);background:rgba(245,158,11,0.04)">
        <div class="stop-badge-number" style="background:#f59e0b;color:#1c1405">${i + 1}</div>
        <div class="stop-card-info">
          <b style="color:#fbbf24">🔋 ${esc(x.b[2])}</b>
          <small>${x.b[5]} · <b style="color:#a3e635">${x.b[4]} / ${x.b[3]} Swaps Ready</b> · <b>${x.dist.toFixed(1)} km</b> away (~${Math.round((x.dist / 50) * 60)} min)</small>
          <div class="muted" style="font-size:0.72rem">${esc(x.b[7])} · <span class="tag ok">${esc(x.b[8])}</span></div>
          <div class="row" style="margin-top:6px">
            <button class="btn-pill primary" style="font-size:0.76rem;flex:1;background:rgba(245,158,11,0.2);border-color:rgba(245,158,11,0.5);color:#fbbf24" onclick="routeToPoint([${x.b[0]}, ${x.b[1]}], '${esc(x.b[2])}', 'bank')">⚡ Shortest Route to Swap</button>
            <button class="btn-pill" style="font-size:0.76rem" onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${originPt[0]},${originPt[1]}&destination=${x.b[0]},${x.b[1]}', '_blank')">Google Maps ↗</button>
          </div>
        </div>
      </div>`).join('')}`;

  out.innerHTML = html;
}

/* =====================================================================
   Shortest Route Engine from Live Location to Battery Bank / Charger
   ===================================================================== */
let nav = null;
const ARROW = { left: '⬅️', right: '➡️', 'sharp left': '↩️', 'sharp right': '↪️', 'slight left': '↖️', 'slight right': '↗️', straight: '⬆️', uturn: '🔄' };
const fmtD = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km';

window.routeToPoint = async function(destPt, destName, destType = 'bank') {
  const origin = herePos || (NODE[$('evFrom').value] || NODE.coimbatore).pt;
  const originName = hereLabel || (NODE[$('evFrom').value] || NODE.coimbatore).name;
  toast(`⚡ Calculating shortest road route from ${originName} to ${destName}…`);
  await startNav(destPt, destName, { origin, originName, destType, follow: true });
  setHud(`<b>${esc(originName)} ➔ ${esc(destName)}</b><span>${destType === 'bank' ? '🔋 Shortest Battery Swap Route' : '⚡ Shortest Charger Route'}</span>`);
};

async function startNav(dest, name, o = {}) {
  stopNav();
  const from = o.origin || herePos || (NODE[$('evFrom').value] || NODE.coimbatore).pt;
  const originName = o.originName || hereLabel || 'Live Location';
  const destType = o.destType || 'bank';

  const lowSoc = +$('lowSoc').value / 100;
  const car = EV.VEHICLES[$('evCar') ? $('evCar').value : 'nexon'] || EV.VEHICLES.nexon;

  let pts = [], steps = [], onRoad = false, roadMin = null;

  // Priority 1: Real road geometry & turn-by-turn steps (OSRM)
  try {
    const road = await fetchRoadGeometry([from, ...(o.via || []), dest], true);
    pts = road.pts;
    steps = road.steps;
    roadMin = road.min;
    onRoad = true;
  } catch (err) {
    console.warn('Road route unavailable, using fallback:', err);
  }

  // Priority 2: Offline Highway Graph Routing Fallback
  if (!pts.length) {
    const nearStart = findNearestCity(from);
    const nearEnd = findNearestCity(dest);

    if (nearStart.city.id !== nearEnd.city.id) {
      const g = graph(), opt = opts(), w = MODES.dist;
      const res = EV.astar(g, nearStart.city.id, nearEnd.city.id, opt, w, false);
      if (res && res.route) {
        pts = [from, ...res.route.path.map(id => NODE[id].pt), dest];
        steps = [
          { name: 'Depart from ' + originName, distance: hav(from, nearStart.city.pt) * 1000, maneuver: { type: 'depart', modifier: 'straight', location: [from[1], from[0]] } },
          ...res.route.path.map((id, idx) => ({
            name: 'Via ' + NODE[id].name + ' corridor',
            distance: (res.route.edges[idx] ? res.route.edges[idx].len : 15) * 1000,
            maneuver: { type: 'turn', modifier: 'straight', location: [NODE[id].pt[1], NODE[id].pt[0]] }
          })),
          { name: 'Arrive at ' + name, distance: hav(nearEnd.city.pt, dest) * 1000, maneuver: { type: 'arrive', modifier: 'straight', location: [dest[1], dest[0]] } }
        ];
      }
    }
  }

  // Priority 3: Direct connection
  if (!pts.length) {
    pts = [from, dest];
    steps = [
      { name: 'Head directly towards ' + name, distance: hav(from, dest) * 1000, maneuver: { type: 'depart', modifier: 'straight', location: [from[1], from[0]] } },
      { name: 'Arrive at ' + name, distance: 0, maneuver: { type: 'arrive', modifier: 'straight', location: [dest[1], dest[0]] } }
    ];
  }

  const distMeters = steps.reduce((sum, s) => sum + (s.distance || 0), 0) || (hav(from, dest) * 1000);
  const distKm = distMeters / 1000;
  const driveTimeMin = Math.round(roadMin != null ? roadMin : (distKm / 55) * 60);
  const energyKwh = distKm * car.kwhPerKm;
  const arrivalSoc = Math.max(0, Math.round(lowSoc * 100 - (energyKwh / car.cap) * 100));

  nav = { pts, steps, cur: 0, dest, name, dist: distMeters, speed: 75, sim: false, simT: null, soc: arrivalSoc, energyKwh, driveTimeMin, from, originName, destType };

  // Render glowing route polyline on map
  const glowColor = destType === 'bank' ? '#f59e0b' : '#38bdf8';
  L.polyline(pts, { color: '#020617', weight: 11, opacity: 0.6 }).addTo(navLayer);
  const mainLine = L.polyline(pts, { color: glowColor, weight: 6, opacity: 0.95, dashArray: onRoad ? null : '10,6' }).addTo(navLayer);
  if (!onRoad) toast('⚠️ Road map unavailable (offline?) — showing an approximate straight-line route.');

  // Markers
  L.marker(dest, {
    icon: L.divIcon({
      className: '',
      html: `<div class="nav-flag">${destType === 'bank' ? '🔋' : '⚡'}</div>`,
      iconSize: [28, 28],
      iconAnchor: [4, 26]
    })
  }).addTo(navLayer);

  nav.me = L.circleMarker(from, { radius: 9, color: '#fff', weight: 3, fillColor: '#06b6d4', fillOpacity: 1 }).addTo(navLayer);
  map.fitBounds(mainLine.getBounds(), { padding: [70, 70] });

  // Floating Navigation HUD Card
  const card = document.createElement('div');
  card.id = 'navCard';
  card.className = 'nav-card';
  card.innerHTML = `
    <div class="nav-top">
      <div class="nav-arrow" id="nvArrow">⬆️</div>
      <div class="nav-main">
        <small id="nvSub">${onRoad ? '🛣️ Road route' : '⚠️ Approximate route'} (${distKm.toFixed(1)} km · ~${fmtMin(driveTimeMin)})</small>
        <b id="nvText">${esc(name)}</b>
      </div>
      <button class="modal-close" id="nvClose" title="End navigation">&times;</button>
    </div>
    <div class="nav-meta">
      <span id="nvRem">${fmtD(nav.dist)} remaining</span>
      <span class="nav-speedo" id="nvSpeed">75 <small>km/h</small></span>
      <span class="nav-regen-meter" id="nvRegen" style="display:none">⚡ +12 kW Regen</span>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 8px">
      🔋 Battery at arrival: <b style="color:${arrivalSoc > 10 ? 'var(--lime)' : '#ef4444'}">~${arrivalSoc}%</b> (Uses ${energyKwh.toFixed(1)} kWh)
    </div>
    <div class="nav-bar"><u id="nvProg"></u></div>
    <div class="row">
      <button id="nvPrev" class="btn-pill">◀ Prev</button>
      <button id="nvSim" class="btn-pill primary" style="flex:2">▶ Demo Drive</button>
      <button id="nvNext" class="btn-pill">Next ▶</button>
      <button id="nvGmaps" class="btn-pill secondary-cyan" title="Open Google Maps Navigation">GMaps ↗</button>
    </div>`;

  document.querySelector('.mapwrap').appendChild(card);

  $('nvClose').onclick = stopNav;
  $('nvPrev').onclick = () => { nav.cur = Math.max(0, nav.cur - 1); renderNav(); };
  $('nvNext').onclick = () => { nav.cur = Math.min(nav.steps.length - 1, nav.cur + 1); renderNav(); };
  $('nvSim').onclick = simDrive;
  $('nvGmaps').onclick = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${dest[0]},${dest[1]}`, '_blank');
  };

  renderNav();
}

function renderNav() {
  if (!nav || !nav.steps[nav.cur]) return;
  const st = nav.steps[nav.cur];
  const arrowEl = $('nvArrow');
  if (arrowEl) arrowEl.textContent = st.maneuver.type === 'arrive' ? '🏁' : ARROW[st.maneuver.modifier] || '⬆️';
  if ($('nvText')) $('nvText').textContent = st.name || ('Proceed towards ' + nav.name);
  if ($('nvSub')) $('nvSub').textContent = `Next turn in ${fmtD(st.distance)}`;
  if ($('nvProg')) $('nvProg').style.width = Math.round(100 * (nav.cur / Math.max(1, nav.steps.length - 1))) + '%';
}

function simDrive() {
  if (!nav) return;
  if (nav.sim) {
    clearInterval(nav.simT);
    nav.sim = false;
    $('nvSim').textContent = '▶ Demo Drive';
    $('nvRegen').style.display = 'none';
    return;
  }

  nav.sim = true;
  $('nvSim').textContent = '⏹ Stop Drive';
  let ptIdx = 0;
  const stepJump = Math.max(1, Math.floor(nav.pts.length / 100));

  nav.simT = setInterval(() => {
    ptIdx += stepJump;
    if (ptIdx >= nav.pts.length) {
      ptIdx = nav.pts.length - 1;
      nav.me.setLatLng(nav.pts[ptIdx]);
      toast('🏁 Arrived safely at ' + nav.name + '!');
      clearInterval(nav.simT);
      nav.sim = false;
      $('nvSim').textContent = '▶ Demo Drive';
      return;
    }

    const curPt = nav.pts[ptIdx];
    nav.me.setLatLng(curPt);
    map.panTo(curPt, { animate: true, duration: 0.25 });

    const curSpeed = Math.floor(65 + Math.random() * 25);
    if ($('nvSpeed')) $('nvSpeed').innerHTML = `${curSpeed} <small>km/h</small>`;
    
    const isDescent = ptIdx % 7 === 0;
    if ($('nvRegen')) {
      $('nvRegen').style.display = isDescent ? 'inline-block' : 'none';
    }
  }, 350);
}

function stopNav() {
  if (!nav) return;
  if (nav.simT) clearInterval(nav.simT);
  nav = null;
  navLayer.clearLayers();
  const c = $('navCard');
  if (c) c.remove();
}

function navRoute(r) {
  const first = NODE[r.path[0]], last = NODE[r.path.at(-1)];
  startNav(last.pt, last.name, { origin: first.pt, via: r.stops.map(x => NODE[x.node].pt), destType: 'route' });
}

/* =====================================================================
   A* EV Route Optimization (Studio Tab 1)
   ===================================================================== */
const MODES = { dist: { time: 0.02, dist: 1, energy: 0 }, time: { time: 1, dist: 0, energy: 0 }, energy: { time: 0.02, dist: 0, energy: 1 } };
let lastPlan = null;

function graph() {
  const normalizedEdges = edges.map(e => ({
    ...e,
    id: e.id || `e_${e.u}_${e.v}`,
    a: e.a || e.u,
    b: e.b || e.v,
    time: e.time || Math.round((e.len / (e.spd || 65)) * 60)
  }));
  normalizedEdges.push(...customEdges());
  return { nodes: Object.keys(NODE), edges: normalizedEdges, elev, coords: Object.fromEntries(Object.values(NODE).map(n => [n.id, n.pt])), stations: STATIONS };
}

function updateWeather(fromId, toId) {
  const weatherEl = $('weather');
  if (!weatherEl) return;
  const fromCity = NODE[fromId] || NODE.coimbatore;
  const toCity = NODE[toId] || NODE.ooty;

  const getWeatherFor = city => {
    const isHill = city.elev > 1000;
    const isCoastal = city.elev < 30;
    const temp = isHill ? Math.round(22 - (city.elev / 150)) : isCoastal ? 30 : Math.round(34 - (city.elev / 100));
    const condition = isHill ? 'Cool Highland Mist' : isCoastal ? 'Warm Coastal Breeze' : 'Clear & Sunny';
    const icon = isHill ? '⛅' : isCoastal ? '🌊' : '☀️';
    const wind = isHill ? 14 : isCoastal ? 18 : 10;
    const humidity = isHill ? 82 : isCoastal ? 76 : 58;
    return { temp, condition, icon, wind, humidity };
  };

  const wFrom = getWeatherFor(fromCity);
  const wTo = getWeatherFor(toCity);

  weatherEl.innerHTML = `
    <div style="padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <b style="font-size:0.88rem;color:#fff">${esc(fromCity.name)} (Origin)</b>
          <div style="font-size:0.75rem;color:var(--text-muted)">Elev: ${fromCity.elev}m · ${wFrom.condition}</div>
        </div>
        <div style="font-size:1.6rem">${wFrom.icon}</div>
      </div>
      <div class="row" style="margin-top:6px;gap:12px;font-size:0.78rem">
        <span style="font-weight:700;color:var(--lime);font-size:1.05rem">${wFrom.temp}°C</span>
        <span style="color:var(--text-dim)">💨 ${wFrom.wind} km/h</span>
        <span style="color:var(--text-dim)">💧 ${wFrom.humidity}%</span>
      </div>
    </div>
    <div style="padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <b style="font-size:0.88rem;color:#fff">${esc(toCity.name)} (Destination)</b>
          <div style="font-size:0.75rem;color:var(--text-muted)">Elev: ${toCity.elev}m · ${wTo.condition}</div>
        </div>
        <div style="font-size:1.6rem">${wTo.icon}</div>
      </div>
      <div class="row" style="margin-top:6px;gap:12px;font-size:0.78rem">
        <span style="font-weight:700;color:var(--lime);font-size:1.05rem">${wTo.temp}°C</span>
        <span style="color:var(--text-dim)">💨 ${wTo.wind} km/h</span>
        <span style="color:var(--text-dim)">💧 ${wTo.humidity}%</span>
      </div>
    </div>
  `;
}

function opts() {
  const t = ($('evDepart') ? $('evDepart').value : '').split(':'), d = new Date();
  if (t.length === 2) d.setHours(+t[0], +t[1], 0, 0);
  const carKey = $('evCar') ? $('evCar').value : 'nexon';
  return {
    veh: EV.VEHICLES[carKey] || EV.VEHICLES.nexon,
    soc0: +$('evSoc').value / 100,
    reserve: +$('evReserve').value / 100,
    target: +$('evTarget').value / 100,
    depart: d,
    now: new Date(),
    reports: []
  };
}

function plan(fit = true) {
  const fromEl = $('evFrom'), toEl = $('evTo');
  if (!fromEl || !toEl) return;
  const s = fromEl.value, t = toEl.value;
  if (!s || !t || !NODE[s] || !NODE[t]) {
    $('evOut').innerHTML = '<div class="muted" style="padding:14px;background:rgba(255,255,255,0.04);border-radius:10px">🔍 Search and select both an <b>origin</b> and a <b>destination</b> city above to compute your EV route.</div>';
    roadToken++;
    routeLayer.clearLayers();
    lastPlan = null;
    return;
  }
  store.set('tn_from', s);
  store.set('tn_to', t);
  updateWeather(s, t);
  if (s === t || (NODE[s].custom && NODE[t].custom && hav(NODE[s].pt, NODE[t].pt) < 0.3)) {
    $('evOut').innerHTML = '<div class="muted" style="padding:14px;background:rgba(255,255,255,0.04);border-radius:10px">Please select two distinct origin and destination places across Tamil Nadu.</div>';
    roadToken++;
    routeLayer.clearLayers();
    return;
  }
  const g = graph(), o = opts(), w = MODES[$('evMode') ? $('evMode').value : 'dist'] || MODES.dist;
  const t0 = performance.now();
  const A = EV.astar(g, s, t, o, w, true);
  const D = EV.astar(g, s, t, o, w, false);
  const options = A.route ? [A.route, ...alternativeRoutes(g, s, t, o, w, A.route, 2)] : [];
  const ms = performance.now() - t0;
  lastPlan = { A, D, o, s, t, ms, options, sel: 0 };
  renderRouteOutput(A, D, o, ms, fit);
}
window.plan = plan;

/* ---------- Alternative routes (Yen-style spur search on the highway graph) ---------- */
function alternativeRoutes(g, s, t, o, w, best, k = 2) {
  const key = r => r.path.join('>');
  const seen = new Set([key(best)]);
  const cands = [];
  // Ban each edge of the best route in turn and re-plan: every distinct result is a real alternative
  for (const banned of best.edges) {
    const res = EV.astar({ ...g, edges: g.edges.filter(e => e.id !== banned.id) }, s, t, o, w, true);
    if (!res.route || seen.has(key(res.route))) continue;
    seen.add(key(res.route));
    if (res.route.dist > best.dist * 1.6) continue; // skip absurd detours
    cands.push(res);
  }
  cands.sort((a, b) => a.cost - b.cost);
  const overlap = (a, b) => {
    const ids = new Set(a.edges.map(e => e.id));
    const shared = b.edges.filter(e => ids.has(e.id)).reduce((x, e) => x + e.len, 0);
    return shared / Math.min(a.dist, b.dist);
  };
  const chosen = [best];
  for (const c of cands) {
    if (chosen.length > k) break;
    if (chosen.every(x => overlap(x, c.route) < 0.7)) chosen.push(c.route);
  }
  return chosen.slice(1);
}

function selectRoute(i) {
  const p = lastPlan;
  if (!p || !p.options[i] || p.sel === i) return;
  p.sel = i;
  renderRouteOutput({ ...p.A, route: p.options[i] }, p.D, p.o, p.ms, true);
  toast(i === 0 ? '✅ Switched back to the recommended route' : `🛣️ Switched to alternative route ${i}`);
}
window.selectRoute = selectRoute;

const viaNames = r => {
  const mid = r.path.slice(1, -1).map(id => NODE[id].name);
  if (!mid.length) return 'Direct';
  return 'via ' + (mid.length <= 2 ? mid : [mid[Math.floor(mid.length / 3)], mid[Math.floor(2 * mid.length / 3)]]).join(', ');
};

const clockTime = (d, addMin) => new Date(d.getTime() + addMin * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

function renderRouteOutput(A, D, o, ms, fit) {
  const out = $('evOut'), r = A.route;
  routeLayer.clearLayers();
  routePortLayer.clearLayers();
  setHud(null);

  if (!r) {
    out.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;line-height:1.5">
        ⚠️ <b>Route Unreachable with Current Battery Parameters</b><br/>
        No path found that preserves the battery above your ${pct(o.reserve)} safety reserve. Try setting a higher departure charge, lowering the reserve margin, or choosing a larger battery vehicle.
      </div>`;
    return;
  }

  const savedExpansions = D.expansions ? Math.round(100 * (1 - A.expansions / D.expansions)) : 0;
  const chargeMin = r.stops.reduce((x, s) => x + s.chargeMin + s.wait, 0);
  const evCostInr = Math.round(r.energy * 18);
  const petrolCostInr = Math.round((r.dist / 15) * 102);
  const moneySavedInr = Math.max(0, petrolCostInr - evCostInr);
  const co2AvoidedKg = (r.dist * 0.12).toFixed(1);

  out.innerHTML = `
    <div class="route-summary-hero">
      <div class="row" style="align-items:flex-start">
        <div>
          <span class="hero-tag">A* ENERGY-OPTIMIZED CORRIDOR</span>
          <div class="hero-title">${NODE[r.path[0]].name} ➔ ${NODE[r.path.at(-1)].name}</div>
        </div>
        <div class="hero-time">${fmtMin(r.time)}</div>
      </div>
      <div class="hero-grid">
        <div class="hero-metric">
          <small>Total Distance</small>
          <b>${r.dist.toFixed(0)} km</b>
        </div>
        <div class="hero-metric">
          <small>Arrival Battery</small>
          <b style="color:${r.soc > o.reserve ? 'var(--lime)' : 'var(--amber)'}">${pct(r.soc)}</b>
        </div>
        <div class="hero-metric">
          <small>Net Energy Used</small>
          <b>${r.energy.toFixed(1)} kWh</b>
        </div>
        <div class="hero-metric">
          <small>Charging Stops</small>
          <b>${r.stops.length} stop${r.stops.length === 1 ? '' : 's'}</b>
        </div>
      </div>
      <div class="hero-savings-banner">
        <span>🌱 Saved <b>₹${moneySavedInr.toLocaleString('en-IN')}</b> vs petrol · Avoided <b>${co2AvoidedKg} kg CO₂</b></span>
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button id="btnStartNav" class="primary" style="flex:2">🧭 Navigate in App</button>
        <button id="btnCopyItinerary" class="btn-pill" style="flex:1">📋 Copy</button>
        <button id="btnOpenGMaps" class="btn-pill secondary-cyan">GMaps ↗</button>
      </div>
    </div>

    <section style="margin-top:16px">
      <h3>Elevation &amp; Battery SoC Profile</h3>
      <div id="elevationChartContainer" class="elevation-chart-card">
        <canvas id="elevCanvas" height="150"></canvas>
        <div id="scrubTooltip" class="chart-scrubber-tooltip" style="display:none"></div>
      </div>
    </section>

    <section style="margin-top:16px">
      <h3>Step-by-Step Waypoints &amp; Charging Stops</h3>
      <ol class="steps">
        ${r.path.map((id, i) => {
          const isStop = r.stops.find(s => s.node === id);
          return `
            <li class="${isStop ? 'charging-stop-item' : ''}">
              <div class="step-header">
                <b>${NODE[id].name}</b>
                ${isStop ? `<span class="tag stop">⚡ Charge +${isStop.kwh.toFixed(1)} kWh (${Math.round(isStop.chargeMin)} min)</span>` : ''}
              </div>
              <div class="muted" style="font-size:0.75rem">Elevation: ${NODE[id].elev}m asl</div>
            </li>`;
        }).join('')}
      </ol>
    </section>
  `;

  // Route options (recommended + lighter alternatives the user can pick)
  const plan_ = lastPlan || { options: [r], sel: 0 };
  const sel = plan_.options.indexOf(r) >= 0 ? plan_.options.indexOf(r) : 0;
  if (plan_.options.length > 1) {
    const base = plan_.options[0];
    const delta = (v, unit, f = x => x.toFixed(0)) => v === 0 ? '' : ` <em>${v > 0 ? '+' : '−'}${f(Math.abs(v))}${unit}</em>`;
    $('evOut').insertAdjacentHTML('afterbegin', `
      <div class="route-options">
        <div class="route-options-title">🛣️ Route options <small>tap to choose</small></div>
        ${plan_.options.map((x, i) => `
          <button class="route-option ${i === sel ? 'selected' : ''}" onclick="selectRoute(${i})">
            <span class="route-option-tag">${i === 0 ? '⭐ Recommended' : 'Alternative ' + i}${i === sel ? ' · selected' : ''}</span>
            <b>${x.dist.toFixed(0)} km · ${fmtMin(x.time)}</b>${i ? delta(x.time - base.time, ' min', m => Math.round(m)) : ''}
            <small>${esc(viaNames(x))} · ${x.stops.length} charging stop${x.stops.length === 1 ? '' : 's'}</small>
          </button>`).join('')}
      </div>`);
  }

  // Draw routes: faint previews first, then snap every option to real roads
  const allPts = plan_.options.length ? plan_.options.map(x => x.path.map(id => NODE[id].pt)) : [r.path.map(id => NODE[id].pt)];
  allPts.forEach((pts, i) => {
    if (i !== sel) L.polyline(pts, { color: '#6ee7b7', weight: 3, opacity: 0.4, dashArray: '4,8' }).addTo(routeLayer);
  });
  const preview = L.polyline(allPts[sel] || allPts[0], { color: '#10b981', weight: 3, opacity: 0.5, dashArray: '4,8' }).addTo(routeLayer);
  if (fit) map.fitBounds(preview.getBounds(), { padding: [60, 60] });
  $('evOut').insertAdjacentHTML('afterbegin', '<div id="roadInfo" class="road-info">🛣️ Snapping route to real roads…</div>');
  drawRoadRoutes(allPts, sel, plan_.options, fit);

  // Draw Planned Charging Stop Markers
  for (const s of r.stops) {
    const pt = NODE[s.node].pt;
    L.circleMarker(pt, { radius: 10, color: '#f59e0b', weight: 3, fillColor: '#d97706', fillOpacity: 1 }).addTo(routePortLayer)
      .bindTooltip(`<b>⚡ Charging Stop: ${NODE[s.node].name}</b><br/>Charge: +${s.kwh.toFixed(1)} kWh (${Math.round(s.chargeMin)} min)`, { permanent: true, direction: 'top' });
  }

  $('btnStartNav').onclick = () => navRoute(r);
  $('btnCopyItinerary').onclick = () => copyRouteItinerary(r, o, { evCostInr, petrolCostInr, moneySavedInr, co2AvoidedKg });
  $('btnOpenGMaps').onclick = () => navRoute(r);

  drawElevationChart(r, o);
  updateCorridorChargers(r);
  setHud(`<b>${NODE[r.path[0]].name} ➔ ${NODE[r.path.at(-1)].name}</b><span>${r.dist.toFixed(0)} km · ${fmtMin(r.time)} · ${r.stops.length} stop${r.stops.length === 1 ? '' : 's'}</span>`);
}

/* ---------- Road-following route geometry (OSRM) ---------- */
const roadCache = new Map();
let roadToken = 0;

async function fetchRoadGeometry(pts, withSteps = false) {
  const key = (withSteps ? 'S|' : '') + pts.map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(';');
  if (roadCache.has(key)) return roadCache.get(key);
  const wp = pts.map(p => p[1] + ',' + p[0]).join(';');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${wp}?overview=full&geometries=geojson${withSteps ? '&steps=true' : ''}`, { signal: ctrl.signal });
    const j = await res.json();
    if (!j.routes || !j.routes[0]) throw new Error(j.message || 'No road route');
    const rt = j.routes[0];
    const out = {
      pts: rt.geometry.coordinates.map(c => [c[1], c[0]]), km: rt.distance / 1000, min: rt.duration / 60,
      steps: withSteps ? rt.legs.flatMap(l => l.steps) : []
    };
    roadCache.set(key, out);
    return out;
  } finally {
    clearTimeout(timer);
  }
}

async function drawRoadRoutes(allPts, sel, options, fit) {
  const token = ++roadToken;
  const info = () => $('roadInfo');
  const results = await Promise.allSettled(allPts.map(pts => fetchRoadGeometry(pts)));
  if (token !== roadToken) return; // a newer route was requested meanwhile
  routeLayer.clearLayers();
  const lineFor = i => results[i].status === 'fulfilled' ? results[i].value.pts : allPts[i];
  const base = options[0];

  // Alternatives underneath, in a lighter colour, clickable to select
  allPts.forEach((_, i) => {
    if (i === sel) return;
    const pts = lineFor(i), x = options[i];
    const style = { color: '#6ee7b7', weight: 6, opacity: 0.75 };
    if (results[i].status !== 'fulfilled') style.dashArray = '10,6';
    L.polyline(pts, { color: '#ffffff', weight: 10, opacity: 0.55 }).addTo(routeLayer);
    const line = L.polyline(pts, style).addTo(routeLayer);
    const label = i === 0 ? '⭐ Recommended' : `Alt ${i}`;
    const dt = x && base ? Math.round(x.time - base.time) : 0;
    line.bindTooltip(`${label}${i && dt ? ` · ${dt > 0 ? '+' : '−'}${fmtMin(Math.abs(dt))}` : ''}`, { permanent: true, direction: 'center', className: 'alt-route-label', interactive: true });
    line.on('click', () => selectRoute(i));
    line.on('mouseover', () => line.setStyle({ opacity: 1, weight: 8 }));
    line.on('mouseout', () => line.setStyle({ opacity: 0.75, weight: 6 }));
    const tt = line.getTooltip();
    if (tt) tt.on('click', () => selectRoute(i));
  });

  // Selected route on top
  const ok = results[sel] && results[sel].status === 'fulfilled';
  const pts = lineFor(sel);
  L.polyline(pts, { color: '#020617', weight: 11, opacity: 0.55, interactive: false }).addTo(routeLayer);
  const line = L.polyline(pts, { color: '#10b981', weight: 6, opacity: 0.95, interactive: false, dashArray: ok ? null : '10,6' }).addTo(routeLayer);
  if (fit) map.fitBounds(line.getBounds(), { padding: [60, 60] });

  if (info()) {
    if (ok) {
      const road = results[sel].value;
      info().innerHTML = `🛣️ Following real roads · <b>${road.km.toFixed(0)} km</b> by road · ~${fmtMin(road.min)} driving`
        + (allPts.length > 1 ? `<br/><span class="muted">Lighter lines are alternative routes — tap one on the map to switch.</span>` : '');
    } else {
      info().innerHTML = '⚠️ Road map unavailable (offline?) — showing the highway corridor as straight lines.';
    }
  }
}

function setHud(html) {
  let hud = $('mapHud');
  if (!html) { if (hud) hud.remove(); return; }
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'mapHud';
    hud.className = 'map-hud';
    document.querySelector('.mapwrap').appendChild(hud);
  }
  hud.innerHTML = html;
}

/* ---------- Elevation & Battery Profile Chart ---------- */
let scrubberMarker = null;
function drawElevationChart(r, o) {
  const canvas = $('elevCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 360;
  const h = 150;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  const elevs = r.path.map(id => NODE[id].elev);
  const minElev = 0, maxElev = Math.max(2400, Math.max(...elevs) + 200);

  ctx.clearRect(0, 0, w, h);

  // Elevation area gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
  grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  ctx.beginPath();
  ctx.moveTo(0, h);
  const stepX = w / (elevs.length - 1);
  elevs.forEach((e, i) => {
    const x = i * stepX;
    const y = h - (e / maxElev) * (h - 20) - 10;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Top elevation stroke
  ctx.beginPath();
  elevs.forEach((e, i) => {
    const x = i * stepX;
    const y = h - (e / maxElev) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Chart interactivity (hover scrubber)
  canvas.onmousemove = ev => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = ev.clientX - rect.left;
    const idx = Math.min(elevs.length - 1, Math.max(0, Math.round(mouseX / stepX)));
    const cityId = r.path[idx];
    const node = NODE[cityId];
    if (!scrubberMarker) {
      scrubberMarker = L.circleMarker(node.pt, { radius: 8, color: '#38bdf8', weight: 3, fillColor: '#020617', fillOpacity: 1 }).addTo(map);
    } else {
      scrubberMarker.setLatLng(node.pt);
    }
  };

  canvas.onmouseleave = () => {
    if (scrubberMarker) { map.removeLayer(scrubberMarker); scrubberMarker = null; }
  };
}

function updateCorridorChargers(r) {
  const box = $('corridorChargersList');
  if (!box) return;
  const corridorStations = Object.values(STATIONS).filter(s => r.path.includes(s.node));

  if (!corridorStations.length) {
    box.innerHTML = '<p class="muted">No designated fast charging hubs directly on this highway route.</p>';
    return;
  }

  box.innerHTML = corridorStations.map(st => {
    const isPlannedStop = r.stops.some(x => x.node === st.node);
    return `
      <div style="padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid ${isPlannedStop ? 'rgba(251,191,36,0.4)' : 'var(--line)'};border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <b style="color:${isPlannedStop ? 'var(--amber-light)' : '#fff'}">${isPlannedStop ? '⚡ PLANNED STOP: ' : ''}${esc(st.name)}</b>
          <div class="muted" style="font-size:0.75rem">${st.ports} ports · ${st.kw} kW DC</div>
        </div>
        <button class="btn-pill" style="font-size:0.75rem" onclick="map.setView([${NODE[st.node].pt.join(',')}], 14)">View</button>
      </div>`;
  }).join('');
}

/* =====================================================================
   Itinerary Copy & Export Manifest
   ===================================================================== */
function generateItineraryText(r, o, metrics) {
  const fromCity = NODE[r.path[0]].name;
  const toCity = NODE[r.path.at(-1)].name;
  const chargeMin = r.stops.reduce((x, s) => x + s.chargeMin + s.wait, 0);

  let text = `==========================================================\n`;
  text += `⚡ VOLTPATH TAMIL NADU — OPTIMAL EV ROUTE MANIFEST\n`;
  text += `==========================================================\n`;
  text += `Corridor:        ${fromCity} ➔ ${toCity}\n`;
  text += `Vehicle Fleet:   ${o.veh.name} (${o.veh.cap} kWh battery)\n`;
  text += `Departure Time:  ${clockTime(o.depart, 0)} IST\n`;
  text += `Total Distance:  ${r.dist.toFixed(0)} km\n`;
  text += `Driving Time:    ${fmtMin(r.time - chargeMin)}\n`;
  text += `Charging Time:   ${fmtMin(chargeMin)} (${r.stops.length} stop${r.stops.length === 1 ? '' : 's'})\n`;
  text += `Total Journey:   ${fmtMin(r.time)} (ETA: ${clockTime(o.depart, r.time)})\n`;
  text += `Arrival Battery: ${pct(r.soc)} (Reserve: ${pct(o.reserve)})\n\n`;

  text += `FINANCIAL & CARBON SAVINGS:\n`;
  text += `- EV Energy Used:        ${r.energy.toFixed(1)} kWh (~₹${metrics.evCostInr} at ₹18/kWh)\n`;
  text += `- Petrol Equivalent:     ₹${metrics.petrolCostInr} (at ₹102/L, 15 km/L)\n`;
  text += `- Net Money Saved:       ₹${metrics.moneySavedInr.toLocaleString('en-IN')}\n`;
  text += `- CO₂ Emissions Avoided: ${metrics.co2AvoidedKg} kg CO₂\n\n`;

  text += `WAYPOINT-BY-WAYPOINT BREAKDOWN:\n`;
  let cumKm = 0;
  for (let i = 0; i < r.path.length; i++) {
    const nodeName = NODE[r.path[i]].name;
    const isStop = r.stops.find(s => s.node === r.path[i]);
    text += `${i + 1}. ${nodeName} [km ${cumKm.toFixed(0)}]`;
    if (isStop) {
      text += `\n   ⚡ CHARGING STOP: ${STATIONS[isStop.node].name}`;
      text += `\n   - Charge ${Math.round(isStop.chargeMin)} min (+${isStop.kwh.toFixed(1)} kWh) up to ${pct(o.target)}`;
    }
    text += `\n`;
    if (i < r.edges.length) cumKm += r.edges[i].len;
  }

  text += `\nNavigation: open this route in VoltPath and press "Navigate in app" for turn-by-turn directions.\n`;
  text += `==========================================================\n`;
  return text;
}

function copyRouteItinerary(r, o, metrics) {
  const text = generateItineraryText(r, o, metrics);
  navigator.clipboard.writeText(text).then(() => {
    toast('📋 Full Trip Itinerary copied to clipboard!');
  }).catch(() => {
    showExportModal(r, o, metrics);
  });
}

function showExportModal(r, o, metrics) {
  const text = generateItineraryText(r, o, metrics);
  if ($('itineraryText')) $('itineraryText').value = text;
  if ($('modalExport')) $('modalExport').hidden = false;
}

/* =====================================================================
   Modals, UI & Events Initialization
   ===================================================================== */
function toast(text) {
  const tc = $('toasts');
  if (!tc) return;
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  tc.appendChild(d);
  setTimeout(() => {
    d.style.opacity = '0';
    setTimeout(() => d.remove(), 300);
  }, 3500);
}

window.closeModal = function(id) {
  const el = $(id);
  if (el) el.hidden = true;
};

/* ---------- Origin / Destination Search: Cities, Local Areas & Current Location ---------- */
const CUSTOM_ID = { evFrom: '__from', evTo: '__to' };
const TN_VIEWBOX = '76.0,13.7,80.5,7.9'; // lon_min,lat_max,lon_max,lat_min
const baseCities = () => Object.values(NODE).filter(n => !n.custom);

function nearestCities(pt, k = 2) {
  return baseCities().map(n => ({ n, d: hav(pt, n.pt) })).sort((a, b) => a.d - b.d).slice(0, k);
}

// Road links from a searched place to its nearest highway-network cities
function customEdges() {
  const out = [];
  const ids = Object.values(CUSTOM_ID).filter(id => NODE[id]);
  ids.forEach(id => {
    nearestCities(NODE[id].pt, 2).forEach(({ n, d }) => {
      const len = Math.max(0.5, Math.round(d * 1.3 * 10) / 10); // ~30% road winding factor
      out.push({ id: `e_${id}_${n.id}`, u: id, v: n.id, a: id, b: n.id, len, hwy: 'Local roads', spd: 40, time: Math.round(len / 40 * 60) });
    });
  });
  if (ids.length === 2) {
    const d = hav(NODE[ids[0]].pt, NODE[ids[1]].pt);
    if (d < 60) {
      const len = Math.max(0.5, Math.round(d * 1.3 * 10) / 10);
      out.push({ id: 'e___from___to', u: ids[0], v: ids[1], a: ids[0], b: ids[1], len, hwy: 'Local roads', spd: 40, time: Math.round(len / 40 * 60) });
    }
  }
  return out;
}

function clearCustom(field, keepHere = false) {
  const id = CUSTOM_ID[field];
  const wasGps = NODE[id] && NODE[id].gps;
  delete NODE[id];
  delete elev[id];
  const other = NODE[CUSTOM_ID[field === 'evFrom' ? 'evTo' : 'evFrom']];
  if (wasGps && !keepHere && !(other && other.gps) && hereSource === 'route') clearHere();
}

function setCity(field, id) {
  const hidden = $(field), input = $(field + 'Search');
  if (!hidden || !input) return;
  if (id !== CUSTOM_ID[field]) clearCustom(field);
  const n = NODE[id];
  hidden.value = n ? n.id : '';
  input.value = n ? n.name : '';
  input.classList.remove('invalid');
}

// Use any searched place / GPS fix as the origin or destination
function setPlace(field, pt, name, gps = false) {
  const near = nearestCities(pt, 1)[0];
  if (!near || near.d > 80) {
    toast('📍 That place is outside the Tamil Nadu charging network. Please choose a location inside Tamil Nadu.');
    return false;
  }
  const id = CUSTOM_ID[field];
  clearCustom(field, gps); // replacing a GPS pick with a typed place hides the pin
  NODE[id] = { id, name, pt, elev: near.n.elev, custom: true, gps };
  elev[id] = near.n.elev;
  setCity(field, id);
  return true;
}

function swapPlaces() {
  const snap = f => { const n = NODE[$(f).value]; return n ? { ...n } : null; };
  const a = snap('evFrom'), b = snap('evTo');
  const apply = (f, n) => n ? (n.custom ? setPlace(f, n.pt, n.name, n.gps) : setCity(f, n.id)) : setCity(f, '');
  clearCustom('evFrom', true); clearCustom('evTo', true);
  apply('evFrom', b); apply('evTo', a);
}

async function searchLocalAreas(q, signal) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=7&countrycodes=in&bounded=1'
    + '&viewbox=' + TN_VIEWBOX + '&accept-language=en&q=' + encodeURIComponent(q);
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const rows = await res.json();
  return rows
    .filter(r => !r.address || !r.address.state || /tamil nadu|puducherry/i.test(r.address.state))
    .map(r => {
      const a = r.address || {};
      const title = r.name || r.display_name.split(',')[0];
      const area = [a.suburb || a.neighbourhood || a.village || a.town, a.city || a.county || a.state_district]
        .filter(x => x && x !== title).slice(0, 2).join(', ');
      return { type: 'place', pt: [+r.lat, +r.lon], name: area ? `${title}, ${area.split(',')[0]}` : title, sub: area || (a.state || '') };
    });
}

async function reverseLabel(pt) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${pt[0]}&lon=${pt[1]}`);
    const r = await res.json();
    const a = r.address || {};
    const area = a.suburb || a.neighbourhood || a.village || a.town || a.city;
    if (area) return `My Location · ${area}`;
  } catch {}
  const near = nearestCities(pt, 1)[0];
  return near ? `My Location · near ${near.n.name}` : 'My Location';
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported in this browser.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve([p.coords.latitude, p.coords.longitude]),
      err => reject(new Error(err.code === 1 ? 'Location permission was denied.' : 'Could not get your current location.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function pickCity(id) {
  // Map marker click: fill origin first, then destination
  const from = $('evFrom').value;
  if (!from) setCity('evFrom', id);
  else if (from !== id) setCity('evTo', id);
  else return toast('That city is already your origin — pick a different destination.');
  plan(true);
}

function routeFieldAdapter(field) {
  const hidden = $(field);
  return {
    current: () => NODE[hidden.value] || null,
    pickCity: c => { setCity(field, c.id); plan(true); },
    pickPlace: p => { if (setPlace(field, p.pt, p.name)) plan(true); },
    pickGps: (pt, label) => {
      if (!setPlace(field, pt, label, true)) return;
      setHere(pt, label, 'route');
      plan(true);
    },
    clear: () => { clearCustom(field); hidden.value = ''; plan(false); }
  };
}

function sosAdapter() {
  const inTN = pt => {
    const near = nearestCities(pt, 1)[0];
    if (near && near.d <= 80) return true;
    toast('📍 That place is outside Tamil Nadu. Please choose a location inside Tamil Nadu.');
    return false;
  };
  const show = () => { findNearby(true); };
  return {
    current: () => herePos ? { name: hereLabel } : null,
    pickCity: c => { setHere(c.pt, c.name, 'sos'); show(); },
    pickPlace: p => { if (inTN(p.pt)) { setHere(p.pt, p.name, 'sos'); show(); } },
    pickGps: (pt, label) => { if (inTN(pt)) { setHere(pt, label, 'sos'); show(); } },
    clear: () => clearHere()
  };
}

function setupCitySearch(field, adapter = routeFieldAdapter(field)) {
  const input = $(field + 'Search'), list = $(field + 'List');
  if (!input || !list) return;
  const cities = baseCities().sort((a, b) => a.name.localeCompare(b.name));
  let items = [], active = -1, places = [], placesFor = '', placesState = 'idle', timer = null, ctrl = null, busy = false;
  const cache = new Map();

  const norm = v => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const highlight = (name, q) => {
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (!q || i < 0) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
  };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const paintActive = () => {
    list.querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('active', +li.dataset.i === active));
    const el = list.querySelector(`li[data-i="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  };
  const revert = () => { const cur = adapter.current(); input.value = cur ? cur.name : ''; };

  const render = (keepActive = false) => {
    const q = input.value.trim(), nq = norm(q);
    const cityHits = !nq ? cities : cities
      .filter(c => norm(c.name).includes(nq) || norm(c.id).includes(nq))
      .sort((a, b) => (norm(b.name).startsWith(nq) - norm(a.name).startsWith(nq)) || a.name.localeCompare(b.name));
    const placeHits = placesFor === q ? places.filter(p => !cityHits.some(c => norm(c.name) === norm(p.name))) : [];

    items = [{ type: 'gps' }, ...cityHits.map(c => ({ type: 'city', c })), ...placeHits];
    let html = '', idx = 0;
    const row = (inner, sub) => `<li role="option" data-i="${idx++}">${inner}${sub ? `<small>${sub}</small>` : ''}</li>`;
    html += row('<span>📍 <b>Use my current location</b></span>', 'GPS');
    if (cityHits.length) html += `<li class="group">Cities</li>` + cityHits.map(c => row(`<span>${highlight(c.name, q)}</span>`, `${c.elev} m`)).join('');
    if (nq.length >= 3) {
      html += `<li class="group">Local areas</li>`;
      if (placeHits.length) html += placeHits.map(p => row(`<span>📌 ${highlight(p.name, q)}</span>`, esc(p.sub))).join('');
      else if (placesState === 'loading' || placesFor !== q) html += '<li class="empty">Searching local areas…</li>';
      else if (placesState === 'error') html += '<li class="empty">Local area search is unavailable (offline?). Cities still work.</li>';
      else html += '<li class="empty">No local area matches “' + esc(q) + '”</li>';
    } else if (nq && !cityHits.length) {
      html += '<li class="empty">Type 3+ letters to search local areas</li>';
    }
    list.innerHTML = html;
    if (!keepActive) active = nq && items.length > 1 ? 1 : -1;
    paintActive();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const queuePlaces = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (norm(q).length < 3) { places = []; placesFor = ''; return; }
    if (cache.has(q)) { places = cache.get(q); placesFor = q; placesState = 'done'; return; }
    placesState = 'loading';
    timer = setTimeout(async () => {   // debounce: respect Nominatim's 1 req/s policy
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      try {
        const res = await searchLocalAreas(q, ctrl.signal);
        cache.set(q, res);
        places = res; placesState = 'done';
      } catch (err) {
        if (err.name === 'AbortError') return;
        places = []; placesState = 'error';
      }
      placesFor = q;
      if (input.value.trim() === q && document.activeElement === input) render(true);
    }, 500);
  };

  const choose = async item => {
    if (!item) return;
    close();
    input.blur();
    if (item.type === 'city') adapter.pickCity(item.c);
    else if (item.type === 'place') adapter.pickPlace(item);
    else if (item.type === 'gps') {
      busy = true;
      input.value = '📍 Locating you…';
      try {
        const pt = await getCurrentPosition();
        const label = await reverseLabel(pt);
        adapter.pickGps(pt, label);
        toast('📍 Using your current location: ' + label.replace('My Location · ', ''));
      } catch (err) {
        toast('⚠️ ' + err.message);
      }
      busy = false;
    }
    revert();
  };

  input.addEventListener('focus', () => { input.select(); render(); });
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    if (!input.value.trim() && adapter.current()) adapter.clear();
    queuePlaces();
    render();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) render();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      paintActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active] || items[1]);
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });
  // mousedown fires before blur, so the click registers
  list.addEventListener('mousedown', e => {
    e.preventDefault();
    const li = e.target.closest('li[data-i]');
    if (li) choose(items[+li.dataset.i]);
  });
  input.addEventListener('blur', () => {
    if (busy) return;
    close();
    const typed = norm(input.value.trim());
    const cur = adapter.current();
    if (!typed) { if (cur) adapter.clear(); return; }
    if (cur && norm(cur.name) === typed) { input.value = cur.name; return; }
    const exact = cities.find(c => norm(c.name) === typed || c.id === typed);
    if (exact) { adapter.pickCity(exact); revert(); }
    else if (cur) revert(); // back to the last valid pick
    else input.classList.add('invalid');
  });
}

function populateVehicles() {
  const sel = $('evCar');
  if (!sel) return;
  sel.innerHTML = Object.entries(EV.VEHICLES).map(([k, v]) => `<option value="${k}">${v.name} (${v.cap} kWh)</option>`).join('');
}

function setupUIEvents() {
  // Tabs Switcher
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = $('pane-' + tab.dataset.tab);
      if (pane) pane.classList.add('active');
      invalidateMapSize();
      if (tab.dataset.tab === 'low') {
        findNearby(false);
        findBatteryBanks();
      }
    };
  });

  // Sliders with value badges
  const linkSlider = (sliderId, valId, suffix = '%') => {
    const s = $(sliderId), v = $(valId);
    if (!s || !v) return;
    s.oninput = () => {
      v.textContent = s.value + suffix;
      if (sliderId === 'lowSoc') {
        findNearby(false);
        findBatteryBanks();
      }
    };
  };
  linkSlider('evSoc', 'evSocV');
  linkSlider('evReserve', 'evReserveV');
  linkSlider('evTarget', 'evTargetV');
  linkSlider('lowSoc', 'lowSocV');

  // Compute Route Button & Dynamic Inputs
  if ($('evGo')) $('evGo').onclick = () => plan(true);
  if ($('evSwap')) {
    $('evSwap').onclick = () => {
      swapPlaces();
      plan(true);
    };
  }
  setupCitySearch('evFrom');
  setupCitySearch('evTo');
  setupCitySearch('sosLoc', sosAdapter());
  if ($('evCar')) $('evCar').onchange = () => plan(true);
  if ($('evMode')) $('evMode').onchange = () => plan(true);
  if ($('evDepart')) $('evDepart').onchange = () => plan(false);

  // Live Location & GPS
  if ($('gpsHere')) $('gpsHere').onclick = () => getUserLocation(false);
  if ($('btnHeaderGps')) $('btnHeaderGps').onclick = () => getUserLocation(true);

  if ($('pickHere')) {
    $('pickHere').onclick = () => {
      picking = true;
      $('map').classList.add('picking');
      toast('🗺️ Click anywhere on the Tamil Nadu map to set your location.');
    };
  }

  map.on('click', e => {
    if (!picking) return;
    picking = false;
    $('map').classList.remove('picking');
    setHere([e.latlng.lat, e.latlng.lng], 'Custom Map Location');
    toast('📍 Position updated from map click!');
  });

  // Battery SOS Buttons
  if ($('findNear')) $('findNear').onclick = () => { findNearby(true); findBatteryBanks(); };
  if ($('bankFind')) $('bankFind').onclick = () => findBatteryBanks();
  if ($('bankRadius')) $('bankRadius').onchange = () => findBatteryBanks();
  if ($('bankRefresh')) {
    $('bankRefresh').onclick = () => {
      toast('Refreshing battery banks…');
      findBatteryBanks();
      toast('Battery banks refreshed!');
    };
  }

  // Presets Carousel
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.from) setCity('evFrom', btn.dataset.from);
      if (btn.dataset.to) setCity('evTo', btn.dataset.to);
      if (btn.dataset.car && $('evCar')) $('evCar').value = btn.dataset.car;
      plan(true);
      toast(`Loaded preset: ${NODE[btn.dataset.from].name} ➔ ${NODE[btn.dataset.to].name}`);
    };
  });

  // Modals
  if ($('btnFleetModal')) $('btnFleetModal').onclick = () => { $('modalFleet').hidden = false; };

  // Tab 3 Map Controls & Layer Toggles
  if ($('showBorder')) {
    $('showBorder').onchange = e => {
      if (e.target.checked) map.addLayer(boundaryLayer); else map.removeLayer(boundaryLayer);
    };
  }
  if ($('showPorts')) {
    $('showPorts').onchange = e => {
      if (e.target.checked) map.addLayer(portLayer); else map.removeLayer(portLayer);
      const b = $('btnTogglePorts');
      if (b) b.classList.toggle('active', e.target.checked);
    };
  }
  if ($('showGraph')) {
    $('showGraph').onchange = e => {
      if (e.target.checked) map.addLayer(highwayLayer); else map.removeLayer(highwayLayer);
      const b = $('btnToggleHighways');
      if (b) b.classList.toggle('active', e.target.checked);
    };
  }
  if ($('fitTN')) {
    $('fitTN').onclick = () => {
      if (boundaryLayer && boundaryLayer.getLayers().length > 0) {
        map.fitBounds(boundaryLayer.getBounds(), { padding: [25, 25] });
      } else {
        map.setView([11.1271, 78.6569], 7);
      }
    };
  }
  document.querySelectorAll('#satBtns .btn-pill').forEach(btn => {
    btn.onclick = () => setMapStyle(btn.dataset.mapStyle);
  });

  // Tab 3 Charging Ports Directory Search & Filter
  function renderPortDirectory(filterText = '', minKw = 0) {
    const listEl = $('portList');
    const countEl = $('portCount');
    const srcEl = $('portSrc');
    if (!listEl) return;

    const query = (filterText || '').trim().toLowerCase();
    const filtered = chargers.filter(c => {
      const name = (c[2] || '').toLowerCase();
      const op = (c[5] || '').toLowerCase();
      const kw = c[3] || 30;
      if (minKw > 0 && kw < minKw) return false;
      if (!query) return true;
      return name.includes(query) || op.includes(query);
    });

    if (countEl) countEl.textContent = `Showing ${filtered.length} of ${chargers.length} charging locations across Tamil Nadu`;
    if (srcEl) srcEl.textContent = `${chargers.length} public EV fast charging points indexed`;

    listEl.innerHTML = filtered.slice(0, 50).map(c => `
      <li style="padding:10px 12px;margin-bottom:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div>
          <b style="color:#06b6d4;font-size:0.85rem;display:block">⚡ ${esc(c[2])}</b>
          <small style="color:var(--text-muted);font-size:0.75rem">${esc(c[5] || 'EV Network')} · <b style="color:var(--lime)">${c[3] || 30} kW DC</b> · ${c[4] || 2} ports</small>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-pill-sm" style="font-size:0.74rem" onclick="map.setView([${c[0]}, ${c[1]}], 14)">🔍 Zoom</button>
          <button class="btn-pill-sm primary" style="font-size:0.74rem" onclick="routeToPoint([${c[0]}, ${c[1]}], '${esc(c[2])}', 'charger')">⚡ Route</button>
        </div>
      </li>
    `).join('');
  }
  window.renderPortDirectory = renderPortDirectory;

  if ($('portSearch')) $('portSearch').oninput = e => renderPortDirectory(e.target.value);
  if ($('filterAllPorts')) $('filterAllPorts').onclick = () => renderPortDirectory($('portSearch')?.value || '', 0);
  if ($('filterFastOnly')) $('filterFastOnly').onclick = () => renderPortDirectory($('portSearch')?.value || '', 30);
  if ($('filterUltraFast')) $('filterUltraFast').onclick = () => renderPortDirectory($('portSearch')?.value || '', 60);
  if ($('nearMe')) $('nearMe').onclick = () => getUserLocation(true);
  if ($('refreshPorts')) {
    $('refreshPorts').onclick = () => {
      renderPortDirectory();
      toast('↻ EV Charging directory refreshed!');
    };
  }
  renderPortDirectory();

  // Digital Live Clock
  setInterval(() => {
    const clk = $('clock');
    if (clk) clk.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST';
  }, 1000);
}

/* =====================================================================
   Bootstrap Initialization (Rock-Solid & Instant)
   ===================================================================== */
(function initVoltPath() {
  populateVehicles();
  setupUIEvents();

  // No default corridor: the user searches and picks origin & destination
  setCity('evFrom', '');
  setCity('evTo', '');

  // Draw layers immediately
  drawBoundary();
  drawGraph();
  drawChargers();
  drawBatteryBanks();
  drawStations();

  // Hide loading spinner with smooth fadeout immediately
  const loading = $('loading');
  if (loading) {
    loading.classList.add('done');
    loading.style.display = 'none';
  }

  // Restore or initialize user live location
  clearHere();

  // Empty route prompt until the user picks both cities, then show all of Tamil Nadu
  plan(true);
  if (boundaryLayer.getLayers().length) map.fitBounds(boundaryLayer.getBounds(), { padding: [25, 25] });
  setTimeout(() => { const f = $('evFromSearch'); if (f) f.focus({ preventScroll: true }); }, 300);

  // Invalidate map size after DOM settles
  setTimeout(invalidateMapSize, 200);
  setTimeout(invalidateMapSize, 600);
})();

})();
