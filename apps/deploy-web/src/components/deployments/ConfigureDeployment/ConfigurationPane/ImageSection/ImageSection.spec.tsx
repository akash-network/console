import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, ImageSection } from "./ImageSection";

import { render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(ImageSection.name, () => {
  it("renders the image card for the selected service index", () => {
    const ImageCard = vi.fn(() => null);

    setup({ serviceIndex: 2, dependencies: { ImageCard } });

    expect(ImageCard).toHaveBeenCalledWith(expect.objectContaining({ serviceIndex: 2 }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<ImageSection serviceIndex={input.serviceIndex ?? 0} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
