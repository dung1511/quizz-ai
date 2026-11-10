import { apiJson } from './http';
export const getQuestion = (id: number) => apiJson(`/questions/${id}/`);
export const getQuestionSource = (id: number) => apiJson(`/questions/${id}/source/`);
export const reportQuestion = (id: number, reason: string, detail = '') => apiJson(`/questions/${id}/report/`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason,detail})});
export const toggleFavorite = (id: number) => apiJson(`/questions/${id}/favorite/`, {method:'POST'});
