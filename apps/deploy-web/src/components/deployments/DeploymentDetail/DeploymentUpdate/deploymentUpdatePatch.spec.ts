import { describe, expect, it } from "vitest";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { DeploymentUpdateFormValues } from "./deploymentUpdateFormSchema";
import { sealedUpdateOf } from "./deploymentUpdatePatch";

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
      - DB_PASSWORD=ac-secret://s0_e3
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
    credentials:
      host: docker.io
      username: bot
      password: ac-secret://s1_c_password
    expose:
      - port: 9000
        as: 9000
        to:
          - service: web
  cron:
    image: alpine:3.20
    expose:
      - port: 8080
        as: 8080
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
    cron:
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
        cron:
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
  cron:
    dcloud:
      profile: cron
      count: 1
`;

describe(sealedUpdateOf.name, () => {
  describe("the services patch", () => {
    it("is empty when nothing changed", () => {
      const { seed, current } = setup();

      expect(sealedUpdateOf(seed, current)).toEqual({ services: {}, secrets: {}, values: seed });
    });

    it("names only the image that changed", () => {
      const { seed, current } = setup();
      serviceNamed(current, "web").image = "nginx:1.27";

      expect(sealedUpdateOf(seed, current).services).toEqual({ web: { image: "nginx:1.27" } });
    });

    it("carries a changed, an added and a removed variable, removing with null", () => {
      const { seed, current } = setup();
      const web = serviceNamed(current, "web");
      web.env = [
        ...(web.env ?? []).filter(variable => variable.key !== "GONE").map(variable => (variable.key === "MODE" ? { ...variable, value: "prod" } : variable)),
        { id: "new", key: "NEW", value: "x" }
      ];

      expect(sealedUpdateOf(seed, current).services).toEqual({ web: { env: { MODE: "prod", NEW: "x", GONE: null } } });
    });

    it("clears the registry credentials once the private registry is turned off", () => {
      const { seed, current } = setup();
      const web = serviceNamed(current, "web");
      web.hasCredentials = false;
      web.credentials = undefined;

      expect(sealedUpdateOf(seed, current).services).toEqual({ web: { credentials: null } });
    });

    it("sends the kept registry references along with a changed host, so none of them is resent as a value", () => {
      const { seed, current } = setup();
      serviceNamed(current, "web").credentials = {
        host: "docker.io",
        username: "ac-secret://REGISTRY_USERNAME",
        password: "ac-secret://REGISTRY_PASSWORD"
      };

      expect(sealedUpdateOf(seed, current)).toMatchObject({
        services: { web: { credentials: { host: "docker.io", username: "ac-secret://REGISTRY_USERNAME", password: "ac-secret://REGISTRY_PASSWORD" } } },
        secrets: {}
      });
    });

    it("clears the command once its field is emptied", () => {
      const { seed, current } = setup();
      serviceNamed(current, "web").command = { command: "", arg: "echo hi" };

      expect(sealedUpdateOf(seed, current).services).toEqual({ web: { command: null } });
    });

    it("names only the service that changed", () => {
      const { seed, current } = setup();
      serviceNamed(current, "cron").image = "alpine:3.21";

      expect(sealedUpdateOf(seed, current).services).toEqual({ cron: { image: "alpine:3.21" } });
    });
  });

  describe("a kept secret", () => {
    it("seals a replaced value under the name its reference already carries, leaving the variable itself unpatched", () => {
      const { seed, current } = setup();
      current.secretValues = { s0_e3: "rotated-password" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({ services: {}, secrets: { s0_e3: "rotated-password" } });
    });

    it("keeps a secret whose replacement box was left blank", () => {
      const { seed, current } = setup();
      current.secretValues = { API_TOKEN: "" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({ services: {}, secrets: {} });
    });

    it("removes a secret with null and drops a value typed for it", () => {
      const { seed, current } = setup();
      const web = serviceNamed(current, "web");
      web.env = (web.env ?? []).filter(variable => variable.key !== "API_TOKEN");
      current.secretValues = { API_TOKEN: "never-sent" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({ services: { web: { env: { API_TOKEN: null } } }, secrets: {} });
    });

    it("leaves every other secret unsent when one is replaced", () => {
      const { seed, current } = setup();
      current.secretValues = { API_TOKEN: "rotated-token" };

      expect(sealedUpdateOf(seed, current).secrets).toEqual({ API_TOKEN: "rotated-token" });
    });
  });

  describe("a secret added from the form", () => {
    it("references it under a name minted from its variable and seals the value", () => {
      const { seed, current } = setup();
      const web = serviceNamed(current, "web");
      web.env = [...(web.env ?? []), { id: "new", key: "STRIPE_KEY", value: "sk-live", isSecret: true }];

      expect(sealedUpdateOf(seed, current)).toMatchObject({
        services: { web: { env: { STRIPE_KEY: "ac-secret://STRIPE_KEY" } } },
        secrets: { STRIPE_KEY: "sk-live" }
      });
    });

    it("mints a name no kept reference stands on", () => {
      const { seed, current } = setup();
      const cron = serviceNamed(current, "cron");
      cron.env = [{ id: "new", key: "API_TOKEN", value: "another-token", isSecret: true }];

      expect(sealedUpdateOf(seed, current)).toMatchObject({
        services: { cron: { env: { API_TOKEN: "ac-secret://API_TOKEN_2" } } },
        secrets: { API_TOKEN_2: "another-token" }
      });
    });

    it("hands back the values with the secret standing as its reference, so they can seed the next baseline", () => {
      const { seed, current } = setup();
      const web = serviceNamed(current, "web");
      web.env = [...(web.env ?? []), { id: "new", key: "STRIPE_KEY", value: "sk-live", isSecret: true }];
      current.secretValues = { API_TOKEN: "rotated-token" };

      const { values } = sealedUpdateOf(seed, current);

      expect(serviceNamed(values, "web").env).toContainEqual({ id: "new", key: "STRIPE_KEY", value: "ac-secret://STRIPE_KEY", isSecret: true });
      expect(values).not.toHaveProperty("secretValues");
      expect(JSON.stringify(values)).not.toContain("sk-live");
    });
  });

  describe("registry credentials", () => {
    it("seals a replaced password under the name its kept reference carries, leaving the credentials unpatched", () => {
      const { seed, current } = setup();
      current.secretValues = { REGISTRY_PASSWORD: "new-registry-password" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({ services: {}, secrets: { REGISTRY_PASSWORD: "new-registry-password" } });
    });

    it("references both halves of a registry added to a public image and seals them", () => {
      const { seed, current } = setup();
      const cron = serviceNamed(current, "cron");
      cron.hasCredentials = true;
      cron.credentials = { host: "ghcr.io", username: "robot", password: "robot-password" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({
        services: { cron: { credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME_2", password: "ac-secret://REGISTRY_PASSWORD_2" } } },
        secrets: { REGISTRY_USERNAME_2: "robot", REGISTRY_PASSWORD_2: "robot-password" }
      });
    });

    it("seals a plaintext username once the credentials it belongs to are patched", () => {
      const { seed, current } = setup();
      serviceNamed(current, "worker").credentials = { host: "ghcr.io", username: "bot", password: "ac-secret://s1_c_password" };

      expect(sealedUpdateOf(seed, current)).toMatchObject({
        services: { worker: { credentials: { host: "ghcr.io", username: "ac-secret://REGISTRY_USERNAME_2", password: "ac-secret://s1_c_password" } } },
        secrets: { REGISTRY_USERNAME_2: "bot" }
      });
    });

    it("leaves a plaintext username alone while nothing about its credentials changes", () => {
      const { seed, current } = setup();
      serviceNamed(current, "worker").image = "busybox:1.37";

      expect(sealedUpdateOf(seed, current)).toMatchObject({ services: { worker: { image: "busybox:1.37" } }, secrets: {} });
    });
  });

  function serviceNamed(values: DeploymentUpdateFormValues, title: string) {
    const service = values.services.find(candidate => candidate.title === title);
    if (!service) throw new Error(`no service ${title}`);
    return service;
  }

  function setup() {
    const seed: DeploymentUpdateFormValues = importDeploymentState(STORED_SDL).values;
    const current: DeploymentUpdateFormValues = structuredClone(seed);
    return { seed, current };
  }
});
