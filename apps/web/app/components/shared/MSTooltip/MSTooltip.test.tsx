import { describe, it, expect } from "vitest";
import { renderWithTheme, screen } from "../testUtils";
import { MSTooltip } from "./MSTooltip";
import styles from "./MSTooltip.module.css";

describe("MSTooltip", () => {
  it("renders children", () => {
    renderWithTheme(
      <MSTooltip label="Hint text">
        <button type="button">Target</button>
      </MSTooltip>,
    );
    expect(screen.getByRole("button", { name: "Target" })).toBeInTheDocument();
  });

  it("shows tooltip content when opened", () => {
    renderWithTheme(
      <MSTooltip label="Hint text" opened>
        <button type="button">Target</button>
      </MSTooltip>,
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hint text");
  });

  it("associates tooltip with trigger via aria-describedby", () => {
    renderWithTheme(
      <MSTooltip label="Hint text" opened>
        <button type="button">Target</button>
      </MSTooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Target" });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveAttribute(
      "role",
      "tooltip",
    );
  });

  describe("size variants", () => {
    it("applies md size class by default", () => {
      renderWithTheme(
        <MSTooltip label="Hint" opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.getByRole("tooltip").className).toContain(styles.sizeMd);
    });

    it("applies sm size class", () => {
      renderWithTheme(
        <MSTooltip label="Hint" size="sm" opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.getByRole("tooltip").className).toContain(styles.sizeSm);
    });

    it("applies lg size class", () => {
      renderWithTheme(
        <MSTooltip label="Hint" size="lg" opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.getByRole("tooltip").className).toContain(styles.sizeLg);
    });
  });

  it("applies base tooltip styling class", () => {
    renderWithTheme(
      <MSTooltip label="Hint" opened>
        <button type="button">Target</button>
      </MSTooltip>,
    );
    expect(screen.getByRole("tooltip").className).toContain(styles.tooltip);
  });

  it("applies the token-based tooltip surface class", () => {
    renderWithTheme(
      <MSTooltip label="Hint" opened>
        <button type="button">Target</button>
      </MSTooltip>,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain(styles.tooltip);
    expect(tooltip.className).toContain(styles.sizeMd);
  });

  describe("interactive mode", () => {
    it("applies interactive class when interactive is true", () => {
      renderWithTheme(
        <MSTooltip label="Hint" interactive opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.getByRole("tooltip").className).toContain(
        styles.interactive,
      );
    });

    it("does not apply interactive class by default", () => {
      renderWithTheme(
        <MSTooltip label="Hint" opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.getByRole("tooltip").className).not.toContain(
        styles.interactive,
      );
    });
  });

  describe("accessibility", () => {
    it("is reachable by keyboard focus on trigger", async () => {
      const { userEvent } = await import("../testUtils");
      renderWithTheme(
        <MSTooltip label="Hint text">
          <button type="button">Target</button>
        </MSTooltip>,
      );
      await userEvent.tab();
      expect(screen.getByRole("button", { name: "Target" })).toHaveFocus();
    });

    it("does not render tooltip when disabled", () => {
      renderWithTheme(
        <MSTooltip label="Hint text" disabled opened>
          <button type="button">Target</button>
        </MSTooltip>,
      );
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
