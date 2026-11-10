from pathlib import Path
from docx import Document as DocxDocument
from pypdf import PdfReader

SUPPORTED_TYPES = {'pdf', 'docx', 'txt'}

def extract_text(uploaded_file):
    extension = Path(uploaded_file.name).suffix.lower().lstrip('.')
    if extension not in SUPPORTED_TYPES:
        raise ValueError('Chỉ hỗ trợ PDF, DOCX và TXT.')
    if extension == 'docx':
        text = '\n'.join(p.text for p in DocxDocument(uploaded_file).paragraphs)
        pages = 1
    elif extension == 'pdf':
        reader = PdfReader(uploaded_file)
        pages = max(1, len(reader.pages))
        text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    else:
        raw = uploaded_file.read()
        for encoding in ('utf-8-sig', 'utf-8', 'cp1258'):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError('Không thể đọc TXT với UTF-8 hoặc CP1258.')
        pages = max(1, len(text) // 1800 + 1)
    text = normalize_text(text)
    if not text:
        raise ValueError('Không tìm thấy nội dung văn bản có thể trích xuất.')
    return extension, text, pages

def normalize_text(text):
    import unicodedata
    return '\n'.join(line.strip() for line in unicodedata.normalize('NFC', text).replace('\r\n', '\n').replace('\r', '\n').split('\n') if line.strip())
