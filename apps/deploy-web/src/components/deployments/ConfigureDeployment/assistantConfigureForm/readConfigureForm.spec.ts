import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { isEditablePhase, readConfigureForm } from "./readConfigureForm";

describe(readConfigureForm.name, () => {
  it("reads each service's resources, storage, ports and env names, never env values", () => {
    const values = formValues({
      image: "nginx:alpine",
      count: 2,
      env: [
        { id: "1", key: "API_TOKEN", value: "hunter22", isSecret: true },
        { id: "2", key: " MODE ", value: "production" },
        { id: "3", key: "", value: "dangling" }
      ],
      command: { command: "sh -c 'echo $API_TOKEN'", arg: "" },
      profile: {
        cpu: 0.5,
        arch: "arm64",
        hasGpu: true,
        gpu: 2,
        gpuModels: [{ vendor: "nvidia", name: "rtx4090" }, { vendor: "amd" }],
        ram: 128,
        ramUnit: "Mi",
        storage: [
          { size: 512, unit: "Mi", isPersistent: false },
          { size: 1, unit: "Gi", isPersistent: false, type: "ram", name: "shm", mount: "/dev/shm" },
          { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/data", isReadOnly: true },
          { size: 5, unit: "Gi", isPersistent: true, name: "", mount: "" }
        ]
      }
    });

    const read = readConfigureForm(values, {
      phase: "configuring",
      providers: [{ placement: "dcloud", status: "screened", providersAbleToBid: 0, notBidding: 0 }]
    });

    expect(read.services).toEqual([
      {
        name: "web",
        placement: "dcloud",
        image: "nginx:alpine",
        replicas: 2,
        cpu: 0.5,
        cpuArch: "arm64",
        memory: "128Mi",
        ephemeralStorage: "512Mi",
        ramStorage: { size: "1Gi", mount: "/dev/shm" },
        persistentStorage: [
          { name: "data", class: "beta3", size: "10Gi", mount: "/data", readOnly: true },
          { name: null, class: null, size: "5Gi", mount: null, readOnly: false }
        ],
        gpu: { units: 2, models: ["nvidia/rtx4090", "amd"] },
        ports: [{ port: 80, as: 80, proto: "http", global: true }],
        envNames: ["API_TOKEN", "MODE"],
        hasCommand: true
      }
    ]);
    expect(read.providers).toEqual([{ placement: "dcloud", status: "screened", providersAbleToBid: 0, notBidding: 0 }]);
    expect(JSON.stringify(read)).not.toContain("hunter22");
    expect(JSON.stringify(read)).not.toContain("production");
    expect(JSON.stringify(read)).not.toContain("echo");
  });

  it("reads a service without GPU, RAM volume, image or placement", () => {
    const values = formValues({ image: "", placementId: "gone", expose: [{ port: 8080, as: 80 }], profile: profile({ hasGpu: false }) });

    const [service] = readConfigureForm(values, { phase: "configuring", providers: [] }).services;

    expect(service).toEqual(
      expect.objectContaining({
        placement: null,
        image: null,
        cpuArch: null,
        gpu: null,
        ramStorage: null,
        persistentStorage: [],
        ports: [{ port: 8080, as: 80, proto: null, global: false }],
        envNames: [],
        hasCommand: false
      })
    );
  });

  it.each([
    [{ command: "", arg: "--port 80" }, true],
    [{ importedCommand: ["node"] }, true],
    [{ importedArg: ["server.js"] }, true],
    [{ importedCommand: [], importedArg: [] }, false],
    [undefined, false]
  ])("reads whether %j sets a command", (command, hasCommand) => {
    const [service] = readConfigureForm(formValues({ command }), { phase: "configuring", providers: [] }).services;

    expect(service.hasCommand).toBe(hasCommand);
  });

  it("reads the placements and the settings the page marks invalid", () => {
    const values = formValues({ image: "" });
    values.placements[0] = { ...values.placements[0], regions: ["us-west"], attributes: [{ id: "a", key: "host", value: "akash" }] };

    const read = readConfigureForm(values, { phase: "quoting", providers: [] });

    expect(read.phase).toBe("quoting");
    expect(read.editable).toBe(false);
    expect(read.placements).toEqual([{ name: "dcloud", regions: ["us-west"], attributes: [{ key: "host", value: "akash" }] }]);
    expect(read.invalidSettings).toEqual(["web: Docker image name is required."]);
  });

  it("reads a placement without regions or attributes as empty", () => {
    const values = formValues({});
    values.placements[0] = { ...values.placements[0], regions: undefined, attributes: undefined };

    expect(readConfigureForm(values, { phase: "configuring", providers: [] }).placements).toEqual([{ name: "dcloud", regions: [], attributes: [] }]);
  });

  it("gives an SDL to screen without env, command, credentials or SSH key, keeping the resources and pricing", () => {
    const values = {
      ...formValues({
        env: [{ id: "1", key: "API_TOKEN", value: "hunter22" }],
        command: { command: "run-secret-thing", arg: "" },
        hasCredentials: true,
        credentials: { host: "ghcr.io", username: "alice", password: "registry-pass" },
        sshPubKey: "ssh-ed25519 AAAAkey"
      }),
      hasSSHKey: true
    };

    const { screeningSdl } = readConfigureForm(values, { phase: "configuring", providers: [] });

    expect(screeningSdl).toContain("image: nginx:alpine");
    expect(screeningSdl).toContain("size: 128Mi");
    expect(screeningSdl).toContain("denom: uact");
    ["hunter22", "API_TOKEN", "run-secret-thing", "registry-pass", "alice", "AAAAkey"].forEach(secret => expect(screeningSdl).not.toContain(secret));
  });

  it("gives no screening SDL when the form cannot generate one", () => {
    const values = formValues({});
    values.services[0].placementId = "missing";

    expect(readConfigureForm(values, { phase: "configuring", providers: [] }).screeningSdl).toBeNull();
  });

  describe(isEditablePhase.name, () => {
    it.each([
      ["configuring", true],
      ["error", true],
      ["creating", false],
      ["quoting", false],
      ["deploying", false]
    ] as const)("treats %s as editable: %s", (phase, editable) => {
      expect(isEditablePhase(phase)).toBe(editable);
    });
  });

  function profile(overrides: Partial<ServiceType["profile"]>): ServiceType["profile"] {
    return { cpu: 0.1, hasGpu: false, ram: 128, ramUnit: "Mi", storage: [{ size: 128, unit: "Mi", isPersistent: false }], ...overrides };
  }

  function formValues(overrides: Partial<ServiceType>): SdlBuilderFormValuesType {
    const values = defaultServiceWithPlacement({ title: "web", image: "nginx:alpine", profile: profile({}) });
    values.placements[0] = { ...values.placements[0], name: "dcloud" };
    values.services[0] = { ...values.services[0], ...overrides };
    return values;
  }
});
