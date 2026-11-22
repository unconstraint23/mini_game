import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const isWin = process.platform === "win32";

const BACKEND_PORT = 18765;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const VITE_URL = "http://127.0.0.1:5173";

const children = [];

function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function cleanup() {
  for (const child of children) {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

async function main() {
  console.log("[dev] Compiling Electron TypeScript...");
  await new Promise((resolve, reject) => {
    const tsc = spawn(isWin ? "pnpm.cmd" : "pnpm", ["run", "build:electron"], {
      cwd: rootDir,
      stdio: "inherit",
    });
    tsc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tsc exited ${code}`))));
  });

  const venvPython = isWin
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python");
  const pythonBin = fs.existsSync(venvPython) ? venvPython : isWin ? "python" : "python3";

  console.log(`[dev] Starting Python backend on ${BACKEND_URL}...`);
  const py = spawn(
    pythonBin,
    [path.join(backendDir, "main.py"), "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    { cwd: backendDir, stdio: "inherit" }
  );
  children.push(py);

  console.log(`[dev] Starting Vite frontend on ${VITE_URL}...`);
  const vite = spawn(isWin ? "pnpm.cmd" : "pnpm", ["--dir", "frontend", "dev"], {
    cwd: rootDir,
    stdio: "inherit",
  });
  children.push(vite);

  await Promise.all([waitForHttp(`${BACKEND_URL}/health`), waitForHttp(VITE_URL)]);
  console.log("[dev] Backend & Frontend ready — launching Electron desktop app...");

  const electronBin = path.join(
    rootDir,
    "node_modules",
    ".bin",
    isWin ? "electron.cmd" : "electron"
  );
  const el = spawn(electronBin, ["."], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: VITE_URL,
      NEUROPULSE_API_URL: BACKEND_URL,
    },
  });
  children.push(el);

  el.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[dev] Startup failed:", err);
  cleanup();
  process.exit(1);
});
