import django.db.models.deletion
from django.conf import settings
from django.db import migrations,models
class Migration(migrations.Migration):
 initial=True
 dependencies=[('questions','0001_initial'),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
 operations=[migrations.CreateModel(name='QuestionReport',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('reason',models.CharField(choices=[('wrong_answer','Sai đáp án'),('unclear','Câu hỏi không rõ'),('not_in_source','Không có trong tài liệu'),('wrong_explanation','Giải thích sai'),('duplicate','Trùng câu'),('other','Khác')],max_length=30)),('detail',models.TextField(blank=True)),('status',models.CharField(choices=[('pending','Pending'),('reviewing','Reviewing'),('resolved','Resolved'),('rejected','Rejected')],default='pending',max_length=20)),('created_at',models.DateTimeField(auto_now_add=True)),('question',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='reports',to='questions.question')),('reporter',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,to=settings.AUTH_USER_MODEL))])]
