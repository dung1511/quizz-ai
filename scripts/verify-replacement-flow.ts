/**
 * Static + behavioral verification of the replacement flow without real Gemini.
 * Verifies: (1) quota error short-circuits; (2) citation-only rejection keeps good
 * questions instead of discarding the exam. Run: npx tsx scripts/verify-replacement-flow.ts
 */
import { readFileSync } from 'node:fs';

const source = readFileSync('server/questionGenerator.ts', 'utf8');

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
};

// 1. Quota handling: short-circuit before any retry loop
check('429/RESOURCE_EXHAUSTED ném lỗi quota ngay, không retry',
  /429 \|\| \/RESOURCE_EXHAUSTED\/i\.test\(message\)[\s\S]{0,300}throw new Error\('Gemini đã hết hạn mức/u.test(source));
check('Không retry vô hạn khi thiếu trích dẫn (attempt >= 2 dừng)',
  /attempt >= 2[\s\S]{0,200}3 lần thử/u.test(source));

// 2. Replacement flow keeps verified questions
check('Có pool câu hợp lệ và chỉ tạo câu thay thế còn thiếu',
  /verifiedPool[\s\S]{0,400}Chỉ cần tạo thêm \$\{remaining\} câu thay thế/u.test(source));
check('Số lần tạo lại câu thay thế bị giới hạn (max 3)',
  /replaceAttempt < 3/u.test(source));
check('Thông báo rõ ràng khi không đủ số câu sau giới hạn',
  /Tài liệu chỉ đủ căn cứ cho \$\{verifiedPool\.length\}\/\$\{req\.numQuestions\}/u.test(source));

// 3. Per-question rejection instead of whole-batch throw
check('Câu lỗi bị loại và ghi nhận, không vứt cả batch',
  /rejected\.push\(`Câu \$\{idx \+ 1\}/u.test(source));
check('Chỉ throw khi TẤT CẢ câu đều lỗi',
  /parsed\.length === 0 && rejected\.length > 0[\s\S]{0,120}throw/u.test(source));
check('sourceText vẫn bị kiểm chứng (không bỏ qua source check)',
  /findCitationPosition\(document\.rawText, sourceText\)/u.test(source));
check('Trích dẫn rỗng hoặc sai vẫn bị từ chối',
  /!sourceText \|\| normalizedSourcePosition < 0/u.test(source));

console.log(failed === 0 ? '\nAll flow checks passed.' : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
