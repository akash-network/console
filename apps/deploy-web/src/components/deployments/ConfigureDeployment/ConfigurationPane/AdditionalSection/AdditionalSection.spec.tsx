import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { ConfigurationLock } from "../configurationLock";
import { AdditionalSection, DEPENDENCIES } from "./AdditionalSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AdditionalSection.name, () => {
  it("renders each additional row for the selected service", () => {
    const RuntimeCard = vi.fn(() => null);
    const EnvironmentVariablesCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { RuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(RuntimeCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(EnvironmentVariablesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("locks the runtime, ports and logs cards but leaves env vars and commands editable while only on-chain fields are locked", () => {
    const RuntimeCard = vi.fn(() => null);
    const EnvironmentVariablesCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ locked: "onchain", dependencies: { RuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(RuntimeCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(EnvironmentVariablesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: false }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: false }), expect.anything());
  });

  it("locks the env-var and command cards too while a create/close/deploy is in flight", () => {
    const EnvironmentVariablesCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);

    setup({ locked: "all", dependencies: { EnvironmentVariablesCard, CommandsCard } });

    expect(EnvironmentVariablesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  it("omits the commands card for a vm service", () => {
    const CommandsCard = vi.fn(() => null);
    const RuntimeCard = vi.fn(() => null);

    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", dependencies: { CommandsCard, RuntimeCard } });

    expect(CommandsCard).not.toHaveBeenCalled();
    expect(RuntimeCard).toHaveBeenCalled();
  });

  it("renders the commands card for a custom service", () => {
    const CommandsCard = vi.fn(() => null);

    setup({ image: "nginx:latest", dependencies: { CommandsCard } });

    expect(CommandsCard).toHaveBeenCalled();
  });

  function setup(input: { serviceIndex?: number; locked?: ConfigurationLock; image?: string; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const serviceIndex = input.serviceIndex ?? 0;
    const base = defaultServiceWithPlacement();
    const placementId = base.placements[0].id;
    const services = Array.from({ length: serviceIndex + 1 }, (_, index) => defaultService(placementId, { title: `service-${index + 1}` }));
    services[serviceIndex] = { ...services[serviceIndex], image: input.image ?? "" };
    const values: SdlBuilderFormValuesType = { ...base, services };

    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <AdditionalSection serviceIndex={serviceIndex} locked={input.locked} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />
      </Wrapper>
    );
  }
});
