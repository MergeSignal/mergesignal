import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MSDataTable, MSTD } from "./MSTable";

describe("MSDataTable", () => {
  it("renders a table with column headers", () => {
    render(
      <MSDataTable
        headers={["A", "B"]}
        rows={
          <tr>
            <MSTD>1</MSTD>
            <MSTD>2</MSTD>
          </tr>
        }
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "A" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "B" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
  });

  it("forwards minWidth to table style", () => {
    render(
      <MSDataTable
        headers={["X"]}
        minWidth={400}
        rows={
          <tr>
            <MSTD>y</MSTD>
          </tr>
        }
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toHaveStyle({ minWidth: "400px" });
  });

  it("merges className on wrapper", () => {
    const { container } = render(
      <MSDataTable
        className="tableWrap"
        headers={["H"]}
        rows={
          <tr>
            <MSTD>c</MSTD>
          </tr>
        }
      />,
    );
    expect(container.querySelector(".tableWrap")).toBeTruthy();
  });
});

describe("MSTD", () => {
  it("renders cell content", () => {
    render(
      <table>
        <tbody>
          <tr>
            <MSTD>cell</MSTD>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("cell", { name: "cell" })).toBeInTheDocument();
  });
});
