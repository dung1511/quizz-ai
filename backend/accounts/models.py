from django.conf import settings
from django.db import models

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=[('student', 'Student'), ('admin', 'Admin')], default='student')
    created_at = models.DateTimeField(auto_now_add=True)
