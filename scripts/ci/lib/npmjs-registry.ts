/** Public npmjs registry URL for CI package-governance checks. */
export const NPMJS_REGISTRY = "https://registry.npmjs.org/";

/** Encodes a package name for npm registry path segments (scoped `@a/b` → `@a%2Fb`). */
export function encodeNpmjsPackageNameForRegistryPath(
  packageName: string,
): string {
  if (packageName.startsWith("@")) {
    const slashIndex = packageName.indexOf("/");
    if (slashIndex <= 0) {
      throw new Error(`Invalid scoped npm package name: ${packageName}`);
    }
    return `${packageName.slice(0, slashIndex)}%2F${packageName.slice(slashIndex + 1)}`;
  }
  return encodeURIComponent(packageName);
}

export function buildNpmjsPackageVersionUrl(
  packageName: string,
  version: string,
  registry: string = NPMJS_REGISTRY,
): string {
  const base = registry.replace(/\/$/, "");
  return `${base}/${encodeNpmjsPackageNameForRegistryPath(packageName)}/${encodeURIComponent(version)}`;
}

export function cleanNpmEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^npm_config_/i.test(key)) {
      delete env[key];
    }
  }
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.NPM_CONFIG_USERCONFIG;
  delete env.NPM_CONFIG_PROVENANCE;
  return env;
}
