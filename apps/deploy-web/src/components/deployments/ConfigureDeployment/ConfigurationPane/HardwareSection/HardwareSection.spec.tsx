import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, HardwareSection } from "./HardwareSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(HardwareSection.name, () => {
  it("renders each hardware row for the selected service", () => {
    const ComputeResourcesCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { ComputeResourcesCard } });

    expect(ComputeResourcesCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<HardwareSection serviceIndex={input.serviceIndex ?? 0} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
