import type { TourStep } from "./SpotlightTour/SpotlightTour";
import type { SceneId } from "./WhatsNewScenes/scenes";
import { findTourTarget, openOrganizationMenu, TOUR_TARGET } from "./tourTargets";

export type WhatsNewSlide = { sceneId: SceneId; title: string; body: string };

export type WhatsNewRelease = { id: string; name: string; slides: WhatsNewSlide[]; tour: TourStep[] };

export const ORGANIZATIONS_RELEASE_ID = "orgs-projects-2026-10";

type Audience = {
  /** Projects only exist in team organizations, so a personal account is told about them and toured through the switcher instead. */
  isInTeam: boolean;
  canManageProjects: boolean;
  showProjects: () => void;
};

export function organizationsRelease({ isInTeam, canManageProjects, showProjects }: Audience): WhatsNewRelease {
  const projectSteps = isInTeam ? [projectsStep(showProjects), ...(canManageProjects ? [newProjectStep(showProjects)] : [])] : [];

  return {
    id: ORGANIZATIONS_RELEASE_ID,
    name: "Organizations & Projects",
    slides: [
      isInTeam
        ? {
            sceneId: "projects",
            title: "Your deployments now live in projects",
            body: "A project groups the deployments behind one app or service. Hover a folder on the Projects page to see what’s running inside."
          }
        : {
            sceneId: "projects",
            title: "Projects group your team’s deployments",
            body: "In an organization, a project groups the deployments behind one app or service."
          },
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
    ],
    tour: [...projectSteps, SWITCHER_STEP, CREATE_ORGANIZATION_STEP]
  };
}

function projectsStep(showProjects: () => void): TourStep {
  return {
    id: "projects",
    title: "Your deployments now live in projects",
    body: "Each folder is a project. It groups the deployments behind one app or service.",
    hint: "Hover the folder to see what’s inside",
    hintIcon: "hover",
    placement: "right",
    padding: 8,
    radius: 18,
    onTargetClick: "swallow",
    findTarget: () => findTourTarget([TOUR_TARGET.projectFolder, TOUR_TARGET.projectsEmpty]),
    prepare: showProjects
  };
}

function newProjectStep(showProjects: () => void): TourStep {
  return {
    id: "new-project",
    title: "Start a project for each app",
    body: "Name it after the app or service, like checkout-api, and add a short description.",
    hint: "Try it: click New project",
    hintIcon: "click",
    placement: "bottom",
    padding: 6,
    radius: 12,
    onTargetClick: "advance",
    findTarget: () => findTourTarget([TOUR_TARGET.newProject]),
    prepare: showProjects
  };
}

const SWITCHER_STEP: TourStep = {
  id: "switcher",
  title: "Switch between accounts",
  body: "Your personal account and every organization you belong to live in this menu.",
  hint: "Click the switcher to open it",
  hintIcon: "click",
  placement: "bottom",
  padding: 5,
  radius: 13,
  onTargetClick: "advance",
  findTarget: () => findTourTarget([TOUR_TARGET.organizationSwitcher])
};

const CREATE_ORGANIZATION_STEP: TourStep = {
  id: "create-organization",
  title: "Bring your team",
  body: "Create an organization to share projects, deployments and billing with your team.",
  hint: "Click Create organization to set one up",
  hintIcon: "click",
  placement: "left",
  padding: 3,
  radius: 10,
  onTargetClick: "advance",
  findTarget: () => findTourTarget([TOUR_TARGET.createOrganization]),
  prepare: () => openOrganizationMenu()
};
