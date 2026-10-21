import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const POINTER_DIR = "mergesignal";
const POINTER_FILE = "last-scan.json";
const SCAN_ID = /^[A-Za-z0-9_-]{1,128}$/;
const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

type LastScanPointer = {
  scanId: string;
  head: string;
};

export async function writeLastScanPointer(
  gitDir: string,
  pointer: LastScanPointer,
): Promise<void> {
  const body = JSON.stringify({
    v: 1,
    scanId: pointer.scanId,
    head: pointer.head,
  });
  if (parseLastScanPointer(body) === null) {
    throw new Error("invalid scan pointer");
  }
  const directory = path.join(gitDir, POINTER_DIR);
  await mkdir(directory, { recursive: true });
  const finalPath = path.join(directory, POINTER_FILE);
  const temporary = path.join(
    directory,
    `.${POINTER_FILE}.${randomBytes(8).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temporary, `${body}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, finalPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function readLastScanPointer(
  gitDir: string,
): Promise<LastScanPointer | "missing" | "malformed"> {
  let text: string;
  try {
    text = await readFile(path.join(gitDir, POINTER_DIR, POINTER_FILE), "utf8");
  } catch (error) {
    const code =
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "";
    if (code === "ENOENT") return "missing";
    return "malformed";
  }
  const pointer = parseLastScanPointer(text);
  return pointer ?? "malformed";
}

export function parseLastScanPointer(text: string): LastScanPointer | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (typeof record.scanId !== "string" || !SCAN_ID.test(record.scanId)) {
    return null;
  }
  if (typeof record.head !== "string" || !COMMIT.test(record.head)) return null;
  return {
    scanId: record.scanId,
    head: record.head,
  };
}
