/**
 * AI Provider abstraction: Gemini là provider chính, hỗ trợ provider thứ hai
 * (OpenAI-compatible API: OpenAI, Groq, OpenRouter, Together... hoặc self-host).
 *
 * Nguyên tắc:
 * - Key đọc từ env, KHÔNG hardcode, KHÔNG log, KHÔNG gửi xuống frontend.
 * - Mỗi provider có model + key + base URL riêng.
 * - Không dùng nhiều key cùng một project để né quota: key dự phòng Gemini
 *   (GEMINI_API_KEY_2/3...) CHỈ dùng cho lỗi tạm thời (503/timeout/auth), không
 *   dùng khi quota cạn — đúng nguyên tắc hiện có của geminiKeyManager.
 * - Chuyển provider CHỈ khi lỗi thuộc nhóm fallback-able (429 quota, 503/504
 *   overloaded, timeout). Lỗi dữ liệu đầu vào (400), validation, JSON hỏng,
 *   thiếu căn cứ nguồn → KHÔNG fallback.
 * - Đếm số request/provider/model cho toàn bộ quy trình tạo đề (log tổng).
 */

import { ApiError, GoogleGenAI } from '@google/genai';
import {
  GeminiQuotaExhaustedError,
  classify429ErrorKind,
  getGeminiKeyManager,
  resetGeminiKeyManager,
} from './geminiKeyManager';

export type AiProviderId = 'gemini' | 'openai-compatible' | 'none';

export interface AiProviderConfig {
  id: AiProviderId;
  /** Tên hiển thị/log an toàn — không chứa key. */
  displayName: string;
  model: string;
  /** Có provider nào cấu hình hay không. */
  available: boolean;
}

export interface AiGenerateJsonResult {
  text: string;
  provider: AiProviderId;
  providerDisplayName: string;
  model: string;
}

