'use strict';

const NODES = [
  "Faisal_Mosque","Blue_Area","Zero_Point",
  "Srinagar_Hwy","Centaurus","Faizabad","PIMS_Hosp"
];

let state = null;
let simRunning = true;
let emergActive = false;
let accActive = false;
let ws = null;

// ── WebSocket ──────────────────────────────────────────────
function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    setConn('connected', 'Live');
  };

  ws.onmessage = (e) => {
    state = JSON.parse(e.data);
    renderAll();
  };

  ws.onclose = () => {
    setConn('error', 'Disconnected');
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {
    setConn('error', 'Error');
  };
}

function setConn(cls, label) {
  document.getElementById('connDot').className = 'conn-dot ' + cls;
  document.getElementById('connLabel').textContent = label;
}

// ── API helpers ────────────────────────────────────────────
async function api(path, method = 'POST') {
  const r = await fetch(path, { method });
  return r.json();
}

// ── Controls ───────────────────────────────────────────────
document.getElementById('btnPlayPause').addEventListener('click', async () => {
  simRunning = !simRunning;
  await api(simRunning ? '/api/simulation/start' : '/api/simulation/stop');
  document.getElementById('iconPause').style.display = simRunning ? '' : 'none';
  document.getElementById('iconPlay').style.display = simRunning ? 'none' : '';
  document.getElementById('playLabel').textContent = simRunning ? 'Pause' : 'Resume';
});

document.getElementById('btnEmerg').addEventListener('click', async () => {
  emergActive = !emergActive;
  const btn = document.getElementById('btnEmerg');
  if (emergActive) {
    await api('/api/emergency/trigger');
    btn.classList.add('active-state');
    document.getElementById('emergLabel').textContent = 'Clear Emergency';
  } else {
    await api('/api/emergency/clear');
    btn.classList.remove('active-state');
    document.getElementById('emergLabel').textContent = 'Trigger Emergency';
  }
});

document.getElementById('btnAccident').addEventListener('click', async () => {
  accActive = !accActive;
  const btn = document.getElementById('btnAccident');
  if (accActive) {
    await api('/api/accident/trigger');
    btn.classList.add('active-state');
    document.getElementById('accLabel').textContent = 'Clear Accident';
  } else {
    await api('/api/accident/clear');
    btn.classList.remove('active-state');
    document.getElementById('accLabel').textContent = 'Simulate Accident';
  }
});

// ── Navigation ─────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById('view-' + view).classList.add('active');
    if (state) renderAll();
  });
});

// ── Render: all views ──────────────────────────────────────
function renderAll() {
  if (!state) return;
  renderDashboard();
  renderSignals();
}

