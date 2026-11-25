/* evcore.js — Energy-aware shortest path for Electric Vehicles
   1. Direction-aware energy model (rolling + traffic + elevation with regenerative braking)
   2. Charging availability prediction (time-of-day occupancy profile + live user reports, Bayesian blend)
   3. Battery-aware multi-objective Dijkstra (Pareto front over time, distance, energy, arrival charge)
   4. Battery-aware A* with an admissible haversine heuristic (single weighted objective)
   5. Fleet evaluation & cost/carbon emissions calculations
   Pure functions: runs in the browser (window.EV) and in Node (module.exports). */
(function (root) {
  'use strict';

  const G = 9.81, ETA_DRIVE = 0.9, ETA_REGEN = 0.6, CHARGE_EFF = 0.9, SESSION_MIN = 45, PRIOR_STRENGTH = 3;
  const KM_TO_MIN = 2, KWH_TO_MIN = 14.3; // 1 km ≈ 2 min at 30 km/h; 1 kWh ≈ 7 km ≈ 14.3 min (normalisation)

  const VEHICLES = {
    nexon:  { id: 'nexon',  brand: 'Tata',     name: 'Tata Nexon EV Long Range',  cap: 40.5, kwhPerKm: 0.135, mass: 1600, maxKw: 45, realRangeKm: 300, batteryType: 'LFP' },
    tiago:  { id: 'tiago',  brand: 'Tata',     name: 'Tata Tiago EV',             cap: 24.0, kwhPerKm: 0.110, mass: 1250, maxKw: 25, realRangeKm: 218, batteryType: 'LFP' },
    punch:  { id: 'punch',  brand: 'Tata',     name: 'Tata Punch EV LR',          cap: 35.0, kwhPerKm: 0.125, mass: 1340, maxKw: 30, realRangeKm: 270, batteryType: 'LFP' },
    curvv:  { id: 'curvv',  brand: 'Tata',     name: 'Tata Curvv.ev 55',          cap: 55.0, kwhPerKm: 0.140, mass: 1650, maxKw: 70, realRangeKm: 400, batteryType: 'LFP' },
    zs:     { id: 'zs',     brand: 'MG',       name: 'MG ZS EV Excite / Luxury',  cap: 50.3, kwhPerKm: 0.145, mass: 1620, maxKw: 50, realRangeKm: 340, batteryType: 'NMC' },
    xuv400: { id: 'xuv400', brand: 'Mahindra', name: 'Mahindra XUV400 EL Pro',    cap: 39.4, kwhPerKm: 0.140, mass: 1580, maxKw: 50, realRangeKm: 280, batteryType: 'NMC' },
    atto3:  { id: 'atto3',  brand: 'BYD',      name: 'BYD Atto 3 Extended',       cap: 60.48,kwhPerKm: 0.145, mass: 1750, maxKw: 80, realRangeKm: 410, batteryType: 'LFP Blade' },
    ioniq5: { id: 'ioniq5', brand: 'Hyundai',  name: 'Hyundai Ioniq 5 Ultra-Fast',cap: 72.6, kwhPerKm: 0.160, mass: 1995, maxKw: 150,realRangeKm: 480, batteryType: '800V Architecture' }
  };

  /* ---------- 1. Energy model ----------
     E(u→v) = d·k·(1 + τ)  +  m·g·Δh / (3.6·10⁶·η)        if Δh > 0  (climbing)
            = d·k·(1 + τ)  −  η_r·m·g·|Δh| / 3.6·10⁶       if Δh < 0  (regenerative braking)
     floored at 25 % of the flat-road energy (a vehicle always needs base propulsion). Units: kWh. */
  function edgeEnergy(lenKm, dh, veh, trafficFactor = 0) {
    const flat = lenKm * veh.kwhPerKm * (1 + trafficFactor);
    const pot = veh.mass * G * Math.abs(dh) / 3.6e6;
    const e = dh > 0 ? flat + pot / ETA_DRIVE : flat - ETA_REGEN * pot;
    return Math.max(0.25 * lenKm * veh.kwhPerKm, e);
  }

  function edgeRegenKwh(lenKm, dh, veh) {
    if (dh >= 0) return 0;
    const pot = veh.mass * G * Math.abs(dh) / 3.6e6;
    return ETA_REGEN * pot;
  }

  /* ---------- 2. Charging availability prediction ----------
     Prior occupancy ρ₀(h): typical double-peak day for city chargers, daytime peak for campus chargers.
     Live reports (busy = 1, free = 0) are blended in with weights that fade with report age and with how far
     ahead the arrival is:  ρ = (A·ρ₀ + Σ wᵢ·xᵢ) / (A + Σ wᵢ),  wᵢ = e^(−age/45) · e^(−lead/60).
     With k ports each busy with probability ρ:  P(free port) = 1 − ρᵏ,  expected wait ≈ ρᵏ · S / k. */
  const gauss = (h, mu, sd) => Math.exp(-((h - mu) ** 2) / (2 * sd * sd));

  function occupancyPrior(hour, kind) {
    let r;
    if (kind === 'campus') r = 0.12 + 0.6 * gauss(hour, 13, 3);
    else if (kind === 'highway') r = 0.15 + 0.35 * gauss(hour, 9, 2.5) + 0.45 * gauss(hour, 18, 2.5);
    else r = 0.18 + 0.42 * gauss(hour, 10, 1.6) + 0.55 * gauss(hour, 19, 2.0);
    if (kind === 'hub') r *= 1.15;
    return Math.min(0.95, Math.max(0.05, r));
  }

  function predictAvailability(st, arrive, reports = [], now = arrive) {
    const hour = arrive.getHours() + arrive.getMinutes() / 60;
    const prior = occupancyPrior(hour, st.kind);
    const lead = Math.max(0, (arrive - now) / 60000);
    let num = PRIOR_STRENGTH * prior, den = PRIOR_STRENGTH;
    reports.filter(r => r.station === st.id).forEach(r => {
      const age = Math.max(0, (now - new Date(r.at)) / 60000);
      if (age > 180) return;
      const w = Math.exp(-age / 45) * Math.exp(-lead / 60);
      num += w * (r.status === 'busy' ? 1 : 0);
      den += w;
    });
    const rho = Math.min(0.98, num / den);
    const ports = Math.max(1, st.ports || 1);
    const allBusy = Math.pow(rho, ports);
    return {
      prior,
      rho,
      pFree: Math.max(0.02, Math.min(0.99, 1 - allBusy)),
      wait: allBusy * SESSION_MIN / ports,
      reportsUsed: den - PRIOR_STRENGTH
    };
  }

  function chargeMinutes(fromSoc, toSoc, veh, stKw) {
    const kw = Math.min(stKw || 30, veh.maxKw || 30);
    return Math.max(0, (toSoc - fromSoc) * veh.cap / (kw * CHARGE_EFF) * 60);
  }

  /* ---------- graph helpers ----------
     graph = { nodes:[id], edges:[{id,a,b,len(km),time(min)}], elev:{id:m}, coords:{id:[lat,lng]}, stations:{id:{...}} }
     opts  = { veh, soc0, reserve, target, depart:Date, now:Date, reports:[], traffic:{edgeId:factor} } */
  const edgeA = e => e.a || e.u;
  const edgeB = e => e.b || e.v;
  const edgeTime = e => e.time || Math.round((e.len / (e.spd || 65)) * 60);

  function adjacency(graph) {
    const adj = new Map(graph.nodes.map(n => [n, []]));
    graph.edges.forEach(e => {
      const a = edgeA(e);
      const b = edgeB(e);
      if (adj.has(a)) adj.get(a).push({ to: b, e });
      if (adj.has(b)) adj.get(b).push({ to: a, e });
    });
    return adj;
  }

  const energyOf = (graph, e, from, opts) => {
    const a = edgeA(e);
    const b = edgeB(e);
    const to = from === a ? b : a;
    const dh = (graph.elev[to] || 0) - (graph.elev[from] || 0);
    const edgeId = e.id || `e_${a}_${b}`;
    return edgeEnergy(e.len, dh, opts.veh, (opts.traffic || {})[edgeId] || 0);
  };

  function chargeOption(graph, node, L, opts) {
    const st = graph.stations[node];
    if (!st || L.soc >= opts.target - 0.05 || L.stops.some(s => s.node === node)) return null;
    const arrive = new Date(opts.depart.getTime() + L.time * 60000);
    const pr = predictAvailability(st, arrive, opts.reports, opts.now || opts.depart);
    const cm = chargeMinutes(L.soc, opts.target, opts.veh, st.kw);
    return { pr, cm, kwh: (opts.target - L.soc) * opts.veh.cap, st };
  }

  /* ---------- 3. Battery-aware multi-objective Dijkstra (Pareto dominance) ---------- */
  const EPS = 1e-9;
  const dominates = (a, b) =>
    a.time <= b.time + EPS && a.dist <= b.dist + EPS && a.energy <= b.energy + EPS && a.soc >= b.soc - EPS &&
    (a.time < b.time - EPS || a.dist < b.dist - EPS || a.energy < b.energy - EPS || a.soc > b.soc + EPS);

  function paretoRoutes(graph, s, t, opts) {
    const adj = adjacency(graph), bag = new Map(graph.nodes.map(n => [n, []]));
    const start = { node: s, time: 0, dist: 0, energy: 0, soc: opts.soc0, path: [s], edges: [], stops: [], socTrace: [[0, opts.soc0]] };
    const queue = [start];
    bag.get(s).push(start);
    let expansions = 0, generated = 1;

    const tryAdd = L => {
      const b = bag.get(L.node);
      if (b.some(M => dominates(M, L) || (Math.abs(M.time - L.time) < EPS && Math.abs(M.dist - L.dist) < EPS && Math.abs(M.energy - L.energy) < EPS && Math.abs(M.soc - L.soc) < EPS))) return;
      for (let i = b.length - 1; i >= 0; i--) {
        if (dominates(L, b[i])) { b[i].dead = true; b.splice(i, 1); }
      }
      b.push(L);
      queue.push(L);
      generated++;
    };

    while (queue.length) {
      let bi = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].time < queue[bi].time) bi = i;
      const L = queue.splice(bi, 1)[0];
      if (L.dead) continue;
      expansions++;
      if (L.node === t) continue;

      const ch = chargeOption(graph, L.node, L, opts);
      if (ch) {
        tryAdd({
          ...L,
          time: L.time + ch.pr.wait + ch.cm,
          soc: opts.target,
          stops: [...L.stops, { node: L.node, wait: ch.pr.wait, chargeMin: ch.cm, pFree: ch.pr.pFree, kwh: ch.kwh, at: L.time, socIn: L.soc }],
          socTrace: [...L.socTrace, [L.dist, opts.target]]
        });
      }

      for (const { to, e } of adj.get(L.node)) {
        if (L.path.includes(to)) continue;
        const kwh = energyOf(graph, e, L.node, opts), soc = L.soc - kwh / opts.veh.cap;
        if (soc < opts.reserve) continue;
        const tm = edgeTime(e);
        tryAdd({
          node: to,
          time: L.time + tm,
          dist: L.dist + e.len,
          energy: L.energy + kwh,
          soc,
          path: [...L.path, to],
          edges: [...L.edges, e],
          stops: L.stops,
          socTrace: [...L.socTrace, [L.dist + e.len, soc]]
        });
      }
    }
    const front = bag.get(t).filter(L => !L.dead).sort((a, b) => a.time - b.time);
    return { front, expansions, generated };
  }

  function rankFront(front, w) {
    if (!front.length) return [];
    const minT = Math.min(...front.map(r => r.time)), minD = Math.min(...front.map(r => r.dist)), minE = Math.min(...front.map(r => r.energy));
    const sum = (w.time || 0) + (w.dist || 0) + (w.energy || 0) || 1;
    return front.map(r => ({
      ...r,
      score: ((w.time * r.time / Math.max(minT, 1e-6)) + (w.dist * r.dist / Math.max(minD, 1e-6)) + (w.energy * r.energy / Math.max(minE, 1e-6))) / sum
    })).sort((a, b) => a.score - b.score);
  }

  /* ---------- 4. Battery-aware A* (state = junction + battery level in 2% steps) ----------
     cost  c = w_t·time + w_d·2·dist + w_e·14.3·energy      (minute-equivalents)
     h(n)  = D(n,goal) · ( w_t·60/v_max + w_d·2 + w_e·14.3·0.25·k )   D = haversine distance — never over-estimates. */
  function haversineKm(p, q) {
    const r = x => x * Math.PI / 180, dLat = r(q[0] - p[0]), dLng = r(q[1] - p[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(p[0])) * Math.cos(r(q[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function astar(graph, s, t, opts, w, useHeuristic = true) {
    const adj = adjacency(graph), sum = (w.time || 0) + (w.dist || 0) + (w.energy || 0) || 1;
    const wt = (w.time || 0) / sum, wd = (w.dist || 0) / sum, we = (w.energy || 0) / sum;
    const vmax = Math.max(...graph.edges.map(e => {
      const tm = edgeTime(e);
      return tm > 0 ? e.len / (tm / 60) : 60;
    }));
    const perKm = wt * 60 / vmax + wd * KM_TO_MIN + we * KWH_TO_MIN * 0.25 * opts.veh.kwhPerKm;
    const h = n => useHeuristic ? haversineKm(graph.coords[n], graph.coords[t]) * perKm : 0;
    const cost = (dt, dd, de) => wt * dt + wd * KM_TO_MIN * dd + we * KWH_TO_MIN * de;
    const key = L => L.node + '|' + Math.round(L.soc * 50);
    const open = [{ node: s, g: 0, f: h(s), time: 0, dist: 0, energy: 0, soc: opts.soc0, path: [s], edges: [], stops: [], socTrace: [[0, opts.soc0]] }];
    const best = new Map([[key(open[0]), 0]]), closed = new Set();
    let expansions = 0;

    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const L = open.splice(bi, 1)[0], k = key(L);
      if (closed.has(k)) continue;
      closed.add(k);
      expansions++;
      if (L.node === t) return { route: L, expansions, cost: L.g };

      const push = N => {
        const nk = key(N);
        if (closed.has(nk) || (best.has(nk) && best.get(nk) <= N.g)) return;
        best.set(nk, N.g);
        N.f = N.g + h(N.node);
        open.push(N);
      };

      const ch = chargeOption(graph, L.node, L, opts);
      if (ch) {
        push({
          ...L,
          g: L.g + cost(ch.pr.wait + ch.cm, 0, 0),
          time: L.time + ch.pr.wait + ch.cm,
          soc: opts.target,
          stops: [...L.stops, { node: L.node, wait: ch.pr.wait, chargeMin: ch.cm, pFree: ch.pr.pFree, kwh: ch.kwh, at: L.time, socIn: L.soc }],
          socTrace: [...L.socTrace, [L.dist, opts.target]]
        });
      }

      for (const { to, e } of adj.get(L.node)) {
        if (L.path.includes(to)) continue;
        const kwh = energyOf(graph, e, L.node, opts), soc = L.soc - kwh / opts.veh.cap;
        if (soc < opts.reserve) continue;
        const tm = edgeTime(e);
        push({
          node: to,
          g: L.g + cost(tm, e.len, kwh),
          time: L.time + tm,
          dist: L.dist + e.len,
          energy: L.energy + kwh,
          soc,
          path: [...L.path, to],
          edges: [...L.edges, e],
          stops: L.stops,
          socTrace: [...L.socTrace, [L.dist + e.len, soc]]
        });
      }
    }
    return { route: null, expansions, cost: Infinity };
  }

  /* ---------- 5. Financial & Carbon Savings Metrics ---------- */
  function computeTripMetrics(route, veh, electricityTariff = 18, petrolRate = 102, petrolMileage = 15) {
    if (!route) return null;
    const dist = route.dist;
    const energy = route.energy;
    const petrolCost = (dist / petrolMileage) * petrolRate;
    const evCost = energy * electricityTariff;
    const moneySaved = Math.max(0, petrolCost - evCost);
    const co2AvoidedKg = dist * 0.12; // ~120g net CO2 saved per km
    const chargingStops = route.stops ? route.stops.length : 0;
    const chargeTimeMin = route.stops ? route.stops.reduce((s, x) => s + (x.chargeMin || 0) + (x.wait || 0), 0) : 0;
    const driveTimeMin = Math.max(0, route.time - chargeTimeMin);

    return {
      distKm: dist,
      energyKwh: energy,
      efficiencyWhKm: dist > 0 ? (energy * 1000 / dist) : 0,
      petrolCostInr: Math.round(petrolCost),
      evCostInr: Math.round(evCost),
      moneySavedInr: Math.round(moneySaved),
      co2AvoidedKg: Number(co2AvoidedKg.toFixed(1)),
      chargingStops,
      chargeTimeMin: Math.round(chargeTimeMin),
      driveTimeMin: Math.round(driveTimeMin),
      totalTimeMin: Math.round(route.time)
    };
  }

  const EV = {
    VEHICLES,
    edgeEnergy,
    edgeRegenKwh,
    occupancyPrior,
    predictAvailability,
    chargeMinutes,
    paretoRoutes,
    rankFront,
    astar,
    haversineKm,
    dominates,
    computeTripMetrics,
    KM_TO_MIN,
    KWH_TO_MIN
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = EV;
  if (typeof window !== 'undefined') root.EV = EV;
})(typeof window !== 'undefined' ? window : globalThis);
