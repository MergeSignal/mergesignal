type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = "info") {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIndex = levels.indexOf(this.level);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  private log(level: LogLevel, msg: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const entry = {
      level,
      time: new Date().toISOString(),
      msg,
      ...(context || {}),
      pid: process.pid,
    };

    const output = JSON.stringify(entry);
    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(msg: string, context?: LogContext) {
    this.log("debug", msg, context);
  }

  info(msg: string, context?: LogContext) {
    this.log("info", msg, context);
  }

  warn(msg: string, context?: LogContext) {
    this.log("warn", msg, context);
  }

  error(msg: string, context?: LogContext) {
    this.log("error", msg, context);
  }
}

export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) ?? "info");