// ── Dashboard ──────────────────────────────────────────────
function renderDashboard() {
  const { step, nodes, stats, accidents, emergency_route, suggested_route } = state;

  document.getElementById('stepNum').textContent = String(step).padStart(3, '0');
  document.getElementById('mAvg').textContent = stats.avg_density + '%';
  document.getElementById('mCong').textContent = stats.congestion_count;
  document.getElementById('mGreen').textContent = stats.green_count;
  document.getElementById('mAcc').textContent = stats.accident_count;

  // Node table
  const tbody = document.getElementById('nodeTable');
  tbody.innerHTML = '';
  nodes.forEach(n => {
    const tr = document.createElement('tr');
    if (n.in_emergency_route) tr.className = 'row-emergency';
    else if (n.has_accident) tr.className = 'row-accident';

    const dc = densityColor(n.density);
    const predCls = n.prediction === 'RISING' ? 'rising' : n.prediction === 'IMPROVING' ? 'improving' : 'stable';
    const predLabel = n.prediction === 'RISING' ? '↑ rising' : n.prediction === 'IMPROVING' ? '↓ improving' : '— stable';
    const sigCls = n.signal === 'GREEN' ? 'green' : 'red';
    const gt = n.green_time === 99 ? '∞' : n.green_time + 's';

    let action = 'Normal cycle';
    let actionCls = '';
    if (n.in_emergency_route) { action = '!! EMERGENCY PRIORITY !!'; actionCls = 'emerg'; }
    else if (n.density > 80) { action = 'Extending green'; actionCls = 'extend'; }
    else if (n.density < 20) { action = 'Reducing green'; }

    tr.innerHTML = `
      <td><span class="node-name">${n.name.replace(/_/g,' ')}</span></td>
      <td><span class="sig-pill ${sigCls}"><span class="sig-dot"></span>${n.signal}</span></td>
      <td style="color:var(--text-secondary);">${gt}</td>
      <td>
        <div class="density-wrap">
          <div class="bar-track"><div class="bar-fill" style="width:${n.density}%;background:${dc};"></div></div>
          <span class="bar-num">${n.density}%</span>
        </div>
      </td>
      <td><span class="pred-tag ${predCls}">${predLabel}</span></td>
      <td><span class="action-text ${actionCls}">${action}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Alerts
  const alertsList = document.getElementById('alertsList');
  alertsList.innerHTML = '';

  if (accidents.length > 0) {
    accidents.forEach(([a, b]) => {
      alertsList.innerHTML += `
        <div class="alert-item accident">
          <span class="alert-icon">⚠️</span>
          <span>Accident blockage: <strong>${a.replace(/_/g,' ')}</strong> → <strong>${b.replace(/_/g,' ')}</strong>. AI rerouting active.</span>
        </div>`;
    });
  }

  if (stats.congestion_count > 0) {
    const cz = nodes.filter(n => n.density > 75).map(n => n.name.replace(/_/g,' ')).join(', ');
    alertsList.innerHTML += `
      <div class="alert-item congestion">
        <span class="alert-icon">🔴</span>
        <span>Congestion detected: <strong>${cz}</strong></span>
      </div>`;
  }

  if (accidents.length === 0 && stats.congestion_count === 0) {
    alertsList.innerHTML = `
      <div class="alert-item clear">
        <span class="alert-icon">✓</span>
        <span>All clear — no congestion or accidents detected.</span>
      </div>`;
  }

  // Suggested route
  const rp = document.getElementById('routeDisplay');
  rp.innerHTML = '';
  suggested_route.path.forEach((node, i) => {
    const s = document.createElement('span');
    s.className = 'r-node';
    s.textContent = node.replace(/_/g,' ');
    rp.appendChild(s);
    if (i < suggested_route.path.length - 1) {
      const a = document.createElement('span');
      a.className = 'r-arrow';
      a.textContent = '→';
      rp.appendChild(a);
    }
  });
  document.getElementById('routeCost').textContent = suggested_route.cost + ' units';

  // Emergency route
  const erSec = document.getElementById('emergRouteSection');
  const erEl = document.getElementById('emergRouteDisplay');
  if (emergency_route && emergency_route.length > 0) {
    erSec.style.display = 'block';
    erEl.innerHTML = '';
    emergency_route.forEach((node, i) => {
      const s = document.createElement('span');
      s.className = 'r-node emerg';
      s.textContent = node.replace(/_/g,' ');
      erEl.appendChild(s);
      if (i < emergency_route.length - 1) {
        const a = document.createElement('span');
        a.className = 'r-arrow';
        a.textContent = '→';
        erEl.appendChild(a);
      }
    });
  } else {
    erSec.style.display = 'none';
  }
}

// ── Signal Cards ───────────────────────────────────────────
function renderSignals() {
  if (!state) return;
  const grid = document.getElementById('signalsGrid');
  grid.innerHTML = '';
  state.nodes.forEach(n => {
    const isEmerg = n.in_emergency_route;
    const sigClass = isEmerg ? 'amber' : n.signal.toLowerCase();
    const cardClass = isEmerg ? 'emergency' : n.signal.toLowerCase();
    const div = document.createElement('div');
    div.className = `signal-card ${cardClass}`;
    div.innerHTML = `
      <div class="sc-name">${n.name.replace(/_/g,' ')}</div>
      <div class="sc-light ${sigClass}"></div>
      <div class="sc-stats">
        <div class="sc-stat"><span class="sc-stat-label">Status</span><span class="sc-stat-val">${isEmerg ? 'EMERGENCY' : n.signal}</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Green time</span><span class="sc-stat-val">${n.green_time === 99 ? '∞' : n.green_time + 's'}</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Density</span><span class="sc-stat-val">${n.density}%</span></div>
        <div class="sc-stat"><span class="sc-stat-label">Trend</span><span class="sc-stat-val">${n.prediction}</span></div>
      </div>
    `;
    grid.appendChild(div);
  });
}

// ── Route Planner ──────────────────────────────────────────
function populateNodeSelects() {
  ['routeFrom','routeTo'].forEach((id, i) => {
    const sel = document.getElementById(id);
    NODES.forEach((n, j) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n.replace(/_/g,' ');
      if ((i === 0 && j === 5) || (i === 1 && j === 0)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

document.getElementById('btnCalcRoute').addEventListener('click', async () => {
  const start = document.getElementById('routeFrom').value;
  const end = document.getElementById('routeTo').value;
  if (start === end) return;

  const data = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end })
  }).then(r => r.json());

  const res = document.getElementById('routeResult');
  res.style.display = 'block';

  const pathHtml = data.path.map((n, i) =>
    `<span class="r-node">${n.replace(/_/g,' ')}</span>${i < data.path.length-1 ? '<span class="r-arrow">→</span>' : ''}`
  ).join('');

  res.innerHTML = `
    <div class="result-path">${pathHtml}</div>
    <div class="result-cost">Estimated congestion weight: <span>${data.cost} units</span></div>
  `;
});

// ── Utility ────────────────────────────────────────────────
function densityColor(d) {
  if (d > 75) return '#ef4444';
  if (d > 45) return '#f59e0b';
  return '#22c55e';
}

// ── Init ───────────────────────────────────────────────────
populateNodeSelects();
connectWS();
