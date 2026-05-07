import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MSCard, MSCardMuted, MSCardNote } from "./MSCard";

describe("MSCard", () => {
  it("renders children", () => {
    render(<MSCard>Hello</MSCard>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders title as h2", () => {
    render(<MSCard title="Summary">Body</MSCard>);
    expect(
      screen.getByRole("heading", { level: 2, name: "Summary" }),
    ).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<MSCard subtitle="Sub">X</MSCard>);
    expect(screen.getByText("Sub")).toBeInTheDocument();
  });

  it("uses section by default", () => {
    const { container } = render(<MSCard>Hi</MSCard>);
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("respects as=div", () => {
    const { container } = render(<MSCard as="div">Hi</MSCard>);
    expect(container.querySelector("div")?.className).toMatch(/card/);
    expect(container.querySelector("section")).toBeNull();
  });

  it("applies noPadding when padding=false", () => {
    const { container } = render(<MSCard padding={false}>X</MSCard>);
    const el = container.querySelector("section");
    expect(el?.className).toMatch(/noPadding/);
  });

  it("merges className on root for layout", () => {
    const { container } = render(<MSCard className="layoutHook">X</MSCard>);
    expect(container.querySelector("section")?.className).toMatch(/layoutHook/);
  });
});

describe("MSCardMuted", () => {
  it("renders as p by default", () => {
    render(<MSCardMuted>Muted text</MSCardMuted>);
    expect(screen.getByText("Muted text").tagName).toBe("P");
  });

  it("supports as=span", () => {
    render(<MSCardMuted as="span">S</MSCardMuted>);
    expect(screen.getByText("S").tagName).toBe("SPAN");
  });
});

describe("MSCardNote", () => {
  it("renders as div by default", () => {
    render(<MSCardNote>Note</MSCardNote>);
    expect(screen.getByText("Note").tagName).toBe("DIV");
  });
});
