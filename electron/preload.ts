import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getToken: () => ipcRenderer.invoke("auth:getToken"),
  setToken: (token: string) => ipcRenderer.invoke("auth:setToken", token),
  clearToken: () => ipcRenderer.invoke("auth:clearToken"),
});
