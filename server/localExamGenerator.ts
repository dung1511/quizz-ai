/**
 * LocalExamGenerator — Tạo đề trắc nghiệm 100% cục bộ từ nội dung tài liệu.
 *
 * Nguyên tắc:
 * - KHÔNG import hoặc gọi `geminiClient` ở bất kỳ đâu trong file này.
 * - Mọi câu hỏi phải dựa trên câu/đoạn văn THỰC CÓ trong document.rawText.
 * - Đáp án đúng là một phần nội dung trích nguyên văn từ tài liệu.
 * - Phương án nhiễu chỉ lấy từ NỘI DUNG KHÁC của chính tài liệu (câu trích
 *   thuộc khái niệm khác), không bịa kiến thức sai.
 * - Mọi trích dẫn vẫn phải vượt qua findCitationPosition (kiểm chứng với
 *   rawText gốc) — trích dẫn giả bị từ chối.
 */
import {
  DocumentSource,
  Question,
  ExamMatrix,
} from '../src/types';
import { findCitationPosition } from './questionGenerator';
import { validateQuestionSet } from './questionValidator';
import { cleanConceptName } from './documentProcessor';

export interface LocalGenerateExamRequest {
  document: DocumentSource;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyProfile?: 'foundational' | 'balanced' | 'progressive';
  instruction?: string;
  focusAreas?: string[];
}

export interface LocalGenerateExamResponse {
  matrix: ExamMatrix;
  questions: Question[];
  validationSummary: {
    totalQuestions: number;
    validCount: number;
    needsReviewCount: number;
    allValid: boolean;
  };
}

export interface LocalGenerationStats {
  /** Số câu hỏi cục bộ thực sự tạo được từ tài liệu. */
  generated: number;
  /** Số câu người dùng yêu cầu. */
  requested: number;
  /** Số câu bị loại vì trích dẫn không kiểm chứng được. */
  rejectedCitations: number;
}

export class LocalExamCapacityError extends Error {
  stats: LocalGenerationStats;
  constructor(message: string, stats: LocalGenerationStats) {
    super(message);
    this.name = 'LocalExamCapacityError';
    this.stats = stats;
  }
}

const MIN_SENTENCE_LENGTH = 40;
const MIN_SOURCE_TEXT_LENGTH = 30;

interface LocalSentence {
  text: string;
  /** Khái niệm (tên KU) gắn với câu này — dùng làm topic + nguồn nhiễu chéo. */
  concept: string;
  chapter: string;
  section: string;
  page: number;
  sourceChunkId: string;
  documentId: string;
  documentName: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

const STOP_WORDS = new Set([
  'cua', 'cac', 'nhung', 'mot', 'nhieu', 'theo', 'trong', 'ngoai', 'voi', 'duoc',
  'la', 'va', 'hoac', 'nay', 'do', 'gi', 'nao', 'sau', 'khi', 'thi', 'tu', 'den',
  'co', 'mot', 'nhung', 'tren', 'duoi', 'vao', 'ra', 'di', 'lam', 'noi',
  'the', 'this', 'that', 'with', 'from', 'and', 'for', 'are', 'was',
]);

function meaningfulWords(text: string): string[] {
  return normalize(text).match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP_WORDS.has(w)) || [];
}

function isReferenceHeading(line: string): boolean {
  const normalized = normalize(line).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:danh muc )?tai lieu tham khao$|^references$|^bibliography$/.test(normalized);
}

function isChapterHeading(line: string): RegExpMatchArray | null {
  return line.match(/^(?:Chương|CHƯƠNG|Bài|BÀI|Phần|PHẦN)\s+(\d+|[IVXLCDM]+)[\s:.\-–—]+(.*)$/i);
}

