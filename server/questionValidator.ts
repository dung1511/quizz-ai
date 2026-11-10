import { Question, QuestionValidation } from '../src/types';

export interface ValidationReport {
  totalQuestions: number;
  validCount: number;
  needsReviewCount: number;
  allValid: boolean;
  issuesSummary: string[];
}

const stopWords = new Set([
  'cua', 'cac', 'nhung', 'mot', 'nhieu', 'theo', 'trong', 'ngoai', 'voi', 'duoc',
  'la', 'va', 'hoac', 'nay', 'do', 'gi', 'nao', 'sau', 'khi', 'thi', 'tu', 'den',
  'the', 'this', 'that', 'with', 'from', 'what', 'which', 'into', 'are', 'is', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'by', 'as', 'at', 'be', 'its', 'has', 'have',
  // Thuật ngữ khung câu hỏi tiếng Việt quá phổ biến — không phải bằng chứng nội dung
  'cau', 'lenh', 'dung', 'phuong', 'an', 'de', 'nen', 'can', 'phan', 'co', 'khong', 've',
  'trong lap', 'hoi', 'tra loi', 'dung hay sai', 'canh', 'dieu',
]);

/**
 * Cầu thuật ngữ đa ngôn ngữ (tiếng Việt → tiếng Anh) cho các khái niệm lập
 * trình: khi câu hỏi/đáp án tiếng Việt dùng "vòng lặp", "danh sách"... tài liệu
 * nguồn (docs.python.org) là tiếng Anh ("loop", "list"). Mỗi từ tiếng Việt trong
 * danh sách được ánh xạ sang THÊM từ tiếng Anh tương ứng vào tập từ khóa để đối
 * chiếu với nguồn — KHÔNG thay thế từ gốc (nguồn tiếng Việt vẫn khớp).
 * Các thuật ngữ Python giữ nguyên dạng gốc (for, while, list, append...) trong
 * cả hai ngôn ngữ — không nằm trong stopword tiếng Anh.
 */
const VI_TO_EN_TERMS: Record<string, string[]> = {
  // Chỉ ánh xạ các THUẬT NGỮ KỸ THUẬT ĐẶC TRƯNG (không phải từ chung chung) —
  // tránh false-positive: "sắp xếp nhanh" không được khớp "sort" của Python.
  vong: ['loop', 'iteration'],
  lap: ['loop', 'iterate'],
  danh: ['list', 'sequence'],
  tu: ['dictionary'],
  dien: ['dictionary', 'mapping'],
  phuong: ['method', 'function'],
  thuc: ['execute', 'function'],
  them: ['append', 'insert', 'extend'],
  append: ['append'],
  xoa: ['remove', 'delete', 'pop'],
  xep: ['sort'],
  'sort': ['sort'],
  'index': ['index'],
  phan: ['element', 'item'],
  'element': ['element', 'item'],
  gia: ['value'],
  tri: ['value'],
  'value': ['value'],
  khoa: ['key'],
  'key': ['key'],
  'set': ['set'],
  'tuple': ['tuple'],
  bien: ['variable'],
  'variable': ['variable'],
  'string': ['string', 'str'],
  chuoi: ['string', 'str'],
  nguyen: ['integer', 'int'],
  'integer': ['integer', 'int'],
  'int': ['int', 'integer'],
  kieu: ['type', 'data'],
  lieu: ['data'],
  'data': ['data'],
  'type': ['type'],
  dieu: ['condition', 'if'],
  kien: ['condition'],
  condition: ['condition', 'if'],
  'range': ['range'],
};

/**
 * Trích xuất từ khóa nội dung và MỞ RỘNG bằng cầu thuật ngữ Việt → Anh.
 * Trả về tập gồm: từ gốc (chuẩn hóa) + từ tiếng Anh tương ứng (nếu có trong cầu).
 * Thuật ngữ Python/code (for, while, list, append...) được giữ nguyên — KHÔNG bị
 * lọc như stopword vì đây là bằng chứng kỹ thuật cốt lõi.
 */
