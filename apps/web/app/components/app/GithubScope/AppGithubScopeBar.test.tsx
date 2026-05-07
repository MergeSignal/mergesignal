import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithTheme, screen, waitFor } from "../../shared/testUtils";
import {
  AppGithubScopeBar,
  AppGithubScopeHome,
  appPathSegments,
} from "./AppGithubScopeBar";
import { GithubScopeProvider } from "./GithubScopeContext";

const mockReplace = vi.fn();
const mockPush = vi.fn();

let mockPathname = "/app";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

describe("appPathSegments", () => {
  it("parses /app owner and repo", () => {
    expect(appPathSegments("/app/acme/r1")).toEqual({
      owner: "acme",
      repo: "r1",
    });
  });

  it("parses /app with owner only", () => {
    expect(appPathSegments("/app/acme")).toEqual({
      owner: "acme",
      repo: null,
    });
  });

  it("parses bare /app", () => {
    expect(appPathSegments("/app")).toEqual({ owner: null, repo: null });
  });
});

function renderBar(
  props: { githubLogin: string; githubOrgs: string[] },
  ownerKey: string | null,
) {
  return renderWithTheme(
    <GithubScopeProvider ownerKey={ownerKey}>
      <AppGithubScopeBar {...props} />
    </GithubScopeProvider>,
  );
}

describe("AppGithubScopeBar", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockPathname = "/app";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          repos: [
            {
              name: "repo-one",
              fullName: "alice/repo-one",
              private: false,
              updatedAt: "2020-01-01",
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders disabled owner MSSelect when there is only one owner", () => {
    mockPathname = "/app/alice/repo-one";
    renderBar({ githubLogin: "alice", githubOrgs: [] }, "alice");
    const accounts = screen.getByRole("combobox", {
      name: /GitHub account or organization/i,
    });
    expect(accounts).toBeDisabled();
  });

  it("replaces /app with /app/:owner when exactly one owner", async () => {
    mockPathname = "/app";
    renderBar({ githubLogin: "alice", githubOrgs: [] }, null);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/alice");
    });
  });

  it("shows repository scope helper copy near the repository field", async () => {
    mockPathname = "/app/alice";
    renderBar({ githubLogin: "alice", githubOrgs: [] }, "alice");
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("combobox", { name: /GitHub repository/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Repositories for the selected account/i),
    ).toBeInTheDocument();
  });

  it("AppGithubScopeHome wraps provider with null owner key", () => {
    renderWithTheme(
      <AppGithubScopeHome githubLogin="alice" githubOrgs={["org-a"]} />,
    );
    expect(
      screen.getByRole("combobox", { name: /GitHub account or organization/i }),
    ).toBeInTheDocument();
  });

  it("shows scope intro when multiple accounts exist", () => {
    mockPathname = "/app/alice";
    renderBar(
      { githubLogin: "alice", githubOrgs: ["org-a", "org-b"] },
      "alice",
    );
    expect(screen.getByText(/Choose your GitHub/i)).toBeInTheDocument();
  });

  it("hides scope intro when only one account and one loaded repository", async () => {
    mockPathname = "/app/alice/repo-one";
    renderBar({ githubLogin: "alice", githubOrgs: [] }, "alice");
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Choose your GitHub/i)).not.toBeInTheDocument();
  });

  it("shows scope intro when one account but multiple repositories", async () => {
    mockPathname = "/app/alice/repo-a";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        repos: [
          {
            name: "repo-a",
            fullName: "alice/repo-a",
            private: false,
            updatedAt: "2020-01-01",
          },
          {
            name: "repo-b",
            fullName: "alice/repo-b",
            private: false,
            updatedAt: "2020-01-01",
          },
        ],
      }),
    });
    renderBar({ githubLogin: "alice", githubOrgs: [] }, "alice");
    await waitFor(() => {
      expect(screen.getByText(/Choose your GitHub/i)).toBeInTheDocument();
    });
  });
});
