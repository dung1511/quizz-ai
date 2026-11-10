from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from documents.models import Document, DocumentChapter, DocumentSection, DocumentChunk, KnowledgeUnit, ResearchSession, WebResearchSource
from questions.models import Answer, Question, QuestionSource
from quizzes.models import Quiz, QuizQuestion
from attempts.models import QuizAttempt, UserAnswer
from reports.models import QuestionReport

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = attrs.get(self.username_field, '').strip()
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
            if user:
                attrs[self.username_field] = user.get_username()
        return super().validate(attrs)

class UserSerializer(serializers.ModelSerializer):
    class Meta: model = User; fields = ['id', 'username', 'email', 'is_staff']

class DocumentSectionSerializer(serializers.ModelSerializer):
    class Meta: model = DocumentSection; fields = ['id', 'number', 'title', 'page_number', 'summary']
class DocumentChapterSerializer(serializers.ModelSerializer):
    sections = DocumentSectionSerializer(many=True, read_only=True)
    class Meta: model = DocumentChapter; fields = ['id', 'number', 'title', 'page_start', 'page_end', 'sections']
class KnowledgeUnitSerializer(serializers.ModelSerializer):
    chapter_title = serializers.CharField(source='chapter.title', read_only=True)
    section_title = serializers.CharField(source='section.title', read_only=True)
    page_number = serializers.IntegerField(source='source_chunk.page_number', read_only=True)
    source_title = serializers.CharField(source='source.title', read_only=True, allow_null=True)
    source_url = serializers.CharField(source='source.url', read_only=True, allow_null=True)
    class Meta: model = KnowledgeUnit; fields = ['id','document','research_session','name','kind','description','source_excerpt','importance','chapter','chapter_title','section','section_title','source','source_title','source_url','source_chunk','page_number']
class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta: model = DocumentChunk; fields = ['id','chapter','section','page_number','position','content']
class WebResearchSourceSerializer(serializers.ModelSerializer):
    class Meta: model = WebResearchSource; fields = ['id','research_session','title','url','domain','source_type','summary','content','retrieved_at','created_at']
class ResearchSessionSerializer(serializers.ModelSerializer):
    sources = WebResearchSourceSerializer(many=True, read_only=True)
    knowledge_units = KnowledgeUnitSerializer(many=True, read_only=True)
    source_count = serializers.SerializerMethodField()
    knowledge_unit_count = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    class Meta: model = ResearchSession; fields = ['id','user','query','topic','status','created_at','completed_at','error_message','source_count','knowledge_unit_count','question_count','sources','knowledge_units']
    def get_source_count(self, obj): return obj.sources.count()
    def get_knowledge_unit_count(self, obj): return obj.knowledge_units.count()
    def get_question_count(self, obj):
        from questions.models import Question
        return Question.objects.filter(sources__web_source__research_session=obj).distinct().count()
class DocumentSerializer(serializers.ModelSerializer):
    chapters = DocumentChapterSerializer(many=True, read_only=True)
    knowledge_units = KnowledgeUnitSerializer(many=True, read_only=True)
    chunks = DocumentChunkSerializer(many=True, read_only=True)
    class Meta: model = Document; fields = ['id','title','file','file_type','status','extraction_status','page_count','created_at','updated_at','raw_text','chapters','knowledge_units','chunks']; read_only_fields = ['status','extraction_status','page_count','raw_text']

class AnswerSerializer(serializers.ModelSerializer):
    class Meta: model = Answer; fields = ['key','text']
class QuestionSourceSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source='document.title', read_only=True, allow_null=True)
    chapter_title = serializers.CharField(source='chapter.title', read_only=True, allow_null=True)
    section_title = serializers.CharField(source='section.title', read_only=True, allow_null=True)
    knowledge_unit_name = serializers.CharField(source='knowledge_unit.name', read_only=True, allow_null=True)
    web_source_title = serializers.CharField(source='web_source.title', read_only=True, allow_null=True)
    web_source_url = serializers.CharField(source='web_source.url', read_only=True, allow_null=True)
    class Meta: model = QuestionSource; fields = ['document','document_title','web_source','web_source_title','web_source_url','chapter','chapter_title','section','section_title','page_number','source_chunk','source_text','knowledge_unit','knowledge_unit_name','source_type','generation_reason']
class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True)
    sources = QuestionSourceSerializer(many=True, read_only=True)
    class Meta: model = Question; fields = ['id','text','explanation','difficulty','topic','correct_answer','answers','sources','created_at','updated_at']

class QuizSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()
    class Meta: model = Quiz; fields = ['id','title','description','document','duration','created_at','updated_at','question_count','questions']
    def get_questions(self, obj): return QuestionSerializer(obj.questions.order_by('quizquestion__position'), many=True).data
    def get_question_count(self, obj): return obj.questions.count()
class AttemptSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    class Meta: model = QuizAttempt; fields = ['id','quiz','quiz_title','started_at','submitted_at','score','correct_count','total_questions','answers']
    def get_answers(self, obj): return [{'question': a.question_id, 'selected_answer': a.selected_answer, 'is_correct': a.is_correct} for a in obj.answers.all()]
class QuestionReportSerializer(serializers.ModelSerializer):
    class Meta: model = QuestionReport; fields = ['id','question','reason','detail','status','created_at']; read_only_fields = ['status','created_at']
