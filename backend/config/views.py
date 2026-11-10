from django.contrib.auth.models import User
import base64
import binascii
import json
import re
import uuid
from html import unescape
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from django.core.files.base import ContentFile
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from attempts.models import QuizAttempt, UserAnswer
from documents.models import Document, DocumentChapter, DocumentChunk, DocumentSection, ResearchSession, WebResearchSource, KnowledgeUnit
from documents.services.parser import extract_text
from documents.services.processor import process_document
from questions.models import Answer, FavoriteQuestion, Question, QuestionSource
from quizzes.models import Quiz, QuizQuestion
from reports.models import QuestionReport
from config.serializers import UserSerializer, DocumentSerializer, QuizSerializer, AttemptSerializer, QuestionSerializer, QuestionSourceSerializer, QuestionReportSerializer, EmailTokenObtainPairSerializer, ResearchSessionSerializer, WebResearchSourceSerializer, KnowledgeUnitSerializer
from config.services import generate_quiz

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

class DocumentExtractView(APIView):
    """Compatibility endpoint used by the browser's base64 document uploader."""
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data.get('fileBase64')
        if not isinstance(payload, str) or not payload:
            return Response({'error': 'Missing fileBase64 payload'}, status=400)

        # FileReader sends a data URL. Strip its header before strict decoding.
        encoded = payload.split(',', 1)[1] if payload.startswith('data:') and ',' in payload else payload
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            return Response({'error': 'Tệp tải lên không có dữ liệu base64 hợp lệ.'}, status=400)

        from django.conf import settings
        if len(raw) > settings.MAX_UPLOAD_SIZE:
            return Response({'error': 'Tệp vượt quá kích thước cho phép.'}, status=400)

        file_name = str(request.data.get('fileName') or 'TaiLieu.txt').replace('\\', '/').rsplit('/', 1)[-1]
        uploaded = ContentFile(raw, name=file_name)
        try:
            file_type, text, page_count = extract_text(uploaded)
        except Exception as error:
            return Response({'extractionStatus': 'failed', 'error': str(error), 'errorMessage': str(error)}, status=400)
        return Response({
            'text': text,
            'pageCount': page_count,
            'fileType': file_type,
            'extractionStatus': 'success',
        })

