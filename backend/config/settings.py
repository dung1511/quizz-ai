import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'unsafe-development-key-change-me')
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'corsheaders', 'rest_framework',
    'accounts', 'documents', 'questions', 'quizzes', 'attempts', 'reports',
]
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', 'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': [
                  'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
                  'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith(('postgres://', 'postgresql://')):
    parsed_database_url = urlparse(database_url)
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': parsed_database_url.path.lstrip('/'), 'USER': parsed_database_url.username, 'PASSWORD': parsed_database_url.password, 'HOST': parsed_database_url.hostname, 'PORT': parsed_database_url.port or 5432, 'CONN_MAX_AGE': 600}}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:' if os.environ.get('QUIZAI_IN_MEMORY_DB') else BASE_DIR / 'db.sqlite3'}}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS = [origin for origin in os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',') if origin]
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
                  'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',)}
MAX_UPLOAD_SIZE = int(os.environ.get('MAX_UPLOAD_SIZE', 10 * 1024 * 1024))
# The browser sends base64 in JSON, which is about one third larger than the
# original file. Keep Django's request-body limit above that encoded size.
DATA_UPLOAD_MAX_MEMORY_SIZE = (MAX_UPLOAD_SIZE * 4 // 3) + 1024 * 1024
