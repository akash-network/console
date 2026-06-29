import { describe, expect, it, vi } from "vitest";

import { AdditionalSection, DEPENDENCIES } from "./AdditionalSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AdditionalSection.name, () => {
  it("renders each additional row for the selected service", () => {
    const ImageRuntimeCard = vi.fn(() => null);
    const EnvironmentVariablesCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { ImageRuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(ImageRuntimeCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(EnvironmentVariablesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("forwards the locked state to every additional card", () => {
    const ImageRuntimeCard = vi.fn(() => null);
    const EnvironmentVariablesCard = vi.fn(() => null);
    const CommandsCard = vi.fn(() => null);
    const ExposePortsCard = vi.fn(() => null);
    const LogsCard = vi.fn(() => null);

    setup({ locked: true, dependencies: { ImageRuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard } });

    expect(ImageRuntimeCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(EnvironmentVariablesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(CommandsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ExposePortsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(LogsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<AdditionalSection serviceIndex={input.serviceIndex ?? 0} locked={input.locked} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