class DocumentTextProcessView(APIView):
    """Compatibility endpoint for the browser's stateless document workflow."""
    permission_classes = [AllowAny]

    def post(self, request):
        text = request.data.get('text')
        if not isinstance(text, str) or not text.strip():
            return Response({'error': 'Missing document text content'}, status=400)

        file_name = str(request.data.get('fileName') or 'TaiLieu.txt')
        file_type = request.data.get('fileType') or 'txt'
        document_id = f'doc-{uuid.uuid4().hex}'
        chapter_id = f'{document_id}-chapter-1'
        section_id = f'{document_id}-section-1'
        chunk_id = f'{document_id}-chunk-1'
        page_count = max(1, (len(text) + 1599) // 1600)
        excerpt = text.strip()
        concept_name = next((line.strip() for line in excerpt.splitlines() if line.strip()), 'Nội dung chính')[:100]
        title = file_name.rsplit('.', 1)[0].replace('_', ' ')

        return Response({
            'id': document_id,
            'title': title,
            'fileName': file_name,
            'fileType': file_type,
            'fileSize': request.data.get('fileSize') or '0 MB',
            'pageCount': page_count,
            'status': 'READY',
            'rawText': excerpt,
            'chapters': [{
                'id': chapter_id,
                'chapterNumber': 1,
                'title': 'Nội dung tài liệu',
                'pageStart': 1,
                'pageEnd': page_count,
                'sections': [{
                    'id': section_id,
                    'chapterId': chapter_id,
                    'sectionNumber': '1.1',
                    'title': 'Nội dung chính',
                    'page': 1,
                    'summary': excerpt[:300],
                }],
            }],
            'chunks': [{
                'id': chunk_id,
                'documentId': document_id,
                'chapterId': chapter_id,
                'chapterTitle': 'Nội dung tài liệu',
                'sectionId': section_id,
                'sectionTitle': 'Nội dung chính',
                'pageNumber': 1,
                'content': excerpt,
                'startPosition': 0,
                'endPosition': len(excerpt),
            }],
            'knowledgeUnits': [{
                'id': f'{document_id}-unit-1',
                'documentId': document_id,
                'chapter': 'Nội dung tài liệu',
                'section': '1.1 Nội dung chính',
                'name': concept_name,
                'type': 'concept',
                'description': excerpt[:300],
                'importance': 'important',
                'sourceChunkId': chunk_id,
                'sourceText': excerpt,
                'pageNumber': 1,
            }],
        })

def owned_or_admin(queryset, user):
    return queryset if user.is_staff else queryset.filter(owner=user)

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username, password = request.data.get('username','').strip(), request.data.get('password','')
        email = request.data.get('email', '').strip()
        if not username or len(password) < 8: return Response({'detail':'Tên đăng nhập và mật khẩu từ 8 ký tự là bắt buộc.'}, status=400)
        if User.objects.filter(username=username).exists(): return Response({'detail':'Tên đăng nhập đã tồn tại.'}, status=400)
        if email and User.objects.filter(email__iexact=email).exists(): return Response({'detail':'Email đã được sử dụng.'}, status=400)
        user = User.objects.create_user(username=username, email=email, password=password)
        return Response(UserSerializer(user).data, status=201)
class MeView(APIView):
    def get(self, request): return Response(UserSerializer(request.user).data)

class DocumentListCreateView(APIView):
    def get(self, request): return Response(DocumentSerializer(owned_or_admin(Document.objects.all(), request.user).order_by('-created_at'), many=True).data)
    def post(self, request):
        uploaded = request.FILES.get('file')
        text = (request.data.get('text') or '').strip()
        if bool(uploaded) == bool(text): return Response({'detail':'Gửi đúng một trong hai: file hoặc text.'}, status=400)
        try:
            if uploaded:
                if uploaded.size > __import__('django.conf').conf.settings.MAX_UPLOAD_SIZE: return Response({'detail':'Tệp vượt kích thước cho phép.'}, status=400)
                file_type, raw_text, page_count = extract_text(uploaded)
                document = Document.objects.create(owner=request.user, title=request.data.get('title') or uploaded.name.rsplit('.',1)[0], file=uploaded, file_type=file_type, raw_text=raw_text, page_count=page_count, status='uploaded', extraction_status='uploaded')
            else:
                document = Document.objects.create(owner=request.user, title=request.data.get('title') or 'Văn bản đã dán', file_type='text', raw_text=text, page_count=max(1, len(text)//1800+1), status='uploaded', extraction_status='uploaded')
        except (ValueError, Exception) as error:
            return Response({'detail':str(error)}, status=400)
        return Response(DocumentSerializer(document).data, status=201)

class DocumentDetailView(APIView):
    def get_object(self, request, pk): return get_object_or_404(owned_or_admin(Document.objects.all(), request.user), pk=pk)
    def get(self, request, pk): return Response(DocumentSerializer(self.get_object(request,pk)).data)
    def delete(self, request, pk): self.get_object(request,pk).delete(); return Response(status=204)
class DocumentProcessView(APIView):
    def post(self, request, pk):
        document = get_object_or_404(owned_or_admin(Document.objects.all(), request.user), pk=pk)
        document.status = 'processing'; document.save(update_fields=['status'])
        try: process_document(document)
        except Exception as error:
            document.status = 'failed'; document.extraction_status = 'failed'; document.save(update_fields=['status','extraction_status']); return Response({'detail':str(error)}, status=400)
        return Response(DocumentSerializer(document).data)

class QuizListCreateView(APIView):
    def get(self, request): return Response(QuizSerializer(owned_or_admin(Quiz.objects.all(), request.user).order_by('-created_at'), many=True).data)
    def post(self, request):
        return QuizGenerateView().post(request)
class QuizGenerateView(APIView):
    def post(self, request):
        document = get_object_or_404(owned_or_admin(Document.objects.all(), request.user), pk=request.data.get('document'))
        if document.status != 'ready': return Response({'detail':'Tài liệu cần được xử lý trước khi tạo đề.'}, status=400)
        count = min(50, max(1, int(request.data.get('question_count', 10))))
        try: quiz = generate_quiz(request.user, document, request.data.get('title',''), count, request.data.get('difficulty','medium'))
        except ValueError as error: return Response({'detail':str(error)}, status=400)
        return Response(QuizSerializer(quiz).data, status=201)
class QuizDetailView(APIView):
    def get_object(self, request, pk): return get_object_or_404(owned_or_admin(Quiz.objects.all(), request.user), pk=pk)
    def get(self, request, pk): return Response(QuizSerializer(self.get_object(request,pk)).data)
    def patch(self, request, pk):
        quiz = self.get_object(request,pk)
        for field in ('title','description','duration'):
            if field in request.data: setattr(quiz,field,request.data[field])
        quiz.save(); return Response(QuizSerializer(quiz).data)
    def delete(self, request, pk): self.get_object(request,pk).delete(); return Response(status=204)

class QuizStartView(APIView):
    def post(self, request, pk):
        quiz = get_object_or_404(owned_or_admin(Quiz.objects.all(), request.user), pk=pk)
        attempt = QuizAttempt.objects.create(user=request.user, quiz=quiz, total_questions=quiz.questions.count())
        return Response(AttemptSerializer(attempt).data, status=201)
class QuizSubmitView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        quiz = get_object_or_404(owned_or_admin(Quiz.objects.all(), request.user), pk=pk)
        attempt = get_object_or_404(QuizAttempt, pk=request.data.get('attempt_id'), user=request.user, quiz=quiz, submitted_at__isnull=True)
        selections = request.data.get('answers', {})
        questions = list(quiz.questions.all())
        correct = 0
        for question in questions:
            selected = selections.get(str(question.id), '')
            is_correct = selected == question.correct_answer
            correct += is_correct
            UserAnswer.objects.update_or_create(attempt=attempt, question=question, defaults={'selected_answer':selected, 'is_correct':is_correct})
        attempt.correct_count, attempt.total_questions, attempt.score, attempt.submitted_at = correct, len(questions), round(correct / len(questions) * 10, 2) if questions else 0, timezone.now()
        attempt.save(); return Response(AttemptSerializer(attempt).data)
class AttemptDetailView(APIView):
    def get(self, request, pk): return Response(AttemptSerializer(get_object_or_404(QuizAttempt, pk=pk, user=request.user)).data)

def _clean_text_from_html(raw_html: str) -> str:
    if not raw_html:
        return ''
    text = re.sub(r'<script.*?</script>', ' ', raw_html, flags=re.I | re.S)
    text = re.sub(r'<style.*?</style>', ' ', text, flags=re.I | re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _normalize_url(raw_url: str) -> str:
    if not raw_url:
        return ''
    return raw_url.strip().split('#', 1)[0].rstrip('/') or raw_url.strip()


def _source_type_for_domain(domain: str) -> str:
    lower = (domain or '').lower()
    if 'python.org' in lower or 'mdn' in lower or 'react.dev' in lower or 'djangoproject.com' in lower or 'docs.djangoproject.com' in lower or 'postgresql.org' in lower:
        return 'OFFICIAL'
    if 'wikipedia.org' in lower:
        return 'REFERENCE'
    if 'edu' in lower or '.ac.' in lower or 'university' in lower:
        return 'EDUCATIONAL'
    if 'gov' in lower:
        return 'GOVERNMENT'
    return 'OTHER'


def _fetch_url_text(url: str):
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; QuizAI/1.0)'})
        with urlopen(request, timeout=15) as response:
            html = response.read().decode('utf-8', errors='ignore')
        text = _clean_text_from_html(html)
        if len(text) < 200:
            return None
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, flags=re.I | re.S)
        title = _clean_text_from_html(title_match.group(1)) if title_match else urlparse(url).netloc
        return {'title': title[:200], 'url': url, 'domain': urlparse(url).netloc, 'content': text[:8000], 'summary': text[:500]}
    except Exception:
        return None


def _search_public_sources(topic: str, limit: int = 5):
    results = []
    seen = set()

    duckduckgo_url = 'https://api.duckduckgo.com/?q=' + __import__('urllib.parse').parse.quote(topic) + '&format=json&no_redirect=1&no_html=1&skip_disambig=1'
    try:
        request = Request(duckduckgo_url, headers={'User-Agent': 'Mozilla/5.0 (compatible; QuizAI/1.0)'})
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode('utf-8', errors='ignore'))
        abstracts = []
        if payload.get('AbstractText'):
            abstracts.append({'url': payload.get('AbstractURL') or duckduckgo_url, 'text': payload.get('AbstractText')})
        for item in payload.get('RelatedTopics', []) or []:
            if isinstance(item, dict) and item.get('FirstURL'):
                abstracts.append({'url': item['FirstURL'], 'text': item.get('Text') or item.get('FirstURL')})
        for item in abstracts:
            page = _fetch_url_text(item['url'])
            if not page:
                continue
            normalized = _normalize_url(page['url'])
            if normalized in seen:
                continue
            seen.add(normalized)
            results.append({
                'title': page['title'],
                'url': normalized,
                'domain': page['domain'],
                'source_type': _source_type_for_domain(page['domain']),
                'content': page['content'],
                'summary': page['summary'],
            })
    except Exception:
        pass

    if len(results) >= limit:
        return results[:limit]

    wikipedia_url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + __import__('urllib.parse').parse.quote(topic) + '&format=json&origin=*'
    try:
        request = Request(wikipedia_url, headers={'User-Agent': 'Mozilla/5.0 (compatible; QuizAI/1.0)'})
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode('utf-8', errors='ignore'))
        pages = payload.get('query', {}).get('search', []) or []
        for page in pages[:max(1, limit - len(results))]:
            wiki_url = 'https://en.wikipedia.org/wiki/' + page['title'].replace(' ', '_')
            page_data = _fetch_url_text(wiki_url)
            if not page_data:
                continue
            normalized = _normalize_url(page_data['url'])
            if normalized in seen:
                continue
            seen.add(normalized)
            results.append({
                'title': page_data['title'],
                'url': normalized,
                'domain': page_data['domain'],
                'source_type': 'REFERENCE',
                'content': page_data['content'],
                'summary': page_data['summary'],
            })
    except Exception:
        pass

    return results[:limit]


class ResearchSessionCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required for research persistence.'}, status=401)

        prompt = (request.data.get('prompt') or request.data.get('instruction') or request.data.get('topic') or '').strip()
        topic = (request.data.get('topic') or '').strip() or (re.search(r'(?:về|tạo.*?về|chủ đề|môn|học.*?về)\s+([^,.!?]+)', prompt, flags=re.I) or [None])[0] or 'Chủ đề học tập'
        if not prompt:
            return Response({'error': 'Missing prompt'}, status=400)

        research_session = ResearchSession.objects.create(
            user=request.user,
            query=prompt,
            topic=topic,
            status='SEARCHING',
        )

        try:
            submitted_sources = request.data.get('sources')
            sources = submitted_sources[:12] if isinstance(submitted_sources, list) else _search_public_sources(topic, limit=5)
            if not sources:
                research_session.status = 'FAILED'
                research_session.error_message = 'Không tìm thấy đủ nguồn đáng tin cậy để tạo câu hỏi cho chủ đề này.'
                research_session.save(update_fields=['status', 'error_message'])
                return Response({
                    'research_session_id': research_session.id,
                    'status': 'FAILED',
                    'topic': topic,
                    'source_count': 0,
                    'knowledge_unit_count': 0,
                    'error_message': research_session.error_message,
                }, status=503)

            research_session.status = 'PROCESSING'
            research_session.save(update_fields=['status'])

            saved_source_ids = []
            sources_by_url = {}
            for entry in sources:
                source_url = _normalize_url(str(entry.get('url') or ''))
                parsed_url = urlparse(source_url)
                if parsed_url.scheme not in ('http', 'https') or not parsed_url.netloc:
                    continue
                source_content = str(entry.get('content') or '')[:30000]
                source_title = str(entry.get('title') or '').strip()[:500]
                if not source_title or len(source_content.strip()) < 100:
                    continue
                source, _created = WebResearchSource.objects.get_or_create(
                    research_session=research_session,
                    url=source_url,
                    defaults={
                        'title': source_title,
                        'domain': str(entry.get('domain') or parsed_url.netloc)[:255],
                        'source_type': str(entry.get('source_type') or 'OTHER')[:20],
                        'content': source_content,
                        'summary': str(entry.get('summary') or '')[:10000],
                    },
                )
                saved_source_ids.append(source.id)
                sources_by_url[source_url] = source

            if not saved_source_ids:
                raise ValueError('Không có nguồn hợp lệ để lưu phiên nghiên cứu.')

            knowledge_units = []
            submitted_units = request.data.get('knowledge_units')
            if isinstance(submitted_units, list):
                for entry in submitted_units[:30]:
                    source = sources_by_url.get(_normalize_url(str(entry.get('source_url') or '')))
                    excerpt = str(entry.get('source_excerpt') or '').strip()
                    unit_name = str(entry.get('name') or '').strip()[:500]
                    if not source or not unit_name or len(excerpt) < 30 or excerpt not in source.content:
                        continue
                    unit, _created = KnowledgeUnit.objects.get_or_create(
                        research_session=research_session,
                        source=source,
                        name=unit_name,
                        defaults={
                            'description': str(entry.get('summary') or '')[:10000],
                            'source_excerpt': excerpt[:10000],
                            'importance': 'important',
                        },
                    )
                    knowledge_units.append(unit)
            else:
                for index, source in enumerate(WebResearchSource.objects.filter(research_session=research_session).order_by('id'), start=1):
                    snippet = (source.content or source.summary or '').strip()
                    if not snippet:
                        continue
                    unit, _created = KnowledgeUnit.objects.get_or_create(
                        research_session=research_session,
                        source=source,
                        name=source.title[:120],
                        defaults={
                            'description': source.summary or snippet[:300],
                            'source_excerpt': snippet[:600],
                            'importance': 'important' if index <= 3 else 'supplementary',
                        },
                    )
                    knowledge_units.append(unit)

            if isinstance(submitted_units, list) and not knowledge_units:
                raise ValueError('Không có đơn vị kiến thức nào có trích dẫn nguyên văn hợp lệ để lưu.')

            research_session.status = 'COMPLETED'
            research_session.completed_at = timezone.now()
            research_session.save(update_fields=['status', 'completed_at'])

            return Response({
                'research_session_id': research_session.id,
                'status': 'COMPLETED',
                'topic': topic,
                'source_count': WebResearchSource.objects.filter(research_session=research_session).count(),
                'knowledge_unit_count': knowledge_units.__len__(),
            }, status=201)
        except Exception as exc:
            research_session.status = 'FAILED'
            research_session.error_message = str(exc)
            research_session.save(update_fields=['status', 'error_message'])
            return Response({
                'research_session_id': research_session.id,
                'status': 'FAILED',
                'topic': topic,
                'source_count': 0,
                'knowledge_unit_count': 0,
                'error_message': str(exc),
            }, status=500)


