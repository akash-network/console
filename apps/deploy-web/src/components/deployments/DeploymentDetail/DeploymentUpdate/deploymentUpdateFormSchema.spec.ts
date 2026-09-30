import { describe, expect, it } from "vitest";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import { SdlBuilderFormValuesSchema } from "@src/types";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { DeploymentUpdateFormSchema, deploymentUpdateFormSchemaFor } from "./deploymentUpdateFormSchema";

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

    expect(issuesOf(values)).toEqual([{ path: "services.0.credentials.password", message: "Registry password must be at least 6 characters." }]);
  });

  it("refuses a registry left without a username", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "", password: KEPT_PASSWORD };

    expect(issuesOf(values)).toEqual([{ path: "services.0.credentials.username", message: "Registry username is required." }]);
  });

  it("refuses a replacement for a kept registry password shorter than the create form accepts", () => {
    const { values } = setup();
    values.services[0].hasCredentials = true;
    values.services[0].credentials = { host: "ghcr.io", username: "acme", password: KEPT_PASSWORD };
    values.secretValues = { REGISTRY_PASSWORD: "abc" };

    expect(issuesOf(values)).toEqual([{ path: "secretValues.REGISTRY_PASSWORD", message: "Registry password must be at least 6 characters." }]);
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

const SDL_WITH_PORTS = `
version: "2.0"
services:
  web:
    image: nginx:1.25
    expose:
      - port: 80
        as: 80
        to:
          - global: true
      - port: 3000
        as: 3000
        to:
          - global: true
      - port: 9000
        as: 9000
        to:
          - global: true
  api:
    image: node:22
    expose:
      - port: 80
        as: 80
        to:
          - global: false
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
    api:
      resources:
        cpu:
          units: 0.5
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
        api:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
  api:
    dcloud:
      profile: api
      count: 1
`;

const SDL_WITH_SHARED_CONTAINER_PORT = SDL_WITH_PORTS.replace("- port: 9000", "- port: 80");

describe(deploymentUpdateFormSchemaFor.name, () => {
  it("moves a container port that stays reached on the same external port", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[0].port = 8080;

    expect(issuesOf(values)).toEqual([]);
  });

  it("refuses moving a public endpoint off port 80, which would stop serving it over http", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[0].as = 8080;

    expect(issuesOf(values)).toEqual([
      { path: "services.0.expose.0.as", message: "Port 80 is served over HTTP with a hostname, so moving it off 80 needs a new deployment." }
    ]);
  });

  it("refuses moving a public random-port endpoint onto port 80", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[1].as = 80;

    expect(issuesOf(values)).toContainEqual({
      path: "services.0.expose.1.as",
      message: "This endpoint is reached on a random public port, so moving it onto 80 needs a new deployment."
    });
  });

  it("lets an internal endpoint move off port 80, since the chain records no endpoint for it", () => {
    const { values, issuesOf } = setup();
    values.services[1].expose[0].as = 8080;

    expect(issuesOf(values)).toEqual([]);
  });

  it("refuses moving a container port onto one the service already exposes", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[1].port = 9000;

    expect(issuesOf(values)).toEqual([{ path: "services.0.expose.1.port", message: "This service already exposes port 9000." }]);
  });

  it("refuses moving an external port onto one another port of the service uses", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[1].as = 9000;

    expect(issuesOf(values)).toEqual([{ path: "services.0.expose.1.as", message: "Another port of this service is already exposed as 9000." }]);
  });

  it("refuses a port number outside the range a port can take", () => {
    const { values, issuesOf } = setup();
    values.services[0].expose[1].port = 0;

    expect(issuesOf(values)).toEqual([{ path: "services.0.expose.1.port", message: "Port number must be at least 1." }]);
  });

  it("holds no port against a service it has no loaded ports for", () => {
    const { values, issuesOf } = setup({ loadedServiceCount: 0 });
    values.services[0].expose[0].as = 8080;

    expect(issuesOf(values)).toEqual([]);
  });

  it("holds no move against a port it did not load", () => {
    const { values, issuesOf } = setup({ loadedPortCount: 1 });
    values.services[0].expose[1].as = 80;

    expect(issuesOf(values)).toEqual([]);
  });

  it("refuses moving the external port of a port that shares its container port, before judging the move any other way", () => {
    const { values, issuesOf } = setup({ sdl: SDL_WITH_SHARED_CONTAINER_PORT });
    values.services[0].expose[0].as = 8080;

    expect(issuesOf(values)).toEqual([
      {
        path: "services.0.expose.0.as",
        message: "Another port of this service also uses container port 80, so this one's numbers can't change without a new deployment."
      }
    ]);
  });

  it("refuses moving the container port of a port that shares it", () => {
    const { values, issuesOf } = setup({ sdl: SDL_WITH_SHARED_CONTAINER_PORT });
    values.services[0].expose[2].port = 8081;

    expect(issuesOf(values)).toEqual([
      {
        path: "services.0.expose.2.port",
        message: "Another port of this service also uses container port 80, so this one's numbers can't change without a new deployment."
      }
    ]);
  });

  it("still moves a port of the same service whose container port no other port uses", () => {
    const { values, issuesOf } = setup({ sdl: SDL_WITH_SHARED_CONTAINER_PORT });
    values.services[0].expose[1].port = 3001;

    expect(issuesOf(values)).toEqual([]);
  });

  function setup(input: { sdl?: string; loadedServiceCount?: number; loadedPortCount?: number } = {}) {
    const sdl = input.sdl ?? SDL_WITH_PORTS;
    const loaded = importDeploymentState(sdl).values;
    const values: DeploymentUpdateFormValues = importDeploymentState(sdl).values;
    const loadedServices = loaded.services
      .slice(0, input.loadedServiceCount ?? loaded.services.length)
      .map(service => ({ ...service, expose: service.expose.slice(0, input.loadedPortCount ?? service.expose.length) }));
    const schema = deploymentUpdateFormSchemaFor(loadedServices);
    const issuesOf = (current: DeploymentUpdateFormValues) => {
      const result = schema.safeParse(current);
      return result.success ? [] : result.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }));
    };
    return { values, issuesOf };
  }
});
