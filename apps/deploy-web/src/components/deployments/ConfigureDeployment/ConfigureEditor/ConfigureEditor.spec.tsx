import type { ComponentProps, PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { ConfigurationLock } from "../ConfigurationPane/configurationLock";
import type { PendingClose } from "../useDeploymentFlow/useDeploymentFlow";
import type { IndexedService, PlacementManager } from "../usePlacementManager/usePlacementManager";
import type { PlacementTabs } from "./PlacementTabs/PlacementTabs";
import type { ServiceStack } from "./ServiceStack/ServiceStack";
import { ConfigureEditor, DEPENDENCIES } from "./ConfigureEditor";

import { act, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(ConfigureEditor.name, () => {
  it("shows the panel heading with the toolbar", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Deployment" })).toBeInTheDocument();
    expect(screen.getByText("toolbar")).toBeInTheDocument();
  });

  it.each<[string, { locked?: ConfigurationLock; pendingClose?: PendingClose }, boolean, boolean]>([
    ["the lock banner while locked", { locked: "onchain", pendingClose: { dseq: "1", failed: false } }, true, false],
    ["the background close while a previous deployment closes", { pendingClose: { dseq: "1", failed: false } }, false, true],
    ["no banner otherwise", {}, false, false]
  ])("shows %s", (_, input, showsLock, showsClose) => {
    const { PaneLockBanner, BackgroundCloseBanner } = setup(input);

    expect(PaneLockBanner.mock.calls.length > 0).toBe(showsLock);
    expect(BackgroundCloseBanner.mock.calls.length > 0).toBe(showsClose);
  });

  it("hands every placement to the tabs with its status and the active one", () => {
    const { tabsProps } = setup({ activePlacementId: "p2" });

    expect(tabsProps()).toMatchObject({
      activePlacementId: "p2",
      canRemove: true,
      locked: false,
      placements: [
        { id: "p1", name: "placement-1", status: "complete", hasError: false },
        { id: "p2", name: "placement-2", status: "incomplete", hasError: false }
      ]
    });
  });

  it("marks a placement tab when one of its services has an error", () => {
    const { tabsProps, form } = setup({});

    act(() => form().setError("services.2.image", { type: "manual", message: "Image is required" }));

    expect(tabsProps().placements.map(tab => tab.hasError)).toEqual([false, true]);
  });

  it("marks a placement tab when the placement itself has an error", () => {
    const { tabsProps, form } = setup({});

    act(() => form().setError("placements.0.name", { type: "manual", message: "Name must be unique" }));

    expect(tabsProps().placements.map(tab => tab.hasError)).toEqual([true, false]);
  });

  it("selects the first service of a placement picked from the tabs", () => {
    const { tabsProps, onSelectService } = setup({});

    act(() => tabsProps().onSelectPlacement("p2"));

    expect(onSelectService).toHaveBeenCalledWith("db");
  });

  it("selects the first service of a placement it adds", () => {
    const { tabsProps, onSelectService, manager } = setup({});
    manager.addPlacement.mockReturnValue("new-service");

    act(() => tabsProps().onAddPlacement());

    expect(onSelectService).toHaveBeenCalledWith("new-service");
  });

  it("removes a placement through the placement manager", () => {
    const { tabsProps, manager } = setup({});

    act(() => tabsProps().onRemovePlacement("p2"));

    expect(manager.removePlacement).toHaveBeenCalledWith("p2");
  });

  it("shows the fields of the active placement", () => {
    const { PlacementFields } = setup({ activePlacementId: "p1" });

    expect(PlacementFields).toHaveBeenCalledWith(expect.objectContaining({ placementIndex: 0, serviceCount: 2, locked: false }), expect.anything());
  });

  it("unmounts the placement fields while the selection is cleared around a splice", () => {
    const { PlacementFields } = setup({ selectedServiceId: "" });

    expect(PlacementFields).not.toHaveBeenCalled();
  });

  it("stacks the active placement's services", () => {
    const { stackProps } = setup({ activePlacementId: "p1", locked: "onchain" });

    expect(stackProps()).toMatchObject({ selectedServiceId: "web", canRemoveService: true, locked: "onchain" });
    expect(stackProps().services.map(({ service }) => service.id)).toEqual(["web", "api"]);
  });

  it("adds a service to the active placement and selects it", () => {
    const { stackProps, onSelectService, manager } = setup({ activePlacementId: "p1" });
    manager.addService.mockReturnValue("worker");

    let addedServiceId = "";
    act(() => {
      addedServiceId = stackProps().onAddService();
    });

    expect(manager.addService).toHaveBeenCalledWith("p1");
    expect(onSelectService).toHaveBeenCalledWith("worker");
    expect(addedServiceId).toBe("worker");
  });

  it("locks the name and the reclamation window while locked", () => {
    const { DeploymentNameField, ReclamationSection } = setup({ locked: "all" });

    expect(DeploymentNameField).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }), expect.anything());
    expect(ReclamationSection).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  function setup(input: { selectedServiceId?: string; activePlacementId?: string; locked?: ConfigurationLock; pendingClose?: PendingClose }) {
    const placements = [placement("p1", "placement-1"), placement("p2", "placement-2")];
    const servicesByPlacement: Record<string, IndexedService[]> = {
      p1: [indexed("web", "p1", 0), indexed("api", "p1", 1)],
      p2: [indexed("db", "p2", 2)]
    };
    const manager = mock<PlacementManager>({
      placements,
      canRemovePlacement: true,
      getPlacementServices: vi.fn((placementId: string) => servicesByPlacement[placementId] ?? []),
      canRemoveServiceFrom: vi.fn((placementId: string) => (servicesByPlacement[placementId] ?? []).length > 1)
    });
    const onSelectService = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      usePlacementManagerContext: () => manager,
      useConfigurationStatus: () => ({ isServiceConfigured: () => true, placementStatus: placementId => (placementId === "p1" ? "complete" : "incomplete") })
    });
    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({
        defaultValues: {
          placements,
          services: Object.values(servicesByPlacement)
            .flat()
            .map(({ service }) => service)
        }
      });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ConfigureEditor
          selectedServiceId={input.selectedServiceId ?? "web"}
          activePlacementId={input.activePlacementId ?? "p1"}
          onSelectService={onSelectService}
          locked={input.locked}
          deploymentName="my-app"
          onDeploymentNameChange={vi.fn()}
          pendingClose={input.pendingClose ?? null}
          onRetryClose={vi.fn()}
          onCancelAndEdit={vi.fn()}
          toolbar={<span>toolbar</span>}
          dependencies={dependencies}
        />
      </Wrapper>
    );

    return {
      ...dependencies,
      manager,
      onSelectService,
      form: () => form as UseFormReturn<SdlBuilderFormValuesType>,
      tabsProps: () => dependencies.PlacementTabs.mock.calls.at(-1)?.[0] as ComponentProps<typeof PlacementTabs>,
      stackProps: () => dependencies.ServiceStack.mock.calls.at(-1)?.[0] as ComponentProps<typeof ServiceStack>
    };
  }

  function placement(id: string, name: string): PlacementType {
    return mock<PlacementType>({ id, name });
  }

  function indexed(id: string, placementId: string, index: number): IndexedService {
    return { service: mock<ServiceType>({ id, title: id, placementId }), index };
  }
});
