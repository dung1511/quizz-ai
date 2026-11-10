import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { processDocument } from './server/documentProcessor';
import {
  generateExamWithAI,
  regenerateSingleQuestion,
  generatePracticeQuestions,
  buildExamMatrix,
} from './server/questionGenerator';
import { generatePaperExamHTML } from './server/exportService';
import { generatePaperExamDOCX } from './server/docxExportService';
import { extractTextFromBuffer, isBinaryZipOrDocx } from './server/documentExtractor';
import { generateDocumentPrintHTML } from './server/documentPrintService';
import { generateGeminiContent, getGeminiClient, getGeminiKeyCount } from './server/geminiClient';
import { generateAiContent, summarizeAiCalls, resetAiCallLog, getProviderHealth, getProviderCount, getProviderDisplayName } from './server/aiProvider';
import { registerDemoRoutes } from './server/demoExams';
import { getGeminiKeyManager } from './server/geminiKeyManager';
import { withTimeout, withGeminiTimeout, classifyAiError, AI_STEP_TIMEOUT_MS } from './server/aiErrors';
import { buildWebResearch } from './server/webResearch';

dotenv.config();

// ===== Log có cấu trúc, an toàn (không log API key, prompt đầy đủ hoặc nội dung tài liệu) =====
function logAiStep(step: string, startedAt: number, extra: Record<string, unknown> = {}) {
  console.info(`[AI Step] ${step} finished`, {
    step,
    durationMs: Date.now() - startedAt,
    ...extra,
  });
}

