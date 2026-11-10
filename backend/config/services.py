from django.db import transaction
from documents.models import KnowledgeUnit
from questions.models import Answer, Question, QuestionSource
from quizzes.models import Quiz, QuizQuestion

def create_source_question(owner, unit, position, difficulty):
    source_text = unit.source_chunk.content if unit.source_chunk else unit.description
    if not source_text or len(source_text.strip()) < 20:
        return None
    correct = source_text[:180].strip()
    options = [correct, 'Một nhận định không được nêu trong tài liệu.', 'Một nội dung thuộc chủ đề khác.', 'Một kết luận trái với đoạn nguồn.']
    question = Question.objects.create(owner=owner, text=f'Theo tài liệu, nội dung nào mô tả đúng về “{unit.name}”?', explanation=f'Đoạn nguồn nêu rõ: {correct}', difficulty=difficulty, topic=unit.name, correct_answer='A')
    for key, text in zip('ABCD', options): Answer.objects.create(question=question, key=key, text=text)
    QuestionSource.objects.create(question=question, document=unit.document, chapter=unit.chapter, section=unit.section, page_number=unit.source_chunk.page_number if unit.source_chunk else 1, source_chunk=unit.source_chunk, source_text=source_text, knowledge_unit=unit, generation_reason=f'Kiểm tra khả năng nhận biết kiến thức “{unit.name}” được nêu trực tiếp trong tài liệu.')
    return question

@transaction.atomic
def generate_quiz(owner, document, title, question_count, difficulty='medium'):
    units = KnowledgeUnit.objects.filter(document=document, source_chunk__isnull=False).select_related('source_chunk','chapter','section')
    quiz = Quiz.objects.create(owner=owner, document=document, title=title or f'Bộ câu hỏi: {document.title}', duration=max(5, question_count * 2))
    for position, unit in enumerate(units[:question_count], 1):
        question = create_source_question(owner, unit, position, difficulty)
        if question: QuizQuestion.objects.create(quiz=quiz, question=question, position=position)
    if not quiz.questions.exists():
        raise ValueError('Tài liệu chưa có đoạn nguồn hợp lệ để tạo câu hỏi.')
    return quiz
