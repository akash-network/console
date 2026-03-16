import type { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { AxiosError } from "axios";
import { Ok } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AUDITOR } from "@src/deployment/config/provider.config";
import { createLeaseStatus } from "../../../../test/seeders/lease-status.seeder";
import { createProviderSeed, createProviderWithAttributeSignatures } from "../../../../test/seeders/provider.seeder";
import { createUserWallet } from "../../../../test/seeders/user-wallet.seeder";
import type { ProviderRepository } from "../../repositories/provider/provider.repository";
import type { AuditorService } from "../auditors/auditors.service";
import type { ProviderAttributesSchemaService } from "../provider-attributes-schema/provider-attributes-schema.service";
import type { ProviderJwtTokenService } from "../provider-jwt-token/provider-jwt-token.service";
import { ProviderService } from "./provider.service";
import type { ProviderProxyService } from "./provider-proxy.service";

const schemaDetail = { key: "test", type: "string" as const, required: false, description: "test", values: null };
const providerAttributeSchemaStub: ProviderAttributesSchema = {
  host: schemaDetail,
  email: schemaDetail,
  organization: schemaDetail,
  website: schemaDetail,
  tier: schemaDetail,
  "status-page": schemaDetail,
  "location-region": schemaDetail,
  country: schemaDetail,
  city: schemaDetail,
  timezone: schemaDetail,
  "location-type": schemaDetail,
  "hosting-provider": schemaDetail,
  "hardware-cpu": schemaDetail,
  "hardware-cpu-arch": schemaDetail,
  "hardware-gpu": schemaDetail,
  "hardware-gpu-model": schemaDetail,
  "hardware-disk": schemaDetail,
  "hardware-memory": schemaDetail,
  "network-provider": schemaDetail,
  "network-speed-up": schemaDetail,
  "network-speed-down": schemaDetail,
  "feat-persistent-storage": schemaDetail,
  "feat-persistent-storage-type": schemaDetail,
  "workload-support-chia": schemaDetail,
  "workload-support-chia-capabilities": schemaDetail,
  "feat-endpoint-ip": schemaDetail,
  "feat-endpoint-custom-domain": schemaDetail
};

