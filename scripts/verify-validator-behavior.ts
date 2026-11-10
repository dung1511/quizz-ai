/**
 * Xác định chính xác kiểm định nào trong validateQuestionSet khiến bộ đề
 * hợp lệ điển hình (kiểu câu hỏi thật sau khi trích PDF) bị từ chối.
 * Run: npx tsx scripts/verify-validator-behavior.ts
 */
import { validateQuestion, validateQuestionSet } from '../server/questionValidator';
import type { Question } from '../src/types';

const mkQuestion = (over: Partial<Question>): Question => ({
  id: 'q-test-1',
  questionNumber: 1,
  questionText: 'Trong ngôn ngữ SQL tiêu chuẩn, mệnh đề nào BẮT BUỘC có để chỉ định nguồn bảng cần truy xuất dữ liệu?',
  options: [
    { key: 'A', text: 'FROM' },
    { key: 'B', text: 'WHERE' },
    { key: 'C', text: 'ORDER BY' },
    { key: 'D', text: 'GROUP BY' },
  ],
  correctAnswer: 'A',
  explanation: 'Mệnh đề FROM là bắt buộc trong câu truy vấn SELECT vì nó xác định bảng nguồn chứa dữ liệu cần lấy.',
  difficulty: 'medium',
  topic: 'SQL cơ bản',
  source: {
    documentId: 'doc-1',
    documentName: 'GiaoTrinhSQL.pdf',
    chapter: 'Chương 3',
    section: '3.1 Câu truy vấn SELECT',
    page: 42,
    sourceChunkId: 'chunk-3-1',
    sourceText: 'Câu lệnh SELECT cho phép truy xuất dữ liệu từ một hoặc nhiều bảng. Trong đó, mệnh đề FROM chỉ định bảng nguồn cần truy xuất và là thành phần bắt buộc của mọi câu truy vấn hợp lệ.',
    knowledgeUnit: 'Mệnh đề FROM bắt buộc',
    generationReason: 'Đánh giá kiến thức về cấu trúc bắt buộc của câu truy vấn SELECT trong SQL.',
  },
  ...over,
} as Question);

let failed = 0;
const report = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` | ${detail}` : ''}`);
};

// Đề gồm 2 câu hợp lệ điển hình kiểu đáp án ngắn (FROM, WHERE) — dạng phổ biến trong đề trắc nghiệm thật.
const q1 = mkQuestion({});
const q2 = mkQuestion({
  id: 'q-test-2',
  questionNumber: 2,
  questionText: 'Mệnh đề nào được dùng để lọc các hàng thỏa điều kiện trong câu truy vấn SELECT?',
  options: [
    { key: 'A', text: 'HAVING' },
    { key: 'B', text: 'WHERE' },
    { key: 'C', text: 'FROM' },
    { key: 'D', text: 'LIMIT' },
  ],
  correctAnswer: 'B',
  explanation: 'Mệnh đề WHERE áp dụng điều kiện lọc cho từng hàng trước khi gom nhóm hoặc sắp xếp kết quả.',
  source: {
    ...mkQuestion({}).source,
    sourceText: 'Mệnh đề WHERE cho phép lọc các hàng theo điều kiện cụ thể. Chỉ những hàng thỏa mãn điều kiện mới được đưa vào kết quả truy vấn cuối cùng.',
    knowledgeUnit: 'Mệnh đề WHERE lọc điều kiện',
    section: '3.2 Điều kiện lọc dữ liệu',
  },
});

const report1 = validateQuestion(q1);
const report2 = validateQuestion(q2, [q1]);

console.log('--- Chi tiết kiểm định từng câu ---');
for (const [label, val] of [['Câu 1', report1], ['Câu 2', report2]] as const) {
  const failedChecks = Object.entries(val.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${label}: status=${val.status} score=${val.qualityScore} issues=${JSON.stringify(val.issues)} failedChecks=${failedChecks.join('|') || 'none'}`);
}

const setReport = validateQuestionSet([q1, q2]);
console.log(`--- validateQuestionSet: allValid=${setReport.allValid} valid=${setReport.validCount}/${setReport.totalQuestions}`);
if (setReport.issuesSummary.length) console.log('issuesSummary:', setReport.issuesSummary);

report('Câu 1 (đáp án ngắn "FROM") đạt VALID', report1.isValid, report1.issues?.join('; '));
report('Câu 2 (đáp án ngắn "WHERE") đạt VALID', report2.isValid, report2.issues?.join('; '));
report('Bộ 2 câu hợp lệ điển hình đạt allValid=true (nếu FAIL => đây là nguyên nhân throw dòng 195)', setReport.allValid);

// Regression: đáp án ngắn phải được chấp nhận khi nguyên đáp án có trong nguồn,
// và bị từ chối khi nguồn KHÔNG chứa đáp án (không tự chấp nhận trích dẫn sai).
const q3 = mkQuestion({
  id: 'q-test-3',
  questionNumber: 3,
  questionText: 'Thuật ngữ nào chỉ mô hình cơ sở dữ liệu quan hệ đảm bảo tính nhất quán?',
  options: [
    { key: 'A', text: 'CRUD' },
    { key: 'B', text: 'ACID' },
    { key: 'C', text: 'HTTP' },
    { key: 'D', text: 'RAM' },
  ],
  correctAnswer: 'B',
  explanation: 'ACID là bộ tính chất đảm bảo giao dịch cơ sở dữ liệu quan hệ hoạt động nhất quán.',
  source: {
    ...mkQuestion({}).source,
    sourceText: 'Giao dịch trong cơ sở dữ liệu quan hệ phải đảm bảo bốn tính chất ACID: nguyên tử, nhất quán, cô lập và bền vững.',
    knowledgeUnit: 'Tính chất ACID của giao dịch',
    section: '3.3 Giao dịch',
  },
});
const report3 = validateQuestion(q3);
report('Đáp án ngắn "ACID" có trong nguồn => answerInSource=true', report3.checks.answerInSource);

const q4 = mkQuestion({
  id: 'q-test-4',
  questionNumber: 4,
  questionText: 'Thuật ngữ nào sau đây là giao thức truyền hình ảnh trên web?',
  options: [
    { key: 'A', text: 'CRUD' },
    { key: 'B', text: 'ACID' },
    { key: 'C', text: 'HTTP' },
    { key: 'D', text: 'RAM' },
  ],
  correctAnswer: 'C',
  explanation: 'HTTP là giao thức truyền siêu văn bản được dùng trên web.',
  source: {
    ...mkQuestion({}).source,
    sourceText: 'Giao dịch trong cơ sở dữ liệu quan hệ phải đảm bảo bốn tính chất ACID: nguyên tử, nhất quán, cô lập và bền vững.',
    knowledgeUnit: 'Tính chất ACID của giao dịch',
    section: '3.3 Giao dịch',
  },
});
const report4 = validateQuestion(q4);
report('Đáp án ngắn "HTTP" KHÔNG có trong nguồn => answerInSource=false (không tự chấp nhận trích dẫn sai)', !report4.checks.answerInSource);

console.log(failed === 0 ? '\n=> Không có kiểm định nào từ chối đề hợp lệ điển hình.' : `\n=> ${failed} trường hợp: kiểm định từ chối đề hợp lệ điển hình — khớp lỗi throw dòng 195.`);
process.exit(failed === 0 ? 0 : 1);
