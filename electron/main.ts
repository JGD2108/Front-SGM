import { app, BrowserWindow } from "electron";
import path from "path";
import { clearStoredAuthToken, registerAuthIpc } from "./ipc-auth";

const isDev = !app.isPackaged;
const appName = "SGM";

let mainWindow: BrowserWindow | null = null;

function hardenWebContents(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL();
    if (current && url !== current) event.preventDefault();
  });
}

async function createWindow() {
  const iconPath = isDev ? path.join(app.getAppPath(), "build", "icon.ico") : undefined;

  mainWindow = new BrowserWindow({
    title: appName,
    icon: iconPath,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  hardenWebContents(mainWindow);

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173/#/login");
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "/login" });
  }
}

app.whenReady().then(() => {
  app.setName(appName);
  app.setAppUserModelId("com.sgm.desktop");
  registerAuthIpc();
  clearStoredAuthToken();
  return createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
