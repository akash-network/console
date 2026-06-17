import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, HardwareSection } from "./HardwareSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(HardwareSection.name, () => {
  it("renders each hardware row for the selected service", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard } });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  it("forwards the locked state to every hardware card", () => {
    const PresetsCard = vi.fn(() => null);
    const GpuCard = vi.fn(() => null);
    const ComputeResourcesCard = vi.fn(() => null);
    const PersistentStorageCard = vi.fn(() => null);
    const RamStorageCard = vi.fn(() => null);

    setup({ locked: true, dependencies: { PresetsCard, GpuCard, ComputeResourcesCard, PersistentStorageCard, RamStorageCard } });

    expect(PresetsCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(GpuCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(PersistentStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
    expect(RamStorageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<HardwareSection serviceIndex={input.serviceIndex ?? 0} locked={input.locked} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
