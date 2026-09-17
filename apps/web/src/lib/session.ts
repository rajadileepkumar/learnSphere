import { refresh } from './api';

const KEY = 'ls_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(KEY);
}

// Returns a usable access token, silently refreshing via the httpOnly cookie
// when the tab has none in memory. Throws if the session is not valid.
export async function ensureAccessToken(): Promise<string> {
  const existing = getAccessToken();
  if (existing) return existing;
  const { data } = await refresh();
  setAccessToken(data.accessToken);
  return data.accessToken;
}
