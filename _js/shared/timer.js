class timer {
    constructor() {
        this.remainingTime = 0;
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.displays = new Set();
        this.endsAt = null;
    }

    async renderTimerControls(context) {
        if (!context?.container) return;
        const root = context.container.createEl("div", { cls: "gym-timer" });
        const display = root.createEl("div", { cls: "timer-display" });
        this.displays.add(display);
        this.updateDisplays();

        const presets = root.createEl("div", { cls: "timer-presets" });
        for (const seconds of [30, 60, 90, 120]) {
            const button = presets.createEl("button", { text: seconds + "s" });
            button.addEventListener("click", () => this.start(seconds));
        }

        const controls = root.createEl("div", { cls: "timer-controls" });
        const pause = controls.createEl("button", { text: this.isPaused ? "Resume" : "Pause" });
        pause.addEventListener("click", () => {
            if (this.isPaused) this.resume();
            else this.pause();
            pause.textContent = this.isPaused ? "Resume" : "Pause";
        });
        const reset = controls.createEl("button", { text: "Reset" });
        reset.addEventListener("click", () => this.stop());
    }

    start(seconds) {
        const duration = Math.max(0, Math.floor(Number(seconds) || 0));
        if (!duration) return;
        this.clearInterval();
        this.remainingTime = duration;
        this.isRunning = true;
        this.isPaused = false;
        this.endsAt = Date.now() + duration * 1000;
        this.updateDisplays();
        this.timerId = setInterval(() => {
            this.remainingTime = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
            this.updateDisplays();
            if (this.remainingTime <= 0) {
                this.clearInterval();
                this.isRunning = false;
                this.endsAt = null;
                new Notice("Rest finished");
            }
        }, 250);
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.remainingTime = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
        this.clearInterval();
        this.isPaused = true;
        this.updateDisplays();
    }

    resume() {
        if (!this.isPaused || this.remainingTime <= 0) return;
        this.isPaused = false;
        this.isRunning = true;
        this.endsAt = Date.now() + this.remainingTime * 1000;
        this.start(this.remainingTime);
    }

    stop() {
        this.clearInterval();
        this.remainingTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.endsAt = null;
        this.updateDisplays();
    }

    clearInterval() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
    }

    updateDisplays() {
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        const text = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        for (const display of [...this.displays]) {
            if (!display?.isConnected) this.displays.delete(display);
            else display.textContent = text;
        }
    }
}
