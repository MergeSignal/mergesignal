import { describe, it, expect } from "vitest";
import { renderWithTheme, screen, userEvent, waitFor } from "../testUtils";
import { MSCodeBlock } from "./MSCodeBlock";

describe("MSCodeBlock", () => {
  it("renders code text", () => {
    renderWithTheme(<MSCodeBlock text="npm install" />);
    expect(screen.getByText("npm install")).toBeInTheDocument();
  });

  it("renders copy control with default label", () => {
    renderWithTheme(<MSCodeBlock text="x" />);
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" }),
    ).toBeInTheDocument();
  });

  it("uses custom copyLabel for aria-label", () => {
    renderWithTheme(<MSCodeBlock text="y" copyLabel="Copy install snippet" />);
    expect(
      screen.getByRole("button", { name: "Copy install snippet" }),
    ).toBeInTheDocument();
  });

  it("updates aria-label to Copied after click", async () => {
    renderWithTheme(<MSCodeBlock text="z" />);
    const btn = screen.getByRole("button", { name: "Copy to clipboard" });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Copied" }),
      ).toBeInTheDocument();
    });
  });
});
