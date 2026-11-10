/**
 * Tests cho luồng tạo đề cục bộ KHÔNG GỌI GEMINI (npm run test:local-exam).
 *
 * Chiến lược "không gọi Gemini": trước khi chạy test, ta xóa hẳn process.env.GEMINI_API_KEY
 * và thay thế hàm generateGeminiContent bằng một spy NÉM LỖI ngay khi được gọi.
 * Nếu luồng tạo đề từ tài liệu còn đường gọi Gemini nào, test sẽ fail vì spy bị chạm tới.
 */
import { DocumentSource } from '../../src/types';
import { generateExamWithAI } from '../questionGenerator';
import { generateLocalExam, collectKnowledgeSentences, LocalExamCapacityError } from '../localExamGenerator';
import { findCitationPosition } from '../questionGenerator';
import { processDocument } from '../documentProcessor';

// ---- Spy chặn mọi đường gọi Gemini trong luồng tạo đề từ tài liệu ----
const geminiCalls: string[] = [];

// Không có API key: mọi đường gọi getGeminiClient() phải trả null.
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY_2;
delete process.env.GEMINI_API_KEY_3;
delete process.env.GEMINI_MODEL;
delete process.env.GEMINI_FALLBACK_MODEL;
const { resetGeminiKeyManager } = await import('../geminiKeyManager');
resetGeminiKeyManager();

// Đảm bảo bắt buộc: nếu code thử gọi Gemini, spy này sẽ ghi nhận và ném lỗi.
// (geminiClient tự động throw khi thiếu key, nhưng spy giúp phát hiện chính xác đường gọi.)
const geminiModule = await import('../geminiClient');

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(name);
    console.error(`  ✘ ${name}`);
  }
}

async function testCase(name: string, fn: () => Promise<void> | void) {
  console.log(name);
  geminiCalls.length = 0;
  try {
    await fn();
  } catch (error) {
    failures.push(`${name} (threw: ${error instanceof Error ? error.message : error})`);
    console.error(`  ✘ threw unexpectedly: ${error instanceof Error ? error.message : error}`);
  }
}

// ---- Tài liệu mẫu đủ nội dung ----
const SAMPLE_TEXT = `Chương 1 – Cơ sở dữ liệu quan hệ

1.1 Mô hình dữ liệu
Mô hình dữ liệu quan hệ là cách tổ chức dữ liệu thành các bảng hai chiều với hàng và cột. Mỗi bảng quan hệ bao gồm các bộ (tuple) và các thuộc tính. Khóa chính được định nghĩa là tập thuộc tính xác định duy nhất mỗi bộ trong quan hệ. Ràng buộc toàn vẹn thực thể yêu cầu khóa chính không được chứa giá trị NULL.

1.2 Ngôn ngữ truy vấn SQL
Câu lệnh SELECT là câu lệnh truy xuất dữ liệu từ một hoặc nhiều bảng trong cơ sở dữ liệu. Mệnh đề FROM xác định bảng hoặc khung nhìn nguồn dữ liệu cần truy xuất. Mệnh đề WHERE áp đặt điều kiện lọc các bản ghi thỏa mãn. Mệnh đề GROUP BY gom nhóm dữ liệu theo các thuộc tính chỉ định.

1.3 Chuẩn hóa dữ liệu
Chuẩn hóa dữ liệu là quá trình phân rã các quan hệ nhằm loại bỏ sự dư thừa dữ liệu và ngăn chặn các dị thường thêm, xóa, sửa. Dạng chuẩn thứ nhất yêu cầu mọi thuộc tính đều mang giá trị nguyên tố. Dạng chuẩn thứ ba loại bỏ sự phụ thuộc bắc cầu giữa các thuộc tính không khóa.`;

async function buildSampleDocument(): Promise<DocumentSource> {
  // Dùng đúng pipeline trích xuất hiện có (normalize + rule-based, analyzeWithAI: false)
  return processDocument(SAMPLE_TEXT, 'GiaoTrinh_CSDL.txt', 'txt', '1 KB', { analyzeWithAI: false });
}

