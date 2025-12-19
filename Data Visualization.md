
# Daily Volume

```dataviewjs
// Get all workout files from Workouts folder
const workoutFiles = dv.pages('"Workouts"')
    .filter(p => p.file.path.match(/Workouts\/\d{4}-\d{2}-\d{2}\s-\s/) && p.file.name !== 'Log')
    .where(p => p["Total Volume"] !== undefined || p.date !== undefined);

// Group by date and sum volumes
const volumeByDate = {};

for (const page of workoutFiles) {
    let date = null;
    
    // Try to get date from frontmatter
    if (page.date) {
        if (typeof page.date === 'string') {
            date = page.date.split('T')[0]; // Handle ISO string
        } else if (page.date instanceof Date) {
            date = page.date.toISOString().split('T')[0];
        }
    }
    
    // Fallback: extract date from file path (yyyy-mm-dd - workoutname)
    if (!date) {
        const pathMatch = page.file.path.match(/Workouts\/(\d{4}-\d{2}-\d{2})\s-\s/);
        if (pathMatch) {
            date = pathMatch[1];
        }
    }
    
    const volume = page["Total Volume"] || 0;
    
    if (date) {
        volumeByDate[date] = (volumeByDate[date] || 0) + volume;
    }
}

// Filter data based on selected period
function filterDataByPeriod(data, period) {
    const now = new Date();
    const filteredData = {};
    
    for (const [date, volume] of Object.entries(data)) {
        const d = new Date(date);
        
        if (period === 'weekly') {
            // Last 7 days
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            if (d >= sevenDaysAgo) filteredData[date] = volume;
        } else if (period === 'monthly') {
            // Last 30 days
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (d >= thirtyDaysAgo) filteredData[date] = volume;
        } else if (period === 'yearly') {
            // Last 365 days
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            if (d >= yearAgo) filteredData[date] = volume;
        } else if (period === 'all') {
            // All data
            filteredData[date] = volume;
        }
    }
    
    return filteredData;
}

// Create filter buttons
const filterContainer = this.container.createEl('div', { cls: 'filter-buttons' });
filterContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px;';

const filters = ['weekly', 'monthly', 'yearly', 'all'];
let currentFilter = 'monthly'; // Default filter

const buttons = {};
for (const filter of filters) {
    const btn = filterContainer.createEl('button', { text: filter.charAt(0).toUpperCase() + filter.slice(1) });
    btn.style.cssText = `
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: ${filter === currentFilter ? 'var(--interactive-accent)' : 'var(--background-primary-alt)'};
        color: ${filter === currentFilter ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        cursor: pointer;
        font-weight: ${filter === currentFilter ? '600' : '400'};
    `;
    
    btn.onclick = () => {
        // Update button styles
        for (const f of filters) {
            if (f === filter) {
                buttons[f].style.backgroundColor = 'var(--interactive-accent)';
                buttons[f].style.color = 'var(--text-on-accent)';
                buttons[f].style.fontWeight = '600';
            } else {
                buttons[f].style.backgroundColor = 'var(--background-primary-alt)';
                buttons[f].style.color = 'var(--text-normal)';
                buttons[f].style.fontWeight = '400';
            }
        }
        
        currentFilter = filter;
        updateChart();
    };
    
    buttons[filter] = btn;
}

// Create chart container
const chartContainer = this.container.createEl('div');
chartContainer.style.cssText = 'position: relative; width: 100%; height: 300px;';

const chartCanvas = document.createElement('canvas');
chartContainer.appendChild(chartCanvas);

let chart = null;

function updateChart() {
    const filteredData = filterDataByPeriod(volumeByDate, currentFilter);
    const sortedDates = Object.keys(filteredData).sort();
    
    const data = {
        labels: sortedDates,
        datasets: [
            {
                label: 'Daily Volume (Kg)',
                data: sortedDates.map(date => filteredData[date]),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            title: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value + ' kg';
                    }
                },
                title: {
                    display: true,
                    text: 'Volume (Kg)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                }
            }
        }
    };

    if (chart) {
        chart.destroy();
    }

    // Load Chart.js from CDN if not already loaded
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        script.onload = () => {
            const ctx = chartCanvas.getContext('2d');
            chart = new Chart(ctx, {
                type: 'line',
                data: data,
                options: options
            });
        };
        document.head.appendChild(script);
    } else {
        const ctx = chartCanvas.getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: options
        });
    }
}

// Initial chart load
updateChart();
```

## Daily Workout Duration

```dataviewjs
// Get all workout files from Workouts folder
const workoutFiles = dv.pages('"Workouts"')
    .filter(p => p.file.path.match(/Workouts\/\d{4}-\d{2}-\d{2}\s-\s/) && p.file.name !== 'Log')
    .where(p => p.duration !== undefined || p.date !== undefined);

// Parse duration string to minutes
function parseDurationToMinutes(durationStr) {
    if (!durationStr) return 0;
    
    let totalMinutes = 0;
    
    // Match hours
    const hourMatch = durationStr.match(/(\d+)\s*hours?/i);
    if (hourMatch) {
        totalMinutes += parseInt(hourMatch[1]) * 60;
    }
    
    // Match minutes
    const minuteMatch = durationStr.match(/(\d+)\s*minutes?/i);
    if (minuteMatch) {
        totalMinutes += parseInt(minuteMatch[1]);
    }
    
    // Match "Ongoing" status
    if (durationStr === 'Ongoing') {
        return 0;
    }
    
    return totalMinutes;
}

// Group by date and sum durations
const durationByDate = {};

for (const page of workoutFiles) {
    let date = null;
    
    // Try to get date from frontmatter
    if (page.date) {
        if (typeof page.date === 'string') {
            date = page.date.split('T')[0]; // Handle ISO string
        } else if (page.date instanceof Date) {
            date = page.date.toISOString().split('T')[0];
        }
    }
    
    // Fallback: extract date from file path (yyyy-mm-dd - workoutname)
    if (!date) {
        const pathMatch = page.file.path.match(/Workouts\/(\d{4}-\d{2}-\d{2})\s-\s/);
        if (pathMatch) {
            date = pathMatch[1];
        }
    }
    
    const durationMinutes = parseDurationToMinutes(page.duration);
    
    if (date) {
        durationByDate[date] = (durationByDate[date] || 0) + durationMinutes;
    }
}

// Filter data based on selected period
function filterDataByPeriod(data, period) {
    const now = new Date();
    const filteredData = {};
    
    for (const [date, value] of Object.entries(data)) {
        const d = new Date(date);
        
        if (period === 'weekly') {
            // Last 7 days
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            if (d >= sevenDaysAgo) filteredData[date] = value;
        } else if (period === 'monthly') {
            // Last 30 days
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (d >= thirtyDaysAgo) filteredData[date] = value;
        } else if (period === 'yearly') {
            // Last 365 days
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            if (d >= yearAgo) filteredData[date] = value;
        } else if (period === 'all') {
            // All data
            filteredData[date] = value;
        }
    }
    
    return filteredData;
}

// Create filter buttons
const filterContainer = this.container.createEl('div', { cls: 'filter-buttons' });
filterContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px;';

const filters = ['weekly', 'monthly', 'yearly', 'all'];
let currentFilter = 'monthly'; // Default filter

const buttons = {};
for (const filter of filters) {
    const btn = filterContainer.createEl('button', { text: filter.charAt(0).toUpperCase() + filter.slice(1) });
    btn.style.cssText = `
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background-color: ${filter === currentFilter ? 'var(--interactive-accent)' : 'var(--background-primary-alt)'};
        color: ${filter === currentFilter ? 'var(--text-on-accent)' : 'var(--text-normal)'};
        cursor: pointer;
        font-weight: ${filter === currentFilter ? '600' : '400'};
    `;
    
    btn.onclick = () => {
        // Update button styles
        for (const f of filters) {
            if (f === filter) {
                buttons[f].style.backgroundColor = 'var(--interactive-accent)';
                buttons[f].style.color = 'var(--text-on-accent)';
                buttons[f].style.fontWeight = '600';
            } else {
                buttons[f].style.backgroundColor = 'var(--background-primary-alt)';
                buttons[f].style.color = 'var(--text-normal)';
                buttons[f].style.fontWeight = '400';
            }
        }
        
        currentFilter = filter;
        updateChart();
    };
    
    buttons[filter] = btn;
}

// Create chart container
const chartContainer = this.container.createEl('div');
chartContainer.style.cssText = 'position: relative; width: 100%; height: 300px;';

const chartCanvas = document.createElement('canvas');
chartContainer.appendChild(chartCanvas);

let chart = null;

function updateChart() {
    const filteredData = filterDataByPeriod(durationByDate, currentFilter);
    const sortedDates = Object.keys(filteredData).sort();
    
    const data = {
        labels: sortedDates,
        datasets: [
            {
                label: 'Daily Duration (Minutes)',
                data: sortedDates.map(date => filteredData[date]),
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: 'rgb(153, 102, 255)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            title: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value + ' min';
                    }
                },
                title: {
                    display: true,
                    text: 'Duration (Minutes)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                }
            }
        }
    };

    if (chart) {
        chart.destroy();
    }

    // Load Chart.js from CDN if not already loaded
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        script.onload = () => {
            const ctx = chartCanvas.getContext('2d');
            chart = new Chart(ctx, {
                type: 'line',
                data: data,
                options: options
            });
        };
        document.head.appendChild(script);
    } else {
        const ctx = chartCanvas.getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: options
        });
    }
}

// Initial chart load
updateChart();
```
