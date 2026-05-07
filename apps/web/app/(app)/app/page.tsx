import { auth } from "../../../auth";
import { redirect } from "next/navigation";

import { AppGithubScopeHome } from "../../components/app/GithubScope/AppGithubScopeBar";
import styles from "./AppIndex.module.css";

/**
 * /app entry point — GitHub account and repository scope live in the main area.
 */
export default async function AppIndexPage() {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <>
      <AppGithubScopeHome
        githubLogin={session.githubLogin ?? ""}
        githubOrgs={session.githubOrgs ?? []}
      />
      <div className={styles.empty}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.body}>
          Use the Account and Repository selectors above to open a repository.
          If you have access to only one account, it is selected for you
          automatically.
        </p>
      </div>
    </>
  );
}
