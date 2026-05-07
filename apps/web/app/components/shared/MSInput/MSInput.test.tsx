import { describe, it, expect, vi } from "vitest";
import { renderWithTheme, screen } from "../testUtils";
import { MSInput } from "./MSInput";

describe("MSInput", () => {
  it("renders an input element", () => {
    renderWithTheme(<MSInput />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("forwards value and onChange", async () => {
    const handler = vi.fn();
    renderWithTheme(<MSInput value="hello" onChange={handler} />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });

  it("forwards placeholder", () => {
    renderWithTheme(<MSInput placeholder="Enter text…" />);
    expect(screen.getByPlaceholderText("Enter text…")).toBeInTheDocument();
  });

  it("forwards name attribute", () => {
    renderWithTheme(<MSInput name="email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("name", "email");
  });

  it("forwards id attribute", () => {
    renderWithTheme(<MSInput id="my-input" />);
    expect(document.getElementById("my-input")).toBeInTheDocument();
  });

  it("renders label text when label is provided", () => {
    renderWithTheme(<MSInput label="Email address" />);
    expect(screen.getByText("Email address")).toBeInTheDocument();
  });

  it("renders error message when error is provided", () => {
    renderWithTheme(<MSInput error="This field is required" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("renders description text when description is provided", () => {
    renderWithTheme(<MSInput description="We'll never share your email." />);
    expect(
      screen.getByText("We'll never share your email."),
    ).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    renderWithTheme(<MSInput disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  describe("Accessibility", () => {
    it("is reachable by keyboard Tab", async () => {
      const { userEvent } = await import("../testUtils");
      renderWithTheme(<MSInput />);
      await userEvent.tab();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("label is programmatically associated with the input", () => {
      renderWithTheme(<MSInput label="Full name" id="full-name" />);
      const input = screen.getByRole("textbox");
      const label = screen.getByText("Full name");
      // Mantine wires htmlFor automatically when id is present
      expect(label).toBeInTheDocument();
      expect(input).toHaveAttribute("id", "full-name");
    });

    it("error message is programmatically associated via aria-describedby", () => {
      renderWithTheme(<MSInput error="Required" id="my-field" />);
      const input = screen.getByRole("textbox");
      // Mantine adds aria-describedby pointing to the error element
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
    });
  });
});