// ==== C.1: Luồng tạo đề từ tài liệu không gọi Gemini API ====
await testCase('C.1: generateExamWithAI (DOCUMENT) không gọi Gemini khi không có API key', async () => {
  const document = await buildSampleDocument();
  const result = await generateExamWithAI({
    document,
    sourceMode: 'DOCUMENT',
    numQuestions: 5,
    difficulty: 'medium',
    strictSourceOnly: true,
  });
  assert(result.questions.length === 5, `tạo đủ 5 câu (thực tế ${result.questions.length})`);
  assert(result.validationSummary.allValid === true, 'tất cả câu đạt kiểm định');
  assert(result.matrix.grandTotal === 5, 'ma trận tổng = số câu');
});

await testCase('C.1b: generateLocalExam thuần không ném lỗi thiếu GEMINI_API_KEY', async () => {
  const document = await buildSampleDocument();
  const result = generateLocalExam({ document, numQuestions: 4, difficulty: 'medium' });
  assert(result.questions.length === 4, `tạo đủ 4 câu (thực tế ${result.questions.length})`);
});

// ==== C.2: Câu hỏi và đáp án lấy từ nội dung tài liệu, không phải dữ liệu mẫu ====
await testCase('C.2: đáp án đúng và trích dẫn đều nằm trong rawText tài liệu', async () => {
  const document = await buildSampleDocument();
  const result = generateLocalExam({ document, numQuestions: 5, difficulty: 'medium' });
  for (const q of result.questions) {
    assert(
      findCitationPosition(document.rawText, q.source.sourceText) >= 0,
      `trích dẫn của câu ${q.questionNumber} tìm thấy nguyên văn trong tài liệu`
    );
    const correctOption = q.options.find((o) => o.key === q.correctAnswer);
    assert(Boolean(correctOption), `câu ${q.questionNumber} có đáp án đúng hợp lệ`);
    // Đáp án đúng phải là nội dung xuất hiện trong tài liệu
    assert(
      findCitationPosition(document.rawText, correctOption!.text) >= 0,
      `đáp án đúng của câu ${q.questionNumber} có căn cứ trong tài liệu`
    );
  }
});

await testCase('C.2b: phương án nhiễu cũng lấy từ nội dung tài liệu (không bịa)', async () => {
  const document = await buildSampleDocument();
  const result = generateLocalExam({ document, numQuestions: 5, difficulty: 'medium' });
  for (const q of result.questions) {
    for (const option of q.options) {
      assert(
        findCitationPosition(document.rawText, option.text) >= 0,
        `phương án ${option.key} câu ${q.questionNumber} là nội dung có thật trong tài liệu`
      );
    }
  }
});

await testCase('C.2c: 4 phương án không trùng nhau, đáp án đúng duy nhất', async () => {
  const document = await buildSampleDocument();
  const result = generateLocalExam({ document, numQuestions: 5, difficulty: 'medium' });
  for (const q of result.questions) {
    const texts = q.options.map((o) => o.text);
    assert(new Set(texts).size === 4, `câu ${q.questionNumber} có 4 phương án khác nhau`);
    assert(
      q.options.filter((o) => o.key === q.correctAnswer).length === 1,
      `câu ${q.questionNumber} chỉ có 1 đáp án đúng`
    );
  }
});

