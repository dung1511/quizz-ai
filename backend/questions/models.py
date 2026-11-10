from django.conf import settings
from django.db import models
from documents.models import Document, DocumentChapter, DocumentChunk, DocumentSection, KnowledgeUnit

class Question(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    explanation = models.TextField()
    difficulty = models.CharField(max_length=10, default='medium')
    topic = models.CharField(max_length=500, blank=True)
    correct_answer = models.CharField(max_length=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    key = models.CharField(max_length=1)
    text = models.TextField()
    class Meta: constraints = [models.UniqueConstraint(fields=['question','key'], name='unique_answer_key')]

class QuestionSource(models.Model):
    class SourceType(models.TextChoices):
        DOCUMENT = 'DOCUMENT', 'DOCUMENT'
        WEB = 'WEB', 'WEB'
        MIXED = 'MIXED', 'MIXED'

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='sources')
    document = models.ForeignKey(Document, on_delete=models.PROTECT, null=True, blank=True)
    web_source = models.ForeignKey('documents.WebResearchSource', on_delete=models.SET_NULL, null=True, blank=True, related_name='question_sources')
    chapter = models.ForeignKey(DocumentChapter, on_delete=models.SET_NULL, null=True, blank=True)
    section = models.ForeignKey(DocumentSection, on_delete=models.SET_NULL, null=True, blank=True)
    page_number = models.PositiveIntegerField(default=1)
    source_chunk = models.ForeignKey(DocumentChunk, on_delete=models.SET_NULL, null=True, blank=True)
    source_text = models.TextField()
    knowledge_unit = models.ForeignKey(KnowledgeUnit, on_delete=models.SET_NULL, null=True, blank=True)
    source_type = models.CharField(max_length=16, choices=SourceType.choices, default=SourceType.DOCUMENT)
    generation_reason = models.CharField(max_length=1000)

    class Meta:
        ordering = ['id']

class FavoriteQuestion(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    class Meta: constraints = [models.UniqueConstraint(fields=['user','question'], name='unique_favorite')]
