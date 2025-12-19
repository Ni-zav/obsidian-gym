class timer {
    constructor() {
        this.remainingTime = 0;
        this.timerId = null;
        this.isRunning = false;
        this.display = null;
    }

    async renderTimerControls(context) {
        if (!context?.container) return;

        const container = context.container;
        this.display = container.createEl("div", { cls: "timer-display" });
        this.display.textContent = "00:00";

        const controlsDiv = container.createEl("div", { cls: "timer-controls" });
        const startBtn = controlsDiv.createEl("button", { text: "Start (60s)" });
        const stopBtn = controlsDiv.createEl("button", { text: "Stop" });

        startBtn.addEventListener("click", () => this.start(60));
        stopBtn.addEventListener("click", () => this.stop());
    }

    start(seconds) {
        if (this.isRunning) return;
        this.remainingTime = seconds;
        this.isRunning = true;
        this.updateDisplay();

        this.timerId = setInterval(() => {
            this.remainingTime--;
            this.updateDisplay();
            if (this.remainingTime <= 0) {
                this.stop();
                new Notice("Timer finished!");
            }
        }, 1000);
    }

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.isRunning = false;
        this.remainingTime = 0;
        this.updateDisplay();
    }    updateDisplay() {
        if (!this.display) return;
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        this.display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
