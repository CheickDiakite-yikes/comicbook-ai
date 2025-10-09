import { AppLogger, logger as appLogger } from "../logger";
import { Veo3JobService } from "../services/Veo3JobService";

export interface Veo3JobWorkerOptions {
  service?: Veo3JobService;
  logger?: AppLogger;
  pollBatchSize?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
}

export class Veo3JobWorker {
  private readonly service: Veo3JobService;
  private readonly logger: AppLogger;
  private readonly pollBatchSize: number;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;
  private currentIntervalMs: number;

  constructor(options: Veo3JobWorkerOptions = {}) {
    this.service = options.service ?? new Veo3JobService();
    this.logger = (options.logger ?? appLogger).child({ context: "Veo3JobWorker" });
    this.pollBatchSize = options.pollBatchSize ?? 10;
    this.minIntervalMs = options.minIntervalMs ?? this.service.getActivePollDelayMs();
    this.maxIntervalMs = options.maxIntervalMs ?? Math.max(this.minIntervalMs * 8, 60_000);
    this.currentIntervalMs = this.minIntervalMs;
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.schedule(0);
    this.logger.info("Veo3 job worker started");
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.logger.info("Veo3 job worker stopped");
  }

  private schedule(delayMs: number) {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);

    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  private async tick() {
    if (!this.running) {
      return;
    }

    try {
      const processed = await this.service.pollOutstandingOperations(this.pollBatchSize);
      if (processed === 0) {
        this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, this.maxIntervalMs);
      } else {
        this.currentIntervalMs = this.minIntervalMs;
      }
    } catch (error) {
      this.logger.error("Failed to process Veo3 operations", error as Error);
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, this.maxIntervalMs);
    }

    this.schedule(this.currentIntervalMs);
  }
}
