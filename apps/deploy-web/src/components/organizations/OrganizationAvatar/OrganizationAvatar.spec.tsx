import { describe, expect, it } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import { hueOf, OrganizationAvatar } from "./OrganizationAvatar";

import { render } from "@testing-library/react";

const TEAM_ID = "0b9f3c2e-5d4a-4e1b-9c7f-2a6d8e1f4b3c";

describe(OrganizationAvatar.name, () => {
  it("draws the first letter of a team organization as a decorative square", () => {
    const { avatar } = setup({ name: "acme corp", type: "team" });

    expect(avatar).toHaveTextContent("A");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).not.toHaveClass("rounded-full");
  });

  it("colors a team from the hue of its id", () => {
    const { avatar } = setup({ id: TEAM_ID, name: "Acme Corp", type: "team" });

    expect(avatar.style.boxShadow).toBe("inset 0 0 0 1px oklch(0.84 0.07 193)");
  });

  it("keeps a renamed team's color and takes the new first letter", () => {
    const before = setup({ id: TEAM_ID, name: "Acme Corp", type: "team" }).avatar;
    const after = setup({ id: TEAM_ID, name: "Northwind Labs", type: "team" }).avatar;

    expect([before.style.boxShadow, after.style.boxShadow]).toEqual(["inset 0 0 0 1px oklch(0.84 0.07 193)", "inset 0 0 0 1px oklch(0.84 0.07 193)"]);
    expect([before.textContent, after.textContent]).toEqual(["A", "N"]);
  });

  it("derives every dimension from the requested size", () => {
    const { avatar } = setup({ name: "Acme Corp", type: "team", size: 50 });

    expect(avatar).toHaveStyle({ width: "50px", height: "50px", borderRadius: "14px", fontSize: "24px" });
  });

  it("falls back to a question mark for a blank name", () => {
    const { avatar } = setup({ name: "   ", type: "team" });

    expect(avatar).toHaveTextContent("?");
  });

  it("shows the user's own avatar for the personal organization", () => {
    const { avatar } = setup({ name: "alice", type: "personal", size: 20 });

    expect(avatar).toHaveClass("rounded-full");
    expect(avatar).toHaveTextContent("A");
    expect(avatar).toHaveStyle({ width: "20px", height: "20px" });
  });

  describe(hueOf.name, () => {
    it("hashes the seed with FNV-1a into a hue", () => {
      expect(hueOf("Acme Corp")).toBe(5);
      expect(hueOf("Northwind Labs")).toBe(138);
      expect(hueOf(TEAM_ID)).toBe(193);
    });

    it("gives different seeds different hues and the same seed the same hue", () => {
      expect(hueOf("Acme Corp")).not.toBe(hueOf("acme corp"));
      expect(hueOf("Harborline")).toBe(hueOf("Harborline"));
    });

    it("stays within the color wheel", () => {
      for (const seed of ["", "A", "Zed", "a very long organization name"]) {
        const hue = hueOf(seed);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    });
  });

  function setup(input: Pick<OrganizationOutput, "name" | "type"> & { id?: string; size?: number }) {
    const { id = TEAM_ID, size, ...organization } = input;
    const { container } = render(<OrganizationAvatar organization={{ id, ...organization }} size={size} />);

    return { avatar: container.firstElementChild as HTMLElement };
  }
});
