import django.db.models.deletion
from django.conf import settings
from django.db import migrations,models
class Migration(migrations.Migration):
 initial=True
 dependencies=[('questions','0001_initial'),('quizzes','0001_initial'),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
 operations=[
 migrations.CreateModel(name='QuizAttempt',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('started_at',models.DateTimeField(auto_now_add=True)),('submitted_at',models.DateTimeField(blank=True,null=True)),('score',models.DecimalField(blank=True,decimal_places=2,max_digits=5,null=True)),('correct_count',models.PositiveIntegerField(default=0)),('total_questions',models.PositiveIntegerField(default=0)),('quiz',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='attempts',to='quizzes.quiz')),('user',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='attempts',to=settings.AUTH_USER_MODEL))]),
 migrations.CreateModel(name='UserAnswer',fields=[('id',models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name='ID')),('selected_answer',models.CharField(blank=True,max_length=1)),('is_correct',models.BooleanField(default=False)),('attempt',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='answers',to='attempts.quizattempt')),('question',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to='questions.question'))]),
 migrations.AddConstraint(model_name='useranswer',constraint=models.UniqueConstraint(fields=('attempt','question'),name='one_answer_per_question'))]