function questionConcept(text: string, section: string, chapter: string): string {
  const clean = (value: string) => value
    .replace(/^(?:Bên cạnh đó|Ngoài ra|Tuy nhiên|Đồng thời)[,\s]+/i, '')
    .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '')
    .trim();
  const definition = text.match(/^(.{3,90}?)\s+(?:là|được định nghĩa(?: là)?|chính là|được hiểu là)\s+/i);
  if (definition) return clean(definition[1]);
  const colonLabel = text.match(/^([^:]{3,80}):\s+/);
  if (colonLabel) return clean(colonLabel[1]);
  const listDefinition = text.match(/^(.{3,90}?)\s+(?:bao gồm|gồm)\s+/i);
  if (listDefinition) return clean(listDefinition[1]);
  const actionObject = text.match(/(?:nghiên cứu|tập trung vào|hỗ trợ|sử dụng|đảm bảo|lưu trữ)\s+(.{3,85}?)(?:[,.;]|$)/i);
  if (actionObject) return clean(actionObject[1]);
  const subject = text.match(/^(.{3,80}?)\s+(?:tập trung|thường|có thể|cần|sử dụng|được sử dụng|đảm bảo|nghiên cứu|phân tích|lưu trữ|đề xuất|xây dựng|hỗ trợ|gặp khó khăn|cung cấp|cho phép)(?=\s|$)/i);
  if (subject) return clean(subject[1]);
  if (section && normalize(section) !== normalize(chapter)) return section;
  return chapter;
}

function relevanceScore(sentence: LocalSentence, focusAreas: string[] | undefined): number {
  if (!focusAreas?.length) return 0;
  const haystack = normalize(`${sentence.concept} ${sentence.text}`);
  return focusAreas.reduce(
    (sum, area) => sum + (haystack.includes(normalize(area)) ? 5 : 0),
    0
  );
}

/**
 * Thu thập các câu "kiến thức" từ tài liệu:
 * - Ưu tiên câu có mẫu định nghĩa / khái niệm (X là ..., X gồm ..., X được định nghĩa ...)
 * - Bổ sung câu dài có thông tin từ các đơn vị kiến thức (KU) và từ rawText.
 */
export function collectKnowledgeSentences(document: DocumentSource): LocalSentence[] {
  const sentences: LocalSentence[] = [];
  const seenNormalized = new Set<string>();

  const pushSentence = (
    raw: string,
    concept: string,
    chapter: string,
    section: string,
    page: number,
    sourceChunkId: string
  ) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length < MIN_SENTENCE_LENGTH || text.length > 600) return;
    const normalized = normalize(text);
    if (seenNormalized.has(normalized)) return;
    seenNormalized.add(normalized);
    sentences.push({
      text,
      concept,
      chapter,
      section,
      page,
      sourceChunkId,
      documentId: document.id,
      documentName: document.fileName,
    });
  };

  let chapter = document.chapters[0]?.title || document.title;
  let section = chapter;
  let offset = 0;
  const sectionRegex = /^(?:(\d+\.\d+(?:\.\d+)?)|(\d+)\.|\(([a-zA-Z\d]+)\)|([IVXLCDM]+)\.)\s*[:.\-–—]?\s*(.+)$/;

  for (const line of document.rawText.split('\n')) {
    const trimmed = line.trim();
    const chapterMatch = isChapterHeading(trimmed);
    if (chapterMatch) {
      const chapterNumber = Number.parseInt(chapterMatch[1], 10);
      const matchedChapter = document.chapters.find((candidate) =>
        chapterNumber
          ? candidate.chapterNumber === chapterNumber
          : normalize(candidate.title).includes(normalize(chapterMatch[2]))
      );
      chapter = matchedChapter?.title || `${chapterMatch[1]} ${chapterMatch[2]}`.trim();
      section = chapter;
      offset += line.length + 1;
      continue;
    }

    if (isReferenceHeading(trimmed)) break;
    if (!trimmed || /^\[\d+\]/.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      offset += line.length + 1;
      continue;
    }

    const sectionMatch = trimmed.match(sectionRegex);
    if (sectionMatch) {
      const title = cleanConceptName(sectionMatch[5]);
      if (title.length >= 3) {
        section = `${sectionMatch[1] || sectionMatch[2] || sectionMatch[3] || sectionMatch[4]} ${title}`;
        offset += line.length + 1;
        continue;
      }
    }

    let searchFrom = 0;
    for (const raw of trimmed.split(/(?<=[.!?])\s+/)) {
      const sentenceOffset = line.indexOf(raw, searchFrom);
      searchFrom = sentenceOffset < 0 ? searchFrom : sentenceOffset + raw.length;
      if (raw.length < MIN_SENTENCE_LENGTH || /^\[\d+\]/.test(raw)) continue;
      const sentencePosition = offset + Math.max(0, sentenceOffset);
      const page = Math.max(1, Math.floor(sentencePosition / 1600) + 1);
      const concept = questionConcept(raw, section, chapter);
      pushSentence(raw, concept, chapter, section, page, `document-offset-${sentencePosition}`);
    }
    offset += line.length + 1;
  }

  return sentences;
}

