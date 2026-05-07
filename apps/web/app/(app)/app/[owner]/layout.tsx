import { auth } from "../../../../auth";
import { requireGithubAppOwnerAccess } from "../../../../lib/github-app-guard";
import { GithubAppOwnerShell } from "../../../components/app/GithubScope/GithubAppOwnerShell";

export default async function OwnerLayout({
  params,
  children,
}: {
  params: Promise<{ owner: string }>;
  children: React.ReactNode;
}) {
  const { owner } = await params;
  await requireGithubAppOwnerAccess(owner);
  const session = await auth();

  return (
    <GithubAppOwnerShell
      owner={owner}
      githubLogin={session?.githubLogin ?? ""}
      githubOrgs={session?.githubOrgs ?? []}
    >
      {children}
    </GithubAppOwnerShell>
  );
}
