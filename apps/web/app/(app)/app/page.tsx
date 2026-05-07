import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import styles from "./AppIndex.module.css";

/**
 * /app entry point.
 * For now renders a "select a repo" state.
 * The org selector in the header drives navigation to /app/:owner/:repo.
 */
export default async function AppIndexPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className={styles.empty}>
      <h1 className={styles.title}>Select a repository</h1>
      <p className={styles.body}>
        Use the selector in the header to choose an organization or your
        personal account, then select a repository from the sidebar.
      </p>
    </div>
  );
}
