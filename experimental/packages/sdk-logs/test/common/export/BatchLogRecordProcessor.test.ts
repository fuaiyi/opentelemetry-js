/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { Resource } from '@opentelemetry/resources';
import {
  ExportResultCode,
  getEnv,
  loggingErrorHandler,
  setGlobalErrorHandler,
} from '@opentelemetry/core';

import type { BufferConfig, LogRecordLimits } from '../../../src';
import {
  BatchLogRecordProcessorBase,
  LogRecord,
  InMemoryLogRecordExporter,
} from '../../../src';
import { loadDefaultConfig } from '../../../src/config';
import { MultiLogRecordProcessor } from '../../../src/MultiLogRecordProcessor';

class BatchLogRecordProcessor extends BatchLogRecordProcessorBase<BufferConfig> {
  onInit() {}
  onShutdown() {}
}

const createLogRecord = (limits?: LogRecordLimits): LogRecord => {
  const { forceFlushTimeoutMillis, logRecordLimits } = loadDefaultConfig();
  const logRecord = new LogRecord(
    {
      activeProcessor: new MultiLogRecordProcessor(forceFlushTimeoutMillis),
      resource: Resource.default(),
      logRecordLimits: {
        attributeValueLengthLimit:
          limits?.attributeValueLengthLimit ??
          logRecordLimits.attributeValueLengthLimit,
        attributeCountLimit:
          limits?.attributeCountLimit ?? logRecordLimits.attributeCountLimit,
      },
      instrumentationScope: {
        name: 'test name',
        version: 'test version',
        schemaUrl: 'test schema url',
      },
    },
    {}
  );
  return logRecord;
};

