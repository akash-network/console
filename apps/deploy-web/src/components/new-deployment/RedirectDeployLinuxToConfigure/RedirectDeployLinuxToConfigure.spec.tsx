import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, RedirectDeployLinuxToConfigure } from "./RedirectDeployLinuxToConfigure";

import { render } from "@testing-library/react";

describe(RedirectDeployLinuxToConfigure.name, () => {
  it("redirects to the configure vm seed", () => {
    const { replace } = setup();
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure?vm=true");
  });

  function setup() {
    const replace = vi.fn();
    const d: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })) as typeof DEPENDENCIES.useRouter
    };
    render(<RedirectDeployLinuxToConfigure dependencies={d} />);
    return { replace };
  }
});
