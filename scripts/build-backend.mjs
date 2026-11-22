import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const outputDir = path.join(rootDir, "build-resources", "backend");
const stageDistDir = path.join(backendDir, "dist");
const cacheDir = path.join(backendDir, "build", ".pyinstaller-cache");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const pyinstallerBin = isWin
  ? path.join(backendDir, ".venv", "Scripts", "pyinstaller.exe")
  : path.join(backendDir, ".venv", "bin", "pyinstaller");

const cmd = fs.existsSync(pyinstallerBin) ? pyinstallerBin : "pyinstaller";

console.log(
  `[build-backend] Building standalone Python sidecar (${isMac ? "onefile" : "onedir"}) via ${cmd}...`
);
fs.rmSync(outputDir, { recursive: true, force: true });
fs.rmSync(stageDistDir, { recursive: true, force: true });
fs.mkdirSync(cacheDir, { recursive: true });

const res = spawnSync(
  cmd,
  [
    "--clean",
    "--noconfirm",
    "--distpath",
    stageDistDir,
    "--workpath",
    path.join(backendDir, "build"),
    path.join(backendDir, "neuropulse_backend.spec"),
  ],
  {
    cwd: backendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PYINSTALLER_CONFIG_DIR: cacheDir,
    },
  }
);

if (res.status !== 0) {
  console.error(`[build-backend] PyInstaller failed with exit code ${res.status}`);
  process.exit(res.status ?? 1);
}

fs.mkdirSync(outputDir, { recursive: true });
const binName = isWin ? "neuropulse-backend.exe" : "neuropulse-backend";

if (isMac) {
  const onefileBin = path.join(stageDistDir, binName);
  if (!fs.existsSync(onefileBin)) {
    console.error(`[build-backend] Expected onefile binary not found: ${onefileBin}`);
    process.exit(1);
  }
  const dest = path.join(outputDir, binName);
  fs.copyFileSync(onefileBin, dest);
  fs.chmodSync(dest, 0o755);
  const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log(`[build-backend] Ready at ${dest} (${sizeMb} MB)`);
} else {
  const builtBundleDir = path.join(stageDistDir, "neuropulse-backend");
  if (!fs.existsSync(builtBundleDir)) {
    console.error(`[build-backend] Expected bundle dir not found: ${builtBundleDir}`);
    process.exit(1);
  }
  fs.cpSync(builtBundleDir, outputDir, { recursive: true });
  const builtFile = path.join(outputDir, binName);
  if (!fs.existsSync(builtFile)) {
    console.error(`[build-backend] Expected binary not found: ${builtFile}`);
    process.exit(1);
  }
  console.log(`[build-backend] Ready at ${builtFile}`);
}