function isDefinitionSentence(text: string): boolean {
  return /(?<![\p{L}\p{N}])(?:là|được định nghĩa(?: là)?|chính là|được hiểu là|gồm|bao gồm|được gọi là|được xác định bởi|phụ thuộc vào|phân chia thành|chia thành)(?![\p{L}\p{N}])/iu.test(text);
}

/**
 * Tạo câu hỏi cục bộ từ một câu kiến thức (dùng nội bộ + debug).
 */
export function buildQuestionFromSentenceForDebug(
  sentence: LocalSentence,
  document: DocumentSource,
  distractorPool: LocalSentence[],
  questionNumber: number,
  difficulty: 'easy' | 'medium' | 'hard'
): Question | null {
  return buildQuestionFromSentence(sentence, document, distractorPool, questionNumber, difficulty);
}

function buildQuestionFromSentence(
  sentence: LocalSentence,
  document: DocumentSource,
  distractorPool: LocalSentence[],
  questionNumber: number,
  difficulty: 'easy' | 'medium' | 'hard'
): Question | null {
  const definition = isDefinitionSentence(sentence.text);

  // Đáp án đúng: nội dung trích nguyên văn từ câu tài liệu.
  const correctText = sentence.text;
  if (correctText.length < MIN_SOURCE_TEXT_LENGTH) return null;

  const conditional = correctText.match(/^(?:Nếu|Khi)\s+(.+?),\s*(.+)$/i);
  const questionText = definition
    ? `Theo tài liệu, "${sentence.concept}" được mô tả như thế nào?`
    : conditional
      ? `Theo tài liệu, nếu ${conditional[1]}, hệ quả nào được nêu?`
      : `Theo tài liệu, phát biểu nào mô tả đúng về "${sentence.concept}"?`;

  // Phương án nhiễu: lấy từ câu khác (khái niệm khác) trong chính tài liệu,
  // ưu tiên câu có độ trùng từ KHÁC THẤP với đáp án đúng để các phương án
  // không quá giống nhau (ràng buộc optionsNotSimilar của bộ kiểm định).
  const correctWords = new Set(meaningfulWords(correctText));
  const wordOverlap = (text: string) => {
    const words = meaningfulWords(text);
    const matches = words.filter((w) => correctWords.has(w)).length;
    const union = new Set([...words, ...correctWords]).size;
    return { matches, ratio: union ? matches / union : 0 };
  };
  const distractors: string[] = [];
  const usedConcepts = new Set([normalize(sentence.concept)]);
  const sortedPool = distractorPool
    .filter((candidate) => {
      const candidateNormalized = normalize(candidate.text);
      if (candidateNormalized === normalize(correctText)) return false;
      if (normalize(candidate.chapter) !== normalize(sentence.chapter)) return false;
      return !usedConcepts.has(normalize(candidate.concept));
    })
    .map((candidate) => ({ candidate, overlap: wordOverlap(candidate.text) }))
    .filter(({ overlap }) => overlap.ratio <= 0.8)
    .sort((a, b) => a.overlap.ratio - b.overlap.ratio || a.overlap.matches - b.overlap.matches);
  for (const { candidate } of sortedPool) {
    if (distractors.length >= 3) break;
    if (normalize(candidate.text) === normalize(correctText)) continue;
    if (distractors.some((d) => normalize(d) === normalize(candidate.text))) continue;
    // Đảm bảo từng cặp phương án không quá giống nhau (ràng buộc optionsNotSimilar):
    const candidateWords = meaningfulWords(candidate.text);
    const passesPairwise = distractors.every((existing) => {
      const existingWords = meaningfulWords(existing);
      const matches = candidateWords.filter((w) => existingWords.includes(w)).length;
      const unionSize = new Set([...candidateWords, ...existingWords]).size;
      return candidateWords.length < 3 || existingWords.length < 3 || matches < 3 || matches / unionSize <= 0.8;
    });
    if (!passesPairwise) continue;
    distractors.push(candidate.text);
    usedConcepts.add(normalize(candidate.concept));
  }
  if (distractors.length < 3) return null; // Không đủ phương án nhiễu từ tài liệu → bỏ câu này.

  // Đặt đáp án đúng luân phiên A/B/C/D theo số thứ tự câu.
  const targetSlot = (['A', 'B', 'C', 'D'] as const)[(questionNumber - 1) % 4];
  const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const optionTexts = [...distractors];
  optionTexts.splice(targetSlot === 'A' ? 0 : targetSlot === 'B' ? 1 : targetSlot === 'C' ? 2 : 3, 0, correctText);
  const options = keys.map((key, index) => ({ key, text: optionTexts[index] }));

  const question: Question = {
    id: `q-local-${Date.now()}-${questionNumber}`,
    questionNumber,
    questionText,
    options,
    correctAnswer: targetSlot,
    explanation: `Căn cứ trực tiếp vào nội dung tài liệu: "${correctText}". Phương án ${targetSlot} là phát biểu đúng; các phương án còn lại là nội dung của khái niệm khác trong tài liệu, không mô tả "${sentence.concept}".`,
    difficulty,
    topic: sentence.concept,
    source: {
      documentId: document.id,
      documentName: document.fileName,
      chapter: sentence.chapter,
      section: sentence.section,
      page: sentence.page,
      sourceChunkId: sentence.sourceChunkId,
      sourceText: correctText,
      knowledgeUnit: sentence.concept,
      generationReason: `Câu hỏi được tạo cục bộ (không dùng AI) từ câu văn nguyên văn của tài liệu thuộc ${sentence.section} (${sentence.chapter}).`,
    },
    validation: {
      isValid: true,
      status: 'VALID',
      checks: {
        hasFourOptions: true,
        hasSingleCorrect: true,
        answerInSource: true,
        explanationMatchesSource: true,
        hasSourceMapping: true,
        hasReason: true,
        noDuplicateOptions: true,
      },
    },
  };
  return question;
}

