# Analytics

```dataviewjs
const core = customJS.gymCore;
if (!core) {
    dv.paragraph("Gym core is not loaded.");
} else {
    const root = core.paths.workoutsRoot + "/";
    const pages = dv.pages()
        .where(page => page.file.path.startsWith(root) && !page.file.path.includes("/Log/"))
        .where(page => page.file.tags?.includes("#workout"))
        .array()
        .sort((a, b) => new Date(a.date || a.started_at || 0) - new Date(b.date || b.started_at || 0));

    const byDate = new Map();
    for (const page of pages) {
        const date = String(page.date || page.started_at || "").slice(0, 10);
        if (!date) continue;
        const item = byDate.get(date) || { volume: 0, duration: 0, sessions: 0 };
        item.volume += Number(page["Total Volume"] || 0);
        item.duration += Number(page.duration_minutes || 0);
        item.sessions += 1;
        byDate.set(date, item);
    }

    const entries = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const filters = [
        { label: "30d", days: 30 },
        { label: "90d", days: 90 },
        { label: "1y", days: 365 },
        { label: "All", days: null }
    ];

    function renderChart(title, field, label, unit) {
        dv.header(2, title);
        const controls = this.container.createDiv({ cls: "gym-chart-filters" });
        const host = this.container.createDiv({ cls: "gym-chart" });
        let active = 90;
        let chartHost = host;

        const draw = () => {
            chartHost.empty();
            const cutoff = active ? Date.now() - active * 86400000 : 0;
            const data = entries.filter(([date]) => !cutoff || new Date(date).getTime() >= cutoff);
            if (!data.length) {
                chartHost.createEl("p", { text: "No workout data in this period." });
                return;
            }
            if (typeof window.renderChart !== "function") {
                dv.table(["Date", label], data.map(([date, value]) => [date, value[field]]));
                return;
            }
            window.renderChart({
                type: "line",
                data: {
                    labels: data.map(([date]) => date),
                    datasets: [{ label, data: data.map(([, value]) => value[field]), tension: 0.25, fill: false }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: unit }
                        }
                    }
                }
            }, chartHost);
        };

        for (const filter of filters) {
            const button = controls.createEl("button", { text: filter.label });
            if (filter.days === active) button.addClass("mod-cta");
            button.addEventListener("click", () => {
                active = filter.days;
                for (const child of controls.querySelectorAll("button")) child.removeClass("mod-cta");
                button.addClass("mod-cta");
                draw();
            });
        }
        draw();
    }

    renderChart.call(this, "Training volume", "volume", "Daily volume", "kg × reps");
    renderChart.call(this, "Workout duration", "duration", "Daily duration", "minutes");

    dv.header(2, "Recent sessions");
    dv.table(
        ["Workout", "Date", "Sets", "Volume", "Duration"],
        pages.slice(-12).reverse().map(page => [
            page.file.link,
            page.date || "",
            page.Logs ? Math.max(0, page.Logs.length - 2) : 0,
            Math.round(Number(page["Total Volume"] || 0)),
            page.duration || ""
        ])
    );
}
```
