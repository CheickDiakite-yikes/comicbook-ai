import { inspect } from "util";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = (value ?? "info").toLowerCase();

  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }

  return "info";
}

function serializeMetadata(metadata: LogMetadata | undefined) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  const seen = new WeakSet();

  const payload = JSON.parse(
    JSON.stringify(
      metadata,
      (key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }

        if (typeof value === "bigint") {
          return value.toString();
        }

        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }

          seen.add(value);
        }

        return value;
      },
    ),
  );

  return inspect(payload, { depth: null, colors: false, breakLength: Infinity });
}

interface LoggerOptions {
  level?: LogLevel;
  metadata?: LogMetadata;
}

export class AppLogger {
  private readonly level: LogLevel;
  private readonly metadata: LogMetadata;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? parseLogLevel(process.env.LOG_LEVEL);
    this.metadata = options.metadata ?? {};
  }

  child(metadata: LogMetadata) {
    return new AppLogger({ level: this.level, metadata: { ...this.metadata, ...metadata } });
  }

  debug(message: string, metadata?: LogMetadata) {
    this.write("debug", message, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: LogMetadata) {
    this.write("warn", message, metadata);
  }

  error(message: string, errorOrMetadata?: Error | LogMetadata, metadata?: LogMetadata) {
    if (errorOrMetadata instanceof Error) {
      this.write("error", message, {
        ...(metadata ?? {}),
        error: errorOrMetadata,
      });
      return;
    }

    this.write("error", message, errorOrMetadata);
  }

  private shouldLog(level: LogLevel) {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private write(level: LogLevel, message: string, metadata?: LogMetadata) {
    if (!this.shouldLog(level)) {
      return;
    }

    const mergedMetadata = { ...this.metadata, ...(metadata ?? {}) };
    const serializedMetadata = serializeMetadata(mergedMetadata);
    const timestamp = new Date().toISOString();
    const formattedLevel = level.toUpperCase();
    const logLine = serializedMetadata
      ? `${timestamp} [${formattedLevel}] ${message} ${serializedMetadata}`
      : `${timestamp} [${formattedLevel}] ${message}`;

    if (level === "error") {
      console.error(logLine);
    } else if (level === "warn") {
      console.warn(logLine);
    } else if (level === "debug" && typeof console.debug === "function") {
      console.debug(logLine);
    } else {
      console.log(logLine);
    }
  }
}

export const logger = new AppLogger();

export function registerGlobalErrorHandlers(globalLogger: AppLogger) {
  process.on("unhandledRejection", (reason) => {
    globalLogger.error("Unhandled promise rejection", {
      error: reason instanceof Error ? reason : new Error(inspect(reason)),
    });
  });

  process.on("uncaughtException", (error) => {
    globalLogger.error("Uncaught exception", error as Error);
  });
}
