/**
 * Minimal assertion-based tests (run with tsx, no test framework needed):
 *   npm run test:gemini-retry
 */
import {
  callGeminiWithTransientRetry,
  DEFAULT_TRANSIENT_RETRY,
  getGeminiErrorStatus,
} from '../geminiClient';

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(name);
    console.error(`  ✘ ${name}`);
  }
}

function makeApiError(status: number): { status: number; name: string; message: string } {
  return { status, name: 'ApiError', message: `HTTP ${status}` };
}

async function testCase(name: string, fn: () => Promise<void>) {
  console.log(name);
  try {
    await fn();
  } catch (error) {
    failures.push(`${name} (threw: ${error})`);
    console.error(`  ✘ threw unexpectedly: ${error}`);
  }
}

await testCase('HTTP 503 is retried and succeeds on 2nd attempt', async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await callGeminiWithTransientRetry(
    () => {
      calls++;
      if (calls === 1) throw makeApiError(503);
      return Promise.resolve('ok');
    },
    { delayFn: async (ms) => { delays.push(ms); } }
  );
  assert(calls === 2, 'made exactly 2 calls (1 retry)');
  assert(result === 'ok', 'returned success result');
  assert(delays.length === 1, 'waited once before retry');
});

await testCase('HTTP 503 exhausts bounded retries and throws last error', async () => {
  let calls = 0;
  const delays: number[] = [];
  let thrown: unknown;
  try {
    await callGeminiWithTransientRetry(
      () => {
        calls++;
        throw makeApiError(503);
      },
      { maxRetries: 2, delayFn: async (ms) => { delays.push(ms); } }
    );
  } catch (error) {
    thrown = error;
  }
  assert(calls === 3, `stopped after maxRetries+1 = 3 calls (got ${calls})`);
  assert((thrown as { status?: number })?.status === 503, 'rethrew the 503 error');
  assert(delays.length === 2, 'used exactly 2 backoff waits');
  assert(
    delays[0] === DEFAULT_TRANSIENT_RETRY.initialDelayMs &&
      delays[1] === DEFAULT_TRANSIENT_RETRY.initialDelayMs * 2,
    `exponential backoff (got ${delays.join(', ')})`
  );
});

await testCase('HTTP 429 is NOT retried and throws immediately', async () => {
  let calls = 0;
  let thrown: unknown;
  try {
    await callGeminiWithTransientRetry(
      () => {
        calls++;
        throw makeApiError(429);
      },
      { maxRetries: 5, delayFn: async () => { throw new Error('must not sleep'); } }
    );
  } catch (error) {
    thrown = error;
  }
  assert(calls === 1, `made only 1 call (got ${calls})`);
  assert((thrown as { status?: number })?.status === 429, 'rethrew the 429 error');
});

await testCase('Non-transient HTTP 400 is not retried', async () => {
  let calls = 0;
  try {
    await callGeminiWithTransientRetry(
      () => {
        calls++;
        throw makeApiError(400);
      },
      { delayFn: async () => { throw new Error('must not sleep'); } }
    );
  } catch {
    // expected
  }
  assert(calls === 1, `made only 1 call (got ${calls})`);
});

await testCase('getGeminiErrorStatus reads status from error object', async () => {
  assert(getGeminiErrorStatus(makeApiError(503)) === 503, 'extracts 503');
  assert(getGeminiErrorStatus(new Error('plain')) === undefined, 'undefined for plain Error');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