export interface AiGenerateOptions {
  /** Prompt/chỉ dẫn — mỗi provider tự đóng gói theo API của mình. */
  prompt: string;
  config?: {
    responseMimeType?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
  abortSignal?: AbortSignal;
  /** Nhãn bước (log): parse-request | research.synthesize | question.generate ... */
  step?: string;
}

// ===== Bộ đếm request (log tổng số request + model đã dùng mỗi lần tạo đề) =====
export interface AiCallRecord {
  step?: string;
  provider: AiProviderId;
  model: string;
  ok: boolean;
  durationMs: number;
}

let callLog: AiCallRecord[] = [];

export function recordAiCall(record: AiCallRecord): void {
  callLog.push(record);
}

/** Log tổng + reset. Dùng ở cuối một lần tạo đề để báo số request đã tiêu thụ. */
export function summarizeAiCalls(label = 'exam-generation'): { total: number; byProviderModel: Record<string, number>; failed: number } & { reset: () => void } {
  const records = callLog;
  const byProviderModel: Record<string, number> = {};
  let failed = 0;
  for (const record of records) {
    const key = `${record.provider}:${record.model}`;
    byProviderModel[key] = (byProviderModel[key] || 0) + 1;
    if (!record.ok) failed += 1;
  }
  callLog = [];
  const summary = {
    total: records.length,
    failed,
    byProviderModel,
    reset: () => { callLog = []; },
  };
  console.info(`[AI Provider] Request summary (${label}):`, summary);
  return summary;
}

/** Reset bộ đếm (bắt đầu một lần tạo đề mới). */
export function resetAiCallLog(): void {
  callLog = [];
}

// ===== Cấu hình provider từ env =====
const geminiClients = new Map<string, GoogleGenAI>();
const GEMINI_HTTP_TIMEOUT_MS = Number(process.env.GEMINI_HTTP_TIMEOUT_MS) || 60_000;
const AI_HTTP_TIMEOUT_MS = Number(process.env.AI_HTTP_TIMEOUT_MS) || 60_000;

function getGeminiClientForKey(apiKey: string): GoogleGenAI | null {
  if (!apiKey) return null;
  const existing = geminiClients.get(apiKey);
  if (existing) return existing;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
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

export interface ProviderInfo {
  id: AiProviderId;
  displayName: string;
  model: string;
  available: boolean;
}

/** Provider chính: Gemini (key manager hiện có). */
export function getPrimaryProviderInfo(): ProviderInfo {
  const manager = getGeminiKeyManager();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  return {
    id: 'gemini',
    displayName: 'Gemini',
    model,
    available: Boolean(manager && manager.hasAvailableKey()),
  };
}

/**
 * Provider thứ hai: bất kỳ API OpenAI-compatible (OpenAI, Groq, OpenRouter,
 * Together, vLLM self-host...). Chỉ bật khi có OPENAI_API_KEY trong env.
 * Base URL + model cấu hình riêng qua OPENAI_BASE_URL / OPENAI_MODEL.
 */
export function getSecondaryProviderInfo(): ProviderInfo {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  return {
    id: 'openai-compatible',
    displayName: `OpenAI-compatible (${new URL(baseUrl).host})`,
    model,
    available: Boolean(apiKey),
  };
}

/** Danh sách provider theo thứ tự ưu tiên. */
export function getConfiguredProviders(): ProviderInfo[] {
  const providers = [getPrimaryProviderInfo(), getSecondaryProviderInfo()];
  return providers.filter((provider) => provider.available);
}

// ===== Phân loại lỗi: provider khác có đáng thử không? =====
export type AiFailureKind =
  | 'quota'          // 429 quota cạn — đáng thử provider khác
  | 'rate_limit'     // 429 rate limit tạm thời — đáng thử provider khác
  | 'overloaded'     // 500/502/503/504 — đáng thử
  | 'timeout'        // timeout/abort — đáng thử
  | 'auth'           // 401/403 key sai — đáng thử provider khác (key này hỏng)
  | 'input'          // 400/422 lỗi dữ liệu đầu vào — KHÔNG fallback
  | 'invalid_response' // JSON/schema hỏng — KHÔNG fallback (provider khác cũng khó hơn)
  | 'unknown';

export function getAiErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Phân loại lỗi AI để quyết định fallback. KHÔNG fallback lỗi dữ liệu/validation. */
export function classifyAiFailure(error: unknown): AiFailureKind {
  const status = getAiErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error || '');
  if (error instanceof GeminiQuotaExhaustedError) return 'quota';
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
    // quota cạn hoặc rate limit — đều đáng thử provider khác
    return classify429ErrorKind(message) === 'quota_exhausted' ? 'quota' : 'rate_limit';
  }
  if (status !== undefined && [500, 502, 503, 504].includes(status)) return 'overloaded';
  if (status === 401 || status === 403) return 'auth';
  if (status === 408 || /timeout|timed out|aborterror|etimedout|socket hang up/i.test(message)) return 'timeout';
  if (status === 400 || status === 422) return 'input';
  if (/json|không đúng định dạng|unexpected token/i.test(message)) return 'invalid_response';
  return 'unknown';
}

/** Các lỗi đáng thử provider khác. */
const FALLBACK_ABLE: AiFailureKind[] = ['quota', 'rate_limit', 'overloaded', 'timeout', 'auth', 'unknown'];

export function isFallbackAble(kind: AiFailureKind): boolean {
  return FALLBACK_ABLE.includes(kind);
}

// ===== Gọi từng provider =====

