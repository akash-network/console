import { describe, expect, it } from "vitest";

import { RouteStep } from "@src/types/route-steps.type";
import { DEPENDENCIES, useNewDeploymentUrl } from "./useNewDeploymentUrl";

import { renderHook } from "@testing-library/react";

describe(useNewDeploymentUrl.name, () => {
  it("maps a template intent to the configure screen", () => {
    const make = build();
    expect(make({ step: RouteStep.editDeployment, templateId: "tpl-1" })).toBe("/new-deployment/configure?templateId=tpl-1");
  });

  it("maps a blank intent to a blank configure screen", () => {
    const make = build();
    expect(make({ step: RouteStep.editDeployment })).toBe("/new-deployment/configure");
  });

  it("keeps a bare new-deployment intent on the classic picker", () => {
    const make = build();
    expect(make()).toBe("/new-deployment");
  });

  it("keeps the classic URL for git/redeploy intents", () => {
    const make = build();
    expect(make({ step: RouteStep.editDeployment, gitProvider: "github", templateId: "x" })).toContain("/new-deployment?");
    expect(make({ redeploy: "42" })).toContain("/new-deployment?");
  });

  it("maps the container-vm intent to the configure vm seed", () => {
    const make = build();
    expect(make({ step: RouteStep.editDeployment, page: "deploy-linux" })).toBe("/new-deployment/configure?vm=true");
  });

  function build() {
    return renderHook(() => useNewDeploymentUrl(DEPENDENCIES)).result.current;
  }
});