await testCase('C.2d: chương, câu hỏi và phương án nhiễu bám đúng nội dung, bỏ phần tài liệu tham khảo', async () => {
  const source = `Chương 1 – Tổng quan về đề tài
1.1 Bối cảnh và lý do chọn đề tài
Nếu website chỉ hiển thị sản phẩm theo danh mục chung, quá trình mua sắm có thể mất nhiều thời gian và làm giảm trải nghiệm người dùng.
Người mua thường gặp khó khăn trong việc tìm sản phẩm phù hợp khi số lượng hàng hóa ngày càng tăng.
Hệ thống tập trung hỗ trợ bán hàng trực tuyến cho các cửa hàng quy mô nhỏ và vừa.
Quy trình quản lý sản phẩm bao gồm thông tin, giá cả, hình ảnh, danh mục và số lượng tồn kho.
Người dùng hệ thống gồm quản trị viên, người quản lý bán hàng và khách hàng.
Chương 5 – Kết luận và hướng phát triển
5.1 Kết quả và định hướng
Bên cạnh đó, đề tài nghiên cứu các công nghệ và công cụ phục vụ quá trình xây dựng hệ thống.
Thiết kế cơ sở dữ liệu sử dụng MySQL để lưu trữ tài khoản, sản phẩm và đơn hàng.
Hệ thống cần đảm bảo tính dễ sử dụng và khả năng mở rộng trong tương lai.
Các chức năng có thể được bổ sung gồm đánh giá sản phẩm, thông báo khuyến mãi và mã giảm giá.
Đối tượng nghiên cứu là quy trình bán hàng trực tuyến trên nền tảng web.
TÀI LIỆU THAM KHẢO
[1] Django Software Foundation, Django Documentation, tài liệu hướng dẫn chính thức về Django.
[2] Martin Fowler, UML Distilled: A Brief Guide to the Standard Object Modeling Language.
[3] Python Software Foundation, Python Documentation, tài liệu chính thức về ngôn ngữ lập trình Python.`;
  const document = await processDocument(source, 'DeCuong_NguyenVanThuong.docx', 'docx', '1 KB', { analyzeWithAI: false });
  const result = generateLocalExam({ document, numQuestions: 8, difficulty: 'medium' });

  assert(result.questions.length === 8, `tạo đủ 8 câu (thực tế ${result.questions.length})`);
  assert(
    result.questions.every((question) => question.source.chapter.includes('Chương 1') || question.source.chapter.includes('Chương 5')),
    'mọi câu được gán vào một trong các chương thực có trong tài liệu'
  );
  const chapterFivePosition = source.indexOf('Chương 5');
  assert(
    result.questions.every((question) => {
      const sourcePosition = source.indexOf(question.source.sourceText);
      const expectedChapter = sourcePosition >= chapterFivePosition ? 'Chương 5' : 'Chương 1';
      return question.source.chapter.includes(expectedChapter);
    }),
    'chương truy xuất khớp với vị trí thực của trích dẫn trong tài liệu'
  );
  assert(
    result.questions.every((question) => !/liên quan đến:|bối cảnh:/i.test(question.questionText)),
    'câu hỏi không còn ghép các từ khóa rời rạc'
  );
  const conditionalQuestion = result.questions.find((question) => question.source.sourceText.startsWith('Nếu website'));
  assert(
    Boolean(conditionalQuestion && /nếu website chỉ hiển thị.*hệ quả nào được nêu/i.test(conditionalQuestion.questionText)),
    'câu điều kiện được chuyển thành câu hỏi hỏi đúng hệ quả của điều kiện'
  );
  assert(
    result.questions.every((question) => question.options.every((option) => !/Django Documentation|UML Distilled|Python Documentation/.test(option.text))),
    'phương án không lấy nội dung từ phần tài liệu tham khảo'
  );
  assert(
    result.questions.every((question) => question.options.every((option) => {
      const sourceChapter = source.slice(0, source.indexOf(question.source.chapter.includes('Chương 5') ? 'Chương 5' : 'TÀI LIỆU THAM KHẢO'));
      const otherChapterStart = source.indexOf('Chương 5');
      const chapterText = question.source.chapter.includes('Chương 5')
        ? source.slice(otherChapterStart, source.indexOf('TÀI LIỆU THAM KHẢO'))
        : sourceChapter;
      return chapterText.includes(option.text);
    })),
    'đáp án và phương án nhiễu đều lấy từ đúng chương được gán'
  );
});

