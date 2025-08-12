import type { ProviderHttpService } from "@akashnetwork/http-sdk";
import type { JwtTokenPayload } from "@akashnetwork/jwt";
import { mock } from "jest-mock-extended";

import type { AuditorService } from "@src/provider/services/auditors/auditors.service";
import type { JwtTokenService } from "@src/provider/services/jwt-token/jwt-token.service";
import type { ProviderAttributesSchemaService } from "@src/provider/services/provider-attributes-schema/provider-attributes-schema.service";
import { ProviderService } from "./provider.service";

describe(ProviderService.name, () => {
  describe("sendManifest", () => {
    it("should send manifest successfully on first attempt", async () => {
      const { service, jwtTokenService, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const manifest = '{"quantity":{"val":"1"}}';
      const walletId = 1;
      const jwtToken = "jwt-token-123";
      const hostUri = "https://provider.example.com";

      const mockProviderResponse = {
        provider: {
          owner: providerAddress,
          host_uri: hostUri,
          attributes: [],
          info: { email: "", website: "" }
        }
      };

      const leases: JwtTokenPayload["leases"] = {
        access: "granular",
        permissions: [{ provider: providerAddress, access: "scoped", scope: ["send-manifest"] }]
      };

      providerHttpService.getProvider.mockResolvedValue(mockProviderResponse);
      jwtTokenService.generateJwtToken.mockResolvedValue(jwtToken);
      jwtTokenService.getScopedLeases.mockReturnValue(leases);
      providerHttpService.sendManifest.mockResolvedValue({ success: true });

      const result = await service.sendManifest({ provider: providerAddress, dseq, manifest, walletId });

      expect(providerHttpService.getProvider).toHaveBeenCalledWith(providerAddress);
      expect(jwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId,
        leases
      });
      expect(providerHttpService.sendManifest).toHaveBeenCalledWith({
        hostUri,
        dseq,
        manifest: '{"size":{"val":"1"}}',
        jwtToken
      });
      expect(result).toEqual({ success: true });
    });

    it("should retry on lease not found error and succeed", async () => {
      const { service, jwtTokenService, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const manifest = '{"quantity":{"val":"1"}}';
      const walletId = 1;
      const jwtToken = "jwt-token-123";
      const hostUri = "https://provider.example.com";

      const mockProviderResponse = {
        provider: {
          owner: providerAddress,
          host_uri: hostUri,
          attributes: [],
          info: { email: "", website: "" }
        }
      };

      providerHttpService.getProvider.mockResolvedValue(mockProviderResponse);
      jwtTokenService.generateJwtToken.mockResolvedValue(jwtToken);
      providerHttpService.sendManifest.mockRejectedValueOnce(new Error("no lease for deployment")).mockResolvedValueOnce({ success: true });

      const result = await service.sendManifest({ provider: providerAddress, dseq, manifest, walletId });

      expect(providerHttpService.sendManifest).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    }, 10000);

    it("should throw error when provider not found", async () => {
      const { service, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const manifest = '{"quantity":{"val":"1"}}';
      const walletId = 1;

      providerHttpService.getProvider.mockRejectedValue(new Error(`Provider ${providerAddress} not found`));

      await expect(service.sendManifest({ provider: providerAddress, dseq, manifest, walletId })).rejects.toThrow(`Provider ${providerAddress} not found`);
    });

    it("should throw error after max retries", async () => {
      const { service, jwtTokenService, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const manifest = '{"quantity":{"val":"1"}}';
      const walletId = 1;
      const jwtToken = "jwt-token-123";
      const hostUri = "https://provider.example.com";

      const mockProviderResponse = {
        provider: {
          owner: providerAddress,
          host_uri: hostUri,
          attributes: [],
          info: { email: "", website: "" }
        }
      };

      providerHttpService.getProvider.mockResolvedValue(mockProviderResponse);
      jwtTokenService.generateJwtToken.mockResolvedValue(jwtToken);
      providerHttpService.sendManifest.mockRejectedValue(new Error("no lease for deployment"));

      await expect(service.sendManifest({ provider: providerAddress, dseq, manifest, walletId })).rejects.toThrow("no lease for deployment");

      expect(providerHttpService.sendManifest).toHaveBeenCalledTimes(3);
    }, 15000);

    it("should throw error immediately for non-lease errors", async () => {
      const { service, jwtTokenService, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const manifest = '{"quantity":{"val":"1"}}';
      const walletId = 1;
      const jwtToken = "jwt-token-123";
      const hostUri = "https://provider.example.com";

      const mockProviderResponse = {
        provider: {
          owner: providerAddress,
          host_uri: hostUri,
          attributes: [],
          info: { email: "", website: "" }
        }
      };

      providerHttpService.getProvider.mockResolvedValue(mockProviderResponse);
      jwtTokenService.generateJwtToken.mockResolvedValue(jwtToken);
      providerHttpService.sendManifest.mockRejectedValue(new Error("network error"));

      await expect(service.sendManifest({ provider: providerAddress, dseq, manifest, walletId })).rejects.toThrow("network error");

      expect(providerHttpService.sendManifest).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLeaseStatus", () => {
    it("should get lease status successfully", async () => {
      const { service, jwtTokenService, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const gseq = 1;
      const oseq = 1;
      const walletId = 1;
      const jwtToken = "jwt-token-123";
      const hostUri = "https://provider.example.com";

      const mockProviderResponse = {
        provider: {
          owner: providerAddress,
          host_uri: hostUri,
          attributes: [],
          info: { email: "", website: "" }
        }
      };

      const mockLeaseStatus = {
        forwarded_ports: {},
        ips: {},
        services: {}
      };

      const leases: JwtTokenPayload["leases"] = {
        access: "granular",
        permissions: [{ provider: providerAddress, access: "scoped", scope: ["status"] }]
      };

      providerHttpService.getProvider.mockResolvedValue(mockProviderResponse);
      jwtTokenService.generateJwtToken.mockResolvedValue(jwtToken);
      jwtTokenService.getScopedLeases.mockReturnValue(leases);
      providerHttpService.getLeaseStatus.mockResolvedValue(mockLeaseStatus);

      const result = await service.getLeaseStatus(providerAddress, dseq, gseq, oseq, walletId);

      expect(providerHttpService.getProvider).toHaveBeenCalledWith(providerAddress);
      expect(jwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId,
        leases
      });
      expect(providerHttpService.getLeaseStatus).toHaveBeenCalledWith({
        hostUri,
        dseq,
        gseq,
        oseq,
        jwtToken
      });
      expect(result).toEqual(mockLeaseStatus);
    });

    it("should throw error when provider not found", async () => {
      const { service, providerHttpService } = setup();

      const providerAddress = "akash1provider123";
      const dseq = "123456";
      const gseq = 1;
      const oseq = 1;
      const walletId = 1;

      providerHttpService.getProvider.mockRejectedValue(new Error(`Provider ${providerAddress} not found`));

      await expect(service.getLeaseStatus(providerAddress, dseq, gseq, oseq, walletId)).rejects.toThrow(`Provider ${providerAddress} not found`);
    });
  });

  function setup() {
    const providerHttpService = mock<ProviderHttpService>();
    const providerAttributesSchemaService = mock<ProviderAttributesSchemaService>();
    const auditorsService = mock<AuditorService>();
    const jwtTokenService = mock<JwtTokenService>();

    const service = new ProviderService(providerHttpService, providerAttributesSchemaService, auditorsService, jwtTokenService);

    return {
      service,
      providerHttpService,
      providerAttributesSchemaService,
      auditorsService,
      jwtTokenService
    };
  }
});
