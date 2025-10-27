import type { NetworkStore } from "@akashnetwork/network-store";
import { mock } from "jest-mock-extended";

import { toBase64 } from "@src/utils/encoding";
import type { LocalDeploymentData } from "./deployment-storage.service";
import { DeploymentStorageService } from "./deployment-storage.service";

describe(DeploymentStorageService.name, () => {
  const walletAddress = "akash1234567890abcdef";
  const dseq = "12345";

  describe("get", () => {
    it("returns null when dseq is falsy", () => {
      const { service } = setup();
      expect(service.get(walletAddress, null)).toBeNull();
      expect(service.get(walletAddress, undefined)).toBeNull();
      expect(service.get(walletAddress, "")).toBeNull();
    });

    it("returns null when walletAddress is falsy", () => {
      const { service } = setup();
      expect(service.get(null, dseq)).toBeNull();
      expect(service.get(undefined, dseq)).toBeNull();
      expect(service.get("", dseq)).toBeNull();
    });

    it("returns null when both walletAddress and dseq are falsy", () => {
      const { service } = setup();
      expect(service.get(null, null)).toBeNull();
    });

    it("returns null when item does not exist in storage", () => {
      const { service, storage, genKey } = setup();
      storage.getItem.mockReturnValue(null);

      const result = service.get(walletAddress, dseq);

      expect(result).toBeNull();
      expect(storage.getItem).toHaveBeenCalledWith(genKey(walletAddress, dseq));
    });

    it("returns deployment data when item exists in storage", () => {
      const { service, storage, genKey } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
      const mockData: LocalDeploymentData = {
        owner: walletAddress,
        name: "test-deployment",
        manifest: "version: '2.0'",
        manifestVersion
      };
      const storedData = { ...mockData, manifestVersion: toBase64(manifestVersion) };
      storage.getItem.mockReturnValue(JSON.stringify(storedData));

      const result = service.get(walletAddress, dseq);

      expect(result).toEqual(mockData);
      expect(storage.getItem).toHaveBeenCalledWith(genKey(walletAddress, dseq));
    });

    it("handles manifestVersion as object and converts to Uint8Array (legacy format in storage)", () => {
      const { service, storage } = setup();
      const manifestVersionAsObject = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };
      const storedData = {
        owner: walletAddress,
        name: "test-deployment",
        manifest: "version: '2.0'",
        manifestVersion: manifestVersionAsObject
      };
      storage.getItem.mockReturnValue(JSON.stringify(storedData));

      const result = service.get(walletAddress, dseq);

      expect(result).toBeDefined();
      expect(result?.manifestVersion).toBeInstanceOf(Uint8Array);
      expect(Array.from(result!.manifestVersion)).toEqual([1, 2, 3, 4, 5]);
    });

    it("handles manifestVersion as base64 string and converts to Uint8Array", () => {
      const { service, storage } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
      const base64ManifestVersion = toBase64(manifestVersion);
      const storedData = {
        owner: walletAddress,
        name: "test-deployment",
        manifest: "version: '2.0'",
        manifestVersion: base64ManifestVersion
      };
      storage.getItem.mockReturnValue(JSON.stringify(storedData));

      const result = service.get(walletAddress, dseq);

      expect(result).toBeDefined();
      expect(result?.manifestVersion).toBeInstanceOf(Uint8Array);
      expect(result?.manifestVersion).toEqual(manifestVersion);
    });
  });

  describe("set", () => {
    it("does nothing when dseq or walletAddress is falsy", () => {
      const { service, storage } = setup();
      const data = {
        name: "test-deployment",
        manifest: "version: '2.0'",
        manifestVersion: new Uint8Array([1, 2, 3, 4, 5])
      };

      service.set(walletAddress, null, data);
      service.set(walletAddress, undefined, data);
      service.set(walletAddress, "", data);

      service.set(null, dseq, data);
      service.set(undefined, dseq, data);
      service.set("", dseq, data);

      service.set("", undefined, data);

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it("stores deployment data with owner and base64 encoded manifestVersion", () => {
      const { service, storage, genKey } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
      const data = {
        name: "test-deployment",
        manifest: "version: '2.0'",
        manifestVersion
      };

      service.set(walletAddress, dseq, data);

      const expectedKey = genKey(walletAddress, dseq);
      const expectedData = {
        owner: walletAddress,
        name: data.name,
        manifest: data.manifest,
        manifestVersion: toBase64(manifestVersion)
      };

      expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
    });
  });

  describe("update", () => {
    it("does nothing when dseq or walletAddress is falsy", () => {
      const { service, storage } = setup();
      const data = { name: "updated-name" };

      service.update(walletAddress, null, data);
      service.update(walletAddress, undefined, data);
      service.update(walletAddress, "", data);

      service.update(null, dseq, data);
      service.update(undefined, dseq, data);
      service.update("", dseq, data);

      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it("sets the value when current data does not exist", () => {
      const { service, storage } = setup();
      storage.getItem.mockReturnValue(null);
      const data = { name: "updated-name" };

      service.update(walletAddress, dseq, data);

      expect(storage.getItem).toHaveBeenCalled();
      expect(storage.setItem).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ owner: walletAddress, name: "updated-name" }));
    });

    it("updates existing deployment data", () => {
      const { service, storage, genKey } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
      const existingData: LocalDeploymentData = {
        owner: walletAddress,
        name: "old-name",
        manifest: "version: '2.0'",
        manifestVersion: manifestVersion
      };
      const storedData = { ...existingData, manifestVersion: toBase64(manifestVersion) };
      storage.getItem.mockReturnValue(JSON.stringify(storedData));

      service.update(walletAddress, dseq, { name: "updated-name" });

      const expectedKey = genKey(walletAddress, dseq);
      const expectedData = {
        owner: walletAddress,
        name: "updated-name",
        manifest: existingData.manifest,
        manifestVersion: toBase64(manifestVersion)
      };

      expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
    });

    it("updates multiple fields in existing deployment data", () => {
      const { service, storage, genKey } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
      const existingData: LocalDeploymentData = {
        owner: walletAddress,
        name: "old-name",
        manifest: "version: '2.0'",
        manifestVersion
      };
      const storedData = { ...existingData, manifestVersion: toBase64(manifestVersion) };
      storage.getItem.mockReturnValue(JSON.stringify(storedData));

      const newManifestVersion = new Uint8Array([6, 7, 8, 9, 10]);
      service.update(walletAddress, dseq, {
        name: "updated-name",
        manifest: "version: '3.0'",
        manifestVersion: newManifestVersion
      });

      const expectedKey = genKey(walletAddress, dseq);
      const expectedData = {
        owner: walletAddress,
        name: "updated-name",
        manifest: "version: '3.0'",
        manifestVersion: toBase64(newManifestVersion)
      };

      expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
    });
  });

  describe("delete", () => {
    it("does nothing when dseq is not provided", () => {
      const { service, storage } = setup();

      service.delete(walletAddress, null);
      service.delete(walletAddress, undefined);
      service.delete(walletAddress, "");

      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it("does nothing when walletAddress is not provided", () => {
      const { service, storage } = setup();

      service.delete(null, dseq);
      service.delete(undefined, dseq);
      service.delete("", dseq);

      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it("removes deployment data from storage", () => {
      const { service, storage, genKey } = setup();

      service.delete(walletAddress, dseq);

      const expectedKey = genKey(walletAddress, dseq);
      expect(storage.removeItem).toHaveBeenCalledWith(expectedKey);
    });
  });

  function setup() {
    const storage = mock<Storage>();
    const networkId = "testnet";
    const networkStore = mock<NetworkStore>({
      selectedNetworkId: networkId
    });

    const service = new DeploymentStorageService(storage, networkStore);

    return {
      service,
      storage,
      networkStore,
      genKey: (walletAddress: string, dseq: string) => `${networkId}/${walletAddress}/deployments/${dseq}.data`
    };
  }
});
