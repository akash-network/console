import { describe, expect, it } from "vitest";

import { SettingsLayout } from "./SettingsLayout";

import { render, screen } from "@testing-library/react";

describe(SettingsLayout.name, () => {
  it("renders the title, header actions, and children", () => {
    setup({
      title: "Settings",
      headerActions: <button>Action</button>,
      children: <p>Body content</p>
    });

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  function setup(input: { title: string; headerActions?: React.ReactNode; children?: React.ReactNode; titleId?: string }) {
    return render(
      <SettingsLayout title={input.title} titleId={input.titleId} headerActions={input.headerActions}>
        {input.children}
      </SettingsLayout>
    );
  }
});
