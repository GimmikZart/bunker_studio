export const PACKAGE_NAME = '@bunker-studio/observability';

export type CorrelationContext = {
  correlationId: string;
  runId?: string;
  taskId?: string;
  organizationId?: string;
};
export type LogRecord = CorrelationContext & {
  level: 'INFO' | 'WARN' | 'ERROR';
  event: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export function createLogger(
  context: CorrelationContext,
  sink: (record: LogRecord) => void = (record) => console.log(JSON.stringify(record)),
) {
  return {
    info(event: string, metadata?: Record<string, unknown>) {
      sink({ ...context, level: 'INFO', event, metadata });
    },
    warn(event: string, metadata?: Record<string, unknown>) {
      sink({ ...context, level: 'WARN', event, metadata });
    },
    error(event: string, metadata?: Record<string, unknown>) {
      sink({ ...context, level: 'ERROR', event, metadata });
    },
  };
}