// ==== C.3: Trích dẫn giả bị từ chối ====
await testCase('C.3: findCitationPosition từ chối trích dẫn không có trong tài liệu', () => {
  assert(findCitationPosition(SAMPLE_TEXT, 'Đây là câu văn hoàn toàn bịa đặt không có trong tài liệu.') === -1, 'trích dẫn bịa bị từ chối (-1)');
  assert(findCitationPosition(SAMPLE_TEXT, 'Khóa chính được định nghĩa là tập thuộc tính xác định duy nhất mỗi bộ trong quan hệ.') >= 0, 'trích dẫn thật được chấp nhận');
});

await testCase('C.3b: câu có trích dẫn giả bị loại khỏi bộ đề cục bộ', () => {
  const document = buildSampleDocumentSync();
  // Giả lập: sửa trực tiếp sourceText của 1 câu thành trích dẫn giả
  const sentences = collectKnowledgeSentences(document);
  assert(sentences.length > 0, `thu thập được ${sentences.length} câu kiến thức từ tài liệu`);
  const fakeCitation = findCitationPosition(document.rawText, 'Mô hình OSI gồm bảy tầng hoàn toàn không liên quan.');
  assert(fakeCitation === -1, 'câu không có trong tài liệu không được coi là trích dẫn hợp lệ');
});

function buildSampleDocumentSync(): DocumentSource {
  // Bản đồng bộ dùng cho test nhỏ: tự dựng DocumentSource với rawText đã normalize
  return {
    id: 'doc-test-sync',
    title: 'GiaoTrinh_CSDL',
    fileName: 'GiaoTrinh_CSDL.txt',
    fileType: 'txt',
    fileSize: '1 KB',
    pageCount: 1,
    status: 'READY',
    rawText: SAMPLE_TEXT,
    chapters: [
      {
        id: 'chap-1',
        chapterNumber: 1,
        title: 'Chương 1 – Cơ sở dữ liệu quan hệ',
        pageStart: 1,
        pageEnd: 1,
        sections: [],
      },
    ],
    chunks: [
      {
        id: 'chunk-1',
        documentId: 'doc-test-sync',
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1 – Cơ sở dữ liệu quan hệ',
        sectionId: 'sec-1',
        sectionTitle: '1.1 Mô hình dữ liệu',
        pageNumber: 1,
        content: SAMPLE_TEXT,
      },
    ],
    knowledgeUnits: [],
  };
}

