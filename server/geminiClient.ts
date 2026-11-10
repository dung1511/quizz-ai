import { ApiError, GoogleGenAI } from '@google/genai';
import {
  GeminiQuotaExhaustedError,
  classify429ErrorKind,
  getGeminiKeyManager,
  resetGeminiKeyManager,
} from './geminiKeyManager';

const geminiClients = new Map<string, GoogleGenAI>();

/** Per-attempt HTTP timeout (giây) cho fetch Gemini — có thể override bằng env. */
const GEMINI_HTTP_TIMEOUT_MS = Number(process.env.GEMINI_HTTP_TIMEOUT_MS) || 60_000;

/**
 * Trả về client Gemini cho MỘT key cụ thể (mỗi key một client — tránh tạo lại
 * client nhiều lần cho cùng key). Trả về null nếu không có key nào khả dụng.
 * Dùng cho luồng WEB/AI nghiên cứu khi caller cần biết "có AI không".
 */
export function getGeminiClient(): GoogleGenAI | null {
  const manager = getGeminiKeyManager();
  const entry = manager?.selectKey();
  if (!entry) return null;
  return getGeminiClientForKey(entry.apiKey);
}

export function getGeminiClientForKey(apiKey: string): GoogleGenAI | null {
  if (!apiKey) return null;
  const existing = geminiClients.get(apiKey);
  if (existing) return existing;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      // Per-attempt deadline (giây → SDK tự abort fetch, gửi X-Server-Timeout,
      // raise Undici timeouts). Không có timeout này request có thể treo vô hạn.
      timeout: GEMINI_HTTP_TIMEOUT_MS,
      retryOptions: {
        attempts: 3,
        initialDelay: 1,
        maxDelay: 8,
        jitter: 0.5,
        httpStatusCodes: [408, 500, 502, 503, 504],
      },
    },
  });
  geminiClients.set(apiKey, client);
  return client;
}

/** Đếm số key khả dụng (dùng trong health check, KHÔNG log giá trị key). */
export function getGeminiKeyCount(): number {
  return getGeminiKeyManager()?.count ?? 0;
}

type GenerateContentParameters = Omit<
  Parameters<GoogleGenAI['models']['generateContent']>[0],
  'model'
>;

export function getGeminiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  // Duck-typing for injected test doubles and wrapped SDK errors.
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

export interface TransientRetryOptions {
  /** Total attempts = maxRetries + 1. Defaults to 3 (2 retries). */
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Injectable delay for tests. */
  delayFn?: (ms: number) => Promise<void>;
}

export const DEFAULT_TRANSIENT_RETRY: Required<Omit<TransientRetryOptions, 'delayFn'>> = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bounded retry with exponential backoff for transient Gemini outages, mainly
 * HTTP 503 (model overloaded). Retry count is strictly limited — never infinite.
 * HTTP 429 is deliberately NOT retried here: quota exhaustion surfaces
 * immediately so callers can show a clear quota message.
 */
export async function callGeminiWithTransientRetry<T>(
  call: () => Promise<T>,
  options: TransientRetryOptions = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs } = { ...DEFAULT_TRANSIENT_RETRY, ...options };
  const delay = options.delayFn ?? sleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      const status = getGeminiErrorStatus(error);
      if (status === 429) throw error;
      const transient = status !== undefined && [408, 500, 502, 503, 504].includes(status);
      if (!transient || attempt >= maxRetries) throw error;
      const backoffMs = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      console.warn(`[Gemini] Transient HTTP ${status}; retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms.`);
      await delay(backoffMs);
    }
  }
  throw lastError;
}

/** Thử đọc retry-after (giây) từ message hoặc error object — không bắt buộc. */
function readRetryAfterMs(error: unknown): number | undefined {
  const raw =
    (error as { retryAfterMs?: unknown })?.retryAfterMs ??
    (error as { retryAfter?: unknown })?.retryAfter;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw * 1000;
  const message = error instanceof Error ? error.message : String(error || '');
  const match = message.match(/retry[-_ ]?after[:\s]*(\d+)/i);
  if (match) return Number(match[1]) * 1000;
  return undefined;
}

/**
 * Gọi Gemini với dự phòng nhiều key:
 * - Chỉ dùng key dự phòng cho lỗi tạm thời (503/timeout/401/403).
 * - Với HTTP 429: phân biệt quota cạn vs rate limit.
 *   + Quota cạn: dừng hẳn key đó (quota_exhausted) và trả lỗi có cấu trúc về frontend.
 *   + Rate limit tạm thời: cho thử lại sau delay ngắn (có tôn trọng Retry-After nếu có).
 * - Không xoay vòng qua nhiều key để né quota.
 */
