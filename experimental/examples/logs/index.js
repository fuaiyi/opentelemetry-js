'use strict';

const { DiagConsoleLogger, DiagLogLevel, diag } = require('@opentelemetry/api');
const logsAPI = require('@opentelemetry/api-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');
const {
  LoggerProvider,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} = require('@opentelemetry/sdk-logs');

// Optional and only needed to see the internal diagnostic logging (during development)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

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
