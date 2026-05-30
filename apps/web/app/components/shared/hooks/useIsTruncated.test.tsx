import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useIsTruncated } from "./useIsTruncated";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function TestHarness({
  axis,
  width,
  scrollWidth,
}: {
  axis?: "horizontal" | "vertical" | "both";
  width: number;
  scrollWidth: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const truncated = useIsTruncated(ref, { axis });

  return (
    <span
      ref={(node) => {
        ref.current = node;
        if (node) {
          Object.defineProperty(node, "clientWidth", {
            configurable: true,
            value: width,
          });
          Object.defineProperty(node, "scrollWidth", {
            configurable: true,
            value: scrollWidth,
          });
          Object.defineProperty(node, "clientHeight", {
            configurable: true,
            value: 20,
          });
          Object.defineProperty(node, "scrollHeight", {
            configurable: true,
            value: 20,
          });
        }
      }}
      data-truncated={truncated ? "true" : "false"}
    >
      Content
    </span>
  );
}

describe("useIsTruncated", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when content fits horizontally", async () => {
    const { renderWithTheme, screen, waitFor } = await import("../testUtils");
    renderWithTheme(<TestHarness width={200} scrollWidth={200} />);
    await waitFor(() => {
      expect(screen.getByText("Content")).toHaveAttribute(
        "data-truncated",
        "false",
      );
    });
  });

  it("returns true when content overflows horizontally", async () => {
    const { renderWithTheme, screen, waitFor } = await import("../testUtils");
    renderWithTheme(<TestHarness width={100} scrollWidth={200} />);
    await waitFor(() => {
      expect(screen.getByText("Content")).toHaveAttribute(
        "data-truncated",
        "true",
      );
    });
  });

  it("disconnects ResizeObserver on unmount", async () => {
    const { renderWithTheme, waitFor } = await import("../testUtils");
    const { unmount } = renderWithTheme(
      <TestHarness width={100} scrollWidth={200} />,
    );
    await waitFor(() => {
      expect(MockResizeObserver.instances.length).toBeGreaterThan(0);
    });
    const observer = MockResizeObserver.instances[0]!;
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("re-measures on ResizeObserver callback without redundant state updates", async () => {
    const { renderWithTheme, screen, waitFor } = await import("../testUtils");
    renderWithTheme(<TestHarness width={200} scrollWidth={200} />);
    await waitFor(() => {
      expect(MockResizeObserver.instances.length).toBeGreaterThan(0);
    });

    const element = screen.getByText("Content");
    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: 300,
    });

    act(() => {
      MockResizeObserver.instances[0]!.trigger();
    });

    await waitFor(() => {
      expect(element).toHaveAttribute("data-truncated", "true");
    });
  });

  it("returns a stable boolean from renderHook when element is absent", () => {
    const { result } = renderHook(() => useIsTruncated({ current: null }));
    expect(result.current).toBe(false);
  });
});
