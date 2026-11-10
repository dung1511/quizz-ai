/**
 * Test cho quản lý nhiều Gemini key + dự phòng lỗi dịch vụ (npm run test:key-manager).
 * Kiểm tra: đọc key từ env, phân loại 429, trạng thái key, dự phòng key cho lỗi
 * tạm thời, KHÔNG dùng key dự phòng để né quota — KHÔNG GỌI GEMINI THẬT.
 */
import {
  GeminiKeyManager,
  GeminiQuotaExhaustedError,
  classify429ErrorKind,
  loadGeminiKeysFromEnv,
  QUOTA_STATE_MESSAGE,
} from '../geminiKeyManager';

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

// ==== Đọc key từ env ====
await testCase('Đọc key từ env: bỏ qua biến rỗng, giữ đúng thứ tự GEMINI_API_KEY, _2, _3', () => {
  const keys = loadGeminiKeysFromEnv({
    GEMINI_API_KEY: 'k1',
    GEMINI_API_KEY_2: 'k2',
    GEMINI_API_KEY_3: '   ',
    GEMINI_API_KEY_4: undefined,
  } as Record<string, string | undefined>);
  assert(keys.length === 2, `chỉ lấy 2 key hợp lệ (got ${keys.length})`);
  assert(keys[0].envName === 'GEMINI_API_KEY' && keys[0].apiKey === 'k1', 'key 1 đúng');
  assert(keys[1].envName === 'GEMINI_API_KEY_2', 'key 2 đúng envName');
});

await testCase('Đọc key từ env rỗng: trả về []', () => {
  const keys = loadGeminiKeysFromEnv({} as Record<string, string | undefined>);
  assert(keys.length === 0, `mảng rỗng (got ${keys.length})`);
});

// ==== Phân loại 429 ====
await testCase('Phân loại 429: RESOURCE_EXHAUSTED quota exceeded → quota_exhausted', () => {
  assert(classify429ErrorKind('RESOURCE_EXHAUSTED: quota exceeded for project') === 'quota_exhausted', 'quota cạn hẳn');
  assert(classify429ErrorKind('Resource has been exhausted (e.g. check quota)') === 'quota_exhausted', 'quota (kiểu message Google)');
});

await testCase('Phân loại 429: rate limit per minute → rate_limit (cho phép thử lại)', () => {
  assert(classify429ErrorKind('Too many requests; rate limit exceeded per minute') === 'rate_limit', 'rate limit tạm thời');
  assert(classify429ErrorKind('ResourceExhausted.Rate limit: requests per minute exceeded') === 'rate_limit', 'rate limit Google style');
});

await testCase('Phân loại 429: message mơ hồ → mặc định quota_exhausted (an toàn)', () => {
  assert(classify429ErrorKind('HTTP 429') === 'quota_exhausted', 'mặc định là quota');
});

// ==== Trạng thái key ====
await testCase('KeyManager: key mới khởi tạo là active, dùng được ngay', () => {
  const manager = new GeminiKeyManager([{ apiKey: 'k1', envName: 'GEMINI_API_KEY' }]);
  assert(manager.count === 1, 'đọc đúng 1 key');
  const entry = manager.selectKey();
  assert(entry !== null && entry.envName === 'GEMINI_API_KEY', 'chọn được key active');
  assert(manager.hasAvailableKey(), 'có key khả dụng');
});

await testCase('KeyManager: key bị quota cạn KHÔNG còn khả dụng cho tới khi hết thời gian làm mới', () => {
  const manager = new GeminiKeyManager([{ apiKey: 'k1', envName: 'GEMINI_API_KEY' }]);
  manager.markQuotaExhausted('GEMINI_API_KEY', 60 * 60 * 1000);
  assert(manager.selectKey() === null, 'không còn key khả dụng');
  assert(!manager.hasAvailableKey(), 'hasAvailableKey = false');
  const status = manager.getStatus();
  assert(status[0].state === 'quota_exhausted', 'trạng thái quota_exhausted');
  assert(status[0].envName === 'GEMINI_API_KEY', 'status KHÔNG chứa giá trị key');
});

await testCase('KeyManager: key lỗi tạm thời có thời điểm thử lại; hết hạn thì dùng lại được', async () => {
  const manager = new GeminiKeyManager([{ apiKey: 'k1', envName: 'GEMINI_API_KEY' }]);
  manager.markTransientError('GEMINI_API_KEY', 50);
  assert(manager.selectKey() === null, 'đang trong thời gian chờ');
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(manager.selectKey() !== null, 'hết hạn chờ thì dùng lại được');
});

await testCase('KeyManager: nhiều key — key 1 quota cạn thì key 2 vẫn dùng cho LỖI DỊCH VỤ', () => {
  const manager = new GeminiKeyManager([
    { apiKey: 'k1', envName: 'GEMINI_API_KEY' },
    { apiKey: 'k2', envName: 'GEMINI_API_KEY_2' },
  ]);
  manager.markQuotaExhausted('GEMINI_API_KEY');
  const entry = manager.selectKey();
  assert(entry !== null && entry.envName === 'GEMINI_API_KEY_2', 'rơi về key dự phòng (dự phòng lỗi dịch vụ, không né quota)');
});

await testCase('KeyManager: 401/403 vô hiệu hóa key; key dự phòng được chọn', () => {
  const manager = new GeminiKeyManager([
    { apiKey: 'k1', envName: 'GEMINI_API_KEY' },
    { apiKey: 'k2', envName: 'GEMINI_API_KEY_2' },
  ]);
  manager.markInvalid('GEMINI_API_KEY');
  const entry = manager.selectKey();
  assert(entry !== null && entry.envName === 'GEMINI_API_KEY_2', 'rơi về key dự phòng cho lỗi xác thực');
});

await testCase('KeyManager: rate limit tạm thời tôn trọng thời điểm thử lại', () => {
  const manager = new GeminiKeyManager([{ apiKey: 'k1', envName: 'GEMINI_API_KEY' }]);
  manager.markRateLimited('GEMINI_API_KEY', 60_000);
  assert(manager.selectKey() === null, 'trong thời gian rate limit thì không dùng');
  const status = manager.getStatus();
  assert(status[0].state === 'rate_limited', 'trạng thái rate_limited');
});

// ==== Lỗi quota có cấu trúc ====
await testCase('GeminiQuotaExhaustedError: thông báo rõ ràng, không lộ key, error_type=quota', () => {
  const error = new GeminiQuotaExhaustedError();
  assert(error.errorType === 'quota', 'errorType = quota');
  assert(!/AIza|Bearer\s/i.test(error.message), 'không chứa API key');
  assert(error.message.length > 0, 'có thông báo');
  assert(!/GEMINI_API_KEY/i.test(error.message), 'không nêu tên biến env cụ thể');
});

await testCase('GeminiQuotaExhaustedError: thông báo mặc định nêu rõ quota cạn', () => {
  const error = new GeminiQuotaExhaustedError(QUOTA_STATE_MESSAGE);
  assert(/quota|hạn mức/i.test(error.message), 'thông báo nêu rõ quota');
});

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
