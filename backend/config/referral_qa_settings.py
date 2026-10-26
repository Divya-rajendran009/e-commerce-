"""Local-only referral acceptance lab; never use for a deployed service."""
from .test_settings import *

DEBUG = True
SECRET_KEY = 'isolated-referral-lab-not-for-production'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'referral-qa.sqlite3'}}
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CORS_ALLOWED_ORIGINS = ['http://localhost:5179', 'http://127.0.0.1:5179']
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_CLASSES': [], 'DEFAULT_THROTTLE_RATES': {'login': '10000/min', 'referral_validation': '10000/min'}}
