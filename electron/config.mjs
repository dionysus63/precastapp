import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";

const APP_NAME = "Precast Ops";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()) {
      return { serverUrl: parsed.serverUrl.trim() };
    }
  } catch {
    // fall through
  }
  return null;
}

export function getUserConfigPath() {
  return path.join(app.getPath("appData"), APP_NAME, "config.json");
}

export function loadConfig() {
  const fromEnv = process.env.PRECAST_SERVER_URL?.trim();
  if (fromEnv) {
    return { serverUrl: fromEnv };
  }

  const userConfig = readJsonFile(getUserConfigPath());
  if (userConfig) {
    return userConfig;
  }

  const bundledPath = path.join(process.resourcesPath, "config.default.json");
  const bundled = readJsonFile(bundledPath);
  if (bundled) {
    return bundled;
  }

  const devDefault = readJsonFile(path.join(__dirname, "config.default.json"));
  if (devDefault) {
    return devDefault;
  }

  throw new Error(
    "No server URL configured. Set PRECAST_SERVER_URL or create %APPDATA%\\Precast Ops\\config.json",
  );
}

export function validateServerUrl(serverUrl) {
  let url;
  try {
    url = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid server URL: ${serverUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Server URL must use http:// or https://: ${serverUrl}`);
  }

  if (!url.host) {
    throw new Error(`Server URL must include hostname and port: ${serverUrl}`);
  }

  return url;
}
