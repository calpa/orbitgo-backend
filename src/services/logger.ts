import pino from 'pino';

export const logger = pino({
  level: 'debug',
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

type LogFn = (context: Record<string, any>, message: string) => void;

export interface ContextualLogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

export const createContextLogger = (file: string, functionName: string): ContextualLogger => {
  const logWithContext = (level: 'debug' | 'info' | 'warn' | 'error') =>
    (context: Record<string, any>, message: string) => {
      logger[level]({
        ...context,
        file,
        function: functionName,
      }, message);
    };

  return {
    debug: logWithContext('debug'),
    info: logWithContext('info'),
    warn: logWithContext('warn'),
    error: logWithContext('error'),
  };
};

export type LogContext = {
  requestId?: string;
  chainId?: number;
  address?: string;
  method?: string;
  path?: string;
  duration?: number;
};