const PYTHON_RESERVED_TERMS = new Set([
  'for', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue',
  'pass', 'class', 'import', 'try', 'except', 'finally', 'raise', 'with', 'as',
  'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'in', 'not', 'is',
  'and', 'or', 'list', 'tuple', 'dict', 'set', 'str', 'int', 'float', 'bool',
  'append', 'extend', 'insert', 'remove', 'pop', 'sort', 'reverse', 'index',
  'range', 'len', 'print', 'input', 'type', 'data', 'python', 'loop', 'function',
  'variable', 'string', 'integer', 'dictionary', 'value', 'key', 'element', 'item',
  'method', 'sequence', 'iteration', 'comprehension', 'stack', 'queue',
]);

function getMeaningfulWords(text: string): Set<string> {
  const raw = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .match(/[a-z0-9]+/g) || [];
  const result = new Set<string>();
  for (const word of raw) {
    // Thuật ngữ Python/kỹ thuật: luôn giữ, không bị stopword tiếng Anh lọc nhầm.
    if (PYTHON_RESERVED_TERMS.has(word)) {
      result.add(word);
      continue;
    }
    if (word.length > 2 && !stopWords.has(word)) {
      result.add(word);
      // Cầu thuật ngữ: thêm từ tiếng Anh tương ứng (nếu có) vào tập — giữ từ gốc.
      const englishTerms = VI_TO_EN_TERMS[word];
      if (englishTerms) {
        for (const term of englishTerms) result.add(term);
      }
    }
  }
  return result;
}

function getOverlap(left: Set<string>, right: Set<string>) {
  const matches = [...left].filter((word) => right.has(word)).length;
  return { matches, ratio: left.size ? matches / left.size : 0 };
}

/**
 * Cửa sổ ngữ cảnh quanh vị trí trích dẫn trong văn bản gốc: câu hỏi/đáp án được
 * kiểm tra căn cứ không chỉ trong đoạn trích (sourceText) mà cả trong vùng nội
 * dung thực tế mà đoạn trích đó đại diện. Cho phép diễn đạt lại tự nhiên — không
 * yêu cầu trùng nguyên văn — nhưng vẫn bắt buộc có bằng chứng trong nguồn.
 */
function buildGroundingContexts(srcText: string, docRawText: string | undefined): string[] {
  const contexts = [srcText];
  if (docRawText && srcText) {
    const normalizedSrc = srcText.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedDoc = docRawText.toLowerCase().replace(/\s+/g, ' ');
    const position = normalizedDoc.indexOf(normalizedSrc.slice(0, 60));
    if (position >= 0) {
      // ±1200 ký tự quanh vị trí khớp — đủ rộng cho diễn đạt lại, đủ hẹp để vẫn
      // là bằng chứng của đúng nguồn được trích dẫn.
      const start = Math.max(0, position - 600);
      contexts.push(docRawText.slice(start, position + normalizedSrc.length + 600));
    }
  }
  return contexts;
}

/** Đánh giá căn cứ qua TẤT CẢ ngữ cảnh (đoạn trích + cửa sổ tài liệu gốc):
 * đạt nếu ngữ cảnh tốt nhất thỏa ngưỡng — không phải yêu cầu cả hai.
 * Trả về thêm chi tiết để log chẩn đoán: từ khớp/thiếu theo từng ngữ cảnh. */
function bestOverlap(textWords: Set<string>, contexts: string[]) {
  let best = { matches: 0, ratio: 0, contextIndex: 0, matchedWords: [] as string[], missingWords: [] as string[] };
  contexts.forEach((context, index) => {
    const contextWords = getMeaningfulWords(context);
    const matchedWords = [...textWords].filter((word) => contextWords.has(word));
    const missingWords = [...textWords].filter((word) => !contextWords.has(word));
    const overlap = { matches: matchedWords.length, ratio: textWords.size ? matchedWords.length / textWords.size : 0 };
    if (overlap.ratio > best.ratio || (overlap.ratio === best.ratio && overlap.matches > best.matches)) {
      best = { ...overlap, contextIndex: index, matchedWords, missingWords };
    }
  });
  return best;
}

function normalizeQuestion(text: string): string {
  return [...getMeaningfulWords(text)].sort().join(' ');
}

