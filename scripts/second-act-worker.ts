import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { columnLetter, findReadyJob, requireWorkerFields, rowFromValues } from "../packages/orchestration/src/second-act-worker.js";
import { googleFetch } from "./second-act-google.js";

const execFileAsync = promisify(execFile);
const SHEET_ID = process.env.SECOND_ACT_SHEET_ID?.trim() || "1WN099M7PEnJlS5D_mOfLJ27NnaG93pgNhrqOXjRKFZw";
const TAB = process.env.SECOND_ACT_SHEET_TAB?.trim() || "CONTENT_QUEUE";
const POLL_MS = Math.max(30_000, Number(process.env.SECOND_ACT_WORKER_POLL_MS ?? "60000"));

const fileExists = async (path: string): Promise<boolean> =>
  import("node:fs/promises").then(({ access }) => access(path).then(() => true).catch(() => false));

const loadEnv = async (): Promise<void> => {
  if (await fileExists(resolve(".env"))) process.loadEnvFile(resolve(".env"));
};

const sheetValues = async (): Promise<string[][]> => {
  const range = encodeURIComponent(`${TAB}!A1:Z1000`);
  const response = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`);
  const body = await response.json() as { values?: string[][] };
  return body.values ?? [];
};

const writeCell = async (headers: string[], rowNumber: number, header: string, value: string): Promise<void> => {
  const index = headers.indexOf(header);
  if (index < 0) return;
  const range = encodeURIComponent(`${TAB}!${columnLetter(index)}${rowNumber}`);
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ values: [[value]] })
  });
};
const ensureDriveFolder = async (): Promise<string> => {
  const configured = process.env.SECOND_ACT_DRIVE_FOLDER_ID?.trim();
  if (configured) return configured;
  const name = process.env.SECOND_ACT_DRIVE_FOLDER_NAME?.trim() || "Second Act Stories Renders";
  const response = await googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" })
  });
  const folder = await response.json() as { id: string };
  return folder.id;
};

const uploadFile = async (path: string, parentId: string): Promise<{ id: string; webViewLink?: string }> => {
  const bytes = await readFile(path);
  const boundary = `second-act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({ name: basename(path), parents: [parentId] });
  const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--`);
  const response = await googleFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([prefix, bytes, suffix])
  });
  return response.json() as Promise<{ id: string; webViewLink?: string }>;
};

const renderJob = async (topic: string): Promise<string> => {
  const pnpmScript = process.env.npm_execpath?.trim();
  if (!pnpmScript) throw new Error("npm_execpath is unavailable; start the worker through pnpm");
  const { stdout } = await execFileAsync(process.execPath, [
    pnpmScript,
    "second-act:pilot", "--", "--topic", topic,
    "--minutes", process.env.SECOND_ACT_WORKER_MINUTES?.trim() || "4",
    "--license-mode", process.env.SECOND_ACT_LICENSE_MODE?.trim() || "safe"
  ], { maxBuffer: 30 * 1024 * 1024 });
  const lines = stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const path = lines.at(-1);
  if (!path || !path.toLowerCase().endsWith(".mp4")) throw new Error(`Render did not return an MP4 path. Last output: ${path ?? "<none>"}`);
  return resolve(path);
};
const uploadArtifacts = async (mp4Path: string, parentId: string): Promise<{ videoUrl: string }> => {
  const runDir = dirname(mp4Path);
  const names = await readdir(runDir);
  const artifactNames = names.filter((name) => name.endsWith(".json") || name.endsWith(".mp4"));
  let videoUrl = "";
  for (const name of artifactNames) {
    const uploaded = await uploadFile(resolve(runDir, name), parentId);
    if (resolve(runDir, name) === mp4Path) videoUrl = uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`;
  }
  if (!videoUrl) throw new Error("Final MP4 upload did not return a Drive URL");
  return { videoUrl };
};

const runOnce = async (): Promise<boolean> => {
  const values = await sheetValues();
  if (values.length === 0) throw new Error(`${TAB} is empty`);
  const headers = values[0];
  const rows = values.slice(1).map((row, index) => rowFromValues(headers, row, index + 2));
  const job = findReadyJob(rows);
  if (!job) return false;
  const { id, topic, rowNumber } = requireWorkerFields(job);
  const now = () => new Date().toISOString();
  await writeCell(headers, rowNumber, "Status", "RENDERING");
  await writeCell(headers, rowNumber, "Last Updated", now());
  try {
    const mp4Path = await renderJob(topic);
    await writeCell(headers, rowNumber, "Video Path", mp4Path);
    await writeCell(headers, rowNumber, "Status", "UPLOADING");
    const folderId = await ensureDriveFolder();
    const { videoUrl } = await uploadArtifacts(mp4Path, folderId);
    await writeCell(headers, rowNumber, "Published URL", videoUrl);
    await writeCell(headers, rowNumber, "Status", "DONE");
    await writeCell(headers, rowNumber, "Last Updated", now());
    console.log(`[${id}] DONE ${videoUrl}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeCell(headers, rowNumber, "Revision Notes", `Worker failure ${now()}: ${message}`);
    await writeCell(headers, rowNumber, "Status", "RENDER_FAILED");
    await writeCell(headers, rowNumber, "Last Updated", now());
    throw error;
  }
};
await loadEnv();
const once = process.argv.includes("--once");

if (once) {
  const worked = await runOnce();
  if (!worked) console.log("No READY_TO_RENDER jobs.");
} else {
  console.log(`Second Act worker polling ${TAB} every ${Math.round(POLL_MS / 1000)}s`);
  for (;;) {
    try {
      const worked = await runOnce();
      if (!worked) await new Promise((resolveSleep) => setTimeout(resolveSleep, POLL_MS));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      await new Promise((resolveSleep) => setTimeout(resolveSleep, POLL_MS));
    }
  }
}
