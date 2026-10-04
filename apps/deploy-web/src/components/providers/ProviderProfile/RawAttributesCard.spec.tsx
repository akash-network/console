import { describe, expect, it } from "vitest";

import { RawAttributesCard } from "./RawAttributesCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("RawAttributesCard", () => {
  it("keeps the attributes folded away, counting them, until opened", async () => {
    render(
      <RawAttributesCard
        attributes={[
          { key: "region", value: "eu-central", auditedBy: [] },
          { key: "capabilities/gpu", value: "nvidia", auditedBy: [] }
        ]}
      />
    );

    const toggle = screen.getByRole("button", { name: /Raw attributes/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("2");
    expect(screen.queryByText("eu-central")).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("region")).toBeInTheDocument();
    expect(screen.getByText("eu-central")).toBeInTheDocument();
    expect(screen.getByText("nvidia")).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.queryByText("eu-central")).not.toBeInTheDocument();
  });
});
