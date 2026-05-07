import { SiteChrome } from "../components/shared/layout/SiteChrome/SiteChrome";
import { OrgSelector } from "../components/app/OrgSelector/OrgSelector";
import { auth } from "../../auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const orgSelector = session?.githubLogin ? (
    <OrgSelector
      githubLogin={session.githubLogin}
      githubOrgs={session.githubOrgs ?? []}
    />
  ) : null;

  return (
    <SiteChrome
      title="MergeSignal"
      hideTitlebar
      orgSelector={orgSelector}
      footerVariant="full"
    >
      {children}
    </SiteChrome>
  );
}