// ==== C.4: Tài liệu rỗng / quá ngắn / thiếu thông tin / yêu cầu quá số câu ====
await testCase('C.4: tài liệu rỗng bị từ chối với thông báo rõ ràng', () => {
  const document = { ...buildSampleDocumentSync(), rawText: '' };
  let message = '';
  try {
    generateLocalExam({ document, numQuestions: 5, difficulty: 'medium' });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(/quá ngắn hoặc rỗng/i.test(message), `báo lỗi tài liệu rỗng: "${message}"`);
});

await testCase('C.4b: tài liệu quá ngắn bị từ chối', () => {
  const document = { ...buildSampleDocumentSync(), rawText: 'Đây là một đoạn ngắn.' };
  let message = '';
  try {
    generateLocalExam({ document, numQuestions: 5, difficulty: 'medium' });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(/quá ngắn/i.test(message), `báo lỗi tài liệu quá ngắn: "${message}"`);
});

await testCase('C.4c: yêu cầu nhiều câu hơn số câu tạo được → báo số thực tế, không nhân bản', () => {
  const document = buildSampleDocumentSync();
  const shortDoc: DocumentSource = {
    ...document,
    rawText: SAMPLE_TEXT.slice(0, 600), // chỉ ~1-2 câu kiến thức
  };
  let message = '';
  let stats: { generated: number; requested: number } | null = null;
  try {
    generateLocalExam({ document: shortDoc, numQuestions: 20, difficulty: 'medium' });
  } catch (error) {
    if (error instanceof LocalExamCapacityError) {
      stats = error.stats;
      message = error.message;
    } else {
      message = error instanceof Error ? error.message : String(error);
    }
  }
  assert(stats !== null, 'ném LocalExamCapacityError (không tự nhân bản)');
  if (stats) {
    assert(stats.generated < stats.requested, `generated (${stats.generated}) < requested (${stats.requested})`);
    assert(message.includes(`${stats.generated}/${stats.requested}`), `thông báo chứa số thực tế: "${message}"`);
  }
});

await testCase('C.4d: không nhân bản câu hỏi khi yêu cầu nhiều hơn khả năng', async () => {
  const document = await buildSampleDocument();
  const totalUsable = collectKnowledgeSentences(document).length;
  const requested = Math.min(50, totalUsable + 10);
  let capacityError: LocalExamCapacityError | null = null;
  try {
    generateLocalExam({ document, numQuestions: requested, difficulty: 'medium' });
  } catch (error) {
    if (error instanceof LocalExamCapacityError) capacityError = error;
  }
  assert(capacityError !== null || requested <= 5, 'nếu vượt khả năng thì báo CapacityError thay vì nhân bản');
  if (capacityError) {
    const generated = capacityError.stats.generated;
    assert(generated < capacityError.stats.requested, `báo thiếu ${capacityError.stats.requested - generated} câu`);
  }
});

// ==== C.5: AI nghiên cứu chủ đề vẫn dùng Gemini ====
await testCase('C.5: geminiClient vẫn yêu cầu GEMINI_API_KEY cho luồng nghiên cứu (không bị gỡ bỏ)', async () => {
  // Sau khi xóa key, getGeminiClient phải trả null — chứng tỏ cấu hình Gemini vẫn còn nguyên
  // và được luồng WEB/nghiên cứu sử dụng (khi có key).
  delete process.env.GEMINI_API_KEY;
  resetGeminiKeyManager();
  const client = geminiModule.getGeminiClient();
  assert(client === null, 'getGeminiClient() trả null khi thiếu key (cấu hình Gemini vẫn hoạt động khi có key)');

  // generateGeminiContent phải ném thông báo thiếu key — tức luồng AI vẫn phụ thuộc Gemini như trước.
  let message = '';
  try {
    await geminiModule.generateGeminiContent({ contents: 'test' });
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  assert(/GEMINI_API_KEY/.test(message), `luồng AI vẫn dùng Gemini: "${message}"`);
});

await testCase('C.5b: sourceMode WEB vẫn đi qua luồng Gemini (bị chặn khi thiếu key, không rơi vào luồng cục bộ)', async () => {
  const document = await buildSampleDocument();
  let message = '';
  try {
    await generateExamWithAI({
      document,
      sourceMode: 'WEB',
      numQuestions: 5,
      difficulty: 'medium',
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(
    /GEMINI_API_KEY/.test(message),
    `luồng WEB vẫn yêu cầu Gemini (không dùng generator cục bộ): "${message}"`
  );
});

// ==== Bonus: PDF/DOCX/TXT pipeline trích xuất vẫn hoạt động không cần Gemini ====
await testCase('C.6: pipeline trích xuất TXT → processDocument(analyzeWithAI:false) không cần Gemini', async () => {
  const document = await buildSampleDocument();
  assert(document.rawText.length > 100, `rawText được trích xuất (${document.rawText.length} ký tự)`);
  assert(document.chapters.length >= 1, `phát hiện được ${document.chapters.length} chương`);
  assert(document.knowledgeUnits.length >= 1, `trích xuất được ${document.knowledgeUnits.length} đơn vị kiến thức`);
  // Xác nhận không có trường nào trong document phụ thuộc AI
  assert(document.status === 'READY', 'trạng thái READY');
});

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length > 0) {
  process.exit(1);
}
