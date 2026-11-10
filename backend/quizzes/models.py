from django.conf import settings
from django.db import models
from documents.models import Document
from questions.models import Question

class Quiz(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quizzes')
    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name='quizzes')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    duration = models.PositiveIntegerField(default=15)
    questions = models.ManyToManyField(Question, through='QuizQuestion', related_name='quizzes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class QuizQuestion(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    position = models.PositiveIntegerField()
    class Meta:
        ordering = ['position']
        constraints = [models.UniqueConstraint(fields=['quiz','question'], name='unique_quiz_question'), models.UniqueConstraint(fields=['quiz','position'], name='unique_quiz_position')]
