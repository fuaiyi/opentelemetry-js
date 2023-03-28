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

import type * as logsAPI from '@opentelemetry/api-logs';
import type { IResource } from '@opentelemetry/resources';
import type { InstrumentationScope } from '@opentelemetry/core';

import type { LoggerConfig, LogRecordLimits } from './types';
import { LogRecord } from './LogRecord';
import { LoggerProvider } from './LoggerProvider';
import { mergeConfig } from './config';
import { LogRecordProcessor } from './LogRecordProcessor';

export class Logger implements logsAPI.Logger {
  public readonly resource: IResource;
  private readonly _logRecordLimits: LogRecordLimits;

  constructor(
    public readonly instrumentationScope: InstrumentationScope,
    config: LoggerConfig,
    private _loggerProvider: LoggerProvider
  ) {
    const localConfig = mergeConfig(config);
    this.resource = _loggerProvider.resource;
    this._logRecordLimits = localConfig.logRecordLimits!;
  }

  public emit(logRecord: logsAPI.LogRecord): void {
    const logRecordInstance = new LogRecord(this, logRecord);
    this.getActiveLogRecordProcessor().onEmit(logRecordInstance);
  }

  public getLogRecordLimits(): LogRecordLimits {
    return this._logRecordLimits;
  }

  public getActiveLogRecordProcessor(): LogRecordProcessor {
    return this._loggerProvider.getActiveLogRecordProcessor();
  }
}