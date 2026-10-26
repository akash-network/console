import { describe, expect, it, vi } from "vitest";

import { findTourTarget, openOrganizationMenu, TOUR_TARGET } from "./tourTargets";

describe("tourTargets", () => {
  describe(findTourTarget.name, () => {
    it("finds the control tagged with the target name", () => {
      const { root, add } = setup();
      const folder = add(TOUR_TARGET.projectFolder);

      expect(findTourTarget([TOUR_TARGET.projectFolder], root)).toBe(folder);
    });

    it("falls back to the next name when the first is not on the page", () => {
      const { root, add } = setup();
      const emptyState = add(TOUR_TARGET.projectsEmpty);

      expect(findTourTarget([TOUR_TARGET.projectFolder, TOUR_TARGET.projectsEmpty], root)).toBe(emptyState);
    });

    it("prefers the earlier name when both are on the page", () => {
      const { root, add } = setup();
      const emptyState = add(TOUR_TARGET.projectsEmpty);
      const folder = add(TOUR_TARGET.projectFolder);

      expect(findTourTarget([TOUR_TARGET.projectFolder, TOUR_TARGET.projectsEmpty], root)).toBe(folder);
      expect(findTourTarget([TOUR_TARGET.projectsEmpty, TOUR_TARGET.projectFolder], root)).toBe(emptyState);
    });

    it("returns null when none of the controls is on the page", () => {
      const { root, add } = setup();
      add(TOUR_TARGET.newProject);

      expect(findTourTarget([TOUR_TARGET.organizationSwitcher], root)).toBeNull();
    });

    it("looks in the whole document by default", () => {
      const { add, remove } = setup({ attachToDocument: true });
      const switcher = add(TOUR_TARGET.organizationSwitcher);

      expect(findTourTarget([TOUR_TARGET.organizationSwitcher])).toBe(switcher);
      remove();
    });
  });

  describe(openOrganizationMenu.name, () => {
    it("presses ArrowDown on the closed switcher, the key its menu opens on", () => {
      const { root, add } = setup();
      const switcher = add(TOUR_TARGET.organizationSwitcher);
      const pressedKeys = recordKeyDowns(switcher);

      openOrganizationMenu(root);

      expect(pressedKeys).toEqual([{ key: "ArrowDown", bubbles: true }]);
    });

    it("leaves an open switcher alone", () => {
      const { root, add } = setup();
      const switcher = add(TOUR_TARGET.organizationSwitcher);
      switcher.setAttribute("aria-expanded", "true");
      const pressedKeys = recordKeyDowns(switcher);

      openOrganizationMenu(root);

      expect(pressedKeys).toEqual([]);
    });

    it("presses the key on a switcher whose menu is marked closed", () => {
      const { root, add } = setup();
      const switcher = add(TOUR_TARGET.organizationSwitcher);
      switcher.setAttribute("aria-expanded", "false");
      const pressedKeys = recordKeyDowns(switcher);

      openOrganizationMenu(root);

      expect(pressedKeys).toHaveLength(1);
    });

    it("does nothing when the switcher is not on the page", () => {
      const { root, add } = setup();
      const otherControl = add(TOUR_TARGET.newProject);
      const pressedKeys = recordKeyDowns(otherControl);

      expect(() => openOrganizationMenu(root)).not.toThrow();
      expect(pressedKeys).toEqual([]);
    });

    it("looks in the whole document by default", () => {
      const { add, remove } = setup({ attachToDocument: true });
      const switcher = add(TOUR_TARGET.organizationSwitcher);
      const onKeyDown = vi.fn();
      switcher.addEventListener("keydown", onKeyDown);

      openOrganizationMenu();

      expect(onKeyDown).toHaveBeenCalledOnce();
      remove();
    });
  });

  function recordKeyDowns(element: HTMLElement) {
    const pressedKeys: { key: string; bubbles: boolean }[] = [];
    element.addEventListener("keydown", event => pressedKeys.push({ key: event.key, bubbles: event.bubbles }));
    return pressedKeys;
  }

  function setup(input: { attachToDocument?: boolean } = {}) {
    const root = document.createElement("div");
    if (input.attachToDocument) document.body.appendChild(root);

    const add = (target: string) => {
      const element = document.createElement("button");
      element.setAttribute("data-tour-target", target);
      root.appendChild(element);
      return element;
    };

    return { root, add, remove: () => root.remove() };
  }
});
