import {
  DocumentSource,
  QuizSet,
  Question,
  ExamMatrix,
  DifficultyLevel,
  ExamPaperConfig,
  SampleDocument,
} from '../types';
import { apiFetch } from './http';

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getApiErrorMessage(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;

  for (const value of [data.error, data.detail, data.message]) {
    if (typeof value === 'string' && value.trim()) return value;
    if (isRecord(value)) {
      for (const message of [value.message, value.detail]) {
        if (typeof message === 'string' && message.trim()) return message;
      }
    }
  }

  return undefined;
}

const inFlightPostRequests = new Map<string, Promise<unknown>>();

function postAiJson<T>(endpoint: string, body: unknown): Promise<T> {
  const key = `node:${endpoint}:${JSON.stringify(body)}`;
  const existing = inFlightPostRequests.get(key);
  if (existing) {
    // Dedup: đã có request giống hệt đang chạy — không gửi lại (tránh gọi API trùng lặp).
    console.info('[AI Research API] dedup in-flight request', { endpoint });
    return existing as Promise<T>;
  }
  const request = sendAiJson<T>(endpoint, body);
  inFlightPostRequests.set(key, request);
  void request.finally(() => {
    if (inFlightPostRequests.get(key) === request) inFlightPostRequests.delete(key);
  }).catch(() => undefined);
  return request;
}

