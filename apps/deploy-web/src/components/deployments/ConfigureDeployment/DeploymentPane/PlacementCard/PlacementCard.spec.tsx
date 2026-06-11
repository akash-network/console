import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
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

  function setup(input: { serviceTitles: string[]; canRemove?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
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

    render(
      <Wrapper>
        <PlacementCard
          placement={placement}
          placementIndex={0}
          services={services}
          selectedServiceId={null}
          canRemove={input.canRemove ?? true}
          canRemoveService={true}
          onSelectService={onSelectService}
          onAddService={onAddService}
          onRemoveService={onRemoveService}
          onRemove={onRemove}
          dependencies={MockComponents(DEPENDENCIES, input.dependencies)}
        />
      </Wrapper>
    );

    return { onAddService, onRemove, onSelectService, onRemoveService };
  }
});
