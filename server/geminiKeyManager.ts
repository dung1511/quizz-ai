/**
 * Quản lý nhiều Gemini API key ở phía server (dự phòng lỗi kết nối/dịch vụ).
 *
 * Nguyên tắc:
 * - Đọc key từ biến môi trường: GEMINI_API_KEY, GEMINI_API_KEY_2, ..., GEMINI_API_KEY_9.
 *   Bỏ qua biến rỗng/chỉ toàn khoảng trắng. KHÔNG bao giờ log key hoặc gửi key xuống frontend.
 * - Mỗi key có trạng thái: active | transient_error | rate_limited | quota_exhausted | invalid
 *   và thời điểm nextRetryAt — trước đó không được dùng lại key ở trạng thái lỗi.
 * - KHÔNG xoay vòng qua nhiều key để "né quota": khi key bị cạn quota (HTTP 429
 *   RESOURCE_EXHAUSTED / quota exceeded) ta dừng hẳn key đó và trả lỗi có cấu trúc
 *   về frontend; key dự phòng chỉ được dùng cho lỗi tạm thời (503/timeout/auth sai).
 *   Nhiều key ≠ quota cộng dồn: đây chỉ là dự phòng sự cố dịch vụ.
 */

export type GeminiKeyState =
  | 'active'
  | 'transient_error'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'invalid';

export interface GeminiKeyEntry {
  /** Chuỗi key (KHÔNG được log hoặc gửi ra ngoài). */
  apiKey: string;
  /** Tên biến môi trường — có thể log/hiển thị an toàn. */
  envName: string;
  state: GeminiKeyState;
  /** Thời điểm (Date.now()) key có thể thử lại; 0 = dùng được ngay. */
  nextRetryAt: number;
}

export interface GeminiKeyStatus {
  envName: string;
  state: GeminiKeyState;
  availableAt: number;
}

export const MAX_KEY_SLOTS = 9;
export const QUOTA_STATE_MESSAGE =
  'Gemini đã hết hạn mức (quota) cho API key hiện tại. Vui lòng chờ quota được làm mới hoặc nâng cấp gói; không thể tự động chuyển sang key dự phòng để né giới hạn quota.';

/** Đọc danh sách key từ env, bỏ qua biến rỗng. Trả về [] nếu không có key nào. */
export function loadGeminiKeysFromEnv(
  env: Record<string, string | undefined> = process.env
): Array<{ apiKey: string; envName: string }> {
  const keys: Array<{ apiKey: string; envName: string }> = [];
  const names = ['GEMINI_API_KEY'];
  for (let slot = 2; slot <= MAX_KEY_SLOTS; slot++) names.push(`GEMINI_API_KEY_${slot}`);
  for (const envName of names) {
    const value = (env[envName] || '').trim();
    if (!value) continue;
    keys.push({ apiKey: value, envName });
  }
  return keys;
}

/** Phân loại HTTP 429: quota cạn hẳn (RESOURCE_EXHAUSTED / quota exceeded) hay giới hạn tốc độ tạm thời. */
export function classify429ErrorKind(message: string): 'quota_exhausted' | 'rate_limit' {
  const normalized = (message || '').toLowerCase();
  const quotaSignal =
    /resource_exhausted|quota (?:exceeded|exhausted)|exhausted quota|has been exhausted|quota_exceeded|daily (?:limit|quota)|billing/.test(normalized);
  const rateSignal = /rate limit|too many requests|per minute|per-minute|requests per|resourceexhausted\.rate/.test(normalized);
  // RESOURCE_EXHAUSTED chứa cả "rate limit" và "quota": ưu tiên tín hiệu quota rõ ràng,
  // nếu message nêu rõ rate limit/per minute thì coi là giới hạn tạm thời.
  if (quotaSignal && !rateSignal) return 'quota_exhausted';
  if (rateSignal && !quotaSignal) return 'rate_limit';
  if (quotaSignal && rateSignal) {
    // Cả hai tín hiệu: nếu nêu "per day/daily/billing" thì là quota; ngược lại coi là rate limit.
    return /per day|daily|billing/.test(normalized) ? 'quota_exhausted' : 'rate_limit';
  }
  // Mặc định an toàn: coi là quota để không lặp vô hạn với key đã cạn.
  return 'quota_exhausted';
}

