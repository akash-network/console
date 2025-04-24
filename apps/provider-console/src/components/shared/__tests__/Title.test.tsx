import { Title } from "../Title";

import { render, screen } from "@testing-library/react";

describe("Title Component", () => {
  it("renders as an h1 by default", () => {
    render(<Title>Hello World</Title>);

    const heading = screen.getByText("Hello World");
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("text-2xl font-bold tracking-tight sm:text-4xl");
  });

  it("renders as an h1 when subTitle is false", () => {
    render(<Title subTitle={false}>Hello World</Title>);

    const heading = screen.getByText("Hello World");
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("text-2xl font-bold tracking-tight sm:text-4xl");
  });

  it("renders as an h3 when subTitle is true", () => {
    render(<Title subTitle>Hello World</Title>);

    const heading = screen.getByText("Hello World");
    expect(heading.tagName).toBe("H3");
    expect(heading).toHaveClass("text-xl font-semibold sm:text-2xl");
  });

  it("applies custom className when provided", () => {
    render(<Title className="custom-class">Hello World</Title>);

    const heading = screen.getByText("Hello World");
    expect(heading).toHaveClass("custom-class");
  });

  it("sets the id attribute when provided", () => {
    render(<Title id="test-id">Hello World</Title>);

    const heading = screen.getByText("Hello World");
    expect(heading).toHaveAttribute("id", "test-id");
  });
});
