import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  pageCount: number;
  fileType: 'pdf' | 'docx' | 'txt';
  extractionStatus: 'success' | 'failed';
  errorMessage?: string;
}

/**
 * Checks if raw content contains binary zip/docx signatures
 */
export function isBinaryZipOrDocx(content: string): boolean {
  if (!content) return false;
  const sample = content.slice(0, 1000);
  return (
    sample.startsWith('PK') ||
    sample.includes('[Content_Types].xml') ||
    sample.includes('word/document.xml') ||
    sample.includes('_rels/.rels') ||
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(sample)
  );
}

/**
 * Checks if text is corrupt binary or contains too many replacement characters
 */
export function isCorruptedBinaryText(text: string): boolean {
  if (!text) return false;
  if (isBinaryZipOrDocx(text)) return true;
  // If more than 5% of characters are replacement character or null bytes
  const nullOrReplacements = (text.match(/[\uFFFD\x00]/g) || []).length;
  if (nullOrReplacements > 50 && nullOrReplacements / text.length > 0.03) {
    return true;
  }
  return false;
}

/**
 * Clean and normalize Vietnamese Unicode string (NFC standard)
 */
export function normalizeVietnameseText(text: string): string {
  if (!text) return '';

  // Reject raw binary strings immediately
  if (isBinaryZipOrDocx(text)) {
    throw new Error(
      'Dữ liệu chứa mã nhị phân DOCX/ZIP (PK.../[Content_Types].xml). Cần sử dụng bộ giải mã DOCX chuyên dụng (mammoth), không thể đọc bằng text thông thường.'
    );
  }

  return text
    .normalize('NFC') // Chuẩn hóa Unicode tiếng Việt tổ hợp -> dựng sẵn
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '') // Loại bỏ ký tự điều khiển lạ
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract text safely from buffer based on file type
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  explicitType?: 'pdf' | 'docx' | 'txt'
): Promise<ExtractionResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  // Prefer the file signature so that files such as `TaiLieu.PDF` are never
  // decoded as plain text merely because of an incorrect extension or MIME type.
  const hasPdfSignature = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const hasZipSignature = buffer.subarray(0, 4).toString('ascii') === 'PK\x03\x04';
  const fileType: 'pdf' | 'docx' | 'txt' = hasPdfSignature
    ? 'pdf'
    : hasZipSignature || ext === 'docx'
      ? 'docx'
      : explicitType || 'txt';

  if (buffer.length === 0) {
    return {
      text: '',
      pageCount: 1,
      fileType,
      extractionStatus: 'failed',
      errorMessage: 'Tệp tải lên đang rỗng.',
    };
  }

  try {
    if (fileType === 'docx' || ext === 'docx') {
      // DOCX: Extract using Mammoth to parse zip container & document.xml paragraphs
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value || '';

      if (!rawText.trim()) {
        return {
          text: '',
          pageCount: 1,
          fileType: 'docx',
          extractionStatus: 'failed',
          errorMessage: 'Tập tin DOCX không chứa văn bản có thể trích xuất.',
        };
      }

      // Check if mammoth accidentally returned binary (should never happen)
      if (isBinaryZipOrDocx(rawText)) {
        return {
          text: '',
          pageCount: 1,
          fileType: 'docx',
          extractionStatus: 'failed',
          errorMessage: 'Lỗi giải mã DOCX: kết quả chứa chuỗi nhị phân PK.',
        };
      }

      const cleaned = normalizeVietnameseText(rawText);
      const pageCount = Math.max(1, Math.ceil(cleaned.length / 1800));

      return {
        text: cleaned,
        pageCount,
        fileType: 'docx',
        extractionStatus: 'success',
      };
    }

    if (fileType === 'pdf' || ext === 'pdf') {
      // PDF: Extract using pdf-parse PDFParse class
      if (!hasPdfSignature) {
        return {
          text: '',
          pageCount: 1,
          fileType: 'pdf',
          extractionStatus: 'failed',
          errorMessage: 'Tệp được chọn không phải là PDF hợp lệ. Vui lòng tải lại tệp có đuôi .pdf.',
        };
      }
      const parser = new PDFParse({ data: buffer });
      let rawText = '';
      let pageTotal = 1;
      try {
        const parsed = await parser.getText();
        rawText = parsed.text || '';
        pageTotal = parsed.total || 1;
      } finally {
        await parser.destroy().catch(() => {});
      }

      if (!rawText.trim()) {
        return {
          text: '',
          pageCount: pageTotal || 1,
          fileType: 'pdf',
          extractionStatus: 'failed',
          errorMessage:
            'Không tìm thấy văn bản dạng text trong PDF. Nếu đây là tài liệu scan dạng hình ảnh, vui lòng chuyển đổi qua OCR trước.',
        };
      }

      const cleaned = normalizeVietnameseText(rawText);
      const pageCount = pageTotal || Math.max(1, Math.ceil(cleaned.length / 1800));

      return {
        text: cleaned,
        pageCount,
        fileType: 'pdf',
        extractionStatus: 'success',
      };
    }

    // Default: Plain text (TXT)
    // UTF-8 decoding
    let decoded = buffer.toString('utf-8');

    // Check if user renamed a .docx or .pdf to .txt
    if (isBinaryZipOrDocx(decoded)) {
      return {
        text: '',
        pageCount: 1,
        fileType: 'txt',
        extractionStatus: 'failed',
        errorMessage:
          'Tập tin chứa mã nhị phân ZIP/DOCX. Vui lòng giữ đúng đuôi file .docx hoặc .pdf để hệ thống giải nén chính xác.',
      };
    }

    const cleaned = normalizeVietnameseText(decoded);
    return {
      text: cleaned,
      pageCount: Math.max(1, Math.ceil(cleaned.length / 1800)),
      fileType: 'txt',
      extractionStatus: 'success',
    };
  } catch (err: any) {
    console.error('Error during file extraction:', err);
    return {
      text: '',
      pageCount: 1,
      fileType,
      extractionStatus: 'failed',
      errorMessage: err.message || 'Lỗi trích xuất tập tin',
    };
  }
}
