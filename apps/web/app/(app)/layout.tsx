import { SiteChrome } from "../components/shared/layout/SiteChrome/SiteChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteChrome title="MergeSignal" hideTitlebar footerVariant="full">
      {children}
    </SiteChrome>
  );
}
