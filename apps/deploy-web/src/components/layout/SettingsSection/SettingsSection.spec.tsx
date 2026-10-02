import { describe, expect, it } from "vitest";

import { SettingsSection } from "./SettingsSection";

import { render, screen } from "@testing-library/react";

describe(SettingsSection.name, () => {
  it("renders its content in a region named by the section title", () => {
    render(
      <SettingsSection title="Account">
        <p>balance card</p>
      </SettingsSection>
    );

    expect(screen.getByRole("region", { name: "Account" })).toHaveTextContent("balance card");
    expect(screen.getByRole("heading", { level: 2, name: "Account" })).toBeInTheDocument();
  });
});