class ResearchQuizPersistView(APIView):
    @transaction.atomic
    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required to save the generated quiz.'}, status=401)

        try:
            research_session = ResearchSession.objects.get(
                pk=request.data.get('research_session_id'),
                user=request.user,
                status='COMPLETED',
            )
        except (ResearchSession.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Không tìm thấy phiên nghiên cứu đã lưu.'}, status=404)

        title = str(request.data.get('title') or '').strip()
        requirements = str(request.data.get('description') or '').strip()
        questions = request.data.get('questions')
        if not title or len(title) > 255:
            return Response({'error': 'Tên bộ đề bắt buộc và không được vượt quá 255 ký tự.'}, status=400)
        if not isinstance(questions, list) or not 1 <= len(questions) <= 50:
            return Response({'error': 'Bộ đề phải có từ 1 đến 50 câu hỏi.'}, status=400)

        saved_sources = {
            _normalize_url(source.url): source
            for source in WebResearchSource.objects.filter(research_session=research_session)
        }
        for index, item in enumerate(questions, start=1):
            source_data = item.get('source') or {}
            source = saved_sources.get(_normalize_url(str(source_data.get('sourceUrl') or '')))
            source_text = str(source_data.get('sourceText') or '').strip()
            options = item.get('options')
            answer_keys = {option.get('key') for option in options} if isinstance(options, list) else set()
            if not source or len(source_text) < 30 or source_text not in source.content:
                return Response({'error': f'Câu {index} không có trích dẫn khớp với nguồn research đã lưu.'}, status=400)
            if answer_keys != {'A', 'B', 'C', 'D'} or item.get('correctAnswer') not in answer_keys:
                return Response({'error': f'Câu {index} không có đủ bốn đáp án hợp lệ.'}, status=400)
            if not str(item.get('questionText') or '').strip() or not str(item.get('explanation') or '').strip():
                return Response({'error': f'Câu {index} thiếu nội dung hoặc giải thích.'}, status=400)

        raw_text = '\n\n'.join(
            f"## {source.title}\n{source.url}\n{source.content}"
            for source in saved_sources.values()
        )
        document = Document.objects.create(
            owner=request.user,
            title=title,
            file_type='text',
            raw_text=raw_text,
            status='ready',
            extraction_status='ready',
            page_count=max(1, (len(raw_text) + 1599) // 1600),
        )
        quiz = Quiz.objects.create(
            owner=request.user,
            document=document,
            title=title,
            description=requirements,
            duration=max(1, min(300, int(request.data.get('duration') or 15))),
        )

        chapters = {}
        sections = {}
        for index, item in enumerate(questions):
            source_data = item['source']
            source = saved_sources[_normalize_url(str(source_data['sourceUrl']))]
            chapter_title = str(source_data.get('chapter') or research_session.topic)[:500]
            section_title = str(source_data.get('section') or chapter_title)[:500]
            chapter = chapters.get(chapter_title)
            if chapter is None:
                chapter = DocumentChapter.objects.create(
                    document=document,
                    number=str(len(chapters) + 1),
                    title=chapter_title,
                    page_start=1,
                    page_end=document.page_count,
                )
                chapters[chapter_title] = chapter
            section_key = (chapter.id, section_title)
            section = sections.get(section_key)
            if section is None:
                section = DocumentSection.objects.create(
                    chapter=chapter,
                    number=str(len(sections) + 1),
                    title=section_title,
                    page_number=1,
                    summary=str(source_data.get('sourceText') or '')[:1000],
                )
                sections[section_key] = section

            source_text = str(source_data['sourceText']).strip()
            position = max(0, raw_text.find(source_text))
            source_chunk = DocumentChunk.objects.create(
                document=document,
                chapter=chapter,
                section=section,
                page_number=max(1, int(source_data.get('page') or 1)),
                position=position,
                content=source_text,
            )
            knowledge_unit, _created = KnowledgeUnit.objects.get_or_create(
                research_session=research_session,
                source=source,
                name=str(source_data.get('knowledgeUnit') or source.title)[:500],
                defaults={
                    'document': document,
                    'chapter': chapter,
                    'section': section,
                    'source_chunk': source_chunk,
                    'description': source_text[:1000],
                    'source_excerpt': source_text,
                    'importance': 'important',
                },
            )
            question = Question.objects.create(
                owner=request.user,
                text=str(item['questionText']).strip(),
                explanation=str(item['explanation']).strip(),
                difficulty=str(item.get('difficulty') or 'medium'),
                topic=str(item.get('topic') or research_session.topic)[:500],
                correct_answer=item['correctAnswer'],
            )
            for option in item['options']:
                Answer.objects.create(question=question, key=option['key'], text=str(option.get('text') or '').strip())
            QuestionSource.objects.create(
                question=question,
                document=document,
                web_source=source,
                chapter=chapter,
                section=section,
                page_number=max(1, int(source_data.get('page') or 1)),
                source_chunk=source_chunk,
                source_text=source_text,
                knowledge_unit=knowledge_unit,
                source_type='WEB',
                generation_reason=str(source_data.get('generationReason') or 'Căn cứ trên trích dẫn nguồn nghiên cứu.')[:1000],
            )
            QuizQuestion.objects.create(quiz=quiz, question=question, position=index + 1)

        return Response(QuizSerializer(quiz).data, status=201)


class ResearchSessionHistoryView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=401)
        queryset = ResearchSession.objects.filter(user=request.user).order_by('-created_at') if not request.user.is_staff else ResearchSession.objects.order_by('-created_at')
        return Response(ResearchSessionSerializer(queryset, many=True).data)


class ResearchSessionDetailView(APIView):
    def get(self, request, pk):
        session = get_object_or_404(ResearchSession, pk=pk)
        if request.user.is_authenticated and session.user_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Không có quyền xem research session này.'}, status=403)
        return Response(ResearchSessionSerializer(session).data)


class ResearchSessionSourcesView(APIView):
    def get(self, request, pk):
        session = get_object_or_404(ResearchSession, pk=pk)
        if request.user.is_authenticated and session.user_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Không có quyền xem nguồn này.'}, status=403)
        return Response(WebResearchSourceSerializer(session.sources.all(), many=True).data)


class ResearchSessionKnowledgeUnitsView(APIView):
    def get(self, request, pk):
        session = get_object_or_404(ResearchSession, pk=pk)
        if request.user.is_authenticated and session.user_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Không có quyền xem knowledge unit này.'}, status=403)
        return Response(KnowledgeUnitSerializer(session.knowledge_units.all(), many=True).data)


class QuestionDetailView(APIView):
    def get_object(self, request, pk): return get_object_or_404(Question.objects.filter(owner=request.user) | Question.objects.filter(quizzes__owner=request.user), pk=pk)
    def get(self, request, pk): return Response(QuestionSerializer(self.get_object(request,pk)).data)
class QuestionSourceView(APIView):
    def get(self, request, pk):
        question = get_object_or_404(Question.objects.filter(owner=request.user) | Question.objects.filter(quizzes__owner=request.user), pk=pk)
        sources = list(question.sources.select_related('web_source', 'document', 'knowledge_unit', 'chapter', 'section'))
        if not sources:
            return Response({'detail': 'Question chưa có source mapping.'}, status=404)

        source_type = sources[0].source_type if len(sources) == 1 else 'MIXED'
        knowledge_units = [source.knowledge_unit.name for source in sources if source.knowledge_unit and source.knowledge_unit.name]

        payload_sources = []
        for source in sources:
            if source.web_source_id:
                payload_sources.append({
                    'title': source.web_source.title,
                    'url': source.web_source.url,
                    'domain': source.web_source.domain,
                    'excerpt': source.source_text,
                    'generation_reason': source.generation_reason,
                })
            else:
                payload_sources.append({
                    'title': source.document.title if source.document else 'Document source',
                    'url': source.document.file.url if source.document and source.document.file else None,
                    'domain': 'document.local',
                    'excerpt': source.source_text,
                    'generation_reason': source.generation_reason,
                })

        payload = {
            'question_id': question.id,
            'source_type': source_type,
            'knowledge_unit': knowledge_units[0] if len(knowledge_units) == 1 else knowledge_units,
            'sources': payload_sources,
        }
        return Response(payload)
class QuestionReportView(APIView):
    def post(self, request, pk):
        question = get_object_or_404(Question.objects.filter(quizzes__owner=request.user), pk=pk)
        serializer = QuestionReportSerializer(data={**request.data, 'question':question.id})
        serializer.is_valid(raise_exception=True); serializer.save(reporter=request.user); return Response(serializer.data, status=201)
class FavoriteView(APIView):
    def post(self, request, pk):
        question = get_object_or_404(Question.objects.filter(quizzes__owner=request.user), pk=pk)
        favorite, created = FavoriteQuestion.objects.get_or_create(user=request.user, question=question)
        if not created: favorite.delete()
        return Response({'favorite':created})
class AdminReportListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = QuestionReportSerializer
    queryset = QuestionReport.objects.select_related('question','reporter').order_by('-created_at')
