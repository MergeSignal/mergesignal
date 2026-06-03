import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithTheme, screen, userEvent } from "../../shared/testUtils";
import {
  buildRepoPullHealthViewModel,
  type PrScanQuotaStatus,
  type RepoPullHealthViewModel,
} from "../../../../lib/repo-health-view-model";
import type { GithubOpenPR } from "../../../../lib/github-open-pull-requests";
import { RepoHealthDashboard } from "./RepoHealthDashboard";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("./RepoHealthScanPoller", () => ({
  RepoHealthScanPoller: ({ active }: { active: boolean }) =>
    active ? <div data-testid="scan-poller" /> : null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function makePR(num: number): GithubOpenPR {
  return {
    number: num,
    title: `PR #${num}`,
    baseRef: "main",
    headSha: `sha${num}`,
    updatedAt: "2026-01-01T00:00:00Z",
    htmlUrl: `https://github.com/acme/repo/pull/${num}`,
  };
}

const emptyViewModel: RepoPullHealthViewModel = {
  rows: [],
  totalPRs: 0,
  coveredPRs: 0,
  byPosture: { risky: 0, needs_review: 0, safe: 0 },
  hasMore: false,
};

const exceededQuota: PrScanQuotaStatus = {
  source: "github",
  state: "exceeded",
  limit: 15,
  used: 15,
  windowHours: 24,
};

const okQuota: PrScanQuotaStatus = {
  source: "github",
  state: "ok",
  limit: 15,
  used: 5,
  windowHours: 24,
};

describe("RepoHealthDashboard quota banner", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

  const baseProps = {
    repoId: "acme/frontend",
    owner: "acme",
    repo: "frontend",
  };

  it("shows quota banner when quotaStatus is exceeded", () => {
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={emptyViewModel}
        quotaStatus={exceededQuota}
      />,
    );
    expect(screen.getByText("Daily scan limit reached")).toBeInTheDocument();
    expect(
      screen.getByText(
        /New pull requests are paused until the quota window resets/,
      ),
    ).toBeInTheDocument();
  });

  it("does not show quota banner when quotaStatus is ok", () => {
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={emptyViewModel}
        quotaStatus={okQuota}
      />,
    );
    expect(
      screen.queryByText("Daily scan limit reached"),
    ).not.toBeInTheDocument();
  });

  it("does not show quota banner when quotaStatus is missing", () => {
    renderWithTheme(
      <RepoHealthDashboard {...baseProps} viewModel={emptyViewModel} />,
    );
    expect(
      screen.queryByText("Daily scan limit reached"),
    ).not.toBeInTheDocument();
  });

  it("dismissing the banner removes it from view", async () => {
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={emptyViewModel}
        quotaStatus={exceededQuota}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss message" }),
    );
    expect(
      screen.queryByText("Daily scan limit reached"),
    ).not.toBeInTheDocument();
  });

  it("still renders PR cards when quota is exceeded", () => {
    const viewModel = buildRepoPullHealthViewModel(
      [makePR(42)],
      {
        repoId: "acme/frontend",
        byPrNumber: {},
        aggregates: {
          totalCovered: 0,
          byDecision: { safe: 0, needs_review: 0, risky: 0 },
        },
      },
      false,
    );
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={viewModel}
        quotaStatus={exceededQuota}
      />,
    );
    expect(screen.getByText("Daily scan limit reached")).toBeInTheDocument();
    expect(screen.getByText("PR #42")).toBeInTheDocument();
  });

  it("enables poller when quota is exceeded", () => {
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={emptyViewModel}
        quotaStatus={exceededQuota}
      />,
    );
    expect(screen.getByTestId("scan-poller")).toBeInTheDocument();
  });

  it("does not enable poller when quota is ok and no scans in progress", () => {
    renderWithTheme(
      <RepoHealthDashboard
        {...baseProps}
        viewModel={emptyViewModel}
        quotaStatus={okQuota}
      />,
    );
    expect(screen.queryByTestId("scan-poller")).not.toBeInTheDocument();
  });
});
