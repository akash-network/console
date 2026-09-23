import { describe, expect, it } from "vitest";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { SdlBuilderFormValuesType } from "@src/types";
import { servicesPatchOf } from "./deploymentUpdatePatch";

const STORED_SDL = `
version: "2.0"
services:
  web:
    image: nginx:1.25
    command:
      - sh
      - -c
    args:
      - echo hi
    env:
      - MODE=dev
      - GONE=1
      - API_TOKEN=ac-secret://API_TOKEN
    credentials:
      host: ghcr.io
      username: ac-secret://REGISTRY_USERNAME
      password: ac-secret://REGISTRY_PASSWORD
    expose:
      - port: 80
        as: 80
        to:
          - global: true
  worker:
    image: busybox:1.36
    expose:
      - port: 9000
        as: 9000
        to:
          - service: web
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
    worker:
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
        worker:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
  worker:
    dcloud:
      profile: worker
      count: 1
`;

describe(servicesPatchOf.name, () => {
  it("is empty when nothing changed", () => {
    const { seed, current } = setup();

    expect(servicesPatchOf(seed, current)).toEqual({});
  });

  it("names only the image that changed", () => {
    const { seed, current } = setup();
    serviceNamed(current, "web").image = "nginx:1.27";

    expect(servicesPatchOf(seed, current)).toEqual({ web: { image: "nginx:1.27" } });
  });

  it("carries a changed, an added and a removed variable, removing with null", () => {
    const { seed, current } = setup();
    const web = serviceNamed(current, "web");
    web.env = [
      ...(web.env ?? []).filter(variable => variable.key !== "GONE").map(variable => (variable.key === "MODE" ? { ...variable, value: "prod" } : variable)),
      { id: "new", key: "NEW", value: "x" }
    ];

    expect(servicesPatchOf(seed, current)).toEqual({ web: { env: { MODE: "prod", NEW: "x", GONE: null } } });
  });

  it("leaves a kept secret out of the patch, since its reference did not change", () => {
    const { seed, current } = setup();
    const web = serviceNamed(current, "web");
    web.env = (web.env ?? []).map(variable => (variable.key === "MODE" ? { ...variable, value: "prod" } : variable));

    expect(servicesPatchOf(seed, current).web.env).not.toHaveProperty("API_TOKEN");
  });

  it("removes a secret with null", () => {
    const { seed, current } = setup();
    const web = serviceNamed(current, "web");
    web.env = (web.env ?? []).filter(variable => variable.key !== "API_TOKEN");

    expect(servicesPatchOf(seed, current)).toEqual({ web: { env: { API_TOKEN: null } } });
  });

  it("clears the registry credentials once the private registry is turned off", () => {
    const { seed, current } = setup();
    const web = serviceNamed(current, "web");
    web.hasCredentials = false;
    web.credentials = undefined;

    expect(servicesPatchOf(seed, current)).toEqual({ web: { credentials: null } });
  });

  it("sends the kept registry references along with a changed host, so none of them is resent as a value", () => {
    const { seed, current } = setup();
    const web = serviceNamed(current, "web");
    web.credentials = { host: "docker.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" };

    expect(servicesPatchOf(seed, current)).toEqual({
      web: { credentials: { host: "docker.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" } }
    });
  });

  it("clears the command once its field is emptied", () => {
    const { seed, current } = setup();
    serviceNamed(current, "web").command = { command: "", arg: "echo hi" };

    expect(servicesPatchOf(seed, current)).toEqual({ web: { command: null } });
  });

  it("names only the service that changed", () => {
    const { seed, current } = setup();
    serviceNamed(current, "worker").image = "busybox:1.37";

    expect(servicesPatchOf(seed, current)).toEqual({ worker: { image: "busybox:1.37" } });
  });

  function serviceNamed(values: SdlBuilderFormValuesType, title: string) {
    const service = values.services.find(candidate => candidate.title === title);
    if (!service) throw new Error(`no service ${title}`);
    return service;
  }

  function setup() {
    const seed = importDeploymentState(STORED_SDL).values;
    const current = structuredClone(seed);
    return { seed, current };
  }
});
