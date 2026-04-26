"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./HomeClient.module.css";
import { Card, cardStyles } from "./ui/Card";
import { Button, ButtonLink, Row, TextInput } from "./ui/Form";
export function HomeClient({
  linkedOwner,
}: {
  /** Default org field when this deployment is scoped to one GitHub owner. */
  linkedOwner?: string;
}) {
  const router = useRouter();
  const [owner, setOwner] = useState(linkedOwner ?? "demo");
  const [scanId, setScanId] = useState("");
  const [repoId, setRepoId] = useState(
    linkedOwner ? `${linkedOwner}/repo` : "demo/repo",
  );

  const ownerPath = useMemo(
    () => `/org/${encodeURIComponent(owner.trim() || "demo")}`,
    [owner],
  );
  const scanPath = useMemo(
    () => `/scan/${encodeURIComponent(scanId.trim())}`,
    [scanId],
  );

  return (
    <div className={styles.grid}>
      <Card
        title="Organization dashboard"
        subtitle="Type an owner (prefix of repoId, e.g. acme)."
      >
        <Row>
          <TextInput
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="acme"
          />
          <Button onClick={() => router.push(ownerPath)}>Open</Button>
        </Row>
      </Card>

      <Card
        title="Scan results"
        subtitle="Paste a scan id to open its live page."
      >
        <Row>
          <TextInput
            value={scanId}
            onChange={(e) => setScanId(e.target.value)}
            placeholder="b803812d-d035-4c27-99ee-b77c49a865f2"
          />
          <Button
            onClick={() => router.push(scanPath)}
            disabled={!scanId.trim()}
          >
            Open
          </Button>
        </Row>
      </Card>

      <Card
        title="Repo percentile"
        subtitle="Uses latest scored scan for the repo."
      >
        <Row>
          <TextInput
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            placeholder="acme/repo-a"
          />
          <ButtonLink
            variant="secondary"
            href={`/api/benchmark/repo?repoId=${encodeURIComponent(repoId.trim())}`}
            target="_blank"
            rel="noreferrer"
          >
            View JSON
          </ButtonLink>
        </Row>
        <div className={cardStyles.note}>
          Tip: use <code>owner/repo</code>.
        </div>
      </Card>
    </div>
  );
}
