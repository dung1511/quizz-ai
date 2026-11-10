import django.db.models.deletion
from django.conf import settings
from django.db import migrations,models
class Migration(migrations.Migration):
 initial=True
 dependencies=[('documents','0001_initial'),('questions','0001_initial'),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
 operations=[
 migrations.CreateModel(name='Quiz',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('title',models.CharField(max_length=255)),('description',models.TextField(blank=True)),('duration',models.PositiveIntegerField(default=15)),('created_at',models.DateTimeField(auto_now_add=True)),('updated_at',models.DateTimeField(auto_now=True)),('document',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='quizzes',to='documents.document')),('owner',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='quizzes',to=settings.AUTH_USER_MODEL))]),
 migrations.CreateModel(name='QuizQuestion',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('position',models.PositiveIntegerField()),('question',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,to='questions.question')),('quiz',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,to='quizzes.quiz'))],options={'ordering':['position']}),
 migrations.AddField(model_name='quiz',name='questions',field=models.ManyToManyField(related_name='quizzes',through='quizzes.QuizQuestion',to='questions.question')),
 migrations.AddConstraint(model_name='quizquestion',constraint=models.UniqueConstraint(fields=('quiz','question'),name='unique_quiz_question')),
 migrations.AddConstraint(model_name='quizquestion',constraint=models.UniqueConstraint(fields=('quiz','position'),name='unique_quiz_position'))]
