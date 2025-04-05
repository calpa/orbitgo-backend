import pino from "pino";

const defaultConfig = {
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
      levelFirst: true,
      customPrettifiers: {
        time: (timestamp: string) => `🕒 ${timestamp}`,
      },
    },
  },
  level: "debug",
};

type LogFn = (context: Record<string, any>, message: string) => void;

export interface ContextualLogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

export const createContextLogger = (file: string, context: string): ContextualLogger => {
  const logger = pino({
    ...defaultConfig,
    base: { file, context },
    transport: {
      ...defaultConfig.transport,
      options: {
        ...defaultConfig.transport.options,
        messageFormat: `[{context}] {msg}`,
      },
    },
  });

  return {
    debug: (data: Record<string, any>, msg: string) => logger.debug(data, msg),
    info: (data: Record<string, any>, msg: string) => logger.info(data, msg),
    warn: (data: Record<string, any>, msg: string) => logger.warn(data, msg),
    error: (data: Record<string, any>, msg: string) => logger.error(data, msg),
  };
};