async function sendAiJson<T>(endpoint: string, body: unknown): Promise<T> {
  console.info('[AI Research API] request', { endpoint, method: 'POST', body });
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    console.error('[AI Research API] network error', { endpoint, method: 'POST', error });
    if (controller.signal.aborted) {
      throw new Error(`API ${endpoint} quá thời gian chờ 120 giây. Backend vẫn có thể đang xử lý; vui lòng kiểm tra log máy chủ.`);
    }
    throw new Error(`Không kết nối được ${endpoint}. Kiểm tra backend đang chạy rồi thử lại.`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  console.info('[AI Research API] response', {
    endpoint,
    method: 'POST',
    status: response.status,
    body: responseText,
  });

  let data: unknown;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    console.error('[AI Research API] invalid JSON response', { endpoint, status: response.status, error });
    throw new Error(`API ${endpoint} trả về dữ liệu không phải JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const errorType = isRecord(data) && typeof data.error_type === 'string' ? data.error_type : undefined;
    const message = getApiErrorMessage(data) || `API ${endpoint} lỗi HTTP ${response.status}.`;
    const suffix = errorType === 'quota'
      ? ' (Hết hạn mức AI — chờ quota làm mới rồi thử lại.)'
      : errorType === 'overloaded'
        ? ' (AI quá tải hoặc sự cố tạm thời — thử lại sau ít phút.)'
        : errorType === 'auth' || errorType === 'config'
          ? ' (Lỗi cấu hình AI trên máy chủ.)'
          : errorType === 'timeout'
            ? ' (AI không phản hồi kịp — thử lại.)'
            : '';
    throw new Error(message + suffix);
  }
  return data as T;
}

function postDjangoJson<T>(endpoint: string, body: unknown): Promise<T> {
  const key = `django:${endpoint}:${JSON.stringify(body)}`;
  const existing = inFlightPostRequests.get(key);
  if (existing) return existing as Promise<T>;
  const request = sendDjangoJson<T>(endpoint, body);
  inFlightPostRequests.set(key, request);
  void request.finally(() => {
    if (inFlightPostRequests.get(key) === request) inFlightPostRequests.delete(key);
  }).catch(() => undefined);
  return request;
}

async function sendDjangoJson<T>(endpoint: string, body: unknown): Promise<T> {
  console.info('[AI Research API] request', { endpoint: `Django ${endpoint}`, method: 'POST', body });
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    response = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    console.error('[AI Research API] Django network error', { endpoint, method: 'POST', error });
    if (controller.signal.aborted) throw new Error(`Django API ${endpoint} quá thời gian chờ 120 giây.`);
    throw new Error(`Không thể kết nối Django API ${endpoint}.`);
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await response.text();
  console.info('[AI Research API] Django response', {
    endpoint,
    method: 'POST',
    status: response.status,
    body: responseText,
  });
  let data: unknown;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    console.error('[AI Research API] invalid Django JSON response', { endpoint, status: response.status, error });
    throw new Error(`Django API ${endpoint} trả về dữ liệu không phải JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = isRecord(data) ? data.error || data.detail || data.message : undefined;
    throw new Error(typeof message === 'string' ? message : `Django API ${endpoint} lỗi HTTP ${response.status}.`);
  }
  return data as T;
}

/**
 * Extracts clean Vietnamese text safely from DOCX, PDF, or TXT file via backend
 */
export async function extractDocumentApi(file: File): Promise<{
  text: string;
  pageCount: number;
  fileType: 'pdf' | 'docx' | 'txt';
  extractionStatus: 'success' | 'failed';
  errorMessage?: string;
}> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'docx', 'txt'].includes(extension || '')) {
    throw new Error('Chỉ hỗ trợ tệp PDF, Word DOCX hoặc TXT.');
  }
  if (file.size === 0) {
    throw new Error('Tệp tải lên đang rỗng.');
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('Tệp vượt quá giới hạn 50 MB. Vui lòng tải tệp nhỏ hơn.');
  }
  const fileType = extension as 'pdf' | 'docx' | 'txt';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Không thể đọc tập tin từ thiết bị.'));
    };

    reader.onload = async () => {
      try {
        const fileBase64 = reader.result as string;
        let res: Response;
        try {
          res = await fetch('/api/documents/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64, fileName: file.name, fileType }),
          });
        } catch {
          throw new Error(
            'Không kết nối được API tại localhost:3000. Hãy khởi động máy chủ AI bằng: npm run backend:dev'
          );
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.errorMessage || `Máy chủ phản hồi mã lỗi ${res.status}`);
        }

        const data = await res.json();
        resolve(data);
      } catch (err: any) {
        reject(err);
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Processes clean text to extract structure, chapters, and knowledge units
 */
export async function processDocumentApi(
  text: string,
  fileName: string = 'TaiLieu.pdf',
  fileType: 'pdf' | 'docx' | 'txt' = 'pdf',
  fileSize: string = '2.4 MB'
): Promise<DocumentSource> {
  const res = await fetch('/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fileName, fileType, fileSize }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi xử lý tài liệu (${res.status})`);
  }

  return await res.json();
}

export interface ResearchRequestAnalysis {
  subject: string;
  topic: string;
  education_level?: string;
  focus_areas: string[];
  scope_mode: 'explicit' | 'inferred';
  question_count: number;
  question_count_source: 'requirements' | 'selector';
  difficulty: 'easy' | 'medium' | 'hard';
  difficulty_profile: 'foundational' | 'balanced' | 'progressive';
  question_type: string;
  include_explanations: boolean;
  scope_notes: string[];
  search_queries: string[];
}

export async function parseAiRequestApi(
  prompt: string,
  questionCount: number,
  difficulty: DifficultyLevel
): Promise<ResearchRequestAnalysis> {
  const response = await postAiJson<unknown>('/api/ai/parse-request', { prompt, questionCount, difficulty });
  if (!isRecord(response)) throw new Error('API phân tích yêu cầu trả response không đúng cấu trúc.');
  const topic = typeof response.topic === 'string' && response.topic.trim() ? response.topic.trim() : prompt.trim();
  const normalizedPrompt = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const legacyAreas = Array.isArray(response.focus_areas)
    ? response.focus_areas
    : Array.isArray(response.knowledge_areas)
      ? response.knowledge_areas
      : [];
  const focusAreas = legacyAreas
    .map(String)
    .map((area: string) => area.trim())
    .filter((area: string) => area && !/(bam sat|ly thuyet co ban|nhan biet|thong hieu|nang cao|phu hop)/.test(area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')))
    .slice(0, 8);
  if (focusAreas.length === 0) focusAreas.push(topic || 'Chủ đề được yêu cầu');
  const count = Number(response.question_count);
  const explicitCount = /\d+\s*(câu|cau|question|questions)/i.test(prompt);
  const foundational = /(ly thuyet co ban|kien thuc co ban|muc do co ban|nhan biet.{0,20}thong hieu|khong.{0,20}nang cao)/.test(normalizedPrompt);
  const inferredLevel = /sinh hoc.{0,12}(12|lop 12)|lop 12/.test(normalizedPrompt)
    ? 'Học sinh lớp 12'
    : /toan roi rac|sinh vien|dai hoc/.test(normalizedPrompt)
      ? 'Sinh viên trình độ nhập môn'
      : 'Trình độ nhập môn';
  const responseDifficulty = response.difficulty;
  return {
    subject: typeof response.subject === 'string'
      ? response.subject
      : /sinh hoc.{0,12}12|lop 12/.test(normalizedPrompt)
        ? 'Sinh học 12'
        : /toan roi rac/.test(normalizedPrompt)
          ? 'Toán rời rạc'
          : topic,
    topic,
    education_level: typeof response.education_level === 'string' && response.education_level.trim()
      ? response.education_level
      : inferredLevel,
    focus_areas: focusAreas,
    scope_mode: response.scope_mode === 'explicit' || Array.isArray(response.focus_areas) ? 'explicit' : 'inferred',
    question_count: Number.isInteger(count) ? Math.max(1, Math.min(50, count)) : Math.max(1, Math.min(50, questionCount)),
    question_count_source: explicitCount || response.question_count_source === 'requirements' ? 'requirements' : 'selector',
    difficulty: responseDifficulty === 'easy' || responseDifficulty === 'hard'
      ? responseDifficulty
      : difficulty === 'easy' || difficulty === 'hard'
        ? difficulty
        : 'medium',
    difficulty_profile: foundational || difficulty === 'easy'
      ? 'foundational'
      : response.difficulty_profile === 'foundational' || response.difficulty_profile === 'progressive'
      ? response.difficulty_profile
      : 'balanced',
    question_type: typeof response.question_type === 'string' ? response.question_type : 'multiple_choice',
    include_explanations: response.include_explanations !== false,
    scope_notes: Array.isArray(response.scope_notes) ? response.scope_notes.map(String) : [],
    search_queries: Array.isArray(response.search_queries) ? response.search_queries.map(String) : focusAreas,
  };
}

export async function researchTopicApi(params: {
  topic: string;
  requirements: string;
  focus_areas: string[];
  search_queries: string[];
}): Promise<{
  research_id: string;
  research_session_id: number;
  topic: string;
  retrieved_at: string;
  sources: {
    title: string;
    url: string;
    domain: string;
    source_type: string;
    summary: string;
    content: string;
  }[];
  knowledge_units: Array<{
    name: string;
    summary: string;
    category?: string;
    focus_area: string;
    source_title: string;
    source_url: string;
    source_excerpt: string;
  }>;
  unresolved_areas: string[];
}> {
  const response = await postAiJson<unknown>('/api/ai/research', params);
  if (!isRecord(response)) throw new Error('API research trả response không đúng cấu trúc.');
  const sources = Array.isArray(response.sources) ? response.sources.filter(isRecord) : [];
  const knowledgeUnits = Array.isArray(response.knowledge_units) ? response.knowledge_units.filter(isRecord) : [];
  const unresolvedAreas = Array.isArray(response.unresolved_areas)
    ? response.unresolved_areas.map(String)
    : [];
  if (unresolvedAreas.length > 0) {
    throw new Error(`Sau khi tìm bổ sung, vẫn chưa xác minh đủ nguồn cho phạm vi: ${unresolvedAreas.join(', ')}. Không thể tạo đề cho đến khi mọi phạm vi được xác minh.`);
  }
  if (typeof response.research_id !== 'string' || sources.length === 0 || knowledgeUnits.length === 0) {
    throw new Error('API research thiếu research_id, sources hoặc knowledge_units.');
  }
  const verifiedAreas = new Set(knowledgeUnits.map((unit) => String(unit.focus_area || '').trim().toLocaleLowerCase()));
  const missingRequestedAreas = params.focus_areas.filter((area) => !verifiedAreas.has(area.trim().toLocaleLowerCase()));
  if (missingRequestedAreas.length > 0) {
    throw new Error(`Nghiên cứu chưa xác minh đủ nguồn cho phạm vi: ${missingRequestedAreas.join(', ')}. Không thể tạo đề.`);
  }
  const research = {
    research_id: response.research_id,
    topic: typeof response.topic === 'string' ? response.topic : params.topic,
    retrieved_at: typeof response.retrieved_at === 'string' ? response.retrieved_at : new Date().toISOString(),
    sources: sources.map((source) => ({
      title: String(source.title || ''),
      url: String(source.url || ''),
      domain: String(source.domain || ''),
      source_type: String(source.source_type || ''),
      summary: String(source.summary || ''),
      content: String(source.content || ''),
    })),
    knowledge_units: knowledgeUnits.map((unit) => ({
      name: String(unit.name || ''),
      summary: String(unit.summary || ''),
      category: String(unit.category || 'core'),
      focus_area: String(unit.focus_area || ''),
      source_title: String(unit.source_title || ''),
      source_url: String(unit.source_url || ''),
      source_excerpt: String(unit.source_excerpt || ''),
    })),
    unresolved_areas: unresolvedAreas,
  };
  const persistBody = {
      topic: research.topic,
      prompt: params.requirements,
      sources: research.sources,
      knowledge_units: research.knowledge_units,
  };
  const persisted = await postDjangoJson<{ research_session_id: number; status: string }>('/ai/research/', persistBody);
  if (!isRecord(persisted) || persisted.status !== 'COMPLETED' || !Number.isInteger(persisted.research_session_id)) {
    throw new Error('Không thể lưu phiên nghiên cứu và nguồn tham khảo vào cơ sở dữ liệu.');
  }
  return { ...research, research_session_id: persisted.research_session_id };
}

export async function persistResearchQuizApi(params: {
  researchSessionId: number;
  title: string;
  requirements: string;
  duration: number;
  questions: Question[];
}): Promise<{ id: number; title: string; question_count: number }> {
  const response = await postDjangoJson<unknown>('/ai/research/save-quiz/', {
      research_session_id: params.researchSessionId,
      title: params.title,
      description: params.requirements,
      duration: params.duration,
      questions: params.questions,
  });
  if (!isRecord(response) || !Number.isInteger(response.id) || typeof response.title !== 'string' || !Number.isInteger(response.question_count)) {
    throw new Error('Django lưu quiz nhưng trả response không đúng cấu trúc mong đợi.');
  }
  return response as { id: number; title: string; question_count: number };
}

export async function generateFromTextApi(params: {
  text: string;
  instruction: string;
  config?: Record<string, any>;
}): Promise<{
  parsed: any;
  sourceMode: 'DOCUMENT' | 'WEB';
  document: DocumentSource;
  matrix: ExamMatrix;
  questions: Question[];
  validationSummary: {
    totalQuestions: number;
    validCount: number;
    needsReviewCount: number;
    allValid: boolean;
  };
}> {
  const res = await fetch('/api/ai/generate-from-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData: unknown = await res.json().catch(() => ({}));
    throw new Error(getApiErrorMessage(errData) || `Lỗi tạo đề từ nội dung (HTTP ${res.status})`);
  }

  const response: unknown = await res.json();
  if (!isRecord(response) || !isRecord(response.document) || !isRecord(response.validationSummary)) {
    throw new Error('API tạo đề từ tài liệu trả về dữ liệu không hợp lệ.');
  }
  const questions = Array.isArray(response.questions) ? response.questions : [];
  const expectedCount = Number(params.config?.question_count);
  if (!Number.isInteger(expectedCount) || questions.length !== expectedCount) {
    throw new Error(`API tạo đề từ tài liệu trả ${questions.length}/${expectedCount || 'không rõ'} câu; từ chối hiển thị kết quả sai số lượng.`);
  }
  if (
    response.sourceMode !== 'DOCUMENT' ||
    response.validationSummary.allValid !== true ||
    Number(response.validationSummary.totalQuestions) !== expectedCount ||
    Number(response.validationSummary.validCount) !== expectedCount
  ) {
    throw new Error('API chưa xác nhận bộ câu hỏi từ tài liệu đạt kiểm định.');
  }
  return response as Awaited<ReturnType<typeof generateFromTextApi>>;
}

export async function generateFromWebApi(params: {
  topic: string;
  instruction: string;
  title: string;
  analysis: ResearchRequestAnalysis;
  research_id: string;
  config?: Record<string, any>;
}): Promise<{
  parsed: any;
  sourceMode: 'DOCUMENT' | 'WEB';
  research: {
  research_id?: string;
    topic: string;
    retrieved_at: string;
    sources: any[];
    knowledge_units: Array<{ name: string; summary: string; category?: string }>;
  };
  document: DocumentSource;
  matrix: ExamMatrix;
  questions: Question[];
  validationSummary: {
    totalQuestions: number;
    validCount: number;
    needsReviewCount: number;
    allValid: boolean;
  };
}> {
  const response = await postAiJson<unknown>('/api/ai/generate-from-web', params);
  if (!isRecord(response) || !isRecord(response.document) || !isRecord(response.research)) {
    throw new Error('API generate-from-web trả response không có document/research hợp lệ.');
  }
  const questions = Array.isArray(response.questions) ? response.questions : [];
  const expectedCount = params.analysis.question_count;
  if (questions.length !== expectedCount) {
    throw new Error(`API generate-from-web trả ${questions.length}/${expectedCount} câu; từ chối hiển thị bộ đề sai số lượng.`);
  }
  if (!isRecord(response.validationSummary) || response.validationSummary.allValid !== true) {
    throw new Error('API generate-from-web chưa xác nhận validationSummary hợp lệ.');
  }
  if (!isRecord(response.matrix) || !Array.isArray(response.research.sources) || !Array.isArray(response.document.chapters) || !Array.isArray(response.document.knowledgeUnits) || typeof response.document.id !== 'string' || typeof response.document.rawText !== 'string') {
    throw new Error('API generate-from-web thiếu danh sách sources, chapters hoặc knowledge units.');
  }
  const normalizedSources = response.research.sources.filter(isRecord);
  if (normalizedSources.length === 0 || questions.some((question) =>
    !isRecord(question) || typeof question.questionText !== 'string' || !Array.isArray(question.options) ||
    !isRecord(question.source) || typeof question.source.sourceText !== 'string' ||
    typeof question.source.sourceUrl !== 'string'
  )) {
    throw new Error('API generate-from-web trả về nguồn hoặc câu hỏi thiếu trường bắt buộc.');
  }
  if (Number(response.validationSummary.totalQuestions) !== expectedCount || Number(response.validationSummary.validCount) !== expectedCount) {
    throw new Error('API generate-from-web trả validationSummary không khớp số câu thực tế.');
  }
  return {
    parsed: isRecord(response.parsed) ? response.parsed : params.analysis,
    sourceMode: response.sourceMode === 'WEB' ? 'WEB' : 'DOCUMENT',
    research: {
      research_id: typeof response.research.research_id === 'string' ? response.research.research_id : params.research_id,
      topic: typeof response.research.topic === 'string' ? response.research.topic : params.topic,
      retrieved_at: typeof response.research.retrieved_at === 'string' ? response.research.retrieved_at : new Date().toISOString(),
      sources: normalizedSources.map((source) => ({
        title: String(source.title || ''),
        url: String(source.url || ''),
        domain: String(source.domain || ''),
        source_type: String(source.source_type || ''),
        summary: String(source.summary || ''),
      })),
      knowledge_units: Array.isArray(response.research.knowledge_units)
        ? response.research.knowledge_units.filter(isRecord).map((unit) => ({ name: String(unit.name || ''), summary: String(unit.summary || '') }))
        : [],
    },
    document: response.document as unknown as DocumentSource,
    matrix: response.matrix as ExamMatrix,
    questions: questions as Question[],
    validationSummary: {
      totalQuestions: expectedCount,
      validCount: expectedCount,
      needsReviewCount: 0,
      allValid: true,
    },
  };
}

/**
 * Generates exam with AI based on matrix and strict source mapping
 */
export async function generateExamApi(params: {
  document: DocumentSource;
  numQuestions: number;
  difficulty: DifficultyLevel;
  customMatrix?: ExamMatrix;
  strictSourceOnly?: boolean;
}): Promise<{
  matrix: ExamMatrix;
  questions: Question[];
  validationSummary: {
    totalQuestions: number;
    validCount: number;
    needsReviewCount: number;
    allValid: boolean;
  };
}> {
  const res = await fetch('/api/quizzes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo đề thi (${res.status})`);
  }

  return await res.json();
}

/**
 * Regenerates single question
 */
export async function regenerateQuestionApi(params: {
  document: DocumentSource;
  knowledgeUnitName: string;
  questionNumber: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<Question> {
  const res = await fetch('/api/questions/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo lại câu hỏi (${res.status})`);
  }

  return await res.json();
}

/**
 * Generates practice questions for a missed knowledge unit
 */
export async function generatePracticeQuestionsApi(params: {
  document: DocumentSource;
  knowledgeUnitName: string;
  count?: number;
}): Promise<Question[]> {
  const res = await fetch('/api/questions/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo câu hỏi ôn tập (${res.status})`);
  }

  return await res.json();
}

/**
 * Exports exam as HTML for print preview & PDF printing
 */
export async function exportExamApi(
  quizSet: QuizSet,
  config: ExamPaperConfig
): Promise<string> {
  const res = await fetch('/api/quizzes/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizSet, config }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi xuất bản in đề thi (${res.status})`);
  }

  const data = await res.json();
  return data.html;
}

/**
 * Downloads official Word (.docx) exam paper
 */
export async function exportExamDocxApi(
  quizSet: QuizSet,
  config: ExamPaperConfig
): Promise<void> {
  const res = await fetch('/api/quizzes/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizSet, config }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo tệp Word .docx (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DeThi_${config.examCode || '001'}_${quizSet.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates clean print HTML for documents in Library History
 */
export async function printDocumentApi(
  doc: DocumentSource | SampleDocument,
  uploadDate?: string
): Promise<string> {
  const res = await fetch('/api/documents/print-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: doc, uploadDate }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tạo trang in tài liệu (${res.status})`);
  }

  const data = await res.json();
  return data.html;
}
