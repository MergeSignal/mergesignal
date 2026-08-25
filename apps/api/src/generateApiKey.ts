#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "crypto";
import minimist from "minimist";
import { queries } from "./db.js";

async function generateApiKey(owner: string, description?: string) {
  if (!owner || owner.trim() === "") {
    console.error("Error: owner is required");
    process.exit(1);
  }

  const apiKey = `ms_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const id = randomUUID();

  try {
    await queries.apiKeys.create({
      id,
      key_hash: keyHash,
      owner,
      description: description ?? null,
    });

    console.log("\n✅ API Key generated successfully!\n");
    console.log("Owner:", owner);
    console.log("Description:", description ?? "(none)");
    console.log("Key ID:", id);
    console.log("\n🔑 API Key (save this securely, it won't be shown again):");
    console.log(apiKey);
    console.log("\nUse this key in the Authorization header:");
    console.log(`Authorization: Bearer ${apiKey}`);
    console.log();
  } catch (err: unknown) {
    console.error(
      "Error generating API key:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

type ParsedCli =
  | { mode: "help" }
  | { mode: "usage"; exitCode: number }
  | { mode: "run"; owner: string; description?: string };

function parseGenerateApiKeyArgv(argv: string[]): ParsedCli {
  const args = minimist(argv, {
    string: ["owner", "description"],
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (args.help) {
    return { mode: "help" };
  }

  const positional = Array.isArray(args._) ? args._.map((x) => String(x)) : [];
  const owner =
    (typeof args.owner === "string" ? args.owner.trim() : "") ||
    (positional[0] ? positional[0].trim() : "");
  const description =
    (typeof args.description === "string" ? args.description.trim() : "") ||
    (positional.length > 1 ? positional.slice(1).join(" ").trim() : "") ||
    undefined;

  if (argv.length === 0) {
    return { mode: "usage", exitCode: 1 };
  }

  return { mode: "run", owner, description };
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm run generate-api-key -- <owner> [description]
  pnpm run generate-api-key -- --owner <owner> [--description <text>]

Examples:
  pnpm run generate-api-key -- acme "Production API key"
  pnpm run generate-api-key -- octocat
  pnpm run generate-api-key -- --owner acme --description "Staging key"

Arguments:
  owner         GitHub organization or user name
  description   Optional description for the API key
`);
}

const parsed = parseGenerateApiKeyArgv(process.argv.slice(2));

if (parsed.mode === "help") {
  printUsage();
  process.exit(0);
}

if (parsed.mode === "usage") {
  printUsage();
  process.exit(parsed.exitCode);
}

void generateApiKey(parsed.owner, parsed.description);
