from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from config.views import RegisterView, MeView, EmailTokenObtainPairView, DocumentExtractView, DocumentTextProcessView, DocumentListCreateView, DocumentDetailView, DocumentProcessView, QuizListCreateView, QuizDetailView, QuizGenerateView, QuizStartView, QuizSubmitView, AttemptDetailView, QuestionDetailView, QuestionSourceView, QuestionReportView, FavoriteView, AdminReportListView, ResearchSessionCreateView, ResearchQuizPersistView, ResearchSessionDetailView, ResearchSessionSourcesView, ResearchSessionKnowledgeUnitsView, ResearchSessionHistoryView

urlpatterns = [
 path('auth/register/', RegisterView.as_view()), path('auth/login/', EmailTokenObtainPairView.as_view()), path('auth/refresh/', TokenRefreshView.as_view()), path('auth/me/', MeView.as_view()),
 path('documents/extract', DocumentExtractView.as_view()),
 path('documents/process', DocumentTextProcessView.as_view()),
 path('documents/', DocumentListCreateView.as_view()), path('documents/<int:pk>/', DocumentDetailView.as_view()), path('documents/<int:pk>/process/', DocumentProcessView.as_view()),
 path('ai/research/', ResearchSessionCreateView.as_view()),
 path('ai/research/save-quiz/', ResearchQuizPersistView.as_view()),
 path('research/history/', ResearchSessionHistoryView.as_view()),
 path('research/<int:pk>/', ResearchSessionDetailView.as_view()),
 path('research/<int:pk>/sources/', ResearchSessionSourcesView.as_view()),
 path('research/<int:pk>/knowledge-units/', ResearchSessionKnowledgeUnitsView.as_view()),
 path('quizzes/', QuizListCreateView.as_view()), path('quizzes/generate/', QuizGenerateView.as_view()), path('quizzes/<int:pk>/', QuizDetailView.as_view()), path('quizzes/<int:pk>/start/', QuizStartView.as_view()), path('quizzes/<int:pk>/submit/', QuizSubmitView.as_view()),
 path('questions/<int:pk>/', QuestionDetailView.as_view()), path('questions/<int:pk>/source/', QuestionSourceView.as_view()), path('questions/<int:pk>/report/', QuestionReportView.as_view()), path('questions/<int:pk>/favorite/', FavoriteView.as_view()),
 path('attempts/<int:pk>/', AttemptDetailView.as_view()), path('admin/reports/', AdminReportListView.as_view()),
]
