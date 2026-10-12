import { describe, expect, it } from "vitest";

import type { ForwardedPort } from "@src/queries/useLeaseQuery";
import { SSH_VM_IMAGES } from "@src/utils/sdl/vmImages";
import type { ManifestServiceDetail } from "../DeploymentPlacements/placementModel";
import { buildSshCommands, isSshService } from "./sshAccess";

describe("sshAccess", () => {
  describe("isSshService", () => {
    it("recognizes a service running a managed SSH VM image", () => {
      expect(isSshService({ image: SSH_VM_IMAGES["Ubuntu 24.04"], env: [] })).toBe(true);
    });

    it("recognizes a service that carries an SSH public key", () => {
      expect(isSshService({ image: "ghcr.io/akash-network/ubuntu-2404-ssh:1", env: [{ key: "SSH_PUBKEY", value: "ssh-ed25519 AAAA" }] })).toBe(true);
    });

    it("leaves out a service with another image and no SSH public key", () => {
      expect(isSshService({ image: "nginx:latest", env: [{ key: "PORT", value: "80" }] })).toBe(false);
    });

    it("leaves out a service whose image the definition does not name", () => {
      expect(isSshService({ env: [] })).toBe(false);
    });

    it("leaves out a service that declares no environment", () => {
      expect(isSshService({ image: "nginx:latest" })).toBe(false);
    });
  });

  describe("buildSshCommands", () => {
    it("builds the ssh command from the port the provider forwards to port 22", () => {
      const commands = buildSshCommands(
        { vm: vmService() },
        { vm: [forwardedPort({ port: 80, externalPort: 31080 }), forwardedPort({ host: "provider.example.com", port: 22, externalPort: 31022 })] }
      );

      expect(commands).toEqual([{ serviceName: "vm", command: "ssh root@provider.example.com -p 31022 -i ~/.ssh/id_rsa" }]);
    });

    it("builds one command per SSH service", () => {
      const commands = buildSshCommands(
        { vm: vmService(), worker: vmService() },
        { vm: [forwardedPort({ externalPort: 31022 })], worker: [forwardedPort({ externalPort: 32022 })] }
      );

      expect(commands.map(command => command.serviceName)).toEqual(["vm", "worker"]);
    });

    it("skips a service that forwards port 22 without running SSH", () => {
      expect(buildSshCommands({ web: { image: "nginx:latest", env: [] } }, { web: [forwardedPort()] })).toEqual([]);
    });

    it("skips a forwarded service the definition does not declare", () => {
      expect(buildSshCommands({ vm: vmService() }, { sidecar: [forwardedPort()] })).toEqual([]);
    });

    it("skips an SSH service whose port 22 the provider does not forward", () => {
      expect(buildSshCommands({ vm: vmService() }, { vm: [forwardedPort({ port: 80 })] })).toEqual([]);
    });

    it("builds the command for a host given as an ip address", () => {
      const commands = buildSshCommands({ vm: vmService() }, { vm: [forwardedPort({ host: "203.0.113.7" }), forwardedPort({ host: "2001:db8::7" })] });

      expect(commands.map(command => command.command)).toEqual([
        "ssh root@203.0.113.7 -p 31022 -i ~/.ssh/id_rsa",
        "ssh root@2001:db8::7 -p 31022 -i ~/.ssh/id_rsa"
      ]);
    });

    it.each(["provider.example.com; rm -rf ~", "provider.example.com $(id)", "provider.example.com`id`", "provider example com", ""])(
      "skips a forwarded port whose host %j is not a plain hostname or ip address",
      host => {
        expect(buildSshCommands({ vm: vmService() }, { vm: [forwardedPort({ host })] })).toEqual([]);
      }
    );

    it.each([0, 65536, 22.5, "31022; id" as unknown as number])("skips a forwarded port whose external port %j is not a valid port", externalPort => {
      expect(buildSshCommands({ vm: vmService() }, { vm: [forwardedPort({ externalPort })] })).toEqual([]);
    });

    it("keeps the highest valid external port", () => {
      expect(buildSshCommands({ vm: vmService() }, { vm: [forwardedPort({ externalPort: 65535 })] })).toEqual([
        { serviceName: "vm", command: "ssh root@provider.example.com -p 65535 -i ~/.ssh/id_rsa" }
      ]);
    });
  });

  function vmService(): ManifestServiceDetail {
    return { image: SSH_VM_IMAGES["Ubuntu 24.04"], env: [{ key: "SSH_PUBKEY", value: "ssh-ed25519 AAAA" }] };
  }

  function forwardedPort(overrides: Partial<ForwardedPort> = {}): ForwardedPort {
    return { host: "provider.example.com", port: 22, externalPort: 31022, available: 1, ...overrides };
  }
});
