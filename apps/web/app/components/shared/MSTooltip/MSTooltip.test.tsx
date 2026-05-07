import { describe, it, expect } from "vitest";
import { renderWithTheme, screen } from "../testUtils";
import { MSTooltip } from "./MSTooltip";

describe("MSTooltip", () => {
  it("renders children", () => {
    renderWithTheme(
      <MSTooltip label="Hint text">
        <button type="button">Target</button>
      </MSTooltip>,
    );
    expect(screen.getByRole("button", { name: "Target" })).toBeInTheDocument();
  });
});
