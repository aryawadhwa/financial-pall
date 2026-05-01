const API_URL = './results.json';
const SCALING_URL = './scaling_results.json';

async function init() {
    try {
        const [response, scalingResponse] = await Promise.all([
            fetch(API_URL),
            fetch(SCALING_URL).catch(() => null)
        ]);
        
        const data = await response.json();
        let scalingData = null;
        if (scalingResponse && scalingResponse.ok) {
            scalingData = await scalingResponse.json();
        }
        
        renderMetrics(data);
        renderTickerChart(data);
        if (scalingData) {
            renderScalingMetrics(scalingData);
        }
        setupSidebar(data.metrics.cpu_count);
        setupAlgorithmViz(data.metrics.cpu_count);
        animateEntrance();
    } catch (error) {
        console.error('Error loading benchmark data:', error);
    }
}

function renderScalingMetrics(scalingData) {
    const crossover = scalingData.crossover_records;
    const amdahlFrac = scalingData.average_parallel_fraction * 100;

    const coEl = document.getElementById('crossover-point');
    const afEl = document.getElementById('amdahl-fraction');

    if (crossover) {
        coEl.innerText = (crossover / 1e3).toFixed(0) + 'K';
    } else {
        coEl.innerText = 'N/A';
    }

    afEl.innerText = amdahlFrac.toFixed(2) + '%';
}

function renderMetrics(data) {
    const { metrics, summary } = data;
    document.getElementById('seq-time').innerText = metrics.sequential_time.toFixed(3);
    document.getElementById('par-time').innerText = metrics.parallel_time.toFixed(3);
    document.getElementById('speedup').innerText = metrics.speedup.toFixed(2);
    
    document.getElementById('total-buy').innerText = '$' + (summary.total_buy / 1e9).toFixed(1) + 'B';
    document.getElementById('total-sell').innerText = '$' + (summary.total_sell / 1e9).toFixed(1) + 'B';
    document.getElementById('net-flow').innerText = '$' + (summary.net_flow / 1e6).toFixed(1) + 'M';
}

function setupSidebar(count) {
    const sidebar = document.getElementById('worker-sidebar');
    for (let i = 0; i < count; i++) {
        const node = document.createElement('div');
        node.className = 'worker-node active';
        sidebar.appendChild(node);
    }
}

function setupAlgorithmViz(count) {
    const flow = document.getElementById('viz-flow');
    
    // 1. Source Data
    const source = document.createElement('div');
    source.className = 'data-block';
    source.innerText = 'SOURCE';
    flow.appendChild(source);

    // 2. Connector to Workers
    const conn1 = document.createElement('div');
    conn1.className = 'connector';
    flow.appendChild(conn1);

    // 3. Parallel Worker Layer
    const workerStack = document.createElement('div');
    workerStack.style.display = 'flex';
    workerStack.style.flexDirection = 'column';
    workerStack.style.gap = '5px';
    for (let i = 0; i < 4; i++) { // Show 4 for visual clarity
        const wb = document.createElement('div');
        wb.className = 'data-block active';
        wb.innerText = `W${i}`;
        workerStack.appendChild(wb);
    }
    flow.appendChild(workerStack);

    // 4. Connector to Merge
    const conn2 = document.createElement('div');
    conn2.className = 'connector';
    flow.appendChild(conn2);

    // 5. Final Merge Node
    const merge = document.createElement('div');
    merge.className = 'merge-node';
    merge.innerText = 'MERGE';
    flow.appendChild(merge);
}

function renderTickerChart(data) {
    const ctx = document.getElementById('tickerChart').getContext('2d');
    const tickers = Object.keys(data.summary.ticker_breakdown);
    const volumes = Object.values(data.summary.ticker_breakdown);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: tickers,
            datasets: [{
                data: volumes,
                backgroundColor: [
                    '#00f2ff', '#7000ff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'
                ],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#666', usePointStyle: true, padding: 15, font: { family: 'JetBrains Mono', size: 10 } }
                }
            }
        }
    });
}

function animateEntrance() {
    const bricks = document.querySelectorAll('.brick');
    bricks.forEach((b, i) => {
        b.style.opacity = '0';
        b.style.transform = 'translateY(20px)';
        setTimeout(() => {
            b.style.transition = 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
            b.style.opacity = '1';
            b.style.transform = 'translateY(0)';
        }, 100 * i);
    });
}

init();
