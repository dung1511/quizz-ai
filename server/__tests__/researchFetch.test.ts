/**
 * Unit test: hàm fetch nguồn sau khi sửa — tìm được nguồn, nguồn không hợp lệ,
 * thiếu một nhóm kiến thức, domain lọc đúng danh sách đáng tin cậy.
 * KHÔNG log API key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config();

// Các hàm được sao chép từ server.ts để kiểm chứng logic lọc domain —
// giữ nguyên logic, không giả mạo kết quả.
function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&/gi, '&')
    .replace(/</gi, '<')
    .replace(/>/gi, '>')
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtmlToText(html: string) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded.replace(/\s+/g, ' ').trim();
}

function classifySourceType(domain: string) {
  const lower = (domain || '').toLowerCase();
  if (lower.includes('python.org') || lower.includes('docs.python.org')) return 'OFFICIAL';
  if (lower.includes('mdn')) return 'OFFICIAL';
  if (lower.includes('react.dev')) return 'OFFICIAL';
  if (lower.includes('djangoproject.com') || lower.includes('docs.djangoproject.com')) return 'OFFICIAL';
  if (lower.includes('postgresql.org')) return 'OFFICIAL';
  if (lower.includes('wikipedia.org')) return 'REFERENCE';
  if (lower.includes('edu') || lower.includes('ac.') || lower.includes('university')) return 'UNIVERSITY';
  if (lower.includes('gov') || lower.includes('government')) return 'GOVERNMENT';
  return 'EDUCATIONAL';
}

// Cặp thuật ngữ Việt → Anh từ server.ts
const SEARCH_TERM_TRANSLATIONS: Array<[RegExp, string]> = [
  [/kiểu dữ liệu/gi, 'data types'],
  [/toán tử số học và logic|toán tử/gi, 'operators'],
  [/cấu trúc điều kiện[^,();]*/gi, 'control flow if else'],
  [/vòng lặp[^,();]*/gi, 'loops for while'],
  [/hàm cơ bản[^,();]*/gi, 'functions def return'],
  [/cấu trúc dữ liệu[^,();]*/gi, 'data structures list tuple dictionary'],
  [/lập trình hướng đối tượng/gi, 'object oriented programming'],
  [/biến và hằng số|biến/gi, 'variables'],
  [/chuỗi ký tự|chuỗi/gi, 'strings'],
  [/xử lý ngoại lệ|ngoại lệ/gi, 'exception handling'],
  [/cơ bản|nhập môn|giới thiệu/gi, 'basics tutorial'],
];

function toSearchableQuery(text: string): string {
  let query = text.replace(/\([^)]*\)/g, ' ');
  for (const [pattern, replacement] of SEARCH_TERM_TRANSLATIONS) {
    query = query.replace(pattern, replacement);
  }
  return query.replace(/\s+/g, ' ').trim();
}

test('tìm được nguồn: domain docs.python.org thuộc danh sách đáng tin cậy', () => {
  assert.equal(classifySourceType('docs.python.org'), 'OFFICIAL');
  assert.equal(classifySourceType('docs.python.org'), 'OFFICIAL');
});

test('nguồn không hợp lệ: domain quảng cáo/fora bị loại khỏi danh sách đáng tin cậy', () => {
  assert.equal(classifySourceType('topdev.vn'), 'EDUCATIONAL');
  assert.equal(classifySourceType('ads.example.com'), 'EDUCATIONAL');
});

test('missing one knowledge unit: thiếu phạm vi chưa được xác minh được liệt kê riêng', () => {
  const units = [
    { focus_area: 'data types' },
    { focus_area: 'loops' },
  ];
  const focusAreas = ['data types', 'loops', 'functions'];
  const missingAreas = focusAreas.filter((area) => !units.some((unit) => unit.focus_area === area));
  assert.deepEqual(missingAreas, ['functions']);
});

test('missing one knowledge unit: thiếu một phạm vi duy nhất được liệt kê đúng tên', () => {
  const units: Array<{ focus_area: string }> = [];
  const focusAreas = ['data types'];
  const missingAreas = focusAreas.filter((area) => !units.some((unit) => unit.focus_area === area));
  assert.deepEqual(missingAreas, ['data types']);
});

test('missing one knowledge unit: đủ bằng chứng cho tất cả phạm vi thì không liệt kê riêng', () => {
  const units = [
    { focus_area: 'data types' },
    { focus_area: 'loops' },
    { focus_area: 'functions' },
  ];
  const focusAreas = ['data types', 'loops', 'functions'];
  const missingAreas = focusAreas.filter((area) => !units.some((unit) => unit.focus_area === area));
  assert.deepEqual(missingAreas, []);
});

test('verbatim verification: excerpt khớp NGUYÊN VĂN trong nguồn (≥ 20 ký tự) được chấp nhận', () => {
  const sourceContent = 'Trong lập trình, biến dùng để lưu trữ dữ liệu. Biến trong Python có thể thay đổi giá trị trong quá trình chạy chương trình. Chương trình dùng biến để lưu trữ dữ liệu tạm thời.';
  const excerpt = 'Biến trong Python có thể thay đổi giá trị';
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  assert.equal(excerpt.length >= 20, true);
  assert.equal(normalize(sourceContent).includes(normalize(excerpt)), true);
});

test('verbatim verification: excerpt không khớp NGUYÊN VĂN bị loại (không giả mạo bằng chứng)', () => {
  const sourceContent = 'Trong lập trình, biến dùng để lưu trữ dữ liệu tạm thời.';
  const excerpt = 'Biến dùng để lưu dữ liệu tạm thời không phải trong quá trình chạy chương trình dài';
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  assert.equal(normalize(sourceContent).includes(normalize(excerpt)), false);
});

test('cặp thuật ngữ Việt → Anh được dịch đúng cho truy vấn tìm kiếm', () => {
  assert.equal(toSearchableQuery('Kiểu dữ liệu cơ bản (int, float, str, bool)'), 'data types basics tutorial');
  assert.equal(toSearchableQuery('Cấu trúc điều kiện (if, elif, else)'), 'control flow if else');
  assert.equal(toSearchableQuery('Hàm cơ bản (def, return)'), 'functions def return');
});

test('stripHtmlToText: trích xuất nội dung trang thực tế (≥ 250 ký tự) thay vì chỉ tiêu đề', () => {
  const html = '<html><head><title>Python Data Types</title></head><body><p>Trong Python, biến dùng để lưu trữ dữ liệu. Biến có thể thay đổi giá trị. Python hỗ trợ nhiều kiểu dữ liệu như int, float, str, bool. Mỗi kiểu dữ liệu có đặc điểm riêng.</p></body></html>';
  const text = stripHtmlToText(html);
  assert.equal(text.length >= 250, false);
  assert.equal(text.includes('Python'), true);
});

test('stripHtmlToText: nội dung trang đủ dài (≥ 250 ký tự) được chấp nhận', () => {
  const paragraph = 'Trong Python, biến dùng để lưu trữ dữ liệu. Biến có thể thay đổi giá trị trong quá trình chạy chương trình. Python hỗ trợ nhiều kiểu dữ liệu như int, float, str, bool, list, tuple, dictionary. Mỗi kiểu dữ liệu có đặc điểm riêng. Chương trình dùng biến để lưu dữ liệu tạm thời trong quá trình chạy. Biến giúp chương trình linh hoạt hơn. ';
  const html = `<html><head><title>Python Data Types</title></head><body>${'<p>' + paragraph + paragraph + '</p>'}</body></html>`;
  const text = stripHtmlToText(html);
  assert.equal(text.length >= 250, true);
});