describe(ProviderService.name, () => {
  describe("sendManifest", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should send manifest successfully on first attempt", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      const leases: JwtTokenPayload["leases"] = {
        access: "granular",
        permissions: [{ provider: provider.owner, access: "scoped", scope: ["send-manifest"] }]
      };

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));
      jwtTokenService.getGranularLeases.mockReturnValue(leases);
      providerProxyService.request.mockResolvedValue({ success: true });

      const result = await service.sendManifest({
        provider: provider.owner,
        dseq,
        manifest,
        auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
      });

      expect(providerRepository.findActiveByAddress).toHaveBeenCalledWith(provider.owner);
      expect(jwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId: wallet.id,
        leases
      });
      expect(providerProxyService.request).toHaveBeenCalledWith(`/deployment/${dseq}/manifest`, {
        method: "PUT",
        body: '{"size":{"val":"1"}}',
        auth: { type: "jwt", token: jwtToken },
        providerIdentity: {
          owner: provider.owner,
          hostUri: provider.hostUri
        },
        timeout: 15_000
      });
      expect(result).toEqual({ success: true });
    });

    it("should retry on lease not found error and succeed", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      vi.useFakeTimers();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const axiosError = new AxiosError("no lease for deployment");
      axiosError.response = { data: "no lease for deployment" } as any;

      providerProxyService.request.mockRejectedValueOnce(axiosError).mockResolvedValueOnce({ success: true });

      const result = service.sendManifest({
        provider: provider.owner,
        dseq,
        manifest,
        auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
      });
      await vi.runAllTimersAsync();

      await expect(result).resolves.toEqual({ success: true });
      expect(providerProxyService.request).toHaveBeenCalledTimes(2);
    });

    it("should throw error when provider not found", async () => {
      const { service, providerRepository } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const manifest = '{"quantity":{"val":"1"}}';

      providerRepository.findActiveByAddress.mockResolvedValue(null);

      await expect(
        service.sendManifest({
          provider: provider.owner,
          dseq,
          manifest,
          auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
        })
      ).rejects.toThrow(`Provider ${provider.owner} not found`);
    });

    it("should throw error after max retries", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      vi.useFakeTimers();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.number.int({ min: 1, max: 1000 }).toString();
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const axiosError = new AxiosError(
        "no lease for deployment",
        "404",
        undefined,
        {},
        {
          status: 400,
          statusText: "Bad Request",
          data: "no lease for deployment",
          headers: {},
          config: {} as any
        }
      );
      providerProxyService.request.mockRejectedValue(axiosError);
      const result = service
        .sendManifest({
          provider: provider.owner,
          dseq,
          manifest,
          auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
        })
        .catch(error => ({ error }));

      await vi.runAllTimersAsync();
      const { error } = (await result) as { error: Error };
      expect(error.message).toContain("no lease for deployment");

      expect(providerProxyService.request).toHaveBeenCalledTimes(3);
    }, 15000);

    it("should throw error immediately for non-lease errors", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.number.int({ min: 1, max: 1000 }).toString();
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const axiosError = new AxiosError(
        "network error",
        "500",
        undefined,
        {},
        {
          status: 500,
          statusText: "Internal Server Error",
          data: "network error",
          headers: {},
          config: {} as any
        }
      );
      providerProxyService.request.mockRejectedValue(axiosError);

      await expect(
        service.sendManifest({
          provider: provider.owner,
          dseq,
          manifest,
          auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
        })
      ).rejects.toThrow("Provider service is temporarily unavailable");

      expect(providerProxyService.request).toHaveBeenCalledTimes(1);
    });

    it("should convert AxiosError with 422 status to HTTP error", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const axiosError = new AxiosError("Request failed with status code 422");
      axiosError.response = {
        status: 422,
        statusText: "Unprocessable Entity",
        data: { message: "Manifest validation failed" },
        headers: {},
        config: {} as any
      };
      providerProxyService.request.mockRejectedValue(axiosError);

      await expect(
        service.sendManifest({
          provider: provider.owner,
          dseq,
          manifest,
          auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
        })
      ).rejects.toMatchObject({
        status: 422,
        message: "Manifest validation failed"
      });

      expect(providerProxyService.request).toHaveBeenCalledTimes(1);
    });

    it("should convert AxiosError with 400 status to HTTP error", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const manifest = '{"quantity":{"val":"1"}}';
      const jwtToken = faker.string.alphanumeric(32);

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));

      const axiosError = new AxiosError("Request failed with status code 400");
      axiosError.response = {
        status: 400,
        statusText: "Bad Request",
        data: "Invalid manifest format",
        headers: {},
        config: {} as any
      };
      providerProxyService.request.mockRejectedValue(axiosError);

      await expect(
        service.sendManifest({
          provider: provider.owner,
          dseq,
          manifest,
          auth: await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
        })
      ).rejects.toMatchObject({
        status: 400,
        message: "Invalid manifest format"
      });

      expect(providerProxyService.request).toHaveBeenCalledTimes(1);
    });
  });

  describe("getLeaseStatus", () => {
    it("should get lease status successfully", async () => {
      const { service, jwtTokenService, providerRepository, providerProxyService } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const gseq = faker.number.int({ min: 1, max: 10 });
      const oseq = faker.number.int({ min: 1, max: 10 });
      const jwtToken = faker.string.alphanumeric(32);

      const leaseStatus = createLeaseStatus();

      const leases: JwtTokenPayload["leases"] = {
        access: "granular",
        permissions: [{ provider: provider.owner, access: "scoped", scope: ["status"] }]
      };

      providerRepository.findActiveByAddress.mockResolvedValue(provider);
      jwtTokenService.generateJwtToken.mockResolvedValue(Ok(jwtToken));
      jwtTokenService.getGranularLeases.mockReturnValue(leases);
      providerProxyService.request.mockResolvedValue(leaseStatus);

      const result = await service.getLeaseStatus(
        provider.owner,
        dseq,
        gseq,
        oseq,
        await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner })
      );

      expect(providerRepository.findActiveByAddress).toHaveBeenCalledWith(provider.owner);
      expect(jwtTokenService.generateJwtToken).toHaveBeenCalledWith({
        walletId: wallet.id,
        leases
      });
      expect(providerProxyService.request).toHaveBeenCalledWith(`/lease/${dseq}/${gseq}/${oseq}/status`, {
        method: "GET",
        auth: { type: "jwt", token: jwtToken },
        providerIdentity: {
          owner: provider.owner,
          hostUri: provider.hostUri
        },
        timeout: 15000
      });
      expect(result).toEqual(leaseStatus);
    });

    it("should throw error when provider not found", async () => {
      const { service, providerRepository } = setup();

      const provider = createProviderSeed() as unknown as Provider;
      const wallet = createUserWallet();
      const dseq = faker.string.numeric(6);
      const gseq = faker.number.int({ min: 1, max: 10 });
      const oseq = faker.number.int({ min: 1, max: 10 });

      providerRepository.findActiveByAddress.mockResolvedValue(null);

      await expect(
        service.getLeaseStatus(provider.owner, dseq, gseq, oseq, await service.toProviderAuth({ walletId: wallet.id, provider: provider.owner }))
      ).rejects.toThrow(`Provider ${provider.owner} not found`);
    });
  });

  describe("getProviderListByAddresses", () => {
    it("should return mapped providers for given addresses", async () => {
      const { service, providerRepository, auditorsService, providerAttributesSchemaService } = setup();

      const provider1 = createProviderWithAttributeSignatures(AUDITOR) as unknown as Provider;
      const provider2 = createProviderWithAttributeSignatures(AUDITOR) as unknown as Provider;
      const addresses = [provider1.owner, provider2.owner];

      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider1, provider2]);
      providerRepository.getProviderWithNodes.mockResolvedValue([]);
      auditorsService.getAuditors.mockResolvedValue([]);
      providerAttributesSchemaService.getProviderAttributesSchema.mockResolvedValue(providerAttributeSchemaStub);

      const result = await service.getProviderListByAddresses(addresses);

      expect(providerRepository.getWithAttributesAndAuditors).toHaveBeenCalledWith({ trial: false, addresses });
      expect(providerRepository.getProviderWithNodes).toHaveBeenCalledWith({ addresses });
      expect(result).toHaveLength(2);
      expect(result.map(p => p.owner)).toEqual([provider1.owner, provider2.owner]);
    });

    it("should pass trial flag to repository", async () => {
      const { service, providerRepository, auditorsService, providerAttributesSchemaService } = setup();

      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([]);
      providerRepository.getProviderWithNodes.mockResolvedValue([]);
      auditorsService.getAuditors.mockResolvedValue([]);
      providerAttributesSchemaService.getProviderAttributesSchema.mockResolvedValue(providerAttributeSchemaStub);

      await service.getProviderListByAddresses(["addr1"], true);

      expect(providerRepository.getWithAttributesAndAuditors).toHaveBeenCalledWith({ trial: true, addresses: ["addr1"] });
    });

    it("should deduplicate providers with the same owner", async () => {
      const { service, providerRepository, auditorsService, providerAttributesSchemaService } = setup();

      const provider1 = createProviderWithAttributeSignatures(AUDITOR) as unknown as Provider;
      const provider2 = { ...createProviderWithAttributeSignatures(AUDITOR), owner: provider1.owner } as unknown as Provider;

      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([provider1, provider2]);
      providerRepository.getProviderWithNodes.mockResolvedValue([]);
      auditorsService.getAuditors.mockResolvedValue([]);
      providerAttributesSchemaService.getProviderAttributesSchema.mockResolvedValue(providerAttributeSchemaStub);

      const result = await service.getProviderListByAddresses([provider1.owner]);

      expect(result).toHaveLength(1);
      expect(result[0].owner).toBe(provider1.owner);
    });

    it("should return empty array when no providers match", async () => {
      const { service, providerRepository, auditorsService, providerAttributesSchemaService } = setup();

      providerRepository.getWithAttributesAndAuditors.mockResolvedValue([]);
      providerRepository.getProviderWithNodes.mockResolvedValue([]);
      auditorsService.getAuditors.mockResolvedValue([]);
      providerAttributesSchemaService.getProviderAttributesSchema.mockResolvedValue(providerAttributeSchemaStub);

      const result = await service.getProviderListByAddresses(["unknown-addr"]);

      expect(result).toEqual([]);
    });
  });

  function setup() {
    const providerProxyService = mock<ProviderProxyService>();
    const providerRepository = mock<ProviderRepository>();
    const providerAttributesSchemaService = mock<ProviderAttributesSchemaService>();
    const auditorsService = mock<AuditorService>();
    const jwtTokenService = mock<ProviderJwtTokenService>({
      generateJwtToken: jest.fn().mockResolvedValue(Ok("mock-jwt-token"))
    });

    const service = new ProviderService(providerProxyService, providerRepository, providerAttributesSchemaService, auditorsService, jwtTokenService);

    return {
      service,
      providerRepository,
      providerAttributesSchemaService,
      auditorsService,
      jwtTokenService,
      providerProxyService
    };
  }
});
