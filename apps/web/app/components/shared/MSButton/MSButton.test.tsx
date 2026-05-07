import { describe, it, expect, vi } from "vitest";
import { renderWithTheme, screen, userEvent } from "../testUtils";
import { MSButton } from "./MSButton";

describe("MSButton", () => {
  it("renders with role=button", () => {
    renderWithTheme(<MSButton>Click me</MSButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders children", () => {
    renderWithTheme(<MSButton>Save changes</MSButton>);
    expect(screen.getByText("Save changes")).toBeInTheDocument();
  });

  it("fires onClick when clicked", async () => {
    const handler = vi.fn();
    renderWithTheme(<MSButton onClick={handler}>Go</MSButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const handler = vi.fn();
    renderWithTheme(
      <MSButton disabled onClick={handler}>
        Go
      </MSButton>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire onClick when loading", async () => {
    const handler = vi.fn();
    renderWithTheme(
      <MSButton loading onClick={handler}>
        Go
      </MSButton>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("forwards aria-label", () => {
    renderWithTheme(<MSButton aria-label="Submit form">→</MSButton>);
    expect(
      screen.getByRole("button", { name: "Submit form" }),
    ).toBeInTheDocument();
  });

  it("forwards data-testid", () => {
    renderWithTheme(<MSButton data-testid="my-btn">X</MSButton>);
    expect(screen.getByTestId("my-btn")).toBeInTheDocument();
  });

  it("renders variant=primary by default", () => {
    renderWithTheme(<MSButton>Primary</MSButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders variant=secondary without throwing", () => {
    renderWithTheme(<MSButton variant="secondary">Secondary</MSButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders loading state without throwing", () => {
    renderWithTheme(<MSButton loading>Saving…</MSButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  describe("Accessibility", () => {
    it("is reachable by keyboard Tab when not disabled", async () => {
      renderWithTheme(<MSButton>Tab me</MSButton>);
      await userEvent.tab();
      expect(screen.getByRole("button")).toHaveFocus();
    });

    it("is not focusable when disabled", async () => {
      renderWithTheme(<MSButton disabled>No focus</MSButton>);
      await userEvent.tab();
      expect(screen.getByRole("button")).not.toHaveFocus();
    });

    it("fires onClick when Enter is pressed while focused", async () => {
      const handler = vi.fn();
      renderWithTheme(<MSButton onClick={handler}>Press enter</MSButton>);
      screen.getByRole("button").focus();
      await userEvent.keyboard("{Enter}");
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("fires onClick when Space is pressed while focused", async () => {
      const handler = vi.fn();
      renderWithTheme(<MSButton onClick={handler}>Press space</MSButton>);
      screen.getByRole("button").focus();
      await userEvent.keyboard(" ");
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
