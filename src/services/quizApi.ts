import { apiJson } from './http';
export const listQuizzes = () => apiJson('/quizzes/');
export const getQuiz = (id: number) => apiJson(`/quizzes/${id}/`);
export const generateQuiz = (document: number, question_count: number, difficulty = 'medium', title = '') => apiJson('/quizzes/generate/', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document,question_count,difficulty,title})});
export const updateQuiz = (id: number, data: object) => apiJson(`/quizzes/${id}/`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export const startAttempt = (id: number) => apiJson(`/quizzes/${id}/start/`, {method:'POST'});
export const submitAttempt = (id: number, attempt_id: number, answers: Record<string,string>) => apiJson(`/quizzes/${id}/submit/`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt_id,answers})});
