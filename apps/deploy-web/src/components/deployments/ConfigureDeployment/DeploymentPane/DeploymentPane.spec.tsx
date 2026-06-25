import type { ComponentProps, FC, PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES as PLACEMENT_CARD_DEPENDENCIES, PlacementCard } from "./PlacementCard/PlacementCard";
import { DEPENDENCIES, DeploymentPane } from "./DeploymentPane";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentPane", () => {
  it("renders expanded with the title and a hide button by default", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "1. Deployment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide deployment pane" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show deployment pane" })).not.toBeInTheDocument();
  });

  it("minimizes when the hide button is clicked", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: "Hide deployment pane" }));

    expect(screen.queryByRole("heading", { name: "1. Deployment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide deployment pane" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show deployment pane" })).toBeInTheDocument();
  });

  it("restores the expanded view when the show button is clicked", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: "Hide deployment pane" }));
    await userEvent.click(screen.getByRole("button", { name: "Show deployment pane" }));

    expect(screen.getByRole("heading", { name: "1. Deployment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide deployment pane" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show deployment pane" })).not.toBeInTheDocument();
  });

  it("renders a card per placement", () => {
    const PlacementCard = vi.fn(() => null);
    const placements = [defaultPlacement({ name: "placement-1" }), defaultPlacement({ name: "placement-2" })];
    setup({ placements, dependencies: { PlacementCard } });

    expect(PlacementCard).toHaveBeenCalledTimes(2);
  });

  it("appends a placement", async () => {
    const { manager } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Add Placement" }));

    expect(manager.addPlacement).toHaveBeenCalled();
  });

  it("selects the newly added service", () => {
    const PlacementCardMock = vi.fn<(props: ComponentProps<typeof PlacementCard>) => null>(() => null);
    const onSelectService = vi.fn();
    const { manager } = setup({ onSelectService, dependencies: { PlacementCard: PlacementCardMock } });
    manager.addService.mockReturnValue("new-service-id");

    PlacementCardMock.mock.calls[0][0].onAddService();

    expect(manager.addService).toHaveBeenCalled();
    expect(onSelectService).toHaveBeenCalledWith("new-service-id");
  });

  it("renders the IP endpoints section", () => {
    const IpEndpointsSection = vi.fn(() => null);
    setup({ dependencies: { IpEndpointsSection } });

    expect(IpEndpointsSection).toHaveBeenCalled();
  });

  it("shows the lock banner and disables adding placements while locked", async () => {
    const onCancelAndEdit = vi.fn();
    setup({ locked: true, onCancelAndEdit });

    expect(screen.getByRole("button", { name: "Add Placement" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /cancel and edit/i }));
    expect(onCancelAndEdit).toHaveBeenCalled();
  });

  it("keeps placements selectable but blocks removing them while locked", () => {
    const PlacementCard = vi.fn(() => null);
    setup({ locked: true, dependencies: { PlacementCard } });

    expect(PlacementCard).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true, canRemove: false, canRemoveService: false, onSelectService: expect.any(Function) }),
      expect.anything()
    );
  });

  function setup(input: {
    placements?: ReturnType<typeof defaultPlacement>[];
    onSelectService?: (serviceId: string) => void;
    locked?: boolean;
    onCancelAndEdit?: () => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const placements = input.placements ?? [defaultPlacement({ name: "placement-1" })];
    const manager = mock<ReturnType<typeof DEPENDENCIES.usePlacementManager>>({
      placements,
      canRemoveService: false,
      canRemovePlacement: false,
      getPlacementServices: vi.fn(() => [{ service: defaultService(placements[0].id, { title: "service-1" }), index: 0 }])
    });
    const usePlacementManager: typeof DEPENDENCIES.usePlacementManager = () => manager;

    render(
      <TooltipProvider>
        <DeploymentPane
          selectedServiceId=""
          onSelectService={input.onSelectService ?? vi.fn()}
          locked={input.locked}
          onCancelAndEdit={input.onCancelAndEdit}
          dependencies={MockComponents(DEPENDENCIES, { usePlacementManager, ...input.dependencies })}
        />
      </TooltipProvider>
    );

    return { manager };
  }
});

describe("DeploymentPane placement management", () => {
  it("keeps form values consistent when a populated placement is removed after edits", async () => {
    const { getForm } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Add Placement" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Add service" })[1]);
    await userEvent.click(screen.getAllByRole("button", { name: "Add service" })[1]);
    await userEvent.click(screen.getAllByRole("button", { name: "Remove placement" })[0]);

    const values = getForm().getValues();
    expect(values.placements).toHaveLength(1);
    expect(values.placements[0].name).toBe("placement-1");
    expect(values.services).toHaveLength(3);
    expect(values.services.map(service => service.title)).toEqual(["service-2", "service-3", "service-4"]);
    expect(values.services.every(service => service.placementId === values.placements[0].id)).toBe(true);
  });

  function setup() {
    const RegionSelectStub: typeof PLACEMENT_CARD_DEPENDENCIES.RegionSelect = () => null;
    const PlacementCardWithStubbedRegion: typeof PlacementCard = props => (
      <PlacementCard {...props} dependencies={{ ...PLACEMENT_CARD_DEPENDENCIES, RegionSelect: RegionSelectStub }} />
    );
    let form!: UseFormReturn<SdlBuilderFormValuesType>;
    const Wrapper: FC<PropsWithChildren> = ({ children }) => {
      const f = useForm<SdlBuilderFormValuesType>({ defaultValues: defaultServiceWithPlacement() });
      form = f;
      return (
        <TooltipProvider>
          <FormProvider {...f}>{children}</FormProvider>
        </TooltipProvider>
      );
    };

    render(
      <Wrapper>
        <DeploymentPane selectedServiceId="" onSelectService={vi.fn()} dependencies={{ ...DEPENDENCIES, PlacementCard: PlacementCardWithStubbedRegion }} />
      </Wrapper>
    );

    return { getForm: () => form };
  }
});
