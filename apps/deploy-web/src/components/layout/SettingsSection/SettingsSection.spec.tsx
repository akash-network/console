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

  it("renders the aside next to the title", () => {
    render(
      <SettingsSection title="Your keys" aside={<span>2 active keys</span>}>
        <p>key list</p>
      </SettingsSection>
    );

    expect(screen.getByRole("region", { name: "Your keys" })).toHaveTextContent("2 active keys");
  });

  it("tints the title as destructive for a danger zone", () => {
    render(
      <SettingsSection title="Danger zone" destructive>
        <p>close deployment</p>
      </SettingsSection>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Danger zone" })).toHaveClass("text-destructive");
  });

  it("keeps the title muted by default", () => {
    render(
      <SettingsSection title="Notifications">
        <p>alerts</p>
      </SettingsSection>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Notifications" })).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("heading", { level: 2, name: "Notifications" })).not.toHaveClass("text-destructive");
  });
});
