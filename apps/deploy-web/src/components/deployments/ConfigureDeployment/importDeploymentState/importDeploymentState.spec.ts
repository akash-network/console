import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { importDeploymentState, NoVisibleServiceError, seedSelectedServiceId } from "./importDeploymentState";

const VALID_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    expose:",
  "      - port: 80",
  "        as: 80",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

/** Two services sharing the `dcloud` placement name — the default (non-legacy) import dedupes them to one placement record. */
const TWO_SERVICE_SHARED_PLACEMENT_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "  api:",
  "    image: node:18",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "    api:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "        api:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1",
  "  api:",
  "    dcloud:",
  "      profile: api",
  "      count: 1"
].join("\n");

/** A deployment carrying an SSH public key in the managed `SSH_PUBKEY` env var. */
const SSH_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    env:",
  "      - SSH_PUBKEY=ssh-rsa AAAAKEY",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

/** A VM image with no SSH key entered yet — the expose-ssh flag must still be backfilled on. */
const VM_SDL_WITHOUT_KEY = [
  "version: '2.0'",
  "services:",
  "  vm:",
  "    image: ghcr.io/akash-network/ubuntu-2404-ssh:2",
  "profiles:",
  "  compute:",
  "    vm:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        vm:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  vm:",
  "    dcloud:",
  "      profile: vm",
  "      count: 1"
].join("\n");

/** A deployment whose only service is a log collector — the configure screen has nothing to focus. */
const LOG_COLLECTOR_ONLY_SDL = [
  "version: '2.0'",
  "services:",
  "  web-log-collector:",
  `    image: ${LOG_COLLECTOR_IMAGE}`,
  "profiles:",
  "  compute:",
  "    web-log-collector:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web-log-collector:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web-log-collector:",
  "    dcloud:",
  "      profile: web-log-collector",
  "      count: 1"
].join("\n");

describe(importDeploymentState.name, () => {
  it("imports a valid SDL into form values, keeps the SDL verbatim, and selects the first service", () => {
    const state = importDeploymentState(VALID_SDL);

    expect(state.sdl).toBe(VALID_SDL);
    expect(state.values.services.map(service => service.title)).toEqual(["web"]);
    expect(state.selectedServiceId).toBe(state.values.services[0].id);
  });

  it("dedupes placements that share a name into a single record", () => {
    const state = importDeploymentState(TWO_SERVICE_SHARED_PLACEMENT_SDL);

    expect(state.values.placements).toHaveLength(1);
    expect(state.values.services.map(service => service.title)).toEqual(["web", "api"]);
  });

  it("restores an imported SSH key into the service and turns on the expose-ssh flag", () => {
    const state = importDeploymentState(SSH_SDL);

    expect(state.values.hasSSHKey).toBe(true);
    expect(state.values.services[0].sshPubKey).toBe("ssh-rsa AAAAKEY");
  });

  it("backfills the expose-ssh flag for a VM service saved without a key", () => {
    const state = importDeploymentState(VM_SDL_WITHOUT_KEY);

    expect(state.values.hasSSHKey).toBe(true);
  });

  it("leaves the expose-ssh flag off for a non-VM deployment without a key", () => {
    const state = importDeploymentState(VALID_SDL);

    expect(state.values.hasSSHKey).toBeFalsy();
  });

  it("throws NoVisibleServiceError for a service-less SDL", () => {
    expect(() => importDeploymentState('version: "2.0"')).toThrow(NoVisibleServiceError);
  });

  it("throws NoVisibleServiceError when the only service is a log collector", () => {
    expect(() => importDeploymentState(LOG_COLLECTOR_ONLY_SDL)).toThrow(NoVisibleServiceError);
  });

  it("propagates a YAML parse failure as a YAMLException", () => {
    expect(() => importDeploymentState("services: [unclosed")).toThrow(expect.objectContaining({ name: "YAMLException" }));
  });

  it("propagates a structural validation failure as a CustomValidationError", () => {
    expect(() => importDeploymentState("- not\n- an\n- object")).toThrow(expect.objectContaining({ name: "CustomValidationError" }));
  });
});

describe(seedSelectedServiceId.name, () => {
  it("returns the first non-log-collector service id", () => {
    const values = valuesWithServices([logCollectorService("collector"), visibleService("web"), visibleService("api")]);

    expect(seedSelectedServiceId(values)).toBe("web");
  });

  it("falls back to the first service when every service is a log collector", () => {
    const values = valuesWithServices([logCollectorService("only-collector")]);

    expect(seedSelectedServiceId(values)).toBe("only-collector");
  });

  function valuesWithServices(services: ServiceType[]): SdlBuilderFormValuesType {
    return mock<SdlBuilderFormValuesType>({ services });
  }

  function visibleService(id: string): ServiceType {
    return mock<ServiceType>({ id, title: id, image: "nginx:1.0" });
  }

  function logCollectorService(id: string): ServiceType {
    return mock<ServiceType>({ id, title: `${id}-log-collector`, image: LOG_COLLECTOR_IMAGE });
  }
});
