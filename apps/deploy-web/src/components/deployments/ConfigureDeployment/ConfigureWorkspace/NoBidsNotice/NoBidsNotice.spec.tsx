import { describe, expect, it, vi } from "vitest";

import { NoBidsNotice } from "./NoBidsNotice";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NoBidsNotice.name, () => {
  it("explains why matching providers may not bid", () => {
    setup();

    expect(screen.getByRole("status")).toHaveTextContent("No provider bid on your deployment");
    expect(screen.getByRole("status")).toHaveTextContent(
      "some providers only take deployments from accounts on their allowlist, run custom setups, or reserve their capacity for private contracts."
    );
  });

  it("asks for compute when the user requests it", async () => {
    const { onRequestCompute } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Request compute" }));

    expect(onRequestCompute).toHaveBeenCalledTimes(1);
  });

  it("points to changing the configuration as the other way out", () => {
    setup();

    expect(screen.getByText("You can also change your configuration and choose a provider again.")).toBeInTheDocument();
  });

  function setup() {
    const onRequestCompute = vi.fn();
    render(<NoBidsNotice onRequestCompute={onRequestCompute} />);
    return { onRequestCompute };
  }
});