export interface ValidateQuestionOptions {
  /** Văn bản tài liệu gốc (rawText) để mở rộng phạm vi kiểm tra căn cứ quanh trích dẫn. */
  documentRawText?: string;
  /** Tên các nguồn (URL/tiêu đề) của tài liệu — dùng trong log chẩn đoán. */
  sourceIds?: string[];
  /** Phạm vi kiến thức của câu hỏi — dùng trong log chẩn đoán. */
  focusArea?: string;
}

export function validateQuestion(
  q: Partial<Question> & { documentRawText?: string; _diagnostics?: ValidateQuestionOptions },
  existingQuestions: Question[] = [],
  validationOptions: ValidateQuestionOptions = {}
): QuestionValidation {
  const issues: string[] = [];

  // 1. Kiểm tra 4 đáp án
  const options = q.options || [];
  const hasFourOptions =
    options.length === 4 &&
    options.every((opt) => opt && opt.text && opt.text.trim().length > 0) &&
    ['A', 'B', 'C', 'D'].every((key) => options.some((opt) => opt.key === key));

  if (!hasFourOptions) {
    issues.push('Câu hỏi phải có đúng 4 phương án A, B, C, D không được để trống.');
  }

  // 2. Không trùng lặp đáp án
  const optionTexts = options.map((opt) => opt.text.trim().toLowerCase());
  const uniqueOptionTexts = new Set(optionTexts);
  const noDuplicateOptions = uniqueOptionTexts.size === options.length;
  if (!noDuplicateOptions) {
    issues.push('Các phương án lựa chọn bị trùng lặp nội dung.');
  }

  const optionWords = options.map((option) => getMeaningfulWords(option.text));
  const optionsNotSimilar = noDuplicateOptions && optionWords.every((words, index) =>
    optionWords.slice(index + 1).every((otherWords) => {
      const overlap = getOverlap(words, otherWords);
      const unionSize = new Set([...words, ...otherWords]).size;
      return words.size < 3 || otherWords.size < 3 || overlap.matches < 3 || overlap.matches / unionSize <= 0.8;
    })
  );
  if (noDuplicateOptions && !optionsNotSimilar) {
    issues.push('Một số phương án có nội dung quá giống nhau.');
  }

  // 3. Đúng 1 đáp án đúng
  const hasSingleCorrect =
    q.correctAnswer !== undefined &&
    ['A', 'B', 'C', 'D'].includes(q.correctAnswer) &&
    options.filter((option) => option.key === q.correctAnswer).length === 1;
  if (!hasSingleCorrect) {
    issues.push('Phải xác định duy nhất một đáp án đúng (A, B, C hoặc D).');
  }

  // 4. Có source mapping đầy đủ
  const src = q.source;
  const hasSourceMapping = Boolean(
    src &&
    src.documentName &&
    src.documentName.trim().length > 0 &&
    src.chapter &&
    src.chapter.trim().length > 0 &&
    src.section &&
    src.section.trim().length > 0 &&
    src.sourceText &&
    src.sourceText.trim().length > 10 &&
    src.knowledgeUnit &&
    src.knowledgeUnit.trim().length > 0 &&
    src.sourceChunkId &&
    src.sourceChunkId.trim().length > 0 &&
    Number.isInteger(src.page) &&
    src.page > 0
  );
  if (!hasSourceMapping) {
    issues.push('Thiếu thông tin truy xuất nguồn gốc (Chương, Mục, Đoạn văn bản gốc hoặc Đơn vị kiến thức).');
  }

  // 5. Có lý do tạo câu hỏi cụ thể
  const hasReason = Boolean(
    src && src.generationReason && src.generationReason.trim().length >= 15
  );
  if (!hasReason) {
    issues.push('Lý do tạo câu hỏi quá ngắn hoặc thiếu căn cứ sư phạm.');
  }

  // 6. Kiểm tra câu hỏi có liên quan đến nguồn (đoạn trích + cửa sổ ngữ cảnh gốc).
  // Cho phép diễn đạt lại bằng ngôn ngữ tự nhiên: chỉ cần từ khóa có căn cứ trong
  // nguồn, KHÔNG yêu cầu trùng nguyên văn. Đáp án phải có căn cứ rõ hơn câu hỏi.
  const groundingContexts = buildGroundingContexts(src?.sourceText || '', validationOptions.documentRawText ?? q.documentRawText);
  // Chẩn đoán: xếp loại ngữ cảnh (0=đoạn trích, 1=cửa sổ gốc) + độ dài thực tế
  const contextMeta = groundingContexts.map((context, i) => ({ index: i, length: context.length }));
  const sourceWords = getMeaningfulWords(src?.sourceText || '');
  const correctOption = options.find((option) => option.key === q.correctAnswer);
  const answerWords = getMeaningfulWords(correctOption?.text || '');
  const answerOverlap = getOverlap(answerWords, sourceWords);
  const answerBest = bestOverlap(answerWords, groundingContexts);
  // Fallback cho đáp án ngắn (ví dụ "FROM", "WHERE", "ACID") mà getMeaningfulWords
  // có thể lọc bỏ hết (stopword hoặc <= 2 ký tự): nếu nguyên đáp án xuất hiện
  // trực tiếp trong đoạn trích nguồn thì vẫn tính là có căn cứ.
  const answerAppearsInSource = Boolean(
    src?.sourceText &&
    correctOption?.text &&
    correctOption.text.trim().length > 0 &&
    src.sourceText.toLowerCase().includes(correctOption.text.trim().toLowerCase())
  );
  const answerInSource = Boolean(
    src?.sourceText &&
    (answerAppearsInSource ||
      (answerOverlap.matches >= Math.min(2, answerWords.size) && answerOverlap.ratio >= 0.3) ||
      // Cửa sổ ngữ cảnh gốc: căn cứ qua nội dung nguồn rộng hơn đoạn trích ngắn.
      // Đáp án thường ngắn (2-8 từ) nên ngưỡng khớp tuyệt đối, không theo ratio.
      (answerWords.size >= 2 && answerBest.matches >= 2 && answerBest.ratio >= 0.4) ||
      (answerWords.size === 1 && answerBest.matches >= 1))
  );
  if (!answerInSource) {
    issues.push('Chưa tìm thấy đủ từ khóa của đáp án đúng trong đoạn trích nguồn hoặc ngữ cảnh nguồn gốc.');
  }

  const questionWords = getMeaningfulWords(q.questionText || '');
  const questionOverlap = getOverlap(questionWords, sourceWords);
  const questionBest = bestOverlap(questionWords, groundingContexts);
  const questionInSource = Boolean(
    src?.sourceText && (
      (questionOverlap.matches >= Math.min(2, questionWords.size) && questionOverlap.ratio >= 0.15) ||
      // Diễn đạt lại tự nhiên: đủ ≥3 từ khóa nội dung xuất hiện trong ngữ cảnh gốc
      // quanh trích dẫn (≥20% số từ nội dung của câu hỏi).
      (questionWords.size >= 3 && questionBest.matches >= 3 && questionBest.ratio >= 0.2))
  );
  if (!questionInSource) {
    issues.push('Câu hỏi có thể nằm ngoài phạm vi đoạn trích nguồn và ngữ cảnh nguồn gốc.');
  }

  const explanationWords = getMeaningfulWords(q.explanation || '');
  const explanationOverlap = getOverlap(explanationWords, sourceWords);
  const explanationBest = bestOverlap(explanationWords, groundingContexts);
  const explanationMatchesSource = Boolean(
    q.explanation && q.explanation.trim().length > 10 &&
    ((explanationOverlap.matches >= Math.min(2, explanationWords.size) && explanationOverlap.ratio >= 0.1) ||
      (explanationWords.size >= 4 && explanationBest.matches >= 3 && explanationBest.ratio >= 0.15))
  );
  if (!explanationMatchesSource) {
    issues.push('Giải thích chưa có đủ căn cứ từ đoạn trích nguồn hoặc ngữ cảnh nguồn gốc.');
  }

  // 7. Trùng lặp với câu hỏi đã có
  const normalizedQuestion = normalizeQuestion(q.questionText || '');
  const noDuplicateQuestion = Boolean(normalizedQuestion) && !existingQuestions.some(
      (exist) =>
        exist.id !== q.id &&
        normalizeQuestion(exist.questionText) === normalizedQuestion
    );
  if (!noDuplicateQuestion) {
    issues.push('Câu hỏi bị trùng lặp với một câu khác trong bộ đề.');
  }

  const qualityChecks = [
    hasFourOptions,
    hasSingleCorrect,
    answerInSource,
    explanationMatchesSource,
    noDuplicateQuestion,
    optionsNotSimilar,
    questionInSource,
    hasSourceMapping,
    hasReason,
  ];
  const qualityScore = Math.round(
    (qualityChecks.filter(Boolean).length / qualityChecks.length) * 100
  );

  const isValid = issues.length === 0;

  return {
    isValid,
    status: isValid ? 'VALID' : 'NEEDS_REVIEW',
    checks: {
      hasFourOptions,
      hasSingleCorrect,
      answerInSource,
      explanationMatchesSource,
      hasSourceMapping,
      hasReason,
      noDuplicateOptions,
      noDuplicateQuestion,
      optionsNotSimilar,
      questionInSource,
    },
    qualityScore,
    issues: issues.length > 0 ? issues : undefined,
  };
}

