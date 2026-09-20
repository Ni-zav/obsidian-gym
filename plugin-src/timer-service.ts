export type TimerMode = "countdown" | "stopwatch";

export interface TimerSnapshot {
  mode: TimerMode;
  seconds: number;
  running: boolean;
  paused: boolean;
}

export class TimerService {
  private mode: TimerMode = "countdown";
  private remaining = 0;
  private elapsed = 0;
  private running = false;
  private paused = false;
  private targetAt = 0;
  private startedAt = 0;
  private interval: number | null = null;
  private listeners = new Set<(snapshot: TimerSnapshot) => void>();
  private onFinished: () => void;

  constructor(onFinished: () => void) {
    this.onFinished = onFinished;
  }

  subscribe(listener: (snapshot: TimerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): TimerSnapshot {
    this.sync();
    return {
      mode: this.mode,
      seconds: this.mode === "countdown" ? this.remaining : this.elapsed,
      running: this.running,
      paused: this.paused,
    };
  }

  startCountdown(seconds: number): void {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!value) return;
    this.clearInterval();
    this.mode = "countdown";
    this.remaining = value;
    this.elapsed = 0;
    this.running = true;
    this.paused = false;
    this.targetAt = Date.now() + value * 1000;
    this.startedAt = 0;
    this.startTicking();
  }

  startStopwatch(): void {
    this.clearInterval();
    this.mode = "stopwatch";
    this.remaining = 0;
    this.elapsed = 0;
    this.running = true;
    this.paused = false;
    this.startedAt = Date.now();
    this.targetAt = 0;
    this.startTicking();
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.sync();
    this.clearInterval();
    this.paused = true;
    this.emit();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.running = true;
    if (this.mode === "countdown") {
      if (this.remaining <= 0) return this.reset();
      this.targetAt = Date.now() + this.remaining * 1000;
    } else {
      this.startedAt = Date.now() - this.elapsed * 1000;
    }
    this.startTicking();
  }

  reset(): void {
    this.clearInterval();
    this.remaining = 0;
    this.elapsed = 0;
    this.running = false;
    this.paused = false;
    this.targetAt = 0;
    this.startedAt = 0;
    this.emit();
  }

  destroy(): void {
    this.clearInterval();
    this.listeners.clear();
  }

  private startTicking(): void {
    this.sync();
    this.emit();
    this.interval = window.setInterval(() => {
      this.sync();
      this.emit();
      if (this.mode === "countdown" && this.running && !this.paused && this.remaining <= 0) {
        this.clearInterval();
        this.running = false;
        this.onFinished();
        this.emit();
      }
    }, 250);
  }

  private sync(): void {
    if (!this.running || this.paused) return;
    if (this.mode === "countdown") this.remaining = Math.max(0, Math.ceil((this.targetAt - Date.now()) / 1000));
    else this.elapsed = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
  }

  private clearInterval(): void {
    if (this.interval != null) window.clearInterval(this.interval);
    this.interval = null;
  }

  private emit(): void {
    const snapshot = this.snapshotWithoutSync();
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  private snapshotWithoutSync(): TimerSnapshot {
    return {
      mode: this.mode,
      seconds: this.mode === "countdown" ? this.remaining : this.elapsed,
      running: this.running,
      paused: this.paused,
    };
  }
}
