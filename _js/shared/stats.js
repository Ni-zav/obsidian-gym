class stats {
    async renderProgramProgress(context) {
        if (!context?.dv) return;

        const current = context.dv.current();
        const startDate = current.startDate;
        const endDate = this.calculateEndDate(startDate, current.duration);

        const progressData = this.calculateProgress(startDate, endDate);
        this.renderProgressBar(context.container, progressData);
    }

    calculateEndDate(startDate, duration) {
        return moment(startDate).add(duration, 'weeks').format('YYYY-MM-DD');
    }

    calculateProgress(startDate, endDate) {
        const total = moment(endDate).diff(moment(startDate), 'days');
        const elapsed = moment().diff(moment(startDate), 'days');
        const remaining = total - elapsed;
        const percentage = Math.min(100, Math.round((elapsed / total) * 100));

        return {
            total,
            elapsed,
            remaining,
            percentage
        };
    }    renderProgressBar(container, data) {
        const barContainer = container.createEl('div', { cls: 'progress-container' });
        const bar = barContainer.createEl('div', { cls: 'progress-bar' });
        bar.style.width = `${data.percentage}%`;

        const text = barContainer.createEl('div', { cls: 'progress-text' });
        text.textContent = `${data.percentage}% complete (${data.remaining} days remaining)`;
    }
}
