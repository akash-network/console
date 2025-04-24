/* eslint-disable simple-import-sort/imports */
import { render, screen } from "@testing-library/react";
import { LinearLoadingSkeleton } from "../LinearLoadingSkeleton";

// Mock MUI's LinearProgress component
jest.mock("@mui/material/LinearProgress", () => {
  return {
    __esModule: true,
    default: () => <div data-testid="linear-progress" />
  };
});

describe("LinearLoadingSkeleton Component", () => {
  it("renders LinearProgress when isLoading is true", () => {
    render(<LinearLoadingSkeleton isLoading={true} />);

    expect(screen.getByTestId("linear-progress")).toBeInTheDocument();
    expect(screen.queryByTestId("linear-progress")).toBeInTheDocument();
  });

  it("renders empty div when isLoading is false", () => {
    const { container } = render(<LinearLoadingSkeleton isLoading={false} />);

    expect(screen.queryByTestId("linear-progress")).not.toBeInTheDocument();
    // Directly check the container's first div child
    const emptyDiv = container.querySelector(".h-\\[4px\\]");
    expect(emptyDiv).toBeInTheDocument();
    expect(emptyDiv).toHaveClass("h-[4px] w-full min-w-0");
  });
});
