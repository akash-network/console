import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AppBootstrap";
import { AppBootstrap } from "./AppBootstrap";

import { render } from "@testing-library/react";

describe(AppBootstrap.name, () => {
  it("applies local storage migrations once", () => {
    const { migrateLocalStorage } = setup();

    expect(migrateLocalStorage).toHaveBeenCalledTimes(1);
  });

  it("starts tracking in-app navigation", () => {
    const { useTrackInAppNavigation } = setup();

    expect(useTrackInAppNavigation).toHaveBeenCalled();
  });

  it("renders nothing", () => {
    const { container } = setup();

    expect(container).toBeEmptyDOMElement();
  });

  function setup() {
    const migrateLocalStorage = vi.fn<typeof DEPENDENCIES.migrateLocalStorage>();
    const useTrackInAppNavigation = vi.fn<typeof DEPENDENCIES.useTrackInAppNavigation>();

    const { container } = render(<AppBootstrap dependencies={{ useTrackInAppNavigation, migrateLocalStorage }} />);

    return { container, migrateLocalStorage, useTrackInAppNavigation };
  }
});
