const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function runCodesign(args) {
  const res = spawnSync("codesign", args, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`codesign ${args.join(" ")} failed with code ${res.status}`);
  }
}

function collectBackendBinaries(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      collectBackendBinaries(full, results);
    } else if (
      entry.name.endsWith(".dylib") ||
      entry.name.endsWith(".so") ||
      entry.name === "Python" ||
      entry.name === "neuropulse-backend"
    ) {
      results.push(full);
    }
  }
  return results;
}

/**
 * electron-builder afterPack hook:
 * Ensures community/unsigned macOS arm64 builds receive a valid, strict, deep
 * ad-hoc signature (`--sign -`) instead of leaving Electron's broken linker-signed
 * stub ("code has no resources but signature indicates they must be present").
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    console.log("[afterPack] Developer ID signing configured, skipping ad-hoc signing.");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] Cleaning xattrs and applying strict ad-hoc signature to ${appPath}...`);

  // Strip Finder detritus/xattrs that can cause codesign to fail
  spawnSync("xattr", ["-cr", appPath], { stdio: "ignore" });

  // 1. Sign embedded Python sidecar binaries inside-out
  const backendDir = path.join(appPath, "Contents", "Resources", "backend");
  const backendBins = collectBackendBinaries(backendDir);
  for (const bin of backendBins) {
    runCodesign(["--force", "--sign", "-", bin]);
  }

  // 2. Sign nested frameworks & helper apps
  const frameworksDir = path.join(appPath, "Contents", "Frameworks");
  if (fs.existsSync(frameworksDir)) {
    for (const entry of fs.readdirSync(frameworksDir)) {
      if (entry.endsWith(".framework") || entry.endsWith(".app")) {
        runCodesign(["--force", "--deep", "--sign", "-", path.join(frameworksDir, entry)]);
      }
    }
  }

  // 3. Sign main app bundle & strictly verify integrity
  runCodesign(["--force", "--deep", "--sign", "-", appPath]);
  runCodesign(["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  console.log("[afterPack] Strict macOS ad-hoc signature verified OK!");
};
