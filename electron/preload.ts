import { contextBridge, ipcRenderer } from "electron";

export interface NeuroPulseBridge {
  apiBaseUrl: string;
  platform: NodeJS.Platform;
  appVersion: string;
  isDesktop: boolean;
  getBackendStatus: () => Promise<{ apiBaseUrl: string; ready: boolean }>;
  openDataFolder: () => Promise<void>;
}

const apiUrlArg = process.argv.find((arg) => arg.startsWith("--neuropulse-api="));
const apiBaseUrl = apiUrlArg ? apiUrlArg.split("=")[1] : "http://127.0.0.1:18765";

const versionArg = process.argv.find((arg) => arg.startsWith("--neuropulse-version="));
const appVersion = versionArg ? versionArg.split("=")[1] : "1.0.0";

const bridge: NeuroPulseBridge = {
  apiBaseUrl,
  platform: process.platform,
  appVersion,
  isDesktop: true,
  getBackendStatus: () => ipcRenderer.invoke("backend:status"),
  openDataFolder: () => ipcRenderer.invoke("app:open-data-folder"),
};

contextBridge.exposeInMainWorld("neuropulse", bridge);
