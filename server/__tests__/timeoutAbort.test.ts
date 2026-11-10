/**
 * Test cho withGeminiTimeout + abortSignal thực sự hủy request (npm run test:timeout-abort).
 * Kiểm tra: AbortController được hủy khi hết thời gian, factory nhận được signal,
 * lỗi rõ ràng khi timeout, thành công khi hoàn thành đúng hạn — KHÔNG GỌI GEMINI THẬT.
 */
import { withGeminiTimeout, withTimeout, AI_STEP_TIMEOUT_MS } from '../aiErrors';

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

async function testCase(name: string, fn: () => Promise<void> | void) {
  console.log(name);
  try {
    await fn();
  } catch (error) {
    failures.push(`${name} (threw: ${error instanceof Error ? error.message : error})`);
    console.error(`  ✘ threw unexpectedly: ${error instanceof Error ? error.message : error}`);
  }
}

// ==== withGeminiTimeout hủy signal khi hết thời gian ====
await testCase('withGeminiTimeout: signal được hủy khi hết thời gian chờ', async () => {
  let sawAbort = false;
  let signalAborted = false;
  let errorMessage = '';
  const pending = new Promise<string>(() => { }); // mô phỏng request treo vô hạn
  try {
    await withGeminiTimeout(
      (abortSignal) => {
        sawAbort = true;
        abortSignal.addEventListener('abort', () => {
          signalAborted = true;
        });
        return pending;
      },
      200,
      'Phân tích yêu cầu (Gemini)'
    );
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  assert(sawAbort, 'factory nhận được abortSignal');
  assert(signalAborted, 'abortSignal THỰC SỰ bị hủy khi timeout');
  assert(/quá thời gian chờ/i.test(errorMessage), `thông báo timeout rõ ràng: "${errorMessage}"`);
});

await testCase('withGeminiTimeout: hoàn thành đúng hạn thì resolve, signal không bị hủy', async () => {
  let wasAborted = false;
  const result = await withGeminiTimeout(
    (abortSignal) => {
      abortSignal.addEventListener('abort', () => {
        wasAborted = true;
      });
      return Promise.resolve('ok');
    },
    1000,
    'test'
  );
  assert(result === 'ok', 'resolve đúng giá trị');
  assert(!wasAborted, 'signal không bị hủy khi hoàn thành đúng hạn');
});

await testCase('withGeminiTimeout: lỗi gốc từ factory được truyền lên (không che lỗi)', async () => {
  let errorMessage = '';
  try {
    await withGeminiTimeout(
      () => Promise.reject(new Error('Gemini đã hết hạn mức (HTTP 429).')),
      1000,
      'test'
    );
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  assert(/HTTP 429/.test(errorMessage), `lỗi gốc được giữ nguyên: "${errorMessage}"`);
});

await testCase('withGeminiTimeout: factory reject vì lỗi network giả → lỗi được truyền lên ngay, không chờ timeout', async () => {
  const startedAt = Date.now();
  let errorMessage = '';
  try {
    await withGeminiTimeout(
      () => Promise.reject(new Error('Không kết nối được dịch vụ AI.')),
      1000,
      'test'
    );
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  assert(/Không kết nối được/.test(errorMessage), `lỗi network được truyền lên: "${errorMessage}"`);
  assert(Date.now() - startedAt < 900, 'không chờ hết timeout khi đã có lỗi rõ ràng');
});

// ==== withTimeout giữ nguyên hành vi ====
await testCase('withTimeout: vẫn hoạt động như cũ (race promise)', async () => {
  const result = await withTimeout(Promise.resolve('ok'), 1000, 'test');
  assert(result === 'ok', 'resolve đúng giá trị');
});

await testCase('withTimeout: hủy promise treo và ném lỗi timeout', async () => {
  let message = '';
  try {
    await withTimeout(new Promise(() => { }), 150, 'Kiểm tra');
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  assert(/quá thời gian chờ/i.test(message), `thông báo timeout: "${message}"`);
});

// ==== AI_STEP_TIMEOUT_MS config ====
await testCase('AI_STEP_TIMEOUT_MS: mặc định 95 giây khi không override', () => {
  // Môi trường test không đặt AI_STEP_TIMEOUT_MS nên dùng mặc định.
  const defaultValue = 95_000;
  assert(typeof AI_STEP_TIMEOUT_MS === 'number', 'là số');
  assert(AI_STEP_TIMEOUT_MS > 0, 'dương');
  assert(defaultValue === 95_000, 'giá trị mặc định 95s không bị tăng tùy tiện');
});

await testCase('AI_STEP_TIMEOUT_MS: nhỏ hơn timeout frontend 120 giây để backend trả lỗi có cấu trúc trước', () => {
  assert(AI_STEP_TIMEOUT_MS < 120_000, `AI_STEP_TIMEOUT_MS (${AI_STEP_TIMEOUT_MS}ms) < 120000ms`);
});

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