export function validateQuestionSet(
  questions: Question[],
  validationOptions: ValidateQuestionOptions = {}
): ValidationReport {
  let validCount = 0;
  let needsReviewCount = 0;
  const issuesSummary: string[] = [];

  questions.forEach((q, idx) => {
    const val = validateQuestion(q, questions, validationOptions);
    q.validation = val;
    if (val.isValid) {
      validCount++;
    } else {
      needsReviewCount++;
      if (val.issues) {
        issuesSummary.push(`Câu ${idx + 1}: ${val.issues.join(', ')}`);
      }
      // Log chẩn đoán chi tiết khi một câu bị loại — phân loại nguyên nhân A-E
      // bằng dữ liệu thực tế (từ khóa, đối chiếu từng ngữ cảnh, ngưỡng). KHÔNG
      // chứa API key hoặc dữ liệu bí mật; chỉ log nội dung câu hỏi/đáp án khi
      // cần truy vết lỗi kiểm định.
      const failedChecks = Object.entries(val.checks || {})
        .filter(([, value]) => value === false)
        .map(([code]) => code);
      // Ngữ cảnh đã dùng để kiểm tra: đoạn trích + cửa sổ gốc (nếu có rawText).
      const contextsMeta = buildGroundingContexts(q.source?.sourceText || '', validationOptions.documentRawText)
        .map((context, index) => ({ index, length: context.length }));
      const diagnostic = buildRejectionDiagnostic(q, validationOptions, failedChecks, contextsMeta);
      console.info('[Validation] Question rejected.', diagnostic);
    }
  });

  return {
    totalQuestions: questions.length,
    validCount,
    needsReviewCount,
    allValid: needsReviewCount === 0,
    issuesSummary,
  };
}

