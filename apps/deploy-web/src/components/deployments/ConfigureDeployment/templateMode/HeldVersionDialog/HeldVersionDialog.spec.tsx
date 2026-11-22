import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TemplateVersionHoldReason } from "@src/types/marketplace-template";
import { HeldVersionDialog } from "./HeldVersionDialog";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const HOLD_REASONS: TemplateVersionHoldReason[] = [
  {
    kind: "image_repository_changed",
    message: "comfyui now runs ghcr.io/northwind-labs/comfyui-flux:1.3, an image from a repository this template did not use before.",
    service: "comfyui",
    image: "ghcr.io/northwind-labs/comfyui-flux:1.3"
  },
  { kind: "global_port_added", message: "comfyui newly opens port 8188 to the internet.", service: "comfyui", port: 8188, protocol: "tcp" }
];

describe(HeldVersionDialog.name, () => {
  it("says the version is saved, waits for staff and which version stays in use", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "v5 is saved and waiting for review" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Akash staff review this version before it becomes the current one. Until then v4 stays the current version, the one people deploy."
    );
  });

  it("promises nothing about a gallery, since the template may be private while it waits", () => {
    setup({});

    expect(screen.getByRole("dialog")).not.toHaveTextContent(/gallery|public|live/i);
  });

  it("names no current version when the template has none", () => {
    setup({ currentVersion: undefined });

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Akash staff review this version before it becomes the current one. Until then nobody deploys it."
    );
  });

  it("lists every reason the version waits for", () => {
    setup({});

    const reasons = within(screen.getByRole("list", { name: "Why it waits for review" })).getAllByRole("listitem");
    expect(reasons.map(reason => reason.textContent)).toEqual(HOLD_REASONS.map(reason => reason.message));
  });

  it.each([
    ["no reasons", []],
    ["reasons the caller may not read", null]
  ])("points to the Versions tab when the version comes with %s", (_, holdReasons) => {
    setup({ holdReasons });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("The Versions tab of the template shows why it waits.")).toBeInTheDocument();
  });

  it("says the publisher is told when the review is decided", () => {
    setup({});

    expect(screen.getByText(/You get an email and a notice in Console when staff approve or reject it\./)).toBeInTheDocument();
  });

  it("stays on the page on Keep editing and on Escape, and leaves on View versions", async () => {
    const { onKeepEditing, onViewVersions } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onKeepEditing).toHaveBeenCalledTimes(2);
    expect(onViewVersions).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "View versions" }));
    expect(onViewVersions).toHaveBeenCalledTimes(1);
  });

  it("shows markup in a reason as text", () => {
    const hostileReason = 'web now runs <img src=x onerror="alert(1)">:1.0, see [docs](javascript:alert(1)) <a href="https://evil.example">here</a>';
    setup({ holdReasons: [{ kind: "image_repository_changed", message: hostileReason }] });

    expect(screen.getByText(hostileReason)).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector("img, a")).not.toBeInTheDocument();
  });

  it.each([
    ["Keep editing", async () => userEvent.click(screen.getByRole("button", { name: "Keep editing" }))],
    ["Escape", async () => userEvent.keyboard("{Escape}")]
  ])("hands focus back to the save button after %s", async (_, close) => {
    setup({ closesOnKeepEditing: true });

    await close();

    await waitFor(() => expect(screen.getByRole("button", { name: "Save new version" })).toHaveFocus());
  });

  function setup(input: { closesOnKeepEditing?: boolean; holdReasons?: TemplateVersionHoldReason[] | null; currentVersion?: number }) {
    const onKeepEditing = vi.fn();
    const onViewVersions = vi.fn();

    const returnFocusTo = createRef<HTMLButtonElement>();
    const DialogOpenedBySave = () => {
      const [isOpen, setIsOpen] = useState(true);

      return (
        <>
          <button ref={returnFocusTo} type="button">
            Save new version
          </button>
          {isOpen && (
            <HeldVersionDialog
              version={{ version: 5, holdReasons: input.holdReasons === undefined ? HOLD_REASONS : input.holdReasons }}
              currentVersion={"currentVersion" in input ? input.currentVersion : 4}
              onKeepEditing={() => {
                onKeepEditing();
                if (input.closesOnKeepEditing) setIsOpen(false);
              }}
              onViewVersions={onViewVersions}
              returnFocusTo={returnFocusTo}
            />
          )}
        </>
      );
    };

    render(<DialogOpenedBySave />);

    return { onKeepEditing, onViewVersions };
  }
});
