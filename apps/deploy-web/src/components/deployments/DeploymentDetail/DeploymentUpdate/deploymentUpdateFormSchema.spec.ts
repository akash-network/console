import { describe, expect, it } from "vitest";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import { SdlBuilderFormValuesSchema } from "@src/types";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { DeploymentUpdateFormSchema } from "./deploymentUpdateFormSchema";

const KEPT_PASSWORD = "ac-secret://REGISTRY_PASSWORD";

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

  it("puts a variable renamed onto a secret's name in the wrong, since the secret's row cannot be renamed", () => {
    const { values } = setup();
    values.services[0].env = values.services[0].env?.map(variable => (variable.key === "MODE" ? { ...variable, key: "API_TOKEN" } : variable));

    expect(issuesOf(values)).toEqual([{ path: "services.0.env.0.key", message: "This service already has a secret named API_TOKEN." }]);
  });

  it("lets two services each use the same variable name", () => {
    const { values } = setup();
    values.services[0].env = [{ id: "first", key: "MODE", value: "dev" }];
    values.services.push({ ...values.services[0], id: "other", title: "other", env: [{ id: "second", key: "MODE", value: "prod" }] });

    expect(issuesOf(values)).toEqual([]);
  });

  it("passes a kept registry password on untouched, whose value is a reference", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: KEPT_PASSWORD };

    expect(DeploymentUpdateFormSchema.parse(values).services[0].credentials).toEqual({ host: "ghcr.io", username: "acme", password: KEPT_PASSWORD });
  });

  it("refuses a typed registry password shorter than the create form accepts", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: "abc" };

    expect(issuesOf(values)).toEqual([{ path: "services.0.credentials.password", message: "Password must be at least 6 characters." }]);
  });

  it("refuses a registry left without a username", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "", password: KEPT_PASSWORD };

    expect(issuesOf(values)).toEqual([{ path: "services.0.credentials.username", message: "Username is required." }]);
  });

  it("refuses a replacement for a kept registry password shorter than the create form accepts", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: KEPT_PASSWORD };
    values.secretValues = { REGISTRY_PASSWORD: "abc" };

    expect(issuesOf(values)).toEqual([{ path: "secretValues.REGISTRY_PASSWORD", message: "Password must be at least 6 characters." }]);
  });

  it("accepts a replacement box left blank, which keeps the stored value", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: KEPT_PASSWORD };
    values.secretValues = { REGISTRY_PASSWORD: "", API_TOKEN: "" };

    expect(issuesOf(values)).toEqual([]);
  });

  it("refuses a secret added without a value", () => {
    const { values } = setup();
    values.services[0].env = [...(values.services[0].env ?? []), { id: "new", key: "STRIPE_KEY", value: "", isSecret: true }];

    expect(issuesOf(values)).toEqual([{ path: "services.0.env.2.value", message: "Enter a value for this secret." }]);
  });

  it("passes the replacements on untouched", () => {
    const { values } = setup();
    values.secretValues = { API_TOKEN: "rotated" };

    expect(DeploymentUpdateFormSchema.parse(values)).toMatchObject({ secretValues: { API_TOKEN: "rotated" } });
  });

  function issuesOf(values: DeploymentUpdateFormValues) {
    const result = DeploymentUpdateFormSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }));
  }

  function setup() {
    const values: DeploymentUpdateFormValues = importDeploymentState(SDL_THE_CREATE_FORM_WOULD_REFUSE).values;
    return { values };
  }
});