/**
 * Tạo đề cục bộ từ tài liệu. KHÔNG GỌI GEMINI — không import geminiClient.
 */
export function generateLocalExam(req: LocalGenerateExamRequest): LocalGenerateExamResponse {
  const { document, numQuestions, difficulty, difficultyProfile } = req;

  const MIN_TEXT_LENGTH = 100;
  if (!document.rawText || document.rawText.trim().length < MIN_TEXT_LENGTH) {
    throw new Error(
      `Nội dung tài liệu quá ngắn hoặc rỗng (${document.rawText?.trim().length || 0} ký tự). Cần ít nhất ${MIN_TEXT_LENGTH} ký tự để tạo câu hỏi cục bộ có căn cứ.`
    );
  }

  const allSentences = collectKnowledgeSentences(document);
  if (allSentences.length === 0) {
    throw new Error(
      'Tài liệu không chứa câu hoặc đoạn văn đủ dài để tạo câu hỏi cục bộ. Hãy dùng tài liệu chi tiết hơn.'
    );
  }

  // Ưu tiên câu định nghĩa; sau đó sắp theo focusAreas nếu có.
  const ordered = [...allSentences].sort((a, b) => {
    const defA = isDefinitionSentence(a.text) ? 1 : 0;
    const defB = isDefinitionSentence(b.text) ? 1 : 0;
    if (defA !== defB) return defB - defA;
    const focusDiff = relevanceScore(b, req.focusAreas) - relevanceScore(a, req.focusAreas);
    if (focusDiff !== 0) return focusDiff;
    return b.text.length - a.text.length;
  });

  const questions: Question[] = [];
  let rejectedCitations = 0;
  const usedSentenceNormalized = new Set<string>();

  for (const sentence of ordered) {
    if (questions.length >= numQuestions) break;
    if (usedSentenceNormalized.has(normalize(sentence.text))) continue;

    const question = buildQuestionFromSentence(
      sentence,
      document,
      ordered.filter((c) => c !== sentence),
      questions.length + 1,
      difficulty
    );
    if (!question) continue;

    // KIỂM TRA TRÍCH DẪN với rawText gốc (bắt buộc, dùng cùng cơ chế với luồng AI).
    const citationPosition = findCitationPosition(document.rawText, question.source.sourceText);
    if (citationPosition < 0) {
      rejectedCitations++;
      continue; // Trích dẫn không kiểm chứng được → loại câu này.
    }

    // Kiểm tra trùng câu hỏi với các câu đã tạo.
    const questionKey = normalize(question.questionText);
    if (questions.some((q) => normalize(q.questionText) === questionKey)) continue;

    questions.push(question);
    usedSentenceNormalized.add(normalize(sentence.text));
  }

  // KHÔNG nhân bản, KHÔNG bịa thêm câu. Báo rõ thiếu căn cứ.
  if (questions.length < numQuestions) {
    throw new LocalExamCapacityError(
      `Tài liệu chỉ đủ căn cứ để tạo ${questions.length}/${numQuestions} câu hỏi cục bộ có trích dẫn kiểm chứng được. Hãy dùng tài liệu đầy đủ hơn, chi tiết hơn hoặc giảm số câu hỏi.`,
      { generated: questions.length, requested: numQuestions, rejectedCitations }
    );
  }

  // Kiểm định không đổi: dùng cùng bộ validator như luồng AI.
  const validationSummary = validateQuestionSet(questions);
  if (!validationSummary.allValid) {
    throw new Error(
      `Bộ câu hỏi cục bộ chưa đạt kiểm định (${validationSummary.needsReviewCount}/${validationSummary.totalQuestions} câu cần rà soát). Vui lòng thử lại hoặc dùng tài liệu khác.`
    );
  }

  const perChapter = Math.max(1, Math.ceil(questions.length / Math.max(1, document.chapters.length)));
  const matrix: ExamMatrix = {
    chapterDistributions: document.chapters.map((chapter, index) => {
      const total = index === document.chapters.length - 1
        ? Math.max(0, questions.length - perChapter * index)
        : perChapter;
      const easy = difficultyProfile === 'foundational'
        ? Math.ceil(total * 0.6)
        : difficulty === 'easy' ? Math.round(total * 0.7) : Math.round(total * 0.3);
      const hard = difficulty === 'hard' ? Math.round(total * 0.6) : difficultyProfile === 'foundational' ? 0 : Math.round(total * 0.2);
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        easy,
        medium: Math.max(0, total - easy - hard),
        hard,
        total,
      };
    }),
    totalEasy: Math.round(questions.length * (difficulty === 'easy' ? 0.7 : 0.3)),
    totalMedium: Math.round(questions.length * (difficulty === 'medium' ? 0.6 : 0.3)),
    totalHard: difficulty === 'hard' ? Math.round(questions.length * 0.6) : Math.round(questions.length * 0.2),
    grandTotal: questions.length,
  };

  return {
    matrix,
    questions: questions.slice(0, numQuestions),
    validationSummary: {
      totalQuestions: validationSummary.totalQuestions,
      validCount: validationSummary.validCount,
      needsReviewCount: validationSummary.needsReviewCount,
      allValid: validationSummary.allValid,
    },
  };
}

// Hàm phụ dùng lại cho regenerate/practice cục bộ: tạo 1 câu từ 1 KU.
export function generateLocalQuestionForKu(
  document: DocumentSource,
  knowledgeUnitName: string,
  questionNumber: number,
  difficulty: 'easy' | 'medium' | 'hard'
): Question {
  const allSentences = collectKnowledgeSentences(document);
  const target = allSentences.find(
    (s) => normalize(s.concept).includes(normalize(knowledgeUnitName)) ||
      normalize(knowledgeUnitName).includes(normalize(s.concept))
  ) || allSentences[0];
  if (!target) {
    throw new Error('Tài liệu không còn nội dung đủ để tạo lại câu hỏi cục bộ.');
  }
  const question = buildQuestionFromSentence(target, document, allSentences, questionNumber, difficulty);
  if (!question) {
    throw new Error('Không tạo được câu hỏi cục bộ đủ 4 phương án từ nội dung tài liệu.');
  }
  const citationPosition = findCitationPosition(document.rawText, question.source.sourceText);
  if (citationPosition < 0) {
    throw new Error('Trích dẫn nguồn không kiểm chứng được với tài liệu gốc.');
  }
  return question;
}

export { cleanConceptName };
