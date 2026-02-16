export {};

declare global {
  interface Window {
    electronAPI?: {
      getToken: () => Promise<string | null>;
      setToken: (token: string) => Promise<void>;
      clearToken: () => Promise<void>;
    };
  }
}
