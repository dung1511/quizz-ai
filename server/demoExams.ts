/**
 * Chế độ DEMO: bộ đề mẫu được soạn sẵn, KHÔNG gọi AI.
 *
 * Nguyên tắc:
 * - Đề demo được đánh dấu rõ `isDemo: true` và `demo_notice` — không bao giờ được
 *   lưu/trình bày như đề do AI tạo.
 * - Không phụ thuộc Gemini/provider nào: hoạt động cả khi không có API key.
 * - Mỗi đề có câu hỏi trắc nghiệm 4 phương án, đáp án và giải thích căn cứ.
 */
import express from 'express';

export interface DemoQuestion {
  questionText: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface DemoExam {
  id: string;
  title: string;
  subject: string;
  description: string;
  isDemo: true;
  demo_notice: string;
  questions: DemoQuestion[];
}

const DEMO_NOTICE = 'Đây là bộ đề DEMO được soạn sẵn trong hệ thống — KHÔNG phải đề do AI tạo. Dùng để xem, làm bài thử và xem kết quả khi dịch vụ AI hết hạn mức hoặc chưa cấu hình.';

const PYTHON_DEMO: DemoExam = {
  id: 'demo-python-basics',
  title: 'DEMO — Python cơ bản: vòng lặp và kiểu dữ liệu danh sách',
  subject: 'Tin học — Lập trình Python',
  description: 'Bộ đề mẫu về vòng lặp (for, while) và kiểu dữ liệu danh sách (List) cho người mới bắt đầu.',
  isDemo: true,
  demo_notice: DEMO_NOTICE,
  questions: [
    {
      questionText: 'Câu lệnh nào trong Python dùng để lặp qua từng phần tử của một danh sách?',
      options: [
        { key: 'A', text: 'Câu lệnh for' },
        { key: 'B', text: 'Câu lệnh if' },
        { key: 'C', text: 'Câu lệnh import' },
        { key: 'D', text: 'Câu lệnh pass' },
      ],
      correctAnswer: 'A',
      explanation: 'Câu lệnh for trong Python lặp qua các phần tử của một chuỗi (list, string) theo thứ tự — đây là cách chuẩn để duyệt danh sách.',
      difficulty: 'easy',
    },
    {
      questionText: 'Vòng lặp while trong Python tiếp tục thực thi khi nào?',
      options: [
        { key: 'A', text: 'Khi điều kiện kiểm tra còn đúng' },
        { key: 'B', text: 'Khi đã chạy đủ số lần định trước' },
        { key: 'C', text: 'Khi gặp câu lệnh break' },
        { key: 'D', text: 'Khi danh sách hết phần tử' },
      ],
      correctAnswer: 'A',
      explanation: 'Vòng lặp while chạy trong khi điều kiện còn đúng; khi điều kiện sai, vòng lặp dừng.',
      difficulty: 'easy',
    },
    {
      questionText: 'Phương thức nào thêm một phần tử vào CUỐI danh sách (list) Python?',
      options: [
        { key: 'A', text: 'append()' },
        { key: 'B', text: 'remove()' },
        { key: 'C', text: 'keys()' },
        { key: 'D', text: 'reverse()' },
      ],
      correctAnswer: 'A',
      explanation: 'Phương thức append() thêm phần tử vào cuối danh sách; remove() loại bỏ phần tử; reverse() đảo ngược thứ tự.',
      difficulty: 'easy',
    },
    {
      questionText: 'Câu lệnh break trong vòng lặp có tác dụng gì?',
      options: [
        { key: 'A', text: 'Thoát khỏi vòng lặp gần nhất ngay lập tức' },
        { key: 'B', text: 'Bỏ qua phần còn lại của lần lặp hiện tại rồi tiếp tục vòng kế' },
        { key: 'C', text: 'Chạy lại vòng lặp từ đầu' },
        { key: 'D', text: 'Kết thúc toàn bộ chương trình' },
      ],
      correctAnswer: 'A',
      explanation: 'break thoát khỏi vòng lặp gần nhất; continue mới bỏ qua lần lặp hiện tại.',
      difficulty: 'medium',
    },
    {
      questionText: 'Kiểu dữ liệu danh sách (list) trong Python có đặc điểm nào sau đây?',
      options: [
        { key: 'A', text: 'Có thứ tự và có thể thay đổi nội dung sau khi tạo' },
        { key: 'B', text: 'Không thể chứa kiểu dữ liệu khác nhau trong cùng một danh sách' },
        { key: 'C', text: 'Không bao giờ thay đổi được sau khi tạo' },
        { key: 'D', text: 'Chỉ chứa số nguyên' },
      ],
      correctAnswer: 'A',
      explanation: 'List là tập hợp có thứ tự và mutable (có thể thay đổi); có thể chứa các kiểu dữ liệu khác nhau.',
      difficulty: 'medium',
    },
  ],
};

const BIOLOGY_DEMO: DemoExam = {
  id: 'demo-biology-genetics',
  title: 'DEMO — Sinh học: Di truyền học cơ bản',
  subject: 'Sinh học',
  description: 'Bộ đề mẫu về cấu trúc ADN, nguyên phân và quy luật di truyền Mendel.',
  isDemo: true,
  demo_notice: DEMO_NOTICE,
  questions: [
    {
      questionText: 'ADN mang thông tin di truyền dưới dạng mã được tạo từ những đơn phân nào?',
      options: [
        { key: 'A', text: 'Các nucleotide A, T, G, X' },
        { key: 'B', text: 'Các axit amin' },
        { key: 'C', text: 'Các monosaccharide' },
        { key: 'D', text: 'Các axit béo' },
      ],
      correctAnswer: 'A',
      explanation: 'ADN là chuỗi polynucleotide gồm 4 loại nucleotide: A (adenine), T (thymine), G (guanine), X (cytosine).',
      difficulty: 'easy',
    },
    {
      questionText: 'Trong nguyên phân (mitosis), hai tế bào con nhận được bao nhiêu bộ nhiễm sắc thể so với tế bào mẹ?',
      options: [
        { key: 'A', text: 'Bằng tế bào mẹ (2n)' },
        { key: 'B', text: 'Một nửa tế bào mẹ (n)' },
        { key: 'C', text: 'Gấp đôi tế bào mẹ (4n)' },
        { key: 'D', text: 'Ngẫu nhiên tùy điều kiện' },
      ],
      correctAnswer: 'A',
      explanation: 'Nguyên phân tạo hai tế bào con có bộ nhiễm sắc thể giống hệt tế bào mẹ (2n) — duy trì ổn định bộ genome.',
      difficulty: 'easy',
    },
    {
      questionText: 'Quy luật phân ly độc lập của Mendel phát biểu rằng các cặp gen alen phân ly như thế nào?',
      options: [
        { key: 'A', text: 'Độc lập với nhau khi hình thành giao tử' },
        { key: 'B', text: 'Luôn phân ly cùng nhau' },
        { key: 'C', text: 'Chỉ phân ly khi môi trường thay đổi' },
        { key: 'D', text: 'Phân ly theo kiểu không thể dự đoán' },
      ],
      correctAnswer: 'A',
      explanation: 'Quy luật phân ly độc lập: mỗi cặp alen phân ly độc lập với cặp khác trong giảm phân, tạo tổ hợp giao tử đa dạng.',
      difficulty: 'medium',
    },
    {
      questionText: 'Kiểu gen dị hợp tử (Aa) biểu hiện kiểu hình nào?',
      options: [
        { key: 'A', text: 'Kiểu hình trội hoàn toàn khi gen A trội hoàn toàn' },
        { key: 'B', text: 'Chỉ kiểu hình lặn' },
        { key: 'C', text: 'Không biểu hiện kiểu hình gì' },
        { key: 'D', text: 'Luôn kiểu hình trung gian bất kể quan hệ trội/lặn' },
      ],
      correctAnswer: 'A',
      explanation: 'Khi gen A trội hoàn toàn, dị hợp tử Aa biểu hiện kiểu hình trội; kiểu hình trung gian chỉ xảy ra với tính trội không hoàn toàn.',
      difficulty: 'medium',
    },
    {
      questionText: 'Gen nằm trên nhiễm sắc thể giới tính X đực (XY) có đặc điểm gì trong di truyền?',
      options: [
        { key: 'A', text: 'Con đực chỉ có một alen nên biểu hiện gen lặn cũng thành kiểu hình' },
        { key: 'B', text: 'Con đực luôn mang hai alen trên X' },
        { key: 'C', text: 'Gen trên X không truyền cho con trai' },
        { key: 'D', text: 'Gen trên X không liên quan giới tính' },
      ],
      correctAnswer: 'A',
      explanation: 'Con đực XY chỉ có một alen trên X (đestado hemizygote) nên cả alen trội và lặn đều biểu hiện kiểu hình.',
      difficulty: 'hard',
    },
  ],
};

const DISCRETE_MATH_DEMO: DemoExam = {
  id: 'demo-discrete-math-logic',
  title: 'DEMO — Toán rời rạc: Logic mệnh đề và tập hợp',
  subject: 'Toán rời rạc',
  description: 'Bộ đề mẫu về logic mệnh đề, lượng từ và phép toán tập hợp.',
  isDemo: true,
  demo_notice: DEMO_NOTICE,
  questions: [
    {
      questionText: 'Mệnh đề nào sau đây là mệnh đề sai?',
      options: [
        { key: 'A', text: 'Nếu 4 là số chẵn thì 4 chia hết cho 2' },
        { key: 'B', text: '15 là số nguyên tố' },
        { key: 'C', text: 'Cả 2 và 3 đều là số nguyên tố' },
        { key: 'D', text: '7 là số lẻ' },
      ],
      correctAnswer: 'B',
      explanation: '15 = 3 × 5 nên không phải số nguyên tố — mệnh đề sai. Các mệnh đề còn lại đều đúng.',
      difficulty: 'easy',
    },
    {
      questionText: 'Mệnh đề "P ∧ Q" (P và Q) đúng khi nào?',
      options: [
        { key: 'A', text: 'Khi cả P và Q cùng đúng' },
        { key: 'B', text: 'Khi ít nhất một trong P, Q đúng' },
        { key: 'C', text: 'Khi P đúng và Q sai' },
        { key: 'D', text: 'Khi cả P và Q cùng sai' },
      ],
      correctAnswer: 'A',
      explanation: 'Phép hội (∧) chỉ cho giá trị đúng khi cả hai thành phần đều đúng.',
      difficulty: 'easy',
    },
    {
      questionText: 'Phủ định của mệnh đề "Tất cả các số tự nhiên đều chẵn" là gì?',
      options: [
        { key: 'A', text: 'Tồn tại một số tự nhiên không chẵn' },
        { key: 'B', text: 'Tất cả các số tự nhiên đều lẻ' },
        { key: 'C', text: 'Không tồn tại số tự nhiên chẵn nào' },
        { key: 'D', text: 'Mọi số tự nhiên đều chia hết cho 4' },
      ],
      correctAnswer: 'A',
      explanation: 'Phủ định của lượng từ "tất cả" là "tồn tại... không": chỉ cần một số tự nhiên lẻ là mệnh đề gốc sai.',
      difficulty: 'medium',
    },
    {
      questionText: 'Cho A = {1, 2, 3} và B = {2, 3, 4}. Phép giao A ∩ B cho kết quả nào?',
      options: [
        { key: 'A', text: '{2, 3}' },
        { key: 'B', text: '{1, 2, 3, 4}' },
        { key: 'C', text: '{1}' },
        { key: 'D', text: '{4}' },
      ],
      correctAnswer: 'A',
      explanation: 'Giao hai tập chứa các phần tử có mặt ở CẢ HAI tập: chỉ có 2 và 3.',
      difficulty: 'easy',
    },
    {
      questionText: 'Số tập con của một tập hợp có 4 phần tử là bao nhiêu?',
      options: [
        { key: 'A', text: '16' },
        { key: 'B', text: '8' },
        { key: 'C', text: '4' },
        { key: 'D', text: '12' },
      ],
      correctAnswer: 'A',
      explanation: 'Tập n phần tử có 2^n tập con: với n = 4, kết quả là 2^4 = 16.',
      difficulty: 'medium',
    },
  ],
};

const DEMO_EXAMS: DemoExam[] = [PYTHON_DEMO, BIOLOGY_DEMO, DISCRETE_MATH_DEMO];

/** Danh sách đề demo (meta — không chứa câu hỏi, dùng cho UI chọn). */
export function listDemoExams(): Array<{ id: string; title: string; subject: string; description: string; questionCount: number; isDemo: true }> {
  return DEMO_EXAMS.map((exam) => ({
    id: exam.id,
    title: exam.title,
    subject: exam.subject,
    description: exam.description,
    questionCount: exam.questions.length,
    isDemo: true as const,
  }));
}

/** Lấy đề demo theo id. */
export function getDemoExam(id: string): DemoExam | null {
  return DEMO_EXAMS.find((exam) => exam.id === id) || null;
}

/** Đăng ký routes demo lên app Express. */
export function registerDemoRoutes(app: express.Express): void {
  // GET /api/demo/exams — danh sách đề demo (không gọi AI)
  app.get('/api/demo/exams', (_req, res) => {
    res.json({ isDemo: true, exams: listDemoExams() });
  });

  // GET /api/demo/exams/:id — đề demo đầy đủ (không gọi AI)
  app.get('/api/demo/exams/:id', (req, res) => {
    const exam = getDemoExam(String(req.params.id || ''));
    if (!exam) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề demo.' });
      return;
    }
    res.json(exam);
  });
}
