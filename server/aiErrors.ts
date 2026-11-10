/**
 * Phân loại lỗi AI có cấu trúc để trả về frontend.
 * Không chứa thông tin nhạy cảm (API key, nội dung prompt).
 */
import { getGeminiErrorStatus } from './geminiClient';
import { GeminiQuotaExhaustedError } from './geminiKeyManager';

/**
 * Thời hạn an toàn cho từng bước AI: lớn hơn frontend 120s để backend tự trả
 * lỗi có cấu trúc trước khi frontend abort.
 */
export const AI_STEP_TIMEOUT_MS = Number(process.env.AI_STEP_TIMEOUT_MS) || 95_000;

export type AiErrorType =
  | 'timeout'        // hết thời gian chờ (Gemini treo, fetch web treo, AbortController)
  | 'quota'          // HTTP 429 — hết hạn mức, không retry
  | 'overloaded'     // HTTP 500/502/503/504 — dịch vụ quá tải / sự cố tạm thời
  | 'auth'           // HTTP 401/403 — API key sai hoặc thiếu quyền
  | 'config'         // model không tồn tại / thiếu GEMINI_API_KEY
  | 'invalid_response' // Gemini trả JSON hỏng / payload sai schema
  | 'scope'          // không đủ căn cứ nguồn (không phải lỗi hệ thống)
  | 'generic';

export interface StructuredAiError {
  status: number;
  error_type: AiErrorType;
  message: string;
}

export interface TimeoutHandle<T = unknown> {
  promise: Promise<T>;
  /** Controller bị hủy khi hết thời gian chờ — dùng làm abortSignal cho Gemini. */
  abortController: AbortController;
}

/**
 * withTimeout trả về cả AbortController để caller có thể truyền abortSignal vào
 * SDK Gemini — đảm bảo request HTTP THỰC SỰ bị hủy khi hết thời gian chờ,
 * thay vì chỉ race promise và bỏ request treo ngầm.
 */
export function createWithTimeoutHandle<T>(
  factory: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): TimeoutHandle<T> {
  const abortController = new AbortController();
  const promise = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      abortController.abort();
      reject(new Error(`${label} quá thời gian chờ ${Math.round(timeoutMs / 1000)} giây.`));
    }, timeoutMs);
    factory(abortController.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
  return { promise, abortController };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} quá thời gian chờ ${Math.round(timeoutMs / 1000)} giây.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Gọi Gemini có timeout THỰC SỰ: tạo AbortController, khi hết thời gian thì hủy
 * request HTTP (SDK truyền signal vào fetch) — không còn request treo ngầm.
 * Dùng thay vì withTimeout(generateGeminiContent(...)) chỉ race promise.
 */
export async function withGeminiTimeout<T>(
  factory: (abortSignal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return createWithTimeoutHandle(factory, timeoutMs, label).promise;
}

const TIMEOUT_PATTERN = /quá thời gian chờ|timeout|timed out|aborted|aborterror|etimedout|econnaborted|socket hang up/i;
const SCOPE_PATTERN = /căn cứ|nguồn|kiểm định|xác minh|trích dẫn|phạm vi/i;
const INVALID_JSON_PATTERN = /json|không đúng định dạng|unexpected token|sai cấu trúc/i;

export function classifyAiError(error: unknown, fallbackMessage: string): StructuredAiError {
  const rawMessage = error instanceof Error ? error.message : String(error || fallbackMessage);
  const message = rawMessage || fallbackMessage;
  const status = getGeminiErrorStatus(error);

  if (error instanceof GeminiQuotaExhaustedError) {
    return {
      status: 429,
      error_type: 'quota',
      message: error.message,
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
    return {
      status: 429,
      error_type: 'quota',
      message: 'Gemini đã hết hạn mức hoặc đang giới hạn yêu cầu (HTTP 429). Vui lòng chờ quota được làm mới; đây không phải lỗi API Key.',
    };
  }
  if (status !== undefined && [500, 502, 503, 504].includes(status)) {
    return {
      status: 503,
      error_type: 'overloaded',
      message: `Dịch vụ Gemini tạm thời không khả dụng (HTTP ${status}). Vui lòng thử lại sau ít phút.`,
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 503,
      error_type: 'auth',
      message: 'Gemini từ chối xác thực hoặc quyền truy cập (HTTP 401/403). Kiểm tra GEMINI_API_KEY và quyền trong dự án Google Cloud.',
    };
  }
  if (status === 404 || /model.*(not found|unavailable|unknown)/i.test(message)) {
    return {
      status: 503,
      error_type: 'config',
      message: `Model Gemini đang cấu hình không khả dụng${status ? ` (HTTP ${status})` : ''}. Kiểm tra tên GEMINI_MODEL trong môi trường backend.`,
    };
  }
  if (/GEMINI_API_KEY/i.test(message)) {
    return {
      status: 503,
      error_type: 'config',
      message: 'Máy chủ chưa cấu hình GEMINI_API_KEY. Hãy thêm khóa vào môi trường backend rồi khởi động lại.',
    };
  }
  if (TIMEOUT_PATTERN.test(message)) {
    return {
      status: 504,
      error_type: 'timeout',
      message: `${message} Yêu cầu AI không hoàn thành trong thời gian cho phép; không tự động thử lại vô hạn. Vui lòng thử lại.`,
    };
  }
  if (INVALID_JSON_PATTERN.test(message) && /AI|Gemini|phân tích|tổng hợp/i.test(message)) {
    return {
      status: 502,
      error_type: 'invalid_response',
      message: `AI trả về kết quả không đúng định dạng. Vui lòng thử lại. (${message.slice(0, 200)})`,
    };
  }
  if (SCOPE_PATTERN.test(message)) {
    return {
      status: 422,
      error_type: 'scope',
      message,
    };
  }
  return {
    status: 500,
    error_type: 'generic',
    message: message || fallbackMessage,
  };
}