function logAiStepError(step: string, startedAt: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[AI Step] ${step} failed`, {
    step,
    durationMs: Date.now() - startedAt,
    // Chỉ log loại lỗi + thông báo đã được khử nhạy cảm, không log stack/API key.
    error: message.slice(0, 300),
  });
}

// Thời hạn an toàn cho từng bước: import từ server/aiErrors (AI_STEP_TIMEOUT_MS)
const WEB_FETCH_TIMEOUT_MS = 12_000; // (giữ tương thích; logic fetch đã chuyển sang server/webResearch.ts)

const MAX_DOCUMENT_FILE_BYTES = 50 * 1024 * 1024;
const MIN_DOCUMENT_TEXT_LENGTH = 100;
const pendingResearchResults = new Map<string, { research: Awaited<ReturnType<typeof buildWebResearch>>; expiresAt: number }>();

function normalizeDifficulty(value: string): 'easy' | 'medium' | 'hard' {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('easy') || normalized.includes('dễ')) return 'easy';
  if (normalized.includes('hard') || normalized.includes('khó')) return 'hard';
  return 'medium';
}

function sendAiFailure(
  res: express.Response,
  error: unknown,
  fallbackMessage: string,
  defaultStatus = 503
) {
  const structured = classifyAiError(error, fallbackMessage);
  res.status(structured.status).json({
    error: structured.message,
    error_type: structured.error_type,
  });
}

interface ResearchRequestAnalysis {
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

async function analyzeResearchRequirements(
  requirements: string,
  defaultQuestionCount: number,
  defaultDifficulty: string,
  abortSignal?: AbortSignal
): Promise<ResearchRequestAnalysis> {
  const startedAt = Date.now();
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ. AI nghiên cứu chủ đề hiện chưa khả dụng.');
  }

  const response = await generateAiContent({
    prompt: `Phân tích yêu cầu tạo đề dưới đây thành cấu hình nghiên cứu. Không tạo câu hỏi ở bước này.
Giữ chính xác các chủ điểm và phạm vi người dùng chỉ định; không mở rộng sang chủ đề khác.
Nếu yêu cầu chỉ nêu tên môn/chủ đề rộng (ví dụ "Kiến thức Sinh học 12" hoặc "Toán rời rạc"), hãy tự đề xuất một phạm vi nhập môn hợp lý, cụ thể, tối đa 8 chủ điểm và đánh dấu scope_mode="inferred". Không để focus_areas rỗng.
Nếu yêu cầu đã liệt kê phạm vi thì đánh dấu scope_mode="explicit" và không thêm chủ điểm ngoài danh sách.
Quy tắc số câu: số câu ghi trong nội dung yêu cầu luôn ưu tiên hơn bộ chọn. Chỉ dùng số bộ chọn ${defaultQuestionCount} nếu nội dung không nêu số câu.
Nếu có "lý thuyết cơ bản", "nhận biết/thông hiểu" hoặc "không nâng cao", đặt difficulty_profile="foundational"; trong trường hợp này không tạo câu hard.
Nếu không nêu độ khó, dùng giá trị bộ chọn ${defaultDifficulty}.
Trả về đúng JSON object, không markdown, theo schema:
{
  "subject": "môn học/lĩnh vực",
  "topic": "chủ đề tìm kiếm ngắn gọn, cụ thể",
  "education_level": "cấp học/trình độ hoặc chuỗi rỗng",
  "scope_mode": "explicit | inferred",
  "focus_areas": ["các khái niệm người dùng nêu hoặc phạm vi nhập môn hợp lý đã suy ra"],
  "question_count": ${defaultQuestionCount},
  "question_count_source": "requirements | selector",
  "difficulty": "easy | medium | hard",
  "difficulty_profile": "foundational | balanced | progressive",
  "question_type": "multiple_choice",
  "include_explanations": true,
  "scope_notes": ["ràng buộc quan trọng của người dùng"],
  "search_queries": ["tối đa 5 truy vấn ngắn, mỗi truy vấn tập trung một mảng kiến thức"]
}
Giới hạn question_count trong 1..50, focus_areas tối đa 8 phần tử, search_queries tối đa 5 phần tử.

Ví dụ scope suy luận: Sinh học 12 có thể gồm di truyền, tiến hóa và sinh thái; Toán rời rạc nhập môn có thể gồm logic mệnh đề, tập hợp, quan hệ/hàm, tổ hợp và đồ thị. Chỉ chọn các phần thực sự phù hợp với yêu cầu.

YÊU CẦU NGUYÊN VĂN:
${requirements}`,
    config: { responseMimeType: 'application/json', temperature: 0.1 },
    abortSignal,
    step: 'parse-request',
  });
  logAiStep('parse_request.gemini', startedAt);

  if (!response.text) throw new Error('AI không trả về kết quả phân tích yêu cầu.');
  let parsed: any;
  try {
    parsed = JSON.parse(response.text);
  } catch (error) {
    throw new Error(`AI phân tích yêu cầu trả JSON không hợp lệ: ${error instanceof Error ? error.message.slice(0, 120) : error}`);
  }
  const topic = String(parsed.topic || '').trim();
  if (!topic) throw new Error('AI chưa xác định được chủ đề nghiên cứu từ yêu cầu.');

  const countMatch = requirements.match(/(\d+)\s*(?:câu|cau|questions?)/i);
  const parsedCount = Number(parsed.question_count);
  const countFromAnalysis = parsed.question_count_source === 'requirements' && Number.isInteger(parsedCount);
  const requestedCount = countMatch
    ? Number(countMatch[1])
    : countFromAnalysis
      ? parsedCount
      : defaultQuestionCount;
  const normalizedRequirements = requirements.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    const foundationalRequested = /((ly thuyet|kien thuc|muc do|cau hoi)?\s*co ban|nhan biet.{0,20}thong hieu|khong.{0,20}nang cao|tranh.{0,20}nang cao)/i.test(normalizedRequirements);
  const progressiveRequested = /(tu de den kho|van dung cao|nang cao|thu thach)/i.test(normalizedRequirements);
  const explicitDifficulty = /(d[eễ]|easy|trung binh|medium|kho|hard|co ban|nang cao|advanced|progressive)/i.test(normalizedRequirements);
  const inferredEducationLevel = String(parsed.education_level || '').trim()
    || (/(sinh hoc|toan|vat ly|hoa hoc)\s*(lop\s*)?12/i.test(normalizedRequirements)
      ? 'Học sinh lớp 12'
      : /toan roi rac|sinh vien|dai hoc/i.test(normalizedRequirements)
        ? 'Sinh viên trình độ nhập môn'
        : /lop\s*(10|11|12)/i.test(normalizedRequirements)
          ? `Học sinh lớp ${normalizedRequirements.match(/lop\s*(10|11|12)/i)?.[1]}`
          : 'Trình độ nhập môn');
  const difficulty = foundationalRequested
    ? 'medium'
    : explicitDifficulty && ['easy', 'medium', 'hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : normalizeDifficulty(defaultDifficulty);
  const difficultyProfile = foundationalRequested || defaultDifficulty === 'easy'
    ? 'foundational'
    : progressiveRequested
      ? 'progressive'
      : parsed.difficulty_profile === 'foundational' || parsed.difficulty_profile === 'progressive'
        ? parsed.difficulty_profile
        : 'balanced';
  const focusAreas = Array.isArray(parsed.focus_areas)
    ? parsed.focus_areas.map((area: unknown) => String(area).trim()).filter(Boolean).slice(0, 8)
    : [];
  const searchQueries = Array.isArray(parsed.search_queries)
    ? parsed.search_queries.map((query: unknown) => String(query).trim()).filter(Boolean).slice(0, 5)
    : [];
  if (focusAreas.length === 0) {
    throw new Error('AI chưa xác định được phạm vi kiến thức. Hãy bổ sung môn học hoặc nội dung cần tập trung.');
  }

  logAiStep('parse_request.normalize', startedAt, { topic, focusAreaCount: focusAreas.length });

  return {
    subject: String(parsed.subject || topic).trim(),
    topic,
    education_level: inferredEducationLevel,
    focus_areas: focusAreas,
    scope_mode: parsed.scope_mode === 'explicit' ? 'explicit' : 'inferred',
    question_count: Math.max(1, Math.min(50, requestedCount)),
    question_count_source: countMatch || countFromAnalysis ? 'requirements' : 'selector',
    difficulty,
    difficulty_profile: difficultyProfile,
    question_type: String(parsed.question_type || 'multiple_choice'),
    include_explanations: parsed.include_explanations !== false,
    scope_notes: Array.isArray(parsed.scope_notes)
      ? parsed.scope_notes.map((note: unknown) => String(note).trim()).filter(Boolean).slice(0, 8)
      : [],
    search_queries: searchQueries.length > 0 ? searchQueries : [topic, ...focusAreas].slice(0, 5),
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Base64 expands uploaded files by roughly one third, so the request limit
  // must be higher than the supported source-document size.
  app.use(express.json({ limit: '100mb' }));
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Dữ liệu gửi lên vượt quá giới hạn 100 MB của máy chủ.' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Request body không phải JSON hợp lệ.' });
      return;
    }
    next(err);
  });

  // ==========================================
  // API SPECIFICATION
  // ==========================================

  // Chế độ DEMO: bộ đề mẫu soạn sẵn — KHÔNG gọi AI, luôn khả dụng.
  registerDemoRoutes(app);

  // Health check — chỉ trả về số lượng key cấu hình và trạng thái rút gọn,
  // KHÔNG trả về giá trị key hay trạng thái chi tiết từng key.
  app.get('/api/health', (req, res) => {
    const manager = getGeminiKeyManager();
    const keyStates = manager?.getStatus() || [];
    res.json({
      status: 'ok',
      hasGeminiApiKey: keyStates.length > 0,
      geminiKeyCount: keyStates.length,
      geminiActiveKeyCount: keyStates.filter((s) => s.state === 'active').length,
      aiProviders: getProviderHealth(),
      demoModeAvailable: true,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/documents/extract
  // Safe extraction for DOCX (via mammoth), PDF (via pdf-parse), and TXT
  app.post('/api/documents/extract', async (req, res) => {
    try {
      const { fileBase64, fileName, fileType } = req.body || {};
      if (!fileBase64 || typeof fileBase64 !== 'string') {
        res.status(400).json({ error: 'Missing fileBase64 payload' });
        return;
      }
      if (typeof fileName !== 'string' || !/\.(pdf|docx|txt)$/i.test(fileName)) {
        res.status(400).json({ error: 'Chỉ hỗ trợ tệp PDF, Word DOCX hoặc TXT.' });
        return;
      }
      if (fileType !== undefined && !['pdf', 'docx', 'txt'].includes(fileType)) {
        res.status(400).json({ error: 'Loại tệp không hợp lệ; chỉ hỗ trợ PDF, DOCX hoặc TXT.' });
        return;
      }

      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64) || cleanBase64.length % 4 !== 0) {
        res.status(400).json({ error: 'Dữ liệu tệp không phải Base64 hợp lệ.' });
        return;
      }
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length === 0) {
        res.status(400).json({ error: 'Tệp tải lên đang rỗng.' });
        return;
      }
      if (buffer.length > MAX_DOCUMENT_FILE_BYTES) {
        res.status(413).json({ error: 'Tệp vượt quá giới hạn 50 MB. Vui lòng tải tệp nhỏ hơn.' });
        return;
      }

      const result = await extractTextFromBuffer(
        buffer,
        fileName,
        fileType as 'pdf' | 'docx' | 'txt' | undefined
      );

      if (result.extractionStatus === 'failed') {
        res.status(422).json(result);
        return;
      }
      res.json(result);
    } catch (err: any) {
      console.error('Error extracting document text:', err);
      res.status(422).json({
        extractionStatus: 'failed',
        error: err.message || 'Lỗi khi trích xuất tài liệu',
      });
    }
  });

  // POST /api/documents/print-html
  // Tạo bản in HTML chuyên nghiệp cho tài liệu trong kho
  app.post('/api/documents/print-html', (req, res) => {
    try {
      const { document, uploadDate } = req.body;
      if (!document) {
        res.status(400).json({ error: 'Missing document payload' });
        return;
      }

      const html = generateDocumentPrintHTML(document, { uploadDate });
      res.json({ html });
    } catch (err: any) {
      console.error('Error generating document print HTML:', err);
      res.status(500).json({ error: err.message || 'Failed to generate document print HTML' });
    }
  });

  // POST /api/documents/process
  // Trích xuất cấu trúc tài liệu, chapters, sections, chunks, knowledge units
  app.post('/api/documents/process', async (req, res) => {
    try {
      const { text, fileName, fileType, fileSize } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Missing document text content' });
        return;
      }
      if (text.trim().length < MIN_DOCUMENT_TEXT_LENGTH) {
        res.status(422).json({ error: `Văn bản trích xuất quá ngắn (${text.trim().length} ký tự). Cần ít nhất ${MIN_DOCUMENT_TEXT_LENGTH} ký tự để phân tích cấu trúc.` });
        return;
      }
      if (Buffer.byteLength(text, 'utf8') > MAX_DOCUMENT_FILE_BYTES) {
        res.status(413).json({ error: 'Văn bản tài liệu vượt quá giới hạn 50 MB.' });
        return;
      }

      // Safeguard against raw binary DOCX strings
      if (isBinaryZipOrDocx(text)) {
        res.status(400).json({
          error:
            'Tài liệu nhận được chứa chuỗi nhị phân ZIP/DOCX (PK.../[Content_Types].xml). Vui lòng trích xuất qua endpoint /api/documents/extract trước khi xử lý.',
        });
        return;
      }

      const docSource = await processDocument(
        text,
        fileName || 'TaiLieu.pdf',
        fileType || 'pdf',
        fileSize || '1.8 MB',
        { analyzeWithAI: false }
      );

      res.json(docSource);
    } catch (err: any) {
      console.error('Error processing document:', err);
      res.status(500).json({ error: err.message || 'Failed to process document' });
    }
  });

  // POST /api/ai/parse-request
  // Phân tích yêu cầu tự nhiên của người dùng thành cấu hình tạo đề.
  app.post('/api/ai/parse-request', async (req, res) => {
    const stepStartedAt = Date.now();
    try {
      const { prompt, questionCount = 10, difficulty = 'medium' } = req.body || {};
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Missing prompt' });
        return;
      }

      const parsed = await withGeminiTimeout(
        (abortSignal) =>
          analyzeResearchRequirements(prompt, Number(questionCount) || 10, String(difficulty), abortSignal),
        AI_STEP_TIMEOUT_MS,
        'Phân tích yêu cầu (Gemini)'
      );
      logAiStep('parse_request.endpoint', stepStartedAt);
      res.json(parsed);
    } catch (err: any) {
      logAiStepError('parse_request.endpoint', stepStartedAt, err);
      sendAiFailure(res, err, 'Không thể phân tích yêu cầu nghiên cứu.');
    }
  });

  // POST /api/ai/research
  // Nghiên cứu chủ đề từ nguồn đáng tin cậy và chuẩn hóa thành unit kiến thức.
  app.post('/api/ai/research', async (req, res) => {
    try {
      const { topic, requirements, focus_areas = [], search_queries = [] } = req.body || {};
      if (!topic || typeof topic !== 'string') {
        res.status(400).json({ error: 'Missing topic' });
        return;
      }

      const research = await buildWebResearch(
        topic,
        typeof requirements === 'string' ? requirements : topic,
        Array.isArray(focus_areas) ? focus_areas.map(String) : [],
        Array.isArray(search_queries) ? search_queries.map(String) : []
      );
      if (research.unresolved_areas.length > 0) {
        // buildWebResearch đã tự chặn, nhưng vẫn kiểm tra lần nữa để bảo đảm.
        throw new Error(`Sau khi tìm bổ sung, vẫn chưa xác minh đủ nguồn cho phạm vi: ${research.unresolved_areas.join(', ')}. Không thể tạo đề cho đến khi mọi phạm vi được xác minh.`);
      }
      const now = Date.now();
      for (const [id, item] of pendingResearchResults) {
        if (item.expiresAt <= now) pendingResearchResults.delete(id);
      }
      const researchId = `research-${now}-${Math.random().toString(36).slice(2, 10)}`;
      pendingResearchResults.set(researchId, { research, expiresAt: now + 15 * 60 * 1000 });
      res.json({ ...research, research_id: researchId });
    } catch (err: any) {
      console.error('Error researching topic:', err);
      sendAiFailure(res, err, 'Không thể nghiên cứu chủ đề từ nguồn công khai.');
    }
  });

  // POST /api/ai/generate-from-text
  // Tạo đề chỉ từ văn bản tài liệu đã trích xuất; không gọi luồng nghiên cứu web.
  app.post('/api/ai/generate-from-text', async (req, res) => {
    try {
      const { text, instruction, config = {} } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Missing text content' });
        return;
      }
      if (text.trim().length < MIN_DOCUMENT_TEXT_LENGTH) {
        res.status(422).json({
          error: `Nội dung tài liệu quá ngắn (${text.trim().length} ký tự). Cần ít nhất ${MIN_DOCUMENT_TEXT_LENGTH} ký tự để tạo câu hỏi có căn cứ.`,
        });
        return;
      }
      if (Buffer.byteLength(text, 'utf8') > MAX_DOCUMENT_FILE_BYTES) {
        res.status(413).json({ error: 'Nội dung tài liệu vượt quá giới hạn 50 MB.' });
        return;
      }
      const safeConfig = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
      const fileType = String(safeConfig.fileType || 'txt').toLowerCase();
      if (!['pdf', 'docx', 'txt'].includes(fileType)) {
        res.status(400).json({ error: 'Loại tài liệu không hợp lệ; chỉ hỗ trợ PDF, DOCX hoặc TXT.' });
        return;
      }
      // In document mode, the explicit question-count control is authoritative.
      // A number mentioned elsewhere in free-form instructions must not
      // silently override the user's selected count.
      const questionCount = Number(safeConfig.question_count ?? 10);
      if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) {
        res.status(400).json({ error: 'Số câu hỏi phải là số nguyên từ 1 đến 50.' });
        return;
      }
      const difficulty = normalizeDifficulty(String(safeConfig.difficulty || 'medium'));
      const fileName = String(safeConfig.documentTitle || 'NoiDungTuVanBan.txt');
      const document = await processDocument(
        text,
        fileName,
        fileType as 'pdf' | 'docx' | 'txt',
        String(safeConfig.fileSize || 'custom'),
        { analyzeWithAI: false }
      );

      const result = await generateExamWithAI({
        document,
        sourceMode: 'DOCUMENT',
        numQuestions: questionCount,
        difficulty,
        instruction: typeof instruction === 'string' && instruction.trim()
          ? instruction.trim()
          : 'Tạo câu hỏi trắc nghiệm dựa trên nội dung tài liệu.',
        strictSourceOnly: true,
      });

      res.json({
        parsed: {
          topic: document.title,
          question_count: questionCount,
          difficulty,
          source_mode: 'document',
        },
        sourceMode: 'DOCUMENT',
        document,
        matrix: result.matrix,
        questions: result.questions,
        validationSummary: result.validationSummary,
      });
    } catch (err: any) {
      console.error('Error generating from text:', err);
      sendAiFailure(res, err, 'Không thể tạo câu hỏi từ nội dung tài liệu.');
    }
  });

  // POST /api/ai/generate-from-web
  // Nghiên cứu URL ưu tiên nguồn đáng tin cậy rồi tạo quiz dựa trên tổng hợp đã kiểm chứng.
  app.post('/api/ai/generate-from-web', async (req, res) => {
    try {
      const { topic, instruction, analysis, research_id, title, config = {} } = req.body || {};
      const effectiveTopic = String(analysis?.topic || topic || config.topic || '').trim();
      if (!effectiveTopic) {
        res.status(400).json({ error: 'Missing topic' });
        return;
      }
      if (!instruction || typeof instruction !== 'string') {
        res.status(400).json({ error: 'Missing requirements' });
        return;
      }
      const requestedAnalysis: ResearchRequestAnalysis = analysis && Array.isArray(analysis.focus_areas)
        ? analysis
        : await analyzeResearchRequirements(instruction, Number(config.question_count) || 10, String(config.difficulty || 'medium'));
      const storedResearch = typeof research_id === 'string' ? pendingResearchResults.get(research_id) : undefined;
      if (!storedResearch || storedResearch.expiresAt <= Date.now()) {
        res.status(400).json({ error: 'Phiên nghiên cứu đã hết hạn. Vui lòng chạy lại bước nghiên cứu chủ đề.' });
        return;
      }
      const research = storedResearch.research;
      pendingResearchResults.delete(research_id);
      if (research.unresolved_areas.length > 0) {
        res.status(422).json({
          error: `Sau khi tìm bổ sung, vẫn chưa xác minh đủ nguồn cho phạm vi: ${research.unresolved_areas.join(', ')}. Không thể tạo đề cho đến khi mọi phạm vi được xác minh.`,
        });
        return;
      }
      const verifiedAreas = new Set(research.knowledge_units.map((unit) => unit.focus_area.trim().toLowerCase()));
      const parsed: ResearchRequestAnalysis = {
        ...requestedAnalysis,
        focus_areas: requestedAnalysis.focus_areas.filter((area) => verifiedAreas.has(area.trim().toLowerCase())),
      };
      if (parsed.focus_areas.length === 0) {
        res.status(422).json({
          error: `Sau khi tìm bổ sung, vẫn chưa xác minh đủ nguồn cho phạm vi: ${(research.unresolved_areas || requestedAnalysis.focus_areas).join(', ')}.`,
        });
        return;
      }
      const content = research.sources
        .map((source) => `## ${source.title}\n${source.url}\n${source.content}`)
        .join('\n\n');

      const document = await processDocument(
        content,
        `AI_Research_${String(title || effectiveTopic)}.txt`,
        'txt',
        'research',
        { analyzeWithAI: false } // cấu trúc do AI tạo làm hỏng mapping sourceChunkId → chunks; dùng rule-based deterministic
      );

      const questionCount = Math.max(1, Math.min(50, Number(parsed.question_count) || 10));
      const structuredInstruction = [
        `Yêu cầu người dùng: ${instruction}`,
        `Môn học: ${parsed.subject}`,
        `Chủ đề: ${parsed.topic}`,
        `Trình độ: ${parsed.education_level || 'cơ bản'}`,
        `Chỉ tập trung vào: ${parsed.focus_areas.join('; ')}`,
        `Không tạo câu hỏi cho các phạm vi chưa xác minh được nguồn: ${research.unresolved_areas.join('; ') || 'không có'}`,
        `Ràng buộc: ${parsed.scope_notes.join('; ')}`,
        `Giải thích đáp án: ${parsed.include_explanations ? 'có' : 'không'}`,
      ].join('\n');
      const result = await generateExamWithAI({
        document,
        sourceMode: 'WEB',
        numQuestions: questionCount,
        difficulty: parsed.difficulty,
        subject: parsed.subject,
        educationLevel: parsed.education_level,
        instruction: structuredInstruction,
        focusAreas: parsed.focus_areas,
        difficultyProfile: parsed.difficulty_profile,
        strictSourceOnly: true,
      });

      res.json({
        parsed,
        sourceMode: 'WEB',
        title: String(title || '').trim() || `Đề ${effectiveTopic}`,
        research,
        document,
        matrix: result.matrix,
        questions: result.questions,
        validationSummary: result.validationSummary,
      });
    } catch (err: any) {
      console.error('Error generating from web:', err);
      sendAiFailure(res, err, 'Không tìm thấy đủ nguồn đáng tin cậy để tạo câu hỏi cho chủ đề này.');
    }
  });

  // POST /api/quizzes/generate
  // Tạo đề thi dựa trên ma trận đề, gắn nguồn chi tiết, validator
  app.post('/api/quizzes/generate', async (req, res) => {
    try {
      const { document, numQuestions, difficulty, customMatrix, strictSourceOnly } = req.body;
      if (!document || !document.rawText) {
        res.status(400).json({ error: 'Invalid document payload' });
        return;
      }

      const questionCount = Math.max(1, Math.min(50, Number(numQuestions) || 10));
      const diffLevel = difficulty || 'medium';

      const result = await generateExamWithAI({
        document,
        sourceMode: 'DOCUMENT',
        numQuestions: questionCount,
        difficulty: diffLevel,
        customMatrix,
        strictSourceOnly: strictSourceOnly !== false,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Error generating exam:', err);
      sendAiFailure(res, err, 'Failed to generate exam');
    }
  });

  // POST /api/quizzes/matrix
  // Tạo ma trận đề tham khảo theo danh sách chương
  app.post('/api/quizzes/matrix', (req, res) => {
    try {
      const { chapters, totalQuestions, difficulty } = req.body;
      if (!chapters || !Array.isArray(chapters)) {
        res.status(400).json({ error: 'Chapters array is required' });
        return;
      }

      const matrix = buildExamMatrix(chapters, Number(totalQuestions) || 10, difficulty || 'medium');
      res.json(matrix);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/questions/regenerate
  // Tạo lại một câu hỏi cụ thể
  app.post('/api/questions/regenerate', async (req, res) => {
    try {
      const { document, knowledgeUnitName, questionNumber, difficulty } = req.body;
      if (!document || !knowledgeUnitName) {
        res.status(400).json({ error: 'Missing document or knowledge unit name' });
        return;
      }

      const regenerated = await regenerateSingleQuestion(
        document,
        knowledgeUnitName,
        Number(questionNumber) || 1,
        difficulty || 'medium'
      );

      res.json(regenerated);
    } catch (err: any) {
      console.error('Error regenerating question:', err);
      res.status(500).json({ error: err.message || 'Failed to regenerate question' });
    }
  });

  // POST /api/questions/practice
  // Flow học lại: tạo 3-5 câu luyện tập cho đơn vị kiến thức bị sai
  app.post('/api/questions/practice', async (req, res) => {
    try {
      const { document, knowledgeUnitName, count } = req.body;
      if (!document || !knowledgeUnitName) {
        res.status(400).json({ error: 'Missing document or knowledge unit' });
        return;
      }

      const practiceQuestions = await generatePracticeQuestions(
        document,
        knowledgeUnitName,
        Number(count) || 3
      );

      res.json(practiceQuestions);
    } catch (err: any) {
      console.error('Error generating practice questions:', err);
      res.status(500).json({ error: err.message || 'Failed to generate practice questions' });
    }
  });

  // POST /api/quizzes/export
  // Xuất đề thi giấy chuẩn trường đại học / THPT (HTML / PDF print)
  app.post('/api/quizzes/export', (req, res) => {
    try {
      const { quizSet, config } = req.body;
      if (!quizSet || !quizSet.questions) {
        res.status(400).json({ error: 'Missing quizSet data' });
        return;
      }

      const html = generatePaperExamHTML(quizSet, config || {});
      res.json({ html });
    } catch (err: any) {
      console.error('Error exporting exam:', err);
      res.status(500).json({ error: err.message || 'Failed to export exam' });
    }
  });

  // POST /api/quizzes/export-docx
  // Xuất đề thi dạng Microsoft Word .docx thực thụ bằng thư viện docx
  app.post('/api/quizzes/export-docx', async (req, res) => {
    try {
      const { quizSet, config } = req.body;
      if (!quizSet || !quizSet.questions) {
        res.status(400).json({ error: 'Missing quizSet data' });
        return;
      }

      const docxBuffer = await generatePaperExamDOCX(quizSet, config || {});
      const examCode = config?.examCode || '001';
      const safeFilename = `DeThi_${examCode}.docx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(docxBuffer);
    } catch (err: any) {
      console.error('Error exporting docx exam:', err);
      res.status(500).json({ error: err.message || 'Failed to export DOCX exam' });
    }
  });

  // ==========================================
  // VITE & STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
