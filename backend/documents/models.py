from django.conf import settings
from django.db import models

class Document(models.Model):
    class Status(models.TextChoices): UPLOADED='uploaded'; PROCESSING='processing'; READY='ready'; FAILED='failed'
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/', blank=True)
    file_type = models.CharField(max_length=8, choices=[('pdf','PDF'),('docx','DOCX'),('txt','TXT'),('text','Text')])
    raw_text = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPLOADED)
    extraction_status = models.CharField(max_length=16, choices=Status.choices, default=Status.UPLOADED)
    page_count = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class ResearchSession(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'PENDING'
        SEARCHING = 'SEARCHING', 'SEARCHING'
        PROCESSING = 'PROCESSING', 'PROCESSING'
        COMPLETED = 'COMPLETED', 'COMPLETED'
        FAILED = 'FAILED', 'FAILED'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='research_sessions')
    query = models.TextField()
    topic = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

class WebResearchSource(models.Model):
    class SourceType(models.TextChoices):
        OFFICIAL = 'OFFICIAL', 'OFFICIAL'
        EDUCATIONAL = 'EDUCATIONAL', 'EDUCATIONAL'
        GOVERNMENT = 'GOVERNMENT', 'GOVERNMENT'
        ACADEMIC = 'ACADEMIC', 'ACADEMIC'
        REFERENCE = 'REFERENCE', 'REFERENCE'
        OTHER = 'OTHER', 'OTHER'

    research_session = models.ForeignKey(ResearchSession, on_delete=models.CASCADE, related_name='sources')
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=1000)
    domain = models.CharField(max_length=255)
    source_type = models.CharField(max_length=20, choices=SourceType.choices, default=SourceType.OTHER)
    content = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    retrieved_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['research_session', 'url'], name='unique_web_source_url_per_session')]
        ordering = ['-retrieved_at']

class DocumentChapter(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chapters')
    number = models.CharField(max_length=30)
    title = models.CharField(max_length=500)
    page_start = models.PositiveIntegerField(default=1)
    page_end = models.PositiveIntegerField(default=1)
    class Meta: ordering = ['page_start', 'id']

class DocumentSection(models.Model):
    chapter = models.ForeignKey(DocumentChapter, on_delete=models.CASCADE, related_name='sections')
    number = models.CharField(max_length=30)
    title = models.CharField(max_length=500)
    page_number = models.PositiveIntegerField(default=1)
    summary = models.TextField(blank=True)

class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    chapter = models.ForeignKey(DocumentChapter, on_delete=models.SET_NULL, null=True, blank=True, related_name='chunks')
    section = models.ForeignKey(DocumentSection, on_delete=models.SET_NULL, null=True, blank=True, related_name='chunks')
    page_number = models.PositiveIntegerField(default=1)
    position = models.PositiveIntegerField(default=0)
    content = models.TextField()

class KnowledgeUnit(models.Model):
    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_units')
    research_session = models.ForeignKey('ResearchSession', on_delete=models.CASCADE, null=True, blank=True, related_name='knowledge_units')
    chapter = models.ForeignKey(DocumentChapter, on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_units')
    section = models.ForeignKey(DocumentSection, on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_units')
    source_chunk = models.ForeignKey(DocumentChunk, on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_units')
    source = models.ForeignKey('WebResearchSource', on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_units')
    name = models.CharField(max_length=500)
    kind = models.CharField(max_length=20, default='concept')
    description = models.TextField(blank=True)
    source_excerpt = models.TextField(blank=True)
    importance = models.CharField(max_length=20, default='important')
