const AUTH_CHANGED_EVENT = "auth:changed";

function normalizeToken(token: string): string {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export async function getToken(): Promise<string | null> {
  const raw = window.electronAPI?.getToken
    ? await window.electronAPI.getToken()
    : sessionStorage.getItem("token");

  if (!raw) return null;
  const normalized = normalizeToken(raw);
  return normalized.length > 0 ? normalized : null;
}

export async function setToken(token: string): Promise<void> {
  const normalized = normalizeToken(token);
  if (!normalized) return;

  if (window.electronAPI?.setToken) {
    await window.electronAPI.setToken(normalized);
  } else {
    sessionStorage.setItem("token", normalized);
  }

  notifyAuthChanged();
}

export async function clearToken(): Promise<void> {
  if (window.electronAPI?.clearToken) {
    await window.electronAPI.clearToken();
  } else {
    sessionStorage.removeItem("token");
  }

  notifyAuthChanged();
}
