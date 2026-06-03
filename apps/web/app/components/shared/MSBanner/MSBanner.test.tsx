import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MSBanner } from "./MSBanner";

const tones = ["neutral", "info", "warning", "danger", "safe"] as const;

describe("MSBanner", () => {
  it("renders title and description", () => {
    render(
      <MSBanner
        title="Daily scan limit reached"
        description="Paused until reset."
      />,
    );
    expect(screen.getByText("Daily scan limit reached")).toBeInTheDocument();
    expect(screen.getByText("Paused until reset.")).toBeInTheDocument();
  });

  it("renders arbitrary React children", () => {
    render(
      <MSBanner title="Title">
        <span data-testid="extra">Extra</span>
      </MSBanner>,
    );
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });

  it("applies data-tone for warning", () => {
    const { container } = render(<MSBanner tone="warning" title="Warn" />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-tone", "warning");
    expect(root?.className).toMatch(/warning/);
  });

  it.each(tones)("supports tone %s", (tone) => {
    const { container } = render(<MSBanner tone={tone} title={tone} />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-tone", tone);
    expect(root?.className).toMatch(new RegExp(tone));
  });

  it("renders dismiss button only when dismissible", () => {
    render(<MSBanner dismissible title="Hi" />);
    expect(
      screen.getByRole("button", { name: "Dismiss message" }),
    ).toBeInTheDocument();
  });

  it("does not render dismiss when dismissible is false", () => {
    render(<MSBanner dismissible={false} title="Hi" />);
    expect(
      screen.queryByRole("button", { name: "Dismiss message" }),
    ).not.toBeInTheDocument();
  });

  it("does not render dismiss when dismissible is omitted", () => {
    render(<MSBanner title="Hi" />);
    expect(
      screen.queryByRole("button", { name: "Dismiss message" }),
    ).not.toBeInTheDocument();
  });

  it("clicking dismiss hides the banner", async () => {
    const { container } = render(<MSBanner dismissible title="Gone" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss message" }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("clicking dismiss calls onDismiss when provided", async () => {
    const onDismiss = vi.fn();
    render(<MSBanner dismissible onDismiss={onDismiss} title="Hi" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss message" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismiss button has accessible label", () => {
    render(<MSBanner dismissible title="Hi" />);
    expect(
      screen.getByRole("button", { name: "Dismiss message" }),
    ).toHaveAttribute("aria-label", "Dismiss message");
  });

  it("uses role=status for warning tone", () => {
    const { container } = render(<MSBanner tone="warning" title="W" />);
    expect(container.firstElementChild).toHaveAttribute("role", "status");
  });

  it("does not use dangerouslySetInnerHTML", () => {
    expect(MSBanner.toString()).not.toContain("dangerouslySetInnerHTML");
    const { container } = render(<MSBanner title="Safe" />);
    expect(container.innerHTML).not.toContain("dangerouslySetInnerHTML");
  });
});
