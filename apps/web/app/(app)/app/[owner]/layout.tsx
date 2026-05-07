import { auth } from "../../../../auth";
import { RepoSidebar } from "../../../components/app/RepoSidebar/RepoSidebar";
import styles from "./OwnerLayout.module.css";

export default async function OwnerLayout({
  params,
  children,
}: {
  params: Promise<{ owner: string }>;
  children: React.ReactNode;
}) {
  const { owner } = await params;
  const session = await auth();

  return (
    <div className={styles.shell}>
      <RepoSidebar owner={owner} githubLogin={session?.githubLogin} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
