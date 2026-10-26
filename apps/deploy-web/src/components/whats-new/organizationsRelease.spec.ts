import { describe, expect, it, vi } from "vitest";

import { ORGANIZATIONS_RELEASE_ID, organizationsRelease } from "./organizationsRelease";
import { TOUR_TARGET } from "./tourTargets";

const SHARED_SLIDES = [
  {
    sceneId: "newProject",
    title: "Start a project for each app",
    body: "Click New project, give it a name like checkout-api, and add a short description so everyone knows what lives there."
  },
  {
    sceneId: "switcher",
    title: "Switch between accounts",
    body: "Your personal account is still here. Use the switcher in the header to move between it and any organizations you belong to."
  },
  {
    sceneId: "createOrganization",
    title: "Bring your team with organizations",
    body: "Create an organization to share projects, deployments and billing with your team. Invite teammates while you set it up."
  }
];

const PROJECTS_STEP = {
  id: "projects",
  title: "Your deployments now live in projects",
  body: "Each folder is a project. It groups the deployments behind one app or service.",
  hint: "Hover the folder to see what’s inside",
  hintIcon: "hover",
  placement: "right",
  padding: 8,
  radius: 18,
  onTargetClick: "swallow",
  findTarget: expect.any(Function),
  prepare: expect.any(Function)
};

const NEW_PROJECT_STEP = {
  id: "new-project",
  title: "Start a project for each app",
  body: "Name it after the app or service, like checkout-api, and add a short description.",
  hint: "Try it: click New project",
  hintIcon: "click",
  placement: "bottom",
  padding: 6,
  radius: 12,
  onTargetClick: "advance",
  findTarget: expect.any(Function),
  prepare: expect.any(Function)
};

const SWITCHER_STEP = {
  id: "switcher",
  title: "Switch between accounts",
  body: "Your personal account and every organization you belong to live in this menu.",
  hint: "Click the switcher to open it",
  hintIcon: "click",
  placement: "bottom",
  padding: 5,
  radius: 13,
  onTargetClick: "advance",
  findTarget: expect.any(Function)
};

const CREATE_ORGANIZATION_STEP = {
  id: "create-organization",
  title: "Bring your team",
  body: "Create an organization to share projects, deployments and billing with your team.",
  hint: "Click Create organization to set one up",
  hintIcon: "click",
  placement: "left",
  padding: 3,
  radius: 10,
  onTargetClick: "advance",
  findTarget: expect.any(Function),
  prepare: expect.any(Function)
};

describe(organizationsRelease.name, () => {
  it("names the release", () => {
    const { release } = setup({ isInTeam: true, canManageProjects: true });

    expect(release).toMatchObject({ id: ORGANIZATIONS_RELEASE_ID, name: "Organizations & Projects" });
    expect(ORGANIZATIONS_RELEASE_ID).toBe("orgs-projects-2026-10");
  });

  describe("in a team organization", () => {
    it("tells the team its deployments now live in projects", () => {
      const { release } = setup({ isInTeam: true, canManageProjects: true });

      expect(release.slides).toEqual([
        {
          sceneId: "projects",
          title: "Your deployments now live in projects",
          body: "A project groups the deployments behind one app or service. Hover a folder on the Projects page to see what’s running inside."
        },
        ...SHARED_SLIDES
      ]);
    });

    it("tours an owner or admin through the projects, New project, the switcher and Create organization", () => {
      const { release } = setup({ isInTeam: true, canManageProjects: true });

      expect(release.tour).toEqual([PROJECTS_STEP, NEW_PROJECT_STEP, SWITCHER_STEP, CREATE_ORGANIZATION_STEP]);
    });

    it("skips New project for a member who cannot create one", () => {
      const { release } = setup({ isInTeam: true, canManageProjects: false });

      expect(release.tour.map(step => step.id)).toEqual(["projects", "switcher", "create-organization"]);
    });

    it("brings the projects on screen for the steps that point at them", () => {
      const { release, showProjects } = setup({ isInTeam: true, canManageProjects: true });

      release.tour[0].prepare?.();
      release.tour[1].prepare?.();

      expect(showProjects).toHaveBeenCalledTimes(2);
    });
  });

  describe("in a personal account", () => {
    it("explains that projects group a team's deployments in an organization", () => {
      const { release } = setup({ isInTeam: false, canManageProjects: true });

      expect(release.slides).toEqual([
        {
          sceneId: "projects",
          title: "Projects group your team’s deployments",
          body: "In an organization, a project groups the deployments behind one app or service."
        },
        ...SHARED_SLIDES
      ]);
    });

    it("tours only the switcher and Create organization", () => {
      const { release } = setup({ isInTeam: false, canManageProjects: true });

      expect(release.tour).toEqual([SWITCHER_STEP, CREATE_ORGANIZATION_STEP]);
    });
  });

  describe("tour targets", () => {
    it.each([
      { stepId: "projects", target: TOUR_TARGET.projectFolder },
      { stepId: "projects", target: TOUR_TARGET.projectsEmpty },
      { stepId: "new-project", target: TOUR_TARGET.newProject },
      { stepId: "switcher", target: TOUR_TARGET.organizationSwitcher },
      { stepId: "create-organization", target: TOUR_TARGET.createOrganization }
    ])("points the $stepId step at the $target control", ({ stepId, target }) => {
      const { release } = setup({ isInTeam: true, canManageProjects: true });
      const control = addToPage(target);

      expect(release.tour.find(step => step.id === stepId)?.findTarget()).toBe(control);
      control.remove();
    });

    it("opens the organization menu so Create organization comes on screen", () => {
      const { release } = setup({ isInTeam: false, canManageProjects: false });
      const switcher = addToPage(TOUR_TARGET.organizationSwitcher);
      const onKeyDown = vi.fn();
      switcher.addEventListener("keydown", onKeyDown);

      release.tour[1].prepare?.();

      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowDown" }));
      switcher.remove();
    });
  });

  function addToPage(target: string) {
    const control = document.createElement("button");
    control.setAttribute("data-tour-target", target);
    document.body.appendChild(control);
    return control;
  }

  function setup(input: { isInTeam: boolean; canManageProjects: boolean }) {
    const showProjects = vi.fn();
    const release = organizationsRelease({ ...input, showProjects });
    return { release, showProjects };
  }
});
