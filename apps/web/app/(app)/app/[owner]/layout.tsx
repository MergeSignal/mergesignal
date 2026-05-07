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

  return (
    <div className={styles.shell}>
      <RepoSidebar owner={owner} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
