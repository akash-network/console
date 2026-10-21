import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { applyImportedSshState, readServiceSshKey, takesSshKey, withServiceSshKey } from "./sshKey";
import { SSH_VM_IMAGES } from "./vmImages";

describe("sshKey", () => {
  describe(takesSshKey.name, () => {
    it("takes a key on a managed vm image, even before one is set", () => {
      expect(takesSshKey({ image: SSH_VM_IMAGES["Ubuntu 24.04"], env: [] })).toBe(true);
    });

    it("takes a key on a container that carries SSH_PUBKEY", () => {
      expect(takesSshKey({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", env: [{ key: "PORT" }, { key: "SSH_PUBKEY" }] })).toBe(true);
    });

    it("takes no key on a container without SSH_PUBKEY", () => {
      expect(takesSshKey({ image: "nginx:1.25", env: [{ key: "PORT" }, undefined] })).toBe(false);
    });

    it("takes no key on a service with neither an image nor variables", () => {
      expect(takesSshKey({})).toBe(false);
    });
  });

  describe(readServiceSshKey.name, () => {
    it("prefers the managed SSH_PUBKEY env entry over the sshPubKey field", () => {
      const service = mock<ServiceType>({ sshPubKey: "field-key", env: [{ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "env-key" }] });

      expect(readServiceSshKey(service)).toBe("env-key");
    });

    it("falls back to the sshPubKey field when there is no managed env entry", () => {
      const service = mock<ServiceType>({ sshPubKey: "field-key", env: [{ key: "FOO", value: "bar" }] });

      expect(readServiceSshKey(service)).toBe("field-key");
    });

    it("returns undefined when no key is present", () => {
      const service = mock<ServiceType>({ sshPubKey: "", env: [] });

      expect(readServiceSshKey(service)).toBeUndefined();
    });

    it("honors an explicitly empty managed entry instead of resurrecting the stale field key", () => {
      const service = mock<ServiceType>({ sshPubKey: "field-key", env: [{ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "" }] });

      expect(readServiceSshKey(service)).toBeUndefined();
    });
  });

  describe(withServiceSshKey.name, () => {
    it("sets the field and mirrors a managed SSH_PUBKEY env entry", () => {
      const service = mock<ServiceType>({ sshPubKey: "", env: [{ key: "FOO", value: "bar" }] });

      const result = withServiceSshKey(service, "new-key");

      expect(result.sshPubKey).toBe("new-key");
      expect(result.env).toContainEqual({ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "new-key", isSecret: false });
      expect(result.env).toContainEqual(expect.objectContaining({ key: "FOO", value: "bar" }));
    });

    it("replaces an existing managed entry rather than duplicating it", () => {
      const service = mock<ServiceType>({ sshPubKey: "old", env: [{ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "old" }] });

      const result = withServiceSshKey(service, "fresh");

      expect(result.env?.filter(entry => entry.key === "SSH_PUBKEY")).toHaveLength(1);
      expect(result.env).toContainEqual(expect.objectContaining({ key: "SSH_PUBKEY", value: "fresh" }));
    });

    it("clears the field and removes the managed entry when given an empty key", () => {
      const service = mock<ServiceType>({ sshPubKey: "old", env: [{ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "old" }] });

      const result = withServiceSshKey(service, "");

      expect(result.sshPubKey).toBe("");
      expect(result.env?.some(entry => entry.key === "SSH_PUBKEY")).toBe(false);
    });
  });

  describe(applyImportedSshState.name, () => {
    it("surfaces a managed SSH_PUBKEY env into the sshPubKey field and turns on hasSSHKey", () => {
      const values = mock<SdlBuilderFormValuesType>({
        hasSSHKey: false,
        services: [mock<ServiceType>({ sshPubKey: "", env: [{ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "imported-key" }] })]
      });

      const result = applyImportedSshState(values);

      expect(result.hasSSHKey).toBe(true);
      expect(result.services[0].sshPubKey).toBe("imported-key");
    });

    it("leaves values untouched when no service carries an SSH key", () => {
      const values = mock<SdlBuilderFormValuesType>({
        hasSSHKey: false,
        services: [mock<ServiceType>({ sshPubKey: "", env: [{ key: "FOO", value: "bar" }] })]
      });

      const result = applyImportedSshState(values);

      expect(result.hasSSHKey).toBe(false);
      expect(result.services[0].sshPubKey).toBe("");
    });
  });
});
