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

/** LogRecord example */
console.log('this is a log record example:');
const loggerProvider = new LoggerProvider();
loggerProvider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
);

logsAPI.logs.setGlobalLoggerProvider(loggerProvider);

const logger = logsAPI.logs.getLogger('example', '1.0.0', {
  schemaUrl: 'log record',
});

logger.emitLogRecord({
  body: 'this is a log record body',
  severityNumber: SeverityNumber.WARN,
  severityText: 'WARN',
  attributes: { 'log.record.att1': 'att1', 'log.record.att2': 2 },
});

/** LogEvent example */
console.log('this is a log event example:');
const eventLoggerProvider = new EventLoggerProvider();
eventLoggerProvider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
);

const eventLogger = eventLoggerProvider.getEventLogger(logger, 'event domain');

eventLogger.emitLogEvent('event name', {
  body: 'this is a log event body',
  severityNumber: SeverityNumber.INFO,
  severityText: 'INFO',
  attributes: { 'log.event.att1': 'att1', 'log.event.att2': 2 },
});