/** Gọi Gemini qua key manager hiện có (dự phòng nhiều key cho lỗi tạm thời). */
async function callGemini(options: AiGenerateOptions): Promise<AiGenerateJsonResult> {
  const manager = getGeminiKeyManager();
  if (!manager) throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim() || 'gemini-3.5-flash';
  const abortSignal = options.abortSignal;

  const params = {
    contents: options.prompt,
    config: {
      responseMimeType: options.config?.responseMimeType,
      temperature: options.config?.temperature,
      maxOutputTokens: options.config?.maxOutputTokens,
      abortSignal,
    },
  };

  let attemptKeyIndex = 0;
  const maxKeyAttempts = manager.count;
  while (attemptKeyIndex < maxKeyAttempts) {
    const entry = manager.selectKey();
    if (!entry) {
      if (attemptKeyIndex === 0) throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
      throw new GeminiQuotaExhaustedError();
    }
    const ai = getGeminiClientForKey(entry.apiKey);
    if (!ai) throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
    attemptKeyIndex += 1;

    const callAttempt = (model: string) =>
      ai.models.generateContent({
        ...params,
        model,
        config: { ...params.config, abortSignal },
      });

    try {
      const response = await withTransientRetry(() => callAttempt(primaryModel));
      manager.markActive(entry.envName);
      if (!response.text) throw new Error('Gemini trả về nội dung rỗng.');
      return { text: response.text, provider: 'gemini', providerDisplayName: 'Gemini', model: primaryModel };
    } catch (error) {
      const status = getAiErrorStatus(error);
      const message = error instanceof Error ? error.message : String(error);

      if (abortSignal?.aborted) {
        throw new Error('Yêu cầu AI đã bị hủy do quá thời gian chờ.');
      }

      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
        const kind = classify429ErrorKind(message);
        if (kind === 'quota_exhausted') {
          manager.markQuotaExhausted(entry.envName);
          console.warn(`[AI Provider] Gemini key "${entry.envName}" quota exhausted; skipping this key.`);
          const otherAvailable = manager.getStatus().find((state) => state.state === 'active');
          if (otherAvailable) continue;
          throw new GeminiQuotaExhaustedError();
        }
        manager.markRateLimited(entry.envName, 15_000);
        console.warn(`[AI Provider] Gemini key "${entry.envName}" rate limited; trying after delay.`);
        continue;
      }

      const transient = status !== undefined && [408, 500, 502, 503, 504].includes(status);
      if (transient || status === undefined) {
        manager.markTransientError(entry.envName, 5_000);
        console.warn(`[AI Provider] Gemini key "${entry.envName}" transient failure (HTTP ${status ?? 'unknown'}).`);
        continue;
      }

      if (status === 401 || status === 403) {
        manager.markInvalid(entry.envName);
        console.warn(`[AI Provider] Gemini key "${entry.envName}" rejected (HTTP ${status}).`);
        continue;
      }

      if (status === 404 || /model.*(not found|unavailable|unknown)/i.test(message)) {
        if (fallbackModel !== primaryModel) {
          try {
            const response = await withTransientRetry(() => callAttempt(fallbackModel));
            manager.markActive(entry.envName);
            if (!response.text) throw new Error('Gemini trả về nội dung rỗng.');
            return { text: response.text, provider: 'gemini', providerDisplayName: 'Gemini', model: fallbackModel };
          } catch (fallbackError) {
            const fbStatus = getAiErrorStatus(fallbackError);
            const fbTransient = fbStatus !== undefined && [408, 500, 502, 503, 504].includes(fbStatus);
            if (!fbTransient) throw fallbackError;
            manager.markTransientError(entry.envName, 5_000);
            continue;
          }
        }
        manager.markTransientError(entry.envName, 5_000);
        continue;
      }

      throw error; // 400/422 — không retry
    }
  }
  throw new GeminiQuotaExhaustedError();
}

/** Bounded retry cho lỗi tạm thời (503/timeout) — 429 KHÔNG retry ở đây. */
async function withTransientRetry<T>(call: () => Promise<T>): Promise<T> {
  const maxRetries = 2;
  const initialDelayMs = 1000;
  const maxDelayMs = 8000;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      const status = getAiErrorStatus(error);
      if (status === 429) throw error;
      const transient = status !== undefined && [408, 500, 502, 503, 504].includes(status);
      if (!transient || attempt >= maxRetries) throw error;
      const backoffMs = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}