describe('BatchLogRecordProcessorBase', () => {
  const defaultBufferConfig = {
    maxExportBatchSize: 5,
    scheduledDelayMillis: 2500,
  };
  let exporter: InMemoryLogRecordExporter;

  beforeEach(() => {
    exporter = new InMemoryLogRecordExporter();
  });

  afterEach(() => {
    exporter.reset();
    sinon.restore();
  });

  describe('constructor', () => {
    it('should create a BatchLogRecordProcessor instance', () => {
      const processor = new BatchLogRecordProcessor(exporter);
      assert.ok(processor instanceof BatchLogRecordProcessor);
    });

    it('should create a BatchLogRecordProcessor instance with config', () => {
      const bufferConfig = {
        maxExportBatchSize: 5,
        scheduledDelayMillis: 2500,
        exportTimeoutMillis: 2000,
        maxQueueSize: 200,
      };
      const processor = new BatchLogRecordProcessor(exporter, bufferConfig);
      assert.ok(processor instanceof BatchLogRecordProcessor);
      assert.ok(
        // @ts-expect-error
        processor._maxExportBatchSize === bufferConfig.maxExportBatchSize
      );
      assert.ok(
        // @ts-expect-error
        processor._maxQueueSize === bufferConfig.maxQueueSize
      );
      assert.ok(
        // @ts-expect-error
        processor._scheduledDelayMillis === bufferConfig.scheduledDelayMillis
      );
      assert.ok(
        // @ts-expect-error
        processor._exportTimeoutMillis === bufferConfig.exportTimeoutMillis
      );
    });

    it('should create a BatchLogRecordProcessor instance with empty config', () => {
      const processor = new BatchLogRecordProcessor(exporter);

      const {
        OTEL_BSP_MAX_EXPORT_BATCH_SIZE,
        OTEL_BSP_MAX_QUEUE_SIZE,
        OTEL_BSP_SCHEDULE_DELAY,
        OTEL_BSP_EXPORT_TIMEOUT,
      } = getEnv();
      assert.ok(processor instanceof BatchLogRecordProcessor);
      assert.ok(
        // @ts-expect-error
        processor._maxExportBatchSize === OTEL_BSP_MAX_EXPORT_BATCH_SIZE
      );
      assert.ok(
        // @ts-expect-error
        processor._maxQueueSize === OTEL_BSP_MAX_QUEUE_SIZE
      );
      assert.ok(
        // @ts-expect-error
        processor._scheduledDelayMillis === OTEL_BSP_SCHEDULE_DELAY
      );
      assert.ok(
        // @ts-expect-error
        processor._exportTimeoutMillis === OTEL_BSP_EXPORT_TIMEOUT
      );
    });

    it('maxExportBatchSize must be smaller or equal to maxQueueSize', () => {
      const bufferConfig = {
        maxExportBatchSize: 200,
        maxQueueSize: 100,
      };
      const processor = new BatchLogRecordProcessor(exporter, bufferConfig);
      // @ts-expect-error
      const { _maxExportBatchSize, _maxQueueSize } = processor;
      assert.ok(_maxExportBatchSize === _maxQueueSize);
    });
  });

  describe('onEmit', () => {
    it('should export the log records with buffer size reached', done => {
      const clock = sinon.useFakeTimers();
      const processor = new BatchLogRecordProcessor(
        exporter,
        defaultBufferConfig
      );
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const logRecord = createLogRecord();
        assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
        processor.onEmit(logRecord);
        assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
      }
      const logRecord = createLogRecord();
      processor.onEmit(logRecord);
      setTimeout(async () => {
        assert.strictEqual(
          exporter.getFinishedLogRecords().length,
          defaultBufferConfig.maxExportBatchSize
        );
        await processor.shutdown();
        assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.restore();
    });

    it('should force flush when timeout exceeded', done => {
      const clock = sinon.useFakeTimers();
      const processor = new BatchLogRecordProcessor(
        exporter,
        defaultBufferConfig
      );
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const logRecord = createLogRecord();
        processor.onEmit(logRecord);
        assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
      }
      setTimeout(() => {
        assert.strictEqual(
          exporter.getFinishedLogRecords().length,
          defaultBufferConfig.maxExportBatchSize
        );
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.restore();
    });

    it('should not export empty log record lists', done => {
      const spy = sinon.spy(exporter, 'export');
      const clock = sinon.useFakeTimers();
      new BatchLogRecordProcessor(exporter, defaultBufferConfig);
      setTimeout(() => {
        assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
        sinon.assert.notCalled(spy);
        done();
      }, defaultBufferConfig.scheduledDelayMillis + 1000);
      assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);

      clock.restore();
    });

    it('should export each log record exactly once with buffer size  reached multiple times', done => {
      const originalTimeout = setTimeout;
      const clock = sinon.useFakeTimers();
      const processor = new BatchLogRecordProcessor(
        exporter,
        defaultBufferConfig
      );
      const totalLogRecords = defaultBufferConfig.maxExportBatchSize * 2;
      for (let i = 0; i < totalLogRecords; i++) {
        const logRecord = createLogRecord();
        processor.onEmit(logRecord);
      }
      const logRecord = createLogRecord();
      processor.onEmit(logRecord);
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);
      originalTimeout(() => {
        clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);
        originalTimeout(async () => {
          clock.tick(defaultBufferConfig.scheduledDelayMillis + 10);
          clock.restore();
          assert.strictEqual(
            exporter.getFinishedLogRecords().length,
            totalLogRecords + 1
          );
          await processor.shutdown();
          assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
          done();
        });
      });
    });

    it('should call globalErrorHandler when exporting fails', done => {
      const clock = sinon.useFakeTimers();
      const expectedError = new Error('Exporter failed');
      sinon.stub(exporter, 'export').callsFake((_, callback) => {
        setTimeout(() => {
          callback({ code: ExportResultCode.FAILED, error: expectedError });
        }, 0);
      });
      const errorHandlerSpy = sinon.spy();
      setGlobalErrorHandler(errorHandlerSpy);
      const processor = new BatchLogRecordProcessor(
        exporter,
        defaultBufferConfig
      );
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const logRecord = createLogRecord();
        processor.onEmit(logRecord);
      }
      clock.tick(defaultBufferConfig.scheduledDelayMillis + 1000);
      clock.restore();
      setTimeout(() => {
        assert.strictEqual(errorHandlerSpy.callCount, 1);
        const [[error]] = errorHandlerSpy.args;
        assert.deepStrictEqual(error, expectedError);
        // reset global error handler
        setGlobalErrorHandler(loggingErrorHandler());
        done();
      });
    });

    it('should drop logRecords when there are more logRecords then "maxQueueSize"', () => {
      const maxQueueSize = 6;
      const processor = new BatchLogRecordProcessor(exporter, { maxQueueSize });
      const logRecord = createLogRecord();
      for (let i = 0; i < maxQueueSize + 10; i++) {
        processor.onEmit(logRecord);
      }
      // @ts-expect-error
      assert.strictEqual(processor._finishedLogRecords.length, 6);
    });
  });

  describe('forceFlush', () => {
    it('should force flush on demand', () => {
      const processor = new BatchLogRecordProcessor(
        exporter,
        defaultBufferConfig
      );
      for (let i = 0; i < defaultBufferConfig.maxExportBatchSize; i++) {
        const logRecord = createLogRecord();
        processor.onEmit(logRecord);
      }
      assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
      processor.forceFlush();
      assert.strictEqual(
        exporter.getFinishedLogRecords().length,
        defaultBufferConfig.maxExportBatchSize
      );
    });

    it('should call an async callback when flushing is complete', async () => {
      const processor = new BatchLogRecordProcessor(exporter);
      const logRecord = createLogRecord();
      processor.onEmit(logRecord);
      await processor.forceFlush();
      assert.strictEqual(exporter.getFinishedLogRecords().length, 1);
    });
  });

  describe('shutdown', () => {
    it('should call onShutdown', async () => {
      const processor = new BatchLogRecordProcessor(exporter);
      const onShutdownSpy = sinon.stub(processor, 'onShutdown');
      assert.strictEqual(onShutdownSpy.callCount, 0);
      await processor.shutdown();
      assert.strictEqual(onShutdownSpy.callCount, 1);
    });

    it('should call an async callback when shutdown is complete', async () => {
      let exportedLogRecords = 0;
      sinon.stub(exporter, 'export').callsFake((logRecords, callback) => {
        setTimeout(() => {
          exportedLogRecords = exportedLogRecords + logRecords.length;
          callback({ code: ExportResultCode.SUCCESS });
        }, 0);
      });
      const processor = new BatchLogRecordProcessor(exporter);
      const logRecord = createLogRecord();
      processor.onEmit(logRecord);
      await processor.shutdown();
      assert.strictEqual(exporter.getFinishedLogRecords().length, 0);
      assert.strictEqual(exportedLogRecords, 1);
    });
  });
});
