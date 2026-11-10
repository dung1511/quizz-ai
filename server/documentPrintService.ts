import { DocumentSource, SampleDocument } from '../src/types';

export function generateDocumentPrintHTML(
  doc: DocumentSource | SampleDocument,
  extraMeta?: { uploadDate?: string }
): string {
  const title = doc.title || doc.fileName || 'Tài liệu học tập';
  const fileName = doc.fileName || 'TaiLieu.pdf';
  const fileType = ('fileType' in doc ? doc.fileType : fileName.split('.').pop() || 'pdf').toUpperCase();
  const fileSize = doc.fileSize || 'N/A';
  const pageCount = doc.pageCount || 1;
  const chapters = doc.chapters || [];
  const knowledgeUnits = doc.knowledgeUnits || [];
  const uploadDate = extraMeta?.uploadDate || 'Hôm nay';
  const content = 'rawText' in doc ? doc.rawText : doc.content || '';

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>In tài liệu - ${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: "Trang " counter(page) " / " counter(pages);
      }
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, 'DejaVu Serif', serif;
      font-size: 13.5px;
      line-height: 1.6;
      color: #111827;
      margin: 0;
      padding: 24px;
      background-color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .doc-header {
      text-align: center;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .doc-title {
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      color: #1e3a8a;
      margin: 0 0 8px 0;
    }
    .meta-box {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 12.5px;
    }
    .meta-item strong {
      color: #334155;
    }
    .chapters-summary {
      margin-bottom: 24px;
      padding: 12px 16px;
      background-color: #f1f5f9;
      border-left: 3px solid #3b82f6;
      font-size: 12px;
    }
    .doc-content {
      white-space: pre-wrap;
      font-size: 13.5px;
      line-height: 1.65;
      text-align: justify;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="doc-header">
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-bottom: 4px;">
      TÀI LIỆU HỌC TẬP VÀ ÔN LUYỆN KHẢO THÍ
    </div>
    <h1 class="doc-title">${escapeHtml(title)}</h1>
    <div style="font-size: 12px; font-style: italic; color: #64748b;">
      Lưu trữ trên hệ thống AI Khảo thí Enterprise
    </div>
  </div>

  <!-- METADATA BOX -->
  <div class="meta-box">
    <div class="meta-item"><strong>Tên tập tin:</strong> ${escapeHtml(fileName)}</div>
    <div class="meta-item"><strong>Định dạng:</strong> ${fileType}</div>
    <div class="meta-item"><strong>Dung lượng:</strong> ${escapeHtml(fileSize)}</div>
    <div class="meta-item"><strong>Ngày tải lên:</strong> ${escapeHtml(uploadDate)}</div>
    <div class="meta-item"><strong>Số trang ước tính:</strong> ${pageCount} trang</div>
    <div class="meta-item"><strong>Số chương / đề mục:</strong> ${chapters.length} chương</div>
    <div class="meta-item" style="grid-column: span 3;">
      <strong>Đơn vị kiến thức trọng tâm (${knowledgeUnits.length}):</strong> 
      ${knowledgeUnits.map((ku) => escapeHtml(ku.name)).join(', ') || 'Đang cập nhật'}
    </div>
  </div>

  <!-- CHAPTERS OVERVIEW IF PRESENT -->
  ${
    chapters.length > 0
      ? `
    <div class="chapters-summary">
      <strong style="display: block; margin-bottom: 6px; text-transform: uppercase; color: #1e3a8a;">
        Cấu trúc chương mục tài liệu:
      </strong>
      <ol style="margin: 0; padding-left: 20px;">
        ${chapters
          .map(
            (c) => `
          <li style="margin-bottom: 4px;">
            <strong>${escapeHtml(c.title)}</strong> (Trang ${c.pageStart} - ${c.pageEnd})
            ${
              c.sections.length > 0
                ? `<ul style="padding-left: 16px; font-weight: normal; color: #475569;">
                    ${c.sections.map((s) => `<li>${escapeHtml(s.sectionNumber)}: ${escapeHtml(s.title)}</li>`).join('')}
                   </ul>`
                : ''
            }
          </li>
        `
          )
          .join('')}
      </ol>
    </div>
  `
      : ''
  }

  <!-- CONTENT -->
  <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid #94a3b8; padding-bottom: 4px;">
    NỘI DUNG TOÀN VĂN TÀI LIỆU
  </div>
  <div class="doc-content">${escapeHtml(content)}</div>

  <!-- FOOTER -->
  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-style: italic; color: #64748b;">
    In tự động từ Hệ thống QuizAI Enterprise — Báo cáo minh chứng tài liệu học tập
  </div>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
