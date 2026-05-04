const SESSION_TOKEN_STORAGE_KEY = 'systemcraft-session-token';

export function getStoredSessionToken() {
  return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
}

export function setStoredSessionToken(sessionToken: string) {
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
}

export function clearStoredSessionToken() {
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}