/**
 * Ước lượng số token (≈4 ký tự/token cho mix Việt/Anh — an toàn khi cắt sớm).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Giới hạn TPM của provider phụ (Groq free tier model gpt-oss-120b = 8000 TPM).
 * Có thể override bằng OPENAI_TPM_LIMIT. Prompt vượt giới hạn sẽ được cắt gọn
 * tự động (giữ đầu prompt — phần chỉ dẫn — và cắt phần ngữ cảnh dài ở cuối).
 */
const OPENAI_TPM_LIMIT = Number(process.env.OPENAI_TPM_LIMIT) || 8000;
/** Ngưỡng cắt gọn prompt: chừa chỗ cho system prompt + output tokens. */
function maxPromptChars(): number {
  const maxOutputTokens = 4000;
  const budgetTokens = Math.max(1000, OPENAI_TPM_LIMIT - maxOutputTokens - 600);
  return budgetTokens * 4;
}

/** Cắt gọn prompt: giữ phần chỉ dẫn (đầu), cắt phần ngữ cảnh (cuối) tới khi đủ. */
function truncatePromptForTpm(prompt: string, maxChars: number): { text: string; truncated: boolean } {
  if (prompt.length <= maxChars) return { text: prompt, truncated: false };
  // Cắt tại ranh giới câu/đoạn gần maxChars để không đứt giữa JSON mẫu.
  const cut = prompt.lastIndexOf('\n\n', maxChars);
  const slice = cut > maxChars * 0.5 ? prompt.slice(0, cut) : prompt.slice(0, maxChars);
  return {
    text: `${slice}\n\n[LƯU Ý: Phần ngữ cảnh nguồn đã được cắt gọn do giới hạn tokens của provider. Chỉ dùng những gì còn lại; nếu không đủ căn cứ, ghi rõ trong kết quả.]`,
    truncated: true,
  };
}

