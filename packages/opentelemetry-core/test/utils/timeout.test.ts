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

import * as sinon from "sinon";

import { callWithTimeout, TimeoutError } from "../../src";
import { assertRejects } from "../test-utils";

describe("callWithTimeout", () => {
  it("should reject if given promise not settled before timeout", async () => {
    sinon.useFakeTimers();
    const promise = new Promise(() => {
      /** promise never settles */
    });
    assertRejects(callWithTimeout(promise, 100), TimeoutError);
  });
});