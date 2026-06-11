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
    if (typeof body.error === 'string') throw new Error(body.error);

    const fieldErrors = body.error?.fieldErrors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const messages = Object.values(fieldErrors).flat().filter(Boolean);
      if (messages.length > 0) throw new Error(messages.join('. '));
    }

    throw new Error(`Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}
