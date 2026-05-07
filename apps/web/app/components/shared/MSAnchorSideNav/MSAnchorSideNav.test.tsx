import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MSAnchorSideNav } from "./MSAnchorSideNav";

const items = [
  { href: "#a", label: "Alpha" },
  { href: "#b", label: "Beta" },
] as const;

describe("MSAnchorSideNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    for (const id of ["a", "b"]) {
      const el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    window.history.replaceState({}, "", "/#a");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nav landmark with aria-label", () => {
    render(<MSAnchorSideNav items={items} ariaLabel="Sections" />);
    expect(
      screen.getByRole("navigation", { name: "Sections" }),
    ).toBeInTheDocument();
  });

  it("renders links for each item", () => {
    render(<MSAnchorSideNav items={items} />);
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "#a",
    );
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute(
      "href",
      "#b",
    );
  });

  it("marks active link from location hash", async () => {
    window.history.replaceState({}, "", "/#b");
    render(<MSAnchorSideNav items={items} />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute(
        "aria-current",
        "location",
      );
    });
  });
});
