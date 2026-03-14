import { db } from "../db";

export async function upsertGithubRepoSource(opts: {
  repoId: string;
  owner: string;
  repo: string;
  installationId: number;
  lockfilePath: string;
  lockfileManager: string;
  defaultBranch?: string;
}) {
  const {
    repoId,
    owner,
    repo,
    installationId,
    lockfilePath,
    lockfileManager,
    defaultBranch,
  } = opts;

  await db.query(
    `
    INSERT INTO repo_sources
      (repo_id, provider, owner, repo, installation_id, lockfile_path, lockfile_manager, default_branch, updated_at)
    VALUES
      ($1, 'github', $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (repo_id) DO UPDATE SET
      owner = EXCLUDED.owner,
      repo = EXCLUDED.repo,
      installation_id = EXCLUDED.installation_id,
      lockfile_path = EXCLUDED.lockfile_path,
      lockfile_manager = EXCLUDED.lockfile_manager,
      default_branch = COALESCE(EXCLUDED.default_branch, repo_sources.default_branch),
      updated_at = NOW()
    `,
    [repoId, owner, repo, installationId, lockfilePath, lockfileManager, defaultBranch ?? null],
  );
}

