import { describe, expect, it, vi } from "vitest";

import { NoBidsNotice } from "./NoBidsNotice";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NoBidsNotice.name, () => {
  it("explains why matching providers may not bid", () => {
    setup();

    expect(screen.getByRole("status")).toHaveTextContent("No provider has bid yet");
    expect(screen.getByRole("status")).toHaveTextContent(
      "some providers only take deployments from accounts on their allowlist, run custom setups, or reserve their capacity for private contracts."
    );
  });

  it("asks for compute when the user requests it", async () => {
    const { onRequestCompute } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Request compute" }));

    expect(onRequestCompute).toHaveBeenCalledTimes(1);
  });

  it("says a late bid still shows up and points to Close and Edit as the other way out", () => {
    setup();

    expect(screen.getByText("A late bid still shows up here. To change your configuration, use Close and Edit.")).toBeInTheDocument();
  });

  function setup() {
    const onRequestCompute = vi.fn();
    render(<NoBidsNotice onRequestCompute={onRequestCompute} />);
    return { onRequestCompute };
  }
});
