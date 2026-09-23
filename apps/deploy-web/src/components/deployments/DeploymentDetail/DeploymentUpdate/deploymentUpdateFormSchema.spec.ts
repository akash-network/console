import { describe, expect, it } from "vitest";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { DeploymentUpdateFormSchema } from "./deploymentUpdateFormSchema";

const SDL_THE_CREATE_FORM_WOULD_REFUSE = `
version: "2.0"
services:
  web:
    image: nginx:1.25
    env:
      - MODE=dev
      - API_TOKEN=ac-secret://API_TOKEN
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.05
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

describe("DeploymentUpdateFormSchema", () => {
  it("accepts a deployment whose locked hardware the create form would refuse, since nothing here can change it", () => {
    const { values } = setup();

    expect(SdlBuilderFormValuesSchema.safeParse(values).success).toBe(false);
    expect(DeploymentUpdateFormSchema.safeParse(values).success).toBe(true);
  });

  it("accepts a kept secret, whose value is a reference", () => {
    const { values } = setup();

    expect(DeploymentUpdateFormSchema.safeParse(values).success).toBe(true);
  });

  it.each([
    { named: "an empty image", image: "", message: "Docker image name is required." },
    { named: "an image name no registry accepts", image: "NGINX::latest", message: "Invalid docker image name." }
  ])("refuses $named on the image field", ({ image, message }) => {
    const { values } = setup();
    values.services[0].image = image;

    expect(issuesOf(values)).toContainEqual({ path: "services.0.image", message });
  });

  it("refuses a plain value the console would read as a reference", () => {
    const { values } = setup();
    values.services[0].env = [{ id: "mode", key: "MODE", value: "ac-looks-like-a-reference" }];

    expect(issuesOf(values)).toContainEqual({ path: "services.0.env.0.value", message: expect.stringContaining('may not start with "ac-"') });
  });

  it("refuses a variable name the patch route would refuse", () => {
    const { values } = setup();
    values.services[0].env = [{ id: "bad", key: "1BAD", value: "x" }];

    expect(issuesOf(values)).toContainEqual({ path: "services.0.env.0.key", message: expect.stringContaining("cannot start with a digit") });
  });

  it("refuses a variable name the service already uses, which the patch would fold into one", () => {
    const { values } = setup();
    values.services[0].env = [
      { id: "first", key: "MODE", value: "dev" },
      { id: "second", key: "MODE", value: "prod" }
    ];

    expect(issuesOf(values)).toEqual([{ path: "services.0.env.1.key", message: "This service already has a variable named MODE." }]);
  });

  it("lets two services each use the same variable name", () => {
    const { values } = setup();
    values.services[0].env = [{ id: "first", key: "MODE", value: "dev" }];
    values.services.push({ ...values.services[0], id: "other", title: "other", env: [{ id: "second", key: "MODE", value: "prod" }] });

    expect(issuesOf(values)).toEqual([]);
  });

  it("accepts a kept registry password the create form would refuse, since the password cannot be changed here", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: "abc" };

    expect(issuesOf(values)).toEqual([]);
  });

  it("passes the kept registry password on untouched", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: "abc" };

    expect(DeploymentUpdateFormSchema.parse(values).services[0].credentials).toEqual({ host: "ghcr.io", username: "acme", password: "abc" });
  });

  function issuesOf(values: SdlBuilderFormValuesType) {
    const result = DeploymentUpdateFormSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }));
  }

  function setup() {
    return { values: importDeploymentState(SDL_THE_CREATE_FORM_WOULD_REFUSE).values };
  }
});
