import re
from documents.models import DocumentChapter, DocumentSection, DocumentChunk, KnowledgeUnit

CHAPTER_PATTERN = re.compile(r'^(?:chương|bài|phần)\s+([\dIVXLCDM]+)\s*[:.\-–—]?\s*(.*)$', re.I)
SECTION_PATTERN = re.compile(r'^(\d+(?:\.\d+)+)\s*[:.\-–—]?\s*(.+)$')

def process_document(document):
    """Persist a deterministic, traceable structure; never sends file bytes to AI."""
    document.chapters.all().delete()
    lines = [line.strip() for line in document.raw_text.splitlines() if line.strip()]
    chapters, current_chapter, current_section = [], None, None
    for index, line in enumerate(lines):
        page = max(1, index // 45 + 1)
        chapter_match = CHAPTER_PATTERN.match(line)
        section_match = SECTION_PATTERN.match(line)
        if chapter_match:
            current_chapter = DocumentChapter.objects.create(document=document, number=chapter_match.group(1), title=chapter_match.group(2) or line, page_start=page, page_end=page)
            chapters.append(current_chapter)
            current_section = None
            continue
        if current_chapter is None:
            current_chapter = DocumentChapter.objects.create(document=document, number='1', title='Nội dung tài liệu', page_start=1, page_end=page)
            chapters.append(current_chapter)
        current_chapter.page_end = page
        current_chapter.save(update_fields=['page_end'])
        if section_match:
            current_section = DocumentSection.objects.create(chapter=current_chapter, number=section_match.group(1), title=section_match.group(2), page_number=page)
        chunk = DocumentChunk.objects.create(document=document, chapter=current_chapter, section=current_section, page_number=page, position=index, content=line)
        if len(line) >= 25:
            name = (current_section.title if current_section else line[:100]).strip()
            KnowledgeUnit.objects.create(document=document, chapter=current_chapter, section=current_section, source_chunk=chunk, name=name[:500], description=line, kind='concept', importance='important')
    document.status = document.Status.READY
    document.extraction_status = document.Status.READY
    document.save(update_fields=['status', 'extraction_status', 'updated_at'])
    return document
