// ── Structured Logger (Pino) ────────────────────────────────────────────────
// Pino for structured JSON logging. Separate from Langfuse (LLM observability).
// Use child loggers with correlation IDs for troubleshooting:
//   const log = logger.child({ debateId, userId });
//   log.info('debate started');

import pino from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  // Structured JSON in production, pretty-ish in dev via pino defaults
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
});

export type Logger = pino.Logger;