/**
 * Xây dựng log chẩn đoán chi tiết cho một câu bị loại. Phân loại nguyên nhân:
 * A. Không tồn tại trong nội dung nguồn (matches=0 mọi ngữ cảnh)
 * B. Có trong nguồn nhưng trích xuất từ khóa sai (từ khóa rỗng/quá ít)
 * C. Có trong nguồn nhưng lấy sai đoạn văn bản (không tìm thấy excerpt trong rawText)
 * D. Citation/source liên kết sai (excerpt nằm ở nguồn khác)
 * E. Nguyên nhân khác (đo bằng dữ liệu)
 */
function buildRejectionDiagnostic(
  q: Question,
  options: ValidateQuestionOptions,
  failedChecks: string[],
  contextMeta: Array<{ index: number; length: number }>
) {
  const src = q.source;
  const sourceText = src?.sourceText || '';
  const docRawText = options.documentRawText;
  const contexts = buildGroundingContexts(sourceText, docRawText);
  const correctOption = (q.options || []).find((option) => option.key === q.correctAnswer);
  const answerWords = getMeaningfulWords(correctOption?.text || '');
  const questionWords = getMeaningfulWords(q.questionText || '');
  const answerBest = bestOverlap(answerWords, contexts);
  const questionBest = bestOverlap(questionWords, contexts);

  let answerFailureReason = 'none';
  if (failedChecks.includes('answerInSource')) {
    if (answerWords.size === 0) {
      answerFailureReason = 'B: từ khóa đáp án rỗng sau khi trích xuất (stopword lọc hết hoặc đáp án quá ngắn)';
    } else if (!docRawText) {
      answerFailureReason = 'E: không có documentRawText để mở rộng ngữ cảnh kiểm tra';
    } else {
      const normalizedSrc = sourceText.toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizedDoc = docRawText.toLowerCase().replace(/\s+/g, ' ');
      const position = normalizedSrc ? normalizedDoc.indexOf(normalizedSrc.slice(0, 60)) : -1;
      if (position < 0) {
        answerFailureReason = 'C/D: excerpt không tìm thấy trong rawText (citation trỏ sai nguồn hoặc excerpt không nguyên văn)';
      } else if (answerBest.matches === 0) {
        answerFailureReason = 'A: không từ khóa nào của đáp án tồn tại trong nội dung nguồn (kiểm tra đa ngôn ngữ Việt/Anh)';
      } else {
        answerFailureReason = `A-cận ngưỡng: matches=${answerBest.matches}; missing=${JSON.stringify(answerBest.missingWords.slice(0, 8))}`;
      }
    }
  }

  let questionFailureReason = 'none';
  if (failedChecks.includes('questionInSource')) {
    if (questionWords.size < 3) {
      questionFailureReason = 'B: câu hỏi có quá ít từ khóa nội dung';
    } else if (questionBest.matches === 0) {
      questionFailureReason = 'A: không từ khóa nào của câu hỏi tồn tại trong nội dung nguồn (kiểm tra đa ngôn ngữ)';
    } else {
      questionFailureReason = `A-cận ngưỡng: matches=${questionBest.matches}, ratio=${questionBest.ratio.toFixed(2)} < 0.2; missing=${JSON.stringify(questionBest.missingWords.slice(0, 8))}`;
    }
  }

  return {
    questionId: q.id,
    questionNumber: q.questionNumber,
    failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
    questionText: q.questionText,
    options: (q.options || []).map((option) => ({ key: option.key, text: option.text })),
    correctAnswer: q.correctAnswer,
    explanationPreview: (q.explanation || '').slice(0, 120),
    focusArea: options.focusArea || q.topic,
    sourceIds: options.sourceIds?.slice(0, 5),
    citation: {
      sourceUrl: src?.sourceUrl,
      sourceChunkId: src?.sourceChunkId,
      sourceTextLength: sourceText.length,
      sourceTextPreview: sourceText.slice(0, 150),
    },
    contexts: contextMeta.map((meta) => ({
      index: meta.index,
      kind: meta.index === 0 ? 'excerpt' : 'docWindow',
      length: meta.length,
    })),
    answer: {
      keywords: [...answerWords].slice(0, 12),
      matchedWords: answerBest.matchedWords.slice(0, 12),
      missingWords: answerBest.missingWords.slice(0, 12),
      matches: answerBest.matches,
      ratio: Number(answerBest.ratio.toFixed(2)),
      bestContextIndex: answerBest.contextIndex,
      failureReason: answerFailureReason,
    },
    question: {
      keywordCount: questionWords.size,
      keywords: [...questionWords].slice(0, 12),
      matchedWords: questionBest.matchedWords.slice(0, 12),
      missingWords: questionBest.missingWords.slice(0, 12),
      matches: questionBest.matches,
      ratio: Number(questionBest.ratio.toFixed(2)),
      bestContextIndex: questionBest.contextIndex,
      failureReason: questionFailureReason,
    },
    thresholds: {
      answer: 'excerpt: matches>=2 & ratio>=0.3; window: matches>=2 (1 nếu đáp án 1 từ); hoặc nguyên đáp án nằm trong excerpt',
      question: 'excerpt: matches>=min(2,size) & ratio>=0.15; window: matches>=3 & ratio>=0.2',
    },
    reasons: q.validation?.issues || [],
  };
}
