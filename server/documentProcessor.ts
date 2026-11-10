import { DocumentChapter, DocumentSection, DocumentChunk, KnowledgeUnit, DocumentSource } from '../src/types';
import { generateGeminiContent, getGeminiClient } from './geminiClient';
import { withGeminiTimeout, AI_STEP_TIMEOUT_MS } from './aiErrors';
import { normalizeVietnameseText, isBinaryZipOrDocx } from './documentExtractor';

export interface ProcessDocumentResult {
  document: DocumentSource;
}

export async function processDocument(
  rawText: string,
  fileName: string = 'TaiLieu.pdf',
  fileType: 'pdf' | 'docx' | 'txt' = 'pdf',
  fileSize: string = '2.4 MB',
  options: { analyzeWithAI?: boolean } = {}
): Promise<DocumentSource> {
  const documentId = `doc-${Date.now()}`;

  // Check if content is raw binary DOCX/ZIP
  if (isBinaryZipOrDocx(rawText)) {
    throw new Error(
      'Nội dung tài liệu chứa mã nhị phân PK / [Content_Types].xml của file nén DOCX. Tài liệu phải được trích xuất qua bộ giải mã DOCX chuyên dụng (mammoth), không thể xử lý dưới dạng text nhị phân thô.'
    );
  }

  const cleanedText = normalizeVietnameseText(rawText);

  // Try Gemini AI structure analysis if API key is available
  const aiResult = options.analyzeWithAI === false
    ? null
    : await tryAIStructureAnalysis(cleanedText, fileName);

  let chapters: DocumentChapter[] = [];
  let knowledgeUnits: KnowledgeUnit[] = [];

  if (aiResult && aiResult.chapters && aiResult.chapters.length > 0) {
    chapters = aiResult.chapters;
    knowledgeUnits = aiResult.knowledgeUnits || [];
  } else {
    // Deterministic Rule-Based Structure Detection
    const detected = detectStructureRuleBased(cleanedText, documentId, fileName);
    chapters = detected.chapters;
    knowledgeUnits = detected.knowledgeUnits;
  }

  // Create indexed Chunks (Source Index)
  const chunks = buildSourceIndex(documentId, cleanedText, chapters);

  // Calculate approximate page count
  const estimatedPages = Math.max(1, Math.ceil(cleanedText.length / 1600));

  return {
    id: documentId,
    title: fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    fileName,
    fileType,
    fileSize,
    pageCount: estimatedPages,
    status: 'READY',
    rawText: cleanedText,
    chapters,
    chunks,
    knowledgeUnits,
  };
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Deterministic structure detection for documents
 */
function detectStructureRuleBased(text: string, documentId: string, fileName: string): {
  chapters: DocumentChapter[];
  knowledgeUnits: KnowledgeUnit[];
} {
  const lines = text.split('\n');
  const chapters: DocumentChapter[] = [];
  const knowledgeUnits: KnowledgeUnit[] = [];

  let currentChapter: DocumentChapter | null = null;
  let currentSection: DocumentSection | null = null;
  let currentChapterLines: string[] = [];
  let chapterIndex = 0;

  // Chapter patterns in Vietnamese
  const chapterRegex = /^(?:Chương|CHƯƠNG|Bài|BÀI|Phần|PHẦN)\s+(\d+|[IVXLCDM]+)[\s:.\-–—]+(.*)$/i;
  // Enhanced section patterns: supports 1.1, 1., I., A., or Part headers
  const sectionRegex = /^(?:(\d+\.\d+(?:\.\d+)?)|(\d+)\.|\(([a-zA-Z\d]+)\)|([IVXLCDM]+)\.)\s*[:.\-–—]?\s*(.+)$/;
  // Bullet point with concept: definition
  const bulletConceptRegex = /^[-*•]\s*([A-ZÀ-Ỵa-zà-ỹ0-9\s/()_-]{3,50}?):\s*(.+)$/;
  // In-text definition pattern
  const definitionRegex = /([A-ZÀ-Ỵ][A-ZÀ-Ỵa-zà-ỹ0-9\s/()_-]{2,45}?)\s+(?:là|được định nghĩa là|chính là|được hiểu là)\s+([^.?!]+[.?!])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const chapterMatch = line.match(chapterRegex);
    if (chapterMatch) {
      if (currentChapter) {
        currentChapter.pageEnd = Math.max(currentChapter.pageStart, Math.ceil(i / 45) + 1);
        chapters.push(currentChapter);
      }
      chapterIndex++;
      const chapNum = parseInt(chapterMatch[1], 10) || chapterIndex;
      const chapTitle = `Chương ${chapNum} – ${chapterMatch[2].trim() || 'Nội dung trọng tâm'}`;
      const pageStart = Math.max(1, Math.ceil(i / 45));

      currentChapter = {
        id: `chap-${chapNum}-${chapterIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        chapterNumber: chapNum,
        title: chapTitle,
        pageStart,
        pageEnd: pageStart + 5,
        sections: [],
      };
      currentSection = null;
      continue;
    }

    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && currentChapter) {
      const secNum = sectionMatch[1] || `${currentChapter.chapterNumber}.${sectionMatch[2] || sectionMatch[4] || currentChapter.sections.length + 1}`;
      const rawSecTitle = (sectionMatch[5] || '').trim();
      const secTitle = cleanConceptName(rawSecTitle);
      const page = Math.max(1, Math.ceil(i / 45));

      currentSection = {
        id: `sec-${secNum.replace(/[^a-zA-Z0-9]/g, '_')}-${chapterIndex}-${currentChapter.sections.length + 1}`,
        chapterId: currentChapter.id,
        sectionNumber: secNum,
        title: secTitle,
        page,
        summary: lines.slice(i + 1, i + 3).join(' ').trim(),
      };
      currentChapter.sections.push(currentSection);

      // Extract Knowledge Unit from this section
      const kuText = lines.slice(i + 1, i + 4).join(' ').trim() || rawSecTitle;
      knowledgeUnits.push({
        id: `ku-${knowledgeUnits.length + 1}`,
        documentId,
        chapter: currentChapter.title,
        section: `${secNum} ${secTitle}`,
        name: secTitle,
        type: determineKuType(secTitle, kuText),
        description: kuText.slice(0, 160).replace(/\.$/, '') + '.',
        importance: determineImportance(secTitle),
        sourceChunkId: `chunk-${chapterIndex}-${currentChapter.sections.length}`,
        sourceText: kuText,
        pageNumber: page,
      });

      // Also check if the following lines contain in-text definition concepts
      const defMatch = kuText.match(definitionRegex);
      if (defMatch && defMatch[1].trim() !== secTitle) {
        const subConceptName = cleanConceptName(defMatch[1]);
        if (subConceptName.length >= 3 && !knowledgeUnits.some((k) => k.name === subConceptName)) {
          knowledgeUnits.push({
            id: `ku-${knowledgeUnits.length + 1}`,
            documentId,
            chapter: currentChapter.title,
            section: `${secNum} ${secTitle}`,
            name: subConceptName,
            type: 'definition',
            description: `${subConceptName} là ${defMatch[2].trim()}`.slice(0, 160),
            importance: 'core',
            sourceChunkId: `chunk-${chapterIndex}-${currentChapter.sections.length}`,
            sourceText: defMatch[0],
            pageNumber: page,
          });
        }
      }
      continue;
    }

    // Check for bullet point concepts inside a chapter even without numbered section
    const bulletMatch = line.match(bulletConceptRegex);
    if (bulletMatch && currentChapter) {
      const bulletConceptName = cleanConceptName(bulletMatch[1]);
      const bulletDesc = bulletMatch[2].trim();
      const page = Math.max(1, Math.ceil(i / 45));

      if (bulletConceptName.length >= 3 && !knowledgeUnits.some((k) => k.name === bulletConceptName)) {
        knowledgeUnits.push({
          id: `ku-${knowledgeUnits.length + 1}`,
          documentId,
          chapter: currentChapter.title,
          section: currentSection ? `${currentSection.sectionNumber} ${currentSection.title}` : currentChapter.title,
          name: bulletConceptName,
          type: determineKuType(bulletConceptName, bulletDesc),
          description: bulletDesc.slice(0, 160),
          importance: 'important',
          sourceChunkId: `chunk-b-${knowledgeUnits.length + 1}`,
          sourceText: line,
          pageNumber: page,
        });
      }
    }
  }

  if (currentChapter) {
    currentChapter.pageEnd = Math.max(currentChapter.pageStart, Math.ceil(lines.length / 45) + 1);
    chapters.push(currentChapter);
  }

  // Ensure every chapter has at least 1-2 sections and knowledge units
  chapters.forEach((chap, cIdx) => {
    const existingKus = knowledgeUnits.filter((k) => k.chapter === chap.title);
    if (existingKus.length === 0) {
      // Extract from raw lines around this chapter
      const sliceStart = Math.max(0, (chap.pageStart - 1) * 45);
      const sliceEnd = Math.min(lines.length, chap.pageEnd * 45);
      const chapLines = lines.slice(sliceStart, sliceEnd).filter((l) => l.trim().length > 15);

      const defaultConcepts = chapLines.slice(0, 3).map((l, lIdx) => {
        const words = l.trim().split(/\s+/);
        const name = cleanConceptName(words.slice(0, 5).join(' '));
        return {
          name: name || `Trọng tâm ${chap.chapterNumber}.${lIdx + 1}`,
          text: l.trim(),
        };
      });

      if (defaultConcepts.length === 0) {
        defaultConcepts.push({
          name: cleanConceptName(chap.title.replace(/^Chương\s+\d+[\s:–—]+/, '')),
          text: chap.title,
        });
      }

      defaultConcepts.forEach((c, cSubIdx) => {
        const secNum = `${chap.chapterNumber}.${cSubIdx + 1}`;
        if (chap.sections.length <= cSubIdx) {
          chap.sections.push({
            id: `sec-auto-${chap.chapterNumber}_${cSubIdx + 1}`,
            chapterId: chap.id,
            sectionNumber: secNum,
            title: c.name,
            page: chap.pageStart,
            summary: c.text.slice(0, 120),
          });
        }

        knowledgeUnits.push({
          id: `ku-auto-${knowledgeUnits.length + 1}`,
          documentId,
          chapter: chap.title,
          section: `${secNum} ${c.name}`,
          name: c.name,
          type: determineKuType(c.name, c.text),
          description: c.text.slice(0, 160),
          importance: 'core',
          sourceChunkId: `chunk-auto-${chap.chapterNumber}-${cSubIdx + 1}`,
          sourceText: c.text,
          pageNumber: chap.pageStart,
        });
      });
    }
  });

  // Keep documents without chapter headings under one honest, document-level chapter.
  if (chapters.length === 0) {
    const chapterId = `chap-document-${Date.now()}`;
    const chapterTitle = `Nội dung tài liệu: ${fileName.replace(/\.[^/.]+$/, '')}`;
    const sourceBlocks = text
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter((block) => block.length > 30);
    const blocks = sourceBlocks.length > 1
      ? sourceBlocks
      : text.split(/(?<=[.!?])\s+/).map((block) => block.trim()).filter((block) => block.length > 30);
    const sections = blocks.map((block, index) => {
      const sourcePosition = text.indexOf(block);
      const page = Math.max(1, Math.floor(sourcePosition / 1600) + 1);
      const name = cleanConceptName(block.split(/\s+/).slice(0, 8).join(' '));
      const sectionNumber = `1.${index + 1}`;

      knowledgeUnits.push({
        id: `ku-document-${index + 1}`,
        documentId,
        chapter: chapterTitle,
        section: `${sectionNumber} ${name}`,
        name,
        type: determineKuType(name, block),
        description: block.slice(0, 160),
        importance: 'important',
        sourceChunkId: `chunk-document-${index + 1}`,
        sourceText: block,
        pageNumber: page,
      });

      return {
        id: `sec-document-${index + 1}`,
        chapterId,
        sectionNumber,
        title: name,
        page,
        summary: block.slice(0, 120),
      };
    });

    chapters.push({
      id: chapterId,
      chapterNumber: 1,
      title: chapterTitle,
      pageStart: 1,
      pageEnd: Math.max(1, Math.ceil(text.length / 1600)),
      sections,
    });
  }

  // Deduplicate chapters by chapterNumber or normalized title
  const deduplicatedChapters: DocumentChapter[] = [];
  const seenChapKeys = new Set<string>();

  for (const chap of chapters) {
    const key = `${chap.chapterNumber}-${chap.title.trim().toLowerCase()}`;
    if (!seenChapKeys.has(key)) {
      seenChapKeys.add(key);
      deduplicatedChapters.push(chap);
    } else {
      // If repeated (e.g. TOC vs body), merge sections or keep richer one
      const existing = deduplicatedChapters.find(
        (c) => `${c.chapterNumber}-${c.title.trim().toLowerCase()}` === key
      );
      if (existing) {
        if (chap.sections.length > existing.sections.length) {
          existing.sections = chap.sections;
          existing.pageEnd = Math.max(existing.pageEnd, chap.pageEnd);
        } else if (chap.sections.length > 0) {
          existing.sections.push(...chap.sections);
        }
      }
    }
  }

  // Ensure 100% unique IDs across all chapters
  const finalChapters = deduplicatedChapters.map((c, idx) => ({
    ...c,
    id: `chap-${c.chapterNumber || idx + 1}-${idx + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));

  return { chapters: finalChapters, knowledgeUnits };
}

function determineKuType(title: string, text: string): KnowledgeUnit['type'] {
  const lower = (title + ' ' + text).toLowerCase();
  if (lower.includes('định nghĩa') || lower.includes('là gì') || lower.includes('khái niệm')) return 'definition';
  if (lower.includes('nguyên lý') || lower.includes('định luật') || lower.includes('quy luật')) return 'principle';
  if (lower.includes('quy trình') || lower.includes('các bước') || lower.includes('quá trình')) return 'process';
  if (lower.includes('công thức') || lower.includes('tính toán')) return 'formula';
  if (lower.includes('quy tắc') || lower.includes('chuẩn')) return 'rule';
  if (lower.includes('so sánh') || lower.includes('khác biệt') || lower.includes('phân biệt')) return 'comparison';
  return 'concept';
}

function determineImportance(title: string): KnowledgeUnit['importance'] {
  const lower = title.toLowerCase();
  if (lower.includes('cơ bản') || lower.includes('tổng quan') || lower.includes('cốt lõi') || lower.includes('nền tảng')) {
    return 'core';
  }
  if (lower.includes('chi tiết') || lower.includes('phụ lục') || lower.includes('mở rộng')) {
    return 'supplementary';
  }
  return 'important';
}

export function cleanConceptName(raw: string): string {
  if (!raw) return 'Khái niệm trọng tâm';
  let s = raw.trim()
    .replace(/^[-*•\d.\s:–—]+/, '')
    .replace(/[:.\-–—]+$/, '')
    .trim();
  s = s.replace(/^(?:Các\s+khái\s+niệm\s+cơ\s+bản\s+về|Khái\s+niệm\s+cơ\s+bản\s+về|Khái\s+niệm\s+về|Khái\s+niệm\s+và|Tìm\s+hiểu\s+về|Tổng\s+quan\s+về|Nội\s+dung\s+về)\s+/i, '');
  s = s.trim();
  if (s.length > 55) {
    s = s.slice(0, 52) + '...';
  }
  if (!s || s.toLowerCase() === 'đơn vị kiến thức') {
    return 'Kiến thức cốt lõi';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Builds the Source Index: assigns chunks with chapterId, sectionId, pageNumber
 */
function buildSourceIndex(
  documentId: string,
  rawText: string,
  chapters: DocumentChapter[]
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 20);

  paragraphs.forEach((p, idx) => {
    const textSnippet = p.trim();
    const approxPage = Math.max(1, Math.floor(idx / 4) + 1);

    // Find closest matching chapter
    let matchedChapter = chapters[0];
    for (const chap of chapters) {
      if (approxPage >= chap.pageStart && approxPage <= chap.pageEnd) {
        matchedChapter = chap;
        break;
      }
    }

    const matchedSection = matchedChapter?.sections[0] || {
      id: 'sec-default',
      chapterId: matchedChapter?.id || 'chap-1',
      sectionNumber: '1.1',
      title: 'Khái quát chung',
      page: approxPage,
    };

    chunks.push({
      id: `chunk-${idx + 1}`,
      documentId,
      chapterId: matchedChapter?.id || 'chap-1',
      chapterTitle: matchedChapter?.title || 'Chương 1',
      sectionId: matchedSection.id,
      sectionTitle: `${matchedSection.sectionNumber} ${matchedSection.title}`,
      pageNumber: approxPage,
      content: textSnippet,
      startPosition: idx * 250,
      endPosition: idx * 250 + textSnippet.length,
    });
  });

  return chunks;
}

/**
 * Use Gemini API to analyze document structure and identify knowledge units
 */
async function tryAIStructureAnalysis(
  text: string,
  fileName: string
): Promise<{ chapters: DocumentChapter[]; knowledgeUnits: KnowledgeUnit[] } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const sampleExcerpt = text.slice(0, 12000);
    const prompt = `Phân tích cấu trúc tài liệu học tập sau đây (Tên tài liệu: "${fileName}").
Hãy trích xuất danh sách các Chương (Chapters), các Mục (Sections) và các Đơn vị kiến thức trọng tâm (Knowledge Units).
Đảm bảo tính chính xác và bám sát văn bản tiếng Việt.

Nội dung tài liệu:
"""
${sampleExcerpt}
"""

Trả về JSON tuân thủ cấu trúc sau:
{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chương 1 – ...",
      "pageStart": 1,
      "pageEnd": 10,
      "sections": [
        {
          "sectionNumber": "1.1",
          "title": "...",
          "page": 2,
          "summary": "..."
        }
      ]
    }
  ],
  "knowledgeUnits": [
    {
      "chapter": "Chương 1 – ...",
      "section": "1.1 ...",
      "name": "Tên đơn vị kiến thức (ví dụ: Mô hình OSI, Câu lệnh SELECT, ...)",
      "type": "concept" | "definition" | "principle" | "process" | "formula" | "rule" | "comparison",
      "description": "Mô tả ngắn gọn về đơn vị kiến thức này",
      "importance": "core" | "important" | "supplementary",
      "sourceText": "Đoạn văn bản nguyên gốc nói về kiến thức này",
      "pageNumber": 2
    }
  ]
}`;

    const response = await withGeminiTimeout(
      (abortSignal) =>
        generateGeminiContent(
          {
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          },
          { abortSignal }
        ),
      AI_STEP_TIMEOUT_MS,
      'Phân tích tài liệu (Gemini)'
    );

    if (response.text) {
      const parsed = JSON.parse(response.text);
      if (parsed.chapters && Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
        // Format with IDs
        const formattedChapters: DocumentChapter[] = parsed.chapters.map(
          (c: any, cIdx: number) => ({
            id: `chap-${c.chapterNumber || cIdx + 1}-${cIdx + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            chapterNumber: c.chapterNumber || cIdx + 1,
            title: c.title || `Chương ${cIdx + 1}`,
            pageStart: c.pageStart || 1,
            pageEnd: c.pageEnd || 10,
            sections: (c.sections || []).map((s: any, sIdx: number) => ({
              id: `sec-${cIdx + 1}_${sIdx + 1}`,
              chapterId: `chap-${c.chapterNumber || cIdx + 1}`,
              sectionNumber: s.sectionNumber || `${cIdx + 1}.${sIdx + 1}`,
              title: s.title || `Mục ${sIdx + 1}`,
              page: s.page || c.pageStart || 1,
              summary: s.summary || '',
            })),
          })
        );

        const formattedKus: KnowledgeUnit[] = (parsed.knowledgeUnits || []).map(
          (ku: any, kIdx: number) => ({
            id: `ku-ai-${kIdx + 1}`,
            documentId: `doc-${Date.now()}`,
            chapter: ku.chapter || (formattedChapters[0]?.title ?? 'Chương 1'),
            section: ku.section || '1.1 Tổng quan',
            name: ku.name || 'Khái niệm',
            type: ku.type || 'concept',
            description: ku.description || '',
            importance: ku.importance || 'core',
            sourceChunkId: `chunk-ai-${kIdx + 1}`,
            sourceText: ku.sourceText || ku.description || '',
            pageNumber: ku.pageNumber || 1,
          })
        );

        return { chapters: formattedChapters, knowledgeUnits: formattedKus };
      }
    }
  } catch (error) {
    console.warn('Gemini structure extraction fallback to rule-based parser:', error);
  }

  return null;
}
