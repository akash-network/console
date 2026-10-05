import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AppBootstrap";
import { AppBootstrap } from "./AppBootstrap";

import { render } from "@testing-library/react";

describe(AppBootstrap.name, () => {
  it("applies local storage migrations once", () => {
    const { migrateLocalStorage } = setup();

    expect(migrateLocalStorage).toHaveBeenCalledTimes(1);
  });

  it("forgets the storage older releases left behind once", () => {
    const { forgetRetiredStorage } = setup();

    expect(forgetRetiredStorage).toHaveBeenCalledTimes(1);
    expect(forgetRetiredStorage).toHaveBeenCalledWith(window.localStorage);
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
    const forgetRetiredStorage = vi.fn<typeof DEPENDENCIES.forgetRetiredStorage>();
    const useTrackInAppNavigation = vi.fn<typeof DEPENDENCIES.useTrackInAppNavigation>();

    const { container } = render(<AppBootstrap dependencies={{ useTrackInAppNavigation, migrateLocalStorage, forgetRetiredStorage }} />);

    return { container, migrateLocalStorage, forgetRetiredStorage, useTrackInAppNavigation };
  }
});
