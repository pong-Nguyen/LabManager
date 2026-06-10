const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('lab.token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('lab.token', token);
  else localStorage.removeItem('lab.token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(typeof body.error === 'string' ? body.error : 'Request failed');
  }
  return response.status === 204 ? undefined as T : response.json();
}
