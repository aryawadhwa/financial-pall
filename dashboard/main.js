const API_URL = './results.json';

async function init() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        renderMetrics(data);
        renderPerformanceChart(data);
        renderTickerChart(data);
        renderSummary(data);
    } catch (error) {
        console.error('Error loading benchmark data:', error);
        // Fallback for demo if file not found yet
        document.querySelector('main').innerHTML += '<p style="color: red; text-align: center;">Waiting for benchmark results... Check terminal for progress.</p>';
    }
}

function renderMetrics(data) {
    const { metrics } = data;
    document.getElementById('seq-time').innerText = metrics.sequential_time.toFixed(3);
    document.getElementById('par-time').innerText = metrics.parallel_time.toFixed(3);
    document.getElementById('speedup').innerText = metrics.speedup.toFixed(2);
}

function renderPerformanceChart(data) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sequential', 'Parallel (8-Core)'],
            datasets: [{
                label: 'Execution Time (s)',
                data: [data.metrics.sequential_time, data.metrics.parallel_time],
                backgroundColor: [
                    'rgba(255, 255, 255, 0.1)',
                    '#00f2ff'
                ],
                borderColor: [
                    'rgba(255, 255, 255, 0.2)',
                    '#00f2ff'
                ],
                borderWidth: 1,
                borderRadius: 12
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#999' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#fff' }
                }
            }
        }
    });
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
                    '#00f2ff', '#7000ff', '#ff00d4', '#ff8c00', '#00ff8c', '#ffffff'
                ],
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#999', usePointStyle: true, padding: 20 }
                }
            }
        }
    });
}

function renderSummary(data) {
    const { summary } = data;
    document.getElementById('total-buy').innerText = '$' + (summary.total_buy / 1e9).toFixed(2) + 'B';
    document.getElementById('total-sell').innerText = '$' + (summary.total_sell / 1e9).toFixed(2) + 'B';
    document.getElementById('net-flow').innerText = '$' + (summary.net_flow / 1e6).toFixed(2) + 'M';
}

init();
