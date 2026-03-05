import { describe, expect, it } from "vitest";

import { Alert } from "./alert";

import { render, screen } from "@testing-library/react";

describe("Alert", () => {
  it("renders components", () => {
    render(<Alert>Hello</Alert>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
