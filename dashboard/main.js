/**
 * main.js — PALL-FIN Dashboard Logic
 *
 * Fetches results.json and scaling_results.json from the same directory,
 * then populates all DOM elements and renders three Chart.js charts:
 *   1. Speedup curve (measured + Amdahl's theoretical)
 *   2. Market distribution donut
 *   3. Buy vs Sell grouped bar chart per ticker
 *
 * No build step. No npm. Runs via:
 *   python3 -m http.server 8080 --directory dashboard
 */

"use strict";

/* ── Chart.js global defaults ───────────────────────────────── */
Chart.defaults.color = "#8b9ab5";
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 11;

/* ── Colour palette (matches CSS vars) ─────────────────────── */
const ACCENT   = "#6382ff";
const ACCENT2  = "#a78bfa";
const GREEN    = "#34d399";
const RED      = "#f87171";
const YELLOW   = "#fbbf24";
const MUTED    = "#4a5568";

const TICKER_PALETTE = [
  "#6382ff", "#a78bfa", "#34d399", "#f87171",
  "#fbbf24", "#38bdf8", "#fb923c", "#e879f9",
  "#4ade80", "#60a5fa",
];

/* ── Utilities ──────────────────────────────────────────────── */
const fmt = {
  sec:  v => `${v.toFixed(4)} s`,
  x:    v => `${v.toFixed(2)}×`,
  B:    v => `$${(v / 1e9).toFixed(3)}B`,
  pct:  v => `${(v * 100).toFixed(1)}%`,
};

function el(id) { return document.getElementById(id); }

/* ── Load JSON files ────────────────────────────────────────── */
async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

/* ── Populate metrics section ───────────────────────────────── */
function populateMetrics(res) {
  const m = res.metrics;
  const s = res.summary;

  el("m-seq").textContent     = fmt.sec(m.sequential_time);
  el("m-par").textContent     = fmt.sec(m.parallel_time);
  el("m-speedup").textContent = fmt.x(m.speedup);
  el("m-accuracy").textContent = m.accuracy_check ? "PASS ✓" : "FAIL ✗";
  el("m-accuracy").style.color = m.accuracy_check ? GREEN : RED;
  el("m-workers-sub").textContent = `${m.num_workers} workers · tree-reduce`;

  el("s-buy").textContent  = fmt.B(s.total_buy);
  el("s-sell").textContent = fmt.B(s.total_sell);
  el("s-net").textContent  = fmt.B(s.net_flow);

  el("status-text").textContent = m.accuracy_check
    ? `Engine OK · ${m.num_workers} workers · ${fmt.x(m.speedup)} speedup`
    : "Accuracy check FAILED";
}

/* ── Render algorithm visualizer ────────────────────────────── */
function renderAlgoViz(numWorkers) {
  const viz = el("algo-viz");

  const workers = Math.min(numWorkers, 8);
  const workerLabels = Array.from({length: workers}, (_, i) => `W${i}`);

  viz.innerHTML = `
    <div class="pipeline">
      <div class="pipe-stage">
        <div class="pipe-box divide">DIVIDE</div>
        <div class="pipe-complexity">O(1)</div>
      </div>
      <div class="pipe-arrow">→</div>
      <div class="pipe-stage">
        <div class="pipe-box map">MAP × ${workers} threads</div>
        <div class="pipe-complexity">[${workerLabels.join("  ")}]  →  O(N/W) each</div>
      </div>
      <div class="pipe-arrow">→</div>
      <div class="pipe-stage">
        <div class="pipe-box reduce">REDUCE (log ${workers} levels)</div>
        <div class="pipe-complexity">Sort-merge binary tree  →  O(K·log W)</div>
      </div>
    </div>
  `;
}

