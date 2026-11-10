/**
 * Verify citation verification fix in server/questionGenerator.ts.
 * Run: npx tsx scripts/verify-citation-fix.ts
 */
import { normalizeCitationText, findCitationPosition } from '../server/questionGenerator';

interface Case { name: string; doc: string; citation: string; expectFound: boolean; }

const cases: Case[] = [
  {
    name: 'khớp nguyên văn',
    doc: 'Chương 1: Tổng quan. Mạng máy tính là tập hợp các thiết bị được kết nối với nhau để chia sẻ tài nguyên.',
    citation: 'Mạng máy tính là tập hợp các thiết bị được kết nối với nhau để chia sẻ tài nguyên.',
    expectFound: true,
  },
  {
    name: 'khác khoảng trắng và xuống dòng (PDF soft break)',
    doc: 'Mạng máy tính là tập hợp\ncác thiết bị được kết nối\nvới nhau để chia sẻ tài nguyên.',
    citation: 'Mạng máy tính là tập hợp các thiết bị được kết nối với nhau để chia sẻ tài nguyên.',
    expectFound: true,
  },
  {
    name: 'PDF gạch nối cuối dòng (hyphenation)',
    doc: 'Thuật toán Quy hoạch động được trình bày như sau:\nQuy hoạch\nđộng là kỹ thuật tối ưu.',
    citation: 'Quy hoạch động là kỹ thuật tối ưu.',
    expectFound: true,
  },
  {
    name: 'khác ký tự unicode và khoảng trắng không ngắt (NBSP)',
    doc: 'Hàm số\u00A0f(x) = x\u00B2 +\u202F1 là hàm bậc hai.',
    citation: 'Hàm số f(x) = x² + 1 là hàm bậc hai.',
    expectFound: true,
  },
  {
    name: 'khác dấu ngoặc kép thông minh / thường',
    doc: 'Ông nói: "Trí tuệ nhân tạo đang thay đổi thế giới" rồi rời đi.',
    citation: 'Ông nói: “Trí tuệ nhân tạo đang thay đổi thế giới” rồi rời đi.',
    expectFound: true,
  },
  {
    name: 'trích dẫn bịa, không tồn tại trong tài liệu',
    doc: 'Chương 2: Cơ sở dữ liệu quan hệ có ba mức trừu tượng: vật lý, logic và khung nhìn.',
    citation: 'Cơ sở dữ liệu NoSQL không hỗ trợ giao dịch ACID.',
    expectFound: false,
  },
  {
    name: 'trích dẫn đúng nội dung nhưng diễn đạt lại (phải bị từ chối)',
    doc: 'Cơ sở dữ liệu quan hệ tổ chức dữ liệu theo bảng với hàng và cột.',
    citation: 'Dữ liệu trong CSDL quan hệ được sắp xếp theo bảng gồm hàng và cột.',
    expectFound: false,
  },
  {
    name: 'trích dẫn chỉ có vài từ trùng nhưng không đủ nguyên văn (phải bị từ chối)',
    doc: 'Hệ điều hành quản lý tiến trình và bộ nhớ.',
    citation: 'Hệ điều hành quản lý mạng và bảo mật.',
    expectFound: false,
  },
];

let failed = 0;
for (const c of cases) {
  const pos = findCitationPosition(c.doc, c.citation);
  const found = pos >= 0;
  const ok = found === c.expectFound;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${c.name} | found=${found} expected=${c.expectFound}`);
  if (!ok) console.log(`   normalizedDoc=${normalizeCitationText(c.doc)}\n   normalizedCit=${normalizeCitationText(c.citation)}`);
}
console.log(failed === 0 ? '\nAll citation-normalization cases passed.' : `\n${failed} case(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
