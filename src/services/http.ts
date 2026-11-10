const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

let accessToken = localStorage.getItem('quizai_access_token');
let refreshToken = localStorage.getItem('quizai_refresh_token');

export function saveTokens(tokens: { access: string; refresh: string }) {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
  localStorage.setItem('quizai_access_token', tokens.access);
  localStorage.setItem('quizai_refresh_token', tokens.refresh);
}

export function clearTokens() {
  accessToken = refreshToken = null;
  localStorage.removeItem('quizai_access_token');
  localStorage.removeItem('quizai_refresh_token');
}

async function refreshAccessToken() {
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: refreshToken }) });
  if (!response.ok) { clearTokens(); return false; }
  const token = (await response.json()).access;
  accessToken = token;
  localStorage.setItem('quizai_access_token', token);
  return true;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && await refreshAccessToken()) return apiFetch(path, init, false);
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? body.error ?? `API error ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
