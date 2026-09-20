class exercise {
    get core() {
        return globalThis.customJS?.gymCore;
    }

    renderDescription(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const app = globalThis.customJS?.app || globalThis.app;
        const file = app?.vault.getAbstractFileByPath(current?.file?.path || String(current?.file || ""));
        const metadata = file ? app.metadataCache.getFileCache(file) : null;
        const fm = metadata?.frontmatter || {};

        if (fm.workout_id) {
            context.dv.header(2, "Exercise log");
            const rows = [];
            const weight = fm.weight_kg ?? fm.weight;
            if (weight !== null && weight !== undefined && weight !== "") rows.push(["Weight", weight + " kg"]);
            if (fm.reps !== null && fm.reps !== undefined && fm.reps !== "") rows.push(["Reps", fm.reps]);
            const duration = fm.duration_seconds ?? fm.duration;
            if (duration !== null && duration !== undefined && duration !== "") rows.push(["Duration", duration + " sec"]);
            if (fm.effort !== null && fm.effort !== undefined && fm.effort !== "") rows.push(["Effort", fm.effort + "/5"]);
            if (fm.note) rows.push(["Note", fm.note]);
            if (rows.length) context.dv.table(["Metric", "Value"], rows);
        }

        if (fm.instructions) {
            context.dv.header(2, "Instructions");
            context.dv.paragraph(String(fm.instructions));
        }

        if (fm.video_url && context.container) {
            context.dv.header(2, "Demo");
            const iframe = context.container.createEl("iframe", {
                attr: {
                    title: fm.exercise || "Exercise demo",
                    src: String(fm.video_url),
                    loading: "lazy",
                    allowfullscreen: "true",
                    allow: "fullscreen"
                }
            });
            iframe.addClass("gym-video");
        }

        this.renderSummary(context, fm);
    }

    renderSummary(context, fm) {
        if (!this.core || fm.workout_id) return;
        const history = this.core.getPreviousSets(fm.id, fm.exercise);
        if (!history.length) return;
        const values = history.map(item => item.fm);
        const nonTimed = values.filter(v => !(v.timed === true || v.timed === "true"));
        const weights = nonTimed.map(v => Number(v.weight_kg || 0));
        const reps = nonTimed.map(v => Number(v.reps || 0));
        const e1rms = nonTimed.map(v => {
            const w = Number(v.weight_kg || 0), r = Number(v.reps || 0);
            return w > 0 && r > 0 && r < 37 ? w * (36 / (37 - r)) : 0;
        });
        const stats = [];
        if (weights.some(Boolean)) stats.push(["Best weight", Math.max(...weights).toFixed(1) + " kg"]);
        if (reps.some(Boolean)) stats.push(["Best reps", Math.max(...reps)]);
        if (e1rms.some(Boolean)) stats.push(["Est. 1RM", Math.max(...e1rms).toFixed(1) + " kg"]);
        const weekAgo = Date.now() - 7 * 86400000;
        const weeklySets = history.filter(item => new Date(item.fm.performed_at || item.fm.date || 0).getTime() >= weekAgo).length;
        stats.push(["Logged sets", history.length]);
        stats.push(["Sets this week", weeklySets]);
        if (nonTimed.length >= 2) {
            const previous = nonTimed[nonTimed.length - 2];
            const latest = nonTimed[nonTimed.length - 1];
            const previousVolume = Number(previous.weight_kg || 0) * Number(previous.reps || 0);
            const latestVolume = Number(latest.weight_kg || 0) * Number(latest.reps || 0);
            const direction = latestVolume > previousVolume ? "↑" : latestVolume < previousVolume ? "↓" : "→";
            stats.push(["Last-set volume", direction + " " + latestVolume.toFixed(1)]);
        }
        if (stats.length) {
            context.dv.header(2, "Progress");
            context.dv.table(["Metric", "Best"], stats);
        }
    }

    renderEffortWeightChart(context) {
        if (!context?.dv || !this.core) return;
        const current = context.dv.current();
        const app = globalThis.customJS?.app || globalThis.app;
        const file = app?.vault.getAbstractFileByPath(current?.file?.path || String(current?.file || ""));
        const metadata = file ? app.metadataCache.getFileCache(file) : null;
        const fm = metadata?.frontmatter || {};
        const history = this.core.getPreviousSets(fm.id, fm.exercise);
        if (!history.length) return;

        const timed = fm.timed === true || fm.timed === "true";
        const labels = history.map(item => {
            const date = item.fm.performed_at || item.fm.date;
            return typeof moment !== "undefined" ? moment(date).format("YY-MM-DD HH:mm") : String(date || "");
        });
        const primary = history.map(item => timed
            ? Number(item.fm.duration_seconds || 0)
            : Number(item.fm.weight_kg || 0) * Number(item.fm.reps || 0));
        const efforts = history.map(item => Number(item.fm.effort || 0));

        if (typeof context.window?.renderChart === "function") {
            context.dv.header(2, "History");
            const host = context.container.createEl("div", { cls: "gym-chart" });
            context.window.renderChart({
                type: "line",
                data: {
                    labels,
                    datasets: [
                        { label: timed ? "Duration (sec)" : "Volume (kg×reps)", data: primary, yAxisID: "y", tension: 0.25 },
                        { label: "Effort", data: efforts, yAxisID: "y1", tension: 0.25 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "nearest", axis: "x", intersect: false },
                    scales: {
                        y: { beginAtZero: true },
                        y1: { beginAtZero: true, min: 0, max: 5, position: "right", grid: { drawOnChartArea: false } }
                    }
                }
            }, host);
        }

        const recent = history.slice(-8).reverse().map(item => {
            const v = item.fm;
            const date = v.performed_at || v.date;
            return [
                typeof moment !== "undefined" ? moment(date).format("YYYY-MM-DD HH:mm") : String(date || ""),
                timed ? ((v.duration_seconds ?? "~") + " sec") : (v.reps ?? "~"),
                v.weight_kg != null ? v.weight_kg + " kg" : "~",
                v.effort ?? "~",
                v.note || ""
            ];
        });
        context.dv.table(["When", timed ? "Duration" : "Reps", "Weight", "Effort", "Note"], recent);
    }

    fixExerciseName(value) {
        return String(value || "").replace(" - ", " ").toLowerCase();
    }
}
