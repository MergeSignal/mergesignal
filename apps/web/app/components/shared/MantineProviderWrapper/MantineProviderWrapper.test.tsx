import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProviderWrapper } from "./MantineProviderWrapper";

describe("MantineProviderWrapper", () => {
  it("renders children without throwing", () => {
    expect(() =>
      render(
        <MantineProviderWrapper>
          <span>hello</span>
        </MantineProviderWrapper>,
      ),
    ).not.toThrow();
  });

  it("makes children accessible in the DOM after render", () => {
    render(
      <MantineProviderWrapper>
        <span>visible content</span>
      </MantineProviderWrapper>,
    );
    expect(screen.getByText("visible content")).toBeInTheDocument();
  });
});