export async function generateGeminiContent(
  params: GenerateContentParameters,
  options: { abortSignal?: AbortSignal } = {}
) {
  const manager = getGeminiKeyManager();
  if (!manager) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ. Tính năng AI hiện chưa khả dụng.');
  }

  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.5-flash';
  const abortSignal = options.abortSignal;

  let attemptKeyIndex = 0;
  const maxKeyAttempts = manager.count;
  while (attemptKeyIndex < maxKeyAttempts) {
    const entry = manager.selectKey();
    if (!entry) {
      if (attemptKeyIndex === 0) {
        throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ. Tính năng AI hiện chưa khả dụng.');
      }
      // Tất cả key đều đang ở trạng thái lỗi/quota — trả lỗi có cấu trúc.
      throw new GeminiQuotaExhaustedError();
    }
    const ai = getGeminiClientForKey(entry.apiKey);
    if (!ai) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ. Tính năng AI hiện chưa khả dụng.');
    }
    attemptKeyIndex += 1;

    const callAttempt = (model: string) =>
      ai.models.generateContent({
        ...params,
        model,
        config: { ...params.config, abortSignal },
      });

    try {
      const response = await callGeminiWithTransientRetry(() => callAttempt(primaryModel));
      manager.markActive(entry.envName);
      return response;
    } catch (error) {
      const status = getGeminiErrorStatus(error);
      const message = error instanceof Error ? error.message : String(error);

      // Caller đã hủy request (abortSignal từ withTimeout) — không thử key kế.
      if (abortSignal?.aborted) {
        throw new Error('Yêu cầu AI đã bị hủy do quá thời gian chờ. Không tự động thử lại vô hạn.');
      }

      // HTTP 429: phân loại quota cạn vs rate limit tạm thời.
      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
        const kind = classify429ErrorKind(message);
        if (kind === 'quota_exhausted') {
          manager.markQuotaExhausted(entry.envName);
          console.warn(`[Gemini] Key "${entry.envName}" quota exhausted; skipping this key.`);
          const otherAvailable = manager.getStatus().find((s) => s.state === 'active');
          if (otherAvailable) {
            continue;
          }
          throw new GeminiQuotaExhaustedError();
        }
        const retryAfterMs = readRetryAfterMs(error) ?? 15_000;
        manager.markRateLimited(entry.envName, retryAfterMs);
        console.warn(`[Gemini] Key "${entry.envName}" rate limited; retrying after ${Math.round(retryAfterMs / 1000)}s.`);
        continue;
      }

      // Lỗi tạm thời (503/timeout/AbortError): thử lại trên cùng key bằng bounded retry,
      // nếu vẫn lỗi thì thử key dự phòng.
      const transient = status !== undefined && [408, 500, 502, 503, 504].includes(status);
      if (transient || status === undefined) {
        manager.markTransientError(entry.envName, readRetryAfterMs(error) ?? 5_000);
        console.warn(`[Gemini] Key "${entry.envName}" transient failure (HTTP ${status ?? 'unknown'}); trying fallback key.`);
        continue;
      }

      // 401/403: key sai/thiếu quyền — vô hiệu hóa key này, thử key dự phòng.
      if (status === 401 || status === 403) {
        manager.markInvalid(entry.envName);
        console.warn(`[Gemini] Key "${entry.envName}" rejected (HTTP ${status}); trying fallback key.`);
        continue;
      }

      // 404 model: cùng client, lỗi model — thử fallback model trên cùng key.
      if (status === 404 || /model.*(not found|unavailable|unknown)/i.test(message)) {
        if (fallbackModel !== primaryModel) {
          console.warn('[Gemini] Primary model unavailable; trying fallback model.', {
            primaryModel,
            fallbackModel,
          });
          try {
            const response = await callGeminiWithTransientRetry(() => callAttempt(fallbackModel));
            manager.markActive(entry.envName);
            return response;
          } catch (fallbackError) {
            const fbStatus = getGeminiErrorStatus(fallbackError);
            const fbTransient = fbStatus !== undefined && [408, 500, 502, 503, 504].includes(fbStatus);
            if (!fbTransient) throw fallbackError;
            manager.markTransientError(entry.envName, readRetryAfterMs(fallbackError) ?? 5_000);
            continue;
          }
        }
        manager.markTransientError(entry.envName, 5_000);
        continue;
      }

      // Lỗi khác (400 bad request, 422 validation, ...): throw trực tiếp — không retry.
      throw error;
    }
  }

  // Đã thử hết số lần cho phép — trả lỗi có cấu trúc cho frontend.
  throw new GeminiQuotaExhaustedError();
}

export { resetGeminiKeyManager };
