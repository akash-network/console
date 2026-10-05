import { describe, expect, it, vi } from "vitest";

import { SdlImportChangesBanner } from "./SdlImportChangesBanner";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SdlImportChangesBanner.name, () => {
  it("lists each change under its heading", () => {
    setup({ changes: ['Placement "west" is added.', "The minimum reclamation window is different."] });

    const banner = screen.getByRole("region", { name: "Parts of the imported SDL won't deploy as written" });
    expect(
      within(banner)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(['Placement "west" is added.', "The minimum reclamation window is different."]);
  });

  it("asks to be dismissed", async () => {
    const { onDismiss } = setup({ changes: ['Placement "west" is added.'] });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  function setup(input: { changes: string[] }) {
    const onDismiss = vi.fn();
    render(<SdlImportChangesBanner changes={input.changes} onDismiss={onDismiss} />);
    return { onDismiss };
  }
});
