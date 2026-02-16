export async function getToken(): Promise<string | null> {
  if (window.electronAPI?.getToken) return window.electronAPI.getToken();
  return sessionStorage.getItem("token");
}

export async function setToken(token: string): Promise<void> {
  if (window.electronAPI?.setToken) {
    await window.electronAPI.setToken(token);
    return;
  }
  sessionStorage.setItem("token", token);
}

export async function clearToken(): Promise<void> {
  if (window.electronAPI?.clearToken) {
    await window.electronAPI.clearToken();
    return;
  }
  sessionStorage.removeItem("token");
}
