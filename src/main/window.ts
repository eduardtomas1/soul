import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isRendererUrl } from "./navigation";

function rendererLocation(): { url: string; devServer: boolean } {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) return { url: devServerUrl, devServer: true };
  return { url: pathToFileURL(join(__dirname, "../renderer/index.html")).href, devServer: false };
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Soul",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111114" : "#f7f6f3",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const renderer = rendererLocation();
  window.webContents.on("will-navigate", (event, url) => {
    if (!isRendererUrl(url, renderer.url, renderer.devServer)) event.preventDefault();
  });

  if (renderer.devServer) {
    void window.loadURL(renderer.url);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}
