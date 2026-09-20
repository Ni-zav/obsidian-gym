class stats {
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
}
