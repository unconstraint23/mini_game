import { app, BrowserWindow, ipcMain, shell } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendApiUrl = process.env.NEUROPULSE_API_URL || "";
let backendReady = false;

// Always bypass system/VPN proxies for local Python sidecar communication
app.commandLine.appendSwitch("proxy-bypass-list", "127.0.0.1;localhost;<local>");

const isDev = !app.isPackaged;
const devRendererUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to allocate local port")));
      }
    });
  });
}

function checkHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/health`, { timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(url: string, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkHealth(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function getDatabasePath(): string {
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "neuropulse.db");
}

function resolveBackendCommand(): { command: string; args: string[]; cwd: string } {
  const isWin = process.platform === "win32";
  if (app.isPackaged) {
    const binName = isWin ? "neuropulse-backend.exe" : "neuropulse-backend";
    const binPath = path.join(process.resourcesPath, "backend", binName);
    return {
      command: binPath,
      args: [],
      cwd: path.dirname(binPath),
    };
  }

  const projectRoot = path.resolve(__dirname, "..");
  const backendDir = path.join(projectRoot, "backend");
  const venvPython = isWin
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python");

  const pythonBin = fs.existsSync(venvPython)
    ? venvPython
    : isWin
      ? "python"
      : "python3";

  return {
    command: pythonBin,
    args: [path.join(backendDir, "main.py")],
    cwd: backendDir,
  };
}

async function ensureBackendRunning(): Promise<string> {
  if (backendApiUrl && (await checkHealth(backendApiUrl))) {
    backendReady = true;
    return backendApiUrl;
  }

  const port = await findFreePort();
  backendApiUrl = `http://127.0.0.1:${port}`;
  const dbPath = getDatabasePath();
  const { command, args, cwd } = resolveBackendCommand();

  const fullArgs = [
    ...args,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--db-path",
    dbPath,
  ];

  backendProcess = spawn(command, fullArgs, {
    cwd,
    windowsHide: true,
    stdio: isDev ? "inherit" : "ignore",
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  });

  backendProcess.on("error", (err) => {
    console.error("[NeuroPulse] Failed to spawn backend process:", err);
  });

  backendProcess.on("exit", (code) => {
    backendProcess = null;
    if (code !== 0 && code !== null) {
      console.error(`[NeuroPulse] Backend exited unexpectedly with code ${code}`);
    }
  });

  backendReady = await waitForBackend(backendApiUrl, 15000);
  return backendApiUrl;
}

function stopBackend(): void {
  if (!backendProcess || backendProcess.killed) {
    return;
  }
  const pid = backendProcess.pid;
  if (process.platform === "win32" && pid) {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    backendProcess.kill("SIGTERM");
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill("SIGKILL");
      }
    }, 1500);
  }
  backendProcess = null;
}

function createMainWindow(): void {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#070B14",
    title: "NeuroPulse · 灵动反应训练",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--neuropulse-api=${backendApiUrl}`,
        `--neuropulse-version=${app.getVersion()}`,
      ],
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.NEUROPULSE_USE_DIST !== "1") {
    mainWindow.loadURL(devRendererUrl);
  } else {
    const indexHtml = path.join(__dirname, "..", "frontend", "dist", "index.html");
    mainWindow.loadFile(indexHtml);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    ipcMain.handle("backend:status", async () => {
      const ok = backendApiUrl ? await checkHealth(backendApiUrl) : false;
      backendReady = ok;
      return { apiBaseUrl: backendApiUrl, ready: ok };
    });

    ipcMain.handle("app:open-data-folder", async () => {
      const dataDir = path.dirname(getDatabasePath());
      await shell.openPath(dataDir);
    });

    await ensureBackendRunning();
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      stopBackend();
      app.quit();
    }
  });

  app.on("before-quit", () => {
    stopBackend();
  });
}
