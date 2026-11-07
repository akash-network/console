import { describe, expect, it } from "vitest";

import type { ConfigureFormEdit } from "@src/components/assistant/configureFormRegistry/configureFormRegistry";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { applyConfigureFormEdit, ConfigureFormEditError } from "./applyConfigureFormEdit";

type ServiceChanges = ConfigureFormEdit["services"][number]["changes"];
type StorageVolume = ServiceType["profile"]["storage"][number];

const EPHEMERAL: StorageVolume = { size: 1, unit: "Gi", isPersistent: false, type: "beta2" };
const RAM: StorageVolume = { size: 1, unit: "Gi", isPersistent: false, type: "ram", name: "shm", mount: "/dev/shm" };
const DATA: StorageVolume = { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/data", isReadOnly: false };
const CACHE: StorageVolume = { size: 5, unit: "Gi", isPersistent: true, type: "beta2", name: "cache", mount: "/cache", isReadOnly: false };

describe(applyConfigureFormEdit.name, () => {
  it("changes only the named fields, keeping env, secrets, pricing and the other services", () => {
    const values = formValues();

    const edited = applyConfigureFormEdit(values, editOf({ image: "nginx:1.27", cpu: 0.5, memory: "512Mi", ephemeralStorage: "2Gi", count: 3 }));

    const [web, worker] = edited.services;
    expect(web).toEqual({
      ...values.services[0],
      image: "nginx:1.27",
      count: 3,
      profile: { ...values.services[0].profile, cpu: 0.5, ram: 512, ramUnit: "Mi", storage: [{ ...EPHEMERAL, size: 2, unit: "Gi" }, RAM, DATA] }
    });
    expect(worker).toBe(values.services[1]);
    expect(edited.placements).toEqual(values.placements);
    expect(values.services[0].profile.cpu).toBe(0.1);
  });

  it.each([
    ["1G", { size: 1, unit: "GB" }],
    ["500M", { size: 500, unit: "MB" }],
    ["1.5Gi", { size: 1.5, unit: "Gi" }]
  ])("takes the memory size %s in the form's units", (memory, { size, unit }) => {
    const [web] = applyConfigureFormEdit(formValues(), editOf({ memory })).services;

    expect(web.profile).toEqual(expect.objectContaining({ ram: size, ramUnit: unit }));
  });

  it("takes terabytes for storage but refuses a unit the form does not have", () => {
    expect(applyConfigureFormEdit(formValues(), editOf({ ephemeralStorage: "1T" })).services[0].profile.storage[0]).toEqual({
      ...EPHEMERAL,
      size: 1,
      unit: "TB"
    });
    expect(() => applyConfigureFormEdit(formValues(), editOf({ memory: "1Ti" }))).toThrow(
      new ConfigureFormEditError("The form does not take 1Ti. Use one of MB, Mi, GB, Gi.")
    );
    expect(() => applyConfigureFormEdit(formValues(), editOf({ memory: "lots" }))).toThrow("The form does not take lots.");
  });

  describe("gpu", () => {
    it("turns the GPU off at zero units", () => {
      const [web] = applyConfigureFormEdit(formValues({ hasGpu: true, gpu: 1 }), editOf({ gpu: { units: 0 } })).services;

      expect(web.profile.hasGpu).toBe(false);
    });

    it("asks for the named models, with or without a model name", () => {
      const [web] = applyConfigureFormEdit(formValues(), editOf({ gpu: { units: 2, models: ["nvidia/rtx4090", "amd"] } })).services;

      expect(web.profile).toEqual(expect.objectContaining({ hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "rtx4090" }, { vendor: "amd" }] }));
    });

    it("keeps the memory and interface of a model the edit repeats", () => {
      const h100 = { vendor: "nvidia", name: "h100", memory: "80Gi", interface: "sxm" };
      const anyAmd = { vendor: "amd", name: "", interface: "pcie" };
      const [web] = applyConfigureFormEdit(
        formValues({ gpuModels: [h100, anyAmd, { vendor: "nvidia", name: "a100", memory: "40Gi" }] }),
        editOf({ gpu: { units: 2, models: ["nvidia/h100", "amd", "nvidia/a10", "intel"] } })
      ).services;

      expect(web.profile.gpuModels).toEqual([h100, anyAmd, { vendor: "nvidia", name: "a10" }, { vendor: "intel" }]);
    });

    it("keeps the current models when only the count changes", () => {
      const [web] = applyConfigureFormEdit(formValues({ gpuModels: [{ vendor: "nvidia", name: "h100" }] }), editOf({ gpu: { units: 4 } })).services;

      expect(web.profile).toEqual(expect.objectContaining({ hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] }));
    });
  });

  describe("persistent storage", () => {
    it("changes the first persistent volume, skipping the RAM volume", () => {
      const storage = editedStorage([EPHEMERAL, RAM, DATA, CACHE], { class: "beta2", size: "20Gi", mount: "/var/data", readOnly: true });

      expect(storage).toEqual([EPHEMERAL, RAM, { ...DATA, type: "beta2", size: 20, unit: "Gi", mount: "/var/data", isReadOnly: true }, CACHE]);
    });

    it("changes the volume it names, keeping the fields it does not", () => {
      expect(editedStorage([EPHEMERAL, DATA, CACHE], { name: "cache", readOnly: false })).toEqual([EPHEMERAL, DATA, CACHE]);
      expect(editedStorage([EPHEMERAL, DATA, CACHE], { name: "cache", class: "beta1" })).toEqual([EPHEMERAL, DATA, { ...CACHE, type: "beta1" }]);
    });

    it("removes every persistent volume but keeps the RAM volume", () => {
      expect(editedStorage([EPHEMERAL, RAM, DATA, CACHE], { remove: true })).toEqual([EPHEMERAL, RAM]);
    });

    it("removes only the volume it names", () => {
      expect(editedStorage([EPHEMERAL, DATA, CACHE], { name: "data", remove: true })).toEqual([EPHEMERAL, CACHE]);
    });

    it("adds a volume when there is none", () => {
      expect(editedStorage([EPHEMERAL, RAM], { class: "beta2", size: "1Gi" })).toEqual([
        EPHEMERAL,
        RAM,
        { size: 1, unit: "Gi", isPersistent: true, type: "beta2", name: "data", mount: "/mnt/data", isReadOnly: false }
      ]);
      expect(editedStorage([EPHEMERAL], { name: "db", mount: "/var/lib/postgresql" })).toEqual([
        EPHEMERAL,
        { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "db", mount: "/var/lib/postgresql", isReadOnly: false }
      ]);
    });

    it("refuses a volume name the form does not have", () => {
      expect(() => editedStorage([EPHEMERAL, DATA, CACHE], { name: "logs", class: "beta2" })).toThrow(
        new ConfigureFormEditError('The form has no persistent volume named "logs". Its volumes are: data, cache.')
      );
      expect(() => editedStorage([EPHEMERAL, DATA], { name: "logs", remove: true })).toThrow('no persistent volume named "logs"');
      expect(() => editedStorage([EPHEMERAL], { name: "logs", remove: true })).toThrow("Its volumes are: none.");
    });
  });

  it("replaces a placement's attributes and regions", () => {
    const values = formValues();
    values.placements[0] = { ...values.placements[0], attributes: [{ id: "a", key: "host", value: "akash" }], regions: ["us-west"] };

    const edited = applyConfigureFormEdit(values, {
      services: [],
      placements: [{ placement: "dcloud", changes: { attributes: [{ key: "tier", value: "community" }], regions: [] } }]
    });
    const untouched = applyConfigureFormEdit(values, { services: [], placements: [{ placement: "dcloud", changes: {} }] });

    expect(edited.placements).toEqual([{ ...values.placements[0], attributes: [{ key: "tier", value: "community" }], regions: [] }]);
    expect(untouched.placements).toEqual(values.placements);
  });

  it("refuses a service or placement the form does not have", () => {
    expect(() => applyConfigureFormEdit(formValues(), { services: [{ service: "api", changes: { cpu: 1 } }], placements: [] })).toThrow(
      new ConfigureFormEditError('The form has no service named "api". Its services are: web, worker.')
    );
    expect(() => applyConfigureFormEdit(formValues(), { services: [], placements: [{ placement: "eu", changes: { regions: [] } }] })).toThrow(
      new ConfigureFormEditError('The form has no placement named "eu". Its placements are: dcloud.')
    );
  });

  function editedStorage(storage: StorageVolume[], persistentStorage: NonNullable<ServiceChanges["persistentStorage"]>): StorageVolume[] {
    return applyConfigureFormEdit(formValues({ storage }), editOf({ persistentStorage })).services[0].profile.storage;
  }

  function editOf(changes: ServiceChanges): ConfigureFormEdit {
    return { services: [{ service: "web", changes }], placements: [] };
  }

  function formValues(profile: Partial<ServiceType["profile"]> = {}): SdlBuilderFormValuesType {
    const values = defaultServiceWithPlacement({
      title: "web",
      image: "nginx:alpine",
      env: [{ id: "1", key: "API_TOKEN", value: "hunter22", isSecret: true }]
    });
    values.placements[0] = { ...values.placements[0], name: "dcloud" };
    values.services[0] = {
      ...values.services[0],
      profile: { ...values.services[0].profile, cpu: 0.1, ram: 128, ramUnit: "Mi", storage: [EPHEMERAL, RAM, DATA], ...profile }
    };
    values.services.push({ ...values.services[0], id: "worker", title: "worker" });
    return values;
  }
});
