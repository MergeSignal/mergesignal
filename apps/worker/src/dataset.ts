import type { PackageHealthObservation } from "@reposentinel/shared";
import { randomUUID } from "crypto";
import type { Pool } from "pg";

function clampInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

export async function persistPackageHealthDataset(
  db: Pool,
  opts: {
    repoId: string;
    scanId?: string;
    observations: PackageHealthObservation[];
  },
) {
  const max = clampInt(process.env.REPOSENTINEL_DATASET_MAX_OBSERVATIONS, 50);
  const items = (opts.observations ?? []).slice(0, max);
  if (items.length === 0) return;

  for (const o of items) {
    const fetchedAt = o.fetchedAt ? new Date(o.fetchedAt).toISOString() : new Date().toISOString();
    const fetchedDay = fetchedAt.slice(0, 10);

    await db.query(
      [
        "INSERT INTO package_health (name, registry, latest_version, latest_published_at, modified_at, deprecated, maintainers_count, repository_url, last_fetched_at, raw)",
        "VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7,$8,$9::timestamptz,$10::jsonb)",
        "ON CONFLICT (name) DO UPDATE SET",
        "  registry=EXCLUDED.registry,",
        "  latest_version=EXCLUDED.latest_version,",
        "  latest_published_at=EXCLUDED.latest_published_at,",
        "  modified_at=EXCLUDED.modified_at,",
        "  deprecated=EXCLUDED.deprecated,",
        "  maintainers_count=EXCLUDED.maintainers_count,",
        "  repository_url=EXCLUDED.repository_url,",
        "  last_fetched_at=EXCLUDED.last_fetched_at,",
        "  raw=EXCLUDED.raw",
      ].join("\n"),
      [
        o.name,
        o.registry,
        o.latestVersion,
        o.latestPublishedAt,
        o.modifiedAt,
        Boolean(o.deprecated),
        o.maintainersCount,
        o.repositoryUrl,
        fetchedAt,
        JSON.stringify(o),
      ],
    );

    await db.query(
      [
        "INSERT INTO package_health_snapshots (id, name, registry, fetched_at, fetched_day, source_repo_id, source_scan_id, latest_version, latest_published_at, modified_at, deprecated, maintainers_count, repository_url, raw)",
        "VALUES ($1,$2,$3,$4::timestamptz,$5::date,$6,$7::uuid,$8,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14::jsonb)",
        "ON CONFLICT (name, fetched_day) DO NOTHING",
      ].join("\n"),
      [
        randomUUID(),
        o.name,
        o.registry,
        fetchedAt,
        fetchedDay,
        opts.repoId,
        opts.scanId ?? null,
        o.latestVersion,
        o.latestPublishedAt,
        o.modifiedAt,
        Boolean(o.deprecated),
        o.maintainersCount,
        o.repositoryUrl,
        JSON.stringify(o),
      ],
    );
  }
}

