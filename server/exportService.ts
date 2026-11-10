import { QuizSet, ExamPaperConfig } from '../src/types';

export function generatePaperExamHTML(
  quizSet: QuizSet,
  config: ExamPaperConfig
): string {
  const {
    schoolName = 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ',
    facultyName = 'KHOA CÔNG NGHỆ THÔNG TIN',
    subjectName = quizSet.title,
    examName = 'ĐỀ THI KẾT THÚC HỌC PHẦN',
    examCode = '001',
    durationMinutes = quizSet.recommendedMinutes || 60,
    exportMode = 'exam_only',
    fontSize = 'md',
    columns = 1,
    candidateNamePlaceholder = 'Họ và tên thí sinh',
    candidateIdPlaceholder = 'Mã số sinh viên',
  } = config;

  const fontBaseClass =
    fontSize === 'sm' ? '13px' : fontSize === 'lg' ? '16px' : '14px';

  // 1. QUESTIONS SECTION (STRICTLY QUESTIONS ONLY)
  // No answers, no explanations, no sources here!
  const questionsHtml = quizSet.questions
    .map((q, idx) => {
      const isTwoCol = columns === 2;
      return `
        <div class="question-item" style="margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid;">
          <div style="font-weight: 700; color: #111827; margin-bottom: 6px; line-height: 1.45;">
            <span>Câu ${idx + 1}.</span> ${escapeHtml(q.questionText)}
          </div>
          <div style="${
            isTwoCol
              ? 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'
              : 'display: flex; flex-direction: column; gap: 5px;'
          } padding-left: 18px;">
            ${q.options
              .map(
                (opt) => `
              <div style="display: flex; align-items: baseline; gap: 8px; font-size: ${fontBaseClass}; line-height: 1.4;">
                <span style="font-weight: 700; min-width: 20px;">${opt.key}.</span>
                <span>${escapeHtml(opt.text)}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  // 2. ANSWER KEY SECTION (Only when mode includes answers)
  let answerKeySection = '';
  if (
    exportMode === 'exam_with_answers' ||
    exportMode === 'exam_with_explanations' ||
    exportMode === 'full_with_source'
  ) {
    const totalQ = quizSet.questions.length;
    const chunkSize = 10;
    const chunkCount = Math.ceil(totalQ / chunkSize);
    let tablesHtml = '';

    for (let c = 0; c < chunkCount; c++) {
      const slice = quizSet.questions.slice(c * chunkSize, (c + 1) * chunkSize);
      tablesHtml += `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; text-align: center; font-size: 13px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #9ca3af; padding: 6px; width: 60px; font-weight: bold;">Câu</th>
              ${slice.map((_, i) => `<th style="border: 1px solid #9ca3af; padding: 6px;">${c * chunkSize + i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #9ca3af; padding: 6px; font-weight: bold; background-color: #f9fafb;">Đáp án</td>
              ${slice.map((q) => `<td style="border: 1px solid #9ca3af; padding: 6px; font-weight: bold; color: #1e3a8a;">${q.correctAnswer}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      `;
    }

    answerKeySection = `
      <div class="page-break" style="page-break-before: always; break-before: page; margin-top: 30px; padding-top: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0;">BẢNG ĐÁP ÁN TRẮC NGHIỆM</h2>
          <p style="font-size: 13px; font-style: italic; color: #4b5563; margin-top: 4px;">(Kèm theo Đề thi môn: ${escapeHtml(subjectName)} – Mã đề: ${escapeHtml(examCode)})</p>
        </div>
        ${tablesHtml}
      </div>
    `;
  }

  // 3. EXPLANATION SECTION (Only when mode includes explanations)
  let explanationSection = '';
  if (exportMode === 'exam_with_explanations' || exportMode === 'full_with_source') {
    explanationSection = `
      <div style="margin-top: 24px; padding-top: 16px;">
        <h3 style="font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; color: #1e3a8a;">
          ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT
        </h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${quizSet.questions
            .map(
              (q, idx) => `
            <div style="page-break-inside: avoid; break-inside: avoid; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              <div style="font-weight: bold; margin-bottom: 4px;">
                <span>Câu ${idx + 1}:</span>
                <span style="color: #047857; margin-left: 6px;">Đáp án đúng là ${q.correctAnswer}</span>
              </div>
              <div style="font-size: 13px; color: #374151; line-height: 1.5;">
                <strong>Giải thích:</strong> ${escapeHtml(q.explanation)}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // 4. PEDAGOGICAL SOURCE TABLE FOR TEACHERS / ADMINS (Only for 'full_with_source')
  let teacherSourceSection = '';
  if (exportMode === 'full_with_source') {
    teacherSourceSection = `
      <div class="page-break" style="page-break-before: always; break-before: page; margin-top: 30px; padding-top: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; color: #1e3a8a;">
            BẢNG NGUỒN CÂU HỎI & CĂN CỨ SƯ PHẠM
          </h2>
          <p style="font-size: 12px; font-style: italic; color: #4b5563; margin-top: 4px;">
            (Tài liệu kiểm định dành cho Giảng viên / Hội đồng khảo thí – Khẳng định tính bám sát tài liệu 100%)
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.4;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: center;">
              <th style="border: 1px solid #94a3b8; padding: 6px; width: 35px;">Câu</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; width: 140px;">Chương / Mục</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; width: 45px;">Trang</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; width: 130px;">Đơn vị kiến thức</th>
              <th style="border: 1px solid #94a3b8; padding: 6px; width: 40px;">Đ/A</th>
              <th style="border: 1px solid #94a3b8; padding: 6px;">Dẫn chứng tài liệu & Căn cứ sinh câu hỏi</th>
            </tr>
          </thead>
          <tbody>
            ${quizSet.questions
              .map(
                (q, idx) => `
              <tr style="page-break-inside: avoid; break-inside: avoid;">
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px;">
                  <strong>${escapeHtml(q.source.chapter)}</strong><br/>
                  <span style="color: #4b5563;">${escapeHtml(q.source.section)}</span>
                </td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; font-weight: bold;">${q.source.page}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; font-weight: 600; color: #1e3a8a;">
                  ${escapeHtml(q.source.knowledgeUnit)}
                </td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; font-weight: bold; color: #047857;">${q.correctAnswer}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px;">
                  <div style="margin-bottom: 3px;">
                    <strong style="color: #4338ca;">Căn cứ sư phạm:</strong> ${escapeHtml(q.source.generationReason)}
                  </div>
                  <div style="font-style: italic; color: #374151; background-color: #f8fafc; padding: 4px 6px; border-left: 2px solid #6366f1;">
                    "${escapeHtml(q.source.sourceText)}"
                  </div>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 5. BUBBLE SHEET (Optional mode)
  let bubbleSheet = '';
  if (exportMode === 'exam_with_bubble') {
    bubbleSheet = `
      <div class="page-break" style="page-break-before: always; break-before: page; margin-top: 30px; padding-top: 20px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0;">PHIẾU TRẢ LỜI TRẮC NGHIỆM</h2>
          <p style="font-size: 12px; font-style: italic; color: #4b5563; margin-top: 4px;">
            (Thí sinh dùng bút chì 2B tô kín ô tròn tương ứng với phương án lựa chọn đúng)
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; font-size: 12px;">
          ${quizSet.questions
            .map(
              (q, i) => `
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 4px 0;">
              <span style="font-weight: bold; width: 28px;">${i + 1}.</span>
              <div style="display: flex; gap: 6px;">
                ${['A', 'B', 'C', 'D']
                  .map(
                    (c) => `
                  <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #64748b; text-align: center; line-height: 18px; font-size: 10px; font-weight: bold; color: #475569;">
                    ${c}
                  </span>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>Đề thi trắc nghiệm - ${escapeHtml(subjectName)} - Mã đề ${escapeHtml(examCode)}</title>
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
      font-size: ${fontBaseClass};
      line-height: 1.45;
      color: #111827;
      margin: 0;
      padding: 24px;
      background-color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .exam-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #111827;
    }
    .header-col {
      width: 48%;
      text-align: center;
    }
    .candidate-box {
      margin-bottom: 16px;
      padding: 10px 14px;
      border: 1px dashed #6b7280;
      font-size: 13px;
      line-height: 1.8;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    .question-item {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .exam-footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #d1d5db;
      font-style: italic;
      color: #4b5563;
      page-break-inside: avoid;
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
  <!-- HEADER ĐỀ THI -->
  <div class="exam-header">
    <div class="header-col">
      <div style="font-weight: 700; font-size: 14px; text-transform: uppercase;">${escapeHtml(schoolName)}</div>
      <div style="font-weight: 700; font-size: 13px; text-transform: uppercase;">${escapeHtml(facultyName)}</div>
      <div style="margin-top: 4px; letter-spacing: 2px;">-------------------</div>
    </div>
    <div class="header-col">
      <div style="font-weight: 700; font-size: 14px; text-transform: uppercase;">${escapeHtml(examName)}</div>
      <div style="font-weight: 700; font-size: 13px; text-transform: uppercase;">MÔN THI: ${escapeHtml(subjectName)}</div>
      <div style="font-size: 12px; font-style: italic; margin-top: 2px;">Thời gian làm bài: ${durationMinutes} phút (Không kể thời gian phát đề)</div>
      <div style="font-weight: 700; font-size: 13px; margin-top: 2px;">Mã đề thi: ${escapeHtml(examCode)}</div>
    </div>
  </div>

  <!-- THÔNG TIN THÍ SINH -->
  <div class="candidate-box">
    <div><strong>${escapeHtml(candidateNamePlaceholder)}:</strong> ....................................................................................   <strong>${escapeHtml(candidateIdPlaceholder)}:</strong> ..................................</div>
    <div><strong>Lớp / Khóa:</strong> ................................................................   <strong>Phòng thi:</strong> .....................   <strong>Số báo danh:</strong> ...................</div>
  </div>

  <!-- NỘI DUNG ĐỀ THI (CHỈ GỒM CÂU HỎI VÀ PHƯƠNG ÁN) -->
  <div class="exam-body">
    ${questionsHtml}
  </div>

  <!-- KẾT THÚC ĐỀ -->
  <div class="exam-footer">
    <div style="font-weight: bold; letter-spacing: 2px; font-size: 14px; text-transform: uppercase; margin-bottom: 4px;">
      ---------- HẾT ----------
    </div>
    <div style="font-size: 12px;">(Cán bộ coi thi không giải thích gì thêm. Thí sinh không được sử dụng tài liệu)</div>
  </div>

  <!-- PHIẾU TÔ (NẾU CHỌN) -->
  ${bubbleSheet}

  <!-- BẢNG ĐÁP ÁN (NẾU CHỌN) -->
  ${answerKeySection}

  <!-- GIẢI THÍCH CHI TIẾT (NẾU CHỌN) -->
  ${explanationSection}

  <!-- BẢNG NGUỒN CÂU HỎI & CĂN CỨ SƯ PHẠM (NẾU CHỌN) -->
  ${teacherSourceSection}
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
