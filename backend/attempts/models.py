from django.conf import settings
from django.db import models
from quizzes.models import Quiz
from questions.models import Question

class QuizAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attempts')
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    correct_count = models.PositiveIntegerField(default=0)
    total_questions = models.PositiveIntegerField(default=0)

class UserAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    selected_answer = models.CharField(max_length=1, blank=True)
    is_correct = models.BooleanField(default=False)
    class Meta: constraints = [models.UniqueConstraint(fields=['attempt','question'], name='one_answer_per_question')]
