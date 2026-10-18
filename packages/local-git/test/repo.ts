import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const dirs: string[] = [];

export async function createRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ms-local-git-"));
  dirs.push(dir);
  await runGit(dir, ["init", "-q", "-b", "main"]);
  return dir;
}

export async function track(dir: string): Promise<void> {
  dirs.push(dir);
}

export async function removeRepos(): Promise<void> {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
}

export async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    [
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd },
  );
  return stdout.toString("utf8");
}

export async function writeAndCommit(
  cwd: string,
  files: Record<string, string>,
  message: string,
): Promise<string> {
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(cwd, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, contents);
    await runGit(cwd, ["add", "--", name]);
  }
  await runGit(cwd, ["commit", "-q", "-m", message]);
  return (await runGit(cwd, ["rev-parse", "HEAD"])).trim();
}

export function npmLock(
  packages: Record<string, string>,
  pretty = false,
): string {
  const body = {
    lockfileVersion: 3,
    packages: {
      "": { name: "app" },
      ...Object.fromEntries(
        Object.entries(packages).map(([name, version]) => [
          `node_modules/${name}`,
          { version },
        ]),
      ),
    },
  };
  return pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
}
