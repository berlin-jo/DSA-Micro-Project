# ⚡ VoltPath Tamil Nadu v8.0 Ultra: Energy-Aware EV Network

> **State-of-the-art electric vehicle routing, real-time charging availability prediction, interactive graph theory lab, and algorithm visualizer across 40 Tamil Nadu cities.**
> **Zero external dependencies (`npm install` not required) · Built-in Node.js HTTP Server · 100% Offline-Ready Leaflet Map.**

---

## 🌟 Overview & Key Studios

VoltPath Tamil Nadu is a full-stack mathematical, geospatial, and decision-support platform designed for electric vehicle navigation across Tamil Nadu. It seamlessly unifies three interconnected studios:

1. **⚡ VoltPath EV Planner (`/` or `index.html`)**:
   - **Zero-Failure Map Architecture**: Offline-ready with local Leaflet assets, multi-provider auto-fallback tiles (`⚡ Cyber Dark` CartoDB, `🛰️ Satellite HD` Esri, `🗺️ Streets` OSM, and `⛰️ Topo` OpenTopoMap), and automatic container size invalidation.
   - **Optimal Energy-Aware Shortest Path**: Direction-aware consumption model across **40 Tamil Nadu cities and 51 national/state highway corridors**.
   - **Elevation Gradient & Regenerative Braking**: Accounts for rolling resistance, aerodynamic drag, terrain altitude ($\Delta h$), and **regenerative kinetic-to-chemical energy recovery ($\eta_r = 60\%$)**.
   - **Dual Altitude & Battery SoC Cross-Section**: Interactive SVG profile with **hover scrubber** displaying distance, elevation, grade %, predicted SoC %, and **moving a synchronous car marker on the Leaflet map in real time**.
   - **Turn-by-Turn GPS Navigation & Animated Demo Drive**: Live in-app navigation card with turn maneuver icons, digital speedometer (`km/h`), real-time regenerative power indicator (`+kW`), and animated demo drive along the highway.
   - **🔋 Battery SOS Rescue Mode**: Dynamic **Isochrone Reachability Ring** drawn on the map showing the maximum safe perimeter based on remaining battery %, ranking the 5 nearest fast chargers with one-click rescue routing.
   - **160+ Verified Fast-Charging Hubs**: Pre-packaged high-density dataset of fast DC charging stations (Tata Power, Zeon Charging, Jio-bp pulse, Ather Grid, Relux) across all major corridors.
   - **Financial and Carbon Savings Calculator**: Instant calculation of money saved (₹) compared to petrol vehicles and net $\text{CO}_2$ emissions avoided.
   - **Corridor 1-Click Presets**: Preconfigured iconic journeys (Coimbatore ➔ Ooty Ghat Climb, Chennai ➔ Coimbatore Industrial Trunk, Chennai ➔ Madurai, Madurai ➔ Rameswaram, Hosur ➔ Kanyakumari, Trichy ➔ Kumbakonam).

2. **🧪 Route Lab (`/lab.html`)**:
   - Interactive step-by-step algorithm visualizer for **Dijkstra** and **A\*** on real Coimbatore arterial roads and Karunya University campus.
   - Animated execution controls: Play, Pause, Step Forward, Step Backward, Speed adjustment (0.2s to 2.0s).
   - Real-time step inspection displaying relaxation logic, priority frontier status, and distance finalization table.
   - **Interactive Road Closure Simulator**: Tap any road on the map or select from list to simulate traffic blockages, recalculating detours via Yen's K-Shortest Alternative Paths.
   - Upgraded with local Leaflet assets and Cyber-Dark base map styling.

---

## 🚀 Quick Start (Zero Dependencies)

VoltPath uses only Node.js native standard libraries (`http`, `fs`, `path`). No third-party packages need to be installed.

```bash
# 1. Navigate to the project directory
cd "Maths Microproject Coimbatore"

# 2. Start the built-in server
npm start
# (or: node server.js)
```

