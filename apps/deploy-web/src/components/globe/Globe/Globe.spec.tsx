import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES, GlobeMarker } from "./Globe";
import { Globe } from "./Globe";

import { render, screen } from "@testing-library/react";

const destroy = vi.fn();
const update = vi.fn();
const createGlobe = vi.fn<typeof DEPENDENCIES.createGlobe>(() => ({ destroy, update }));

describe(Globe.name, () => {
  beforeEach(() => {
    createGlobe.mockClear();
    destroy.mockClear();
    update.mockClear();
  });

  it("initializes cobe on mount and tears it down on unmount", () => {
    const { unmount } = setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }] });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const [canvas, opts] = createGlobe.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect((opts as { markers: unknown[] }).markers).toEqual([{ id: "test-a", location: [0, 0], size: 0.04 }]);

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("initializes cobe with dark=0 when mounted under the light theme", () => {
    setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }], theme: "light" });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const dark = (createGlobe.mock.calls[0][1] as { dark: number }).dark;
    expect(dark).toBe(0);
  });

  it("initializes cobe with dark=1 when mounted under the dark theme", () => {
    setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }], theme: "dark" });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const dark = (createGlobe.mock.calls[0][1] as { dark: number }).dark;
    expect(dark).toBe(1);
  });

  it("renders label overlays for markers that have a label", () => {
    setup({
      markers: [
        { id: "us-east-1", lat: 0, lng: 0, label: "US-EAST-1" },
        { id: "unlabeled", lat: 10, lng: 10 } // no label — should not render
      ]
    });

    expect(screen.queryByText("US-EAST-1")).toBeInTheDocument();
  });

  function setup(input: { markers: GlobeMarker[]; theme?: "light" | "dark" }) {
    const useTheme: typeof DEPENDENCIES.useTheme = () => input.theme ?? "light";
    return render(<Globe markers={input.markers} size={400} dependencies={{ createGlobe, useTheme }} />);
  }
});
