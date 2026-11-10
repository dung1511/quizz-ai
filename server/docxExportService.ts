import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';
import { QuizSet, ExamPaperConfig } from '../src/types';

export async function generatePaperExamDOCX(
  quizSet: QuizSet,
  config: ExamPaperConfig
): Promise<Buffer> {
  const {
    schoolName = 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ',
    facultyName = 'KHOA CÔNG NGHỆ THÔNG TIN',
    subjectName = quizSet.title,
    examName = 'ĐỀ THI KẾT THÚC HỌC PHẦN',
    examCode = '001',
    durationMinutes = quizSet.recommendedMinutes || 60,
    candidateNamePlaceholder = 'Họ và tên thí sinh',
    candidateIdPlaceholder = 'Mã số sinh viên',
    exportMode = 'exam_only',
  } = config;

  const children: (Paragraph | Table)[] = [];

  const FONT_NAME = 'Times New Roman';

  // 1. HEADER SECTION (Table with 2 columns: Left = School/Faculty, Right = Exam info)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          // Left Cell
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: schoolName.toUpperCase(),
                    bold: true,
                    size: 24, // 12pt
                    font: FONT_NAME,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: facultyName.toUpperCase(),
                    bold: true,
                    size: 22, // 11pt
                    font: FONT_NAME,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: '---------------------',
                    size: 20,
                    font: FONT_NAME,
                  }),
                ],
              }),
            ],
          }),
          // Right Cell
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: examName.toUpperCase(),
                    bold: true,
                    size: 24,
                    font: FONT_NAME,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `MÔN THI: ${subjectName.toUpperCase()}`,
                    bold: true,
                    size: 22,
                    font: FONT_NAME,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Thời gian làm bài: ${durationMinutes} phút (Không kể thời gian phát đề)`,
                    italics: true,
                    size: 20,
                    font: FONT_NAME,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Mã đề thi: ${examCode}`,
                    bold: true,
                    size: 22,
                    font: FONT_NAME,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(headerTable);

  // 2. CANDIDATE INFO BOX
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: `${candidateNamePlaceholder}: ..........................................................................    `,
          font: FONT_NAME,
          size: 22,
        }),
        new TextRun({
          text: `${candidateIdPlaceholder}: ...................................`,
          font: FONT_NAME,
          size: 22,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'Lớp / Khóa học: .................................................................................    Phòng thi: .....................   Số báo danh: ................',
          font: FONT_NAME,
          size: 22,
        }),
      ],
    })
  );

  // Separator
  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: '====================================================================================',
          font: FONT_NAME,
          size: 18,
        }),
      ],
    })
  );

  // 3. QUESTIONS BODY (STRICTLY QUESTIONS & CHOICES ONLY)
  quizSet.questions.forEach((q, idx) => {
    // Question title
    children.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: `Câu ${idx + 1}: `,
            bold: true,
            size: 24, // 12pt
            font: FONT_NAME,
          }),
          new TextRun({
            text: q.questionText,
            size: 24,
            font: FONT_NAME,
          }),
        ],
      })
    );

    // Options A, B, C, D
    q.options.forEach((opt) => {
      children.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `${opt.key}. `,
              bold: true,
              size: 22,
              font: FONT_NAME,
            }),
            new TextRun({
              text: opt.text,
              size: 22,
              font: FONT_NAME,
            }),
          ],
        })
      );
    });
  });

  // End of test marker
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: '---------------------------------------- HẾT ----------------------------------------',
          bold: true,
          size: 22,
          font: FONT_NAME,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: '(Cán bộ coi thi không giải thích gì thêm. Thí sinh không được sử dụng tài liệu)',
          italics: true,
          size: 20,
          font: FONT_NAME,
        }),
      ],
    })
  );

  // 4. ANSWER KEYS / EXPLANATIONS / SOURCES (Only appended if requested by mode)
  if (exportMode !== 'exam_only') {
    // Add page break
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: `BẢNG ĐÁP ÁN TRẮC NGHIỆM – MÃ ĐỀ ${examCode}`,
            bold: true,
            size: 26,
            font: FONT_NAME,
          }),
        ],
      })
    );

    // Build answer grid table (10 items per row)
    const tableRows: TableRow[] = [];
    const chunkSize = 10;
    for (let i = 0; i < quizSet.questions.length; i += chunkSize) {
      const slice = quizSet.questions.slice(i, i + chunkSize);

      // Row 1: Question numbers
      const qNumCells = [
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Câu', bold: true, size: 20, font: FONT_NAME })],
            }),
          ],
        }),
        ...slice.map(
          (item, subIdx) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${i + subIdx + 1}`, bold: true, size: 20, font: FONT_NAME })],
                }),
              ],
            })
        ),
      ];

      // Row 2: Answers
      const ansCells = [
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Đáp án', bold: true, size: 20, font: FONT_NAME })],
            }),
          ],
        }),
        ...slice.map(
          (item) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: item.correctAnswer, bold: true, size: 22, font: FONT_NAME })],
                }),
              ],
            })
        ),
      ];

      tableRows.push(new TableRow({ children: qNumCells }));
      tableRows.push(new TableRow({ children: ansCells }));
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );

    // If 'exam_with_explanations' or 'full_with_source', output detailed explanations
    if (exportMode === 'exam_with_explanations' || exportMode === 'full_with_source') {
      children.push(
        new Paragraph({
          spacing: { before: 400, after: 160 },
          children: [
            new TextRun({
              text: 'ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT:',
              bold: true,
              size: 24,
              font: FONT_NAME,
            }),
          ],
        })
      );

      quizSet.questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `Câu ${idx + 1}: `,
                bold: true,
                size: 22,
                font: FONT_NAME,
              }),
              new TextRun({
                text: `Đáp án ${q.correctAnswer}`,
                bold: true,
                color: '006C49',
                size: 22,
                font: FONT_NAME,
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `Giải thích: ${q.explanation}`,
                size: 20,
                font: FONT_NAME,
              }),
            ],
          })
        );
      });
    }

    // If 'full_with_source', output Pedagogical Source Table for Teachers / Admins
    if (exportMode === 'full_with_source') {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 160 },
          children: [
            new TextRun({
              text: 'BẢNG NGUỒN CÂU HỎI & CĂN CỨ SƯ PHẠM (DÀNH CHO GIẢNG VIÊN)',
              bold: true,
              size: 26,
              font: FONT_NAME,
            }),
          ],
        })
      );

      const sourceTableRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Câu', bold: true, size: 20, font: FONT_NAME })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Chương / Mục', bold: true, size: 20, font: FONT_NAME })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Trang', bold: true, size: 20, font: FONT_NAME })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Đơn vị kiến thức', bold: true, size: 20, font: FONT_NAME })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 44, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Căn cứ sư phạm & Đoạn trích nguồn tài liệu',
                      bold: true,
                      size: 20,
                      font: FONT_NAME,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ];

      quizSet.questions.forEach((q, idx) => {
        sourceTableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${idx + 1}`, bold: true, size: 18, font: FONT_NAME })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${q.source.chapter}\n${q.source.section}`,
                        size: 18,
                        font: FONT_NAME,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${q.source.page}`, size: 18, font: FONT_NAME })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: q.source.knowledgeUnit, size: 18, font: FONT_NAME })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Mục đích: ${q.source.generationReason}\n`,
                        bold: true,
                        size: 18,
                        font: FONT_NAME,
                      }),
                      new TextRun({
                        text: `Trích đoạn: "${q.source.sourceText}"`,
                        italics: true,
                        size: 18,
                        font: FONT_NAME,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: sourceTableRows,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
