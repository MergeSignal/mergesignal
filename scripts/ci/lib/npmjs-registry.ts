/** Public npmjs registry URL for CI package-governance checks. */
export const NPMJS_REGISTRY = "https://registry.npmjs.org/";

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
