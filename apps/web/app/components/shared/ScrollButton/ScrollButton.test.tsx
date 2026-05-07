import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScrollButton } from "./ScrollButton";

function mockMatchMedia(matchesReduce: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches:
      query === "(prefers-reduced-motion: reduce)" ? matchesReduce : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("ScrollButton", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    const target = document.createElement("div");
    target.id = "target";
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("scrolls target into view on click", async () => {
    render(<ScrollButton targetId="target">Go</ScrollButton>);
    const el = document.getElementById("target")!;
    const scrollSpy = vi.spyOn(el, "scrollIntoView");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth" });
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("uses instant scroll when prefers-reduced-motion is reduce", async () => {
    vi.restoreAllMocks();
    mockMatchMedia(true);
    render(<ScrollButton targetId="target">Go</ScrollButton>);
    const el = document.getElementById("target")!;
    const scrollSpy = vi.spyOn(el, "scrollIntoView");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "auto" });
  });
});
