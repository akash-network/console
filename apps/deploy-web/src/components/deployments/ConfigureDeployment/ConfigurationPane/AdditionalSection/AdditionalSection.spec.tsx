import { describe, expect, it, vi } from "vitest";

import { AdditionalSection, DEPENDENCIES } from "./AdditionalSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AdditionalSection.name, () => {
  it("renders each additional row for the selected service", () => {
    const ImageRuntimeCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { ImageRuntimeCard } });

    expect(ImageRuntimeCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<AdditionalSection serviceIndex={input.serviceIndex ?? 0} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
