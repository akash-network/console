import { describe, expect, it } from "vitest";

import { SettingsCard, SettingsRow } from "./SettingsCard";

import { render, screen } from "@testing-library/react";

describe(SettingsRow.name, () => {
  it("labels the control it points at", () => {
    render(
      <SettingsCard>
        <SettingsRow label="Username" htmlFor="username-input" description="Shown on your public profile.">
          <input id="username-input" />
        </SettingsRow>
      </SettingsCard>
    );

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByText("Shown on your public profile.")).toBeInTheDocument();
  });

  it("shows a plain label next to a value", () => {
    render(
      <SettingsCard destructive>
        <SettingsRow label="Email">alice@example.com</SettingsRow>
      </SettingsCard>
    );

    expect(screen.getByText("Email").tagName).toBe("SPAN");
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });
});
