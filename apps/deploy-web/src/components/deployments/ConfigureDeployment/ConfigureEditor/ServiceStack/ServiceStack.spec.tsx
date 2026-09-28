import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import type { ServiceCard } from "../ServiceCard/ServiceCard";
import { ServiceStack } from "./ServiceStack";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type CardProps = ComponentProps<typeof ServiceCard>;

describe(ServiceStack.name, () => {
  it("renders a card per service with the index the placement manager gave it", () => {
    const { cardProps } = setup({});

    expect(cardProps("web")).toMatchObject({ serviceIndex: 0 });
    expect(cardProps("api")).toMatchObject({ serviceIndex: 2 });
  });

  it("expands the first service's card by default", () => {
    const { cardProps } = setup({ selectedServiceId: "api" });

    expect(cardProps("web").isExpanded).toBe(true);
  });

  it("expands the card of the service that gets selected", () => {
    const { cardProps, rerender } = setup({ selectedServiceId: "web" });
    expect(cardProps("api").isExpanded).toBe(false);

    rerender({ selectedServiceId: "api" });

    expect(cardProps("api").isExpanded).toBe(true);
  });

  it("selects a service when its card is expanded", () => {
    const { cardProps, onSelectService } = setup({ selectedServiceId: "web" });

    act(() => cardProps("api").onExpandedChange(true));

    expect(onSelectService).toHaveBeenCalledWith("api");
    expect(cardProps("api").isExpanded).toBe(true);
  });

  it("collapses a card without changing the selection", () => {
    const { cardProps, onSelectService } = setup({ selectedServiceId: "web" });

    act(() => cardProps("web").onExpandedChange(false));

    expect(cardProps("web").isExpanded).toBe(false);
    expect(onSelectService).not.toHaveBeenCalled();
  });

  it("renders no card while the selection is cleared around a splice", () => {
    const { ServiceCard } = setup({ selectedServiceId: "" });

    expect(ServiceCard).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add service" })).not.toBeInTheDocument();
  });

  it("adds a service and scrolls its card into view once it is listed", async () => {
    const { onAddService, cardProps, rerender } = setup({ selectedServiceId: "web" });

    await userEvent.click(screen.getByRole("button", { name: "Add service" }));
    rerender({ selectedServiceId: "db", services: [...defaultServices(), { service: service("db"), index: 3 }] });

    expect(onAddService).toHaveBeenCalled();
    expect(cardProps("db")).toMatchObject({ shouldScrollIntoView: true, isExpanded: true });
    expect(cardProps("web").shouldScrollIntoView).toBe(false);
  });

  it("removes the service of a card", () => {
    const { cardProps, onRemoveService } = setup({});

    act(() => cardProps("api").onRemove());

    expect(onRemoveService).toHaveBeenCalledWith("api");
  });

  it("hands each card its configuration status, removal rule and lock", () => {
    const { cardProps } = setup({ canRemoveService: false, locked: "onchain" });

    expect(cardProps("web")).toMatchObject({ isConfigured: true, canRemove: false, locked: "onchain" });
    expect(cardProps("api")).toMatchObject({ isConfigured: false });
  });

  it("disables adding a service while locked", () => {
    setup({ locked: "all" });

    expect(screen.getByRole("button", { name: "Add service" })).toBeDisabled();
  });

  function setup(input: { selectedServiceId?: string; canRemoveService?: boolean; locked?: CardProps["locked"] }) {
    const ServiceCard = vi.fn((props: CardProps) => <div>{props.service.title}</div>);
    const onSelectService = vi.fn();
    const onRemoveService = vi.fn();
    const onAddService = vi.fn(() => "db");
    const stack = (overrides: { selectedServiceId?: string; services?: ComponentProps<typeof ServiceStack>["services"] }) => (
      <ServiceStack
        services={overrides.services ?? defaultServices()}
        selectedServiceId={overrides.selectedServiceId ?? input.selectedServiceId ?? "web"}
        onSelectService={onSelectService}
        isServiceConfigured={serviceId => serviceId === "web"}
        canRemoveService={input.canRemoveService ?? true}
        onRemoveService={onRemoveService}
        onAddService={onAddService}
        locked={input.locked}
        dependencies={{ ServiceCard }}
      />
    );
    const rendered = render(stack({}));

    return {
      ServiceCard,
      onSelectService,
      onRemoveService,
      onAddService,
      rerender: (overrides: Parameters<typeof stack>[0]) => rendered.rerender(stack(overrides)),
      cardProps: (serviceId: string) => ServiceCard.mock.calls.filter(([props]) => props.service.id === serviceId).at(-1)?.[0] as CardProps
    };
  }

  function defaultServices() {
    return [
      { service: service("web"), index: 0 },
      { service: service("api"), index: 2 }
    ];
  }

  function service(id: string): ServiceType {
    return { ...defaultService("placement-1", { title: id }), id };
  }
});
