import { describe, expect, it } from "vitest";

import type { OrganizationOutput } from "@src/types/organization";
import { OrganizationAvatar, organizationHue } from "./OrganizationAvatar";

import { render } from "@testing-library/react";

describe(OrganizationAvatar.name, () => {
  it("draws the first letter of a team organization as a decorative square", () => {
    const { avatar } = setup({ name: "acme corp", type: "team" });

    expect(avatar).toHaveTextContent("A");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).not.toHaveClass("rounded-full");
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

  describe(organizationHue.name, () => {
    it("hashes the name with FNV-1a into a hue", () => {
      expect(organizationHue("Acme Corp")).toBe(5);
      expect(organizationHue("Northwind Labs")).toBe(138);
    });

    it("gives different names different hues and the same name the same hue", () => {
      expect(organizationHue("Acme Corp")).not.toBe(organizationHue("acme corp"));
      expect(organizationHue("Harborline")).toBe(organizationHue("Harborline"));
    });

    it("stays within the color wheel", () => {
      for (const name of ["", "A", "Zed", "a very long organization name"]) {
        const hue = organizationHue(name);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    });
  });

  function setup(input: Pick<OrganizationOutput, "name" | "type"> & { size?: number }) {
    const { container } = render(<OrganizationAvatar organization={input} size={input.size} />);

    return { avatar: container.firstElementChild as HTMLElement };
  }
});
