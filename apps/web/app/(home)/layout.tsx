import { SiteChrome } from "../components/shared/layout/SiteChrome/SiteChrome";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteChrome title="MergeSignal" hideTitlebar mainWidth="wide">
      {children}
    </SiteChrome>
  );
}
