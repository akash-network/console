import { describe, expect, it } from "vitest";

import { RouteStep } from "@src/types/route-steps.type";
import { DEPENDENCIES, useNewDeploymentUrl } from "./useNewDeploymentUrl";

import { renderHook } from "@testing-library/react";

describe(useNewDeploymentUrl.name, () => {
  it("maps a template intent to the configure screen when the flag is on", () => {
    const make = build({ flag: true });
    expect(make({ step: RouteStep.editDeployment, templateId: "tpl-1" })).toBe("/new-deployment/configure?templateId=tpl-1");
  });

  it("maps a blank intent to a blank configure screen when the flag is on", () => {
    const make = build({ flag: true });
    expect(make({ step: RouteStep.editDeployment })).toBe("/new-deployment/configure");
  });

  it("keeps a bare new-deployment intent on the classic picker when the flag is on", () => {
    const make = build({ flag: true });
    expect(make()).toBe("/new-deployment");
  });

  it("keeps the classic URL when the flag is off", () => {
    const make = build({ flag: false });
    expect(make({ step: RouteStep.editDeployment, templateId: "tpl-1" })).toBe("/new-deployment?step=edit-deployment&templateId=tpl-1");
  });

  it("keeps the classic URL for git/redeploy intents even when the flag is on", () => {
    const make = build({ flag: true });
    expect(make({ step: RouteStep.editDeployment, gitProvider: "github", templateId: "x" })).toContain("/new-deployment?");
    expect(make({ redeploy: "42" })).toContain("/new-deployment?");
  });

  it("maps the container-vm intent to the configure vm seed when the flag is on", () => {
    const make = build({ flag: true });
    expect(make({ step: RouteStep.editDeployment, page: "deploy-linux" })).toBe("/new-deployment/configure?vm=true");
  });

  it("keeps the container-vm intent on the classic builder when the flag is off", () => {
    const make = build({ flag: false });
    expect(make({ step: RouteStep.editDeployment, page: "deploy-linux" })).toBe("/deploy-linux?step=edit-deployment");
  });

  function build(input: { flag: boolean }) {
    const d: typeof DEPENDENCIES = { ...DEPENDENCIES, useFlag: (() => input.flag) as typeof DEPENDENCIES.useFlag };
    return renderHook(() => useNewDeploymentUrl(d)).result.current;
  }
});
