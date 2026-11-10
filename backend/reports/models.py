from django.conf import settings
from django.db import models
from questions.models import Question

class QuestionReport(models.Model):
    REASONS = [('wrong_answer','Sai đáp án'),('unclear','Câu hỏi không rõ'),('not_in_source','Không có trong tài liệu'),('wrong_explanation','Giải thích sai'),('duplicate','Trùng câu'),('other','Khác')]
    STATUSES = [('pending','Pending'),('reviewing','Reviewing'),('resolved','Resolved'),('rejected','Rejected')]
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='reports')
    reason = models.CharField(max_length=30, choices=REASONS)
    detail = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
