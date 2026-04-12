import { describe, it, expect } from "vitest";

describe("CLI Argument Parsing", () => {
  type ParsedArgs = {
    _: string[];
    "--help"?: true;
    "--json"?: true;
    "--out"?: string;
    "--repo-id"?: string;
    "--lockfile"?: string;
    "--fail-above"?: string;
  };

  function parseArgs(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { _: [] };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]!;
      if (a === "--") continue;
      if (!a.startsWith("--")) {
        out._.push(a);
        continue;
      }

      if (a === "--help") {
        out["--help"] = true;
        continue;
      }
      if (a === "--json") {
        out["--json"] = true;
        continue;
      }

      const takesValue = a === "--out" || a === "--repo-id" || a === "--lockfile" || a === "--fail-above";
      if (takesValue) {
        const v = argv[i + 1];
        if (!v || v.startsWith("--")) throw new Error(`${a} expects a value`);
        out[a as "--out" | "--repo-id" | "--lockfile" | "--fail-above"] = v;
        i++;
        continue;
      }

      throw new Error(`Unknown flag: ${a}`);
    }
    return out;
  }

  it("should parse scan command", () => {
    const result = parseArgs(["scan"]);
    expect(result._).toEqual(["scan"]);
  });

  it("should parse --help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result["--help"]).toBe(true);
  });

  it("should parse --json flag", () => {
    const result = parseArgs(["scan", "--json"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--json"]).toBe(true);
  });

  it("should parse --out flag with value", () => {
    const result = parseArgs(["scan", "--out", "output.json"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--out"]).toBe("output.json");
  });

  it("should parse --repo-id flag with value", () => {
    const result = parseArgs(["scan", "--repo-id", "org/repo"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--repo-id"]).toBe("org/repo");
  });

  it("should parse --lockfile flag with value", () => {
    const result = parseArgs(["scan", "--lockfile", "pnpm-lock.yaml"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--lockfile"]).toBe("pnpm-lock.yaml");
  });

  it("should parse --fail-above flag with value", () => {
    const result = parseArgs(["scan", "--fail-above", "50"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--fail-above"]).toBe("50");
  });

  it("should parse multiple flags", () => {
    const result = parseArgs(["scan", "--json", "--out", "result.json", "--repo-id", "test/repo"]);
    expect(result._).toEqual(["scan"]);
    expect(result["--json"]).toBe(true);
    expect(result["--out"]).toBe("result.json");
    expect(result["--repo-id"]).toBe("test/repo");
  });

  it("should throw on unknown flag", () => {
    expect(() => parseArgs(["scan", "--unknown"])).toThrow("Unknown flag: --unknown");
  });

  it("should throw when flag expects value but none provided", () => {
    expect(() => parseArgs(["scan", "--out"])).toThrow("--out expects a value");
  });

  it("should throw when flag expects value but gets another flag", () => {
    expect(() => parseArgs(["scan", "--out", "--json"])).toThrow("--out expects a value");
  });
});

describe("inferManagerFromFilename", () => {
  function inferManagerFromFilename(p: string): "pnpm" | "npm" | "yarn" | null {
    const base = p.split("/").pop()?.toLowerCase() ?? "";
    if (base === "pnpm-lock.yaml") return "pnpm";
    if (base === "package-lock.json") return "npm";
    if (base === "yarn.lock") return "yarn";
    return null;
  }

  it("should detect pnpm lockfile", () => {
    expect(inferManagerFromFilename("pnpm-lock.yaml")).toBe("pnpm");
    expect(inferManagerFromFilename("/some/path/pnpm-lock.yaml")).toBe("pnpm");
  });

  it("should detect npm lockfile", () => {
    expect(inferManagerFromFilename("package-lock.json")).toBe("npm");
    expect(inferManagerFromFilename("/some/path/package-lock.json")).toBe("npm");
  });

  it("should detect yarn lockfile", () => {
    expect(inferManagerFromFilename("yarn.lock")).toBe("yarn");
    expect(inferManagerFromFilename("/some/path/yarn.lock")).toBe("yarn");
  });

  it("should return null for unknown files", () => {
    expect(inferManagerFromFilename("package.json")).toBe(null);
    expect(inferManagerFromFilename("unknown.yaml")).toBe(null);
  });
});
