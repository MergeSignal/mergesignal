import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_STDOUT_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_STDERR_BYTES = 256 * 1024;

const BLOCKED_ENV = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
  "GIT_EXTERNAL_DIFF",
  "GIT_PAGER",
  "GIT_EDITOR",
  "GIT_ASKPASS",
] as const;

export type GitCommandResult =
  | { ok: false; reason: "git_unavailable" | "git_failed" }
  | {
      ok: true;
      exitCode: number | null;
      stdout: Buffer;
      stderr: Buffer;
      stdoutTruncated: boolean;
      stderrTruncated: boolean;
      timedOut: boolean;
    };

type RunGitInput = {
  cwd: string;
  args: readonly string[];
  gitBinary?: string;
  timeoutMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

/** Run one read-only git argv. Never uses a shell. */
export function runGit(input: RunGitInput): Promise<GitCommandResult> {
  const binary = input.gitBinary ?? "git";
  const args = [
    "--no-pager",
    "-c",
    "protocol.allow=never",
    "-c",
    "core.fsmonitor=",
    ...input.args,
  ];
  const maxStdout = input.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES;
  const maxStderr = input.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES;

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: GitCommandResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(binary, args, {
        cwd: input.cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: gitEnv(),
      });
    } catch (error) {
      finish(spawnFailure(error));
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;

    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.on("error", (error) => {
      finish(spawnFailure(error));
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      const next = take(stdout, stdoutBytes, maxStdout, chunk);
      stdoutBytes = next.total;
      if (next.truncated) {
        stdoutTruncated = true;
        child.kill("SIGKILL");
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const next = take(stderr, stderrBytes, maxStderr, chunk);
      stderrBytes = next.total;
      if (next.truncated) {
        stderrTruncated = true;
        child.kill("SIGKILL");
      }
    });

    child.on("close", (exitCode) => {
      finish({
        ok: true,
        exitCode,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        stdoutTruncated,
        stderrTruncated,
        timedOut,
      });
    });
  });
}

function gitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of BLOCKED_ENV) delete env[key];
  env.GIT_OPTIONAL_LOCKS = "0";
  env.GIT_TERMINAL_PROMPT = "0";
  return env;
}

function spawnFailure(error: unknown): GitCommandResult {
  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  if (code === "ENOENT" || code === "EACCES") {
    return { ok: false, reason: "git_unavailable" };
  }
  return { ok: false, reason: "git_failed" };
}

function take(
  chunks: Buffer[],
  total: number,
  max: number,
  chunk: Buffer,
): { total: number; truncated: boolean } {
  const room = max - total;
  if (room <= 0) return { total, truncated: true };
  if (chunk.length <= room) {
    chunks.push(chunk);
    return { total: total + chunk.length, truncated: false };
  }
  chunks.push(chunk.subarray(0, room));
  return { total: max, truncated: true };
}

export function isNotAGitRepository(stderr: Buffer): boolean {
  return stderr.toString("utf8").toLowerCase().includes("not a git repository");
}

export function decodeUtf8(bytes: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function parseCommitSha(stdout: Buffer): string | null {
  const text = decodeUtf8(stdout);
  if (text === null) return null;
  const sha = text.trim();
  if (!/^[0-9a-f]{40}$/i.test(sha) && !/^[0-9a-f]{64}$/i.test(sha)) {
    return null;
  }
  return sha.toLowerCase();
}