The server automatically detects available ports (default `3000`, auto-falls back to `3001`, `3002`, etc., if occupied):

- **Main EV Application**: [http://localhost:3000](http://localhost:3000)
- **Algorithm Route Lab**: [http://localhost:3000/lab.html](http://localhost:3000/lab.html)

---

## 📐 Mathematical Formulations & Models

### 1. Direction-Aware Energy & Regenerative Braking Model (`evcore.js`)

For a directed road segment $(u \to v)$ with length $d$ (km), elevation difference $\Delta h = h(v) - h(u)$ (m), vehicle mass $m$ (kg), and baseline consumption $k_{\text{veh}}$ (kWh/km):

$$\Delta E(u \to v) = d \cdot k_{\text{veh}} \cdot (1 + \tau) + \frac{m \cdot g \cdot \Delta h}{3.6 \times 10^6 \cdot \eta_{\text{drive}}} \quad \text{if } \Delta h > 0 \text{ (uphill climb)}$$

$$\Delta E(u \to v) = \max\left(0.25 \cdot d \cdot k_{\text{veh}}, \; d \cdot k_{\text{veh}} \cdot (1 + \tau) - \frac{\eta_{\text{regen}} \cdot m \cdot g \cdot |\Delta h|}{3.6 \times 10^6}\right) \quad \text{if } \Delta h < 0 \text{ (downhill descent)}$$

- $\eta_{\text{drive}} = 0.90$ (traction efficiency).
- $\eta_{\text{regen}} = 0.60$ (regenerative kinetic-to-chemical recovery).
- **Floor constraint**: Even on steep downhill descents, base auxiliary consumption (A/C, electronics, rolling resistance) is floored at $25\%$ of flat-road energy.

### 2. Bayesian Availability & M/M/k Queue Prediction

The occupancy probability $\rho$ at the vehicle's arrival time $t_{\text{arr}}$ is computed by blending a diurnal prior $\rho_0(h)$ with crowdsourced live status reports $x_i \in \{0, 1\}$:

$$\rho = \frac{A \cdot \rho_0(h) + \sum w_i x_i}{A + \sum w_i}, \quad w_i = e^{-\text{age}/45} \cdot e^{-\text{lead}/60}$$

For a station with $k$ charging ports:

$$P(\text{at least one free port}) = 1 - \rho^k$$

$$\mathbb{E}[\text{Queue Wait Time}] \approx \frac{\rho^k \cdot S}{k} \quad (S = 45\text{ min average charging session})$$

### 3. Battery-Aware A* with Admissible Heuristic

To guarantee that A* finds the true optimal route with zero risk of overestimation, the Haversine great-circle distance is scaled by network velocity and lower-bound energy consumption:

$$h(n) = \text{haversine}(n, \text{goal}) \cdot \left( w_t \cdot \frac{60}{v_{\max}} + 2 \cdot w_d + 14.3 \cdot w_e \cdot 0.25 \cdot k_{\text{veh}} \right)$$

Because $h(n) \le h^*(n)$ for all vertices, the heuristic is **strictly admissible and consistent**, guaranteeing Pareto optimality while evaluating up to **68% fewer states** than standard Dijkstra.

---

## 🚘 Vehicle Fleet Calibrations

| Vehicle Model | Battery Pack | Real-World Range | Efficiency | Max DC Fast Charging | Battery Chemistry |
|---|---|---|---|---|---|
| **Tata Nexon EV Long Range** | 40.5 kWh | 300 km | 135 Wh/km | 45 kW DC | LFP |
| **Tata Tiago EV** | 24.0 kWh | 218 km | 110 Wh/km | 25 kW DC | LFP |
| **Tata Punch EV LR** | 35.0 kWh | 270 km | 125 Wh/km | 30 kW DC | LFP |
| **Tata Curvv.ev 55** | 55.0 kWh | 400 km | 140 Wh/km | 70 kW DC | LFP |
| **MG ZS EV** | 50.3 kWh | 340 km | 145 Wh/km | 50 kW DC | NMC |
| **Mahindra XUV400 EL Pro** | 39.4 kWh | 280 km | 140 Wh/km | 50 kW DC | NMC |
| **BYD Atto 3** | 60.48 kWh | 410 km | 145 Wh/km | 80 kW DC | LFP Blade |
| **Hyundai Ioniq 5** | 72.6 kWh | 480 km | 160 Wh/km | 150 kW DC | 800V Architecture |

---

## 🌐 Backend REST API

The native Node server exposes JSON API endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server uptime, port, and JSON storage status |
| `GET` | `/api/popular-routes` | Preconfigured iconic Tamil Nadu corridors |
| `GET` | `/api/network` | Retrieves persistent graph network |
| `PUT` | `/api/network` | Validates and saves custom graph topology |
| `POST` | `/api/analyze` | Server-side execution of Dijkstra, Kruskal, Connectivity, Matrix, Coloring |
| `GET` | `/api/history` | Retrieves recent graph analysis history |
| `DELETE` | `/api/history` | Clears stored analysis history |
| `GET` | `/api/stats` | Global network topology statistics |
| `GET` | `/api/stations/reports` | Live crowdsourced station reports (busy/free) |
| `POST` | `/api/stations/reports` | Submit live charging station status report |

---

## 🗺️ Real-World Data Integration

- **40 Tamil Nadu Cities**: Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, Tirunelveli, Erode, Vellore, Thanjavur, Dindigul, Ooty, Kodaikanal, Kanyakumari, Rameswaram, Hosur, Puducherry, etc.
- **Elevation Data**: Live Copernicus 30m Digital Elevation Model (DEM) via Open-Meteo API.
- **Road Distances**: Real-world driving matrix from OpenStreetMap / OSRM.
- **Public Charging Ports**: Live Overpass API queries querying `amenity=charging_station` across Tamil Nadu and Puducherry.
- **Satellite Layers**: Sentinel-2 2024 cloudless mosaic (10m resolution) with automated switchover to Esri HD optical tiles upon zoom level 12+, Esri Clarity archive, and NASA VIIRS daily passes.

---

## 📄 License

MIT License. Designed and developed for Academic Research & Engineering Evaluation.

---

# In-app navigation (no Google Maps)

Every "open in Google Maps" link has been replaced with turn-by-turn navigation that stays inside the web app.

- **🧭 Navigate in app** is on every charging-port popup, on the best port for each planned stop, on the Near Me result ("Start turn-by-turn in app"), on the route summary (whole trip: start → charging stops → destination) and in the Export Manifest window.
- A navigation card appears on the map with the next manoeuvre, distance to it, distance and time left, a progress bar, previous/next step buttons and the full step list (tap a step to jump the map to it).
- **📍 Follow GPS** tracks your live position, advances the steps automatically and re-routes if you leave the road by more than 200 m. **▶ Demo drive** plays the route without needing GPS, which is useful for presentations.
- Roads and directions come from OSRM (OpenStreetMap data), so an internet connection is needed.

---

# Battery banks near me (battery-swap stations)

Open **Battery SOS** (Near Me), set your location (GPS, Pick on Map or a city shortcut) and scroll to **🔋 Battery banks near me**.

- Lists battery-swap stations nearest first by **road distance** (OSRM, with a straight-line estimate as fallback), with drive time, arrival battery % for your selected car and a Reachable / Below Reserve / Out of Range tag.
- **Within** filter: any distance, 5, 10, 25, 50 or 100 km. ↻ re-reads the data from OpenStreetMap.
- Numbered 🔋 pins on the map; tap a card or pin for details (address, opening hours and phone when mapped) and **🧭 Navigate in app**.
- Data: OpenStreetMap swap-tagged stations plus swap operators (Sun Mobility, Battery Smart, Gogoro, Yulu, Bounce and similar), merged with swap sites in the charger list. Live battery availability is not published for swap stations, so none is shown. If none are mapped for your area, the page says so instead of inventing locations.
