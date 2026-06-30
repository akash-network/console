import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import type { ConfigStatus } from "../ConfigStatusIcon/ConfigStatusIcon";
import type { PlacementSelectionState } from "../PlacementSelectionBadge/PlacementSelectionBadge";
import { DEPENDENCIES, PlacementCard } from "./PlacementCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("PlacementCard", () => {
  it("renders a row per service in the placement", () => {
    const ServiceRow = vi.fn(() => null);
    setup({ serviceTitles: ["web", "api"], dependencies: { ServiceRow } });

    expect(ServiceRow).toHaveBeenCalledTimes(2);
  });

  it("adds a service to this placement", async () => {
    const { onAddService } = setup({ serviceTitles: ["web"] });

    await userEvent.click(screen.getByRole("button", { name: "Add service" }));

    expect(onAddService).toHaveBeenCalled();
  });

  it("removes the placement", async () => {
    const { onRemove } = setup({ serviceTitles: ["web"], canRemove: true });

    await userEvent.click(screen.getByRole("button", { name: "Remove placement" }));

    expect(onRemove).toHaveBeenCalled();
  });

  it("hides placement removal when not allowed", () => {
    setup({ serviceTitles: ["web"], canRemove: false });

    expect(screen.queryByRole("button", { name: "Remove placement" })).not.toBeInTheDocument();
  });

  it("shows the complete marker when the placement aggregates as complete", () => {
    setup({ serviceTitles: ["web"], status: "complete" });

    expect(screen.getByRole("img", { name: "Complete" })).toBeInTheDocument();
  });

  it("shows the partial marker when only some services are configured", () => {
    setup({ serviceTitles: ["web"], status: "partial" });

    expect(screen.getByRole("img", { name: "Partial" })).toBeInTheDocument();
  });

  it("shows the incomplete marker when no services are configured", () => {
    setup({ serviceTitles: ["web"], status: "incomplete" });

    expect(screen.getByRole("img", { name: "Incomplete" })).toBeInTheDocument();
  });

  it("renders the placement name error below the header", () => {
    setup({ serviceTitles: ["web"], error: "Names must start with a lower case letter." });

    expect(screen.getByText("Names must start with a lower case letter.")).toBeInTheDocument();
  });

  it("selects the placement's first service when the placement card is clicked", async () => {
    const { onSelectService, services, container } = setup({ serviceTitles: ["web", "api"] });

    await userEvent.click(container.firstChild as Element);

    expect(onSelectService).toHaveBeenCalledWith(services[0].service.id);
  });

  it("selects the clicked service rather than the placement's first", async () => {
    const { onSelectService, services } = setup({ serviceTitles: ["web", "api"], dependencies: { ServiceRow: DEPENDENCIES.ServiceRow } });

    await userEvent.click(screen.getByRole("button", { name: "Select api" }));

    expect(onSelectService).toHaveBeenCalledWith(services[1].service.id);
    expect(onSelectService).not.toHaveBeenCalledWith(services[0].service.id);
  });

  it("disables adding a service but keeps the placement selectable while locked", async () => {
    const { onSelectService, services, container } = setup({ serviceTitles: ["web"], locked: true });

    expect(screen.getByRole("button", { name: "Add service" })).toBeDisabled();
    await userEvent.click(container.firstChild as Element);
    expect(onSelectService).toHaveBeenCalledWith(services[0].service.id);
  });

  it("disables the placement name and region controls while locked", () => {
    setup({ serviceTitles: ["web"], locked: true });

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2);
    groups.forEach(group => expect(group).toBeDisabled());
  });

  it("keeps the placement name and region controls enabled while unlocked", () => {
    setup({ serviceTitles: ["web"] });

    screen.getAllByRole("group").forEach(group => expect(group).toBeEnabled());
  });

  it("disables the region select while locked", () => {
    const RegionSelect = vi.fn<typeof DEPENDENCIES.RegionSelect>(() => null);
    setup({ serviceTitles: ["web"], locked: true, dependencies: { RegionSelect } });

    expect(RegionSelect).toHaveBeenCalled();
    expect(RegionSelect.mock.calls[0][0]).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("shows the DONE badge when the placement has a selection", () => {
    setup({ serviceTitles: ["web"], selectionState: "done" });
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  function setup(input: {
    serviceTitles: string[];
    canRemove?: boolean;
    status?: ConfigStatus;
    error?: string;
    locked?: boolean;
    selectionState?: PlacementSelectionState;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const placement = defaultPlacement({ name: "placement-1" });
    const services = input.serviceTitles.map((title, index) => ({
      service: defaultService(placement.id, { title }),
      index
    }));
    const values: SdlBuilderFormValuesType = { placements: [placement], services: services.map(({ service }) => service), endpoints: [] };
    const onAddService = vi.fn();
    const onRemove = vi.fn();
    const onSelectService = vi.fn();
    const onRemoveService = vi.fn();
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    const { container } = render(
      <Wrapper>
        <PlacementCard
          placement={placement}
          placementIndex={0}
          services={services}
          selectedServiceId=""
          canRemove={input.canRemove ?? true}
          canRemoveService={true}
          locked={input.locked}
          selectionState={input.selectionState}
          onSelectService={onSelectService}
          onAddService={onAddService}
          onRemoveService={onRemoveService}
          onRemove={onRemove}
          dependencies={MockComponents(DEPENDENCIES, {
            usePlacementStatus: () => input.status ?? "incomplete",
            useFieldError: () => ({ error: input.error }),
            ...input.dependencies
          })}
        />
      </Wrapper>
    );

    return { onAddService, onRemove, onSelectService, onRemoveService, services, container };
  }
});
