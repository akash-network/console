import { Alert } from "./alert";

import { render, screen } from "@testing-library/react";

describe(Alert.name, () => {
  it("renders components", () => {
    render(<Alert>Hello</Alert>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
