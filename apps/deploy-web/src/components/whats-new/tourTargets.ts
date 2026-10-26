export const TOUR_TARGET = {
  projectFolder: "project-folder",
  projectsEmpty: "projects-empty",
  newProject: "new-project",
  organizationSwitcher: "organization-switcher",
  createOrganization: "create-organization"
} as const;

export type TourTargetName = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET];

export function findTourTarget(names: readonly TourTargetName[], root: ParentNode = document): HTMLElement | null {
  for (const name of names) {
    const element = root.querySelector<HTMLElement>(`[data-tour-target="${name}"]`);
    if (element) return element;
  }
  return null;
}

/** Radix opens a dropdown on pointerdown or ArrowDown, never on a synthetic click. */
export function openOrganizationMenu(root: ParentNode = document) {
  const trigger = root.querySelector<HTMLElement>(`[data-tour-target="${TOUR_TARGET.organizationSwitcher}"]`);
  if (!trigger || trigger.getAttribute("aria-expanded") === "true") return;
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
}
