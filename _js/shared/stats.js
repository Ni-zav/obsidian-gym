class stats {
    get core() {
        return globalThis.customJS?.gymCore;
    }

    async renderProgramProgress(context) {
        if (!context?.dv) return;
        const current = context.dv.current();
        const startDate = current.startDate || current.start_date;
        const duration = Number(current.duration_weeks ?? current.duration);
        if (!startDate || !Number.isFinite(duration) || duration <= 0) return;
        const endDate = this.calculateEndDate(startDate, duration);
        this.renderProgressBar(context.container, this.calculateProgress(startDate, endDate));
    }

    calculateEndDate(startDate, duration) {
        return moment(startDate).add(Number(duration), "weeks").format("YYYY-MM-DD");
    }

    calculateProgress(startDate, endDate) {
        const total = Math.max(1, moment(endDate).diff(moment(startDate), "days"));
        const elapsed = moment().diff(moment(startDate), "days");
        const percentage = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
        return { total, elapsed: Math.max(0, elapsed), remaining: Math.max(0, total - elapsed), percentage };
    }

    renderProgressBar(container, data) {
        const root = container.createEl("div", { cls: "progress-container" });
        const bar = root.createEl("div", { cls: "progress-bar" });
        bar.style.width = data.percentage + "%";
        root.createEl("div", { cls: "progress-text", text: data.percentage + "% complete (" + data.remaining + " days remaining)" });
    }

    renderRecovery(context) {
        if (!context?.container || !this.core) return;
        const definitions = this.core.getExerciseDefinitions();
        const groups = [...new Set(definitions.map(item => item.fm.muscle_group).filter(Boolean))].sort();
        const latest = new Map();

        for (const { fm: log } of this.core.getAllLogEntries()) {
            const exercise = log.exercise_id ? this.core.getExerciseById(log.exercise_id) : this.core.getExerciseByName(log.exercise);
            const group = exercise?.fm?.muscle_group;
            if (!group) continue;
            const timestamp = new Date(log.performed_at || log.date || 0).getTime();
            if (!Number.isFinite(timestamp)) continue;
            if (!latest.has(group) || timestamp > latest.get(group)) latest.set(group, timestamp);
        }

        context.container.createEl("p", {
            text: "Time-since-trained estimate only; it is not a physiological soreness or readiness measurement.",
            cls: "gym-muted"
        });

        const grid = context.container.createDiv({ cls: "gym-recovery-grid" });
        const now = Date.now();
        for (const group of groups) {
            const card = grid.createDiv({ cls: "gym-recovery-card" });
            card.createEl("strong", { text: group });
            const last = latest.get(group);
            if (!last) {
                card.createEl("div", { text: "No logged training yet", cls: "gym-muted" });
                continue;
            }
            const hours = Math.max(0, (now - last) / 3600000);
            const percent = Math.max(0, Math.min(100, Math.round((hours / 48) * 100)));
            const status = hours >= 48 ? "48h+ gap" : hours >= 24 ? "24–48h gap" : "<24h gap";
            card.createEl("div", { text: status, cls: "gym-muted" });
            const track = card.createDiv({ cls: "gym-recovery-track" });
            const bar = track.createDiv({ cls: "gym-recovery-bar" });
            bar.style.width = percent + "%";
            const date = typeof moment !== "undefined" ? moment(last).fromNow() : Math.round(hours) + "h ago";
            card.createEl("small", { text: "Last trained " + date });
        }
    }
}
