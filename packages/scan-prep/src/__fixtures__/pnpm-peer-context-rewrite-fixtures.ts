/** Workspace TypeScript patch with pnpm peer-instantiation churn on unchanged packages. */

export const WORKSPACE_PEER_CONTEXT_REWRITE_MANIFESTS = [
  "package.json",
  "apps/web/package.json",
  "packages/eslint-config/package.json",
  "packages/shared/package.json",
] as const;

export const peerContextRewriteBaseLockfile = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@types/node@22.15.3)(typescript@5.9.2)
      typescript:
        specifier: 5.9.2
        version: 5.9.2
  apps/web:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
  packages/eslint-config:
    devDependencies:
      typescript:
        specifier: ^5.9.2
        version: 5.9.2
      typescript-eslint:
        specifier: ^8.50.0
        version: 8.50.0(eslint@9.39.1)(typescript@5.9.2)
  packages/shared:
    devDependencies:
      typescript:
        specifier: ^5.3.0
        version: 5.9.2
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
  knip@5.88.1:
    resolution: {integrity: sha512-knip}
  typescript-eslint@8.50.0:
    resolution: {integrity: sha512-tseslint}
`;

export const peerContextRewriteHeadLockfile = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@types/node@22.15.3)(typescript@5.9.3)
      typescript:
        specifier: 5.9.3
        version: 5.9.3
  apps/web:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
  packages/eslint-config:
    devDependencies:
      typescript:
        specifier: ^5.9.3
        version: 5.9.3
      typescript-eslint:
        specifier: ^8.50.0
        version: 8.50.0(eslint@9.39.1)(typescript@5.9.3)
  packages/shared:
    devDependencies:
      typescript:
        specifier: ^5.9.3
        version: 5.9.3
packages:
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
  knip@5.88.1:
    resolution: {integrity: sha512-knip}
  typescript-eslint@8.50.0:
    resolution: {integrity: sha512-tseslint}
`;
