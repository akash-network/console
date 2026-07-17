import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, RedirectDeployLinuxToConfigure } from "./RedirectDeployLinuxToConfigure";

import { render, screen } from "@testing-library/react";

describe(RedirectDeployLinuxToConfigure.name, () => {
  it("redirects to the configure vm seed when the flag is on", () => {
    const { replace } = setup({ flag: true });
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure?vm=true");
    expect(screen.queryByText("classic")).not.toBeInTheDocument();
  });

  it("renders the classic builder when the flag is off", () => {
    const { replace } = setup({ flag: false });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  function setup(input: { flag: boolean }) {
    const replace = vi.fn();
    const d: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: (() => input.flag) as typeof DEPENDENCIES.useFlag,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })) as typeof DEPENDENCIES.useRouter
    };
    render(
      <RedirectDeployLinuxToConfigure dependencies={d}>
        <div>classic</div>
      </RedirectDeployLinuxToConfigure>
    );
    return { replace };
  }
});
