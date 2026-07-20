/** Root importer TypeScript patch with multi-peer knip suffix churn only. */

export const PEER_CONTEXT_CHURN_MANIFESTS = ["package.json"] as const;

export const peerContextChurnBaseLockfile = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@emnapi/core@1.10.0)(@emnapi/runtime@1.7.1)(@types/node@22.15.3)(typescript@5.9.2)
      typescript:
        specifier: 5.9.2
        version: 5.9.2
packages:
  knip@5.88.1:
    resolution: {integrity: sha512-knip}
    peerDependencies:
      typescript: '*'
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
snapshots:
  knip@5.88.1:
    dependencies:
      typescript: 5.9.2(@emnapi/core@1.10.0)(@emnapi/runtime@1.7.1)(@types/node@22.15.3)
`;

export const peerContextChurnHeadLockfile = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@emnapi/core@1.10.0)(@emnapi/runtime@1.7.1)(@types/node@22.15.3)(typescript@5.9.3)
      typescript:
        specifier: 5.9.3
        version: 5.9.3
packages:
  knip@5.88.1:
    resolution: {integrity: sha512-knip}
    peerDependencies:
      typescript: '*'
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
snapshots:
  knip@5.88.1:
    dependencies:
      typescript: 5.9.3(@emnapi/core@1.10.0)(@emnapi/runtime@1.7.1)(@types/node@22.15.3)
`;
