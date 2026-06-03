import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { RepoHealthScanPoller } from "./RepoHealthScanPoller";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("RepoHealthScanPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls router.refresh on interval when active", () => {
    render(<RepoHealthScanPoller active />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("does not refresh when inactive", () => {
    render(<RepoHealthScanPoller active={false} />);
    vi.advanceTimersByTime(8000);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