/** Lỗi quota có cấu trúc — được classifyAiError ánh xạ sang error_type='quota'. */
export class GeminiQuotaExhaustedError extends Error {
  errorType: 'quota' = 'quota';
  constructor(message = QUOTA_STATE_MESSAGE) {
    super(message);
    this.name = 'GeminiQuotaExhaustedError';
  }
}

export interface GeminiKeyManagerOptions {
  /** Lập lịch thử lại key ở trạng thái lỗi (thay vì sau khi hết delay). */
  delayFn?: (ms: number) => Promise<void>;
}

export class GeminiKeyManager {
  private readonly entries: GeminiKeyEntry[];

  constructor(keys: Array<{ apiKey: string; envName: string }>) {
    this.entries = keys.map((entry) => ({
      apiKey: entry.apiKey,
      envName: entry.envName,
      state: 'active' as GeminiKeyState,
      nextRetryAt: 0,
    }));
  }

  get count(): number {
    return this.entries.length;
  }

  /** Danh sách key (chỉ dùng nội bộ — không log). */
  private keys(): GeminiKeyEntry[] {
    return this.entries;
  }

  /**
   * Chọn key kế tiếp KHẢ DỤNG, bắt đầu từ key ưu tiên (active trước, theo thứ tự env).
   * Trả về null nếu không còn key nào dùng được ngay.
   */
  selectKey(): GeminiKeyEntry | null {
    const now = Date.now();
    return (
      this.keys().find(
        (entry) => entry.state === 'active' || (entry.nextRetryAt > 0 && now >= entry.nextRetryAt)
      ) || null
    );
  }

  markActive(envName: string): void {
    const entry = this.byEnvName(envName);
    if (!entry) return;
    entry.state = 'active';
    entry.nextRetryAt = 0;
  }

  /** Lỗi tạm thời (503/timeout): cho thử lại sau khoảng delay ngắn, có giới hạn. */
  markTransientError(envName: string, retryAfterMs: number): void {
    const entry = this.byEnvName(envName);
    if (!entry) return;
    entry.state = 'transient_error';
    entry.nextRetryAt = Date.now() + Math.max(1, retryAfterMs);
  }

  /** HTTP 429 rate limit tạm thời: cho thử lại sau khoảng delay (tôn trọng retryDelay nếu có). */
  markRateLimited(envName: string, retryAfterMs: number): void {
    const entry = this.byEnvName(envName);
    if (!entry) return;
    entry.state = 'rate_limited';
    entry.nextRetryAt = Date.now() + Math.max(1000, retryAfterMs);
  }

  /** HTTP 429 quota cạn: dừng dùng key này cho đến khi quota được làm mới (mặc định 1 giờ). */
  markQuotaExhausted(envName: string, resetAfterMs = 60 * 60 * 1000): void {
    const entry = this.byEnvName(envName);
    if (!entry) return;
    entry.state = 'quota_exhausted';
    entry.nextRetryAt = Date.now() + Math.max(60 * 1000, resetAfterMs);
  }

  /** 401/403: key sai hoặc thiếu quyền — vô hiệu hóa đến khi sửa cấu hình. */
  markInvalid(envName: string, retryAfterMs = 10 * 60 * 1000): void {
    const entry = this.byEnvName(envName);
    if (!entry) return;
    entry.state = 'invalid';
    entry.nextRetryAt = Date.now() + Math.max(60 * 1000, retryAfterMs);
  }

  /** Trạng thái cho health check / log — không chứa giá trị key. */
  getStatus(): GeminiKeyStatus[] {
    return this.entries.map((entry) => ({
      envName: entry.envName,
      state: entry.state,
      availableAt: entry.nextRetryAt,
    }));
  }

  /** Có key nào dùng được ngay hay không. */
  hasAvailableKey(): boolean {
    return this.selectKey() !== null;
  }

  private byEnvName(envName: string): GeminiKeyEntry | undefined {
    return this.entries.find((entry) => entry.envName === envName);
  }
}

let manager: GeminiKeyManager | null = null;

export function getGeminiKeyManager(): GeminiKeyManager | null {
  const keys = loadGeminiKeysFromEnv();
  if (keys.length === 0) return null;
  if (!manager) manager = new GeminiKeyManager(keys);
  return manager;
}

/** Reset singleton (chỉ dùng cho unit test). */
export function resetGeminiKeyManager(): void {
  manager = null;
}
