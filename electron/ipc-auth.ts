import Store from "electron-store";
import { ipcMain, safeStorage } from "electron";

const TOKEN_KEY = "token";
const store = new Store() as any;

function encryptToken(token: string): string {
  if (!safeStorage.isEncryptionAvailable()) return `plain:${token}`;
  const encrypted = safeStorage.encryptString(token).toString("base64");
  return `v1:${encrypted}`;
}

function decryptToken(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  if (value.startsWith("v1:")) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      const buf = Buffer.from(value.slice(3), "base64");
      return safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }

  if (value.startsWith("plain:")) return value.slice(6);
  // Backward compatibility with previously stored raw tokens.
  return value;
}

export function registerAuthIpc() {
  ipcMain.handle("auth:getToken", () => {
    return decryptToken(store.get(TOKEN_KEY));
  });

  ipcMain.handle("auth:setToken", (_evt, token: string) => {
    store.set(TOKEN_KEY, encryptToken(token));
    return true;
  });

  ipcMain.handle("auth:clearToken", () => {
    store.delete(TOKEN_KEY);
    return true;
  });
}

export function clearStoredAuthToken() {
  store.delete(TOKEN_KEY);
}
