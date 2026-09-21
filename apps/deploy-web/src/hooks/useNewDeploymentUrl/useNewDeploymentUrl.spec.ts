import { describe, expect, it } from "vitest";

import { DEPENDENCIES, useNewDeploymentUrl } from "./useNewDeploymentUrl";

import { renderHook } from "@testing-library/react";

describe(useNewDeploymentUrl.name, () => {
  it("opens a chosen template on the configure screen", () => {
    const make = build();
    expect(make({ templateId: "tpl-1" })).toBe("/new-deployment/configure?templateId=tpl-1");
  });

  it("keeps a bare new-deployment intent on the picker", () => {
    const make = build();
    expect(make()).toBe("/new-deployment");
  });

  function build() {
    return renderHook(() => useNewDeploymentUrl(DEPENDENCIES)).result.current;
  }
});