/* ── Speedup Chart ──────────────────────────────────────────── */
function renderSpeedupChart(scaling) {
  const measured     = scaling.measured;
  const theoretical  = scaling.theoretical_amdahl;

  const labels   = measured.map(r => `W=${r.workers}`);
  const measured_ = measured.map(r => r.speedup ?? 0);
  const theory_  = theoretical.map(r => r.speedup);

  new Chart(el("speedup-chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Measured Speedup",
          data: measured_,
          borderColor: ACCENT,
          backgroundColor: ACCENT + "33",
          fill: true,
          tension: 0.35,
          pointBackgroundColor: ACCENT,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        },
        {
          label: "Amdahl's Law (theoretical)",
          data: theory_,
          borderColor: ACCENT2,
          backgroundColor: "transparent",
          borderDash: [6, 4],
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.8,
        },
        {
          label: "Linear (ideal)",
          data: measured.map(r => r.workers),
          borderColor: MUTED,
          backgroundColor: "transparent",
          borderDash: [2, 4],
          tension: 0,
          pointRadius: 0,
          borderWidth: 1.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { color: "rgba(99,130,255,0.07)" },
          ticks: { color: "#8b9ab5" },
        },
        y: {
          grid: { color: "rgba(99,130,255,0.07)" },
          ticks: { color: "#8b9ab5", callback: v => v + "×" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}×`,
          },
        },
      },
    },
  });

  /* Amdahl stats */
  el("amdahl-p").textContent  = `${scaling.parallel_fraction}%`;
  el("crossover").textContent = scaling.crossover_workers
    ? `${scaling.crossover_workers} workers`
    : "—";
}

/* ── Market Donut ───────────────────────────────────────────── */
function renderMarketChart(tickers) {
  const labels = tickers.map(t => t.ticker);
  const totals = tickers.map(t => t.buy + t.sell);

  new Chart(el("market-chart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: totals,
        backgroundColor: TICKER_PALETTE.slice(0, labels.length).map(c => c + "cc"),
        borderColor:     TICKER_PALETTE.slice(0, labels.length),
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 10, padding: 12, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw / 1e9;
              return `${ctx.label}: $${v.toFixed(2)}B`;
            },
          },
        },
      },
    },
  });
}

/* ── Buy vs Sell Bar Chart ──────────────────────────────────── */
function renderBuySellChart(tickers) {
  const labels = tickers.map(t => t.ticker);
  const buys   = tickers.map(t => +(t.buy  / 1e9).toFixed(3));
  const sells  = tickers.map(t => +(t.sell / 1e9).toFixed(3));

  new Chart(el("buysell-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Buy ($B)",
          data: buys,
          backgroundColor: GREEN + "99",
          borderColor: GREEN,
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: "Sell ($B)",
          data: sells,
          backgroundColor: RED + "99",
          borderColor: RED,
          borderWidth: 1.5,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(99,130,255,0.07)" }, ticks: { color: "#8b9ab5" } },
        y: {
          grid: { color: "rgba(99,130,255,0.07)" },
          ticks: { color: "#8b9ab5", callback: v => "$" + v + "B" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, padding: 14 } },
      },
    },
  });
}

/* ── Ticker table ───────────────────────────────────────────── */
function renderTable(tickers) {
  const tbody = el("ticker-tbody");
  tbody.innerHTML = "";

  for (const t of tickers) {
    const isBull = t.net_flow >= 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="td-ticker">${t.ticker}</td>
      <td class="td-buy">${(t.buy  / 1e9).toFixed(4)}</td>
      <td class="td-sell">${(t.sell / 1e9).toFixed(4)}</td>
      <td class="${isBull ? "td-net-pos" : "td-net-neg"}">${(t.net_flow / 1e9).toFixed(4)}</td>
      <td><span class="direction-badge ${isBull ? "bull" : "bear"}">${isBull ? "▲ BULL" : "▼ BEAR"}</span></td>
    `;
    tbody.appendChild(row);
  }
}

/* ── Main ───────────────────────────────────────────────────── */
async function main() {
  let results, scaling;

  try {
    [results, scaling] = await Promise.all([
      loadJSON("results.json"),
      loadJSON("scaling_results.json"),
    ]);
  } catch (err) {
    el("status-text").textContent = "No data — run 'make run' then 'make bench'";
    el("status-text").style.color = RED;
    console.error(err);

    /* Render with placeholder scaling data so charts still show */
    scaling = {
      measured: [{workers:1,speedup:1},{workers:2,speedup:1.7},{workers:4,speedup:2.9},{workers:8,speedup:4.1}],
      theoretical_amdahl: [{workers:1,speedup:1},{workers:2,speedup:1.8},{workers:4,speedup:3.2},{workers:8,speedup:5.1}],
      parallel_fraction: 85.0,
      crossover_workers: 2,
    };
    renderSpeedupChart(scaling);
    return;
  }

  const tickers = results.summary.ticker_breakdown;
  const w       = results.metrics.num_workers;

  populateMetrics(results);
  renderAlgoViz(w);
  renderSpeedupChart(scaling);
  renderMarketChart(tickers);
  renderBuySellChart(tickers);
  renderTable(tickers);

  el("footer-workers").textContent = `${w} workers`;
}

document.addEventListener("DOMContentLoaded", main);
