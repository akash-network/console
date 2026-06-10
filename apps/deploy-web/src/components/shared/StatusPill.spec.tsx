import { describe, expect, it } from "vitest";

import { StatusPill } from "./StatusPill";

import { render } from "@testing-library/react";

describe("StatusPill", () => {
  it("uses the green color for active leases", () => {
    const { pill } = setup({ state: "active" });
    expect(pill).toHaveClass("bg-green-600");
  });

  it("uses the amber color for reclaiming leases", () => {
    const { pill } = setup({ state: "reclaiming" });
    expect(pill).toHaveClass("bg-amber-500");
  });

  it("uses the destructive color for closed leases", () => {
    const { pill } = setup({ state: "closed" });
    expect(pill).toHaveClass("bg-destructive");
  });

  function setup(input: { state: string }) {
    const { container } = render(<StatusPill state={input.state} />);
    return { pill: container.firstChild as HTMLElement };
  }
});
