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

  it("locks the image card while locked", () => {
    const ImageCard = vi.fn(() => null);

    setup({ locked: true, dependencies: { ImageCard } });

    expect(ImageCard).toHaveBeenCalledWith(expect.objectContaining({ locked: true }), expect.anything());
  });

  function setup(input: { serviceIndex?: number; locked?: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    render(<ImageSection serviceIndex={input.serviceIndex ?? 0} locked={input.locked} dependencies={MockComponents(DEPENDENCIES, input.dependencies)} />);
  }
});
