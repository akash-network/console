import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";

import { createProviderSeed } from "../../../test/seeders/provider.seeder";
import { mapProviderToList } from "./provider";

const schemaDetail = { key: "test", type: "string" as const, required: false, description: "test", values: null };

const providerAttributeSchemaStub: ProviderAttributesSchema = {
  host: { ...schemaDetail, key: "host" },
  email: { ...schemaDetail, key: "email" },
  "discord-username": { ...schemaDetail, key: "discord-username" },
  organization: { ...schemaDetail, key: "organization" },
  website: { ...schemaDetail, key: "website" },
  tier: { ...schemaDetail, key: "tier" },
  "status-page": { ...schemaDetail, key: "status-page" },
  "location-region": { ...schemaDetail, key: "location-region", type: "option" },
  country: { ...schemaDetail, key: "country" },
  city: { ...schemaDetail, key: "city" },
  timezone: { ...schemaDetail, key: "timezone" },
  "location-type": { ...schemaDetail, key: "location-type" },
  "hosting-provider": { ...schemaDetail, key: "hosting-provider" },
  "hardware-cpu": { ...schemaDetail, key: "hardware-cpu" },
  "hardware-cpu-arch": { ...schemaDetail, key: "hardware-cpu-arch" },
  "hardware-gpu": { ...schemaDetail, key: "hardware-gpu" },
  "hardware-gpu-model": { ...schemaDetail, key: "hardware-gpu-model", type: "multiple-option" },
  "hardware-gpu-capability": { ...schemaDetail, key: "hardware-gpu-capability", type: "multiple-option" },
  "hardware-persistent-storage-class": { ...schemaDetail, key: "hardware-persistent-storage-class", type: "option" },
  "hardware-persistent-storage-capability": { ...schemaDetail, key: "hardware-persistent-storage-capability", type: "boolean" },
  "hardware-cuda": { ...schemaDetail, key: "hardware-cuda" },
  datacenter: { ...schemaDetail, key: "datacenter" },
  "hardware-memory": { ...schemaDetail, key: "hardware-memory" },
  "network-provider": { ...schemaDetail, key: "network-provider" },
  "network-speed-up": { ...schemaDetail, key: "network-speed-up", type: "number" },
  "network-speed-down": { ...schemaDetail, key: "network-speed-down", type: "number" },
  "feat-persistent-storage": { ...schemaDetail, key: "feat-persistent-storage", type: "boolean" },
  "feat-shm": { ...schemaDetail, key: "feat-shm", type: "boolean" },
  "hardware-shm": { ...schemaDetail, key: "hardware-shm", type: "multiple-option" },
  "feat-endpoint-ip": { ...schemaDetail, key: "feat-endpoint-ip", type: "boolean" },
  "feat-endpoint-custom-domain": { ...schemaDetail, key: "feat-endpoint-custom-domain", type: "boolean" }
};

function mapWithAttributes(attributes: Array<{ key: string; value: string }>) {
  const provider = {
    ...createProviderSeed({ isOnline: true, cosmosSdkVersion: "v0.45.9" }),
    providerAttributes: attributes,
    providerAttributeSignatures: []
  } as Provider;

  return mapProviderToList(provider, providerAttributeSchemaStub, [], undefined);
}

describe(mapProviderToList.name, () => {
  describe("locationRegion", () => {
    it("prefers location-region over legacy region", () => {
      const mapped = mapWithAttributes([
        { key: "location-region", value: "na-us-west" },
        { key: "region", value: "us-west" }
      ]);

      expect(mapped.locationRegion).toBe("na-us-west");
    });

    it("falls back to legacy region when location-region is absent", () => {
      const mapped = mapWithAttributes([{ key: "region", value: "us-west" }]);

      expect(mapped.locationRegion).toBe("us-west");
    });
  });

  describe("featShm", () => {
    it("is true when feat-shm is true", () => {
      const mapped = mapWithAttributes([{ key: "feat-shm", value: "true" }]);

      expect(mapped.featShm).toBe(true);
    });

    it("is true when any storage class is ram", () => {
      const mapped = mapWithAttributes([
        { key: "capabilities/storage/2/class", value: "ram" },
        { key: "capabilities/storage/2/persistent", value: "false" }
      ]);

      expect(mapped.featShm).toBe(true);
    });

    it("is false when no shm signals are present", () => {
      const mapped = mapWithAttributes([{ key: "capabilities/storage/1/class", value: "beta3" }]);

      expect(mapped.featShm).toBe(false);
    });
  });

  describe("featPersistentStorage", () => {
    it("is true when feat-persistent-storage is true", () => {
      const mapped = mapWithAttributes([{ key: "feat-persistent-storage", value: "true" }]);

      expect(mapped.featPersistentStorage).toBe(true);
    });

    it("is true when hardware-persistent-storage-capability is true", () => {
      const mapped = mapWithAttributes([{ key: "hardware-persistent-storage-capability", value: "true" }]);

      expect(mapped.featPersistentStorage).toBe(true);
    });

    it("is true when capabilities/storage/1/persistent is true", () => {
      const mapped = mapWithAttributes([{ key: "capabilities/storage/1/persistent", value: "true" }]);

      expect(mapped.featPersistentStorage).toBe(true);
    });

    it("is true when persistent storage is declared on a non-default storage index", () => {
      const mapped = mapWithAttributes([
        { key: "capabilities/storage/1/class", value: "beta3" },
        { key: "capabilities/storage/1/persistent", value: "false" },
        { key: "capabilities/storage/2/class", value: "beta2" },
        { key: "capabilities/storage/2/persistent", value: "true" }
      ]);

      expect(mapped.featPersistentStorage).toBe(true);
    });

    it("is false when no persistent storage signals are present", () => {
      const mapped = mapWithAttributes([{ key: "capabilities/storage/1/persistent", value: "false" }]);

      expect(mapped.featPersistentStorage).toBe(false);
    });
  });
});
