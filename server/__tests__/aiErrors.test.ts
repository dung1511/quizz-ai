/**
 * Test cho phân loại lỗi AI + timeout từng bước (npm run test:ai-errors).
 * Kiểm tra: timeout, 429 (quota, không retry), 503 (overload), JSON lỗi,
 * lỗi config/auth và thông báo hợp lệ — KHÔNG GỌI GEMINI THẬT.
 */
import { classifyAiError, withTimeout } from '../aiErrors';
import { getGeminiErrorStatus } from '../geminiClient';

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

function errWithStatus(status: number, message = `HTTP ${status}`): { status: number; message: string } {
  return { status, message };
}

// ==== Timeout ====
await testCase('Timeout: withTimeout hủy promise treo và thông báo thời gian chờ', async () => {
  const startedAt = Date.now();
  let message = '';
  try {
    await withTimeout(new Promise(() => { }), 200, 'Phân tích yêu cầu (Gemini)');
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  assert(/quá thời gian chờ 0 giây|quá thời gian chờ/.test(message), `thông báo timeout: "${message}"`);
  assert(Date.now() - startedAt < 2000, 'timeout kích hoạt đúng hạn');
});

await testCase('Timeout: withTimeout không hủy promise hoàn thành đúng hạn', async () => {
  const result = await withTimeout(Promise.resolve('ok'), 1000, 'test');
  assert(result === 'ok', 'resolve đúng giá trị');
});

// ==== 429 — quota, KHÔNG retry ====
await testCase('429: được phân loại là quota với HTTP 429 và thông báo rõ ràng', () => {
  const structured = classifyAiError(errWithStatus(429), 'fallback');
  assert(structured.error_type === 'quota', `error_type = ${structured.error_type}`);
  assert(structured.status === 429, 'status = 429');
  assert(/429|hạn mức|quota/i.test(structured.message), 'thông báo nêu rõ quota');
  assert(!/AIza|Bearer\s/i.test(structured.message), 'không chứa dấu hiệu API key/token');
});

await testCase('429 quota cạn: GeminiQuotaExhaustedError được classifyAiError ánh xạ sang quota', async () => {
  const { GeminiQuotaExhaustedError } = await import('../geminiKeyManager');
  const structured = classifyAiError(new GeminiQuotaExhaustedError(), 'fallback');
  assert(structured.error_type === 'quota', `error_type = ${structured.error_type}`);
  assert(structured.status === 429, 'status = 429');
  assert(/quota/i.test(structured.message), 'thông báo nêu rõ quota cạn');
});

// ==== 503 — quá tải ====
await testCase('503: được phân loại là overloaded (HTTP 503, không phải quota)', () => {
  const structured = classifyAiError(errWithStatus(503, 'Service Unavailable'), 'fallback');
  assert(structured.error_type === 'overloaded', `error_type = ${structured.error_type}`);
  assert(structured.status === 503, 'status = 503');
  assert(structured.error_type !== 'quota', 'không lẫn với quota 429');
});

await testCase('502/504: cũng thuộc nhóm overloaded', () => {
  assert(classifyAiError(errWithStatus(502), 'x').error_type === 'overloaded', '502 → overloaded');
  assert(classifyAiError(errWithStatus(504), 'x').error_type === 'overloaded', '504 → overloaded');
});

// ==== Auth / Config ====
await testCase('401/403: phân loại là lỗi xác thực', () => {
  assert(classifyAiError(errWithStatus(401), 'x').error_type === 'auth', '401 → auth');
  assert(classifyAiError(errWithStatus(403), 'x').error_type === 'auth', '403 → auth');
});

await testCase('404 model: phân loại là lỗi cấu hình model', () => {
  const structured = classifyAiError(errWithStatus(404, 'model gemini-x not found'), 'x');
  assert(structured.error_type === 'config', `error_type = ${structured.error_type}`);
});

await testCase('Thiếu GEMINI_API_KEY: phân loại là config (không phải timeout)', () => {
  const structured = classifyAiError(new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.'), 'x');
  assert(structured.error_type === 'config', `error_type = ${structured.error_type}`);
  assert(structured.status === 503, 'status = 503');
});

// ==== JSON lỗi từ AI ====
await testCase('JSON hỏng từ AI: phân loại là invalid_response', () => {
  const structured = classifyAiError(new Error('AI phân tích yêu cầu trả JSON không hợp lệ: Unexpected token'), 'x');
  assert(structured.error_type === 'invalid_response', `error_type = ${structured.error_type}`);
  assert(structured.status === 502, 'status = 502');
});

// ==== Phạm vi / nguồn ====
await testCase('Thiếu căn cứ nguồn: phân loại là scope (HTTP 422, không phải lỗi hệ thống)', () => {
  const structured = classifyAiError(
    new Error('Tài liệu chỉ đủ căn cứ để tạo 3/10 câu hỏi cục bộ có trích dẫn kiểm chứng được.'),
    'x'
  );
  assert(structured.error_type === 'scope', `error_type = ${structured.error_type}`);
  assert(structured.status === 422, 'status = 422');
});

// ==== Thông điệp an toàn (không lộ API key) ====
await testCase('Thông báo lỗi không chứa dữ liệu nhạy cảm', () => {
  for (const error of [errWithStatus(429), errWithStatus(503), new Error('timeout aborted')]) {
    const structured = classifyAiError(error, 'fallback');
    assert(!/AIza|Bearer\s/i.test(structured.message), 'không chứa dấu hiệu API key/token');
  }
});

// ==== getGeminiErrorStatus vẫn đọc đúng status (dùng cho retry có giới hạn) ====
await testCase('getGeminiErrorStatus đọc status cho 503 (retry có giới hạn) và 429 (không retry)', () => {
  assert(getGeminiErrorStatus(errWithStatus(503)) === 503, 'đọc 503');
  assert(getGeminiErrorStatus(errWithStatus(429)) === 429, 'đọc 429');
  assert(getGeminiErrorStatus(new Error('plain')) === undefined, 'undefined cho lỗi thường');
});

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
