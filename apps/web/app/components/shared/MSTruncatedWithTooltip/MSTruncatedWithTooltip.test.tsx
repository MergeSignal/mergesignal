import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithTheme, screen, waitFor } from "../testUtils";
import { MSTruncatedWithTooltip } from "./MSTruncatedWithTooltip";
import styles from "./MSTruncatedWithTooltip.module.css";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  disconnect = vi.fn();

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function mockElementDimensions(
  element: HTMLElement,
  { clientWidth, scrollWidth }: { clientWidth: number; scrollWidth: number },
) {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 20,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: 20,
  });
}

describe("MSTruncatedWithTooltip", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children with truncation styling", () => {
    renderWithTheme(
      <MSTruncatedWithTooltip>Long branch name</MSTruncatedWithTooltip>,
    );
    const el = screen.getByText("Long branch name");
    expect(el.className).toContain(styles.truncated);
  });

  it("disables tooltip when content is not truncated", async () => {
    renderWithTheme(
      <MSTruncatedWithTooltip
        tooltip="Full text"
        tooltipProps={{ opened: true }}
      >
        Short
      </MSTruncatedWithTooltip>,
    );

    const el = screen.getByText("Short");
    mockElementDimensions(el, { clientWidth: 200, scrollWidth: 200 });

    await waitFor(() => {
      MockResizeObserver.instances[0]?.trigger();
    });

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("enables tooltip when content is truncated", async () => {
    renderWithTheme(
      <MSTruncatedWithTooltip
        tooltip="Full text"
        tooltipProps={{ opened: true }}
      >
        Truncated content here
      </MSTruncatedWithTooltip>,
    );

    const el = screen.getByText("Truncated content here");
    mockElementDimensions(el, { clientWidth: 50, scrollWidth: 200 });

    await waitFor(() => {
      MockResizeObserver.instances[0]?.trigger();
    });

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Full text");
    });
  });

  it("forwards html attributes to the truncated element", () => {
    renderWithTheme(
      <MSTruncatedWithTooltip id="title-1" className="custom">
        Title
      </MSTruncatedWithTooltip>,
    );
    const el = screen.getByText("Title");
    expect(el).toHaveAttribute("id", "title-1");
    expect(el.className).toContain("custom");
  });

  it("defaults tooltip content to children", async () => {
    renderWithTheme(
      <MSTruncatedWithTooltip tooltipProps={{ opened: true }}>
        Default tooltip label
      </MSTruncatedWithTooltip>,
    );

    const el = screen.getByText("Default tooltip label");
    mockElementDimensions(el, { clientWidth: 50, scrollWidth: 200 });

    await waitFor(() => {
      MockResizeObserver.instances[0]?.trigger();
    });

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Default tooltip label",
      );
    });
  });
});
