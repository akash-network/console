import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { whatsNewViewAtom } from "@src/store/whatsNewStore";
import type { OrganizationOutput, OrganizationRole, OrganizationType } from "@src/types/organization";
import { ORGANIZATIONS_RELEASE_ID } from "../organizationsRelease";
import type { DEPENDENCIES } from "./WhatsNewHost";
import { WhatsNewHost } from "./WhatsNewHost";

import { act, render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(WhatsNewHost.name, () => {
  it("renders nothing while organizations are off", () => {
    const { WhatsNewModal, SpotlightTour } = setup({ isOrganizationsEnabled: false });

    expect(WhatsNewModal).not.toHaveBeenCalled();
    expect(SpotlightTour).not.toHaveBeenCalled();
  });

  it("keeps the announcement and the tour closed until something opens them", () => {
    const { modalProps, tourProps } = setup();

    expect(modalProps()).toMatchObject({ isOpen: false, isHandingOffToTour: false });
    expect(tourProps()).toMatchObject({ isOpen: false });
  });

  it("opens the announcement once it is requested", () => {
    const { store, modalProps } = setup();

    act(() => store.set(whatsNewViewAtom, "announcement"));

    expect(modalProps()).toMatchObject({ isOpen: true, isHandingOffToTour: false });
  });

  it.each(["team", "personal"] satisfies OrganizationType[])(
    "tells a %s organization its deployments now live in projects, and tours its owner through them",
    type => {
      const { modalProps, tourProps } = setup({ organizationType: type, role: "owner" });

      expect(modalProps().release.slides[0].title).toBe("Your deployments now live in projects");
      expect(tourProps().steps.map(step => step.id)).toEqual(["projects", "new-project", "switcher", "create-organization"]);
    }
  );

  it("leaves New project out of a member's tour", () => {
    const { tourProps } = setup({ role: "member" });

    expect(tourProps().steps.map(step => step.id)).toEqual(["projects", "switcher", "create-organization"]);
  });

  it("leaves New project out while the organization is not known yet", () => {
    const { tourProps } = setup({ role: undefined });

    expect(tourProps().steps.map(step => step.id)).toEqual(["projects", "switcher", "create-organization"]);
  });

  it("clears the request when the announcement closes", () => {
    const { store, modalProps } = setup({ view: "announcement" });

    act(() => modalProps().onClose());

    expect(store.get(whatsNewViewAtom)).toBeNull();
    expect(modalProps()).toMatchObject({ isOpen: false, isHandingOffToTour: false });
  });

  it("hands over from the announcement card to the tour", () => {
    const { store, modalProps, tourProps, analyticsService } = setup({ view: "announcement" });
    const cardBox = { x: 10, y: 20, width: 580, height: 600 };

    act(() => modalProps().onTryIt(cardBox));

    expect(store.get(whatsNewViewAtom)).toBe("tour");
    expect(modalProps()).toMatchObject({ isOpen: false, isHandingOffToTour: true });
    expect(tourProps()).toMatchObject({ isOpen: true, origin: cardBox });
    expect(analyticsService.track).toHaveBeenCalledWith("whats_new_tour_started", { category: "user", release: ORGANIZATIONS_RELEASE_ID, steps: 4 });
  });

  it.each(["team", "personal"] satisfies OrganizationType[])("starts a %s organization's tour on the Projects page", type => {
    const { modalProps, push } = setup({ view: "announcement", organizationType: type, pathname: "/deployments" });

    act(() => modalProps().onTryIt(null));

    expect(push).toHaveBeenCalledExactlyOnceWith("/projects");
  });

  it("stays put when the tour starts on the Projects page", () => {
    const { modalProps, push } = setup({ view: "announcement", pathname: "/projects" });

    act(() => modalProps().onTryIt(null));

    expect(push).not.toHaveBeenCalled();
  });

  it("closes the tour and records how far it got", () => {
    const { store, tourProps, analyticsService } = setup({ view: "tour" });

    act(() => tourProps().onEnd({ stepId: "switcher", isCompleted: false }));

    expect(store.get(whatsNewViewAtom)).toBeNull();
    expect(analyticsService.track).toHaveBeenCalledWith("whats_new_tour_ended", {
      category: "user",
      release: ORGANIZATIONS_RELEASE_ID,
      step: "switcher",
      completed: false
    });
  });

  function setup(
    input: {
      isOrganizationsEnabled?: boolean;
      organizationType?: OrganizationType;
      role?: OrganizationRole;
      pathname?: string;
      view?: "announcement" | "tour";
    } = {}
  ) {
    const store = createStore();
    store.set(whatsNewViewAtom, input.view ?? null);
    const analyticsService = mock<AnalyticsService>();
    const push = vi.fn();
    const WhatsNewModal = vi.fn<typeof DEPENDENCIES.WhatsNewModal>(() => <></>);
    const SpotlightTour = vi.fn<typeof DEPENDENCIES.SpotlightTour>(() => null);
    const role = "role" in input ? input.role : "owner";
    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "organizations" && (input.isOrganizationsEnabled ?? true),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: role ? mock<OrganizationOutput>({ role, type: input.organizationType ?? "team" }) : undefined
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      usePathname: () => input.pathname ?? "/deployments",
      WhatsNewModal,
      SpotlightTour
    };

    render(
      <JotaiProvider store={store}>
        <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
          <WhatsNewHost dependencies={dependencies} />
        </TestContainerProvider>
      </JotaiProvider>
    );

    const modalProps = () => WhatsNewModal.mock.lastCall![0];
    const tourProps = () => SpotlightTour.mock.lastCall![0];

    return { store, analyticsService, push, WhatsNewModal, SpotlightTour, modalProps, tourProps };
  }
});
