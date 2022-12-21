'use strict';

const { DiagConsoleLogger, DiagLogLevel, diag } = require('@opentelemetry/api');
const logsAPI = require('@opentelemetry/api-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');
const {
  LoggerProvider,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
  EventLoggerProvider,
} = require('@opentelemetry/sdk-logs');

// Optional and only needed to see the internal diagnostic logging (during development)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const eventLoggerProvider = new EventLoggerProvider();
eventLoggerProvider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
);

logsAPI.logs.setGlobalLoggerProvider(eventLoggerProvider);

const logger = logsAPI.logs.getLogger('example', '1.0.0', {
  schemaUrl: 'log event',
});

const eventLogger = eventLoggerProvider.getEventLogger(logger, 'event domain');

/** LogRecord */
console.log('emit log record');
logger.emitLogRecord({
  body: 'this is a log record body',
  severityNumber: SeverityNumber.WARN,
  severityText: 'WARN',
  attributes: { 'log.record.att1': 'att1', 'log.record.att2': 2 },
});

/** LogEvent */
console.log('emit log event');
eventLogger.emitLogEvent('event name', {
  body: 'this is a log event body',
  severityNumber: SeverityNumber.INFO,
  severityText: 'INFO',
  attributes: { 'log.event.att1': 'att1', 'log.event.att2': 2 },
});
