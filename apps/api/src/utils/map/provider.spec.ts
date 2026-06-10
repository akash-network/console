import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it } from "vitest";

import { createProviderSeed } from "../../../test/seeders/provider.seeder";
import { createProviderAttributesSchema } from "../../../test/seeders/provider-attributes-schema.seeder";
import { mapProviderToList } from "./provider";

const providerAttributeSchemaStub = createProviderAttributesSchema();

function mapWithAttributes(attributes: Array<{ key: string; value: string }>) {
  const provider = {
    ...createProviderSeed({ isOnline: true, cosmosSdkVersion: "v0.45.9" }),
    providerAttributes: attributes,
    providerAttributeSignatures: []
  } as Provider;

  return mapProviderToList(provider, providerAttributeSchemaStub, [], undefined);
}

describe(mapProviderToList.name, () => {
  describe("discordUsername", () => {
    it("maps discord-username from on-chain attributes", () => {
      const mapped = mapWithAttributes([{ key: "discord-username", value: "provider_contact" }]);

      expect(mapped.discordUsername).toBe("provider_contact");
    });

    it("is null when discord-username is absent", () => {
      const mapped = mapWithAttributes([{ key: "host", value: "example.com" }]);

      expect(mapped.discordUsername).toBeNull();
    });
  });

  describe("locationRegion", () => {
    it("maps location-region from on-chain attributes", () => {
      const mapped = mapWithAttributes([{ key: "location-region", value: "na-us-west" }]);

      expect(mapped.locationRegion).toBe("na-us-west");
    });

    it("is null when only legacy region is present", () => {
      const mapped = mapWithAttributes([{ key: "region", value: "us-west" }]);

      expect(mapped.locationRegion).toBeNull();
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

  describe("hardwareShm", () => {
    it("maps shm capability attributes from the schema", () => {
      const mapped = mapWithAttributes([
        { key: "capabilities/storage/2/class", value: "ram" },
        { key: "capabilities/storage/2/persistent", value: "false" }
      ]);

      expect(mapped.hardwareShm).toEqual(["SHM storage class", "SHM non-persistent"]);
    });
  });

  describe("hardwareGpuCapabilities", () => {
    it("maps gpu capability attributes from the schema", () => {
      const mapped = mapWithAttributes([{ key: "capabilities/gpu/vendor/nvidia/model/rtx4090", value: "true" }]);

      expect(mapped.hardwareGpuCapabilities).toEqual(["nvidia rtx4090 24Gi pcie"]);
    });
  });

  describe("featPersistentStorage", () => {
    it("is true when feat-persistent-storage is true", () => {
      const mapped = mapWithAttributes([{ key: "feat-persistent-storage", value: "true" }]);

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
