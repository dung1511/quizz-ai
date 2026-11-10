import { apiJson, clearTokens, saveTokens } from './http';
export const register = (username: string, password: string, email = '') => apiJson('/auth/register/', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password, email }) });
export interface AuthUser { id: number; username: string; email: string; is_staff: boolean }
export async function login(identifier: string, password: string) { const tokens = await apiJson<{access:string;refresh:string}>('/auth/login/', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: identifier, password }) }); saveTokens(tokens); return tokens; }
export const logout = clearTokens;
export const getCurrentUser = () => apiJson<AuthUser>('/auth/me/');
