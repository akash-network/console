import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { ConfigurationLock } from "../configurationLock";
import { AdditionalSection, DEPENDENCIES } from "./AdditionalSection";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AdditionalSection.name, () => {
  it("renders each additional row for the selected service", () => {
    const ReplicasCard = vi.fn(() => null);
    const VariablesAndSecretsCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { ReplicasCard, VariablesAndSecretsCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(ReplicasCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(VariablesAndSecretsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("orders the cards ports, variables, commands, logs, then replicas", () => {
    setup({
      image: "nginx:latest",
      dependencies: {
        ExposePortsCard: () => <p>ports card</p>,
        VariablesAndSecretsCard: () => <p>variables card</p>,
        CommandsCard: () => <p>commands card</p>,
        LogsCard: () => <p>logs card</p>,
        ReplicasCard: () => <p>replicas card</p>
      }
    });

    expect(screen.getAllByText(/ card$/).map(card => card.textContent)).toEqual([
      "ports card",
      "variables card",
      "commands card",
      "logs card",
      "replicas card"
    ]);
  });

  it("locks the replicas, ports and logs cards but leaves env vars and commands editable while only on-chain fields are locked", () => {
    const ReplicasCard = vi.fn(() => null);
    const VariablesAndSecretsCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ locked: "onchain", dependencies: { ReplicasCard, VariablesAndSecretsCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(ReplicasCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(VariablesAndSecretsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: false }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: false }), expect.anything());
  });

  it("locks the env-var and command cards too while a create/close/deploy is in flight", () => {
    const VariablesAndSecretsCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);

    setup({ locked: "all", dependencies: { VariablesAndSecretsCard, CommandsCard } });

    expect(VariablesAndSecretsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  it("omits the commands and replicas cards for a vm service", () => {
    const CommandsCard = vi.fn(() => null);
    const ReplicasCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);

    setup({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:2", dependencies: { CommandsCard, ReplicasCard, ExposePortsCard } });

    expect(CommandsCard).not.toHaveBeenCalled();
    expect(ReplicasCard).not.toHaveBeenCalled();
    expect(ExposePortsCard).toHaveBeenCalled();
  });

  it("renders the commands and replicas cards for a custom service", () => {
    const CommandsCard = vi.fn(() => null);
    const ReplicasCard = vi.fn(() => null);

    setup({ image: "nginx:latest", dependencies: { CommandsCard, ReplicasCard } });

    expect(CommandsCard).toHaveBeenCalled();
    expect(ReplicasCard).toHaveBeenCalled();
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
