import { apiJson } from './http';
export const listDocuments = () => apiJson('/documents/');
export const getDocument = (id: number) => apiJson(`/documents/${id}/`);
export const createTextDocument = (title: string, text: string) => apiJson('/documents/', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title,text}) });
export const uploadDocument = (file: File, title?: string) => { const data = new FormData(); data.append('file',file); if(title) data.append('title',title); return apiJson('/documents/', {method:'POST',body:data}); };
export const processDocument = (id: number) => apiJson(`/documents/${id}/process/`, {method:'POST'});
export const deleteDocument = (id: number) => apiJson<void>(`/documents/${id}/`, {method:'DELETE'});
