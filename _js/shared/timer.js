class timer {
    constructor() {
        this.mode = "countdown";
        this.remainingTime = 0;
        this.elapsedTime = 0;
        this.timerId = null;
        this.isRunning = false;
        this.isPaused = false;
        this.targetAt = null;
        this.startedAt = null;
        this.displays = new Set();
    }

    async renderTimerControls(context) {
        if (!context?.container) return;
        const root = context.container.createEl("div", { cls: "gym-timer" });
        const mode = root.createEl("div", { cls: "gym-muted", text: this.mode === "stopwatch" ? "Stopwatch" : "Rest timer" });
        const display = root.createEl("div", { cls: "timer-display" });
        this.displays.add(display);

        const presets = root.createEl("div", { cls: "timer-presets" });
        for (const seconds of [30, 60, 90, 120]) {
            const button = presets.createEl("button", { text: seconds + "s" });
            button.addEventListener("click", () => {
                this.start(seconds);
                mode.textContent = "Rest timer";
            });
        }
        const stopwatch = presets.createEl("button", { text: "Stopwatch" });
        stopwatch.addEventListener("click", () => {
            this.startStopwatch();
            mode.textContent = "Stopwatch";
        });

        const controls = root.createEl("div", { cls: "timer-controls" });
        const pause = controls.createEl("button", { text: "Pause" });
        pause.addEventListener("click", () => {
            if (this.isPaused) this.resume();
            else this.pause();
            pause.textContent = this.isPaused ? "Resume" : "Pause";
        });
        const reset = controls.createEl("button", { text: "Reset" });
        reset.addEventListener("click", () => {
            this.reset();
            pause.textContent = "Pause";
        });
        this.updateDisplays();
    }

    start(seconds) {
        const duration = Math.max(0, Math.floor(Number(seconds) || 0));
        if (!duration) return;
        this.clearInterval();
        this.mode = "countdown";
        this.remainingTime = duration;
        this.elapsedTime = 0;
        this.isRunning = true;
        this.isPaused = false;
        this.targetAt = Date.now() + duration * 1000;
        this.startedAt = null;
        this.tick();
    }

    startStopwatch() {
        this.clearInterval();
        this.mode = "stopwatch";
        this.elapsedTime = 0;
        this.remainingTime = 0;
        this.isRunning = true;
        this.isPaused = false;
        this.startedAt = Date.now();
        this.targetAt = null;
        this.tick();
    }

    tick() {
        this.updateFromClock();
        this.updateDisplays();
        this.timerId = setInterval(() => {
            this.updateFromClock();
            this.updateDisplays();
            if (this.mode === "countdown" && this.remainingTime <= 0) {
                this.clearInterval();
                this.isRunning = false;
                this.targetAt = null;
                new Notice("Rest finished");
            }
        }, 250);
    }

    updateFromClock() {
        if (!this.isRunning || this.isPaused) return;
        if (this.mode === "countdown" && this.targetAt) {
            this.remainingTime = Math.max(0, Math.ceil((this.targetAt - Date.now()) / 1000));
        } else if (this.mode === "stopwatch" && this.startedAt) {
            this.elapsedTime = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
        }
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        this.updateFromClock();
        this.clearInterval();
        this.isPaused = true;
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.isRunning = true;
        if (this.mode === "countdown") {
            if (this.remainingTime <= 0) return this.reset();
            this.targetAt = Date.now() + this.remainingTime * 1000;
        } else {
            this.startedAt = Date.now() - this.elapsedTime * 1000;
        }
        this.tick();
    }

    stop() {
        this.pause();
    }

    reset() {
        this.clearInterval();
        this.remainingTime = 0;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.targetAt = null;
        this.startedAt = null;
        this.updateDisplays();
    }

    clearInterval() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
    }

    updateDisplays() {
        const value = this.mode === "stopwatch" ? this.elapsedTime : this.remainingTime;
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        const text = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        for (const display of [...this.displays]) {
            if (!display?.isConnected) this.displays.delete(display);
            else display.textContent = text;
        }
    }
}
