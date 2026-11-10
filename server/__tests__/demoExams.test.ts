/**
 * Kiểm thử chế độ DEMO: bộ đề mẫu hoạt động khi KHÔNG có API key, không gọi AI,
 * được đánh dấu rõ isDemo, không lưu như đề AI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listDemoExams, getDemoExam, registerDemoRoutes } from '../demoExams';

test('demo: có ít nhất 3 bộ đề (Python, Sinh học, Toán rời rạc)', () => {
  const exams = listDemoExams();
  assert.ok(exams.length >= 3, `cần ≥ 3 đề demo, thực tế ${exams.length}`);
  const subjects = exams.map((exam) => exam.subject).join('|');
  assert.ok(/python/i.test(subjects));
  assert.ok(/sinh học/i.test(subjects));
  assert.ok(/rời rạc/i.test(subjects));
});

test('demo: mỗi đề được đánh dấu rõ isDemo=true + demo_notice (không giả làm đề AI)', () => {
  for (const exam of listDemoExams()) {
    const full = getDemoExam(exam.id);
    assert.ok(full);
    assert.equal(full!.isDemo, true);
    assert.ok(full!.demo_notice.includes('DEMO'));
    assert.ok(full!.demo_notice.includes('KHÔNG phải đề do AI tạo'));
  }
});

test('demo: mỗi câu có đúng 4 phương án, đúng 1 đáp án đúng, giải thích căn cứ', () => {
  for (const meta of listDemoExams()) {
    const exam = getDemoExam(meta.id)!;
    for (const question of exam.questions) {
      assert.equal(question.options.length, 4);
      const keys = new Set(question.options.map((option) => option.key));
      assert.equal(keys.size, 4);
      assert.ok(['A', 'B', 'C', 'D'].includes(question.correctAnswer));
      assert.ok(question.options.some((option) => option.key === question.correctAnswer));
      assert.ok(question.explanation.length > 20, 'giải thích phải có căn cứ cụ thể');
      assert.ok(['easy', 'medium', 'hard'].includes(question.difficulty));
    }
  }
});

test('demo: getDemoExam trả null cho id lạ', () => {
  assert.equal(getDemoExam('khong-ton-tai'), null);
});

test('demo: routes đăng ký được (không throw) và đáp án không rò rỉ key', () => {
  const routes: Array<{ method: string; path: string }> = [];
  const fakeApp = {
    get: (path: string, _handler: unknown) => routes.push({ method: 'GET', path }),
  } as unknown as import('express').Express;
  assert.doesNotThrow(() => registerDemoRoutes(fakeApp));
  assert.ok(routes.some((route) => route.path === '/api/demo/exams'));
  assert.ok(routes.some((route) => route.path === '/api/demo/exams/:id'));
});
