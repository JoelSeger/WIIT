import pino from 'pino';

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: `./logs/server.log` },
    },
  ],
});

const logger = pino(
  {
    level: process.env.PINO_LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { severity: label.toUpperCase() };
      },
    },
  },
  transport
);

export default logger;
