import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      if (!entry.name.endsWith(".test.ts")) out.push(full);
    }
  }
  return out;
}

describe("auth v4 URL regression", () => {
  it("forbids legacy callback query on signin URLs", () => {
    const webRoot = join(__dirname, "..", "..");
    const offenders = [];
    for (const file of walk(webRoot)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("signin/") && text.includes("?callbackUrl")) {
        if (file.includes("UserNav") || file.includes("AppGithubScopeBar"))
          continue;
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