/** Gọi OpenAI-compatible (chat completions, JSON mode). */
async function callOpenAiCompatible(options: AiGenerateOptions): Promise<AiGenerateJsonResult> {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Chưa cấu hình OPENAI_API_KEY cho provider phụ.');
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_HTTP_TIMEOUT_MS);
  if (options.abortSignal) {
    options.abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  // Tự cắt gọn prompt trước TPM limit — tránh HTTP 413 từ provider free tier.
  const { text: prompt, truncated } = truncatePromptForTpm(options.prompt, maxPromptChars());
  if (truncated) {
    console.info('[AI Provider] Prompt vượt TPM limit — đã cắt gọn ngữ cảnh nguồn.', {
      step: options.step,
      originalChars: options.prompt.length,
      maxChars: maxPromptChars(),
      tpmLimit: OPENAI_TPM_LIMIT,
    });
  }

  const makeRequestBody = (useJsonMode: boolean) => ({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Bạn là trợ lý tạo nội dung giáo dục. Trả về DUY NHẤT một JSON object hợp lệ theo yêu cầu, không thêm giải thích.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: options.config?.temperature ?? 0.2,
    max_tokens: Math.min(options.config?.maxOutputTokens ?? 4096, 4000),
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  const parseOpenAiResponse = async (response: Response): Promise<AiGenerateJsonResult> => {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI-compatible provider trả về nội dung rỗng.');
    }

    const cleaned = content.trim();
    const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const normalized = fenced ? fenced[1].trim() : cleaned;

    try {
      JSON.parse(normalized);
    } catch {
      throw new Error('OpenAI-compatible provider trả về nội dung không phải JSON hợp lệ.');
    }

    return { text: normalized, provider: 'openai-compatible', providerDisplayName: `OpenAI-compatible (${new URL(baseUrl).host})`, model };
  };

  const attemptRequest = async (useJsonMode: boolean): Promise<AiGenerateJsonResult> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(makeRequestBody(useJsonMode)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const parsedBody = (() => {
        try {
          return JSON.parse(bodyText);
        } catch {
          return null;
        }
      })();
      const errorMessage = parsedBody?.error?.message || bodyText || `HTTP ${response.status}`;
      const unsupportedJsonMode = response.status === 400 && /response_format|json_object|json_schema|structured output|not supported|unsupported/i.test(errorMessage);

      if (unsupportedJsonMode && useJsonMode) {
        console.warn('[AI Provider] OpenAI-compatible provider không hỗ trợ JSON mode; thử lại mà không gửi response_format.', {
          step: options.step,
          provider: model,
        });
        return attemptRequest(false);
      }

      const error = new Error(`OpenAI-compatible provider HTTP ${response.status}: ${errorMessage.slice(0, 200)}`);
      (error as { status?: number }).status = response.status;
      throw error;
    }

    return parseOpenAiResponse(response);
  };

  try {
    return await attemptRequest(true);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gọi AI với fallback provider:
 * 1. Gemini (chính) → nếu lỗi fallback-able →
 * 2. OpenAI-compatible (phụ, nếu cấu hình).
 *
 * Lỗi dữ liệu đầu vào (400/422), JSON/schema hỏng, thiếu căn cứ nguồn:
 * KHÔNG fallback — throw trực tiếp với thông tin provider gây lỗi.
 */
export async function generateAiContent(options: AiGenerateOptions): Promise<AiGenerateJsonResult> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new GeminiQuotaExhaustedError(
      'Không có provider AI nào khả dụng. Cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY trên máy chủ.'
    );
  }

  const errors: Array<{ provider: string; kind: AiFailureKind; message: string }> = [];
  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index];
    const startedAt = Date.now();
    try {
      const result =
        provider.id === 'gemini'
          ? await callGemini(options)
          : await callOpenAiCompatible(options);
      recordAiCall({ step: options.step, provider: result.provider, model: result.model, ok: true, durationMs: Date.now() - startedAt });
      if (index > 0) {
        console.info(`[AI Provider] Fallback thành công: bước "${options.step || 'unknown'}" do ${result.providerDisplayName} (${result.model}) xử lý.`);
      }
      return result;
    } catch (error) {
      const kind = classifyAiFailure(error);
      const message = error instanceof Error ? error.message : String(error);
      recordAiCall({ step: options.step, provider: provider.id, model: provider.model, ok: false, durationMs: Date.now() - startedAt });
      errors.push({ provider: provider.displayName, kind, message });
      console.warn(`[AI Provider] Provider ${provider.displayName} (${provider.model}) thất bại bước "${options.step || 'unknown'}": kind=${kind}, ${message.slice(0, 150)}`);
      // Lỗi không đáng thử provider khác → throw ngay, giữ nguyên loại lỗi.
      if (!isFallbackAble(kind)) {
        throw error;
      }
      // Provider cuối cùng → throw lỗi tổng hợp có cấu trúc.
      if (index === providers.length - 1) {
        const allQuota = errors.every((entry) => entry.kind === 'quota' || entry.kind === 'rate_limit');
        if (allQuota) {
          throw new GeminiQuotaExhaustedError(
            'Tất cả provider AI đều hết hạn mức hoặc đang giới hạn yêu cầu. Vui lòng chờ quota được làm mới hoặc cấu hình thêm provider phụ (OPENAI_API_KEY).'
          );
        }
        const lastError = error instanceof Error ? error : new Error(message);
        throw lastError;
      }
    }
  }
  throw new GeminiQuotaExhaustedError('Không có provider AI nào phản hồi thành công.');
}

/** Số provider khả dụng (health check, không log key). */
export function getProviderCount(): number {
  return getConfiguredProviders().length;
}

/** Thông tin provider cho health check — KHÔNG chứa key. */
export function getProviderHealth(): Array<{ id: AiProviderId; displayName: string; model: string; available: boolean }> {
  return [getPrimaryProviderInfo(), getSecondaryProviderInfo()].map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    model: provider.model,
    available: provider.available,
  }));
}

export { resetGeminiKeyManager };

/** Tên provider an toàn để log — không chứa key. */
export function getProviderDisplayName(): string {
  const providers = getConfiguredProviders();
  return providers.map((provider) => `${provider.displayName} (${provider.model})`).join(' → ') || 'không có provider AI';
}
