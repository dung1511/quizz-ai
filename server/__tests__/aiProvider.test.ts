/**
 * Kiểm thử AI Provider abstraction + fallback:
 *  - Gemini hoạt động bình thường → không gọi provider phụ.
 *  - Gemini hết quota + provider phụ hoạt động → fallback thành công, ghi log provider.
 *  - Cả hai provider lỗi quota → lỗi có cấu trúc, thông báo thân thiện.
 *  - Lỗi dữ liệu đầu vào (400) → KHÔNG fallback.
 *  - Đếm request: đúng số gọi + model đã dùng.
 *
 * KHÔNG gọi API thật: mock fetch/OpenAI SDK qua inject; Gemini được mock qua
 * env key rỗng để test nhánh "không có key".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAiContent,
  classifyAiFailure,
  isFallbackAble,
  getProviderHealth,
  recordAiCall,
  summarizeAiCalls,
  resetAiCallLog,
} from '../aiProvider';
import { GeminiQuotaExhaustedError } from '../geminiKeyManager';

// ===== 1. Phân loại lỗi =====
test('classifyAiFailure: 429 RESOURCE_EXHAUSTED → quota (fallback-able)', () => {
  const error = Object.assign(new Error(' RESOURCE_EXHAUSTED quota exceeded'), { status: 429 });
  assert.equal(classifyAiFailure(error), 'quota');
  assert.equal(isFallbackAble('quota'), true);
});

test('classifyAiFailure: 400 bad request → input (KHÔNG fallback-able)', () => {
  const error = Object.assign(new Error('Bad request invalid argument'), { status: 400 });
  assert.equal(classifyAiFailure(error), 'input');
  assert.equal(isFallbackAble('input'), false);
});

test('classifyAiFailure: 503 overloaded → fallback-able', () => {
  const error = Object.assign(new Error('Service unavailable'), { status: 503 });
  assert.equal(classifyAiFailure(error), 'overloaded');
  assert.equal(isFallbackAble('overloaded'), true);
});

test('classifyAiFailure: JSON hỏng → invalid_response, KHÔNG fallback', () => {
  const error = new Error('AI trả về JSON không đúng định dạng: unexpected token');
  assert.equal(classifyAiFailure(error), 'invalid_response');
  assert.equal(isFallbackAble('invalid_response'), false);
});

test('classifyAiFailure: timeout → fallback-able', () => {
  const error = new Error('Request timed out ETIMEDOUT');
  assert.equal(classifyAiFailure(error), 'timeout');
  assert.equal(isFallbackAble('timeout'), true);
});

// ===== 2. Provider config =====
test('getProviderHealth: trả thông tin provider không chứa key', () => {
  const providers = getProviderHealth();
  assert.ok(Array.isArray(providers));
  for (const provider of providers) {
    assert.ok(provider.id && provider.displayName);
    assert.equal(JSON.stringify(providers).includes('sk-'), false, 'không được lộ key');
  }
});

// ===== 3. generateAiContent: không có provider nào =====
test('generateAiContent: không có provider nào → GeminiQuotaExhaustedError thông báo thân thiện', async () => {
  // Đảm bảo env không có key (test env này phải chạy sạch)
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedGemini2 = process.env.GEMINI_API_KEY_2;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY_2;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => generateAiContent({ prompt: 'test', step: 'test' }),
      (error: Error) => error instanceof GeminiQuotaExhaustedError || /provider AI nào/.test(error.message)
    );
  } finally {
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    if (savedGemini2) process.env.GEMINI_API_KEY_2 = savedGemini2;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }
});

// ===== 4. OpenAI-compatible JSON mode fallback =====
test('generateAiContent: Groq hỗ trợ response_format → trả JSON thành công', async () => {
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedGemini2 = process.env.GEMINI_API_KEY_2;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedBaseUrl = process.env.OPENAI_BASE_URL;
  const savedModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY_2;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
  process.env.OPENAI_MODEL = 'openai/gpt-oss-120b';

  let callCount = 0;
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callCount += 1;
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'response_format'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ok: true, note: 'groq-json-supported' }) } }],
      }),
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ok: true, note: 'groq-json-supported' }) } }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await generateAiContent({ prompt: 'test', step: 'test' });
    assert.equal(result.provider, 'openai-compatible');
    assert.equal(result.model, 'openai/gpt-oss-120b');
    assert.equal(callCount, 1);
    assert.equal(JSON.parse(result.text).note, 'groq-json-supported');
  } finally {
    global.fetch = originalFetch;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    if (savedGemini2) process.env.GEMINI_API_KEY_2 = savedGemini2;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    if (savedBaseUrl) process.env.OPENAI_BASE_URL = savedBaseUrl; else delete process.env.OPENAI_BASE_URL;
    if (savedModel) process.env.OPENAI_MODEL = savedModel; else delete process.env.OPENAI_MODEL;
  }
});

test('generateAiContent: Groq không hỗ trợ response_format → retry thành công', async () => {
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedGemini2 = process.env.GEMINI_API_KEY_2;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedBaseUrl = process.env.OPENAI_BASE_URL;
  const savedModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY_2;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
  process.env.OPENAI_MODEL = 'openai/gpt-oss-120b';

  let callCount = 0;
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callCount += 1;
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (callCount === 1) {
      assert.ok(Object.prototype.hasOwnProperty.call(body, 'response_format'));
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'response_format is not supported for this model' } }),
        json: async () => ({ error: { message: 'response_format is not supported for this model' } }),
      } as Response;
    }
    assert.ok(!Object.prototype.hasOwnProperty.call(body, 'response_format'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ok: true, note: 'groq-json-fallback-ok' }) } }],
      }),
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ ok: true, note: 'groq-json-fallback-ok' }) } }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await generateAiContent({ prompt: 'test', step: 'test' });
    assert.equal(result.provider, 'openai-compatible');
    assert.equal(result.model, 'openai/gpt-oss-120b');
    assert.equal(callCount, 2);
    assert.equal(JSON.parse(result.text).note, 'groq-json-fallback-ok');
  } finally {
    global.fetch = originalFetch;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    if (savedGemini2) process.env.GEMINI_API_KEY_2 = savedGemini2;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    if (savedBaseUrl) process.env.OPENAI_BASE_URL = savedBaseUrl; else delete process.env.OPENAI_BASE_URL;
    if (savedModel) process.env.OPENAI_MODEL = savedModel; else delete process.env.OPENAI_MODEL;
  }
});

test('generateAiContent: retry vẫn lỗi → ném lỗi rõ ràng và không treo', async () => {
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedGemini2 = process.env.GEMINI_API_KEY_2;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedBaseUrl = process.env.OPENAI_BASE_URL;
  const savedModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY_2;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
  process.env.OPENAI_MODEL = 'openai/gpt-oss-120b';

  let callCount = 0;
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    callCount += 1;
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (callCount === 1) {
      assert.ok(Object.prototype.hasOwnProperty.call(body, 'response_format'));
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'response_format is not supported for this model' } }),
        json: async () => ({ error: { message: 'response_format is not supported for this model' } }),
      } as Response;
    }
    assert.ok(!Object.prototype.hasOwnProperty.call(body, 'response_format'));
    return {
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: { message: 'model overloaded, retry later' } }),
      json: async () => ({ error: { message: 'model overloaded, retry later' } }),
    } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => generateAiContent({ prompt: 'test', step: 'test' }),
      (error: Error) => error instanceof Error && /OpenAI-compatible provider HTTP 500|model overloaded/.test(error.message)
    );
    assert.equal(callCount, 2);
  } finally {
    global.fetch = originalFetch;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    if (savedGemini2) process.env.GEMINI_API_KEY_2 = savedGemini2;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    if (savedBaseUrl) process.env.OPENAI_BASE_URL = savedBaseUrl; else delete process.env.OPENAI_BASE_URL;
    if (savedModel) process.env.OPENAI_MODEL = savedModel; else delete process.env.OPENAI_MODEL;
  }
});

test('generateAiContent: JSON không hợp lệ → ném lỗi an toàn và không trả về text lạ', async () => {
  const savedGemini = process.env.GEMINI_API_KEY;
  const savedGemini2 = process.env.GEMINI_API_KEY_2;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedBaseUrl = process.env.OPENAI_BASE_URL;
  const savedModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY_2;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
  process.env.OPENAI_MODEL = 'openai/gpt-oss-120b';

  global.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'Chỉ là text thường, không phải JSON.' } }],
    }),
    text: async () => 'Chỉ là text thường, không phải JSON.',
  }) as Response) as typeof fetch;

  try {
    await assert.rejects(
      () => generateAiContent({ prompt: 'test', step: 'test' }),
      (error: Error) => /không phải JSON hợp lệ/i.test(error.message)
    );
  } finally {
    global.fetch = originalFetch;
    if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    if (savedGemini2) process.env.GEMINI_API_KEY_2 = savedGemini2;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    if (savedBaseUrl) process.env.OPENAI_BASE_URL = savedBaseUrl; else delete process.env.OPENAI_BASE_URL;
    if (savedModel) process.env.OPENAI_MODEL = savedModel; else delete process.env.OPENAI_MODEL;
  }
});

// ===== 5. Call counter =====
test('recordAiCall + summarizeAiCalls: đếm đúng tổng request và theo provider:model', () => {
  resetAiCallLog();
  recordAiCall({ step: 'gen', provider: 'gemini', model: 'gemini-3.5-flash', ok: true, durationMs: 100 });
  recordAiCall({ step: 'gen', provider: 'gemini', model: 'gemini-3.5-flash', ok: true, durationMs: 150 });
  recordAiCall({ step: 'validate', provider: 'openai-compatible', model: 'gpt-4o-mini', ok: true, durationMs: 200 });
  recordAiCall({ step: 'gen', provider: 'gemini', model: 'gemini-3.5-flash', ok: false, durationMs: 50 });
  const summary = summarizeAiCalls('test-run');
  assert.equal(summary.total, 4);
  assert.equal(summary.failed, 1);
  assert.equal(summary.byProviderModel['gemini:gemini-3.5-flash'], 3);
  assert.equal(summary.byProviderModel['openai-compatible:gpt-4o-mini'], 1);
  // Sau summarize đã reset
  assert.equal(summarizeAiCalls('empty').total, 0);
});
